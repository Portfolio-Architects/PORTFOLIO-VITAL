"""Tests for Milestone 2: Mathematical immutability, report generation, and CLI.

Verifies:
- Formal snapshot immutability (SHA-256, mtime, size, file/dir counts invariant).
- 100% coverage and schema compliance of JSON, Markdown, and HTML audit reports.
- Compliance with AGENTS.md Rule M standards.
- CLI default dry-run execution, exit code 0, and argument parsing.
"""

import json
import os
from pathlib import Path
import subprocess
import sys
from typing import Dict, Tuple

import pytest

from tools.file_organizer.main import OrganizerEngine, MigrationPlan
from tools.file_organizer.cli import run_cli, parse_args
from tools.file_organizer.scanner.metadata_extractor import compute_sha256


def take_directory_snapshot(root_dir: Path) -> Dict[str, Tuple[int, int, str]]:
    """Capture snapshot of directory state.

    Returns:
        Mapping of relative_path -> (size, mtime_ns, sha256) for files,
        and relative_path -> (0, 0, "DIRECTORY") for directories.
    """
    snapshot: Dict[str, Tuple[int, int, str]] = {}
    root = Path(root_dir).resolve()

    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root)
        if rel_dir != ".":
            snapshot[rel_dir.replace("\\", "/")] = (0, 0, "DIRECTORY")

        for fn in filenames:
            file_path = Path(dirpath) / fn
            rel_file = os.path.relpath(file_path, root).replace("\\", "/")
            st = file_path.stat()
            sha = compute_sha256(file_path)
            snapshot[rel_file] = (st.st_size, st.st_mtime_ns, sha)

    return snapshot


@pytest.fixture
def mock_admin_dataset(tmp_path: Path) -> Path:
    """Create a structured test directory with diverse public administration files."""
    source = tmp_path / "source_docs"
    source.mkdir(parents=True, exist_ok=True)

    # 1. 2026 Planning document
    p1 = source / "2026 양재천 건강 페스티벌 추진계획.txt"
    p1.write_text("2026년 양재천 건강 페스티벌 기본계획서 및 추진일정", encoding="utf-8")

    # 2. 2026 Budget document
    p2 = source / "20260417_분할납품요구서(서울체력장 강남센터 영상정보장치 구매).txt"
    p2.write_text("서울체력장 강남센터 영상정보장치 구매 물품계약 소요예산", encoding="utf-8")

    # 3. 2026 Event document
    p3 = source / "2026년 강남구 보건소 「건강 뜀」 비만예방 프로그램 참가자 명단.txt"
    p3.write_text("건강뜀 참가자 명단 및 접수대장", encoding="utf-8")

    # 4. 2025 Outcome document
    p4 = source / "2025년 강남구 보건신체활동 활성화 사업운영 결과보고.txt"
    p4.write_text("2025년도 보건신체활동 활성화 사업 결과보고서 및 집행실적", encoding="utf-8")

    # 5. Version family (v1 and 최종)
    v1 = source / "(260914) AI메디헬스 사업설명서(건강증진팀)_v1.txt"
    v1.write_text("AI메디헬스 사업설명서 초안 v1", encoding="utf-8")
    v_final = source / "(260914) AI메디헬스 사업설명서(건강증진팀)-최종.txt"
    v_final.write_text("AI메디헬스 사업설명서 최종 확정본", encoding="utf-8")

    # 6. Duplicates (identical content, different names)
    dup_content = b"IDENTICAL_AUDIT_VERIFICATION_CONTENT_2026"
    d1 = source / "20260810_손목닥터9988_용역대금_청구서.txt"
    d1.write_bytes(dup_content)
    d2 = source / "20260810_손목닥터9988_용역대금_청구서_사본.txt"
    d2.write_bytes(dup_content)

    # 7. 0-byte file (Rule 1 guard)
    z1 = source / "20260715_서울체력장_업체대금_청구서.txt"
    z1.write_bytes(b"")

    # 8. Unclassified file
    u1 = source / "임시메모_잡동사니.txt"
    u1.write_text("내용 없음", encoding="utf-8")

    # Subdirectory with another file
    sub = source / "과거자료"
    sub.mkdir(parents=True, exist_ok=True)
    sub_f = sub / "20221110_‘2022 강남구 건강걷기 체험행사’ 용역 계약 준공 정산.txt"
    sub_f.write_text("2022년도 건강걷기 행사 준공 정산서", encoding="utf-8")

    return source


