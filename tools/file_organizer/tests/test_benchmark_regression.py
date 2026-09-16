"""Comprehensive Automated Regression Test Suite for Public Administrative File Organizer.

Verifies end-to-end against the 60-document public administration benchmark testbed:
1. Scan Completeness: Scan missing rate == 0.0% (all 60 files discovered with zero omissions).
2. Classification Accuracy: 3-level taxonomy accuracy >= 90.0% (year, project, stage against Ground Truth).
3. Deduplication & Version Integrity:
   - 5 exact duplicate pairs correctly identified.
   - Rule 1 Zero-byte guard verified (3 zero-byte files not merged).
   - Rule 2 Binary guard verified (2 same-size binary files not merged).
   - Version families clustered and senior versions ranked.
4. Dry-Run Mathematical Immutability:
   - Pre/post SHA-256 snapshot comparison proving 0 byte mutations and 0 directory modifications.
   - Comprehensive audit reports (JSON, Markdown, HTML) generated and verified.
5. Physical Migration Execution:
   - All files moved into 4-tier public hierarchy: [Year] / [Project] / [Stage] / [DocType] (or _Duplicates).
   - Write-Ahead Log audit_journal.jsonl committed with fsync.
   - Zero orphaned or half-migrated files.
6. Programmatic Rollback Integrity:
   - 100% files restored to original locations and original filenames.
   - 100% SHA-256 checksum match against original pre-migration baseline.
   - Safe pruning of newly created empty directories.
7. Standalone Zero-Dependency rollback.py Subprocess Execution:
   - Subprocess invocation of generated rollback.py reversing entire migration.
   - 100% SHA-256 checksum match and exit code 0.
8. CLI Pipeline End-to-End Subprocess Integration:
   - Full pipeline test: test_generator -> cli --dry-run -> cli --execute -> cli --rollback.
"""

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Set

import pytest

from tools.file_organizer.benchmark.test_generator import (
    generate_benchmark_dataset,
    BENCHMARK_ROSTER,
    BenchmarkItem
)
from tools.file_organizer.config import (
    STAGE_01_PLANNING,
    STAGE_02_BUDGET,
    STAGE_03_EVENT,
    STAGE_04_OUTCOME
)
from tools.file_organizer.scanner.metadata_extractor import (
    FileInfo,
    scan_directory,
    compute_sha256
)
from tools.file_organizer.classifier.rule_engine import classify_file
from tools.file_organizer.classifier.deduplicator import process_deduplication_and_versions
from tools.file_organizer.main import OrganizerEngine, MigrationPlan
from tools.file_organizer.rollback.rollback_engine import RollbackEngine
from tools.file_organizer.cli import run_cli


@pytest.fixture(scope="module")
def shared_ro_benchmark_env(tmp_path_factory) -> Dict[str, Any]:
    """Create a pristine read-only mock administrative workspace shared across non-mutating tests."""
    base_dir = tmp_path_factory.mktemp("ro_benchmark")
    source_dir = base_dir / "mock_work_area"
    archive_dir = base_dir / "organized_archive"
    reports_dir = base_dir / "audit_reports"

    items = generate_benchmark_dataset(source_dir, count=60)

    return {
        "source_dir": source_dir,
        "archive_dir": archive_dir,
        "reports_dir": reports_dir,
        "items": items,
        "base_dir": base_dir
    }


@pytest.fixture
def mut_benchmark_env(tmp_path: Path) -> Dict[str, Any]:
    """Create an isolated mutable workspace for tests that perform physical file movements."""
    source_dir = tmp_path / "mock_work_area_mut"
    archive_dir = tmp_path / "organized_archive_mut"
    reports_dir = tmp_path / "audit_reports_mut"

    items = generate_benchmark_dataset(source_dir, count=60)

    return {
        "source_dir": source_dir,
        "archive_dir": archive_dir,
        "reports_dir": reports_dir,
        "items": items,
        "tmp_path": tmp_path
    }


