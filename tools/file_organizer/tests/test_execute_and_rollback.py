"""Tests for Milestone 3: Write-Ahead Transaction Logging, Execution, and 100% Rollback Engine.

Verifies:
- Physical migration execution and 4-tier directory hierarchy creation.
- Programmatic rollback with 100% SHA-256 checksum restoration and clean empty directory pruning.
- Standalone zero-dependency rollback.py script execution via subprocess.
- Idempotent rollback resume (handling already-restored files).
- Crash and exception auto-rollback guaranteeing zero orphaned files.
- Non-empty and unrelated directory protection during pruning.
- CLI --execute and --rollback execution pathways (both in-process and subprocess).
"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Dict
from unittest.mock import patch

import pytest

from tools.file_organizer.main import OrganizerEngine, MigrationPlan
from tools.file_organizer.rollback.transaction_manager import (
    TransactionManager,
    TransactionRecord
)
from tools.file_organizer.rollback.rollback_engine import (
    RollbackEngine,
    generate_standalone_rollback_script,
    compute_sha256
)
from tools.file_organizer.cli import run_cli, parse_args


@pytest.fixture
def mock_exec_dataset(tmp_path: Path) -> Path:
    """Create a structured source directory with mock public administration files."""
    src = tmp_path / "source_docs"
    src.mkdir(parents=True, exist_ok=True)

    # 1. Planning document
    p1 = src / "2026 양재천 건강 페스티벌 추진계획.txt"
    p1.write_text("2026년도 양재천 건강 페스티벌 기본계획 및 추진일정 수립", encoding="utf-8")

    # 2. Budget procurement document
    p2 = src / "20260417_분할납품요구서(서울체력장 강남센터 영상정보장치 구매).txt"
    p2.write_text("서울체력장 강남센터 체력측정 영상정보장치 구매 소요예산 품의서", encoding="utf-8")

    # 3. Event participants document
    p3 = src / "2026년 강남구 보건소 「건강 뜀」 비만예방 프로그램 참가자 명단.txt"
    p3.write_text("건강뜀 비만예방 프로그램 참가자 명단 및 접수 현황", encoding="utf-8")

    # 4. Outcome report document
    p4 = src / "2025년 강남구 보건신체활동 활성화 사업운영 결과보고.txt"
    p4.write_text("2025년도 보건신체활동 활성화 사업 최종 결과보고서", encoding="utf-8")

    # 5. Version cluster documents
    v1 = src / "(260914) AI메디헬스 사업설명서(건강증진팀)_v1.txt"
    v1.write_text("AI메디헬스 사업설명서 초안 v1", encoding="utf-8")
    v_final = src / "(260914) AI메디헬스 사업설명서(건강증진팀)-최종.txt"
    v_final.write_text("AI메디헬스 사업설명서 최종 확정본", encoding="utf-8")

    # 6. Duplicates (identical bytes, distinct filenames)
    dup_bytes = b"PAYMENT_STATEMENT_AUTHENTIC_AUDIT_DATA_2026"
    d1 = src / "20260810_손목닥터9988_용역대금_청구서.txt"
    d1.write_bytes(dup_bytes)
    d2 = src / "20260810_손목닥터9988_용역대금_청구서_사본.txt"
    d2.write_bytes(dup_bytes)

    # 7. Unclassified document
    u1 = src / "임시_일반메모_잡동사니.txt"
    u1.write_text("단순 메모 기록", encoding="utf-8")

    return src


class TestPhysicalMigrationExecution:
    """Tests for physical file movement and hierarchy creation."""

    def test_physical_migration_and_directory_creation(self, mock_exec_dataset: Path, tmp_path: Path):
        """Verify files are physically relocated into 4-tier hierarchy and unclassified are skipped."""
        target_dir = tmp_path / "archive_target"
        engine = OrganizerEngine(dry_run=False)

        # Capture pre-migration state
        pre_files = {p.name: compute_sha256(p) for p in mock_exec_dataset.iterdir() if p.is_file()}
        assert len(pre_files) == 9

        plan = engine.plan(mock_exec_dataset, target_dir)
        exec_result = engine.execute(plan, target_dir=target_dir)

        assert exec_result["status"] == "SUCCESS"
        assert exec_result["moved_count"] >= 8
        assert exec_result["skipped_count"] >= 1  # Unclassified skipped

        # Target journal and rollback script created
        journal_path = Path(exec_result["journal_path"])
        assert journal_path.exists()
        rollback_script = Path(exec_result["rollback_script_path"])
        assert rollback_script.exists()

        # Unclassified file remained in source directory
        assert (mock_exec_dataset / "임시_일반메모_잡동사니.txt").exists()

        # Check 4-tier structure in target directory
        # Example: archive_target / 2026년 / 03_양재천_건강걷기_및_걷자페스티벌 / 기획·품의 / ...
        moved_target_files = list(target_dir.rglob("*.txt"))
        assert len(moved_target_files) >= 8

        for tf in moved_target_files:
            # Must match original SHA-256
            orig_name = tf.name
            assert orig_name in pre_files
            assert compute_sha256(tf) == pre_files[orig_name]

        # Verify audit manifest
        manifest_path = Path(exec_result["manifest_path"])
        assert manifest_path.exists()
        manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
        assert manifest_data["moved_count"] == exec_result["moved_count"]
        assert len(manifest_data["transactions"]) == exec_result["moved_count"]


class TestProgrammaticRollbackEngine:
    """Tests for programmatic rollback, 100% SHA-256 match, and directory pruning."""

    def test_programmatic_rollback_restores_100_percent(self, mock_exec_dataset: Path, tmp_path: Path):
        """Verify RollbackEngine restores 100% files with exact SHA-256 checksums and prunes empty dirs."""
        target_dir = tmp_path / "archive_target"
        engine = OrganizerEngine(dry_run=False)

        # 1. Record original state
        orig_hashes = {p.name: compute_sha256(p) for p in mock_exec_dataset.iterdir() if p.is_file()}

        # 2. Execute migration
        plan = engine.plan(mock_exec_dataset, target_dir)
        exec_result = engine.execute(plan, target_dir=target_dir)
        assert exec_result["status"] == "SUCCESS"

        journal_path = Path(exec_result["journal_path"])
        assert journal_path.exists()

        # Confirm files left source_docs (except unclassified)
        assert not (mock_exec_dataset / "2026 양재천 건강 페스티벌 추진계획.txt").exists()

        # 3. Perform programmatic rollback
        rollback_summary = RollbackEngine.rollback(journal_path)

        assert rollback_summary["status"] == "SUCCESS"
        assert rollback_summary["sha256_match_rate"] == 100.0
        assert rollback_summary["mismatch_count"] == 0
        assert len(rollback_summary["errors"]) == 0
        assert rollback_summary["restored_count"] == exec_result["moved_count"]

        # 4. Verify 100% of files restored to original locations with identical SHA-256
        for filename, expected_hash in orig_hashes.items():
            restored_path = mock_exec_dataset / filename
            assert restored_path.exists(), f"Restored file missing: {filename}"
            actual_hash = compute_sha256(restored_path)
            assert actual_hash == expected_hash, f"Hash mismatch on restored file: {filename}"

        # 5. Verify created target directories were safely pruned
        assert rollback_summary["removed_directories_count"] > 0
        for removed_dir in rollback_summary["removed_directories"]:
            assert not os.path.exists(removed_dir), f"Directory was not pruned: {removed_dir}"

    def test_rollback_dry_run_simulation(self, mock_exec_dataset: Path, tmp_path: Path):
        """Verify rollback with dry_run=True validates targets without moving files."""
        target_dir = tmp_path / "archive_target"
        engine = OrganizerEngine(dry_run=False)

        plan = engine.plan(mock_exec_dataset, target_dir)
        exec_result = engine.execute(plan, target_dir=target_dir)

        journal_path = Path(exec_result["journal_path"])

        # Run rollback dry-run
        dry_summary = RollbackEngine.rollback(journal_path, dry_run=True)
        assert dry_summary["status"] == "SUCCESS"
        assert dry_summary["restored_count"] == exec_result["moved_count"]

        # Files must STILL be in target directory
        assert not (mock_exec_dataset / "2026 양재천 건강 페스티벌 추진계획.txt").exists()

    def test_rollback_idempotent_resume(self, mock_exec_dataset: Path, tmp_path: Path):
        """Verify executing rollback twice handles already-restored files gracefully."""
        target_dir = tmp_path / "archive_target"
        engine = OrganizerEngine(dry_run=False)

        plan = engine.plan(mock_exec_dataset, target_dir)
        exec_result = engine.execute(plan, target_dir=target_dir)
        journal_path = Path(exec_result["journal_path"])

        # First rollback: restores files
        r1 = RollbackEngine.rollback(journal_path)
        assert r1["status"] == "SUCCESS"
        assert r1["restored_count"] == exec_result["moved_count"]

        # Second rollback: detects already restored
        r2 = RollbackEngine.rollback(journal_path)
        assert r2["status"] == "SUCCESS"
        assert r2["already_restored"] == exec_result["moved_count"]
        assert r2["restored_count"] == 0


class TestStandaloneRollbackScript:
    """Tests for standalone zero-dependency rollback.py."""

    def test_standalone_rollback_script_generation(self, tmp_path: Path):
        """Verify standalone rollback.py generator produces a standalone script."""
        script_path = tmp_path / "rollback.py"
        gen_path = generate_standalone_rollback_script(script_path)
        assert gen_path.exists()
        content = gen_path.read_text(encoding="utf-8")
        assert "execute_rollback" in content
        assert "compute_sha256" in content
        assert "import sys" in content
        # Zero external dependencies guarantee
        assert "import pytest" not in content
        assert "import fitz" not in content

    def test_standalone_rollback_script_subprocess_execution(self, mock_exec_dataset: Path, tmp_path: Path):
        """Verify executing standalone `python rollback.py` restores 100% of files via subprocess."""
        target_dir = tmp_path / "archive_target"
        engine = OrganizerEngine(dry_run=False)

        orig_hashes = {p.name: compute_sha256(p) for p in mock_exec_dataset.iterdir() if p.is_file()}

        plan = engine.plan(mock_exec_dataset, target_dir)
        exec_result = engine.execute(plan, target_dir=target_dir)
        rollback_script = Path(exec_result["rollback_script_path"])
        assert rollback_script.exists()

        # Run standalone script via subprocess
        proc = subprocess.run(
            [sys.executable, str(rollback_script)],
            cwd=str(target_dir),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"}
        )

        assert proc.returncode == 0
        assert "공공 행정 문서 마이그레이션 100% 롤백 실행기" in proc.stdout
        assert "SHA-256 일치율: 100.0%" in proc.stdout

        # Assert all files restored and verified
        for filename, expected_hash in orig_hashes.items():
            restored_path = mock_exec_dataset / filename
            assert restored_path.exists()
            assert compute_sha256(restored_path) == expected_hash


class TestCrashAndFailureSafety:
    """Tests for interruption, unexpected exceptions, and automatic emergency rollback."""

    def test_crash_exception_triggers_immediate_automatic_rollback(self, mock_exec_dataset: Path, tmp_path: Path):
        """Verify that an exception raised mid-migration triggers automatic rollback of all moved files."""
        target_dir = tmp_path / "archive_target"
        engine = OrganizerEngine(dry_run=False)

        orig_hashes = {p.name: compute_sha256(p) for p in mock_exec_dataset.iterdir() if p.is_file()}

        plan = engine.plan(mock_exec_dataset, target_dir)

        # Inject a crash on the 3rd moved item
        move_counter = 0
        original_move = shutil.move

        def crashing_move(src, dst):
            nonlocal move_counter
            move_counter += 1
            if move_counter == 3:
                raise RuntimeError("Simulated mid-migration I/O crash on step 3!")
            return original_move(src, dst)

        with patch("shutil.move", side_effect=crashing_move):
            with pytest.raises(RuntimeError, match="Simulated mid-migration I/O crash"):
                engine.execute(plan, target_dir=target_dir)

        # All moved files must have been automatically restored!
        for filename, expected_hash in orig_hashes.items():
            path = mock_exec_dataset / filename
            assert path.exists(), f"File {filename} was not restored after crash!"
            assert compute_sha256(path) == expected_hash

        # Target directory should have no orphaned migrated files
        leftover_files = [p for p in target_dir.rglob("*.txt") if p.is_file()]
        assert len(leftover_files) == 0

    def test_directory_pruning_protects_unrelated_files(self, mock_exec_dataset: Path, tmp_path: Path):
        """Verify rollback directory pruning does NOT remove non-empty or pre-existing folders."""
        target_dir = tmp_path / "archive_target"
        # Create an unrelated pre-existing file in the target root
        target_dir.mkdir(parents=True, exist_ok=True)
        unrelated_file = target_dir / "user_important_notes.txt"
        unrelated_file.write_text("Do not delete me", encoding="utf-8")

        engine = OrganizerEngine(dry_run=False)
        plan = engine.plan(mock_exec_dataset, target_dir)
        exec_result = engine.execute(plan, target_dir=target_dir)

        RollbackEngine.rollback(exec_result["journal_path"])

        # Unrelated file and target_dir must still exist!
        assert target_dir.exists()
        assert unrelated_file.exists()
        assert unrelated_file.read_text(encoding="utf-8") == "Do not delete me"


class TestCLIExecutionAndRollback:
    """Tests for CLI --execute and --rollback modes."""

    def test_cli_execute_and_rollback_in_process(self, mock_exec_dataset: Path, tmp_path: Path):
        """Verify CLI in-process invocation with --execute and subsequent --rollback."""
        target_dir = tmp_path / "cli_archive"
        orig_hashes = {p.name: compute_sha256(p) for p in mock_exec_dataset.iterdir() if p.is_file()}

        # 1. Execute migration via CLI
        exec_code = run_cli([
            str(mock_exec_dataset),
            "--target-dir", str(target_dir),
            "--execute"
        ])
        assert exec_code == 0

        # Files should be in target_dir
        assert not (mock_exec_dataset / "2026 양재천 건강 페스티벌 추진계획.txt").exists()

        # 2. Rollback via CLI
        rollback_code = run_cli([
            "--rollback", str(target_dir)
        ])
        assert rollback_code == 0

        # Files restored
        for fn, h in orig_hashes.items():
            p = mock_exec_dataset / fn
            assert p.exists()
            assert compute_sha256(p) == h

    def test_cli_subprocess_execute_and_rollback(self, mock_exec_dataset: Path, tmp_path: Path):
        """Verify running CLI via subprocess with --execute and --rollback."""
        target_dir = tmp_path / "cli_subproc_archive"
        orig_hashes = {p.name: compute_sha256(p) for p in mock_exec_dataset.iterdir() if p.is_file()}

        # 1. Subprocess execute
        res_exec = subprocess.run(
            [
                sys.executable,
                "-m",
                "tools.file_organizer.cli",
                str(mock_exec_dataset),
                "--target-dir",
                str(target_dir),
                "--execute"
            ],
            capture_output=True,
            text=True,
            encoding="utf-8"
        )
        assert res_exec.returncode == 0
        assert "실제 이관 실행 (Execution)" in res_exec.stdout
        assert "실제 이관 완료 통계" in res_exec.stdout

        # 2. Subprocess rollback
        res_rollback = subprocess.run(
            [
                sys.executable,
                "-m",
                "tools.file_organizer.cli",
                "--rollback",
                str(target_dir)
            ],
            capture_output=True,
            text=True,
            encoding="utf-8"
        )
        assert res_rollback.returncode == 0
        assert "100% 롤백 파이프라인" in res_rollback.stdout
        assert "SHA-256 일치율: 100.0%" in res_rollback.stdout

        # Verify restoration
        for fn, h in orig_hashes.items():
            assert (mock_exec_dataset / fn).exists()
            assert compute_sha256(mock_exec_dataset / fn) == h