class TestMathematicalImmutability:
    """Rigorous mathematical invariance assertions for dry-run simulation."""

    def test_dry_run_zero_mutation_snapshot_invariance(self, mock_admin_dataset: Path, tmp_path: Path):
        """Verify that dry-run planning causes 0 byte changes, 0 file additions, 0 deletions."""
        target_dir = tmp_path / "target_archive"
        report_dir = tmp_path / "reports"

        # 1. Capture snapshot before dry-run
        snapshot_pre = take_directory_snapshot(mock_admin_dataset)
        assert len(snapshot_pre) > 0

        # 2. Execute dry-run planning and report generation
        engine = OrganizerEngine(dry_run=True)
        plan = engine.plan(source_dir=mock_admin_dataset, target_dir=target_dir)

        # 3. Capture snapshot after planning
        snapshot_post_plan = take_directory_snapshot(mock_admin_dataset)

        # Invariance check: Exactly identical snapshot
        assert snapshot_pre == snapshot_post_plan, "Source directory snapshot diverged after plan()!"

        # 4. Generate reports into separate directory
        engine.generate_reports(plan, report_dir=report_dir, formats=["json", "md", "html"])

        # Invariance check after report generation
        snapshot_post_report = take_directory_snapshot(mock_admin_dataset)
        assert snapshot_pre == snapshot_post_report, "Source directory snapshot diverged after generate_reports()!"

        # 5. Assert target directory was NOT created with moved files during dry-run
        if target_dir.exists():
            moved_files = list(target_dir.rglob("*"))
            # In dry-run mode, files should NOT be relocated
            assert len([f for f in moved_files if f.is_file()]) == 0

    def test_dry_run_plan_structure_and_coverage(self, mock_admin_dataset: Path, tmp_path: Path):
        """Verify MigrationPlan accurately captures all scanned files and computes 4-tier paths."""
        target_dir = tmp_path / "target_archive"
        engine = OrganizerEngine(dry_run=True)
        plan = engine.plan(source_dir=mock_admin_dataset, target_dir=target_dir)

        assert plan.dry_run is True
        assert plan.total_files == 11
        assert len(plan.items) == 11
        assert plan.total_size > 0
        assert plan.scan_duration_seconds >= 0.0

        # Verify duplicate isolation
        assert len(plan.duplicates) >= 1
        for dup_item in plan.duplicates:
            assert dup_item.classification.is_duplicate is True
            assert "_Duplicates" in str(dup_item.target_path)
            assert dup_item.planned_action == "MOVE_DUPLICATE"

        # Verify 4-tier target hierarchy: [연도] > [사업명] > [업무단계] > [파일명]
        for item in plan.items:
            rel = item.target_path.relative_to(target_dir)
            parts = rel.parts
            if item.classification.is_duplicate:
                # _Duplicates / year / project / stage / filename
                assert parts[0] == "_Duplicates"
                assert len(parts) == 5
            else:
                # year / project / stage / filename
                assert len(parts) == 4
                assert parts[0] == item.classification.year
                assert parts[1] == item.classification.project
                assert parts[2] == item.classification.stage
                assert parts[3] == item.target_filename


