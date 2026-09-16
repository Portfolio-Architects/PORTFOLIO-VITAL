"""4-tier public administration classification rule engine.

Implements genuine logic for:
- 5-stage year cascade (4-digit -> 8-digit -> 6-digit -> body text -> path/mtime)
- 13 standard projects ontology + dynamic pattern matching
- 4 administrative phases with priority disambiguation
  (04_결과보고·정산 > 02_예산·지출 > 01_기획·품의(과업/사양) > 03_집행·행사 > 01_기획·품의(일반))
- 12 standard document types
"""

import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from tools.file_organizer.config import (
    YEAR_NORMALIZED_LIST,
    YEAR_UNKNOWN,
    RE_YEAR_4DIGIT,
    RE_YEAR_8DIGIT,
    RE_YEAR_6DIGIT,
    RE_YEAR_BODY_DATE,
    RE_YEAR_BODY_SIMPLE,
    PROJECT_ONTOLOGY,
    PROJECT_UNKNOWN,
    RE_PROJECT_BRACKETS,
    RE_PROJECT_SUFFIX,
    STAGE_01_PLANNING,
    STAGE_02_BUDGET,
    STAGE_03_EVENT,
    STAGE_04_OUTCOME,
    STAGE_UNKNOWN,
    RE_STAGE_04_OUTCOME,
    RE_STAGE_02_BUDGET,
    RE_STAGE_01_TASK_SPEC,
    RE_STAGE_01_GUIDELINE,
    RE_STAGE_03_EVENT,
    RE_STAGE_01_PLANNING,
    DOCUMENT_TYPES,
    DOC_TYPE_UNKNOWN,
    DOC_TYPE_PATTERNS
)
from tools.file_organizer.scanner.metadata_extractor import FileInfo
from tools.file_organizer.classifier.taxonomy import ClassificationResult


def extract_year(
    filename: str,
    text_preview: str = "",
    path_str: str = "",
    mtime: Optional[float] = None
) -> Tuple[str, str, float]:
    """Extract standard year string (e.g. '2026년') using 5-stage cascade.

    Returns:
        Tuple of (year_str, rationale, confidence)
    """
    # 1. Cascade Stage 1: Explicit 4-digit year in filename (2015-2035)
    match_4d = RE_YEAR_4DIGIT.search(filename)
    if match_4d:
        y_val = int(match_4d.group(1))
        if 2015 <= y_val <= 2035:
            return f"{y_val}년", f"FILENAME_4DIGIT ({y_val})", 0.98

    # 2. Cascade Stage 2: 8-digit date in filename (YYYYMMDD)
    match_8d = RE_YEAR_8DIGIT.search(filename)
    if match_8d:
        y_val = int(match_8d.group(1))
        if 2015 <= y_val <= 2035:
            return f"{y_val}년", f"FILENAME_8DIGIT_DATE ({match_8d.group(0)})", 0.95

    # 3. Cascade Stage 3: 6-digit date prefix in filename (YYMMDD -> 20YY)
    match_6d = RE_YEAR_6DIGIT.search(filename)
    if match_6d:
        yy_val = int(match_6d.group(1))
        full_year = 2000 + yy_val
        if 2015 <= full_year <= 2035:
            return f"{full_year}년", f"FILENAME_6DIGIT_PREFIX ({match_6d.group(0).strip()} -> {full_year})", 0.90

    # 4. Cascade Stage 4: Document body text preview
    if text_preview:
        # Match full dates first: YYYY.MM.DD or YYYY년 MM월 DD일
        dates = RE_YEAR_BODY_DATE.findall(text_preview)
        if dates:
            years = [int(d[0]) for d in dates if 2015 <= int(d[0]) <= 2035]
            if years:
                # Most frequent year
                best_year = max(set(years), key=years.count)
                return f"{best_year}년", f"BODY_TEXT_DATE ({best_year})", 0.85

        # Match simple YYYY년 in body text
        simple_years = RE_YEAR_BODY_SIMPLE.findall(text_preview)
        if simple_years:
            valid_years = [int(y) for y in simple_years if 2015 <= int(y) <= 2035]
            if valid_years:
                best_year = max(set(valid_years), key=valid_years.count)
                return f"{best_year}년", f"BODY_TEXT_SIMPLE_YEAR ({best_year})", 0.80

    # 5. Cascade Stage 5: Path segment inspection or mtime fallback
    if path_str:
        for y_str in YEAR_NORMALIZED_LIST:
            if y_str in path_str:
                return y_str, f"PATH_SEGMENT ({y_str})", 0.75

    if mtime is not None and mtime > 0:
        try:
            mtime_year = datetime.fromtimestamp(mtime).year
            if 2015 <= mtime_year <= 2035:
                return f"{mtime_year}년", f"MTIME_METADATA_FALLBACK ({mtime_year})", 0.60
        except Exception:
            pass

    return YEAR_UNKNOWN, "YEAR_FALLBACK_UNKNOWN", 0.20


