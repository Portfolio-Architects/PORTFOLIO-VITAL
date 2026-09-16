"""Write-Ahead Transaction Journal and Manager for Public Administrative File Organizer.

Guarantees:
- Durable persistence via os.fsync on every transaction state transition.
- Atomically records: tx_id, timestamp, source_path, target_path, file_size,
  sha256_pre, sha256_post, status (PENDING -> COMMITTED -> ROLLED_BACK).
- Tracks created directory hierarchy in exact order of creation.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Set


@dataclass
class TransactionRecord:
    """Represents a single file migration transaction record."""
    tx_id: str
    timestamp: str
    source_path: str
    target_path: str
    file_size: int
    sha256_pre: str
    sha256_post: str = ""
    status: str = "PENDING"  # PENDING, COMMITTED, FAILED, ROLLED_BACK
    created_directories: List[str] = field(default_factory=list)
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize record with bidirectional compatibility aliases."""
        return {
            "tx_id": self.tx_id,
            "timestamp": self.timestamp,
            "source_path": str(self.source_path),
            "original_path": str(self.source_path),
            "target_path": str(self.target_path),
            "file_size": self.file_size,
            "file_size_bytes": self.file_size,
            "sha256_pre": self.sha256_pre,
            "original_sha256": self.sha256_pre,
            "sha256_post": self.sha256_post,
            "target_sha256": self.sha256_post,
            "status": self.status,
            "created_directories": list(self.created_directories),
            "error_message": self.error_message
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TransactionRecord":
        """Reconstruct TransactionRecord supporting alias field names."""
        source_path = str(data.get("source_path") or data.get("original_path") or "")
        target_path = str(data.get("target_path") or "")
        file_size = int(data.get("file_size") or data.get("file_size_bytes") or 0)
        sha256_pre = str(data.get("sha256_pre") or data.get("original_sha256") or "")
        sha256_post = str(data.get("sha256_post") or data.get("target_sha256") or "")
        status = str(data.get("status") or "PENDING")
        created_dirs = [str(d) for d in data.get("created_directories", [])]

        return cls(
            tx_id=str(data.get("tx_id", "")),
            timestamp=str(data.get("timestamp", "")),
            source_path=source_path,
            target_path=target_path,
            file_size=file_size,
            sha256_pre=sha256_pre,
            sha256_post=sha256_post,
            status=status,
            created_directories=created_dirs,
            error_message=data.get("error_message")
        )


class TransactionManager:
    """Manages write-ahead audit journal (audit_journal.jsonl) with fsync guarantees."""

    def __init__(self, journal_path: Path | str):
        self.journal_path = Path(journal_path).resolve()
        self.journal_path.parent.mkdir(parents=True, exist_ok=True)
        self.created_directories: List[Path] = []
        self._created_dir_set: Set[Path] = set()
        self._records: Dict[str, TransactionRecord] = {}
        self._ordered_tx_ids: List[str] = []
        self._seq: int = 0
        self._file_handle = None

        # If journal already exists, load historical state
        if self.journal_path.exists():
            self._load_existing_journal()

    def _get_handle(self):
        """Retrieve open file handle with retry backoff against OS anti-virus/indexer locks."""
        if self._file_handle is None or self._file_handle.closed:
            for attempt in range(10):
                try:
                    self._file_handle = open(self.journal_path, "a", encoding="utf-8")
                    break
                except PermissionError:
                    if attempt == 9:
                        raise
                    time.sleep(0.05 * (1.5 ** attempt))
        return self._file_handle

    def close(self) -> None:
        """Durable flush and close of journal file handle."""
        if self._file_handle and not self._file_handle.closed:
            try:
                self._file_handle.flush()
                os.fsync(self._file_handle.fileno())
                self._file_handle.close()
            except Exception:
                pass
            self._file_handle = None

    def __del__(self):
        self.close()

    def _load_existing_journal(self) -> None:
        """Load prior transactions from journal."""
        records = self.load_journal(self.journal_path)
        for rec in records:
            self._records[rec.tx_id] = rec
            if rec.tx_id not in self._ordered_tx_ids:
                self._ordered_tx_ids.append(rec.tx_id)
            for d_str in rec.created_directories:
                d_path = Path(d_str).resolve()
                if d_path not in self._created_dir_set:
                    self._created_dir_set.add(d_path)
                    self.created_directories.append(d_path)
        self._seq = len(self._ordered_tx_ids)

    def _append_line(self, record_dict: Dict[str, Any]) -> None:
        """Write record to journal with durable os.fsync flushing and anti-lock resilience."""
        line = json.dumps(record_dict, ensure_ascii=False) + "\n"
        for attempt in range(10):
            try:
                h = self._get_handle()
                h.write(line)
                h.flush()
                os.fsync(h.fileno())
                return
            except PermissionError:
                self.close()
                if attempt == 9:
                    raise
                time.sleep(0.05 * (1.5 ** attempt))
            except Exception:
                self.close()
                raise

    def record_created_directory(self, dir_path: Path | str) -> None:
        """Track directory in order of creation."""
        resolved = Path(dir_path).resolve()
        if resolved not in self._created_dir_set:
            self._created_dir_set.add(resolved)
            self.created_directories.append(resolved)

    def record_created_directories(self, dir_paths: List[Path | str]) -> None:
        """Track multiple created directories in order."""
        for dp in dir_paths:
            self.record_created_directory(dp)

    def get_created_directories(self) -> List[Path]:
        """Return shallow-to-deep ordered list of created directories."""
        return list(self.created_directories)

    def start_transaction(
        self,
        source_path: Path | str,
        target_path: Path | str,
        file_size: int,
        sha256_pre: str,
        created_directories: Optional[List[Path | str]] = None
    ) -> TransactionRecord:
        """Atomically record initial PENDING transaction before file operation."""
        self._seq += 1
        now_str = datetime.now(timezone.utc).astimezone().isoformat()
        tx_id = f"tx_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{self._seq:04d}"

        if created_directories:
            self.record_created_directories(created_directories)

        created_strs = [str(d) for d in self.created_directories]

        record = TransactionRecord(
            tx_id=tx_id,
            timestamp=now_str,
            source_path=str(Path(source_path).resolve()),
            target_path=str(Path(target_path).resolve()),
            file_size=file_size,
            sha256_pre=sha256_pre,
            sha256_post="",
            status="PENDING",
            created_directories=created_strs,
            error_message=None
        )

        self._records[tx_id] = record
        if tx_id not in self._ordered_tx_ids:
            self._ordered_tx_ids.append(tx_id)

        self._append_line(record.to_dict())
        return record

    def commit_transaction(self, tx_id: str, sha256_post: str) -> TransactionRecord:
        """Atomically commit transaction with post-relocation checksum."""
        record = self._records.get(tx_id)
        if not record:
            raise KeyError(f"Transaction ID {tx_id} not found in manager.")

        record.sha256_post = sha256_post
        record.status = "COMMITTED"
        record.timestamp = datetime.now(timezone.utc).astimezone().isoformat()
        record.created_directories = [str(d) for d in self.created_directories]

        self._append_line(record.to_dict())
        return record

    def fail_transaction(self, tx_id: str, error_message: str) -> TransactionRecord:
        """Record transaction failure."""
        record = self._records.get(tx_id)
        if not record:
            raise KeyError(f"Transaction ID {tx_id} not found in manager.")

        record.status = "FAILED"
        record.error_message = error_message
        record.timestamp = datetime.now(timezone.utc).astimezone().isoformat()

        self._append_line(record.to_dict())
        return record

    def mark_rolled_back(self, tx_id: str) -> TransactionRecord:
        """Record transaction rollback."""
        record = self._records.get(tx_id)
        if not record:
            # Fallback if record was loaded externally
            record = TransactionRecord(
                tx_id=tx_id,
                timestamp=datetime.now(timezone.utc).astimezone().isoformat(),
                source_path="",
                target_path="",
                file_size=0,
                sha256_pre="",
                status="ROLLED_BACK"
            )
            self._records[tx_id] = record
            self._ordered_tx_ids.append(tx_id)
        else:
            record.status = "ROLLED_BACK"
            record.timestamp = datetime.now(timezone.utc).astimezone().isoformat()

        self._append_line(record.to_dict())
        return record

    def get_committed_transactions(self) -> List[TransactionRecord]:
        """Return all transactions whose current status is COMMITTED or COMPLETED."""
        committed = []
        for tx_id in self._ordered_tx_ids:
            rec = self._records[tx_id]
            if rec.status in ("COMMITTED", "COMPLETED"):
                committed.append(rec)
        return committed

    def get_all_records(self) -> List[TransactionRecord]:
        """Return all unique transaction records in arrival order."""
        return [self._records[tx_id] for tx_id in self._ordered_tx_ids]

    @staticmethod
    def load_journal(journal_path: Path | str) -> List[TransactionRecord]:
        """Parse audit_journal.jsonl and resolve latest state for each transaction."""
        path = Path(journal_path).resolve()
        if not path.exists():
            return []

        records_map: Dict[str, TransactionRecord] = {}
        ordered_keys: List[str] = []

        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    data = json.loads(line_str)
                except json.JSONDecodeError:
                    continue

                rec = TransactionRecord.from_dict(data)
                if rec.tx_id:
                    if rec.tx_id not in ordered_keys:
                        ordered_keys.append(rec.tx_id)
                    # Merge or update state
                    if rec.tx_id in records_map:
                        existing = records_map[rec.tx_id]
                        existing.status = rec.status
                        if rec.sha256_post:
                            existing.sha256_post = rec.sha256_post
                        if rec.error_message:
                            existing.error_message = rec.error_message
                        if rec.created_directories:
                            for d in rec.created_directories:
                                if d not in existing.created_directories:
                                    existing.created_directories.append(d)
                    else:
                        records_map[rec.tx_id] = rec

        return [records_map[k] for k in ordered_keys]