class TestAuditReportGeneration:
    """Tests for JSON, Markdown, and HTML report formatting and schema compliance."""

    def test_json_report_schema_and_integrity(self, mock_admin_dataset: Path, tmp_path: Path):
        """Verify JSON audit report strictly satisfies the schema specification."""
        target_dir = tmp_path / "target_archive"
        report_dir = tmp_path / "reports"

        engine = OrganizerEngine(dry_run=True)
        plan = engine.plan(mock_admin_dataset, target_dir)
        reports = engine.generate_reports(plan, report_dir, formats=["json"])

        json_file = reports["json"]
        assert json_file.exists()

        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Top-level schema keys
        assert data["report_version"] == "1.0.0"
        assert "execution_metadata" in data
        assert "summary_metrics" in data
        assert "phase_breakdown" in data
        assert "items" in data

        # Execution metadata
        meta = data["execution_metadata"]
        assert meta["mode"] == "DRY_RUN"
        assert meta["source_directory"] == str(mock_admin_dataset.resolve())
        assert meta["target_directory"] == str(target_dir.resolve())
        assert meta["scan_duration_seconds"] >= 0.0

        # Summary metrics
        metrics = data["summary_metrics"]
        assert metrics["total_scanned_files"] == 11
        assert metrics["total_duplicates_detected"] >= 1
        assert metrics["total_version_clusters"] >= 1
        assert metrics["classification_accuracy_percentage"] >= 80.0

        # Phase breakdown
        pb = data["phase_breakdown"]
        assert pb["planning_approval"] >= 1
        assert pb["budget_expenditure"] >= 1
        assert pb["execution_event"] >= 1
        assert pb["outcome_settlement"] >= 1

        # Items validation
        assert len(data["items"]) == 11
        for item in data["items"]:
            assert "item_id" in item
            assert "original_path" in item
            assert "original_filename" in item
            assert "file_size_bytes" in item
            assert "sha256" in item
            assert "file_extension" in item
            assert "classification" in item
            assert "version_analysis" in item
            assert "planned_action" in item
            assert "target_path" in item
            assert "target_filename" in item

            # Classification nested keys
            cls_data = item["classification"]
            assert "tier1_year" in cls_data
            assert "tier2_project" in cls_data
            assert cls_data["tier3_phase"] in ["기획·품의", "예산·지출", "집행·행사", "결과보고·정산", "기타·미분류"]
            assert "confidence" in cls_data
            assert isinstance(cls_data["match_criteria"], list)

            # Version analysis nested keys
            ver_data = item["version_analysis"]
            assert "is_versioned" in ver_data
            assert "clean_base_title" in ver_data
            assert "is_duplicate" in ver_data
            assert ver_data["duplicate_type"] in ["EXACT_HASH", "TEXT_SIMILARITY", "NONE"]
            assert "is_primary_representative" in ver_data

    def test_markdown_report_rule_m_compliance(self, mock_admin_dataset: Path, tmp_path: Path):
        """Verify Markdown report follows AGENTS.md Rule M administrative standards."""
        target_dir = tmp_path / "target_archive"
        report_dir = tmp_path / "reports"

        engine = OrganizerEngine(dry_run=True)
        plan = engine.plan(mock_admin_dataset, target_dir)
        reports = engine.generate_reports(plan, report_dir, formats=["md"])

        md_file = reports["md"]
        assert md_file.exists()

        content = md_file.read_text(encoding="utf-8")

        # 1. Dingbat title
        assert "󰏚 [공공 행정 문서 표준 아카이브 사전 시뮬레이션(Dry-Run) 결과보고서]" in content

        # 2. Section headers
        assert "1. 시뮬레이션 개요" in content
        assert "2. 종합 통계" in content
        assert "3. 공공 표준 4대 업무단계별 분류 현황" in content
        assert "4. 상세 파일 이관 계획 명세표" in content

        # 3. Administrative bullets
        assert "  가. 점검일시:" in content
        assert "  나. 대상 디렉토리:" in content
        assert "  다. 목표 아카이브:" in content
        assert "  라. 점검 모드:" in content

        # 4. Summary table and 4 phases
        assert "총 스캔 문서" in content
        assert "3단계 이상 분류 성공" in content
        assert "중복 및 버전 파편 파일" in content
        assert "기획·품의" in content
        assert "예산·지출" in content
        assert "집행·행사" in content
        assert "결과보고·정산" in content

        # 5. Table rows for all files
        assert "| 순번 | 원본 파일명 | 규격 |" in content
        assert "2026 양재천 건강 페스티벌 추진계획" in content

        # 6. Formal administrative closing
        assert content.strip().endswith("끝.")

    def test_html_report_standalone_and_interactive(self, mock_admin_dataset: Path, tmp_path: Path):
        """Verify HTML report is valid, standalone (no external CDN links), and interactive."""
        target_dir = tmp_path / "target_archive"
        report_dir = tmp_path / "reports"

        engine = OrganizerEngine(dry_run=True)
        plan = engine.plan(mock_admin_dataset, target_dir)
        reports = engine.generate_reports(plan, report_dir, formats=["html"])

        html_file = reports["html"]
        assert html_file.exists()

        content = html_file.read_text(encoding="utf-8")

        # Standalone HTML structure
        assert "<!DOCTYPE html>" in content
        assert '<html lang="ko">' in content
        assert "<title>" in content
        assert "<style>" in content
        assert "<script>" in content

        # Zero external CDN dependencies (offline guarantee)
        assert 'href="http' not in content
        assert 'src="http' not in content

        # Live filter components
        assert 'id="searchInput"' in content
        assert 'id="stageFilter"' in content
        assert 'id="planTable"' in content
        assert "filterTable" in content

        # Metric cards & Badges
        assert "총 스캔 파일" in content
        assert "분류 완료율" in content
        assert "badge-stage-plan" in content
        assert "badge-stage-bud" in content
        assert "badge-dup" in content

    def test_generate_all_reports_simultaneously(self, mock_admin_dataset: Path, tmp_path: Path):
        """Verify generating JSON, Markdown, and HTML reports in one call."""
        report_dir = tmp_path / "all_reports"
        engine = OrganizerEngine(dry_run=True)
        plan = engine.plan(mock_admin_dataset)
        reports = engine.generate_reports(plan, report_dir, formats=["json", "md", "html"])

        assert set(reports.keys()) == {"json", "md", "html"}
        for fmt, path in reports.items():
            assert path.exists()
            assert path.stat().st_size > 0