def extract_project(
    filename: str,
    text_preview: str = "",
    path_str: str = ""
) -> Tuple[str, str, float]:
    """Extract standard project or business name using ontology scoring and dynamic regex.

    Returns:
        Tuple of (project_str, rationale, confidence)
    """
    scores: Dict[str, float] = {}
    matched_keywords: Dict[str, List[str]] = {}

    fn_lower = filename.lower()
    text_lower = text_preview.lower() if text_preview else ""
    path_lower = path_str.lower() if path_str else ""

    # 1. Ontology keyword scoring
    for proj_name, keywords in PROJECT_ONTOLOGY.items():
        total_score = 0.0
        matches = []
        for kw in keywords:
            kw_lower = kw.lower()
            kw_len = len(kw)

            # Check filename (highest weight: 4.0 * length)
            if kw_lower in fn_lower:
                weight = kw_len * 4.0
                total_score += weight
                matches.append(f"fn:{kw}")

            # Check text preview (medium weight: 1.0 * length)
            elif kw_lower in text_lower:
                weight = kw_len * 1.0
                total_score += weight
                matches.append(f"text:{kw}")

            # Check path string (weight: 2.0 * length)
            elif kw_lower in path_lower:
                weight = kw_len * 2.0
                total_score += weight
                matches.append(f"path:{kw}")

        if total_score > 0:
            scores[proj_name] = total_score
            matched_keywords[proj_name] = matches

    if scores:
        best_proj = max(scores, key=lambda p: scores[p])
        best_score = scores[best_proj]
        if best_score >= 6.0:
            conf = min(0.98, 0.70 + (best_score / 100.0))
            matches_str = ", ".join(matched_keywords[best_proj][:3])
            return best_proj, f"ONTOLOGY_MATCH ({best_proj} via {matches_str})", conf

    # 2. Dynamic bracketed project extraction: 「...」, 『...』, [...]
    bracket_matches = RE_PROJECT_BRACKETS.findall(filename)
    for bm in bracket_matches:
        cleaned_bm = bm.strip()
        # Ensure it is a valid project name candidate (not just date or attachment tag)
        if (
            len(cleaned_bm) >= 2
            and not cleaned_bm.isdigit()
            and not cleaned_bm.startswith("붙임")
            and not cleaned_bm.startswith("별표")
            and not cleaned_bm.startswith("202")
        ):
            # Check if this bracket matches any ontology alias
            for proj_name, keywords in PROJECT_ONTOLOGY.items():
                if any(kw in cleaned_bm for kw in keywords):
                    return proj_name, f"BRACKET_ONTOLOGY_MATCH ({proj_name} in '{cleaned_bm}')", 0.90

            # Valid dynamic business name
            if any(term in cleaned_bm for term in ("사업", "프로그램", "용역", "페스티벌", "센터", "뜀", "뛰움", "챌린지")):
                normalized_dynamic = re.sub(r'[\s_]+', '_', cleaned_bm)
                return normalized_dynamic, f"DYNAMIC_BRACKET_PROJECT ({cleaned_bm})", 0.82

    # 3. Dynamic suffix extraction: e.g. "비만예방_프로그램", "건강걷기_용역"
    suffix_match = RE_PROJECT_SUFFIX.search(filename)
    if suffix_match:
        candidate = suffix_match.group(1).strip()
        if len(candidate) >= 3:
            normalized_candidate = re.sub(r'[\s_]+', '_', candidate)
            return normalized_candidate, f"DYNAMIC_SUFFIX_PROJECT ({candidate})", 0.78

    # 4. Check if path already contains a project directory
    if path_str:
        for proj_name in PROJECT_ONTOLOGY.keys():
            if proj_name in path_str:
                return proj_name, f"PATH_PROJECT_MATCH ({proj_name})", 0.80

    # 5. Fallback
    return PROJECT_UNKNOWN, "PROJECT_FALLBACK_DEFAULT", 0.35


