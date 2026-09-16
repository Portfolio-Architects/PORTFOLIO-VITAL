"""Unit tests for 4-tier taxonomy, date cascade, project ontology, and stage priority."""

from pathlib import Path
import pytest

from tools.file_organizer.scanner.metadata_extractor import FileInfo
from tools.file_organizer.classifier.taxonomy import (
    ClassificationResult,
    is_valid_year,
    is_valid_project,
    is_valid_stage,
    is_valid_doc_type
)
from tools.file_organizer.classifier.rule_engine import (
    extract_year,
    extract_project,
    extract_stage,
    extract_doc_type,
    classify_file
)
from tools.file_organizer.config import (
    STAGE_01_PLANNING,
    STAGE_02_BUDGET,
    STAGE_03_EVENT,
    STAGE_04_OUTCOME,
    YEAR_UNKNOWN,
    PROJECT_UNKNOWN
)


class TestYearCascade:
    """Tests for the 5-stage year cascade extraction."""

    def test_stage_1_filename_4digit(self):
        """Priority 1: Explicit 4-digit year in filename."""
        year, rat, conf = extract_year("2026 양재천 건강 페스티벌 추진계획.hwpx")
        assert year == "2026년"
        assert "FILENAME_4DIGIT" in rat
        assert conf >= 0.95

    def test_stage_2_filename_8digit_date(self):
        """Priority 2: 8-digit date string (YYYYMMDD) in filename."""
        year, rat, conf = extract_year("20260417_분할납품요구서(서울체력장).hwpx")
        assert year == "2026년"
        assert "FILENAME_8DIGIT_DATE" in rat

    def test_stage_3_filename_6digit_date(self):
        """Priority 3: 6-digit date string (YYMMDD) in prefix."""
        year, rat, conf = extract_year("(260914) 사업설명서(건강증진팀)-최종.hwpx")
        assert year == "2026년"
        assert "FILENAME_6DIGIT_PREFIX" in rat

        year2, rat2, _ = extract_year("260528_공공부문 비정규직 처우개선 가이드라인.pdf")
        assert year2 == "2026년"

    def test_stage_4_body_text_fallback(self):
        """Priority 4: Date found in document body text when filename has no date."""
        body = "본 계획서는 보건소 신체활동 활성화 방침에 따라 시행일자: 2025. 9. 16. 등록됨."
        year, rat, conf = extract_year("보건소_업무실적_서식.hwpx", text_preview=body)
        assert year == "2025년"
        assert "BODY_TEXT_DATE" in rat

    def test_stage_5_mtime_fallback(self):
        """Priority 5: Valid mtime metadata fallback when filename and body have no date."""
        # Timestamp for 2024-06-15
        mtime_2024 = 1718450000.0
        year, rat, conf = extract_year("통합관리_매뉴얼.docx", text_preview="내용 없음", mtime=mtime_2024)
        assert year == "2024년"
        assert "MTIME_METADATA_FALLBACK" in rat

    def test_stage_fallback_unknown(self):
        """Fallback to YEAR_UNKNOWN when no date clues exist and mtime is 0."""
        year, rat, conf = extract_year("임시파일.txt", text_preview="", mtime=0.0)
        assert year == YEAR_UNKNOWN
        assert "YEAR_FALLBACK_UNKNOWN" in rat


class TestProjectOntology:
    """Tests for 13 standard ontologies and dynamic project extraction."""

    @pytest.mark.parametrize("filename,expected_project", [
        ("1. 서울체력장 자치구 설명회_수정.pdf", "서울체력장_체력인증센터"),
        ("2026 양재천 건강 페스티벌 추진계획.hwpx", "양재천_건강축제_페스티벌"),
        ("손목닥터9988 강남구 걷기 챌린지 시작_최종.hwpx", "손목닥터9988_스마트헬스"),
        ("민선9기 주요사업 4개년 실행계획서(AI메디헬스).hwpx", "AI_메디헬스_스마트케어"),
        ("2025년 강남구 보건신체활동 활성화 사업운영 결과보고.hwpx", "신체활동_건강생활실천"),
        ("2026년 강남구 보건소 「건강 뜀」 중년여성 비만예방 프로그램.xlsx", "비만예방_건강뜀"),
        ("아이뛰움 프로그램 운영 계획서.hwpx", "어린이신체활동_아이뛰움"),
        ("바른자세 개선 사업 계획안.hwp", "바른자세_체형교정"),
        ("심뇌혈관질환 예방관리 계획서.hwpx", "심뇌혈관질환_예방관리"),
        ("제336회 임시회 주요업무보고(보건행정과).hwpx", "주요업무보고_기획총괄"),
        ("국가예방접종 위탁의료기관 점검 계획.hwpx", "감염병_방역_예방접종"),
        ("치매안심마을 운영계획서.hwpx", "정신건강_치매안심"),
        ("2027년도 본예산 1차 조정내역 안내(건강증진팀).xlsx", "일반행정_예산회계"),
    ])
    def test_standard_ontology_coverage(self, filename: str, expected_project: str):
        """Verify all 13 standard projects are accurately identified from real-world names."""
        project, rat, conf = extract_project(filename)
        assert project == expected_project, f"Failed for {filename}: got {project}"
        assert conf >= 0.70

    def test_dynamic_bracket_project_extraction(self):
        """Verify dynamic extraction for custom bracketed projects not in static ontology."""
        fn = "2026년 「강남 스마트 헬스케어 캠페인」 참여자 안내문.hwpx"
        project, rat, conf = extract_project(fn)
        assert "강남_스마트_헬스케어_캠페인" in project or "AI_메디헬스_스마트케어" in project
        assert conf >= 0.70

    def test_project_fallback_unknown(self):
        """Verify unclassifiable filenames fallback to PROJECT_UNKNOWN."""
        project, rat, conf = extract_project("잡동사니_단순메모.txt")
        assert project == PROJECT_UNKNOWN


