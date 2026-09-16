"""Rollback Engine and Standalone rollback.py Generator for Public Administrative File Organizer.

Guarantees:
- Reverses file migrations in strict LIFO order (reverse chronological).
- Double SHA-256 verification (target pre-move verification and restored post-move verification).
- Prunes created empty directories in reverse depth order (only if len(os.listdir) == 0).
- Generates zero-dependency standalone rollback.py for direct execution.
"""

from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import shutil
import sys
from typing import Any, Dict, List, Optional, Set

from tools.file_organizer.rollback.transaction_manager import (
    TransactionManager,
    TransactionRecord
)


def compute_sha256(file_path: Path | str) -> str:
    """Calculate SHA-256 checksum with streaming chunks."""
    path = Path(file_path)
    if not path.exists() or not path.is_file():
        return ""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class RollbackEngine:
    """Programmatic rollback engine for undoing file migrations with 100% hash verification."""

    @classmethod
    def resolve_journal_path(cls, journal_or_dir: Path | str) -> Path:
        """Resolve path to audit_journal.jsonl from directory or direct file path."""
        p = Path(journal_or_dir).resolve()
        if p.is_dir():
            candidate = p / "audit_journal.jsonl"
            if candidate.exists():
                return candidate
            candidate_json = p / "audit_manifest.json"
            if candidate_json.exists():
                return candidate_json
            return candidate
        return p

    @classmethod
    def rollback(
        cls,
        journal_path: Path | str,
        dry_run: bool = False,
        verify_only: bool = False
    ) -> Dict[str, Any]:
        """Execute programmatic rollback in strict LIFO order.

        Args:
            journal_path: Path to audit_journal.jsonl or containing directory.
            dry_run: If True, simulates rollback without filesystem mutations.
            verify_only: If True, only checks checksums and path existence.

        Returns:
            Dictionary containing audit summary of rollback execution.
        """
        resolved_journal = cls.resolve_journal_path(journal_path)
        if not resolved_journal.exists():
            return {
                "status": "FAILED",
                "total_transactions": 0,
                "restored_count": 0,
                "already_restored": 0,
                "mismatch_count": 0,
                "sha256_match_rate": 0.0,
                "removed_directories_count": 0,
                "removed_directories": [],
                "errors": [f"Journal not found: {resolved_journal}"]
            }

        tx_manager = TransactionManager(resolved_journal)
        all_records = tx_manager.get_all_records()

        # Filter COMMITTED, COMPLETED, or ROLLED_BACK transactions
        eligible_records = [
            r for r in all_records
            if r.status in ("COMMITTED", "COMPLETED", "ROLLED_BACK")
        ]

        # Reverse order for strict LIFO unwinding
        transactions_reversed = list(reversed(eligible_records))
        total_tx = len(transactions_reversed)

        restored_count = 0
        already_restored = 0
        mismatch_count = 0
        errors: List[str] = []

        # Track created directories across all records and manager
        created_dirs_set: Set[Path] = set()
        for d in tx_manager.get_created_directories():
            created_dirs_set.add(d)
        for r in all_records:
            for d_str in r.created_directories:
                created_dirs_set.add(Path(d_str).resolve())

        for tx in transactions_reversed:
            orig_path = Path(tx.source_path).resolve()
            target_path = Path(tx.target_path).resolve()
            expected_hash = tx.sha256_pre or tx.sha256_post

            # Case 1: Already restored (idempotent resume)
            if orig_path.exists() and not target_path.exists():
                current_orig_hash = compute_sha256(orig_path)
                if current_orig_hash == expected_hash:
                    already_restored += 1
                    continue
                else:
                    mismatch_count += 1
                    errors.append(
                        f"Existing original file hash mismatch at {orig_path}: "
                        f"got {current_orig_hash}, expected {expected_hash}"
                    )
                    continue

            # Case 2: Target file check
            if not target_path.exists():
                errors.append(f"Target file missing for rollback: {target_path}")
                continue

            current_target_hash = compute_sha256(target_path)
            if current_target_hash != expected_hash:
                mismatch_count += 1
                errors.append(
                    f"Target file hash mismatch prior to restore at {target_path}: "
                    f"got {current_target_hash}, expected {expected_hash}"
                )
                continue

            if verify_only:
                restored_count += 1
                continue

            if dry_run:
                restored_count += 1
                continue

            # Physical relocation back to original location
            try:
                orig_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(target_path), str(orig_path))
                restored_hash = compute_sha256(orig_path)
                if restored_hash != expected_hash:
                    mismatch_count += 1
                    errors.append(
                        f"Restored file hash mismatch after move at {orig_path}: "
                        f"got {restored_hash}, expected {expected_hash}"
                    )
                else:
                    restored_count += 1
                    tx_manager.mark_rolled_back(tx.tx_id)
            except Exception as e:
                errors.append(f"Failed to move {target_path} -> {orig_path}: {e}")

        # Safely prune created empty directories in reverse depth order
        removed_dirs: List[str] = []
        if not dry_run and not verify_only:
            sorted_dirs = sorted(
                list(created_dirs_set),
                key=lambda p: len(p.parts),
                reverse=True
            )
            for d in sorted_dirs:
                if d.exists() and d.is_dir():
                    try:
                        if len(os.listdir(d)) == 0:
                            os.rmdir(d)
                            removed_dirs.append(str(d))
                    except Exception as e:
                        logging.warning(f"Could not remove directory {d}: {e}")

        success = len(errors) == 0 and mismatch_count == 0
        match_rate = 100.0 if success else round(
            ((restored_count + already_restored) / max(total_tx, 1)) * 100.0, 1
        )

        return {
            "status": "SUCCESS" if success else "PARTIAL_FAILURE",
            "total_transactions": total_tx,
            "restored_count": restored_count,
            "already_restored": already_restored,
            "mismatch_count": mismatch_count,
            "sha256_match_rate": match_rate,
            "removed_directories_count": len(removed_dirs),
            "removed_directories": removed_dirs,
            "errors": errors
        }


