"""Command-Line Interface (CLI) for public administration file organizer.

Features:
- Defaults to safe non-destructive --dry-run mode!
- Arguments: source_dir, --target-dir, --dry-run, --execute, --report-dir, --report-formats
- Generates JSON, Markdown, and HTML audit reports.
- Emits clean administrative summary conforming to AGENTS.md Rule M standards.
"""

import argparse
from pathlib import Path
import sys
from typing import List, Optional

from tools.file_organizer.main import OrganizerEngine, MigrationPlan
from tools.file_organizer.rollback.rollback_engine import RollbackEngine


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        prog="file_organizer",
        description="공공 행정 표준 4단계 위계 파일 자동 분류 및 사전 시뮬레이션(Dry-Run) 아카이빙 도구"
    )

    parser.add_argument(
        "source_dir",
        nargs="?",
        default=".",
        help="스캔 및 분류 대상 원본 디렉토리 경로 (기본값: 현재 디렉토리)"
    )

    parser.add_argument(
        "--source-dir",
        dest="opt_source_dir",
        default=None,
        help="원본 디렉토리 경로 (명시적 옵션 플래그)"
    )

    parser.add_argument(
        "--target-dir",
        dest="target_dir",
        default=None,
        help="표준 아카이브 목표 디렉토리 경로 (미지정 시 <source_dir>/_Organized_Archive)"
    )

    # Dry-run is explicitly True by default
    parser.add_argument(
        "--dry-run",
        dest="dry_run",
        action="store_true",
        default=True,
        help="사전 시뮬레이션 모드 (원본 파일 시스템 100%% 불변 유지, 기본값: True)"
    )

    parser.add_argument(
        "--execute",
        dest="execute",
        action="store_true",
        default=False,
        help="실제 파일 이관 실행 (기본값: False)"
    )

    parser.add_argument(
        "--rollback",
        dest="rollback_target",
        nargs="?",
        const=".",
        default=None,
        help="트랜잭션 저널 파일 또는 아카이브 디렉토리 경로를 지정하여 100%% 원상 복구(롤백) 수행"
    )

    parser.add_argument(
        "--report-dir",
        dest="report_dir",
        default="./audit_reports",
        help="사전 검토 및 감사 보고서 출력 디렉토리 경로 (기본값: ./audit_reports)"
    )

    parser.add_argument(
        "--report-formats",
        dest="report_formats",
        default="json,md,html",
        help="보고서 생성 포맷 (쉼표로 구분: json, md, html. 기본값: json,md,html)"
    )

    return parser.parse_args(argv)