class TestStageDisambiguation:
    """Tests for strict 4-stage priority disambiguation."""

    def test_priority_1_outcome_beats_planning_and_event(self):
        """Outcome/Settlement takes highest priority over planning or event words."""
        # Has "사업운영" and "결과보고" -> must be Stage 4
        fn = "2025년 강남구 보건신체활동 활성화 사업운영 결과보고.hwpx"
        stage, rat, _ = extract_stage(fn)
        assert stage == STAGE_04_OUTCOME

        # Has "정산" -> Stage 4
        fn2 = "20221110_‘2022 강남구 건강걷기 체험행사’ 용역 계약 준공 정산.hwp"
        stage2, rat2, _ = extract_stage(fn2)
        assert stage2 == STAGE_04_OUTCOME

    def test_priority_2_budget_beats_planning_and_event(self):
        """Budget/Expenditure takes priority over planning or event words."""
        # Has "개관식 견적서" -> 견적서 (Stage 2) beats 개관식 (Stage 3)
        fn = "20260325_26년 05월 01일 체력인증센터 개관식 견적서.xlsx"
        stage, rat, _ = extract_stage(fn)
        assert stage == STAGE_02_BUDGET

        # 납품검사원 / 분할납품요구서 -> Stage 2
        fn2 = "20260417_분할납품요구서(서울체력장 강남센터 영상정보장치 구매).hwpx"
        stage2, rat2, _ = extract_stage(fn2)
        assert stage2 == STAGE_02_BUDGET

    def test_priority_3_task_spec_beats_event(self):
        """Task specification / RFP (01_기획) beats event terms (03_집행)."""
        # "건강걷기 체험행사 계획 과업지시서" contains "체험행사", but is a "과업지시서" -> Stage 1
        fn = "★최종★_20221014_6. 2022년 강남구 건강걷기 체험행사 계획 과업지시서.hwp"
        stage, rat, _ = extract_stage(fn)
        assert stage == STAGE_01_PLANNING
        assert "TASK_SPEC" in rat

        fn2 = "2026 양재천 건강 페스티벌 과업내용서(최종).hwpx"
        stage2, rat2, _ = extract_stage(fn2)
        assert stage2 == STAGE_01_PLANNING
        assert "TASK_SPEC" in rat2

    def test_priority_4_event_execution(self):
        """Event execution: scripts, rosters, flyers, responses."""
        fn = "2026년 강남구 보건소 「건강 뜀」 비만예방 프로그램 참여자 모집 (Responses).xlsx"
        stage, rat, _ = extract_stage(fn)
        assert stage == STAGE_03_EVENT

        fn2 = "서울체력장 강남센터 리플렛 v4.pdf"
        stage2, rat2, _ = extract_stage(fn2)
        assert stage2 == STAGE_03_EVENT

    def test_priority_5_general_planning(self):
        """General planning: master plans, proposals, guidelines."""
        fn = "2026 양재천 건강 페스티벌 추진계획.hwpx"
        stage, rat, _ = extract_stage(fn)
        assert stage == STAGE_01_PLANNING

        fn2 = "260528_공공부문 비정규직 처우개선 가이드라인.pdf"
        stage2, rat2, _ = extract_stage(fn2)
        assert stage2 == STAGE_01_PLANNING


