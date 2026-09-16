"""Public Administrative Mock Document Generator (60 Benchmark Testbed).

Generates 60 diverse, realistic mock public administrative documents strictly matching
public sector file structures and the 4-tier taxonomy hierarchy:
- 4 workflow stages (15 planning, 15 budget, 15 execution, 15 outcome = 60 total).
- 6 document formats: HWPX, HWP, PDF, XLSX, DOCX, TXT (+ binary & zero-byte edge cases).
- Multi-version variants: 5 sets of versioned document families (_v1, _v2, _수정본, _최종, _최최종).
- Exact duplicates: 5 sets of identical SHA-256 files with different filenames.
- 0-byte empty files: 3 files with distinct filenames across stages.
- Binary files: 2 files with identical byte sizes (512 bytes) but distinct SHA-256 hashes.
- Authentic Hancom bullet glyphs (󰏚, ▢, ❍, -) and Korean administrative headers.

CLI Support:
    python -m tools.file_organizer.benchmark.test_generator <output_dir> [--count 60]
"""

import argparse
from dataclasses import dataclass, field
import hashlib
import os
from pathlib import Path
import shutil
import struct
import sys
from typing import Any, Dict, List, Optional
import zipfile

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    import openpyxl
except ImportError:
    openpyxl = None


@dataclass
class BenchmarkItem:
    """Ground truth specification and metadata container for a benchmark document."""
    index: int
    filename: str
    format: str
    expected_year: str
    expected_project: str
    expected_stage: str
    expected_doc_type: str
    title: str
    body: str
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    version_family: Optional[str] = None
    version_tag: Optional[str] = None
    is_zero_byte: bool = False
    is_binary: bool = False
    sha256: str = ""
    size_bytes: int = 0
    actual_path: Optional[Path] = None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize benchmark item to dictionary."""
        return {
            "index": self.index,
            "filename": self.filename,
            "format": self.format,
            "expected_year": self.expected_year,
            "expected_project": self.expected_project,
            "expected_stage": self.expected_stage,
            "expected_doc_type": self.expected_doc_type,
            "title": self.title,
            "body": self.body,
            "is_duplicate": self.is_duplicate,
            "duplicate_of": self.duplicate_of,
            "version_family": self.version_family,
            "version_tag": self.version_tag,
            "is_zero_byte": self.is_zero_byte,
            "is_binary": self.is_binary,
            "sha256": self.sha256,
            "size_bytes": self.size_bytes,
            "actual_path": str(self.actual_path) if self.actual_path else None
        }


# ---------------------------------------------------------------------------
# OLE Compound Document Generator for HWP 5.0
# ---------------------------------------------------------------------------
def _build_mock_ole_file(text: str) -> bytes:
    """Generate a genuine minimal OLE compound file containing a UTF-16LE PrvText stream.

    Allocates 8 sectors (4096 bytes) in the FAT chain so olefile reads standard streams
    without requiring a complex mini-stream FAT.
    """
    # 512-byte header
    hdr = bytearray(512)
    hdr[0:8] = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"  # OLE Magic
    struct.pack_into("<HH", hdr, 24, 0x003E, 0x0003)  # minor/major version
    struct.pack_into("<H", hdr, 28, 0xFFFE)          # little endian byte order
    struct.pack_into("<H", hdr, 30, 9)               # sector shift (512 bytes)
    struct.pack_into("<H", hdr, 32, 6)               # mini sector shift (64 bytes)
    struct.pack_into("<I", hdr, 44, 1)               # num FAT sectors: 1
    struct.pack_into("<I", hdr, 48, 1)               # first directory sector: 1
    struct.pack_into("<I", hdr, 56, 0x1000)          # mini stream cutoff: 4096
    struct.pack_into("<I", hdr, 60, 0xFFFFFFFE)      # first mini FAT: ENDOFCHAIN
    struct.pack_into("<I", hdr, 68, 0xFFFFFFFE)      # first DIFAT: ENDOFCHAIN
    struct.pack_into("<I", hdr, 76, 0)               # FAT sector index 0 in header
    for i in range(1, 109):
        struct.pack_into("<I", hdr, 76 + i * 4, 0xFFFFFFFF)

    # Sector 0: FAT (128 entries of 4 bytes)
    # Sec 0: FAT (-3), Sec 1: DIR (-2), Sec 2..9: Data chain (8 sectors = 4096 bytes)
    fat = bytearray(512)
    struct.pack_into("<I", fat, 0, 0xFFFFFFFD)  # FATSECT
    struct.pack_into("<I", fat, 4, 0xFFFFFFFE)  # ENDOFCHAIN for dir
    for s in range(2, 9):
        struct.pack_into("<I", fat, s * 4, s + 1)
    struct.pack_into("<I", fat, 9 * 4, 0xFFFFFFFE)  # ENDOFCHAIN for data
    for s in range(10, 128):
        struct.pack_into("<I", fat, s * 4, 0xFFFFFFFF)

    # Sector 1: Directory sector (4 entries of 128 bytes)
    dir_sec = bytearray(512)
    root_name = "Root Entry\0".encode("utf-16-le")
    dir_sec[0:len(root_name)] = root_name
    struct.pack_into("<H", dir_sec, 64, len(root_name))
    dir_sec[66] = 5  # STGTY_ROOT
    dir_sec[67] = 1  # DE_BLACK
    struct.pack_into("<I", dir_sec, 68, 0xFFFFFFFF)  # left
    struct.pack_into("<I", dir_sec, 72, 0xFFFFFFFF)  # right
    struct.pack_into("<I", dir_sec, 76, 1)           # child = entry 1 (PrvText)
    struct.pack_into("<I", dir_sec, 116, 0xFFFFFFFE)
    struct.pack_into("<I", dir_sec, 120, 0)

    # Entry 1: PrvText stream
    stream_name = "PrvText\0".encode("utf-16-le")
    off1 = 128
    dir_sec[off1:off1 + len(stream_name)] = stream_name
    struct.pack_into("<H", dir_sec, off1 + 64, len(stream_name))
    dir_sec[off1 + 66] = 2  # STGTY_STREAM
    dir_sec[off1 + 67] = 1  # DE_BLACK
    struct.pack_into("<I", dir_sec, off1 + 68, 0xFFFFFFFF)
    struct.pack_into("<I", dir_sec, off1 + 72, 0xFFFFFFFF)
    struct.pack_into("<I", dir_sec, off1 + 76, 0xFFFFFFFF)
    struct.pack_into("<I", dir_sec, off1 + 116, 2)  # start sector: 2
    raw_data = text.encode("utf-16-le")
    padded = raw_data.ljust(4096, b"\x00")
    struct.pack_into("<I", dir_sec, off1 + 120, len(padded))

    return bytes(hdr + fat + dir_sec + padded)


# ---------------------------------------------------------------------------
# Format Specific Writers
# ---------------------------------------------------------------------------
def _write_hwpx(path: Path, title: str, body: str) -> None:
    """Create a realistic Hancom HWPX file with paragraph and bullet tags."""
    xml_content = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" '
        'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">\n'
        f'  <hp:p><hp:t>󰏚 {title}</hp:t></hp:p>\n'
        f'  <hp:p><hp:t>▢ 추진 배경 및 목적</hp:t></hp:p>\n'
        f'  <hp:p><hp:t>❍ 주요 사업 내용: {body}</hp:t></hp:p>\n'
        f'  <hp:p><hp:t>- 세부 추진 지침 및 세부 일정</hp:t></hp:p>\n'
        f'  <hp:p><hp:t>시행일자: 2026. 9. 16. 등록번호: 보건행정과-10405</hp:t></hp:p>\n'
        '</hs:sec>'
    )
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("Contents/section0.xml", xml_content.encode("utf-8"))
        z.writestr("mimetype", "application/hwp+zip".encode("utf-8"))


def _write_hwp(path: Path, title: str, body: str) -> None:
    """Create a realistic legacy HWP 5.0 OLE file with Hancom bullet headers."""
    full_text = (
        f"󰏚 {title}\n"
        f"▢ 추진 배경 및 필요성\n"
        f"❍ 주요 내용: {body}\n"
        f"- 세부 실행 지침 및 일정 계획\n"
        f"시행일자: 2026. 9. 16. 등록번호: 보건행정과-10405\n"
        f"수신  내부결재"
    )
    ole_bytes = _build_mock_ole_file(full_text)
    path.write_bytes(ole_bytes)


def _write_pdf(path: Path, title: str, body: str) -> None:
    """Create a realistic PDF file using PyMuPDF if available."""
    full_text = (
        f"󰏚 {title}\n\n"
        f"▢ 추진 배경 및 목적\n"
        f"❍ 주요 내용: {body}\n"
        f"- 세부 추진 지침 및 일정\n"
        f"시행일자: 2026. 9. 16. 등록번호: 보건행정과-10405"
    )
    if fitz:
        doc = fitz.open()
        page = doc.new_page()
        font_kwargs = {}
        font_path = "C:/Windows/Fonts/malgun.ttf"
        if os.path.exists(font_path):
            font_kwargs = {"fontname": "malgun", "fontfile": font_path}
        page.insert_text((50, 72), full_text, **font_kwargs)
        doc.save(str(path))
        doc.close()
    else:
        path.write_bytes(f"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n{full_text}".encode("utf-8"))


def _write_xlsx(path: Path, title: str, body: str) -> None:
    """Create a realistic Excel workbook with tabular administrative items."""
    if openpyxl:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "행정데이터"
        ws.append(["󰏚 문서명", title])
        ws.append(["▢ 서식유형", "공공행정 표준예산집행서식"])
        ws.append(["❍ 등록번호", "보건행정과-10405", "시행일자", "2026. 9. 16."])
        ws.append(["- 세부내용", body])
        ws.append([])
        ws.append(["연번", "품목명 및 과업내용", "수량", "단가(원)", "소요금액(원)", "비고"])
        ws.append([1, "행사용품 및 물품제작", 1, 5000000, 5000000, "일반경비"])
        ws.append([2, "홍보물 인쇄 및 홍보배너", 2, 1200000, 2400000, "홍보물품"])
        ws.append([3, "현장 진행요원 인건비", 5, 100000, 500000, "지급조서"])
        wb.save(str(path))
    else:
        shared_strings = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">\n'
            f'  <si><t>󰏚 {title}</t></si>\n'
            f'  <si><t>▢ 공공서식</t></si>\n'
            f'  <si><t>❍ {body}</t></si>\n'
            '  <si><t>- 세부내역</t></si>\n'
            '</sst>'
        )
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr("xl/sharedStrings.xml", shared_strings.encode("utf-8"))


def _write_docx(path: Path, title: str, body: str) -> None:
    """Create a realistic Word document with public administrative XML tags."""
    doc_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n'
        '  <w:body>\n'
        f'    <w:p><w:r><w:t>󰏚 {title}</w:t></w:r></w:p>\n'
        f'    <w:p><w:r><w:t>▢ 추진 배경 및 검토 보고</w:t></w:r></w:p>\n'
        f'    <w:p><w:r><w:t>❍ 주요 사업 내용: {body}</w:t></w:r></w:p>\n'
        f'    <w:p><w:r><w:t>- 세부 추진 지침</w:t></w:r></w:p>\n'
        f'    <w:p><w:r><w:t>시행일자: 2026. 9. 16. 등록번호: 보건행정과-10405</w:t></w:r></w:p>\n'
        '  </w:body>\n'
        '</w:document>'
    )
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("word/document.xml", doc_xml.encode("utf-8"))


def _write_txt(path: Path, title: str, body: str, encoding: str = "utf-8") -> None:
    """Create a plain text document with Korean administrative headers."""
    content = (
        f"󰏚 {title}\n"
        f"▢ 추진 배경 및 필요성\n"
        f"❍ 주요 내용: {body}\n"
        f"- 세부 추진 지침 및 세부 일정\n"
        f"※ 행정 유의사항 및 보안 지침 준수\n"
        f"시행일자: 2026. 9. 16. 등록번호: 보건행정과-10405\n"
        f"수신  내부결재\n"
    )
    path.write_bytes(content.encode(encoding))


# ---------------------------------------------------------------------------
# Definitive 60-File Ground Truth Master Roster
# ---------------------------------------------------------------------------
BENCHMARK_ROSTER: List[Dict[str, Any]] = [
    # =========================================================================
    # STAGE 1: 01_기획·품의 (Planning & Approval - 15 Files)
    # =========================================================================
    {
        "index": 1,
        "filename": "2026_양재천_건강페스티벌_추진계획_v1.hwpx",
        "format": "hwpx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "계획서",
        "title": "2026년 양재천 건강 페스티벌 세부 추진계획(안)",
        "body": "지역주민 건강증진 및 양재천 걷기 운동 활성화를 위한 종합 실행계획안",
        "version_family": "2026_양재천_건강페스티벌_추진계획",
        "version_tag": "v1"
    },
    {
        "index": 2,
        "filename": "2026_양재천_건강페스티벌_추진계획_v2.hwpx",
        "format": "hwpx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "계획서",
        "title": "2026년 양재천 건강 페스티벌 세부 추진계획 v2",
        "body": "안전관리 요원 증원 및 코스 연계 수정안 반영 추진계획서",
        "version_family": "2026_양재천_건강페스티벌_추진계획",
        "version_tag": "v2"
    },
    {
        "index": 3,
        "filename": "2026_양재천_건강페스티벌_추진계획_수정본.hwpx",
        "format": "hwpx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "계획서",
        "title": "2026년 양재천 건강 페스티벌 세부 추진계획 (수정본)",
        "body": "관계부서 의견수렴 및 무대배치 수정사항 반영 계획안",
        "version_family": "2026_양재천_건강페스티벌_추진계획",
        "version_tag": "수정본"
    },
    {
        "index": 4,
        "filename": "2026_양재천_건강페스티벌_추진계획_최종.hwpx",
        "format": "hwpx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "계획서",
        "title": "2026년 양재천 건강 페스티벌 세부 추진계획 (최종)",
        "body": "구청장 방침결재 완료 본 추진계획서",
        "version_family": "2026_양재천_건강페스티벌_추진계획",
        "version_tag": "최종"
    },
    {
        "index": 5,
        "filename": "2026_양재천_건강페스티벌_추진계획_최최종.hwpx",
        "format": "hwpx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "계획서",
        "title": "2026년 양재천 건강 페스티벌 세부 추진계획 (최최종)",
        "body": "최종 현장 운영 배치표 첨부본",
        "version_family": "2026_양재천_건강페스티벌_추진계획",
        "version_tag": "최최종"
    },
    {
        "index": 6,
        "filename": "2026년_AI메디헬스_키오스크_구매_기안문.hwp",
        "format": "hwp",
        "expected_year": "2026년",
        "expected_project": "AI_메디헬스_스마트케어",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "기안_품의서",
        "title": "2026년 강남구 AI 메디헬스 스마트케어 센터 무인 키오스크 도입 기안문",
        "body": "스마트 헬스케어 체형분석 키오스크 조달 구매 내부결재 기안문"
    },
    {
        "index": 7,
        "filename": "2026_바른자세_체형교정_추진계획서.docx",
        "format": "docx",
        "expected_year": "2026년",
        "expected_project": "바른자세_체형교정",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "계획서",
        "title": "2026년 청소년 척추측만 및 바른자세 체형교정 사업 연간 추진계획서",
        "body": "관내 초중고 대상 척추측만 조기검진 및 바른자세 프로그램 운영계획"
    },
    {
        "index": 8,
        "filename": "2025_바른자세_척추측만증_기본계획_초안.pdf",
        "format": "pdf",
        "expected_year": "2025년",
        "expected_project": "바른자세_체형교정",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "계획서",
        "title": "2025년도 바른자세 척추측만증 예방관리 시범사업 기본계획안",
        "body": "시범학교 선정 및 체형교정 교구 보급 기본계획 초안"
    },
    {
        "index": 9,
        "filename": "2027_신체활동_건강생활실천_중장기_기본계획.hwpx",
        "format": "hwpx",
        "expected_year": "2027년",
        "expected_project": "신체활동_건강생활실천",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "계획서",
        "title": "2027-2030 강남구 신체활동 및 건강생활실천 중장기 종합발전계획",
        "body": "구민 걷기 실천율 향상 및 공공PT 운동처방 체계 수립 계획서"
    },
    {
        "index": 10,
        "filename": "260315_비만예방_건강뜀_사업기획안.hwp",
        "format": "hwp",
        "expected_year": "2026년",
        "expected_project": "비만예방_건강뜀",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "계획서",
        "title": "2026년 비만예방 건강뜀 줄넘기 교실 상반기 사업기획안",
        "body": "중년여성 및 아동 비만율 완화를 위한 건강뜀 교실 기획안"
    },
    {
        "index": 11,
        "filename": "2026_구정주요업무보고_기획총괄_행정보고서.txt",
        "format": "txt",
        "expected_year": "2026년",
        "expected_project": "주요업무보고_기획총괄",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "기안_품의서",
        "title": "2026년도 보건소 구정주요업무보고 및 의회보고 총괄",
        "body": "구정 핵심 공약사업 및 건강증진과 주요업무 추진계획 보고자료"
    },
    {
        "index": 12,
        "filename": "2026_서울체력장_체력인증센터_운영계획서.txt",
        "format": "txt",
        "expected_year": "2026년",
        "expected_project": "서울체력장_체력인증센터",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "계획서",
        "title": "2026년 서울체력장 체력인증센터 체력측정 연간 운영계획서",
        "body": "국민체력100 연계 및 체성분측정 장비 운영 종합계획서"
    },
    {
        "index": 13,
        "filename": "2026년_구의회_주요업무보고_기획총괄.hwpx",
        "format": "hwpx",
        "expected_year": "2026년",
        "expected_project": "주요업무보고_기획총괄",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "기안_품의서",
        "title": "2026년도 강남구의회 임시회 주요업무보고(건강증진과)",
        "body": "의회 상임위원회 주요업무 실적 및 향후계획 보고안"
    },
    {
        "index": 14,
        "filename": "2025_어린이신체활동_아이뛰움_운영계획안.pdf",
        "format": "pdf",
        "expected_year": "2025년",
        "expected_project": "어린이신체활동_아이뛰움",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "계획서",
        "title": "2025년 영유아 신체활동 아이뛰움 프로그램 운영계획안",
        "body": "어린이집 및 유치원 방문 신체활동 놀이 프로그램 계획서"
    },
    {
        "index": 15,
        "filename": "2026_양재천_건강페스티벌_기본계획_공란.hwpx",
        "format": "hwpx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "01_기획·품의",
        "expected_doc_type": "계획서",
        "title": "",
        "body": "",
        "is_zero_byte": True
    },

    # =========================================================================
    # STAGE 2: 02_예산·지출 (Budget & Expenditure - 15 Files)
    # =========================================================================
    {
        "index": 16,
        "filename": "2026_서울체력장_체력측정장비_구매_지출결의서.xlsx",
        "format": "xlsx",
        "expected_year": "2026년",
        "expected_project": "서울체력장_체력인증센터",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "계약_지출서류",
        "title": "서울체력장 체력측정 및 체형분석기 구매 지출결의서",
        "body": "소요예산 15,000,000원 지출결의 및 검수완료 확인서"
    },
    {
        "index": 17,
        "filename": "20260715_AI메디헬스_키오스크_구매_산출내역서_초안.xlsx",
        "format": "xlsx",
        "expected_year": "2026년",
        "expected_project": "AI_메디헬스_스마트케어",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "사업설명서",
        "title": "2026년 AI 메디헬스 스마트케어 키오스크 구매 예산 산출내역서 (초안)",
        "body": "단가산출표 및 세부 수량 산출내역서 초안",
        "version_family": "20260715_AI메디헬스_키오스크_구매_산출내역서",
        "version_tag": "초안"
    },
    {
        "index": 18,
        "filename": "20260715_AI메디헬스_키오스크_구매_산출내역서_최종.xlsx",
        "format": "xlsx",
        "expected_year": "2026년",
        "expected_project": "AI_메디헬스_스마트케어",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "사업설명서",
        "title": "2026년 AI 메디헬스 스마트케어 키오스크 구매 예산 산출내역서 (최종)",
        "body": "조달 수수료 반영 최종 예산 산출내역서",
        "version_family": "20260715_AI메디헬스_키오스크_구매_산출내역서",
        "version_tag": "최종"
    },
    {
        "index": 19,
        "filename": "2026_AI메디헬스_장비구매_비교견적서.pdf",
        "format": "pdf",
        "expected_year": "2026년",
        "expected_project": "AI_메디헬스_스마트케어",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "견적서",
        "title": "AI 메디헬스 체형분석기 및 스마트케어 장비 비교견적서",
        "body": "납품업체 3개사 단가 비교견적 및 최저가 선정 검토서"
    },
    {
        "index": 20,
        "filename": "2026_AI메디헬스_장비구매_비교견적서_사본.pdf",
        "format": "pdf",
        "expected_year": "2026년",
        "expected_project": "AI_메디헬스_스마트케어",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "견적서",
        "title": "AI 메디헬스 체형분석기 및 스마트케어 장비 비교견적서",
        "body": "납품업체 3개사 단가 비교견적 및 최저가 선정 검토서",
        "is_duplicate": True,
        "duplicate_of": "2026_AI메디헬스_장비구매_비교견적서.pdf"
    },
    {
        "index": 21,
        "filename": "2026_바른자세_체형교정_장비임대_비교견적서.xlsx",
        "format": "xlsx",
        "expected_year": "2026년",
        "expected_project": "바른자세_체형교정",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "견적서",
        "title": "바른자세 체형교정 척추측만 측정장비 임대 비교견적서",
        "body": "월간 임대료 및 유지보수 비용 비교견적"
    },
    {
        "index": 22,
        "filename": "2026_AI메디헬스_장비구매_수의계약_사유서.hwp",
        "format": "hwp",
        "expected_year": "2026년",
        "expected_project": "AI_메디헬스_스마트케어",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "계약_지출서류",
        "title": "AI 메디헬스 전산시스템 연동 장비 수의계약 사유서",
        "body": "지방계약법 시행령 제25조에 따른 특정 규격 수의계약 사유서"
    },
    {
        "index": 23,
        "filename": "2026_양재천_기념품_제작_구매_지출품의서.hwpx",
        "format": "hwpx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "계약_지출서류",
        "title": "2026 양재천 건강축제 참가자 기념품 구매 지출품의서",
        "body": "완보 기념품 1,000개 제작 및 구매 소요예산 품의서"
    },
    {
        "index": 24,
        "filename": "2025_비만예방교실_건강뜀_강사료_지출결의서.xlsx",
        "format": "xlsx",
        "expected_year": "2025년",
        "expected_project": "비만예방_건강뜀",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "계약_지출서류",
        "title": "2025년 하반기 비만예방 건강뜀교실 전문강사 수당 지출결의서",
        "body": "강사수당 원천징수 영수증 및 지급조서 지출결의"
    },
    {
        "index": 25,
        "filename": "2025_비만예방교실_건강뜀_강사료_지출결의서_복사본.xlsx",
        "format": "xlsx",
        "expected_year": "2025년",
        "expected_project": "비만예방_건강뜀",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "계약_지출서류",
        "title": "2025년 하반기 비만예방 건강뜀교실 전문강사 수당 지출결의서",
        "body": "강사수당 원천징수 영수증 및 지급조서 지출결의",
        "is_duplicate": True,
        "duplicate_of": "2025_비만예방교실_건강뜀_강사료_지출결의서.xlsx"
    },
    {
        "index": 26,
        "filename": "2026_특별조정교부금_예산재배정_방침서.docx",
        "format": "docx",
        "expected_year": "2026년",
        "expected_project": "일반행정_예산회계",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "계약_지출서류",
        "title": "2026년도 서울시 특별조정교부금 예산재배정 방침서",
        "body": "시비 보조금 예산배정 및 집행계획 방침서"
    },
    {
        "index": 27,
        "filename": "2026_양재천_축제물품_구매계약서.pdf",
        "format": "pdf",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "계약_지출서류",
        "title": "2026년 양재천 건강 페스티벌 축제물품 조달 구매계약서",
        "body": "무대음향 장비 및 행사장 부스 임대 표준 구매계약서"
    },
    {
        "index": 28,
        "filename": "2026_양재천_축제물품_구매계약서_사본.pdf",
        "format": "pdf",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "계약_지출서류",
        "title": "2026년 양재천 건강 페스티벌 축제물품 조달 구매계약서",
        "body": "무대음향 장비 및 행사장 부스 임대 표준 구매계약서",
        "is_duplicate": True,
        "duplicate_of": "2026_양재천_축제물품_구매계약서.pdf"
    },
    {
        "index": 29,
        "filename": "2025_공통행정_출장여비_일상경비_지출내역서.xlsx",
        "format": "xlsx",
        "expected_year": "2025년",
        "expected_project": "일반행정_예산회계",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "계약_지출서류",
        "title": "2025년도 보건소 공통행정 직원 출장여비 일상경비 지출내역서",
        "body": "관내 출장여비 및 소모품 일상경비 지출집행 내역서"
    },
    {
        "index": 30,
        "filename": "2026_비만예방_건강뜀_소요예산_산출내역_공란.xlsx",
        "format": "xlsx",
        "expected_year": "2026년",
        "expected_project": "비만예방_건강뜀",
        "expected_stage": "02_예산·지출",
        "expected_doc_type": "사업설명서",
        "title": "",
        "body": "",
        "is_zero_byte": True
    },

    # =========================================================================
    # STAGE 3: 03_집행·행사 (Execution & Event - 15 Files)
    # =========================================================================
    {
        "index": 31,
        "filename": "2026_양재천_건강축제_개막식_행사계획안.hwpx",
        "format": "hwpx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "계획서",
        "title": "2026년 양재천 건강축제 개막식 세부 행사계획안",
        "body": "식순, 의전, 내빈초청 및 개막식 현장 운영 세부계획"
    },
    {
        "index": 32,
        "filename": "2026_양재천_개막식_사회자_대본_수정본.hwp",
        "format": "hwp",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "홍보_행사자료",
        "title": "2026 양재천 건강축제 개막식 사회자 표준 진행대본 (수정본)",
        "body": "대통령훈령 제438호 약식절차 1 국민의례 반영 사회자 시나리오",
        "version_family": "2026_양재천_개막식_사회자_대본",
        "version_tag": "수정본"
    },
    {
        "index": 33,
        "filename": "2026_양재천_개막식_사회자_대본_최종.hwp",
        "format": "hwp",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "홍보_행사자료",
        "title": "2026 양재천 건강축제 개막식 사회자 표준 진행대본 (최종)",
        "body": "내빈소개 및 출발 징 세레머니 완료본 대본",
        "version_family": "2026_양재천_개막식_사회자_대본",
        "version_tag": "최종"
    },
    {
        "index": 34,
        "filename": "2026_AI메디헬스_개소식_식순_시나리오.docx",
        "format": "docx",
        "expected_year": "2026년",
        "expected_project": "AI_메디헬스_스마트케어",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "홍보_행사자료",
        "title": "AI 메디헬스 스마트케어 센터 개소식 식순 및 행사시나리오",
        "body": "테이프 커팅식, 현판 제막식 및 장비 시연 진행순서 시나리오"
    },
    {
        "index": 35,
        "filename": "2026_양재천_리플릿_홍보문안_배포용.pdf",
        "format": "pdf",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "홍보_행사자료",
        "title": "2026 양재천 건강 걷기축제 구민 리플릿 홍보문안",
        "body": "코스 안내도 및 스탬프투어 리워드 수령 안내 홍보물"
    },
    {
        "index": 36,
        "filename": "2026_바른자세_체형교정_찾아가는검진_현장운영일지.xlsx",
        "format": "xlsx",
        "expected_year": "2026년",
        "expected_project": "바른자세_체형교정",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "홍보_행사자료",
        "title": "2026년 바른자세 체형교정 찾아가는 검진 현장운영일지",
        "body": "검진 인원 및 현장 조치내역 일일 운영일지 기록부"
    },
    {
        "index": 37,
        "filename": "2026_비만예방_건강뜀교실_참석자_서명부.xlsx",
        "format": "xlsx",
        "expected_year": "2026년",
        "expected_project": "비만예방_건강뜀",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "서식_명단",
        "title": "2026 비만예방 건강뜀 운동교실 1기 참석자 출석 및 서명부",
        "body": "수강생 30명 출석 서명 및 개인정보동의 명부"
    },
    {
        "index": 38,
        "filename": "2025_양재천_건강축제_자원봉사자_배치도.pdf",
        "format": "pdf",
        "expected_year": "2025년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "홍보_행사자료",
        "title": "2025 양재천 걷기 페스티벌 안전요원 및 자원봉사자 배치도",
        "body": "밀미리다리, 영동2교 주요 거점 자원봉사자 구역별 배치도"
    },
    {
        "index": 39,
        "filename": "2026_바른자세_체형교정_학부모_안내문.hwpx",
        "format": "hwpx",
        "expected_year": "2026년",
        "expected_project": "바른자세_체형교정",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "홍보_행사자료",
        "title": "2026년 학생 바른자세 체형교정 검진 학부모 가정통신 안내문",
        "body": "검진 일정 및 체형분석 결과 확인방법 학부모 안내문"
    },
    {
        "index": 40,
        "filename": "2026_바른자세_체형교정_학부모_안내문_배포본.hwpx",
        "format": "hwpx",
        "expected_year": "2026년",
        "expected_project": "바른자세_체형교정",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "홍보_행사자료",
        "title": "2026년 학생 바른자세 체형교정 검진 학부모 가정통신 안내문",
        "body": "검진 일정 및 체형분석 결과 확인방법 학부모 안내문",
        "is_duplicate": True,
        "duplicate_of": "2026_바른자세_체형교정_학부모_안내문.hwpx"
    },
    {
        "index": 41,
        "filename": "2026_AI메디헬스_참여자_사전_설문조사지.hwp",
        "format": "hwp",
        "expected_year": "2026년",
        "expected_project": "AI_메디헬스_스마트케어",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "서식_명단",
        "title": "AI 메디헬스 스마트케어 참여 구민 사전 건강행태 설문조사지",
        "body": "신체활동 수준 및 만성질환 이력 사전 설문조사 양식"
    },
    {
        "index": 42,
        "filename": "2025_건강뜀_비만예방_하반기_현장운영일지.txt",
        "format": "txt",
        "expected_year": "2025년",
        "expected_project": "비만예방_건강뜀",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "홍보_행사자료",
        "title": "2025년 하반기 비만예방 건강뜀 교실 현장운영일지",
        "body": "프로그램 진행 회차별 출석 및 운동처방 현장일지"
    },
    {
        "index": 43,
        "filename": "2026_양재천_코스_안내현수막_홍보문안.docx",
        "format": "docx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "홍보_행사자료",
        "title": "2026 양재천 건강 걷기행사 코스 주요 지점 현수막 홍보문안",
        "body": "출발선, 반환점, 급수대 현수막 및 안내 표지판 문안"
    },
    {
        "index": 44,
        "filename": "2026_양재천_페스티벌_홍보포스터_시안A.bin",
        "format": "bin",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "홍보_행사자료",
        "title": "양재천 홍보포스터 시안 A",
        "body": "",
        "is_binary": True
    },
    {
        "index": 45,
        "filename": "2026_양재천_페스티벌_홍보포스터_시안B.bin",
        "format": "bin",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "03_집행·행사",
        "expected_doc_type": "홍보_행사자료",
        "title": "양재천 홍보포스터 시안 B",
        "body": "",
        "is_binary": True
    },

    # =========================================================================
    # STAGE 4: 04_결과보고·정산 (Outcome & Settlement - 15 Files)
    # =========================================================================
    {
        "index": 46,
        "filename": "2025년_심뇌혈관질환_예방관리_사업결과보고서.hwpx",
        "format": "hwpx",
        "expected_year": "2025년",
        "expected_project": "심뇌혈관질환_예방관리",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "2025년 심뇌혈관질환 예방관리 및 만성질환 등록관리 최종 결과보고서",
        "body": "혈압 혈당 인지율 개선 및 고위험군 사후관리 최종 사업결과보고서"
    },
    {
        "index": 47,
        "filename": "2025_심뇌혈관질환_예방관리_결과보고_요약.pdf",
        "format": "pdf",
        "expected_year": "2025년",
        "expected_project": "심뇌혈관질환_예방관리",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "2025년 심뇌혈관질환 예방관리 사업결과 요약보고",
        "body": "주요 성과지표 달성도 및 전년대비 개선율 요약 결과보고서"
    },
    {
        "index": 48,
        "filename": "2026_양재천_걷자페스티벌_사업결과보고서.docx",
        "format": "docx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "2026 양재천 건강 걷자 페스티벌 종합 사업결과보고서",
        "body": "참가자 2,500명 참여 실적 및 구민 만족도 94.8점 달성 결과보고서",
        "version_family": "2026_양재천_걷자페스티벌_사업결과보고서"
    },
    {
        "index": 49,
        "filename": "2026_양재천_걷자페스티벌_사업결과보고서_배포용.docx",
        "format": "docx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "2026 양재천 건강 걷자 페스티벌 종합 사업결과보고서 (배포용)",
        "body": "언론 배포 및 보도자료용 주요 성과 요약 결과보고서",
        "version_family": "2026_양재천_걷자페스티벌_사업결과보고서",
        "version_tag": "배포용"
    },
    {
        "index": 50,
        "filename": "2026_양재천_행사보조금_집행_정산검사서.xlsx",
        "format": "xlsx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "정산_결산서",
        "title": "2026년 양재천 건강축제 구비보조금 집행 회계 정산검사서",
        "body": "보조금 45,000,000원 지출 증빙 및 집행잔액 반납 정산서"
    },
    {
        "index": 51,
        "filename": "2026_바른자세_체형교정_성과평가보고서_v1.docx",
        "format": "docx",
        "expected_year": "2026년",
        "expected_project": "바른자세_체형교정",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "2026년 청소년 바른자세 체형교정 사업 성과평가보고서 (v1)",
        "body": "척추측만 개선율 18.5% 개선 효과분석 초안 결과보고서",
        "version_family": "2026_바른자세_체형교정_성과평가보고서",
        "version_tag": "v1"
    },
    {
        "index": 52,
        "filename": "2026_바른자세_체형교정_성과평가보고서_최종.docx",
        "format": "docx",
        "expected_year": "2026년",
        "expected_project": "바른자세_체형교정",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "2026년 청소년 바른자세 체형교정 사업 성과평가보고서 (최종)",
        "body": "자문교수 검토의견서 반영 최종 성과평가보고서",
        "version_family": "2026_바른자세_체형교정_성과평가보고서",
        "version_tag": "최종"
    },
    {
        "index": 53,
        "filename": "2026_바른자세_척추측만_개선율_통계_실적보고서.xlsx",
        "format": "xlsx",
        "expected_year": "2026년",
        "expected_project": "바른자세_체형교정",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "2026년 관내 학교별 척추측만 개선율 전후비교 통계 실적보고서",
        "body": "통계 데이터 분석 및 개선도 측정 결과 실적보고서"
    },
    {
        "index": 54,
        "filename": "2025_비만예방_건강뜀_영양교실_운영_결과보고서.pdf",
        "format": "pdf",
        "expected_year": "2025년",
        "expected_project": "비만예방_건강뜀",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "2025년 비만예방 건강뜀 및 식습관 영양교실 종합 결과보고서",
        "body": "체질량지수(BMI) 감소 실적 및 설문결과 사업결과보고서"
    },
    {
        "index": 55,
        "filename": "2026_AI메디헬스_장비도입_완료_검수결과보고서.hwpx",
        "format": "hwpx",
        "expected_year": "2026년",
        "expected_project": "AI_메디헬스_스마트케어",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "AI 메디헬스 스마트케어 센터 무인 키오스크 검수 완료 결과보고서",
        "body": "납품 규격 적합성 판정 및 시운전 통과 완료 검수결과보고서"
    },
    {
        "index": 56,
        "filename": "2025_구정주요업무_상반기_추진실적보고서.hwpx",
        "format": "hwpx",
        "expected_year": "2025년",
        "expected_project": "주요업무보고_기획총괄",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "2025년도 상반기 보건분야 구정주요업무 추진실적보고서",
        "body": "주요 지표 달성 실적 및 하반기 보완계획 결과보고"
    },
    {
        "index": 57,
        "filename": "2024_어린이신체활동_아이뛰움_사업_정산보고서.pdf",
        "format": "pdf",
        "expected_year": "2024년",
        "expected_project": "어린이신체활동_아이뛰움",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "정산_결산서",
        "title": "2024년도 영유아 어린이신체활동 아이뛰움 사업 보조금 정산보고서",
        "body": "회계연도 마감 보조금 집행 정산검사 및 결산서"
    },
    {
        "index": 58,
        "filename": "2026_양재천_건강축제_만족도조사_결과보고서.xlsx",
        "format": "xlsx",
        "expected_year": "2026년",
        "expected_project": "양재천_건강축제_페스티벌",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "2026 양재천 건강 페스티벌 참가 구민 만족도조사 결과보고서",
        "body": "응답자 850명 코스 만족도 및 리워드 만족도 통계분석 결과보고서"
    },
    {
        "index": 59,
        "filename": "2026_심뇌혈관질환_예방관리_결과보고_요약_사본.pdf",
        "format": "pdf",
        "expected_year": "2025년",
        "expected_project": "심뇌혈관질환_예방관리",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "2025년 심뇌혈관질환 예방관리 사업결과 요약보고",
        "body": "주요 성과지표 달성도 및 전년대비 개선율 요약 결과보고서",
        "is_duplicate": True,
        "duplicate_of": "2025_심뇌혈관질환_예방관리_결과보고_요약.pdf"
    },
    {
        "index": 60,
        "filename": "2026_AI메디헬스_회계검사_감사결과보고서_공란.txt",
        "format": "txt",
        "expected_year": "2026년",
        "expected_project": "AI_메디헬스_스마트케어",
        "expected_stage": "04_결과보고·정산",
        "expected_doc_type": "결과보고서",
        "title": "",
        "body": "",
        "is_zero_byte": True
    },
]


def generate_benchmark_dataset(
    output_dir: Path | str,
    count: int = 60
) -> List[BenchmarkItem]:
    """Generate the complete mock administrative document benchmark dataset.

    Args:
        output_dir: Target directory path where files will be created.
        count: Total number of files to generate (default: 60).

    Returns:
        List of BenchmarkItem instances populated with actual paths, SHA-256 hashes,
        and sizes.
    """
    out_path = Path(output_dir).resolve()
    out_path.mkdir(parents=True, exist_ok=True)

    items_to_generate = BENCHMARK_ROSTER[:count]
    generated_items: List[BenchmarkItem] = []
    generated_paths_by_name: Dict[str, Path] = {}

    for spec in items_to_generate:
        fn = spec["filename"]
        fmt = spec["format"]
        target_file = out_path / fn
        title = spec.get("title", fn)
        body = spec.get("body", "")

        is_dup = spec.get("is_duplicate", False)
        dup_of = spec.get("duplicate_of")
        is_zero = spec.get("is_zero_byte", False)
        is_bin = spec.get("is_binary", False)

        if is_zero:
            target_file.write_bytes(b"")
        elif is_dup and dup_of and dup_of in generated_paths_by_name:
            # Replicate exact bytes of original for 100% SHA-256 match
            shutil.copy2(generated_paths_by_name[dup_of], target_file)
        elif is_bin:
            # Fixed 512 bytes with distinctive character pattern for same-size binary files
            char = b"A" if "시안A" in fn else b"B"
            target_file.write_bytes(char * 512)
        elif fmt == "hwpx":
            _write_hwpx(target_file, title, body)
        elif fmt == "hwp":
            _write_hwp(target_file, title, body)
        elif fmt == "pdf":
            _write_pdf(target_file, title, body)
        elif fmt == "xlsx":
            _write_xlsx(target_file, title, body)
        elif fmt == "docx":
            _write_docx(target_file, title, body)
        elif fmt == "txt":
            _write_txt(target_file, title, body)
        else:
            _write_txt(target_file, title, body)

        # Compute post-generation stats
        size = target_file.stat().st_size
        hasher = hashlib.sha256()
        with open(target_file, "rb") as f:
            while ch := f.read(65536):
                hasher.update(ch)
        sha = hasher.hexdigest()

        generated_paths_by_name[fn] = target_file

        item = BenchmarkItem(
            index=spec["index"],
            filename=fn,
            format=fmt,
            expected_year=spec["expected_year"],
            expected_project=spec["expected_project"],
            expected_stage=spec["expected_stage"],
            expected_doc_type=spec["expected_doc_type"],
            title=title,
            body=body,
            is_duplicate=is_dup,
            duplicate_of=dup_of,
            version_family=spec.get("version_family"),
            version_tag=spec.get("version_tag"),
            is_zero_byte=is_zero,
            is_binary=is_bin,
            sha256=sha,
            size_bytes=size,
            actual_path=target_file
        )
        generated_items.append(item)

    return generated_items


def main(argv: Optional[List[str]] = None) -> int:
    """CLI runner for benchmark document generator."""
    parser = argparse.ArgumentParser(
        prog="test_generator",
        description="공공 행정 표준 60종 모의 문서 벤치마크 생성기"
    )
    parser.add_argument(
        "output_dir",
        type=str,
        help="모의 문서가 생성될 대상 디렉토리 경로"
    )
    parser.add_argument(
        "--count",
        type=int,
        default=60,
        help="생성할 모의 문서 개수 (기본값: 60)"
    )

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    if hasattr(sys.stderr, "reconfigure"):
        try:
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    args = parser.parse_args(argv)
    target_dir = Path(args.output_dir)

    print("=" * 70)
    print("󰏚 [공공 행정 표준 모의 문서 벤치마크 생성기]")
    print(f"  • 생성 목표 경로: {target_dir.resolve()}")
    print(f"  • 목표 생성 파일: {args.count}종")
    print("=" * 70)

    items = generate_benchmark_dataset(target_dir, count=args.count)

    stage_counts = {}
    format_counts = {}
    for it in items:
        stage_counts[it.expected_stage] = stage_counts.get(it.expected_stage, 0) + 1
        format_counts[it.format] = format_counts.get(it.format, 0) + 1

    print("\n[생성 완료 요약]")
    print(f"  - 총 생성 파일 수: {len(items)}개")
    print("  - 업무단계별 분포:")
    for stg, c in stage_counts.items():
        print(f"    * {stg}: {c}건")
    print("  - 파일형식별 분포:")
    for fmt, c in format_counts.items():
        print(f"    * {fmt.upper()}: {c}건")
    print("=" * 70)
    print("  끝.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