STANDALONE_ROLLBACK_TEMPLATE = '''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Standalone Rollback Tool for Public Administrative File Organizer.
Zero external dependencies — Pure Python 3 standard library.
"""

import argparse
from datetime import datetime
import hashlib
import json
import logging
import os
from pathlib import Path
import shutil
import sys
from typing import Any, Dict, List, Set

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def compute_sha256(file_path: Path | str) -> str:
    """Calculate SHA-256 checksum with streaming chunks."""
    path = Path(file_path)
    if not path.exists() or not path.is_file():
        return ""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def load_journal_records(journal_path: Path) -> tuple[List[dict], Set[Path]]:
    """Parse audit_journal.jsonl resolving latest transaction state and created dirs."""
    records_map: Dict[str, dict] = {}
    ordered_keys: List[str] = []
    created_dirs: Set[Path] = set()

    with open(journal_path, "r", encoding="utf-8") as f:
        for line in f:
            line_str = line.strip()
            if not line_str:
                continue
            try:
                data = json.loads(line_str)
            except json.JSONDecodeError:
                continue

            tx_id = str(data.get("tx_id", ""))
            if not tx_id:
                continue

            if tx_id not in ordered_keys:
                ordered_keys.append(tx_id)

            if tx_id in records_map:
                records_map[tx_id]["status"] = data.get("status", records_map[tx_id]["status"])
                if data.get("sha256_post"):
                    records_map[tx_id]["sha256_post"] = data["sha256_post"]
            else:
                records_map[tx_id] = data

            for d in data.get("created_directories", []):
                created_dirs.add(Path(d).resolve())

    records = [records_map[k] for k in ordered_keys]
    return records, created_dirs


def execute_rollback(
    journal_path: Path | str,
    dry_run: bool = False,
    verify_only: bool = False
) -> Dict[str, Any]:
    """Execute rollback in reverse LIFO order with double SHA-256 verification."""
    jpath = Path(journal_path).resolve()
    if jpath.is_dir():
        jpath = jpath / "audit_journal.jsonl"

    if not jpath.exists():
        print(f"[ERROR] Journal file not found: {jpath}", file=sys.stderr)
        return {"status": "FAILED", "errors": [f"Journal not found: {jpath}"]}

    all_records, created_dirs = load_journal_records(jpath)

    # Filter committed transactions (including ROLLED_BACK for idempotent resume)
    committed = [
        r for r in all_records
        if r.get("status") in ("COMMITTED", "COMPLETED", "ROLLED_BACK")
    ]
    transactions_reversed = list(reversed(committed))
    total_tx = len(transactions_reversed)

    restored_count = 0
    already_restored = 0
    mismatch_count = 0
    errors: List[str] = []

    print("=" * 70)
    print("󰏚 [공공 행정 문서 마이그레이션 100% 롤백 실행기]")
    print(f"  • 저널 경로: {jpath}")
    print(f"  • 대상 건수: {total_tx}건 (Dry-run: {dry_run}, Verify-only: {verify_only})")
    print("=" * 70)

    for idx, tx in enumerate(transactions_reversed, start=1):
        orig_str = tx.get("source_path") or tx.get("original_path") or ""
        target_str = tx.get("target_path") or ""
        expected_hash = tx.get("sha256_pre") or tx.get("original_sha256") or tx.get("sha256_post") or ""

        orig_path = Path(orig_str).resolve()
        target_path = Path(target_str).resolve()

        # Check if already restored
        if orig_path.exists() and not target_path.exists():
            cur_orig_hash = compute_sha256(orig_path)
            if cur_orig_hash == expected_hash:
                already_restored += 1
                print(f"  [{idx}/{total_tx}] 이미 원복됨: {orig_path.name}")
                continue
            else:
                mismatch_count += 1
                msg = f"해시 불일치: {orig_path} (현재 {cur_orig_hash} != 기대 {expected_hash})"
                errors.append(msg)
                print(f"  [오류] {msg}", file=sys.stderr)
                continue

        if not target_path.exists():
            msg = f"대상 파일 없음: {target_path}"
            errors.append(msg)
            print(f"  [오류] {msg}", file=sys.stderr)
            continue

        cur_target_hash = compute_sha256(target_path)
        if cur_target_hash != expected_hash:
            mismatch_count += 1
            msg = f"이관된 파일 해시 불일치: {target_path} (현재 {cur_target_hash} != 기대 {expected_hash})"
            errors.append(msg)
            print(f"  [오류] {msg}", file=sys.stderr)
            continue

        if verify_only:
            restored_count += 1
            print(f"  [{idx}/{total_tx}] [검증통과] {target_path.name} -> {orig_path}")
            continue

        if dry_run:
            restored_count += 1
            print(f"  [{idx}/{total_tx}] [시뮬레이션] 원복 예정: {target_path.name} -> {orig_path}")
            continue

        # Physical move
        try:
            orig_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(target_path), str(orig_path))
            restored_hash = compute_sha256(orig_path)
            if restored_hash != expected_hash:
                mismatch_count += 1
                msg = f"원복 후 해시 불일치: {orig_path}"
                errors.append(msg)
                print(f"  [오류] {msg}", file=sys.stderr)
            else:
                restored_count += 1
                print(f"  [{idx}/{total_tx}] 원복 완료: {orig_path.name}")
                # Record ROLLED_BACK in journal
                try:
                    rolled_back_rec = {
                        "tx_id": tx["tx_id"],
                        "timestamp": datetime.now().astimezone().isoformat(),
                        "status": "ROLLED_BACK",
                        "source_path": orig_str,
                        "target_path": target_str
                    }
                    with open(jpath, "a", encoding="utf-8") as jf:
                        jf.write(json.dumps(rolled_back_rec, ensure_ascii=False) + "\\n")
                        jf.flush()
                        os.fsync(jf.fileno())
                except Exception:
                    pass
        except Exception as e:
            msg = f"파일 이동 실패 {target_path} -> {orig_path}: {e}"
            errors.append(msg)
            print(f"  [오류] {msg}", file=sys.stderr)

    # Prune empty directories
    removed_dirs: List[str] = []
    if not dry_run and not verify_only:
        sorted_dirs = sorted(list(created_dirs), key=lambda p: len(p.parts), reverse=True)
        for d in sorted_dirs:
            if d.exists() and d.is_dir():
                try:
                    if len(os.listdir(d)) == 0:
                        os.rmdir(d)
                        removed_dirs.append(str(d))
                        print(f"  [정리] 빈 디렉토리 제거: {d}")
                except Exception as e:
                    print(f"  [경고] 디렉토리 제거 불가 {d}: {e}", file=sys.stderr)

    success = len(errors) == 0 and mismatch_count == 0
    match_rate = 100.0 if success else round(
        ((restored_count + already_restored) / max(total_tx, 1)) * 100.0, 1
    )

    print("\\n[롤백 결과 요약]")
    print(f"  - 총 트랜잭션 : {total_tx}건")
    print(f"  - 정상 원복   : {restored_count}건")
    print(f"  - 기원복 확인 : {already_restored}건")
    print(f"  - 해시 불일치 : {mismatch_count}건")
    print(f"  - SHA-256 일치율: {match_rate}%")
    print(f"  - 빈 폴더 제거: {len(removed_dirs)}개")
    if errors:
        print(f"  - 오류 발생   : {len(errors)}건")
    print("=" * 70)
    print("  끝.\\n")

    return {
        "status": "SUCCESS" if success else "PARTIAL_FAILURE",
        "total_transactions": total_tx,
        "restored_count": restored_count,
        "already_restored": already_restored,
        "mismatch_count": mismatch_count,
        "sha256_match_rate": match_rate,
        "removed_directories_count": len(removed_dirs),
        "removed_directories": removed_dirs,
        "errors": errors
    }


def main():
    parser = argparse.ArgumentParser(
        description="공공 행정 표준 파일 아카이빙 무결성 100% 롤백 도구"
    )
    parser.add_argument(
        "--journal",
        dest="journal",
        default=None,
        help="audit_journal.jsonl 파일 또는 아카이브 디렉토리 경로 (기본값: 현재 디렉토리)"
    )
    parser.add_argument(
        "--dry-run",
        dest="dry_run",
        action="store_true",
        default=False,
        help="시뮬레이션 모드 (실제 이동 없이 원복 가능 여부만 검증)"
    )
    parser.add_argument(
        "--verify-only",
        dest="verify_only",
        action="store_true",
        default=False,
        help="체크섬 및 파일 존재 여부만 검증"
    )

    args = parser.parse_args()
    journal_arg = args.journal or str(Path(__file__).parent / "audit_journal.jsonl")
    result = execute_rollback(
        journal_path=journal_arg,
        dry_run=args.dry_run,
        verify_only=args.verify_only
    )

    if result.get("status") == "SUCCESS":
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
'''


def generate_standalone_rollback_script(
    output_path: Path | str,
    journal_filename: str = "audit_journal.jsonl"
) -> Path:
    """Generate standalone zero-dependency rollback.py script.

    Args:
        output_path: Path where rollback.py will be generated.
        journal_filename: Default journal filename within the same directory.

    Returns:
        Path to the generated rollback.py.
    """
    out_file = Path(output_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(STANDALONE_ROLLBACK_TEMPLATE)
    return out_file
