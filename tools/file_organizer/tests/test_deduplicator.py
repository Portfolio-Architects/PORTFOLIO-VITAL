"""Unit tests for deduplication, canonical base name stripping, 0-byte guard, binary guard, and version families."""

from pathlib import Path
import pytest

from tools.file_organizer.config import EMPTY_SHA256
from tools.file_organizer.scanner.metadata_extractor import FileInfo
from tools.file_organizer.classifier.taxonomy import ClassificationResult
from tools.file_organizer.classifier.rule_engine import classify_file
from tools.file_organizer.classifier.deduplicator import (
    get_canonical_base_name,
    calculate_version_score,
    process_deduplication_and_versions
)


class TestCanonicalBaseNameStripping:
    """Tests for stripping date prefixes, attachment tags, and version suffixes."""

    @pytest.mark.parametrize("raw_name,expected_canonical", [
        (
            "(260914) 사업설명서(건강증진팀)-최종.hwpx",
            "사업설명서(건강증진팀).hwpx"
        ),
        (
            "(260914) 사업설명서(건강증진팀)-최종2.hwpx",
            "사업설명서(건강증진팀).hwpx"
        ),
        (
            "(강남구청_2026_9_17) 손목닥터9988 강남구 걷기 챌린지 시작_수정12.hwpx",
            "손목닥터9988 강남구 걷기 챌린지 시작.hwpx"
        ),
        (
            "(강남구청_2026_9_17) 손목닥터9988 강남구 걷기 챌린지 시작_최종.hwpx",
            "손목닥터9988 강남구 걷기 챌린지 시작.hwpx"
        ),
        (
            "2026 양재천 건강 페스티벌 과업내용서(최종).hwpx",
            "2026 양재천 건강 페스티벌 과업내용서.hwpx"
        ),
        (
            "2026 양재천 걷자! 건강 페스티벌 행사 청장님 보고용23.hwpx",
            "2026 양재천 걷자! 건강 페스티벌 행사.hwpx"
        ),
        (
            "★최종★_20221014_6. 2022년 강남구 건강걷기 체험행사 계획 과업지시서_1_1_1_1_1_1_1.hwp",
            "2022년 강남구 건강걷기 체험행사 계획 과업지시서.hwp"
        ),
        (
            "20221014_6. 2022년 강남구 건강걷기 체험행사 계획 과업지시서.hwp",
            "2022년 강남구 건강걷기 체험행사 계획 과업지시서.hwp"
        ),
        (
            "18_1_0826 서울체력장 강남센터 리플렛 v4.pdf",
            "서울체력장 강남센터 리플렛.pdf"
        ),
        (
            "(붙임2) 민선9기 주요사업 4개년 실행계획서(AI메디헬스).hwpx",
            "민선9기 주요사업 4개년 실행계획서(AI메디헬스).hwpx"
        ),
        (
            "(붙임1)(별표2) [2026년] 260914_과업지시서(양재천 건강 페스티벌)_최종_v2.hwpx",
            "과업지시서(양재천 건강 페스티벌).hwpx"
        ),
        (
            "[붙임1][별표1] 2026_양재천_건강페스티벌_과업지시서.hwpx",
            "양재천_건강페스티벌_과업지시서.hwpx"
        ),
        (
            "(붙임 1) (별표 2) 2026_과업지시서.hwpx",
            "과업지시서.hwpx"
        ),
        (
            "2026년_양재천_건강페스티벌_과업지시서_원안.hwpx",
            "2026년_양재천_건강페스티벌_과업지시서.hwpx"
        ),
        (
            "2026년_양재천_건강페스티벌_과업지시서_초안.hwpx",
            "2026년_양재천_건강페스티벌_과업지시서.hwpx"
        ),
        (
            "2026년_양재천_건강페스티벌_과업지시서_가안.hwpx",
            "2026년_양재천_건강페스티벌_과업지시서.hwpx"
        ),
        (
            "2026.09.16.결과보고서.최종.hwpx",
            "결과보고서.hwpx"
        ),
    ])
    def test_canonical_stripping(self, raw_name: str, expected_canonical: str):
        """Verify complex public admin filenames are stripped into identical canonical base names."""
        canonical = get_canonical_base_name(raw_name)
        assert canonical == expected_canonical