class TestCLIInvocation:
    """Tests for Command-Line Interface execution and argument handling."""

    def test_cli_default_dry_run_flag(self, mock_admin_dataset: Path, tmp_path: Path):
        """Verify CLI defaults to dry-run and executes successfully with exit code 0."""
        report_dir = tmp_path / "cli_reports"
        exit_code = run_cli([
            str(mock_admin_dataset),
            "--report-dir", str(report_dir),
            "--report-formats", "json,md"
        ])

        assert exit_code == 0
        assert (report_dir / "audit_report.json").exists()
        assert (report_dir / "audit_report.md").exists()

    def test_cli_explicit_dry_run_flag(self, mock_admin_dataset: Path, tmp_path: Path):
        """Verify explicit --dry-run flag works cleanly."""
        report_dir = tmp_path / "cli_reports_explicit"
        exit_code = run_cli([
            str(mock_admin_dataset),
            "--dry-run",
            "--report-dir", str(report_dir)
        ])

        assert exit_code == 0
        assert (report_dir / "audit_report.html").exists()

    def test_cli_invocation_with_default_current_directory(self):
        """Verify running CLI with --dry-run without specifying directory defaults to current directory."""
        # Test parse_args default
        args = parse_args(["--dry-run"])
        assert args.source_dir == "."
        assert args.dry_run is True

    def test_cli_subprocess_run(self, mock_admin_dataset: Path, tmp_path: Path):
        """Verify running `python -m tools.file_organizer.cli --dry-run` via subprocess."""
        report_dir = tmp_path / "subproc_reports"
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "tools.file_organizer.cli",
                str(mock_admin_dataset),
                "--dry-run",
                "--report-dir",
                str(report_dir)
            ],
            capture_output=True,
            text=True,
            encoding="utf-8"
        )

        assert result.returncode == 0
        assert "공공 행정 문서 표준 아카이빙 파이프라인" in result.stdout
        assert "사전 시뮬레이션 (Dry-Run)" in result.stdout
        assert "불변성 100% 보장 완료" in result.stdout
        assert (report_dir / "audit_report.json").exists()
        assert (report_dir / "audit_report.md").exists()
        assert (report_dir / "audit_report.html").exists()

    def test_cli_nonexistent_source_directory_error(self):
        """Verify CLI exits with code 1 when target source directory does not exist."""
        bad_path = "C:/NonExistentPath_0123456789"
        exit_code = run_cli([bad_path])
        assert exit_code == 1

    def test_cli_named_source_dir_argument(self, mock_admin_dataset: Path, tmp_path: Path):
        """Verify CLI accepts --source-dir as named argument."""
        report_dir = tmp_path / "named_source_reports"
        exit_code = run_cli([
            "--source-dir", str(mock_admin_dataset),
            "--report-dir", str(report_dir),
            "--dry-run"
        ])
        assert exit_code == 0
        assert (report_dir / "audit_report.json").exists()

    def test_cli_execute_flag_mode_switch(self):
        """Verify --execute flag switches mode to execution when --dry-run is not provided."""
        args = parse_args(["--execute"])
        assert args.execute is True


