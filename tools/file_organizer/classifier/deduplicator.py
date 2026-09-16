"""Safe deduplication, version canonicalization, and version family clustering.

Implements strict public administration safety rules:
- Rule 1 (0-Byte Guard): Empty files (0 bytes) are NEVER consolidated as duplicates.
- Rule 2 (Binary Guard): Binary files are ONLY treated as duplicates if SHA-256 matches 100%.
- Rule 3 (Version Canonicalization): Recursive stripping of date prefixes and version tags
  into canonical_base_name.
- Rule 4 (Version Family Ranking): Deterministic ranking of version variants by administrative
  seniority (최종 > 확정 > 제출 > 수정) and timestamp.
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from tools.file_organizer.config import (
    EMPTY_SHA256,
    BINARY_MEDIA_EXTENSIONS,
    RE_DATE_PREFIX,
    RE_ATTACHMENT_PREFIX,
    RE_VERSION_STRIP,
    VERSION_RANKING_WEIGHTS
)
from tools.file_organizer.scanner.metadata_extractor import FileInfo
from tools.file_organizer.classifier.taxonomy import ClassificationResult


def get_canonical_base_name(filename: str) -> str:
    """Derive clean canonical base name by recursively stripping date prefixes and version tags.

    Examples:
        - "(260914) 사업설명서(건강증진팀)-최종2.hwpx" -> "사업설명서(건강증진팀).hwpx"
        - "2026 양재천 건강 페스티벌 과업내용서(최종).hwpx" -> "2026 양재천 건강 페스티벌 과업내용서.hwpx"
        - "손목닥터9988 강남구 걷기 챌린지 시작_수정12.hwpx" -> "손목닥터9988 강남구 걷기 챌린지 시작.hwpx"
        - "★최종★_20221014_6. 2022년 강남구 건강걷기 체험행사 계획 과업지시서_1_1.hwp"
          -> "2022년 강남구 건강걷기 체험행사 계획 과업지시서.hwp"
    """
    stem, ext = os.path.splitext(filename)
    original_stem = stem

    # Strip nested prefixes (attachment tags, dates, sequence numbers, asterisks, brackets)
    prev_stem = None
    loop_cnt = 0
    while prev_stem != stem and loop_cnt < 10:
        prev_stem = stem
        stem = RE_ATTACHMENT_PREFIX.sub('', stem).strip()
        stem = RE_DATE_PREFIX.sub('', stem).strip()
        stem = re.sub(r'^(?:\d+[_])+\d*\s*', '', stem).strip()
        stem = re.sub(r'^\d+\.\s*', '', stem).strip()
        stem = re.sub(r'^[\.\_\-\s]+', '', stem).strip()
        loop_cnt += 1

    # Recursively strip trailing version suffixes (e.g. _최종_v2, _수정본_최종)
    prev_ver = None
    ver_loop = 0
    while prev_ver != stem and ver_loop < 10:
        prev_ver = stem
        stem = RE_VERSION_STRIP.sub('', stem).strip()
        ver_loop += 1

    # Cleanup dangling punctuation, spaces, underscores, hyphens, and dots
    stem = re.sub(r'[\s_\-\.]+$', '', stem).strip()

    if not stem:
        # Avoid producing empty name
        stem = original_stem

    return f"{stem}{ext.lower()}"


def calculate_version_score(filename: str, mtime: float) -> Tuple[int, float]:
    """Calculate version seniority score based on administrative tags and file mtime.

    Higher score means more authoritative/newer version.
    """
    fn_lower = filename.lower()
    score = 100

    # Match predefined weights
    for tag, weight in VERSION_RANKING_WEIGHTS.items():
        if tag in fn_lower:
            score = max(score, weight)

    # Check explicit version numbers like v2, v3, v0.1
    v_match = re.search(r'v(\d+(?:\.\d+)?)', fn_lower)
    if v_match:
        try:
            v_val = float(v_match.group(1))
            score += int(v_val * 20)
        except Exception:
            pass

    # Check numeric revisions like 수정1, 수정2
    rev_match = re.search(r'수정\s*(\d+)', fn_lower)
    if rev_match:
        try:
            rev_num = int(rev_match.group(1))
            score += rev_num * 10
        except Exception:
            pass

    return (score, mtime)


def process_deduplication_and_versions(
    records: List[Tuple[FileInfo, ClassificationResult]]
) -> List[Tuple[FileInfo, ClassificationResult]]:
    """Cluster files into version families and detect true duplicate files.

    Strictly applies:
    - 0-Byte Guard: size == 0 files are never consolidated as duplicates.
    - Binary Guard: binary files only deduplicated on exact SHA-256 match.
    - Version Family Clustering: files with same (year, project, canonical_base) are grouped,
      with the authoritative latest version marked.
    """
    if not records:
        return []

    # 1. Exact SHA-256 Deduplication Grouping (Guarded)
    # Map non-empty SHA-256 to list of (FileInfo, ClassificationResult)
    hash_groups: Dict[str, List[Tuple[FileInfo, ClassificationResult]]] = {}

    for info, res in records:
        # Rule 1: 0-Byte Guard
        if info.size == 0 or info.sha256 == EMPTY_SHA256 or not info.sha256:
            # 0-byte files are never added to hash groups for duplicate consolidation
            continue

        # Rule 2: Binary file guard - binary files have same hash_groups treatment (exact SHA-256 only)
        hash_groups.setdefault(info.sha256, []).append((info, res))

    # Evaluate exact duplicates
    for sha, group in hash_groups.items():
        if len(group) > 1:
            # Pick primary: prefer shortest path string, tie break with newest mtime
            group.sort(key=lambda item: (len(str(item[0].path)), -item[0].mtime))
            primary_info, primary_res = group[0]
            primary_res.is_duplicate = False
            primary_res.duplicate_of = None

            for dup_info, dup_res in group[1:]:
                dup_res.is_duplicate = True
                dup_res.duplicate_of = str(primary_info.path)
                dup_res.grounds.append(
                    f"DUPLICATE_OF: {primary_info.path} (SHA-256: {sha[:12]}... matched 100%)"
                )
                dup_res.status_flags.append("EXACT_DUPLICATE")
                # Update target path to route into _Duplicates
                dup_res.compute_target_rel_path(filename=dup_info.filename)

    # 2. Version Family Clustering
    # Group by (year, project, canonical_base)
    family_groups: Dict[str, List[Tuple[FileInfo, ClassificationResult]]] = {}

    for info, res in records:
        fam_key = f"{res.year}|{res.project}|{res.canonical_base.lower()}"
        res.version_family_key = fam_key
        family_groups.setdefault(fam_key, []).append((info, res))

    for fam_key, fam_list in family_groups.items():
        if len(fam_list) == 1:
            info, res = fam_list[0]
            res.is_latest_version = True
            res.is_historical_version = False
        else:
            # Multiple versions in family
            # Filter out items that are already exact duplicates of another
            # Sort by version score descending
            fam_list.sort(
                key=lambda item: calculate_version_score(item[0].filename, item[0].mtime),
                reverse=True
            )

            # Mark the top item as latest version
            latest_info, latest_res = fam_list[0]
            latest_res.is_latest_version = True
            latest_res.is_historical_version = False
            latest_res.grounds.append(
                f"VERSION_FAMILY: Authoritative latest of {len(fam_list)} variants ({latest_res.canonical_base})"
            )

            # Mark remaining items as historical revisions
            for hist_info, hist_res in fam_list[1:]:
                hist_res.is_latest_version = False
                hist_res.is_historical_version = True
                hist_res.grounds.append(
                    f"VERSION_FAMILY: Historical variant of {latest_info.filename}"
                )
                hist_res.status_flags.append("HISTORICAL_VERSION")

    return records
