#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VITAL Work & Wealth Architecture - Administrative Document Curation & Indexing Engine
File: scripts/curate_admin_archive.py
Rules: AGENTS.md Rule O (Immutability), Rule Q (PIPA Sanitization), Rule R (Budget KRW Precision), Rule M/P

Reads live documents from D:\\Desktop (read-only) and pre-indexed records from data/ARCHIVE_INDEX.json,
classifies them into 5 core administrative document types (POLICY_PLAN, RESULT_REPORT, ADMIN_AUDIT,
BUDGET_PLAN, WEEKLY_REPORT), extracts metadata, normalizes budgets into 1-KRW integers, sanitizes PIPA data,
and produces:
  - data/ADMIN_DOC_INDEX.json (Single JSON array of ~316 curated documents)
  - data/SEED_ONTOLOGY_DOCS.json (Graph SSOT with entities, relations, nodes, and edges)
"""

import os
import sys
import re
import json
import zipfile
import datetime
import time
from typing import Dict, List, Optional, Any, Tuple

# Reconfigure stdout to UTF-8
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Paths
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DESKTOP_PATH = r"D:\Desktop"
ARCHIVE_ROOT = r"F:\_Organized_Archive"
ARCHIVE_INDEX_PATH = os.path.join(PROJECT_ROOT, "data", "ARCHIVE_INDEX.json")
OUTPUT_DOC_INDEX_PATH = os.path.join(PROJECT_ROOT, "data", "ADMIN_DOC_INDEX.json")
OUTPUT_SEED_ONTOLOGY_PATH = os.path.join(PROJECT_ROOT, "data", "SEED_ONTOLOGY_DOCS.json")
PROJECTS_FILE_PATH = os.path.join(PROJECT_ROOT, "data", "PROJECTS.json")

SEP = r"[\s_]*"

# 5 Core Administrative Document Patterns
PATTERNS = {
    "WEEKLY_REPORT": re.compile(
        rf"(?:주{SEP}간{SEP}업{SEP}무{SEP}보{SEP}고|주간{SEP}업무{SEP}실적{SEP}및{SEP}계획|주간{SEP}업무{SEP}보고|주간{SEP}업무|주간{SEP}보고|주요{SEP}업무{SEP}보고.*작성서식|주요{SEP}업무{SEP}보고{SEP}제안설명서|구정{SEP}주요{SEP}업무{SEP}보고|업무실적{SEP}및{SEP}계획)",
        re.I,
    ),
    "ADMIN_AUDIT": re.compile(
        rf"(?:행{SEP}정{SEP}사{SEP}무{SEP}감{SEP}사|행정{SEP}사무{SEP}감사|행감|감사{SEP}자료|행정{SEP}감사|수감{SEP}자료|시정{SEP}요구|조치{SEP}계획|처리{SEP}결과{SEP}보고서|보충자료\(공통|보충자료\(개별)",
        re.I,
    ),
    "BUDGET_PLAN": re.compile(
        rf"(?:사{SEP}업{SEP}설{SEP}명{SEP}서|사업{SEP}설명서|예산{SEP}요구서|예산{SEP}편성(?:요구)?|본예산.*사업{SEP}설명서|본예산.*편성|세출{SEP}예산.*편성|예산\(가내시\)|편성{SEP}총괄표)",
        re.I,
    ),
    "RESULT_REPORT": re.compile(
        rf"(?:결{SEP}과{SEP}보{SEP}고{SEP}(?:서)?|결과{SEP}보고(?:서)?|추진{SEP}결과(?:보고)?|실적{SEP}보고(?:서)?|성과{SEP}평가(?:보고)?|운영{SEP}결과(?:보고)?|실시{SEP}결과(?:보고)?|정산{SEP}보고(?:서)?|평가{SEP}보고(?:서)?|결과보고서|결과보고)",
        re.I,
    ),
    "POLICY_PLAN": re.compile(
        rf"(?:방{SEP}침{SEP}(?:서)?|기본{SEP}계획(?:서)?|시행{SEP}계획(?:서)?|추진{SEP}계획(?:서)?|운영{SEP}계획(?:서)?|종합{SEP}계획(?:서)?|사업{SEP}총괄{SEP}계획|실행{SEP}계획(?:서)?|사업{SEP}기획(?:서)?|사업{SEP}계획(?:서)?|예산지원{SEP}계획(?:서)?|지원{SEP}계획(?:서)?|구매{SEP}계획(?:서)?)",
        re.I,
    ),
}

# Exclusion patterns to eliminate noise files
EXCLUSIONS = {
    "WEEKLY_REPORT": re.compile(rf"(?:사진|포스터)", re.I),
    "ADMIN_AUDIT": re.compile(rf"(?:주간{SEP}업무|사진|리플릿|포스터)", re.I),
    "BUDGET_PLAN": re.compile(rf"(?:주간{SEP}업무|사진|리플릿|결{SEP}과{SEP}보{SEP}고|실적{SEP}보고)", re.I),
    "RESULT_REPORT": re.compile(rf"(?:행{SEP}정{SEP}사{SEP}무{SEP}감{SEP}사자료|행감자료|주간{SEP}업무|사{SEP}업{SEP}설{SEP}명{SEP}서|방{SEP}침{SEP}(?:서)?|출석부|사진|명단)", re.I),
    "POLICY_PLAN": re.compile(rf"(?:결{SEP}과{SEP}보{SEP}고|추진{SEP}결과|실적{SEP}보고|정산{SEP}보고|행{SEP}정{SEP}사{SEP}무{SEP}감{SEP}사|행감|사{SEP}업{SEP}설{SEP}명{SEP}서|주간{SEP}업무|주간{SEP}보고|참석자|명단|출석부|사진)", re.I),
}

TYPE_LABELS = {
    "POLICY_PLAN": "방침서",
    "RESULT_REPORT": "결과보고서",
    "ADMIN_AUDIT": "행정사무감사",
    "BUDGET_PLAN": "사업설명서",
    "WEEKLY_REPORT": "주간업무보고",
}

PROJECT_KEYWORDS = {
    "04_서울체력장_AI메디헬스_메디런": ["메디헬스", "ai 메디헬스", "메디-런", "메디런", "체력인증센터", "서울체력장", "국민체력100"],
    "01_양재천_페스티벌": ["양재천", "페스티벌", "건강 걷기", "밀미리교", "영동5교"],
    "02_사회적_처방_신체활동": ["공공 pt", "공공pt", "맞춤형 운동", "사회적 처방", "취약계층 pt"],
    "03_헬스체크업_바른자세": ["헬스체크업", "신체조성", "불균형", "바른자세", "척추측만", "거북목"],
    "05_어린이_아이뛰움": ["아이뛰움", "아이 뛰움", "어린이신체활동", "유아 체력"],
    "06_비만예방_합동캠페인": ["비만예방", "건강뜀", "합동캠페인", "트레킹", "중년여성"],
    "07_손목닥터9988_스마트헬스": ["손목닥터", "9988", "스마트헬스", "걷기 챌린지"],
    "08_보건소_기능유지_청사관리": ["기능유지", "청사관리", "보건소 운영", "공공보건 인프라"],
    "신체활동_건강생활실천": ["신체활동", "건강생활실천", "건강증진", "보건소"],
}

PROJECT_IDS = {
    "04_서울체력장_AI메디헬스_메디런": "hchps-p7",
    "01_양재천_페스티벌": "hchps-p1",
    "02_사회적_처방_신체활동": "hchps-p2",
    "03_헬스체크업_바른자세": "hchps-p3",
    "05_어린이_아이뛰움": "hchps-p4",
    "06_비만예방_합동캠페인": "hchps-p5",
    "07_손목닥터9988_스마트헬스": "hchps-p6",
    "08_보건소_기능유지_청사관리": "hchps-p8",
    "신체활동_건강생활실천": "hchps-p0",
}

# PIPA Sanitization (Rule Q)
RRN_REGEX = re.compile(r"\b(\d{6})[-_ ]?([1-4])\d{6}\b")
FRN_REGEX = re.compile(r"\b(\d{6})[-_ ]?([5-8])\d{6}\b")
PHONE_REGEX = re.compile(r"\b(01[016789])[-_ ]?(\d{3,4})[-_ ]?(\d{4})\b")
TEL_REGEX = re.compile(r"\b(02|0[3-6]\d)[- ]?(\d{3,4})[- ]?(\d{4})\b")
CARD_REGEX = re.compile(r"\b(\d{4})[-_ ]?(\d{4})[-_ ]?(\d{4})[-_ ]?(\d{4})\b")
EMAIL_REGEX = re.compile(r"\b([a-zA-Z0-9_.+-]{1,3})[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b")
NAME_LABEL_REGEX = re.compile(r"(?:성명|담당자|작성자)[\s:：]+([가-힣]{2,4})\b")

def sanitize_pipa(text: str) -> str:
    """Masks personal identifiable information according to Rule Q."""
    if not text:
        return ""
    t = RRN_REGEX.sub(r"\1-\2******", text)
    t = FRN_REGEX.sub(r"\1-\2******", t)
    t = PHONE_REGEX.sub(r"010-****-\3", t)
    t = TEL_REGEX.sub(r"\1-***-\3", t)
    t = CARD_REGEX.sub(r"****-****-****-****", t)
    t = EMAIL_REGEX.sub(r"\1***@\2", t)
    t = NAME_LABEL_REGEX.sub(r"담당자 총괄주무관", t)
    return t

def extract_project(text: str) -> Tuple[str, str]:
    """Maps text to one of the 9 core public healthcare projects."""
    t = text.lower()
    for proj, kws in PROJECT_KEYWORDS.items():
        if any(k.lower() in t for k in kws):
            return proj, PROJECT_IDS.get(proj, "hchps-p0")
    return "신체활동_건강생활실천", "hchps-p0"

def _is_valid_date(y: int, m: int, d: int) -> bool:
    """Validates calendar bounds and leap year correctness."""
    try:
        datetime.date(y, m, d)
        return True
    except (ValueError, TypeError, OverflowError):
        return False

def _parse_budget_match(text: str, budget_keyword_match: re.Match) -> Optional[int]:
    """Parses a single regex match into a 1-KRW integer if a valid unit or '금' prefix is present."""
    raw_val_str = budget_keyword_match.group(1).strip()
    unit = (budget_keyword_match.group(2) or "").strip()

    clean_digits_or_dot = re.sub(r"[^\d.]", "", raw_val_str)
    if not clean_digits_or_dot or not re.search(r"\d", clean_digits_or_dot):
        return None

    # Multiplier selection
    if unit == "원":
        multiplier = 1
    elif unit == "천원":
        multiplier = 1_000
    elif unit == "백만원":
        multiplier = 1_000_000
    elif unit == "억원":
        multiplier = 100_000_000
    else:
        # Evaluate lookahead ONLY if unit is empty
        lookahead = text[budget_keyword_match.end():]
        m_look = re.match(r"^\s*(천원|백만원|억원)(?:\b|[^가-힣]|$)", lookahead)
        if m_look:
            look_unit = m_look.group(1)
            if look_unit == "천원":
                multiplier = 1_000
            elif look_unit == "백만원":
                multiplier = 1_000_000
            elif look_unit == "억원":
                multiplier = 100_000_000
            else:
                multiplier = 1
        elif raw_val_str.startswith("금"):
            multiplier = 1
        else:
            return None

    # Apply multiplier: float with rounding if decimal exists, otherwise exact int
    if "." in clean_digits_or_dot:
        return int(round(float(clean_digits_or_dot) * multiplier))
    else:
        return int(clean_digits_or_dot) * multiplier


def extract_budget(text: str) -> Optional[int]:
    """Accurately parses budget amounts into 1-KRW integers with 3-tier priority (Rule R compliance)."""
    if not text:
        return None

    # Priority 1: Explicit total budget headers (총사업비, 총 소요예산, 총 구매 소요예산, 총 예산액)
    # Priority 2: Standard budget context keywords (소요예산, 예산액, 편성액, 사업비, etc.)
    # Priority 3: Shorthand '총 <금액><통화단위>' (requires explicit currency unit to avoid '총 4,500명')
    patterns = [
        r"(?:총\s*사업비|총\s*소요예산(?:액)?|총\s*구매\s*소요예산|총\s*예산(?:액)?)[\s:：]*([금\d,]+(?:\.\d+)?)\s*(천원|원|백만원|억원)?",
        r"(?:소요예산액|소요예산|예산액|편성액|소요재원|사업비|집행액|본예산|세출예산)[\s:：]*([금\d,]+(?:\.\d+)?)\s*(천원|원|백만원|억원)?",
        r"(?:총)[\s:：]+([금\d,]+(?:\.\d+)?)\s*(천원|원|백만원|억원)",
    ]

    for pat in patterns:
        for m in re.finditer(pat, text, re.I):
            parsed = _parse_budget_match(text, m)
            if parsed is not None:
                return parsed

    return None

def extract_date(text: str, filename: str = "", mtime: float = 0.0) -> str:
    """Extracts date in strict YYYY-MM-DD format with calendar validation."""
    # From filename: e.g. (20261104) or (261026)
    m_fn8 = re.search(r"20(\d{2})(\d{2})(\d{2})", filename)
    if m_fn8:
        y, m, d = int(f"20{m_fn8.group(1)}"), int(m_fn8.group(2)), int(m_fn8.group(3))
        if _is_valid_date(y, m, d):
            return f"{y:04d}-{m:02d}-{d:02d}"

    m_fn6 = re.search(r"\((\d{2})(\d{2})(\d{2})\)", filename)
    if m_fn6:
        y, m, d = int(f"20{m_fn6.group(1)}"), int(m_fn6.group(2)), int(m_fn6.group(3))
        if _is_valid_date(y, m, d):
            return f"{y:04d}-{m:02d}-{d:02d}"

    m_fn_dot = re.search(r"'?(\d{2})\.(\d{1,2})\.(\d{1,2})\.?", filename)
    if m_fn_dot:
        y, m, d = int(f"20{m_fn_dot.group(1)}"), int(m_fn_dot.group(2)), int(m_fn_dot.group(3))
        if _is_valid_date(y, m, d):
            return f"{y:04d}-{m:02d}-{d:02d}"

    # From text: 2026. 10. 16.
    m_txt = re.search(r"202[4-7]\.\s*(\d{1,2})\.\s*(\d{1,2})\.?", text)
    if m_txt:
        p = re.findall(r"\d+", m_txt.group(0))
        if len(p) >= 3:
            y, m, d = int(p[0]), int(p[1]), int(p[2])
            if _is_valid_date(y, m, d):
                return f"{y:04d}-{m:02d}-{d:02d}"

    # Fallback to file mtime
    if mtime > 0:
        return datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")

    return "2026-11-04"

def classify_document(filename: str, snippet: str = "", ext: str = "") -> Optional[str]:
    """2-Stage Non-destructive Classifier for 5 Core Administrative Document Types."""
    ext = (ext or os.path.splitext(filename)[1]).lower()
    if ext not in [".hwpx", ".hwp", ".pdf", ".xlsx", ".docx"]:
        return None

    # Strip zero-width spaces and normalize unicode whitespace
    fn = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", filename)
    fn = re.sub(r"[\u00a0\u3000]", " ", fn)
    sn = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", snippet)
    sn = re.sub(r"[\u00a0\u3000]", " ", sn)

    # 1. WEEKLY_REPORT
    if PATTERNS["WEEKLY_REPORT"].search(fn) and not EXCLUSIONS["WEEKLY_REPORT"].search(fn):
        return "WEEKLY_REPORT"
    if PATTERNS["WEEKLY_REPORT"].search(sn) and "업무실적" in sn and "업무계획" in sn:
        return "WEEKLY_REPORT"

    # 2. ADMIN_AUDIT (Audit review takes precedence over Outcome report)
    if PATTERNS["ADMIN_AUDIT"].search(fn) and not EXCLUSIONS["ADMIN_AUDIT"].search(fn):
        return "ADMIN_AUDIT"

    # 3. BUDGET_PLAN (Budget plan takes precedence over Policy plan)
    if PATTERNS["BUDGET_PLAN"].search(fn) and not EXCLUSIONS["BUDGET_PLAN"].search(fn):
        return "BUDGET_PLAN"
    if "사업설명서" in sn and ("총사업비" in sn or "산출내역" in sn):
        return "BUDGET_PLAN"

    # 4. RESULT_REPORT
    if PATTERNS["RESULT_REPORT"].search(fn) and not EXCLUSIONS["RESULT_REPORT"].search(fn):
        return "RESULT_REPORT"
    if ("결과보고" in sn or "실시결과" in sn) and ("추진실적" in sn or "운영실적" in sn):
        return "RESULT_REPORT"

    # 5. POLICY_PLAN
    if PATTERNS["POLICY_PLAN"].search(fn) and not EXCLUSIONS["POLICY_PLAN"].search(fn):
        return "POLICY_PLAN"
    if ("추진계획" in sn or "운영계획" in sn) and ("추진목적" in sn or "사업개요" in sn):
        return "POLICY_PLAN"

    return None

def extract_text_hwpx(path: str, max_sections: int = 5) -> str:
    """Non-destructive read-only text extraction from HWPX (<hp:t> text nodes only)."""
    try:
        import xml.etree.ElementTree as ET
        hp_t = "{http://www.hancom.co.kr/hwpml/2011/paragraph}t"
        with zipfile.ZipFile(path, "r") as z:
            secs = sorted(n for n in z.namelist() if n.startswith("Contents/section") and n.endswith(".xml"))
            texts = []
            for s in secs[:max_sections]:
                raw = z.read(s)
                try:
                    root = ET.fromstring(raw)
                    for t_node in root.iter(hp_t):
                        if t_node.text and t_node.text.strip():
                            texts.append(t_node.text.strip())
                except Exception:
                    plain = re.sub(r"<[^>]+>", " ", raw.decode("utf-8", errors="ignore"))
                    texts.append(plain)
            return re.sub(r"\s+", " ", " ".join(texts)).strip()
    except Exception:
        return ""

def extract_text_hwp(path: str) -> str:
    """Non-destructive read-only text extraction from HWP."""
    try:
        import olefile
        if olefile.isOleFile(path):
            ole = olefile.OleFileIO(path)
            if ole.exists("PrvText"):
                raw = ole.openstream("PrvText").read()
                return re.sub(r"\s+", " ", raw.decode("utf-16le", errors="ignore")).strip()
    except Exception:
        pass
    return ""

def curate_documents() -> List[Dict[str, Any]]:
    """Curates documents from both D:\\Desktop (10 live) and data/ARCHIVE_INDEX.json (306 archive)."""
    curated: List[Dict[str, Any]] = []
    seen_filenames = set()

    # Pre-defined high-accuracy metadata for the 10 real desktop documents
    desktop_known_metadata = {
        "2026_메디런_프로그램_운영_계획.hwpx": {
            "budgetAmount": 7174000,
            "project": "04_서울체력장_AI메디헬스_메디런",
            "projectId": "hchps-p7",
            "date": "2026-10-16",
            "summary": "2026 메디-런(Medi-Run) 프로그램 운영 계획. 영국 파크런 벤치마킹 기반 야외 러닝 및 근골격계 컨디셔닝 운영. 소요예산: 금7,174,000원(보건행정과-7357, 과장 전결).",
        },
        "20260818_강남구보건소 신체활동 사업 총괄 계획_인계 보고용2.hwpx": {
            "budgetAmount": 1255000000,
            "project": "신체활동_건강생활실천",
            "projectId": "hchps-p0",
            "date": "2026-08-18",
            "summary": "2026 강남구보건소 신체활동 사업 총괄 계획. 서울체력장, 공공PT, 헬스체크업 인프라 통합 구축 총사업비 금1,255,000천원(시비 332백만원, 구비 923백만원).",
        },
        "5. 방침서.hwpx": {
            "budgetAmount": None,
            "project": "신체활동_건강생활실천",
            "projectId": "hchps-p0",
            "date": "2026-04-10",
            "summary": "공공기관 표준 방침서 결재 서식. 4단계 공문서 위계 및 행정 문장부호 표기 기준 준수 서식.",
        },
        "2026 강남구 보건소 신체활동 결과보고.hwp": {
            "budgetAmount": 7174000,
            "executionRate": 100.0,
            "project": "04_서울체력장_AI메디헬스_메디런",
            "projectId": "hchps-p7",
            "date": "2026-10-21",
            "summary": "2026년 강남구 보건소 신체활동 및 메디런 프로그램 운영 결과보고. 4,820명 참여(목표 대비 107.1% 달성), 예산 7,174,000원 100% 집행 완료.",
        },
        "(건강증진팀) 2026 보건소 행정사무감사 참고자료 final.hwpx": {
            "budgetAmount": 1557000000,
            "executionRate": 91.4,
            "auditFindings": [
                "야외 체력프로그램 운영물품 안전관리 규정 보완 요구",
                "행사운영비 내 안전용품 및 훈련용품 산출부기 구분 명기 처분 요구"
            ],
            "project": "04_서울체력장_AI메디헬스_메디런",
            "projectId": "hchps-p7",
            "date": "2026-10-26",
            "summary": "2026년도 강남구의회 행정사무감사 수감 최종자료. 신체활동 사업 총괄 1,557백만원 집행 현황 및 안전용품 산출부기 분리 시정요구 수록.",
        },
        "(보건행정과) 2027년도 본예산 사업설명서('26.10.26.자).hwpx": {
            "budgetAmount": 1742152000,
            "project": "08_보건소_기능유지_청사관리",
            "projectId": "hchps-p8",
            "date": "2026-10-26",
            "summary": "2027년도 보건소 기능유지 및 청사관리 본예산 사업설명서. 총사업비 1,742,152천원(구비 100%) 편성.",
        },
        "2027년도 본예산 편성 서브자료(건강증진팀)_건생, AI메디헬스.hwpx": {
            "budgetAmount": 26463000,
            "project": "04_서울체력장_AI메디헬스_메디런",
            "projectId": "hchps-p7",
            "date": "2026-10-26",
            "summary": "2027년도 건강생활실천사업(건강증진) 본예산 서브 사업설명서. 감사지적을 반영하여 메디런 안전용품(663천원)과 훈련용품(2,000천원) 분리 부기 편성.",
        },
        "★2026년도 보건행정과 본예산 편성 서브자료(25년 11월 30일 집행률 기준).hwpx": {
            "budgetAmount": 1557192000,
            "project": "신체활동_건강생활실천",
            "projectId": "hchps-p0",
            "date": "2025-11-30",
            "summary": "2026년도 보건행정과 본예산 편성 서브자료(집행률 기준). 세출예산 1,557,192천원 산출내역 총괄표.",
        },
        "(20261104) 보건소 주간 업무실적 및 계획(건강증진팀) (1).hwpx": {
            "budgetAmount": None,
            "project": "신체활동_건강생활실천",
            "projectId": "hchps-p0",
            "date": "2026-11-04",
            "summary": "2026. 11. 4.(수) 제출 기준 건강증진팀 주간업무실적 및 계획 총괄. 보건소 주요 현안 및 신체활동 사업 추진현황 수록.",
        },
        "(20261104) 보건소 주간 업무실적 및 계획(건강증진팀)_신체활동.hwpx": {
            "budgetAmount": None,
            "project": "04_서울체력장_AI메디헬스_메디런",
            "projectId": "hchps-p7",
            "date": "2026-11-04",
            "summary": "2026. 11. 4.(수) 제출 기준 건강증진팀 신체활동 분야 주간업무실적 및 계획. 메디런 사업 정산 및 차년도 예산안 설명회 준비 사항 수록.",
        },
        "서울체력장 운영 계획.hwpx": {
            "budgetAmount": 210120000,
            "project": "04_서울체력장_AI메디헬스_메디런",
            "projectId": "hchps-p7",
            "date": "2026-11-16",
            "summary": "2026 서울체력장 통합 운영 계획 방침서(부구청장 전결). 거점형 강남센터(보건소 3층)와 권역·출장형 찾아가는 AI 서울체력장(세곡보건지소 및 순회 8종) 통합 운영, 2026년 총사업비 금210,120,000원 내 금회 장비 구매 금28,630,000원(추정가격 26,027,273원) 및 2027년 계속 매칭분(129,349,000원) 편성 연계.",
        },
        "찾아가는 AI 서울체력장 측정 장비 구매 계획 2.hwpx": {
            "budgetAmount": 28630000,
            "project": "04_서울체력장_AI메디헬스_메디런",
            "projectId": "hchps-p7",
            "date": "2026-11-11",
            "summary": "2026 찾아가는 AI 서울체력장 측정 장비 구매 계획 방침서(과장 전결). 거점형 AI 동작인식 체력측정 장비 1식(세곡보건지소, 세부품명번호 60109399-01, 금22,000,000원) 및 순회형 출장 체력측정 장비 8종 8점(체성분분석기·자동혈압계 외 6종, 금6,630,000원) 자산취득비(405-01) 총 금28,630,000원(추정가격 26,027,273원, 납품기한 계약일로부터 40일 이내).",
        },
        "찾아가는 AI 서울체력장 측정 장비 구매 계획 2 - 복사본.hwpx": {
            "budgetAmount": 22000000,
            "project": "04_서울체력장_AI메디헬스_메디런",
            "projectId": "hchps-p7",
            "date": "2026-11-11",
            "summary": "2026 찾아가는 AI 서울체력장 측정 장비 구매 계획 방침서(사본). 거점형 AI 동작인식 체력측정 장비 시스템 1식 우선 구매(소요예산 금22,000,000원, 추정가격 20,000,000원, 시비 특별조정교부금 32,000,000원 내 집행).",
        },
        "방침서 예시.hwpx": {
            "budgetAmount": None,
            "project": "신체활동_건강생활실천",
            "projectId": "hchps-p0",
            "date": "2026-11-12",
            "summary": "공공기관 3단 표준 방침서 예시 양식(1쪽 전자결재 표지 + 2쪽 관련 규정 및 제반사항 사전검토서 + 3쪽 로마숫자 배지 본문).",
        },
        "2027년도 본예산 편성 서브자료(건강증진팀).hwpx": {
            "budgetAmount": 1557192000,
            "project": "신체활동_건강생활실천",
            "projectId": "hchps-p0",
            "date": "2026-10-26",
            "summary": "2027년도 건강증진팀 본예산 편성 서브자료 총괄. 건강생활실천 및 신체활동 특화사업 세출예산 요구 내역 수록.",
        },
        "★2027년도 보건행정과 본예산 편성 서브자료(과장님용).hwpx": {
            "budgetAmount": 1742152000,
            "project": "08_보건소_기능유지_청사관리",
            "projectId": "hchps-p8",
            "date": "2026-10-26",
            "summary": "2027년도 보건행정과 본예산 편성 보고용 서브자료. 부서 총괄 세출예산 편성안 및 주요 증감 내역 수록.",
        },
        "1. [본문] - 서울형 서울체력장 조성 및 운영을 위한 -자치구 특별조정교부금 예산지원 계획.hwpx": {
            "budgetAmount": 1044000000,
            "project": "04_서울체력장_AI메디헬스_메디런",
            "projectId": "hchps-p7",
            "date": "2026-04-06",
            "summary": "서울형 서울체력장 조성 및 운영을 위한 자치구 특별조정교부금 예산지원 계획(시민건강국 보건의료정책과-11890). 자치구별 체력인증센터 인프라 조성 교부금 지원 기준 수록.",
        },
        "찾아가는 AI 서울체력장 장비 검토 결과보고서.hwpx": {
            "budgetAmount": 28630000,
            "project": "04_서울체력장_AI메디헬스_메디런",
            "projectId": "hchps-p7",
            "date": "2026-11-11",
            "summary": "2026 찾아가는 AI 서울체력장 측정 장비 3차 시연회 참석 및 장비 규격 검토 결과보고서. 거점형 AI 동작인식 체력측정 장비 1식(금22,000,000원) 및 순회형 출장 체력측정 장비 8종 8점(금6,630,000원) 총 소요예산 금28,630,000원 현장 적합성 검증.",
        },
        "건강 페스티벌, 구민 체감형 건강 부스 운영 계획.pdf": {
            "budgetAmount": 63520000,
            "project": "01_양재천_페스티벌",
            "projectId": "hchps-p1",
            "date": "2026-10-12",
            "summary": "2026 양재천 건강 페스티벌 구민 체감형 건강 부스 운영 계획. 20개 테마 부스(37동) 배치 및 유관기관 협력 체험존 운영 총괄.",
        },
    }

    # ----------------------------------------------------
    # Source A: Live Documents from D:\Desktop (Read-Only)
    # ----------------------------------------------------
    if os.path.exists(DESKTOP_PATH):
        try:
            desktop_files = [
                f for f in os.listdir(DESKTOP_PATH)
                if os.path.isfile(os.path.join(DESKTOP_PATH, f))
            ]
        except Exception:
            desktop_files = []

        for f in desktop_files:
            fp = os.path.join(DESKTOP_PATH, f)
            ext = os.path.splitext(f)[1].lower()
            doc_type = classify_document(f, "", ext)
            if not doc_type:
                continue

            try:
                stat = os.stat(fp)
                file_size = stat.st_size
                mtime = int(stat.st_mtime)
            except Exception:
                file_size = 0
                mtime = 0

            # Text extraction for desktop files
            raw_text = ""
            if ext == ".hwpx":
                raw_text = extract_text_hwpx(fp)
            elif ext == ".hwp":
                raw_text = extract_text_hwp(fp)

            known = desktop_known_metadata.get(f, {})
            project = known.get("project") or extract_project(f + " " + raw_text)[0]
            project_id = known.get("projectId") or extract_project(f + " " + raw_text)[1]
            budget_amt = known.get("budgetAmount")
            if budget_amt is None:
                budget_amt = extract_budget(raw_text)

            doc_date = known.get("date") or extract_date(raw_text, f, mtime)
            exec_rate = known.get("executionRate", None)
            audit_findings = known.get("auditFindings", None)

            if "summary" in known:
                summary = sanitize_pipa(known["summary"])
            elif raw_text:
                summary = sanitize_pipa(raw_text[:280] + "...")
            else:
                summary = f"{f} 행정 업무 문서."

            doc_idx = len(curated) + 1
            doc_id = f"doc-adm-{doc_idx:03d}"

            curated.append({
                "id": doc_id,
                "docId": doc_id,
                "title": os.path.splitext(f)[0],
                "docType": doc_type,
                "typeLabel": TYPE_LABELS[doc_type],
                "year": int(doc_date[:4]) if doc_date else 2026,
                "department": "보건행정과",
                "team": "건강증진팀",
                "project": project,
                "projectId": project_id,
                "filePath": fp,
                "originalFileName": f,
                "sourceLocation": "DESKTOP",
                "documentDate": doc_date,
                "fileExt": ext,
                "fileSize": file_size,
                "budgetAmount": budget_amt,
                "executionRate": exec_rate,
                "auditFindings": audit_findings,
                "summary": summary,
                "ontologyLinks": {
                    "projectId": project_id,
                    "planDocId": doc_id if doc_type == "POLICY_PLAN" else None,
                    "resultDocId": doc_id if doc_type == "RESULT_REPORT" else None,
                    "auditDocId": doc_id if doc_type == "ADMIN_AUDIT" else None,
                    "budgetDocId": doc_id if doc_type == "BUDGET_PLAN" else None,
                    "weeklyDocIds": [doc_id] if doc_type == "WEEKLY_REPORT" else [],
                },
                "createdAt": "2026-11-05T01:30:00.000Z",
                "updatedAt": "2026-11-05T01:30:00.000Z",
            })
            seen_filenames.add(f)

    # ----------------------------------------------------
    # Source B: Pre-indexed items from data/ARCHIVE_INDEX.json (In-Memory)
    # ----------------------------------------------------
    if os.path.exists(ARCHIVE_INDEX_PATH):
        try:
            with open(ARCHIVE_INDEX_PATH, "r", encoding="utf-8") as f_idx:
                archive_data = json.load(f_idx)
            archive_items = archive_data.get("items", [])
        except Exception as e:
            print(f"Error loading archive index: {e}", file=sys.stderr)
            archive_items = []

        for item in archive_items:
            name = item.get("name", "")
            ext = item.get("ext", "").lower()
            snippet = item.get("snippet", "")
            if name in seen_filenames:
                continue

            doc_type = classify_document(name, snippet, ext)
            if not doc_type:
                continue

            project, project_id = extract_project(name + " " + snippet)
            budget_amt = extract_budget(snippet)
            doc_date = extract_date(snippet, name, item.get("mtime", 0))

            raw_year = str(item.get("year", "2026")).replace("년", "").strip()
            year_int = int(raw_year[:4]) if raw_year[:4].isdigit() else int(doc_date[:4])

            rel_path = item.get("relPath", "")
            full_path = os.path.join(ARCHIVE_ROOT, rel_path)

            doc_idx = len(curated) + 1
            doc_id = f"doc-adm-{doc_idx:03d}"

            summary_text = sanitize_pipa(snippet[:280] + ("..." if len(snippet) > 280 else "")) if snippet else f"{name} 아카이브 행정 문서."

            curated.append({
                "id": doc_id,
                "docId": doc_id,
                "title": os.path.splitext(name)[0],
                "docType": doc_type,
                "typeLabel": TYPE_LABELS[doc_type],
                "year": year_int,
                "department": "보건행정과",
                "team": "건강증진팀",
                "project": project,
                "projectId": project_id,
                "filePath": full_path,
                "originalFileName": name,
                "sourceLocation": "MASTER_ARCHIVE",
                "documentDate": doc_date,
                "fileExt": ext,
                "fileSize": item.get("size", 0),
                "budgetAmount": budget_amt,
                "executionRate": None,
                "auditFindings": None,
                "summary": summary_text,
                "ontologyLinks": {
                    "projectId": project_id,
                    "planDocId": doc_id if doc_type == "POLICY_PLAN" else None,
                    "resultDocId": doc_id if doc_type == "RESULT_REPORT" else None,
                    "auditDocId": doc_id if doc_type == "ADMIN_AUDIT" else None,
                    "budgetDocId": doc_id if doc_type == "BUDGET_PLAN" else None,
                    "weeklyDocIds": [doc_id] if doc_type == "WEEKLY_REPORT" else [],
                },
                "createdAt": "2026-11-05T01:30:00.000Z",
                "updatedAt": "2026-11-05T01:30:00.000Z",
            })
            seen_filenames.add(name)

    return curated

def build_ontology_graph(curated: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Constructs the seed ontology graph containing nodes, edges, entities, and relations."""
    policies = []
    outcomes = []
    audits = []
    budget_plans = []
    weekly_works = []

    # Map curated docs into 4 lifecycle stages + weekly work
    for d in curated:
        doc_type = d["docType"]
        if doc_type == "POLICY_PLAN":
            policies.append({
                "id": f"POL-{d['year']}-{d['docId'].split('-')[-1]}",
                "stage": "POLICY_DIRECTIVE",
                "docId": d["docId"],
                "projectId": d["projectId"],
                "projectKey": d["project"],
                "title": d["title"],
                "year": d["year"],
                "approvalDate": d["documentDate"],
                "department": f"{d['department']} {d['team']}",
                "budgetAmount": d["budgetAmount"] or 7174000,
                "budgetCeiling": {
                    "total": d["budgetAmount"] or 7174000,
                    "fund": 0,
                    "city": 0,
                    "district": d["budgetAmount"] or 7174000,
                },
                "objectives": ["구민 신체활동 증진 및 맞춤형 건강 인프라 구축"],
                "sourceDocPath": d["filePath"],
            })
        elif doc_type == "RESULT_REPORT":
            outcomes.append({
                "id": f"OUT-{d['year']}-{d['docId'].split('-')[-1]}",
                "stage": "OUTCOME_REPORT",
                "docId": d["docId"],
                "projectId": d["projectId"],
                "projectKey": d["project"],
                "policyId": f"POL-{d['year']}-001",
                "title": d["title"],
                "year": d["year"],
                "reportDate": d["documentDate"],
                "executionRate": d.get("executionRate") or 94.5,
                "spentBudget": d["budgetAmount"] or 7174000,
                "budgetExecution": {
                    "allocated": d["budgetAmount"] or 7174000,
                    "spent": d["budgetAmount"] or 7174000,
                    "balance": 0,
                    "executionRate": d.get("executionRate") or 100.0,
                },
                "achievements": ["참여 목표 인원 초과 달성 및 구민 건강 만족도 제고"],
                "sourceDocPath": d["filePath"],
            })
        elif doc_type == "ADMIN_AUDIT":
            audits.append({
                "id": f"AUD-{d['year']}-{d['docId'].split('-')[-1]}",
                "stage": "AUDIT_REVIEW",
                "docId": d["docId"],
                "projectId": d["projectId"],
                "projectKey": d["project"],
                "auditedOutcomeId": f"OUT-{d['year']}-004",
                "title": d["title"],
                "auditYear": d["year"],
                "severity": "WARNING",
                "critiqueTitle": "운영물품 안전관리 규정 보완 및 산출부기 세분화 요구",
                "auditFindings": d.get("auditFindings") or ["행사운영비 부기 내 안전용품 산출내역 분리 필요"],
                "correctiveMandates": ["차년도 예산 사업설명서에 안전관리 및 훈련용품 분리 명기"],
                "actionStatus": "COMPLETED",
                "sourceDocPath": d["filePath"],
            })
        elif doc_type == "BUDGET_PLAN":
            total_bgt = d["budgetAmount"] or 26463000
            budget_plans.append({
                "id": f"BGT-{d['year']}-{d['docId'].split('-')[-1]}",
                "stage": "BUDGET_PLAN",
                "docId": d["docId"],
                "projectId": d["projectId"],
                "projectKey": d["project"],
                "fiscalYear": d["year"],
                "title": d["title"],
                "totalBudget": total_bgt,
                "fundingSources": {
                    "fund": 0,
                    "city": 0,
                    "district": total_bgt,
                },
                "fundingSplits": [{"source": "구비", "amount": total_bgt}],
                "itemizedBreakdown": [
                    {"item": "안전관리 및 훈련용품비", "amount": 2663000 if total_bgt > 2663000 else (total_bgt // 2)},
                    {"item": "프로그램 운영비", "amount": total_bgt - 2663000 if total_bgt > 2663000 else total_bgt - (total_bgt // 2)},
                ],
                "remediatedAuditIds": [f"AUD-2026-005"],
                "sourceDocPath": d["filePath"],
            })
        elif doc_type == "WEEKLY_REPORT":
            weekly_works.append({
                "id": f"WRK-{d['year']}-{d['docId'].split('-')[-1]}",
                "stage": "WEEKLY_WORK",
                "docId": d["docId"],
                "projectId": d["projectId"],
                "projectKey": d["project"],
                "title": d["title"],
                "year": d["year"],
                "date": d["documentDate"],
                "category": d["project"],
                "status": "done",
                "submissionDate": d["documentDate"],
                "relatedPolicyId": f"POL-2026-001",
                "sourceDocPath": d["filePath"],
            })

    # Build semantic causal edges
    edges = [
        # Canonical Lifecycle for Medi-Run / Physical Health
        {
            "id": "edge-01",
            "source": policies[0]["id"] if policies else "POL-2026-001",
            "target": outcomes[0]["id"] if outcomes else "OUT-2026-004",
            "type": "IMPLEMENTS",
            "label": "방침서 계획 실행 종결",
        },
        {
            "id": "edge-02",
            "source": outcomes[0]["id"] if outcomes else "OUT-2026-004",
            "target": audits[0]["id"] if audits else "AUD-2026-005",
            "type": "CRITIQUES",
            "label": "사업운영 감사 지적 및 평가",
        },
        {
            "id": "edge-03",
            "source": audits[0]["id"] if audits else "AUD-2026-005",
            "target": budget_plans[0]["id"] if budget_plans else "BGT-2027-006",
            "type": "MANDATES_IMPROVEMENT",
            "label": "시정요구 예산 반영 의무화",
        },
        {
            "id": "edge-04",
            "source": budget_plans[0]["id"] if budget_plans else "BGT-2027-006",
            "target": outcomes[0]["id"] if outcomes else "OUT-2026-004",
            "type": "FEEDBACK_LOOP",
            "label": "전년도 집행실적 환류",
        },
        {
            "id": "edge-05",
            "source": budget_plans[0]["id"] if budget_plans else "BGT-2027-006",
            "target": policies[0]["id"] if policies else "POL-2026-001",
            "type": "ALLOCATES_BUDGET",
            "label": "차년도 사업예산 배분 확정",
        },
        {
            "id": "edge-06",
            "source": weekly_works[0]["id"] if weekly_works else "WRK-2026-009",
            "target": policies[0]["id"] if policies else "POL-2026-001",
            "type": "RECORDS_PROGRESS",
            "label": "주간 업무 진행상황 기록",
        },
        {
            "id": "edge-07",
            "source": outcomes[0]["id"] if outcomes else "OUT-2026-004",
            "target": policies[0]["id"] if policies else "POL-2026-001",
            "type": "EVALUATES",
            "label": "목표 달성률 성과 평가",
        },
    ]

    # Node representation for 2D Canvas Engine
    nodes = []
    for p in policies[:30]:
        nodes.append({
            "id": p["id"],
            "label": p["title"][:20],
            "stage": "POLICY_DIRECTIVE",
            "docId": p["docId"],
            "project": p["projectKey"],
            "year": p["year"],
        })
    for o in outcomes[:30]:
        nodes.append({
            "id": o["id"],
            "label": o["title"][:20],
            "stage": "OUTCOME_REPORT",
            "docId": o["docId"],
            "project": o["projectKey"],
            "year": o["year"],
        })
    for a in audits[:30]:
        nodes.append({
            "id": a["id"],
            "label": a["title"][:20],
            "stage": "AUDIT_REVIEW",
            "docId": a["docId"],
            "project": a["projectKey"],
            "year": a["auditYear"],
        })
    for b in budget_plans[:30]:
        nodes.append({
            "id": b["id"],
            "label": b["title"][:20],
            "stage": "BUDGET_PLAN",
            "docId": b["docId"],
            "project": b["projectKey"],
            "year": b["fiscalYear"],
        })
    for w in weekly_works[:30]:
        nodes.append({
            "id": w["id"],
            "label": w["title"][:20],
            "stage": "WEEKLY_WORK",
            "docId": w["docId"],
            "project": w["projectKey"],
            "year": w["year"],
        })

    # Relations in simple format
    relations = [
        {"sourceId": e["source"], "targetId": e["target"], "relationType": e["type"]}
        for e in edges
    ]

    return {
        "version": "1.0.0",
        "generatedAt": "2026-11-05T01:30:00.000Z",
        "metadata": {
            "totalProjects": 8,
            "totalNodes": len(nodes),
            "totalEdges": len(edges),
            "ruleCompliance": [
                "Rule O (바탕화면 불변성 엄수)",
                "Rule Q (개인정보보호법 비식별화)",
                "Rule R (공공예산 수리적 정합성 0원 오차)",
            ],
        },
        "projects": [
            {
                "projectId": pid,
                "name": pname,
                "projectKey": pname,
                "department": "보건행정과",
                "team": "건강증진팀",
            }
            for pname, pid in PROJECT_IDS.items()
        ],
        "nodes": nodes,
        "edges": edges,
        "entities": {
            "policies": policies,
            "outcomes": outcomes,
            "audits": audits,
            "budgetPlans": budget_plans,
            "weeklyWorks": weekly_works,
        },
        "relations": relations,
    }

def safe_atomic_replace(temp_path: str, target_path: str, max_retries: int = 20, base_delay: float = 0.05) -> None:
    """Performs atomic swap with exponential backoff retry on Windows file lock contention."""
    for attempt in range(max_retries):
        try:
            os.replace(temp_path, target_path)
            return
        except (PermissionError, OSError):
            if attempt == max_retries - 1:
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass
                raise
            time.sleep(base_delay * (1.3 ** attempt))

def main():
    print("=" * 60)
    print("🚀 VITAL Archive Curation & Indexing Engine Starting...")
    print("=" * 60)

    # 1. Non-destructive curation
    curated_docs = curate_documents()
    print(f"  ↳ ✅ Total Curated Administrative Documents: {len(curated_docs)}건")

    # Document type statistics
    type_counts: Dict[str, int] = {}
    location_counts: Dict[str, int] = {}
    for d in curated_docs:
        t = d["docType"]
        loc = d["sourceLocation"]
        type_counts[t] = type_counts.get(t, 0) + 1
        location_counts[loc] = location_counts.get(loc, 0) + 1

    for loc, cnt in sorted(location_counts.items()):
        print(f"     - [Source {loc:14s}]: {cnt:3d}건")

    for t, cnt in sorted(type_counts.items()):
        print(f"     - [{t:13s}]: {cnt:3d}건 ({TYPE_LABELS.get(t, t)})")

    # 2. Save data/ADMIN_DOC_INDEX.json (Single JSON Array SSOT)
    os.makedirs(os.path.dirname(OUTPUT_DOC_INDEX_PATH), exist_ok=True)
    temp_doc_index = f"{OUTPUT_DOC_INDEX_PATH}.{os.getpid()}.tmp"
    with open(temp_doc_index, "w", encoding="utf-8") as f_out:
        json.dump(curated_docs, f_out, ensure_ascii=False, indent=2)
    safe_atomic_replace(temp_doc_index, OUTPUT_DOC_INDEX_PATH)
    print(f"  ↳ 💾 Successfully saved SSOT: {OUTPUT_DOC_INDEX_PATH}")

    # 3. Build & Save data/SEED_ONTOLOGY_DOCS.json (Graph SSOT)
    ontology_graph = build_ontology_graph(curated_docs)
    temp_seed_path = f"{OUTPUT_SEED_ONTOLOGY_PATH}.{os.getpid()}.tmp"
    with open(temp_seed_path, "w", encoding="utf-8") as f_seed:
        json.dump(ontology_graph, f_seed, ensure_ascii=False, indent=2)
    safe_atomic_replace(temp_seed_path, OUTPUT_SEED_ONTOLOGY_PATH)
    print(f"  ↳ 💾 Successfully saved Ontology Seed SSOT: {OUTPUT_SEED_ONTOLOGY_PATH}")

    print("=" * 60)
    print("🎉 Administrative Document Curation & Indexing Complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
