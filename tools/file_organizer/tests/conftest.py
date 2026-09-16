"""Pytest fixtures for file organizer scanner, classifier, and deduplicator tests."""

import io
import os
import sys
import zipfile
import pytest
from pathlib import Path

# Ensure project root is on sys.path for test discovery
PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    import fitz
except ImportError:
    fitz = None

try:
    import openpyxl
except ImportError:
    openpyxl = None

try:
    import olefile
except ImportError:
    olefile = None


@pytest.fixture
def sample_hwpx_file(tmp_path: Path) -> Path:
    """Create a realistic mock HWPX file containing Hancom PUA glyphs and public admin text."""
    hwpx_path = tmp_path / "2026 양재천 건강 페스티벌 추진계획.hwpx"
    xml_content = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" '
        'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">\n'
        '  <hp:p>\n'
        '    <hp:t>󰏚 2026년도 양재천 건강 페스티벌 추진계획</hp:t>\n'
        '  </hp:p>\n'
        '  <hp:p>\n'
        '    <hp:t>1. 추진 목적: 지역주민의 건강 증진 및 양재천 걷기 운동 활성화</hp:t>\n'
        '  </hp:p>\n'
        '  <hp:p>\n'
        '    <hp:t>시행일자: 2026. 9. 16. 등록번호: 보건행정과-10405</hp:t>\n'
        '  </hp:p>\n'
        '</hs:sec>'
    )
    with zipfile.ZipFile(hwpx_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("Contents/section0.xml", xml_content.encode("utf-8"))
        z.writestr("mimetype", "application/hwp+zip".encode("utf-8"))
    return hwpx_path


@pytest.fixture
def sample_docx_file(tmp_path: Path) -> Path:
    """Create a realistic mock DOCX file containing public admin procurement text."""
    docx_path = tmp_path / "20260417_분할납품요구서(서울체력장 강남센터 영상정보장치 구매).docx"
    doc_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n'
        '  <w:body>\n'
        '    <w:p><w:r><w:t>분할납품요구서 (서울체력장 강남센터 체력측정 영상정보장치)</w:t></w:r></w:p>\n'
        '    <w:p><w:r><w:t>소요예산: 금15,000,000원 수의계약</w:t></w:r></w:p>\n'
        '  </w:body>\n'
        '</w:document>'
    )
    with zipfile.ZipFile(docx_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("word/document.xml", doc_xml.encode("utf-8"))
    return docx_path


@pytest.fixture
def sample_xlsx_file(tmp_path: Path) -> Path:
    """Create a realistic mock XLSX file using openpyxl or sharedStrings zip."""
    xlsx_path = tmp_path / "2026년 강남구 보건소 「건강 뜀」 비만예방 프로그램 참가자 명단.xlsx"
    if openpyxl:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "참가자명단"
        ws.append(["연번", "성명", "연락처", "프로그램명", "접수일자"])
        ws.append([1, "홍길동", "010-1234-5678", "건강뜀 비만예방교실", "2026-09-01"])
        ws.append([2, "이영희", "010-9876-5432", "건강뜀 비만예방교실", "2026-09-02"])
        wb.save(str(xlsx_path))
    else:
        shared_strings = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="5" uniqueCount="5">\n'
            '  <si><t>연번</t></si>\n'
            '  <si><t>성명</t></si>\n'
            '  <si><t>건강뜀 비만예방교실</t></si>\n'
            '</sst>'
        )
        with zipfile.ZipFile(xlsx_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr("xl/sharedStrings.xml", shared_strings.encode("utf-8"))
    return xlsx_path


@pytest.fixture
def sample_pdf_file(tmp_path: Path) -> Path:
    """Create a realistic mock PDF file with PyMuPDF."""
    pdf_path = tmp_path / "2025년 강남구 보건신체활동 활성화 사업운영 결과보고.pdf"
    if fitz:
        doc = fitz.open()
        page = doc.new_page()
        font_kwargs = {}
        font_path = "C:/Windows/Fonts/malgun.ttf"
        if os.path.exists(font_path):
            font_kwargs = {"fontname": "malgun", "fontfile": font_path}

        page.insert_text(
            (50, 72),
            "2025년 강남구 보건신체활동 활성화 사업운영 결과보고서\n"
            "추진기간: 2025. 3. 1. ~ 2025. 12. 31.\n"
            "사업결과 및 실적현황 보고\n"
            "강남구보건소 건강증진과",
            **font_kwargs
        )
        doc.save(str(pdf_path))
        doc.close()
    else:
        # Fallback raw minimal PDF if fitz wasn't installed
        pdf_path.write_bytes(b"%PDF-1.4\n%EOF\n")
    return pdf_path


@pytest.fixture
def sample_txt_files(tmp_path: Path) -> dict:
    """Create sample text files in various encodings (UTF-8, CP949)."""
    utf8_path = tmp_path / "2026년도_주요업무보고_기획총괄.txt"
    utf8_path.write_text(
        "2026년도 보건소 주요업무보고 및 구의회 임시회 보고자료\n기획안 수립 완료",
        encoding="utf-8"
    )

    cp949_path = tmp_path / "(260914)_사업설명서_CP949.txt"
    cp949_path.write_bytes(
        "2026년도 사업설명서 및 예산안 산출내역서 안내".encode("cp949")
    )

    return {
        "utf8": utf8_path,
        "cp949": cp949_path
    }


@pytest.fixture
def edge_case_file_set(tmp_path: Path) -> dict:
    """Create edge cases: 0-byte files, duplicates, binary files with same size."""
    edge_dir = tmp_path / "edge_cases"
    edge_dir.mkdir(parents=True, exist_ok=True)

    # 1. 0-byte files with different names
    zero1 = edge_dir / "20260715_업체대금_청구서.txt"
    zero1.write_bytes(b"")
    zero2 = edge_dir / "20260715_회의참석자_명단.txt"
    zero2.write_bytes(b"")

    # 2. Identical duplicate non-zero files (different names, identical SHA-256)
    dup_content = b"ORIGINAL_PAYMENT_STATEMENT_CONTENT_2026_CONFIDENTIAL"
    dup1 = edge_dir / "20260810_용역대금_청구서.txt"
    dup1.write_bytes(dup_content)
    dup2 = edge_dir / "20260810_용역대금_청구서_복사본.txt"
    dup2.write_bytes(dup_content)

    # 3. Binary files with identical size (100 bytes) but different bytes/hashes
    bin1 = edge_dir / "디자인_시안_A안.bin"
    bin1.write_bytes(b"A" * 100)
    bin2 = edge_dir / "디자인_시안_B안.bin"
    bin2.write_bytes(b"B" * 100)

    # 4. Version cluster files (same canonical base name, different tags)
    v1 = edge_dir / "(260914) 사업설명서(건강증진팀)_v1.hwpx"
    v2 = edge_dir / "(260914) 사업설명서(건강증진팀)_v2.hwpx"
    v_final = edge_dir / "(260914) 사업설명서(건강증진팀)-최종.hwpx"

    for p in (v1, v2, v_final):
        with zipfile.ZipFile(p, "w") as z:
            z.writestr("Contents/section0.xml", f"<t>{p.stem}</t>")

    return {
        "zero1": zero1,
        "zero2": zero2,
        "dup1": dup1,
        "dup2": dup2,
        "bin1": bin1,
        "bin2": bin2,
        "v1": v1,
        "v2": v2,
        "v_final": v_final,
        "dir": edge_dir
    }