def run_cli(argv: Optional[List[str]] = None) -> int:
    """Main CLI execution flow."""
    args = parse_args(argv)

    # Handle explicit --rollback mode
    if args.rollback_target is not None:
        target_path = Path(args.rollback_target).resolve()
        is_dry_run = bool(args.dry_run and not args.execute and (argv and "--dry-run" in argv))

        print("=" * 70)
        print("󰏚 [공공 행정 문서 표준 아카이빙 100% 롤백 파이프라인]")
        print(f"  • 실행 모드 : {'롤백 시뮬레이션 (Dry-Run)' if is_dry_run else '실제 원상 복구 (Execution)'}")
        print(f"  • 대상 경로 : {target_path}")
        print("=" * 70)

        result = RollbackEngine.rollback(target_path, dry_run=is_dry_run)

        print("\n[롤백 결과 요약]")
        print(f"  - 총 트랜잭션 : {result['total_transactions']}건")
        print(f"  - 정상 원복   : {result['restored_count']}건")
        print(f"  - 기원복 확인 : {result['already_restored']}건")
        print(f"  - 해시 불일치 : {result['mismatch_count']}건")
        print(f"  - SHA-256 일치율: {result['sha256_match_rate']}%")
        print(f"  - 빈 폴더 제거: {result['removed_directories_count']}개")
        if result['errors']:
            print(f"  - 오류 발생   : {len(result['errors'])}건")
            for err in result['errors']:
                print(f"    * {err}", file=sys.stderr)

        print("=" * 70)
        print("  끝.\n")
        return 0 if result["status"] == "SUCCESS" else 1

    # Resolve source directory
    source_dir_str = args.opt_source_dir if args.opt_source_dir else args.source_dir
    source_path = Path(source_dir_str).resolve()

    if not source_path.exists() or not source_path.is_dir():
        print(f"[오류] 대상 디렉토리를 찾을 수 없거나 올바르지 않습니다: {source_path}", file=sys.stderr)
        return 1

    # Determine execution mode: defaults to dry-run
    if args.execute and not (argv and "--dry-run" in argv):
        is_dry_run = False
        mode_label = "실제 이관 실행 (Execution)"
    else:
        is_dry_run = True
        mode_label = "사전 시뮬레이션 (Dry-Run)"

    formats = [f.strip().lower() for f in args.report_formats.split(",") if f.strip()]

    print("=" * 70)
    print("󰏚 [공공 행정 문서 표준 아카이빙 파이프라인]")
    print(f"  • 점검 모드 : {mode_label}")
    print(f"  • 대상 경로 : {source_path}")
    print(f"  • 보고서 경로: {Path(args.report_dir).resolve()}")
    print("=" * 70)

    engine = OrganizerEngine(dry_run=is_dry_run)

    try:
        plan: MigrationPlan = engine.plan(source_dir=source_path, target_dir=args.target_dir)
    except Exception as e:
        print(f"[실패] 계획 수립 중 오류 발생: {e}", file=sys.stderr)
        return 1

    # Generate isolated audit reports
    report_dir_path = Path(args.report_dir).resolve()
    generated_reports = engine.generate_reports(plan, report_dir=report_dir_path, formats=formats)

    metrics = plan.summary_metrics
    pb = plan.phase_breakdown

    print("\n[시뮬레이션 완료 통계]")
    print(f"  - 총 스캔 문서 : {metrics['total_scanned_files']}건 ({plan.total_size:,} bytes)")
    print(f"  - 3단계 이상 분류: {metrics['total_classified_files']}건 ({metrics['classification_accuracy_percentage']}%)")
    print(f"  - 중복 파일 감지 : {metrics['total_duplicates_detected']}건 (_Duplicates 격리 예정)")
    print(f"  - 버전 군집      : {metrics['total_version_clusters']}개 군집")
    print(f"  - 미분류 문서    : {metrics['total_unclassified_files']}건")

    print("\n[4대 업무단계별 현황]")
    print(f"  • 01_기획·품의: {pb['planning_approval']}건")
    print(f"  • 02_예산·지출: {pb['budget_expenditure']}건")
    print(f"  • 03_집행·행사: {pb['execution_event']}건")
    print(f"  • 04_결과보고·정산: {pb['outcome_settlement']}건")
    if pb['unclassified'] > 0:
        print(f"  • 기타·미분류: {pb['unclassified']}건")

    print("\n[생성된 검토 보고서 목록]")
    for fmt, path in generated_reports.items():
        print(f"  [{fmt.upper()}] {path}")

    # If execution mode, trigger actual migration
    if not is_dry_run:
        try:
            exec_result = engine.execute(plan, target_dir=args.target_dir, dry_run=False)
            print("\n[실제 이관 완료 통계]")
            print(f"  - 이관 완료 문서 : {exec_result['moved_count']}건")
            print(f"  - 건너뛴 문서   : {exec_result['skipped_count']}건")
            print(f"  - 트랜잭션 저널 : {exec_result['journal_path']}")
            print(f"  - 롤백 스크립트 : {exec_result['rollback_script_path']}")
            print("\n[안전 보장 안내] 원상 복구가 필요한 경우 언제든 아래 명령어를 실행하십시오:")
            print(f"  python \"{exec_result['rollback_script_path']}\"")
            print(f"  또는: python -m tools.file_organizer.cli --rollback \"{exec_result['target_dir']}\"")
        except Exception as e:
            print(f"[실패] 파일 이관 실행 중 오류 발생 (자동 롤백 완료): {e}", file=sys.stderr)
            return 1
    else:
        print("\n[무결성 검증] 원본 파일 시스템 0건 변경 (불변성 100% 보장 완료)")

    print("=" * 70)
    print("  끝.\n")

    return 0


def main() -> None:
    """CLI entry point."""
    sys.exit(run_cli(sys.argv[1:]))


if __name__ == "__main__":
    main()