class TestEdgeCasesAndCollisions:
    """Tests for collisions, empty source directory, and direct reporter class APIs."""

    def test_empty_source_directory_planning(self, tmp_path: Path):
        """Verify planning an empty directory produces a valid 0-item plan with 0 mutations."""
        empty_dir = tmp_path / "empty_source"
        empty_dir.mkdir()

        engine = OrganizerEngine(dry_run=True)
        plan = engine.plan(empty_dir)

        assert plan.total_files == 0
        assert len(plan.items) == 0
        assert plan.summary_metrics["total_scanned_files"] == 0
        assert plan.summary_metrics["classification_accuracy_percentage"] == 0.0

    def test_name_collision_resolution_with_index_suffix(self, tmp_path: Path):
        """Verify that different files with identical names from different subdirectories get INDEX_SUFFIX."""
        root = tmp_path / "collision_test"
        dir1 = root / "folder1"
        dir2 = root / "folder2"
        dir1.mkdir(parents=True)
        dir2.mkdir(parents=True)

        f1 = dir1 / "2026 양재천 건강 페스티벌 추진계획.txt"
        f1.write_text("버전 A의 내용입니다", encoding="utf-8")

        f2 = dir2 / "2026 양재천 건강 페스티벌 추진계획.txt"
        f2.write_text("완전히 다른 내용의 버전 B입니다", encoding="utf-8")

        engine = OrganizerEngine(dry_run=True)
        plan = engine.plan(root)

        assert plan.total_files == 2
        # Target filenames should be distinct
        target_names = [item.target_path.name for item in plan.items]
        assert len(set(target_names)) == 2
        # One of them should have INDEX_SUFFIX strategy
        strategies = [item.collision_strategy for item in plan.items]
        assert "INDEX_SUFFIX" in strategies

    def test_direct_reporter_class_render_methods(self, mock_admin_dataset: Path):
        """Verify JSONReporter and MarkdownReporter static render methods return non-empty strings."""
        from tools.file_organizer.reporter import JSONReporter, MarkdownReporter

        engine = OrganizerEngine(dry_run=True)
        plan = engine.plan(mock_admin_dataset)

        json_str = JSONReporter.render(plan)
        assert json_str.startswith("{")
        assert "PublicAdminFileOrganizerAuditReport" in json_str

        md_str = MarkdownReporter.render_markdown(plan)
        assert md_str.startswith("󰏚")
        assert md_str.strip().endswith("끝.")

        html_str = MarkdownReporter.render_html(plan)
        assert "<!DOCTYPE html>" in html_str