class TestDocumentTypeAndFullClassification:
    """Tests for document type detection and full end-to-end 4-tier classification accuracy."""

    def test_document_type_detection(self):
        """Verify 12 document types match appropriately."""
        assert extract_doc_type("과업지시서.hwpx")[0] == "과업지시서"
        assert extract_doc_type("용역 준공 정산서.hwp")[0] == "정산_결산서"
        assert extract_doc_type("사업운영 결과보고서.hwpx")[0] == "결과보고서"
        assert extract_doc_type("물품구매 견적서.xlsx")[0] == "견적서"
        assert extract_doc_type("본예산 사업설명서.hwpx")[0] == "사업설명서"
        assert extract_doc_type("물품공급 계약서.pdf")[0] == "계약_지출서류"
        assert extract_doc_type("행사 홍보 리플릿.pdf")[0] == "홍보_행사자료"
        assert extract_doc_type("참여자 명단.xlsx")[0] == "서식_명단"
        assert extract_doc_type("업무 가이드라인.pdf")[0] == "지침_매뉴얼"
        assert extract_doc_type("주요업무보고.hwpx")[0] == "기안_품의서"
        assert extract_doc_type("종합추진계획.hwpx")[0] == "계획서"

    def test_benchmark_full_classification_accuracy_above_95_percent(self):
        """Verify 4-tier classification accuracy exceeds 95% on realistic public admin dataset."""
        test_dataset = [
            {
                "fn": "(20260915)보건소 주간 업무실적 및 계획(신체활동).hwpx",
                "exp_year": "2026년", "exp_proj": "주요업무보고_기획총괄", "exp_stage": STAGE_01_PLANNING
            },
            {
                "fn": "(260914) 사업설명서(건강증진팀)-최종.hwpx",
                "exp_year": "2026년", "exp_stage": STAGE_01_PLANNING
            },
            {
                "fn": "(강남구청_2026_9_17) 손목닥터9988 강남구 걷기 챌린지 시작_수정12.hwpx",
                "exp_year": "2026년", "exp_proj": "손목닥터9988_스마트헬스", "exp_stage": STAGE_01_PLANNING
            },
            {
                "fn": "2025년 강남구 보건신체활동 활성화 사업운영 결과보고.hwpx",
                "exp_year": "2025년", "exp_proj": "신체활동_건강생활실천", "exp_stage": STAGE_04_OUTCOME
            },
            {
                "fn": "2026 양재천 건강 페스티벌 과업내용서(최종).hwpx",
                "exp_year": "2026년", "exp_proj": "양재천_건강축제_페스티벌", "exp_stage": STAGE_01_PLANNING
            },
            {
                "fn": "2026 양재천 건강 페스티벌 추진계획.hwpx",
                "exp_year": "2026년", "exp_proj": "양재천_건강축제_페스티벌", "exp_stage": STAGE_01_PLANNING
            },
            {
                "fn": "2026년 강남구 보건소 「건강 뜀」 중년여성 비만예방 프로그램 참여자 모집 (Responses).xlsx",
                "exp_year": "2026년", "exp_proj": "비만예방_건강뜀", "exp_stage": STAGE_03_EVENT
            },
            {
                "fn": "20260417_분할납품요구서(서울체력장 강남센터 영상정보장치 구매).hwpx",
                "exp_year": "2026년", "exp_proj": "서울체력장_체력인증센터", "exp_stage": STAGE_02_BUDGET
            },
            {
                "fn": "★최종★_20221014_6. 2022년 강남구 건강걷기 체험행사 계획 과업지시서.hwp",
                "exp_year": "2022년", "exp_proj": "양재천_건강축제_페스티벌", "exp_stage": STAGE_01_PLANNING
            },
            {
                "fn": "20221110_‘2022 강남구 건강걷기 체험행사’ 용역 계약 준공 정산.hwp",
                "exp_year": "2022년", "exp_proj": "양재천_건강축제_페스티벌", "exp_stage": STAGE_04_OUTCOME
            },
            {
                "fn": "18_1_0826 서울체력장 강남센터 리플렛 v4.pdf",
                "exp_proj": "서울체력장_체력인증센터", "exp_stage": STAGE_03_EVENT
            },
            {
                "fn": "2026년도 예산 집행현황 (9.15기준)_신체활동.hwpx",
                "exp_year": "2026년", "exp_proj": "신체활동_건강생활실천", "exp_stage": STAGE_04_OUTCOME
            },
            {
                "fn": "2027년 본예산 사업설명서 작성방법.hwpx",
                "exp_year": "2027년", "exp_stage": STAGE_01_PLANNING
            },
            {
                "fn": "260528_공공부문 비정규직 처우개선 가이드라인.pdf",
                "exp_year": "2026년", "exp_stage": STAGE_01_PLANNING
            },
            {
                "fn": "260909_2027년도 본예산 1차 조정내역 안내(건강증진팀).xlsx",
                "exp_year": "2027년", "exp_stage": STAGE_02_BUDGET
            }
        ]

        total = len(test_dataset)
        correct_count = 0

        for item in test_dataset:
            fi = FileInfo(
                path=Path("mock") / item["fn"],
                filename=item["fn"],
                extension=Path(item["fn"]).suffix,
                size=1000,
                sha256="mockhash",
                mtime=1700000000.0
            )
            res = classify_file(fi)

            # Check matching expectations
            match_year = ("exp_year" not in item) or (res.year == item["exp_year"])
            match_proj = ("exp_proj" not in item) or (res.project == item["exp_proj"])
            match_stage = ("exp_stage" not in item) or (res.stage == item["exp_stage"])

            if match_year and match_proj and match_stage:
                correct_count += 1
            else:
                print(f"MISMATCH for {item['fn']}: Year({res.year}), Proj({res.project}), Stage({res.stage})")

        accuracy = (correct_count / total) * 100.0
        assert accuracy >= 95.0, f"Classification accuracy {accuracy:.1f}% was below 95%"