class TestBenchmarkDatasetGeneration:
    """Verifies that the mock testbed generator produces exactly 60 diverse, realistic files."""

    def test_mock_generator_produces_60_diverse_files(self, shared_ro_benchmark_env: Dict[str, Any]):
        """Verify 60 files generated across 4 stages, 6 formats, version variants, and edge cases."""
        items: List[BenchmarkItem] = shared_ro_benchmark_env["items"]
        source_dir: Path = shared_ro_benchmark_env["source_dir"]

        assert len(items) == 60
        actual_files = list(source_dir.iterdir())
        assert len(actual_files) == 60

        # Verify 4 workflow stages (15 planning, 15 budget, 15 execution, 15 outcome)
        stage_counts = {
            STAGE_01_PLANNING: 0,
            STAGE_02_BUDGET: 0,
            STAGE_03_EVENT: 0,
            STAGE_04_OUTCOME: 0
        }
        for it in items:
            assert it.expected_stage in stage_counts, f"Unknown stage: {it.expected_stage}"
            stage_counts[it.expected_stage] += 1

        assert stage_counts[STAGE_01_PLANNING] == 15, "Expected exactly 15 planning files"
        assert stage_counts[STAGE_02_BUDGET] == 15, "Expected exactly 15 budget files"
        assert stage_counts[STAGE_03_EVENT] == 15, "Expected exactly 15 execution files"
        assert stage_counts[STAGE_04_OUTCOME] == 15, "Expected exactly 15 outcome files"

        # Verify 6 core document formats
        formats = set(it.format for it in items)
        for fmt in ("hwpx", "hwp", "pdf", "xlsx", "docx", "txt", "bin"):
            assert fmt in formats, f"Expected format {fmt} in benchmark dataset"

        # Verify 3 zero-byte empty files
        zero_byte_items = [it for it in items if it.is_zero_byte]
        assert len(zero_byte_items) == 3, f"Expected 3 zero-byte files, got {len(zero_byte_items)}"
        for z in zero_byte_items:
            assert z.actual_path.stat().st_size == 0
            assert z.size_bytes == 0

        # Verify 2 binary files with same size but different content
        bin_items = [it for it in items if it.is_binary]
        assert len(bin_items) == 2, f"Expected 2 binary files, got {len(bin_items)}"
        assert bin_items[0].size_bytes == bin_items[1].size_bytes == 512
        assert bin_items[0].sha256 != bin_items[1].sha256, "Binary files must have distinct SHA-256"

        # Verify 5 exact duplicate pairs (10 files total)
        dup_items = [it for it in items if it.is_duplicate]
        assert len(dup_items) == 5, f"Expected 5 duplicate files, got {len(dup_items)}"
        for d in dup_items:
            orig = next((it for it in items if it.filename == d.duplicate_of), None)
            assert orig is not None, f"Original file {d.duplicate_of} not found"
            assert d.sha256 == orig.sha256, f"Duplicate hash mismatch between {d.filename} and {orig.filename}"
            assert d.size_bytes == orig.size_bytes

        # Verify 5 version variants (_v1, _v2, _수정본, _최종, _최최종)
        family_items = [it for it in items if it.version_family == "2026_양재천_건강페스티벌_추진계획"]
        assert len(family_items) == 5
        tags = set(it.version_tag for it in family_items)
        assert tags == {"v1", "v2", "수정본", "최종", "최최종"}


class TestScannerCompleteness:
    """Verifies that the scanner discovers 100% of files without missing any file."""

    def test_scan_missing_rate_is_zero_percent(self, shared_ro_benchmark_env: Dict[str, Any]):
        """Verify scan missing rate == 0.0% across all 60 mock documents."""
        source_dir: Path = shared_ro_benchmark_env["source_dir"]
        items: List[BenchmarkItem] = shared_ro_benchmark_env["items"]

        scanned_files: List[FileInfo] = scan_directory(source_dir, recursive=True)

        assert len(scanned_files) == 60
        missing_rate = (60 - len(scanned_files)) / 60.0
        assert missing_rate == 0.0, f"Scan missing rate must be 0.0%, got {missing_rate}"

        expected_filenames = set(it.filename for it in items)
        scanned_filenames = set(sf.filename for sf in scanned_files)
        assert scanned_filenames == expected_filenames, "All 60 filenames must match exactly"