def extract_stage(
    filename: str,
    text_preview: str = ""
) -> Tuple[str, str, float]:
    """Extract administrative stage with strict priority disambiguation.

    Disambiguation Priority:
    1. 04_결과보고·정산 (Highest priority: outcome, settlement, completion, inspection)
    2. 02_예산·지출 (Second priority: budget, quotes, contracts, payment demands)
    3. 01_기획·품의 (Task/Specification priority: 과업지시서, 사양서, RFP)
    4. 03_집행·행사 (Execution/Event: scripts, rosters, flyers, surveys, checklists)
    5. 01_기획·품의 (General planning: comprehensive plans, approvals, guidelines)

    Returns:
        Tuple of (stage_str, rationale, confidence)
    """
    # Check filename matches first (filename is most authoritative)
    # Stage 4 check (Outcome & Settlement)
    m4 = RE_STAGE_04_OUTCOME.search(filename)
    if m4:
        return STAGE_04_OUTCOME, f"FILENAME_OUTCOME_PRIORITY ({m4.group(0)})", 0.98

    # Stage 1 Guideline / Manual check (Guideline/Manual takes priority over budget/event words)
    m_guide = RE_STAGE_01_GUIDELINE.search(filename)
    if m_guide:
        return STAGE_01_PLANNING, f"FILENAME_GUIDELINE_PLANNING ({m_guide.group(0)})", 0.95

    # Stage 2 check (Budget & Expenditure)
    m2 = RE_STAGE_02_BUDGET.search(filename)
    if m2:
        return STAGE_02_BUDGET, f"FILENAME_BUDGET_PRIORITY ({m2.group(0)})", 0.95

    # Stage 1 Task Spec check (Task specification / RFP takes priority over event)
    m1_spec = RE_STAGE_01_TASK_SPEC.search(filename)
    if m1_spec:
        return STAGE_01_PLANNING, f"FILENAME_TASK_SPEC_PRIORITY ({m1_spec.group(0)})", 0.95

    # Stage 3 check (Execution & Event)
    m3 = RE_STAGE_03_EVENT.search(filename)
    if m3:
        return STAGE_03_EVENT, f"FILENAME_EVENT_PRIORITY ({m3.group(0)})", 0.92

    # Stage 1 General Planning check
    m1_plan = RE_STAGE_01_PLANNING.search(filename)
    if m1_plan:
        return STAGE_01_PLANNING, f"FILENAME_PLANNING_APPROVAL ({m1_plan.group(0)})", 0.90

    # If filename didn't match, check text preview with the same strict priority
    if text_preview:
        t4 = RE_STAGE_04_OUTCOME.search(text_preview)
        if t4:
            return STAGE_04_OUTCOME, f"TEXT_OUTCOME_PRIORITY ({t4.group(0)})", 0.85

        t2 = RE_STAGE_02_BUDGET.search(text_preview)
        if t2:
            return STAGE_02_BUDGET, f"TEXT_BUDGET_PRIORITY ({t2.group(0)})", 0.85

        t1_spec = RE_STAGE_01_TASK_SPEC.search(text_preview)
        if t1_spec:
            return STAGE_01_PLANNING, f"TEXT_TASK_SPEC_PRIORITY ({t1_spec.group(0)})", 0.85

        t3 = RE_STAGE_03_EVENT.search(text_preview)
        if t3:
            return STAGE_03_EVENT, f"TEXT_EVENT_PRIORITY ({t3.group(0)})", 0.80

        t1_plan = RE_STAGE_01_PLANNING.search(text_preview)
        if t1_plan:
            return STAGE_01_PLANNING, f"TEXT_PLANNING_PRIORITY ({t1_plan.group(0)})", 0.80

    # Default fallback
    return STAGE_UNKNOWN, "STAGE_FALLBACK_DEFAULT", 0.40