class TestGuardedDeduplication:
    """Tests for zero-byte guard, binary file guard, and true hash deduplication."""

    def test_rule_1_zero_byte_guard(self, edge_case_file_set: dict):
        """Rule 1: Empty (0-byte) files with different names MUST NEVER be consolidated as duplicates."""
        z1 = edge_case_file_set["zero1"]
        z2 = edge_case_file_set["zero2"]

        info1 = FileInfo(path=z1, filename=z1.name, extension=".txt", size=0, sha256=EMPTY_SHA256, mtime=100.0)
        info2 = FileInfo(path=z2, filename=z2.name, extension=".txt", size=0, sha256=EMPTY_SHA256, mtime=200.0)

        res1 = classify_file(info1)
        res2 = classify_file(info2)

        records = [(info1, res1), (info2, res2)]
        processed = process_deduplication_and_versions(records)

        # Assert NEITHER file is marked as duplicate
        assert processed[0][1].is_duplicate is False
        assert processed[0][1].duplicate_of is None
        assert processed[1][1].is_duplicate is False
        assert processed[1][1].duplicate_of is None

    def test_rule_2_binary_file_guard_same_size_different_content(self, edge_case_file_set: dict):
        """Rule 2: Binary files with same size but different SHA-256 hashes must NOT be marked duplicates."""
        b1 = edge_case_file_set["bin1"]
        b2 = edge_case_file_set["bin2"]

        from tools.file_organizer.scanner.metadata_extractor import compute_sha256
        h1 = compute_sha256(b1)
        h2 = compute_sha256(b2)
        assert h1 != h2

        info1 = FileInfo(path=b1, filename=b1.name, extension=".bin", size=100, sha256=h1, mtime=100.0)
        info2 = FileInfo(path=b2, filename=b2.name, extension=".bin", size=100, sha256=h2, mtime=200.0)

        res1 = classify_file(info1)
        res2 = classify_file(info2)

        records = [(info1, res1), (info2, res2)]
        processed = process_deduplication_and_versions(records)

        assert processed[0][1].is_duplicate is False
        assert processed[1][1].is_duplicate is False

    def test_exact_duplicate_deduplication(self, edge_case_file_set: dict):
        """Verify non-zero files with 100% identical SHA-256 are detected as duplicates."""
        d1 = edge_case_file_set["dup1"]
        d2 = edge_case_file_set["dup2"]

        from tools.file_organizer.scanner.metadata_extractor import compute_sha256
        sha = compute_sha256(d1)
        assert sha == compute_sha256(d2)

        info1 = FileInfo(path=d1, filename=d1.name, extension=".txt", size=len(d1.read_bytes()), sha256=sha, mtime=100.0)
        info2 = FileInfo(path=d2, filename=d2.name, extension=".txt", size=len(d2.read_bytes()), sha256=sha, mtime=200.0)

        res1 = classify_file(info1)
        res2 = classify_file(info2)

        records = [(info1, res1), (info2, res2)]
        processed = process_deduplication_and_versions(records)

        primary = [r for info, r in processed if not r.is_duplicate]
        duplicate = [r for info, r in processed if r.is_duplicate]

        assert len(primary) == 1
        assert len(duplicate) == 1
        assert duplicate[0].duplicate_of is not None
        assert "_Duplicates" in str(duplicate[0].target_rel_path)


