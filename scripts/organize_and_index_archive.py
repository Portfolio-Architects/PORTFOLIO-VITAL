#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
VITAL Archive Organizer & Full-Text / Photo Context Indexer
Target: F:\_Organized_Archive
- --organize : Lossless physical folder consolidation (Root cleanup + 2026년 9 core project folders)
- --rollback : Instant 100% rollback using data/ARCHIVE_MIGRATION_LOG.json
- --index    : Full-text extraction (.hwpx, .hwp, .pdf, .xlsx, .pptx, .docx, .txt) + Photo context tagging + PIPA masking
- --verify-organization : Verify zero loose files at root and integrity of migration log
"""

import os
import re
import sys
import json
import time
import zlib
import shutil
import zipfile
import hashlib
import argparse
from datetime import datetime
from collections import Counter, defaultdict

ARCHIVE_ROOT = r"F:\_Organized_Archive"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATION_LOG_PATH = os.path.join(REPO_ROOT, "data", "archive", "ARCHIVE_MIGRATION_LOG.json")
INDEX_OUTPUT_PATH = os.path.join(REPO_ROOT, "data", "ARCHIVE_INDEX.json")

DUPLICATES_DIR_NAME = "_Archive_Duplicates"

# 2026년 9대 핵심 단위사업 폴더 표준 명칭
CORE_PROJECTS_2026 = {
    "01": "01_기획총괄_주요업무_행감",
    "02": "02_예산회계_보조금_일상경비",
    "03": "03_양재천_건강페스티벌",
    "04": "04_서울체력장_AI메디헬스_메디런",
    "05": "05_어린이_아이뛰움_바른자세",
    "06": "06_비만예방_건강뜀_합동캠페인",
    "07": "07_손목닥터9988_스마트헬스",
    "08": "08_통합건강증진_지역보건의료계획",
    "09": "09_일반행정_보안_법령_기타",
}

# 2026년 내 기존 33개 하위 폴더 -> 9대 핵심 사업 폴더 매핑
SUBFOLDER_MAP_2026 = {
    "주요업무보고_기획총괄": CORE_PROJECTS_2026["01"],
    "2026회계연도_세출예산_사업": CORE_PROJECTS_2026["02"],
    "일반행정_예산회계": CORE_PROJECTS_2026["02"],
    "양재천_건강축제_페스티벌": CORE_PROJECTS_2026["03"],
    "양재천_건강페스티벌": CORE_PROJECTS_2026["03"],
    "서울체력장_체력인증센터": CORE_PROJECTS_2026["04"],
    "AI_메디헬스_스마트케어": CORE_PROJECTS_2026["04"],
    "강남센터": CORE_PROJECTS_2026["04"],
    "트레이닝_센터": CORE_PROJECTS_2026["04"],
    "2027년_정보화사업": CORE_PROJECTS_2026["04"],
    "SW사업": CORE_PROJECTS_2026["04"],
    "학술연구용역": CORE_PROJECTS_2026["04"],
    "어린이신체활동_아이뛰움": CORE_PROJECTS_2026["05"],
    "바른자세_체형교정": CORE_PROJECTS_2026["05"],
    "비만예방_건강뜀": CORE_PROJECTS_2026["06"],
    "건강증진_합동_캠페인": CORE_PROJECTS_2026["06"],
    "신체활동_건강생활실천": CORE_PROJECTS_2026["06"],
    "시니어_운동_프로그램": CORE_PROJECTS_2026["06"],
    "시니어센터": CORE_PROJECTS_2026["06"],
    "중년여성_식생활_프로그램": CORE_PROJECTS_2026["06"],
    "체력향상_프로그램": CORE_PROJECTS_2026["06"],
    "하이언트_사업": CORE_PROJECTS_2026["06"],
    "손목닥터9988_스마트헬스": CORE_PROJECTS_2026["07"],
    "2026년_통합건강증진사업": CORE_PROJECTS_2026["08"],
    "서울특별시_강남구보건소_통합건강증진사업": CORE_PROJECTS_2026["08"],
    "통합건강증진사업": CORE_PROJECTS_2026["08"],
    "건강증진사업": CORE_PROJECTS_2026["08"],
    "국가법령정보센터": CORE_PROJECTS_2026["09"],
    "감염병_방역_예방접종": CORE_PROJECTS_2026["09"],
    "심뇌혈관질환_예방관리": CORE_PROJECTS_2026["09"],
    "정신건강_치매안심": CORE_PROJECTS_2026["09"],
    "주민자체센터": CORE_PROJECTS_2026["09"],
}

# 최상위 루트에 흩어진 임시 폴더 -> (연도, 핵심사업폴더, 하위폴더명) 매핑
ROOT_DIR_MAP = {
    "1학기": ("2026년", CORE_PROJECTS_2026["05"], "아이뛰움_1학기"),
    "아이뛰움 2학기": ("2026년", CORE_PROJECTS_2026["05"], "아이뛰움_2학기"),
    "20260624_5.28-6.16 강남구 학교 사진(바른자세)_1_1_1_1_1_1": ("2026년", CORE_PROJECTS_2026["05"], "학교_바른자세_교육사진"),
    "20260826_서울체력장_디자인파일": ("2026년", CORE_PROJECTS_2026["04"], "서울체력장_디자인파일"),
    "서울체력장 공간디자인 적용 협조 요청외3": ("2026년", CORE_PROJECTS_2026["04"], "서울체력장_공간디자인_협조"),
    "헬스체크업 프로그램 사진": ("2026년", CORE_PROJECTS_2026["04"], "헬스체크업_프로그램_사진"),
    "[붙임1] AI 점검사항외1": ("2026년", CORE_PROJECTS_2026["04"], "AI_점검사항"),
    "260923_강남구 양재천걷기 포스터2_기-4(최종)": ("2026년", CORE_PROJECTS_2026["03"], "포스터_현수막_시안"),
    "[홍보실 수정] 양재천 걷자! 건강 페스티벌외2": ("2026년", CORE_PROJECTS_2026["03"], "홍보실_검토자료"),
    "부스 신청서 전달건": ("2026년", CORE_PROJECTS_2026["03"], "부스_신청서"),
    "현수막 게첩 최종": ("2026년", CORE_PROJECTS_2026["03"], "포스터_현수막_시안"),
    "(보건행정과)제339회 정례회 주요업무보고(작성서식)외3": ("2026년", CORE_PROJECTS_2026["01"], "제339회_정례회_주요업무보고"),
    "★2026년 행정사무감사자료(보건행정과 작성서식)외1": ("2026년", CORE_PROJECTS_2026["01"], "2026_행정사무감사"),
    "행감 개별 - 1 별첨": ("2026년", CORE_PROJECTS_2026["01"], "2026_행정사무감사_별첨1"),
    "행감 개별 - 8 별첨": ("2026년", CORE_PROJECTS_2026["01"], "2026_행정사무감사_별첨8"),
    "~260918(붙임 1) 2027년도 예산의 성과계획서 수립 계획외5": ("2026년", CORE_PROJECTS_2026["01"], "성과관리계획"),
    "~260923 성과관리계획, 건생 p421": ("2026년", CORE_PROJECTS_2026["01"], "성과관리계획"),
    "성과관리계획 작성양식": ("2026년", CORE_PROJECTS_2026["01"], "성과관리계획"),
    "(보건행정과) 2027년도 본예산 사업설명서('26외1": ("2026년", CORE_PROJECTS_2026["02"], "2027_본예산_사업설명서"),
    "RE_ 수의계약 서류 요청의 건 (요청서류 첨부)": ("2026년", CORE_PROJECTS_2026["02"], "수의계약_지출정산_서류"),
    "안녕하세요! 서류 발송드립니다": ("2026년", CORE_PROJECTS_2026["02"], "수의계약_지출정산_서류"),
    "요청하신 서류 등 송부": ("2026년", CORE_PROJECTS_2026["02"], "수의계약_지출정산_서류"),
    "2026년 지역사회 비만예방 합동캠페인 추진 실적 제출 요청외3": ("2026년", CORE_PROJECTS_2026["06"], "비만예방_합동캠페인"),
    "[카드뉴스]손목닥터9988-01": ("2026년", CORE_PROJECTS_2026["07"], "카드뉴스_홍보자료"),
    "2027년 건강증진사업관리(통합건강증진사업) 가내시 알림외4": ("2026년", CORE_PROJECTS_2026["08"], "통합건강증진사업_가내시"),
    "★★제6기 세부사업(사업명_담당자)외3 (1)": ("2026년", CORE_PROJECTS_2026["08"], "지역보건의료계획_세부사업"),
    "(긴급)보안정책 강화에 따른 유해사이트 차단 예외 재신청 요청외8": ("2026년", CORE_PROJECTS_2026["09"], "보안정책_유해사이트차단_VPN"),
    "★Cloud_SSL_VPN_1.1": ("2026년", CORE_PROJECTS_2026["09"], "보안정책_유해사이트차단_VPN"),
    "생성형 인공지능 서비스(챗GPT， Claude 등) 보안 주의사항 (재)안내외4": ("2026년", CORE_PROJECTS_2026["09"], "생성형AI_보안지침"),
    "2026년 9월 정례반상회 홍보자료 송부 및 10월 홍보자료 요청외3": ("2026년", CORE_PROJECTS_2026["09"], "정례반상회_홍보협조"),
    "우리동네 작은음악회 두루두루 강남스퀘어 관련 주차단속유예 협조요청외3": ("2026년", CORE_PROJECTS_2026["09"], "타부서_협조문서"),
    "26강남구보건소": ("2026년", CORE_PROJECTS_2026["09"], "일반행정_기타"),
}


def compute_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def classify_2026_project_by_filename(filename: str) -> str:
    """Classify a file into one of the 9 core 2026 project folders based on filename rules."""
    name = filename.lower()

    # 시스템 로그 파일류
    if name in {
        "audit_journal.jsonl",
        "audit_journal_2.jsonl",
        "audit_manifest.json",
        "date_prefix_renaming_log.json",
        "date_prefix_renaming_log_2.json",
        "rollback.py",
    }:
        return os.path.join(CORE_PROJECTS_2026["09"], "_아카이브_시스템로그")

    # 03 양재천 건강페스티벌
    if any(k in name for k in [
        "양재천", "페스티벌", "걷기대회", "수변문화쉼터", "제이민", "스티커_투어",
        "클린플래너", "프라우드클린", "커넥팅디", "자이언트 배너", "수건 타올",
        "청장님 소개멘트", "교통통제계획", "타워팰리스", "현수막",
    ]):
        return CORE_PROJECTS_2026["03"]

    # 04 서울체력장 / AI메디헬스 / 메디런 / 헬스체크업
    if any(k in name for k in [
        "서울체력장", "체력장", "메디헬스", "메디런", "헬스체크업", "체력인증",
        "강남센터", "리얼피티", "하이티", "특교", "특별조정교부금", "지능정보화",
        "측정사진",
    ]):
        return CORE_PROJECTS_2026["04"]

    # 05 어린이 아이뛰움 / 바른자세
    if any(k in name for k in [
        "아이뛰움", "아이_뛰움", "바른자세", "척추측만", "메이플컴퍼니", "에듀하이",
    ]):
        return CORE_PROJECTS_2026["05"]

    # 07 손목닥터9988
    if any(k in name for k in ["손목닥터", "9988", "스마트헬스"]):
        return CORE_PROJECTS_2026["07"]

    # 08 통합건강증진 / 지역보건의료계획
    if any(k in name for k in [
        "지역보건의료계획", "통합건강증진", "신체활동 인력 현황",
    ]):
        return CORE_PROJECTS_2026["08"]

    # 06 비만예방 / 건강뜀 / 합동캠페인 / 신체활동 일반
    if any(k in name for k in [
        "비만", "건강뜀", "합동 캠페인", "합동캠페인", "중강도걷기", "걷기 건강 문구",
        "일당! 오십", "당류 저감", "코어 근육", "국제평화", "신체활동 사업 총괄",
        "건강생활 실천 사업",
    ]):
        return CORE_PROJECTS_2026["06"]

    # 01 기획총괄 / 주요업무 / 행감 / 성과관리 / 공약
    if any(k in name for k in [
        "주간 업무", "주간업무", "주요업무", "행정사무감사", "행감", "성과관리",
        "성과계획", "공약", "민선9기", "정례회", "소장회의", "부구청장회의",
        "주요정책회의", "차담회", "언론보도", "평가 및 공모", "평가사업", "공모사업",
        "프로젝트팀", "행사축제 사업 현황", "최근 3년 변동",
    ]):
        return CORE_PROJECTS_2026["01"]

    # 02 예산회계 / 보조금 / 계약 / 지출
    if any(k in name for k in [
        "예산", "가내시", "사업설명서", "편성 총괄표", "편성총괄표", "산출내역",
        "산출기초", "수의 계약", "수의계약", "견적서", "납품검사", "물품검사",
        "입금계좌", "지급조서", "지급 서류", "세출예산", "이호조", "e-호조",
        "재정합의", "집행현황", "세금계산서", "etaxinvoice", "신한카드", "매출전표",
        "지방재정투자심사", "입찰 및 계약", "사업자등록증",
    ]):
        return CORE_PROJECTS_2026["02"]

    # 09 일반행정 / 보안 / 복무 / 법령 / 기타
    return CORE_PROJECTS_2026["09"]


def classify_root_file_destination(filename: str) -> tuple[str, str]:
    r"""Return (year_folder, subfolder) for a loose file sitting in F:\_Organized_Archive root."""
    if filename.startswith("2023년"):
        return ("2023년", "기타_일반행정")
    if filename.startswith(("20240115", "20240626")):
        if "바른자세" in filename:
            return ("2024년", "바른자세_체형교정")
        return ("2024년", "기타_일반행정")
    if filename.startswith(("2025 ", "2025.", "20251125")):
        return ("2025년", "일반행정_예산회계")

    return ("2026년", classify_2026_project_by_filename(filename))


def safe_move_file(src: str, dst_dir: str, dup_root: str, migration_records: list) -> str:
    """
    Safely move src into dst_dir without ever overwriting data.
    - If target path does not exist: move directly.
    - If target path exists and has identical SHA-256: move to dup_root preserving relative structure.
    - If target path exists and has different SHA-256: append _v2, _v3... before extension.
    """
    if not os.path.exists(src):
        return ""

    os.makedirs(dst_dir, exist_ok=True)
    filename = os.path.basename(src)
    dst = os.path.join(dst_dir, filename)

    if os.path.abspath(src) == os.path.abspath(dst):
        return dst

    action = "move"
    if os.path.exists(dst):
        src_hash = compute_sha256(src)
        dst_hash = compute_sha256(dst)
        if src_hash == dst_hash:
            # Identical file -> isolate in _Archive_Duplicates/_Merged_Duplicates
            dup_sub = os.path.join(dup_root, "_Merged_Duplicates")
            os.makedirs(dup_sub, exist_ok=True)
            base, ext = os.path.splitext(filename)
            candidate = os.path.join(dup_sub, filename)
            idx = 2
            while os.path.exists(candidate):
                candidate = os.path.join(dup_sub, f"{base}_dup{idx}{ext}")
                idx += 1
            dst = candidate
            action = "duplicate_isolated"
        else:
            base, ext = os.path.splitext(filename)
            idx = 2
            candidate = os.path.join(dst_dir, f"{base}_v{idx}{ext}")
            while os.path.exists(candidate):
                idx += 1
                candidate = os.path.join(dst_dir, f"{base}_v{idx}{ext}")
            dst = candidate
            action = "version_renamed"

    shutil.move(src, dst)
    migration_records.append({
        "src": src,
        "dst": dst,
        "action": action,
        "timestamp": datetime.now().isoformat(),
    })
    return dst


def remove_empty_dirs(root_dir: str):
    """Remove empty directories bottom-up."""
    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=False):
        if os.path.abspath(dirpath) == os.path.abspath(root_dir):
            continue
        try:
            if not os.listdir(dirpath):
                os.rmdir(dirpath)
        except OSError:
            pass


def organize_archive():
    print(f"[ORGANIZE] Starting lossless organization of {ARCHIVE_ROOT}...")
    if not os.path.exists(ARCHIVE_ROOT):
        raise FileNotFoundError(f"Archive root not found: {ARCHIVE_ROOT}")

    migration_records = []
    if os.path.exists(MIGRATION_LOG_PATH):
        try:
            with open(MIGRATION_LOG_PATH, "r", encoding="utf-8") as f:
                existing_log = json.load(f)
                migration_records = existing_log.get("records", [])
        except Exception:
            migration_records = []

    dup_root = os.path.join(ARCHIVE_ROOT, DUPLICATES_DIR_NAME)
    os.makedirs(dup_root, exist_ok=True)

    # 1. Consolidate _Duplicates and _Legacy_Duplicates into _Archive_Duplicates
    for legacy_dup in ["_Duplicates", "_Legacy_Duplicates"]:
        legacy_path = os.path.join(ARCHIVE_ROOT, legacy_dup)
        if os.path.exists(legacy_path) and os.path.isdir(legacy_path):
            target_dup_path = os.path.join(dup_root, legacy_dup)
            if not os.path.exists(target_dup_path):
                shutil.move(legacy_path, target_dup_path)
                migration_records.append({
                    "src": legacy_path,
                    "dst": target_dup_path,
                    "action": "move_dir",
                    "timestamp": datetime.now().isoformat(),
                })
            else:
                for dp, _, fn in os.walk(legacy_path):
                    rel = os.path.relpath(dp, legacy_path)
                    t_dir = target_dup_path if rel == "." else os.path.join(target_dup_path, rel)
                    for f in fn:
                        safe_move_file(os.path.join(dp, f), t_dir, dup_root, migration_records)
                remove_empty_dirs(legacy_path)
                try:
                    os.rmdir(legacy_path)
                except OSError:
                    pass

    # 2. Ensure 9 core project folders exist in 2026년
    year_2026_root = os.path.join(ARCHIVE_ROOT, "2026년")
    os.makedirs(year_2026_root, exist_ok=True)
    for folder_name in CORE_PROJECTS_2026.values():
        os.makedirs(os.path.join(year_2026_root, folder_name), exist_ok=True)

    # 3. Consolidate 33 subfolders inside 2026년 into the 9 core project folders
    core_folder_set = set(CORE_PROJECTS_2026.values())
    for item in sorted(os.listdir(year_2026_root)):
        item_path = os.path.join(year_2026_root, item)
        if not os.path.isdir(item_path):
            # Loose file directly inside 2026년
            target_proj = classify_2026_project_by_filename(item)
            safe_move_file(item_path, os.path.join(year_2026_root, target_proj), dup_root, migration_records)
            continue

        if item in core_folder_set:
            continue

        if item == "기타_일반행정":
            # Smart-classify each file inside 기타_일반행정 so project files go to their right project
            for dp, _, fn in os.walk(item_path):
                rel = os.path.relpath(dp, item_path)
                for f in fn:
                    src_file = os.path.join(dp, f)
                    target_proj = classify_2026_project_by_filename(f)
                    dst_dir = os.path.join(year_2026_root, target_proj)
                    if rel != ".":
                        dst_dir = os.path.join(dst_dir, rel)
                    safe_move_file(src_file, dst_dir, dup_root, migration_records)
            remove_empty_dirs(item_path)
            try:
                os.rmdir(item_path)
            except OSError:
                pass
            continue

        target_core = SUBFOLDER_MAP_2026.get(item, CORE_PROJECTS_2026["09"])
        target_base_dir = os.path.join(year_2026_root, target_core)

        # Move files preserving subfolder context if multiple files exist
        file_count = sum(len(files) for _, _, files in os.walk(item_path))
        for dp, _, fn in os.walk(item_path):
            rel = os.path.relpath(dp, item_path)
            if file_count > 5 and item not in {
                "주요업무보고_기획총괄",
                "일반행정_예산회계",
                "양재천_건강축제_페스티벌",
                "양재천_건강페스티벌",
                "서울체력장_체력인증센터",
                "손목닥터9988_스마트헬스",
                "통합건강증진사업",
            }:
                sub_dest = os.path.join(target_base_dir, item) if rel == "." else os.path.join(target_base_dir, item, rel)
            else:
                sub_dest = target_base_dir if rel == "." else os.path.join(target_base_dir, rel)
            for f in fn:
                safe_move_file(os.path.join(dp, f), sub_dest, dup_root, migration_records)

        remove_empty_dirs(item_path)
        try:
            os.rmdir(item_path)
        except OSError:
            pass

    # 4. Move loose directories and loose files at F:\_Organized_Archive root
    valid_root_dirs = {f"{y}년" for y in range(2015, 2028)} | {DUPLICATES_DIR_NAME}
    for item in sorted(os.listdir(ARCHIVE_ROOT)):
        if item in valid_root_dirs:
            continue
        item_path = os.path.join(ARCHIVE_ROOT, item)
        if os.path.isfile(item_path):
            yr, proj = classify_root_file_destination(item)
            dst_dir = os.path.join(ARCHIVE_ROOT, yr, proj)
            safe_move_file(item_path, dst_dir, dup_root, migration_records)
        elif os.path.isdir(item_path):
            if item in ROOT_DIR_MAP:
                yr, proj, subname = ROOT_DIR_MAP[item]
                target_base = os.path.join(ARCHIVE_ROOT, yr, proj, subname)
            else:
                proj = classify_2026_project_by_filename(item)
                target_base = os.path.join(ARCHIVE_ROOT, "2026년", proj, item)

            for dp, _, fn in os.walk(item_path):
                rel = os.path.relpath(dp, item_path)
                dst_dir = target_base if rel == "." else os.path.join(target_base, rel)
                for f in fn:
                    safe_move_file(os.path.join(dp, f), dst_dir, dup_root, migration_records)

            remove_empty_dirs(item_path)
            try:
                os.rmdir(item_path)
            except OSError:
                pass

    # 5. Consolidate duplicate subfolder in 2024년 (아이_뛰움_사업 -> 어린이신체활동_아이뛰움)
    y2024_dup = os.path.join(ARCHIVE_ROOT, "2024년", "아이_뛰움_사업")
    y2024_target = os.path.join(ARCHIVE_ROOT, "2024년", "어린이신체활동_아이뛰움")
    if os.path.exists(y2024_dup) and os.path.isdir(y2024_dup):
        for dp, _, fn in os.walk(y2024_dup):
            rel = os.path.relpath(dp, y2024_dup)
            dst_dir = y2024_target if rel == "." else os.path.join(y2024_target, rel)
            for f in fn:
                safe_move_file(os.path.join(dp, f), dst_dir, dup_root, migration_records)
        remove_empty_dirs(y2024_dup)
        try:
            os.rmdir(y2024_dup)
        except OSError:
            pass

    os.makedirs(os.path.dirname(MIGRATION_LOG_PATH), exist_ok=True)
    with open(MIGRATION_LOG_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "updatedAt": datetime.now().isoformat(),
            "totalOperations": len(migration_records),
            "records": migration_records,
        }, f, ensure_ascii=False, indent=2)

    print(f"[ORGANIZE] Completed! Logged {len(migration_records)} operations to {MIGRATION_LOG_PATH}")


def _to_win_long_path(p: str) -> str:
    if os.name != "nt":
        return p
    ap = os.path.abspath(p)
    if ap.startswith("\\\\?\\"):
        return ap
    if ap.startswith("\\\\"):
        return "\\\\?\\UNC\\" + ap[2:]
    return "\\\\?\\" + ap


def rollback_archive():
    """Rollback all file movements recorded in data/ARCHIVE_MIGRATION_LOG.json in reverse order."""
    if not os.path.exists(MIGRATION_LOG_PATH):
        print("[ROLLBACK] No migration log found.")
        return

    with open(MIGRATION_LOG_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = data.get("records", [])
    restored = 0
    for rec in reversed(records):
        lp_src = _to_win_long_path(rec["src"])
        lp_dst = _to_win_long_path(rec["dst"])
        if os.path.exists(lp_dst):
            os.makedirs(_to_win_long_path(os.path.dirname(rec["src"])), exist_ok=True)
            shutil.move(lp_dst, lp_src)
            restored += 1

    print(f"[ROLLBACK] Restored {restored} items to original locations.")


def verify_organization():
    """Verify root has zero loose files and print clean summary."""
    root_items = sorted(os.listdir(ARCHIVE_ROOT))
    loose_files = [x for x in root_items if os.path.isfile(os.path.join(ARCHIVE_ROOT, x))]
    root_dirs = [x for x in root_items if os.path.isdir(os.path.join(ARCHIVE_ROOT, x))]

    print("=== ARCHIVE ORGANIZATION VERIFICATION ===")
    print(f"Root loose files count : {len(loose_files)} (Expected: 0)")
    print(f"Root directories       : {root_dirs}")

    y26 = os.path.join(ARCHIVE_ROOT, "2026년")
    if os.path.exists(y26):
        print("\n=== 2026년 9 CORE PROJECT FOLDERS ===")
        for d in sorted(os.listdir(y26)):
            p = os.path.join(y26, d)
            if os.path.isdir(p):
                cnt = sum(len(files) for _, _, files in os.walk(p))
                print(f"  {d}: {cnt} files")

    if len(loose_files) > 0:
        print("ERROR: Loose files remain at root:", loose_files)
        sys.exit(1)
    print("VERIFICATION PASSED.")


# ==============================================================================
# PART 2: FULL-TEXT EXTRACTION, PIPA MASKING & PHOTO CONTEXT TAGGING
# ==============================================================================

CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]+")
NAME_BEFORE_RRN_PATTERN = re.compile(
    r"([가-힣]{2,4})(\s*\([\u4e00-\u9fff]{2,4}\))?"
    r"(?=\s*\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:\s*[-~–—_.]\s*|\s+)?[1-8]\d{6}(?![\d*-]))"
)
RRN_PATTERN = re.compile(
    r"(?<![\d*-])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\s*[-~–—_.]\s*|\s+)?([1-4]\d{6})(?![\d*-])"
)
FRN_PATTERN = re.compile(
    r"(?<![\d*-])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\s*[-~–—_.]\s*|\s+)?([5-8]\d{6})(?![\d*-])"
)
PHONE_PATTERN = re.compile(
    r"(?<![\dA-Za-z*-])(01[016789])(?:\s*[-.~–—)]\s*|\s+)?(\d{3,4})(?:\s*[-.~–—]\s*|\s+)?(\d{4})(?![\d*-])"
)
TEL_PATTERN = re.compile(
    r"(?<![\dA-Za-z*-])(\(?(?:02|0[3-6]\d|070)\)?)[\s.\-~–—)]+(\d{3,4})[\s.\-~–—]+(\d{4})(?![\d*-])"
)
TEL_NOSEP_PATTERN = re.compile(
    r"(?<![\dA-Za-z*-])(02|0[3-6]\d|070)(\d{3,4})(\d{4})(?![\d*-])"
)
CARD_SEP_PATTERN = re.compile(
    r"(?<![\d*-])(\d{4})(?:\s*[-~–—]\s*|\s+)(\d{4})(?:\s*[-~–—]\s*|\s+)(\d{4})(?:\s*[-~–—]\s*|\s+)(\d{4})(?![\d*-])"
)
CARD_NOSEP_PATTERN = re.compile(r"(?<![\d*-])(\d{4})(\d{4})(\d{4})(\d{4})(?![\d*-])")
BANK_CONTEXT_ACCOUNT_PATTERN = re.compile(
    r"((?:NH농협|IBK기업|SC제일|스탠다드차타드|카카오뱅크|케이뱅크|토스뱅크|새마을금고|"
    r"국민|신한|우리|하나|농협|기업|새마을|신협|우체국|수협|씨티|부산|대구|경남|광주|전북|제주)"
    r"(?:은행)?[\s:：()]*)"
    r"(\d{2,6}(?:\s*[-–—]\s*\d{1,8}){1,5}|\d{3,6}(?:\s+\d{2,6}){1,2}\s+\d{2,8}|\d{10,16})"
    r"(?![\d,%.-])"
)
ACCOUNT_PATTERN = re.compile(
    r"(?<![\d*–—-])(\d{2,6})\s*[-–—]\s*(\d{2,6})\s*[-–—]\s*(\d{2,8})(?:\s*[-–—]\s*(\d{1,4}))?(?!(?:\s*[-–—]\s*\d|\d|\*))"
)
EMAIL_PATTERN = re.compile(r"([A-Za-z0-9_.+-]{1,3})[A-Za-z0-9_.+-]*@([A-Za-z0-9-]+\.[A-Za-z0-9-.]+)")
LABELED_NAME_PATTERN = re.compile(
    r"((?:성명|이름|예금주|수령인|강사명)\s*[:：]\s*)([가-힣]{2,4})(?=$|[\s,()|/\d])"
)
PDOC_BEFORE_NAME_PATTERN = re.compile(
    r"(신분증(?:사본)?|통장\s*사본|이력서|근로기록부|주민등록\s*초본|초본|학위증명서|재직증명서|경력증명서|수료증|개인정보\s*동의(?:서)?|증빙양식)"
    r"([\s_\-(]+)"
    r"([가-힣]{2,4})"
    r"(?=$|[\s_()\-. ,\d])"
)
PDOC_AFTER_NAME_PATTERN = re.compile(
    r"(?:^|(?<=[\s_\-.(]))"
    r"([가-힣]{2,4}?)"
    r"(?:(?=\s*(?:강사|트레이너)[\s_\-]+(?:신분증|통장|이력서))|"
    r"(?=[\s_\-(]+(?:신분증(?:사본)?|통장\s*사본|이력서|근로기록부|(?:주민등록\s*)?초본|교원자격증|자격증|수료증)))"
)
XML_TAG_PATTERN = re.compile(r"<[^>]+>")
WHITESPACE_PATTERN = re.compile(r"\s+")
KOREAN_WORD_PATTERN = re.compile(r"[가-힣A-Za-z0-9]{2,15}")

OS_JUNK_FILENAMES = {".ds_store", "thumbs.db", "desktop.ini"}

NON_PERSON_TOKENS = {
    "신분증", "신분증사본", "사본", "통장", "통장사본", "이력서", "근로기록부", "개인정보", "동의", "동의서",
    "수료증", "강사", "감사", "트레이너", "연수", "연사", "연단", "연맹", "연극", "양식", "서식", "표준", "최종",
    "수정", "별첨", "붙임", "안내", "안내문", "제공", "관련", "계약", "계약서", "물품", "용역", "구매", "내역",
    "증빙", "증빙양식", "주민등록", "주민등록초본", "초본", "등본", "등기부등본", "법인", "법인도장", "사업자",
    "사업자등록증", "재직증명서", "학위증명서", "경력증명서", "증명서", "자격증", "교원자격증", "위촉장", "보안점검",
    "자살예방교육", "교육", "노르딕워킹", "체력", "측정", "강사료", "지급", "온누리상품권", "모바일", "기간제",
    "강남구", "보건소", "강남구보건소", "서울형", "주거래", "건보연", "국민", "신한", "우리", "하나", "농협", "기업",
    "하나은행", "우리은행", "국민은행", "신한은행", "농협은행", "기업은행", "제세부담", "한글",
    "커뮤니디", "메이즈컴퍼니", "스튜디오그레이", "진파트너", "인바디", "지니즈웰", "에이치이", "에이치씨메디칼",
    "제이제이교육", "몽땅희망", "제이엠스포츠", "위드어스", "위더스", "위너스", "위드헬스", "더유니폼", "세움플래닛",
    "드림포", "모두케어스", "예스기술", "엔제이컴퍼니", "애드인", "라이브액션픽쳐스", "푸드스케치", "럭키출판",
    "앤드프로덕션", "제이힐", "글로벌", "스마트링크", "제일손", "서울대학교", "한양대학교", "강남대학교", "상명대학교",
    "양재동",
}

KOREAN_SURNAME_CHARS = set(
    "김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구신라나진민엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용"
)

STOPWORDS = {
    "있음", "없음", "해당", "관련", "대한", "위한", "따른", "통한", "기준", "결과",
    "계획", "보고", "자료", "붙임", "파일", "문서", "작성", "양식", "서식", "안내",
    "요청", "제출", "송부", "알림", "검토", "수정", "최종", "강남구", "보건소",
    "서울특별시", "강남구보건소", "보건행정과", "건강증진팀", "연도", "사업", "운영",
    "추진", "현황", "내역", "목록", "일체", "참고", "별첨",
}


def is_os_metadata_or_lock_file(filename: str) -> bool:
    """Return True for macOS AppleDouble forks (._*), Office locks (~$*), and OS metadata files."""
    if not filename:
        return True
    low = filename.lower()
    if low in OS_JUNK_FILENAMES:
        return True
    if filename.startswith(("._", "~$")):
        return True
    if "__._" in filename:
        return True
    return False


def _mask_korean_name_token(name: str) -> str:
    n = name.strip()
    if len(n) <= 1:
        return n
    if len(n) == 2:
        return f"{n[0]}*"
    return f"{n[0]}{'*' * (len(n) - 2)}{n[-1]}"


def _is_likely_korean_person_name(token: str) -> bool:
    if not (2 <= len(token) <= 4) or not re.fullmatch(r"[가-힣]{2,4}", token):
        return False
    if token in NON_PERSON_TOKENS or token[0] not in KOREAN_SURNAME_CHARS:
        return False
    if len(token) >= 3 and token.endswith("스"):
        return False
    if token.endswith((
        "학교", "대학", "재단", "센터", "은행", "병원", "의원", "약국", "협회", "학회",
        "공사", "공단", "구민", "주민", "사본", "통장", "증명", "교육", "사업", "팀장",
        "과장", "소장", "주임", "선생", "위원", "회장", "원장", "교수", "강사", "박사",
        "헬스", "어스", "컴퍼니", "스포츠", "메디칼", "링크", "기술", "출판", "희망",
    )):
        return False
    return True


def _mask_card(match: re.Match) -> str:
    gs = match.groups()
    if all(g.startswith(("19", "20")) and 1990 <= int(g) <= 2039 for g in gs):
        return match.group(0)
    return f"{gs[0]}-****-****-{gs[3]}"


def _mask_bank_context_account(match: re.Match) -> str:
    prefix, raw_acct = match.group(1), match.group(2)
    digits = re.sub(r"\D", "", raw_acct)
    if len(digits) < 10 or len(digits) > 16:
        return match.group(0)
    parts = [p for p in re.split(r"[\s\-–—]+", raw_acct.strip()) if p]
    if len(parts) == 3 and len(parts[0]) == 3 and len(parts[1]) == 2 and len(parts[2]) == 5:
        return match.group(0)
    if len(parts) >= 2:
        head = parts[0]
        tail = parts[-1] if len(parts[-1]) <= 4 else digits[-4:]
    else:
        head = digits[:4] if len(digits) >= 13 else digits[:3]
        tail = digits[-4:]
    return f"{prefix}{head}-****-{tail}"


def _mask_bank_account(match: re.Match) -> str:
    if re.search(r"\d\s*[-–—]\s*$", match.string[:match.start()]):
        return match.group(0)
    g1, g2, g3, g4 = match.group(1), match.group(2), match.group(3), match.group(4)
    total_digits = len(g1) + len(g2) + len(g3) + (len(g4) if g4 else 0)
    # Preserve 8-digit dates (YYYY-MM-DD) and 10-digit 3-2-5 business registration numbers (사업자등록번호)
    if g4 is None and len(g1) == 3 and len(g2) == 2 and len(g3) == 5:
        return match.group(0)
    if total_digits < 11 or total_digits > 16:
        return match.group(0)
    tail = g4 if g4 else g3[-4:]
    return f"{g1}-****-{tail}"


def _mask_personal_names(text: str) -> str:
    found_names = set()
    for m in PDOC_BEFORE_NAME_PATTERN.finditer(text):
        cand = m.group(3)
        if _is_likely_korean_person_name(cand):
            found_names.add(cand)
    for m in PDOC_AFTER_NAME_PATTERN.finditer(text):
        cand = m.group(1)
        if _is_likely_korean_person_name(cand):
            found_names.add(cand)
    for nm in sorted(found_names, key=len, reverse=True):
        text = text.replace(nm, _mask_korean_name_token(nm))
    text = LABELED_NAME_PATTERN.sub(
        lambda m: f"{m.group(1)}{_mask_korean_name_token(m.group(2))}"
        if _is_likely_korean_person_name(m.group(2))
        else m.group(0),
        text,
    )
    return text


def sanitize_pipa(text: str) -> str:
    """Mask RRN/FRN, Mobile/Landline Phones, Card/Account Numbers, Emails, and Personal-Doc Names per AGENTS.md Rule Q."""
    if not text:
        return ""
    text = CONTROL_CHAR_PATTERN.sub("", text)
    text = BANK_CONTEXT_ACCOUNT_PATTERN.sub(_mask_bank_context_account, text)
    text = NAME_BEFORE_RRN_PATTERN.sub(
        lambda m: _mask_korean_name_token(m.group(1)) + (" (***)" if m.group(2) else "")
        if _is_likely_korean_person_name(m.group(1))
        else m.group(0),
        text,
    )
    text = RRN_PATTERN.sub(r"\1-*******", text)
    text = FRN_PATTERN.sub(r"\1-*******", text)
    text = PHONE_PATTERN.sub(r"\1-****-\3", text)
    text = TEL_PATTERN.sub(lambda m: f"{m.group(1).strip('()')}-***-{m.group(3)}", text)
    text = TEL_NOSEP_PATTERN.sub(r"\1-***-\3", text)
    text = CARD_SEP_PATTERN.sub(_mask_card, text)
    text = CARD_NOSEP_PATTERN.sub(_mask_card, text)
    text = ACCOUNT_PATTERN.sub(_mask_bank_account, text)
    text = EMAIL_PATTERN.sub(r"\1***@\2", text)
    text = _mask_personal_names(text)
    return text


def clean_extracted_text(raw: str, max_len: int = 2500) -> str:
    if not raw:
        return ""
    cleaned = CONTROL_CHAR_PATTERN.sub(" ", raw)
    cleaned = WHITESPACE_PATTERN.sub(" ", cleaned).strip()
    cleaned = sanitize_pipa(cleaned)
    return cleaned[:max_len]


def extract_text_hwpx(filepath: str) -> str:
    try:
        texts = []
        with zipfile.ZipFile(filepath, "r") as zf:
            section_names = sorted([
                n for n in zf.namelist()
                if n.startswith("Contents/section") and n.endswith(".xml")
            ])
            for name in section_names[:3]:
                raw_xml = zf.read(name).decode("utf-8", errors="ignore")
                plain = XML_TAG_PATTERN.sub(" ", raw_xml)
                texts.append(plain)
        return clean_extracted_text(" ".join(texts))
    except Exception:
        return ""


def extract_text_hwp(filepath: str) -> str:
    try:
        import olefile
        if not olefile.isOleFile(filepath):
            # Sometimes .hwp is actually HWPX (zip) or plain text/HTML
            if zipfile.is_zipfile(filepath):
                return extract_text_hwpx(filepath)
            return ""
        with olefile.OleFileIO(filepath) as ole:
            if ole.exists("PrvText"):
                prv_data = ole.openstream("PrvText").read()
                txt = prv_data.decode("utf-16le", errors="ignore")
                cleaned = clean_extracted_text(txt)
                if len(cleaned) >= 20:
                    return cleaned
            # Fallback: decompress BodyText/Section0 for 2026년 files < 5MB
            if "2026년" in filepath and os.path.getsize(filepath) < 5 * 1024 * 1024 and ole.exists("BodyText/Section0"):
                sec_data = ole.openstream("BodyText/Section0").read()
                try:
                    decomp = zlib.decompress(sec_data, -15)
                except Exception:
                    decomp = sec_data
                # Extract printable Korean + ASCII runs from UTF-16LE bytes
                decoded = decomp.decode("utf-16le", errors="ignore")
                hangul_runs = re.findall(r"[가-힣A-Za-z0-9\s\.,\(\)\-\~\%]{4,}", decoded)
                return clean_extracted_text(" ".join(hangul_runs))
    except Exception:
        pass
    return ""


def extract_text_xlsx(filepath: str) -> str:
    try:
        texts = []
        with zipfile.ZipFile(filepath, "r") as zf:
            names = zf.namelist()
            if "xl/workbook.xml" in names:
                wb_xml = zf.read("xl/workbook.xml").decode("utf-8", errors="ignore")
                sheet_names = re.findall(r'name="([^"]+)"', wb_xml)
                if sheet_names:
                    texts.append("시트: " + ", ".join(sheet_names))
            if "xl/sharedStrings.xml" in names:
                ss_xml = zf.read("xl/sharedStrings.xml").decode("utf-8", errors="ignore")
                plain = XML_TAG_PATTERN.sub(" ", ss_xml)
                texts.append(plain)
        return clean_extracted_text(" ".join(texts))
    except Exception:
        return ""


def extract_text_pptx_or_docx(filepath: str) -> str:
    try:
        texts = []
        with zipfile.ZipFile(filepath, "r") as zf:
            target_xmls = sorted([
                n for n in zf.namelist()
                if (n.startswith("ppt/slides/slide") or n.startswith("word/document")) and n.endswith(".xml")
            ])
            for name in target_xmls[:15]:
                raw_xml = zf.read(name).decode("utf-8", errors="ignore")
                plain = XML_TAG_PATTERN.sub(" ", raw_xml)
                texts.append(plain)
        return clean_extracted_text(" ".join(texts))
    except Exception:
        return ""


def extract_text_pdf(filepath: str) -> str:
    try:
        # Fast path: only parse recent (2025/2026) small PDFs (< 2MB) to avoid external drive I/O bottlenecks
        if "2026년" not in filepath and "2025년" not in filepath:
            return ""
        if os.path.getsize(filepath) > 2 * 1024 * 1024:
            return ""
        import fitz
        doc = fitz.open(filepath)
        texts = []
        max_pages = min(len(doc), 2)
        for i in range(max_pages):
            page_txt = doc[i].get_text("text")
            if page_txt:
                texts.append(page_txt)
        doc.close()
        return clean_extracted_text(" ".join(texts))
    except Exception:
        return ""


def extract_text_plain(filepath: str) -> str:
    try:
        with open(filepath, "rb") as f:
            raw = f.read(32768)
        for enc in ("utf-8", "cp949", "utf-16"):
            try:
                txt = raw.decode(enc)
                if "<html" in txt.lower() or "<svg" in txt.lower():
                    txt = XML_TAG_PATTERN.sub(" ", txt)
                return clean_extracted_text(txt)
            except Exception:
                continue
    except Exception:
        pass
    return ""


def extract_document_text(filepath: str, ext: str) -> str:
    if ext == ".hwpx":
        return extract_text_hwpx(filepath)
    if ext == ".hwp":
        return extract_text_hwp(filepath)
    if ext == ".xlsx":
        return extract_text_xlsx(filepath)
    if ext in (".pptx", ".docx"):
        return extract_text_pptx_or_docx(filepath)
    if ext == ".pdf":
        return extract_text_pdf(filepath)
    if ext in (".txt", ".md", ".html", ".svg", ".csv"):
        return extract_text_plain(filepath)
    return ""


def infer_file_date(filename: str, mtime: float) -> str:
    """Extract YYYY-MM-DD from filename patterns (e.g. 20261021, 261021) or fallback to mtime."""
    m8 = re.search(r"(20[12]\d)[.\-_]?([01]\d)[.\-_]?([0-3]\d)", filename)
    if m8:
        y, m, d = m8.group(1), m8.group(2), m8.group(3)
        if 1 <= int(m) <= 12 and 1 <= int(d) <= 31:
            return f"{y}-{m}-{d}"
    m6 = re.search(r"(?<!\d)(2[1-7])([01]\d)([0-3]\d)(?!\d)", filename)
    if m6:
        y, m, d = "20" + m6.group(1), m6.group(2), m6.group(3)
        if 1 <= int(m) <= 12 and 1 <= int(d) <= 31:
            return f"{y}-{m}-{d}"
    return datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")


def classify_image_category(filename: str, rel_dir: str) -> str:
    combined = (filename + " " + rel_dir).lower()
    if any(k in combined for k in ["ci", "로고", "logo", "슬로건", "slogan", "아이콘", "엠블럼"]):
        return "logo"
    if any(k in combined for k in [
        "포스터", "배너", "시안", "현수막", "카드뉴스", "리플릿", "리플렛",
        "브로슈어", "도면", "지도", "레이아웃", "qr", "keyvisual", "디자인",
        "안내문", "멘트",
    ]):
        return "poster"
    return "photo"


def extract_top_keywords(text: str, limit: int = 8) -> list[str]:
    words = KOREAN_WORD_PATTERN.findall(text)
    filtered = [
        w for w in words
        if len(w) >= 2 and not w.isdigit() and w not in STOPWORDS
    ]
    counts = Counter(filtered)
    return [w for w, _ in counts.most_common(limit)]


def build_archive_index():
    t0 = time.time()
    print(f"[INDEX] Scanning and indexing {ARCHIVE_ROOT} (excluding {DUPLICATES_DIR_NAME})...")

    raw_items = []
    folder_keyword_Waitlist = defaultdict(Counter)

    doc_exts = {".hwpx", ".hwp", ".pdf", ".xlsx", ".xls", ".pptx", ".ppt", ".docx", ".txt", ".md", ".html", ".csv"}
    img_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
    design_exts = {".ai", ".psd", ".eps", ".indd"}
    media_exts = {".mp4", ".mov", ".avi", ".mkv", ".mp3", ".wav"}

    file_id_counter = 1

    for dirpath, dirnames, filenames in os.walk(ARCHIVE_ROOT):
        # Skip duplicates archive folder
        dirnames[:] = [d for d in dirnames if d != DUPLICATES_DIR_NAME and not d.startswith("_")]

        rel_dir = os.path.relpath(dirpath, ARCHIVE_ROOT)
        parts = [] if rel_dir == "." else rel_dir.split(os.sep)
        year_folder = parts[0] if len(parts) >= 1 else "기타"
        project_folder = parts[1] if len(parts) >= 2 else "일반"
        sub_folder = "/".join(parts[2:]) if len(parts) >= 3 else ""

        for fname in sorted(filenames):
            if is_os_metadata_or_lock_file(fname):
                continue

            fpath = os.path.join(dirpath, fname)
            try:
                stat = os.stat(_to_win_long_path(fpath))
            except OSError:
                continue

            ext = os.path.splitext(fname)[1].lower()
            inferred_date = infer_file_date(fname, stat.st_mtime)

            if ext in img_exts:
                file_Category = "image"
            elif ext in (".xlsx", ".xls", ".csv"):
                file_Category = "sheet"
            elif ext in (".pptx", ".ppt"):
                file_Category = "slide"
            elif ext in doc_exts:
                file_Category = "doc"
            elif ext in design_exts:
                file_Category = "design"
            elif ext in media_exts:
                file_Category = "media"
            else:
                file_Category = "other"

            body_text = ""
            if file_Category in ("doc", "sheet", "slide"):
                body_text = extract_document_text(fpath, ext)

            safe_display_name = sanitize_pipa(fname)

            # Collect keywords for folder context inheritance using PIPA-sanitized name & body
            path_tokens = KOREAN_WORD_PATTERN.findall(
                f"{project_folder} {sub_folder} {os.path.splitext(safe_display_name)[0]}"
            )
            doc_keywords = extract_top_keywords(f"{safe_display_name} {body_text}", limit=10)
            for kw in path_tokens + doc_keywords:
                if kw not in STOPWORDS and not kw.isdigit() and len(kw) >= 2:
                    folder_keyword_Waitlist[rel_dir][kw] += 2
                    if len(parts) >= 2:
                        parent_key = os.path.join(parts[0], parts[1])
                        folder_keyword_Waitlist[parent_key][kw] += 1

            item = {
                "id": f"arc-{file_id_counter:05d}",
                "name": safe_display_name,
                "rawName": fname,
                "relPath": os.path.relpath(fpath, ARCHIVE_ROOT).replace("\\", "/"),
                "year": year_folder,
                "project": project_folder,
                "subFolder": sub_folder,
                "ext": ext,
                "category": file_Category,
                "size": stat.st_size,
                "date": inferred_date,
                "mtime": int(stat.st_mtime),
                "snippet": body_text[:600] if body_text else "",
                "keywords": doc_keywords[:8],
                "imageCategory": classify_image_category(fname, rel_dir) if file_Category == "image" else None,
                "_relDir": rel_dir,
            }
            raw_items.append(item)
            file_id_counter += 1

    # Second pass: enrich images and generically-named files with inherited folder context keywords
    year_counts = Counter()
    project_counts = Counter()
    category_counts = Counter()

    for item in raw_items:
        rel_dir = item.pop("_relDir")
        parts = [] if rel_dir == "." else rel_dir.split(os.sep)
        parent_key = os.path.join(parts[0], parts[1]) if len(parts) >= 2 else rel_dir

        inherited = [w for w, _ in folder_keyword_Waitlist[rel_dir].most_common(8)]
        if len(inherited) < 5 and parent_key in folder_keyword_Waitlist:
            for w, _ in folder_keyword_Waitlist[parent_key].most_common(8):
                if w not in inherited:
                    inherited.append(w)

        merged_kw = list(dict.fromkeys(item["keywords"] + inherited))[:10]
        item["keywords"] = merged_kw

        # If image or empty snippet, synthesize a descriptive context summary so content search works seamlessly
        if not item["snippet"]:
            proj_clean = re.sub(r"^\d+_", "", item["project"]).replace("_", " ")
            sub_clean = item["subFolder"].replace("_", " ").replace("/", " > ")
            img_label = ""
            if item["imageCategory"] == "photo":
                img_label = "현장·수행 사진 자료"
            elif item["imageCategory"] == "poster":
                img_label = "포스터·현수막·시안 이미지"
            elif item["imageCategory"] == "logo":
                img_label = "CI·로고·슬로건 시각 자산"
            context_parts = [p for p in [item["year"], proj_clean, sub_clean, img_label] if p]
            if merged_kw:
                context_parts.append("연관키워드: " + ", ".join(merged_kw[:6]))
            item["snippet"] = " | ".join(context_parts)

        year_counts[item["year"]] += 1
        project_counts[item["project"]] += 1
        category_counts[item["category"]] += 1

    # Sort newest date first
    raw_items.sort(key=lambda x: (x["date"], x["mtime"]), reverse=True)

    index_payload = {
        "generatedAt": datetime.now().isoformat(),
        "archiveRoot": ARCHIVE_ROOT,
        "totalIndexed": len(raw_items),
        "facets": {
            "years": dict(year_counts.most_common()),
            "projects": dict(project_counts.most_common()),
            "categories": dict(category_counts.most_common()),
        },
        "items": raw_items,
    }

    os.makedirs(os.path.dirname(INDEX_OUTPUT_PATH), exist_ok=True)
    tmp_index_path = f"{INDEX_OUTPUT_PATH}.{os.getpid()}.tmp"
    with open(tmp_index_path, "w", encoding="utf-8") as f:
        json.dump(index_payload, f, ensure_ascii=False)
    os.replace(tmp_index_path, INDEX_OUTPUT_PATH)

    elapsed = time.time() - t0
    print(f"[INDEX] Indexed {len(raw_items)} files in {elapsed:.2f}s -> {INDEX_OUTPUT_PATH}")
    print(f"  Categories: {dict(category_counts)}")
    print(f"  Years     : {dict(year_counts)}")


def main():
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    parser = argparse.ArgumentParser(description="Organize and index F:\\_Organized_Archive")
    parser.add_argument("--organize", action="store_true", help="Organize physical folders losslessly")
    parser.add_argument("--rollback", action="store_true", help="Rollback physical folder movements")
    parser.add_argument("--verify-organization", action="store_true", help="Verify physical organization")
    parser.add_argument("--index", action="store_true", help="Build full-text and photo context index")
    args = parser.parse_args()

    if args.rollback:
        rollback_archive()
        return
    if args.organize:
        organize_archive()
    if args.verify_organization:
        verify_organization()
    if args.index:
        build_archive_index()


if __name__ == "__main__":
    main()