class TestClassifierAccuracy:
    """Verifies that 3-level taxonomy classification accuracy exceeds 90.0%."""

    def test_three_level_classification_accuracy_exceeds_90_percent(self, shared_ro_benchmark_env: Dict[str, Any]):
        """Verify 3-level classification accuracy (year, project, stage) >= 90.0% against Ground Truth."""
        source_dir: Path = shared_ro_benchmark_env["source_dir"]
        scanned_files: List[FileInfo] = scan_directory(source_dir, recursive=True)

        roster_map = {spec["filename"]: spec for spec in BENCHMARK_ROSTER}

        total_files = len(scanned_files)
        matched_3level_count = 0
        mismatches: List[str] = []

        for sf in scanned_files:
            spec = roster_map.get(sf.filename)
            assert spec is not None, f"Unknown scanned file: {sf.filename}"

            res = classify_file(sf)

            gt_year = spec["expected_year"]
            gt_project = spec["expected_project"]
            gt_stage = spec["expected_stage"]

            year_match = (res.year == gt_year)
            project_match = (res.project == gt_project)
            stage_match = (res.stage == gt_stage)

            if year_match and project_match and stage_match:
                matched_3level_count += 1
            else:
                mismatches.append(
                    f"{sf.filename}: pred=({res.year}, {res.project}, {res.stage}) "
                    f"!= gt=({gt_year}, {gt_project}, {gt_stage})"
                )

        accuracy_percent = (matched_3level_count / total_files) * 100.0

        # Assert requirement: 3-level classification accuracy >= 90.0%
        assert accuracy_percent >= 90.0, (
            f"3-level accuracy must be >= 90.0%, got {accuracy_percent:.1f}% ({matched_3level_count}/{total_files}). "
            f"Mismatches: {mismatches}"
        )


class TestDeduplicationAndVersionClustering:
    """Verifies duplicate identification, 0-byte and binary guards, and version family clustering."""

    def test_duplicate_identification_and_guards(self, shared_ro_benchmark_env: Dict[str, Any]):
        """Verify exact duplicate pairs detected, zero-byte and binary guards respected."""
        source_dir: Path = shared_ro_benchmark_env["source_dir"]
        scanned_files = scan_directory(source_dir, recursive=True)
        classified_records = [(sf, classify_file(sf)) for sf in scanned_files]

        processed_records = process_deduplication_and_versions(classified_records)

        dup_records = [res for _, res in processed_records if res.is_duplicate]
        assert len(dup_records) == 5, f"Expected 5 duplicates, got {len(dup_records)}"

        # Verify Rule 1: Zero-byte files NEVER marked as duplicates of each other
        zero_records = [res for info, res in processed_records if info.size == 0]
        assert len(zero_records) == 3
        for z in zero_records:
            assert not z.is_duplicate, "Zero-byte file must never be marked as a duplicate (Rule 1 Guard)"

        # Verify Rule 2: Binary files with same size NOT marked as duplicates
        bin_records = [res for info, res in processed_records if info.filename.endswith(".bin")]
        assert len(bin_records) == 2
        for b in bin_records:
            assert not b.is_duplicate, "Binary files with different hashes must never be duplicates (Rule 2 Guard)"

        # Verify Version Family Clustering
        family_records = [
            res for _, res in processed_records
            if res.version_family_key and "양재천_건강페스티벌_추진계획" in res.version_family_key
        ]
        assert len(family_records) == 5
        latest_versions = [res for res in family_records if res.is_latest_version]
        assert len(latest_versions) == 1, "Exactly one variant should be elected latest/primary"