class TestVersionClusteringAndRanking:
    """Tests for version family clustering and seniority ranking."""

    def test_version_family_clustering_and_seniority(self, edge_case_file_set: dict):
        """Verify multi-version variants sharing the same canonical base are clustered and ranked."""
        v1_path = edge_case_file_set["v1"]
        v2_path = edge_case_file_set["v2"]
        v_final_path = edge_case_file_set["v_final"]

        info_v1 = FileInfo(path=v1_path, filename=v1_path.name, extension=".hwpx", size=1000, sha256="hash1", mtime=100.0)
        info_v2 = FileInfo(path=v2_path, filename=v2_path.name, extension=".hwpx", size=1005, sha256="hash2", mtime=200.0)
        info_final = FileInfo(path=v_final_path, filename=v_final_path.name, extension=".hwpx", size=1010, sha256="hash3", mtime=300.0)

        res_v1 = classify_file(info_v1)
        res_v2 = classify_file(info_v2)
        res_final = classify_file(info_final)

        # All must have the exact same canonical base name
        assert res_v1.canonical_base == "사업설명서(건강증진팀).hwpx"
        assert res_v2.canonical_base == "사업설명서(건강증진팀).hwpx"
        assert res_final.canonical_base == "사업설명서(건강증진팀).hwpx"

        records = [(info_v1, res_v1), (info_v2, res_v2), (info_final, res_final)]
        processed = process_deduplication_and_versions(records)

        # Find which is marked as latest vs historical
        latest = [r for info, r in processed if r.is_latest_version]
        historical = [r for info, r in processed if r.is_historical_version]

        assert len(latest) == 1
        assert len(historical) == 2

        # The '최종' file must be the latest
        assert "최종" in latest[0].grounds[0] or latest[0].canonical_base in latest[0].grounds[-1]
        assert res_final.is_latest_version is True
        assert res_v1.is_historical_version is True
        assert res_v2.is_historical_version is True

    def test_version_scoring_helper(self):
        """Verify version ranking scores prioritize '최종' over 'v2' over 'v1'."""
        score_v1, _ = calculate_version_score("문서_v1.hwpx", mtime=100.0)
        score_v2, _ = calculate_version_score("문서_v2.hwpx", mtime=200.0)
        score_final, _ = calculate_version_score("문서_최종.hwpx", mtime=150.0)
        score_real_final, _ = calculate_version_score("문서_진짜최종.hwpx", mtime=150.0)

        assert score_real_final > score_final > score_v2 > score_v1

    def test_multi_version_clustering_single_latest_per_family(self):
        """Verify only ONE file has is_latest_version=True across variants with nested prefixes."""
        variants = [
            "(붙임1)(별표2) [2026년] 260914_과업지시서(양재천 건강 페스티벌)_최종_v2.hwpx",
            "[2026년] 260914_과업지시서(양재천 건강 페스티벌)_v1.hwpx",
            "과업지시서(양재천 건강 페스티벌)_최종.hwpx",
            "(붙임1) 과업지시서(양재천 건강 페스티벌).hwpx"
        ]
        records = []
        for i, fn in enumerate(variants):
            fi = FileInfo(
                path=Path(f"d:/test/{fn}"),
                filename=fn,
                extension=".hwpx",
                size=2000 + i,
                sha256=f"hash_variant_{i}",
                mtime=1726470000.0 + i,
                text_preview="2026년 양재천 건강 페스티벌 과업지시서"
            )
            res = classify_file(fi)
            records.append((fi, res))

        processed = process_deduplication_and_versions(records)

        # All 4 files must belong to the exact same family
        family_keys = {res.version_family_key for _, res in processed}
        assert len(family_keys) == 1

        # Exactly ONE file marked latest, all others marked historical
        latest = [res for _, res in processed if res.is_latest_version]
        historical = [res for _, res in processed if res.is_historical_version]
        assert len(latest) == 1
        assert len(historical) == 3

        # The authoritative latest must be the _최종_v2 file
        assert latest[0].canonical_base == "과업지시서(양재천 건강 페스티벌).hwpx"
        assert latest[0].grounds[-1].endswith("(과업지시서(양재천 건강 페스티벌).hwpx)")
        authoritative_fn = next(fi.filename for fi, res in processed if res.is_latest_version)
        assert authoritative_fn == variants[0]

    def test_draft_and_original_version_ranking(self):
        """Verify version ranking ordering: 최종 > 수정본 > 원안 > 가안 > 초안."""
        score_draft, _ = calculate_version_score("2026_사업계획서_초안.hwpx", mtime=100.0)
        score_prov, _ = calculate_version_score("2026_사업계획서_가안.hwpx", mtime=100.0)
        score_orig, _ = calculate_version_score("2026_사업계획서_원안.hwpx", mtime=100.0)
        score_rev, _ = calculate_version_score("2026_사업계획서_수정본.hwpx", mtime=100.0)
        score_final, _ = calculate_version_score("2026_사업계획서_최종.hwpx", mtime=100.0)

        assert score_final > score_rev > score_orig > score_prov > score_draft

        # Test clustering between original and draft
        fi_orig = FileInfo(
            path=Path("d:/test/2026_사업계획서_원안.hwpx"),
            filename="2026_사업계획서_원안.hwpx",
            extension=".hwpx",
            size=1500,
            sha256="hash_orig",
            mtime=100.0,
            text_preview="2026년 사업계획서 내용"
        )
        fi_draft = FileInfo(
            path=Path("d:/test/2026_사업계획서_초안.hwpx"),
            filename="2026_사업계획서_초안.hwpx",
            extension=".hwpx",
            size=1400,
            sha256="hash_draft",
            mtime=100.0,
            text_preview="2026년 사업계획서 내용"
        )
        res_orig = classify_file(fi_orig)
        res_draft = classify_file(fi_draft)

        processed = process_deduplication_and_versions([(fi_orig, res_orig), (fi_draft, res_draft)])
        latest = [fi.filename for fi, res in processed if res.is_latest_version]
        assert len(latest) == 1
        assert latest[0] == "2026_사업계획서_원안.hwpx"