def extract_doc_type(
    filename: str,
    text_preview: str = "",
    stage: str = ""
) -> Tuple[str, str, float]:
    """Extract standard document type from filename, text preview, or stage context.

    Returns:
        Tuple of (doc_type_str, rationale, confidence)
    """
    # 1. Match against filename first
    for dt, pattern in DOC_TYPE_PATTERNS.items():
        m = pattern.search(filename)
        if m:
            return dt, f"FILENAME_DOC_TYPE ({dt} via '{m.group(0)}')", 0.95

    # 2. Match against text preview
    if text_preview:
        for dt, pattern in DOC_TYPE_PATTERNS.items():
            m = pattern.search(text_preview)
            if m:
                return dt, f"TEXT_DOC_TYPE ({dt} via '{m.group(0)}')", 0.85

    # 3. Contextual deduction from stage
    if stage == STAGE_04_OUTCOME:
        if any(term in filename for term in ("정산", "결산", "준공")):
            return "정산_결산서", "STAGE_OUTCOME_DEDUCTION (정산_결산서)", 0.80
        return "결과보고서", "STAGE_OUTCOME_DEDUCTION (결과보고서)", 0.80
    elif stage == STAGE_02_BUDGET:
        if any(term in filename for term in ("견적", "산출내역")):
            return "견적서", "STAGE_BUDGET_DEDUCTION (견적서)", 0.80
        if any(term in filename for term in ("설명서", "편성")):
            return "사업설명서", "STAGE_BUDGET_DEDUCTION (사업설명서)", 0.80
        return "계약_지출서류", "STAGE_BUDGET_DEDUCTION (계약_지출서류)", 0.75
    elif stage == STAGE_03_EVENT:
        if any(term in filename for term in ("명단", "대장", "설문", "명부")):
            return "서식_명단", "STAGE_EVENT_DEDUCTION (서식_명단)", 0.80
        return "홍보_행사자료", "STAGE_EVENT_DEDUCTION (홍보_행사자료)", 0.75
    elif stage == STAGE_01_PLANNING:
        if any(term in filename for term in ("과업", "사양", "규격")):
            return "과업지시서", "STAGE_PLANNING_DEDUCTION (과업지시서)", 0.85
        if any(term in filename for term in ("기안", "품의", "방침", "보고")):
            return "기안_품의서", "STAGE_PLANNING_DEDUCTION (기안_품의서)", 0.80
        return "계획서", "STAGE_PLANNING_DEDUCTION (계획서)", 0.75

    return DOC_TYPE_UNKNOWN, "DOC_TYPE_FALLBACK_DEFAULT", 0.40


def classify_file(file_info: FileInfo) -> ClassificationResult:
    """Classify a single FileInfo into the full 4-tier public administration taxonomy.

    Produces a complete ClassificationResult with canonical base name, confidence,
    grounds, and computed relative destination path.
    """
    from tools.file_organizer.classifier.deduplicator import get_canonical_base_name

    fn = file_info.filename
    tp = file_info.text_preview
    path_str = str(file_info.path)
    mtime = file_info.mtime

    # 1. Level 1: Year
    year, year_rat, year_conf = extract_year(fn, text_preview=tp, path_str=path_str, mtime=mtime)

    # 2. Level 2: Project
    project, proj_rat, proj_conf = extract_project(fn, text_preview=tp, path_str=path_str)

    # 3. Level 3: Stage
    stage, stage_rat, stage_conf = extract_stage(fn, text_preview=tp)

    # 4. Level 4: Document Type
    doc_type, dt_rat, dt_conf = extract_doc_type(fn, text_preview=tp, stage=stage)

    # 5. Canonical base name
    canonical_base = get_canonical_base_name(fn)

    # 6. Grounds and overall confidence
    grounds = [
        f"Level 1 [연도별]: {year} <- {year_rat}",
        f"Level 2 [사업별]: {project} <- {proj_rat}",
        f"Level 3 [업무단계]: {stage} <- {stage_rat}",
        f"Level 4 [문서유형]: {doc_type} <- {dt_rat}",
    ]
    avg_conf = (year_conf + proj_conf + stage_conf + dt_conf) / 4.0

    result = ClassificationResult(
        year=year,
        project=project,
        stage=stage,
        doc_type=doc_type,
        canonical_base=canonical_base,
        is_duplicate=False,
        duplicate_of=None,
        is_latest_version=True,
        is_historical_version=False,
        confidence=avg_conf,
        grounds=grounds,
        status_flags=list(file_info.status_flags)
    )

    # Compute target path
    result.compute_target_rel_path(filename=fn)

    return result