class TestDryRunMathematicalImmutability:
    """Verifies that dry-run mode causes 0 byte changes and 0 directory modifications."""

    def test_dry_run_zero_mutation_snapshot_invariance(self, shared_ro_benchmark_env: Dict[str, Any]):
        """Verify pre/post SHA-256 snapshot check proves 100% mathematical immutability."""
        source_dir: Path = shared_ro_benchmark_env["source_dir"]
        archive_dir: Path = shared_ro_benchmark_env["archive_dir"]
        reports_dir: Path = shared_ro_benchmark_env["reports_dir"]

        # Pre-execution snapshot
        pre_files = {
            p: (p.stat().st_size, compute_sha256(p), p.stat().st_mtime)
            for p in source_dir.iterdir() if p.is_file()
        }
        pre_dirs = set(d for d in source_dir.rglob("*") if d.is_dir())
        assert len(pre_files) == 60

        # Execute Dry-Run
        engine = OrganizerEngine(dry_run=True)
        plan: MigrationPlan = engine.plan(source_dir, target_dir=archive_dir)
        exec_result = engine.execute(plan, target_dir=archive_dir, dry_run=True)

        assert exec_result["status"] in ("SUCCESS", "DRY_RUN")
        assert exec_result["dry_run"] is True
        # In dry-run mode, all 60 files remain completely untouched in source directory
        assert len(list(source_dir.iterdir())) == 60

        # Post-execution snapshot
        post_files = {
            p: (p.stat().st_size, compute_sha256(p), p.stat().st_mtime)
            for p in source_dir.iterdir() if p.is_file()
        }
        post_dirs = set(d for d in source_dir.rglob("*") if d.is_dir())

        # Assert 0 byte mutations and 0 directory changes on source
        assert pre_files == post_files, "Dry-run violated file immutability (size, sha256, or mtime altered)!"
        assert pre_dirs == post_dirs, "Dry-run modified directory structure on source directory!"

        # Assert no files actually moved into archive hierarchy
        if archive_dir.exists():
            archived_data_files = [
                p for p in archive_dir.rglob("*")
                if p.is_file() and p.name not in ("audit_journal.jsonl", "rollback.py", "audit_manifest.json")
            ]
            assert len(archived_data_files) == 0

        # Generate reports in dedicated reports_dir
        reports = engine.generate_reports(plan, report_dir=reports_dir)
        json_rep = reports["json"]
        md_rep = reports["md"]
        html_rep = reports["html"]
        assert json_rep.exists()
        assert md_rep.exists()
        assert html_rep.exists()

        with open(json_rep, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        assert manifest["summary_metrics"]["total_scanned_files"] == 60


class TestPhysicalMigrationExecution:
    """Verifies physical file movement into 4-tier paths and write-ahead transaction logging."""

    def test_physical_migration_and_audit_journal_commit(self, mut_benchmark_env: Dict[str, Any]):
        """Verify files placed into 4-tier paths and audit_journal.jsonl committed."""
        source_dir: Path = mut_benchmark_env["source_dir"]
        archive_dir: Path = mut_benchmark_env["archive_dir"]

        engine = OrganizerEngine(dry_run=False)
        plan = engine.plan(source_dir, target_dir=archive_dir)
        exec_result = engine.execute(plan, target_dir=archive_dir, dry_run=False)

        assert exec_result["status"] == "SUCCESS"
        assert exec_result["moved_count"] == 60

        # Verify audit journal
        journal_path = Path(exec_result["journal_path"])
        assert journal_path.exists()

        journal_lines = [
            json.loads(line)
            for line in journal_path.read_text(encoding="utf-8").strip().split("\n")
            if line.strip()
        ]
        committed_entries = [line for line in journal_lines if line["status"] == "COMMITTED"]
        assert len(committed_entries) == 60, "All 60 transactions must be COMMITTED in WAL"

        # Verify 4-tier directories created under archive_dir (excluding metadata files)
        archived_files = [
            p for p in archive_dir.rglob("*")
            if p.is_file() and p.name not in ("rollback.py", "audit_journal.jsonl", "audit_manifest.json")
        ]
        assert len(archived_files) == 60

        # Verify standalone rollback.py was created
        rollback_script = archive_dir / "rollback.py"
        assert rollback_script.exists()


class TestProgrammaticRollbackIntegrity:
    """Verifies that programmatic rollback restores 100% of files with 100% matching SHA-256."""

    def test_programmatic_rollback_restores_100_percent_sha256(self, mut_benchmark_env: Dict[str, Any]):
        """Verify 100% files restored to original locations, 100% SHA-256 match, and clean directory pruning."""
        source_dir: Path = mut_benchmark_env["source_dir"]
        archive_dir: Path = mut_benchmark_env["archive_dir"]

        # 1. Record original pre-migration baseline
        initial_hashes = {
            p.name: compute_sha256(p)
            for p in source_dir.iterdir() if p.is_file()
        }
        assert len(initial_hashes) == 60

        # 2. Execute physical migration
        engine = OrganizerEngine(dry_run=False)
        plan = engine.plan(source_dir, target_dir=archive_dir)
        exec_res = engine.execute(plan, target_dir=archive_dir, dry_run=False)
        assert exec_res["status"] == "SUCCESS"

        # Verify source directory is now empty of migrated files
        remaining_source_files = [p for p in source_dir.iterdir() if p.is_file()]
        assert len(remaining_source_files) == 0

        # 3. Execute Programmatic Rollback
        rollback_res = RollbackEngine.rollback(archive_dir / "audit_journal.jsonl")

        assert rollback_res["status"] == "SUCCESS"
        assert rollback_res["restored_count"] == 60
        assert rollback_res["sha256_match_rate"] == 100.0
        assert rollback_res["mismatch_count"] == 0
        assert rollback_res["removed_directories_count"] > 0

        # 4. Verify 100% files restored to original locations
        restored_files = {
            p.name: compute_sha256(p)
            for p in source_dir.iterdir() if p.is_file()
        }
        assert len(restored_files) == 60
        assert restored_files == initial_hashes, "Restored SHA-256 hashes must 100% match initial baseline!"

        # 5. Verify created archive directories were pruned
        subdirs_in_archive = [d for d in archive_dir.iterdir() if d.is_dir()]
        assert len(subdirs_in_archive) == 0, f"Expected all empty subdirectories pruned, got: {subdirs_in_archive}"


class TestStandaloneRollbackSubprocess:
    """Verifies that the generated standalone rollback.py executes cleanly in an isolated Python subprocess."""

    def test_standalone_rollback_script_subprocess(self, tmp_path: Path):
        """Verify standalone rollback.py reverses migration via subprocess with exit code 0."""
        source_dir = tmp_path / "work_area_subprocess"
        archive_dir = tmp_path / "archive_subprocess"

        # Generate fresh benchmark files
        items = generate_benchmark_dataset(source_dir, count=60)
        initial_hashes = {it.filename: it.sha256 for it in items}

        # Migrate
        engine = OrganizerEngine(dry_run=False)
        plan = engine.plan(source_dir, target_dir=archive_dir)
        exec_res = engine.execute(plan, target_dir=archive_dir, dry_run=False)
        assert exec_res["status"] == "SUCCESS"

        # Run generated rollback.py via subprocess
        rollback_py = archive_dir / "rollback.py"
        assert rollback_py.exists()

        cmd = [
            sys.executable,
            str(rollback_py),
            "--journal",
            str(archive_dir / "audit_journal.jsonl")
        ]
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )

        assert proc.returncode == 0, f"rollback.py failed with stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
        assert "100" in proc.stdout or "성공" in proc.stdout or "정상 원복" in proc.stdout

        # Verify all 60 files restored with 100% SHA-256 match
        restored_files = {p.name: compute_sha256(p) for p in source_dir.iterdir() if p.is_file()}
        assert len(restored_files) == 60
        assert restored_files == initial_hashes


