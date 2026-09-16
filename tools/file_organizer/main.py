"""Main entry point and orchestrating engine for public administration file organization.

Provides:
- MigrationItem: Dataclass tracking source, target, hash, size, and classification.
- MigrationPlan: In-memory plan encapsulating planned moves, duplicates, unclassified files,
  and summary metrics.
- OrganizerEngine: Decoupled planner and audit report coordinator guaranteeing
  mathematical immutability during dry-run simulation.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import signal
import time
from typing import Any, Dict, List, Optional, Set

from tools.file_organizer.config import (
    YEAR_UNKNOWN,
    PROJECT_UNKNOWN,
    STAGE_UNKNOWN,
    STAGE_01_PLANNING,
    STAGE_02_BUDGET,
    STAGE_03_EVENT,
    STAGE_04_OUTCOME,
    EMPTY_SHA256
)
from tools.file_organizer.scanner.metadata_extractor import (
    FileInfo,
    scan_directory,
    compute_sha256
)
from tools.file_organizer.classifier.taxonomy import ClassificationResult
from tools.file_organizer.classifier.rule_engine import classify_file
from tools.file_organizer.classifier.deduplicator import process_deduplication_and_versions
from tools.file_organizer.rollback.transaction_manager import TransactionManager
from tools.file_organizer.rollback.rollback_engine import (
    RollbackEngine,
    generate_standalone_rollback_script
)


@dataclass
class MigrationItem:
    """Represents a planned file migration action."""
    source_path: Path
    target_path: Path
    sha256: str
    size: int
    classification: ClassificationResult
    planned_action: str = "MOVE_PRIMARY"  # MOVE_PRIMARY, MOVE_DUPLICATE, RENAME_AND_MOVE, SKIP_UNCLASSIFIED
    collision_strategy: str = "NONE"      # NONE, INDEX_SUFFIX, DEDUPLICATE
    target_filename: str = ""
    file_info: Optional[FileInfo] = None

    def __post_init__(self):
        if not self.target_filename:
            self.target_filename = self.target_path.name

    def to_dict(self) -> Dict[str, Any]:
        """Serialize MigrationItem to dictionary."""
        return {
            "source_path": str(self.source_path),
            "target_path": str(self.target_path),
            "target_filename": self.target_filename,
            "sha256": self.sha256,
            "size": self.size,
            "planned_action": self.planned_action,
            "collision_strategy": self.collision_strategy,
            "classification": self.classification.to_dict()
        }


@dataclass
class MigrationPlan:
    """Pure in-memory execution plan for file reorganization.

    Guaranteed not to perform any filesystem mutation during creation.
    """
    items: List[MigrationItem] = field(default_factory=list)
    duplicates: List[MigrationItem] = field(default_factory=list)
    unclassified: List[MigrationItem] = field(default_factory=list)
    target_directories: List[Path] = field(default_factory=list)
    total_files: int = 0
    total_size: int = 0
    dry_run: bool = True
    source_dir: Optional[Path] = None
    target_dir: Optional[Path] = None
    scan_duration_seconds: float = 0.0
    timestamp: str = ""
    tool_version: str = "1.0.0"

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).astimezone().isoformat()

    @property
    def summary_metrics(self) -> Dict[str, Any]:
        """Compute aggregated audit metrics."""
        total_scanned = len(self.items)
        classified_count = sum(
            1 for item in self.items
            if item.classification.year != YEAR_UNKNOWN
            and item.classification.project != PROJECT_UNKNOWN
        )
        unclassified_count = total_scanned - classified_count
        dup_count = len(self.duplicates)
        
        # Count version clusters with > 1 variant
        families: Dict[str, int] = {}
        for item in self.items:
            fam_key = item.classification.version_family_key
            if fam_key:
                families[fam_key] = families.get(fam_key, 0) + 1
        version_clusters = sum(1 for count in families.values() if count > 1)

        accuracy = round((classified_count / total_scanned * 100.0), 1) if total_scanned > 0 else 0.0

        return {
            "total_scanned_files": total_scanned,
            "total_classified_files": classified_count,
            "total_unclassified_files": unclassified_count,
            "total_duplicates_detected": dup_count,
            "total_version_clusters": version_clusters,
            "total_bytes_scanned": self.total_size,
            "classification_accuracy_percentage": accuracy
        }

    @property
    def phase_breakdown(self) -> Dict[str, int]:
        """Compute file counts per administrative phase."""
        breakdown = {
            "planning_approval": 0,
            "budget_expenditure": 0,
            "execution_event": 0,
            "outcome_settlement": 0,
            "unclassified": 0
        }
        for item in self.items:
            stage = item.classification.stage
            if "기획" in stage or "품의" in stage:
                breakdown["planning_approval"] += 1
            elif "예산" in stage or "지출" in stage:
                breakdown["budget_expenditure"] += 1
            elif "집행" in stage or "행사" in stage:
                breakdown["execution_event"] += 1
            elif "결과" in stage or "정산" in stage:
                breakdown["outcome_settlement"] += 1
            else:
                breakdown["unclassified"] += 1
        return breakdown

    def to_dict(self) -> Dict[str, Any]:
        """Convert full migration plan to dictionary."""
        return {
            "report_version": self.tool_version,
            "execution_metadata": {
                "timestamp": self.timestamp,
                "mode": "DRY_RUN" if self.dry_run else "EXECUTION",
                "source_directory": str(self.source_dir) if self.source_dir else "",
                "target_directory": str(self.target_dir) if self.target_dir else "",
                "tool_version": self.tool_version,
                "scan_duration_seconds": round(self.scan_duration_seconds, 4)
            },
            "summary_metrics": self.summary_metrics,
            "phase_breakdown": self.phase_breakdown,
            "items": [item.to_dict() for item in self.items]
        }


class OrganizerEngine:
    """Decoupled planner and reporting engine for file organization.

    Guarantees:
    - Pure in-memory dry-run planner: 0 filesystem modifications to source_dir.
    - Full classification into public administrative 4-tier hierarchy:
      [연도별] > [사업명] > [업무단계별] > [파일명]
    - Isolated audit reporting in JSON, Markdown, and HTML formats.
    """

    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run

    def plan(
        self,
        source_dir: Path | str,
        target_dir: Optional[Path | str] = None
    ) -> MigrationPlan:
        """Create a pure in-memory migration plan without modifying any file.

        Args:
            source_dir: Directory containing files to scan and organize.
            target_dir: Target directory where organized structure will be placed.
                        Defaults to source_dir / "_Organized_Archive" if omitted.

        Returns:
            MigrationPlan containing all categorized items and target paths.
        """
        src_path = Path(source_dir).resolve()
        if not src_path.exists() or not src_path.is_dir():
            raise FileNotFoundError(f"Source directory does not exist or is not a directory: {src_path}")

        tgt_path = Path(target_dir).resolve() if target_dir else src_path / "_Organized_Archive"

        start_time = time.perf_counter()

        # Step 1: Scan files read-only
        file_infos: List[FileInfo] = scan_directory(src_path, recursive=True)

        # Step 2: Classify each file into 4-tier taxonomy
        classified_records = [(info, classify_file(info)) for info in file_infos]

        # Step 3: Deduplicate and cluster version families
        processed_records = process_deduplication_and_versions(classified_records)

        # Step 4: Build migration items with 4-tier target paths
        migration_items: List[MigrationItem] = []
        duplicate_items: List[MigrationItem] = []
        unclassified_items: List[MigrationItem] = []
        target_dirs_set: Set[Path] = set()

        seen_target_paths: Dict[Path, MigrationItem] = {}

        for info, res in processed_records:
            # Future year cap: clamp future years (>2026) to 2026년
            year_to_use = res.year
            if year_to_use.endswith("년") and year_to_use[:-1].isdigit():
                if int(year_to_use[:-1]) > 2026:
                    year_to_use = "2026년"

            # 4-tier hierarchy: [연도별] > [사업명] > [업무단계별] > [파일명]
            if res.is_duplicate:
                rel_path = Path("_Duplicates") / year_to_use / res.project / res.stage / info.filename
                planned_action = "MOVE_DUPLICATE"
                collision_strategy = "DEDUPLICATE"
            else:
                rel_path = Path(year_to_use) / res.project / res.stage / info.filename
                if res.year == YEAR_UNKNOWN and res.project == PROJECT_UNKNOWN and res.stage == STAGE_UNKNOWN:
                    planned_action = "SKIP_UNCLASSIFIED"
                else:
                    planned_action = "MOVE_PRIMARY"
                collision_strategy = "NONE"

            # Update target_rel_path on classification
            res.target_rel_path = rel_path
            target_full_path = tgt_path / rel_path

            # Collision check: multiple distinct files targeting identical target path
            if target_full_path in seen_target_paths:
                prior_item = seen_target_paths[target_full_path]
                if prior_item.sha256 != info.sha256:
                    # Same name, different content -> apply INDEX_SUFFIX collision resolution
                    stem = target_full_path.stem
                    suffix = target_full_path.suffix
                    collision_idx = 1
                    while target_full_path in seen_target_paths:
                        new_name = f"{stem}_({collision_idx}){suffix}"
                        rel_path = rel_path.parent / new_name
                        target_full_path = tgt_path / rel_path
                        collision_idx += 1
                    res.target_rel_path = rel_path
                    collision_strategy = "INDEX_SUFFIX"

            item = MigrationItem(
                source_path=info.path,
                target_path=target_full_path,
                sha256=info.sha256,
                size=info.size,
                classification=res,
                planned_action=planned_action,
                collision_strategy=collision_strategy,
                target_filename=target_full_path.name,
                file_info=info
            )

            seen_target_paths[target_full_path] = item
            migration_items.append(item)
            target_dirs_set.add(target_full_path.parent)

            if res.is_duplicate:
                duplicate_items.append(item)
            if planned_action == "SKIP_UNCLASSIFIED":
                unclassified_items.append(item)

        scan_duration = time.perf_counter() - start_time
        total_size = sum(item.size for item in migration_items)

        plan = MigrationPlan(
            items=migration_items,
            duplicates=duplicate_items,
            unclassified=unclassified_items,
            target_directories=sorted(list(target_dirs_set)),
            total_files=len(migration_items),
            total_size=total_size,
            dry_run=self.dry_run,
            source_dir=src_path,
            target_dir=tgt_path,
            scan_duration_seconds=scan_duration
        )

        return plan

    def generate_reports(
        self,
        plan: MigrationPlan,
        report_dir: Path | str,
        formats: Optional[List[str]] = None
    ) -> Dict[str, Path]:
        """Generate audit reports in the requested formats.

        Args:
            plan: The planned MigrationPlan.
            report_dir: Directory where reports will be written (isolated from source).
            formats: List of formats to emit ('json', 'md', 'html').
                     Defaults to ['json', 'md', 'html'].

        Returns:
            Dictionary mapping format string to generated report file path.
        """
        from tools.file_organizer.reporter.json_reporter import generate_json_report
        from tools.file_organizer.reporter.markdown_reporter import (
            generate_markdown_report,
            generate_html_report
        )

        out_dir = Path(report_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)

        if formats is None:
            formats = ["json", "md", "html"]
        else:
            formats = [f.lower().strip() for f in formats]

        report_paths: Dict[str, Path] = {}

        if "json" in formats:
            json_path = out_dir / "audit_report.json"
            generate_json_report(plan, json_path)
            report_paths["json"] = json_path

        if "md" in formats or "markdown" in formats:
            md_path = out_dir / "audit_report.md"
            generate_markdown_report(plan, md_path)
            report_paths["md"] = md_path

        if "html" in formats:
            html_path = out_dir / "audit_report.html"
            generate_html_report(plan, html_path)
            report_paths["html"] = html_path

        return report_paths

    def execute(
        self,
        plan: MigrationPlan,
        target_dir: Optional[Path | str] = None,
        dry_run: Optional[bool] = None
    ) -> Dict[str, Any]:
        """Execute physical file relocation according to the plan.

        Guarantees:
        - Write-ahead transaction logging with os.fsync on every step.
        - Pre-flight and post-flight SHA-256 integrity verification.
        - Automatic immediate rollback on unhandled exceptions or interrupt signals.
        - Standalone zero-dependency rollback.py script generated in target directory.
        - Zero orphaned or half-migrated files.

        Args:
            plan: The planned MigrationPlan.
            target_dir: Destination base directory. Defaults to plan.target_dir.
            dry_run: If True, simulates execution without modifying disk.
                     Defaults to self.dry_run if not explicitly specified.

        Returns:
            Dictionary with execution summary and audit paths.
        """
        actual_dry_run = dry_run if dry_run is not None else self.dry_run

        if target_dir:
            tgt_path = Path(target_dir).resolve()
        elif plan.target_dir:
            tgt_path = Path(plan.target_dir).resolve()
        elif plan.source_dir:
            tgt_path = (Path(plan.source_dir) / "_Organized_Archive").resolve()
        else:
            tgt_path = Path("./_Organized_Archive").resolve()

        if not actual_dry_run:
            tgt_path.mkdir(parents=True, exist_ok=True)

        journal_path = tgt_path / "audit_journal.jsonl"
        rollback_script = tgt_path / "rollback.py"

        if not actual_dry_run:
            generate_standalone_rollback_script(rollback_script)
            tx_manager = TransactionManager(journal_path)
        else:
            tx_manager = TransactionManager(journal_path)

        interrupted = False
        old_handlers = {}

        def signal_handler(signum, frame):
            nonlocal interrupted
            interrupted = True

        signals_to_trap = [signal.SIGINT, signal.SIGTERM]
        if hasattr(signal, "SIGBREAK"):
            signals_to_trap.append(signal.SIGBREAK)

        for sig in signals_to_trap:
            try:
                old_handlers[sig] = signal.signal(sig, signal_handler)
            except (ValueError, AttributeError, RuntimeError):
                pass

        moved_items: List[MigrationItem] = []
        skipped_items: List[MigrationItem] = []

        try:
            for item in plan.items:
                if interrupted:
                    raise KeyboardInterrupt("Execution aborted due to interrupt signal.")

                if item.planned_action == "SKIP_UNCLASSIFIED":
                    skipped_items.append(item)
                    continue

                src = Path(item.source_path).resolve()
                if target_dir:
                    rel = item.target_path.relative_to(plan.target_dir) if plan.target_dir else item.classification.target_rel_path
                    dst = tgt_path / rel
                else:
                    dst = Path(item.target_path).resolve()

                if not src.exists():
                    raise FileNotFoundError(f"Source file does not exist: {src}")

                pre_hash = compute_sha256(src)
                if pre_hash != item.sha256:
                    raise ValueError(f"Pre-flight SHA-256 mismatch on {src}: expected {item.sha256}, got {pre_hash}")

                if not actual_dry_run:
                    # Discover and track newly created directories from tgt_path down to dst.parent
                    curr = dst.parent
                    dirs_to_make = []
                    while curr != tgt_path and curr != curr.parent:
                        if not curr.exists():
                            dirs_to_make.append(curr)
                            curr = curr.parent
                        else:
                            break
                    for d in reversed(dirs_to_make):
                        d.mkdir(exist_ok=True)
                        tx_manager.record_created_directory(d)

                    # Start PENDING transaction in WAL
                    tx = tx_manager.start_transaction(
                        source_path=src,
                        target_path=dst,
                        file_size=item.size,
                        sha256_pre=pre_hash,
                        created_directories=tx_manager.get_created_directories()
                    )

                    # Physical atomic move
                    shutil.move(str(src), str(dst))

                    # Post-flight verification
                    post_hash = compute_sha256(dst)
                    if post_hash != pre_hash:
                        tx_manager.fail_transaction(tx.tx_id, "Post-flight SHA-256 mismatch")
                        raise ValueError(f"Post-flight SHA-256 mismatch on {dst}: expected {pre_hash}, got {post_hash}")

                    # Commit transaction in WAL
                    tx_manager.commit_transaction(tx.tx_id, post_hash)
                    moved_items.append(item)
                else:
                    moved_items.append(item)

            # Generate audit_manifest.json upon successful execution
            manifest_path = tgt_path / "audit_manifest.json"
            if not actual_dry_run:
                manifest_data = {
                    "execution_timestamp": datetime.now(timezone.utc).astimezone().isoformat(),
                    "dry_run": actual_dry_run,
                    "total_files": len(plan.items),
                    "moved_count": len(moved_items),
                    "skipped_count": len(skipped_items),
                    "created_directories": [str(d) for d in tx_manager.get_created_directories()],
                    "transactions": [t.to_dict() for t in tx_manager.get_all_records()]
                }
                with open(manifest_path, "w", encoding="utf-8") as mf:
                    json.dump(manifest_data, mf, ensure_ascii=False, indent=2)

            # Prune emptied source subdirectories (excluding root, target_dir, and excluded dirs)
            if not actual_dry_run and plan.source_dir:
                from tools.file_organizer.scanner.metadata_extractor import DEFAULT_EXCLUDED_DIRS
                src_root = Path(plan.source_dir).resolve()
                for dirpath, dirnames, filenames in os.walk(src_root, topdown=False):
                    curr_dir = Path(dirpath).resolve()
                    if curr_dir == src_root or curr_dir == tgt_path or tgt_path in curr_dir.parents:
                        continue
                    if curr_dir.name in DEFAULT_EXCLUDED_DIRS or any(p.name in DEFAULT_EXCLUDED_DIRS for p in curr_dir.parents):
                        continue
                    try:
                        if not any(curr_dir.iterdir()):
                            curr_dir.rmdir()
                    except Exception:
                        pass

            if 'tx_manager' in locals() and tx_manager:
                try:
                    tx_manager.close()
                except Exception:
                    pass

            return {
                "status": "SUCCESS",
                "dry_run": actual_dry_run,
                "total_planned": len(plan.items),
                "moved_count": len(moved_items),
                "skipped_count": len(skipped_items),
                "target_dir": str(tgt_path),
                "journal_path": str(journal_path),
                "manifest_path": str(manifest_path) if not actual_dry_run else "",
                "rollback_script_path": str(rollback_script) if not actual_dry_run else "",
                "created_directories": [str(d) for d in tx_manager.get_created_directories()]
            }

        except (Exception, KeyboardInterrupt) as exc:
            if 'tx_manager' in locals() and tx_manager:
                try:
                    tx_manager.close()
                except Exception:
                    pass
            if not actual_dry_run and journal_path.exists():
                RollbackEngine.rollback(journal_path)
            raise exc

        finally:
            if 'tx_manager' in locals() and tx_manager:
                try:
                    tx_manager.close()
                except Exception:
                    pass
            for sig, handler in old_handlers.items():
                try:
                    signal.signal(sig, handler)
                except (ValueError, AttributeError, RuntimeError):
                    pass