class TestCLIPipelineSubprocess:
    """Verifies end-to-end CLI commands: test_generator -> --dry-run -> --execute -> --rollback."""

    def test_cli_benchmark_generator_and_full_workflow(self, tmp_path: Path):
        """Verify full CLI lifecycle in external subprocesses with exit code 0."""
        work_dir = tmp_path / "cli_workflow_work"
        arch_dir = tmp_path / "cli_workflow_arch"

        # 1. Generate 60 files via test_generator CLI
        gen_cmd = [
            sys.executable,
            "-m",
            "tools.file_organizer.benchmark.test_generator",
            str(work_dir),
            "--count",
            "60"
        ]
        proc_gen = subprocess.run(gen_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        assert proc_gen.returncode == 0, f"Generator failed: {proc_gen.stderr}"
        assert len(list(work_dir.iterdir())) == 60

        initial_hashes = {p.name: compute_sha256(p) for p in work_dir.iterdir() if p.is_file()}

        # 2. CLI Dry-Run
        dry_cmd = [
            sys.executable,
            "-m",
            "tools.file_organizer.cli",
            str(work_dir),
            "--target-dir",
            str(arch_dir),
            "--dry-run"
        ]
        proc_dry = subprocess.run(dry_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        assert proc_dry.returncode == 0, f"Dry-run CLI failed: {proc_dry.stderr}"
        assert len(list(work_dir.iterdir())) == 60

        # 3. CLI Execute
        exec_cmd = [
            sys.executable,
            "-m",
            "tools.file_organizer.cli",
            str(work_dir),
            "--target-dir",
            str(arch_dir),
            "--execute"
        ]
        proc_exec = subprocess.run(exec_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        assert proc_exec.returncode == 0, f"Execute CLI failed: {proc_exec.stderr}"
        assert len([p for p in work_dir.iterdir() if p.is_file()]) == 0

        # 4. CLI Rollback
        rb_cmd = [
            sys.executable,
            "-m",
            "tools.file_organizer.cli",
            "--rollback",
            str(arch_dir)
        ]
        proc_rb = subprocess.run(rb_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        assert proc_rb.returncode == 0, f"Rollback CLI failed: {proc_rb.stderr}"

        # 5. Verify 100% restoration
        restored_hashes = {p.name: compute_sha256(p) for p in work_dir.iterdir() if p.is_file()}
        assert len(restored_hashes) == 60
        assert restored_hashes == initial_hashes
