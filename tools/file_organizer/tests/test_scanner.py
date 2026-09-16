"""Unit tests for file organizer scanner, metadata extractor, and multi-format text parsers."""

import hashlib
from pathlib import Path
import pytest

from tools.file_organizer.config import EMPTY_SHA256, MAX_EXTRACT_CHARS
from tools.file_organizer.scanner.metadata_extractor import (
    FileInfo,
    compute_sha256,
    extract_file_metadata,
    scan_directory
)
from tools.file_organizer.scanner.text_extractor import (
    extract_text_safe,
    sanitize_text,
    ensure_console_encoding
)


class TestTextExtractor:
    """Tests for in-memory, zero-stall text extraction across all formats."""

    def test_hwpx_extraction_with_pua_glyphs(self, sample_hwpx_file: Path):
        """Verify HWPX parsing extracts text and preserves Hancom PUA glyphs safely."""
        text, status = extract_text_safe(sample_hwpx_file)
        assert status == "HWPX_PARSED_OK"
        assert "2026년도 양재천 건강 페스티벌 추진계획" in text
        assert "󰏚" in text  # Hancom PUA bullet symbol
        assert "시행일자: 2026. 9. 16." in text
        assert len(text) <= MAX_EXTRACT_CHARS

    def test_docx_extraction(self, sample_docx_file: Path):
        """Verify DOCX extraction parses body XML text."""
        text, status = extract_text_safe(sample_docx_file)
        assert status == "DOCX_PARSED_OK"
        assert "분할납품요구서" in text
        assert "서울체력장 강남센터" in text
        assert "수의계약" in text

    def test_xlsx_extraction(self, sample_xlsx_file: Path):
        """Verify XLSX extraction extracts cell content."""
        text, status = extract_text_safe(sample_xlsx_file)
        assert status in ("XLSX_PARSED_OK", "XLSX_OPENPYXL_OK")
        assert "건강뜀" in text
        assert "비만예방교실" in text

    def test_pdf_extraction(self, sample_pdf_file: Path):
        """Verify PDF text extraction via PyMuPDF."""
        text, status = extract_text_safe(sample_pdf_file)
        assert status == "PDF_PARSED_OK"
        assert "강남구 보건신체활동 활성화" in text
        assert "2025. 3. 1." in text

    def test_txt_multi_encoding_utf8_and_cp949(self, sample_txt_files: dict):
        """Verify multi-encoding fallback correctly decodes UTF-8 and CP949 without corruption."""
        # UTF-8 file
        utf8_text, utf8_status = extract_text_safe(sample_txt_files["utf8"])
        assert "TXT_PARSED" in utf8_status
        assert "주요업무보고" in utf8_text
        assert "기획안 수립 완료" in utf8_text

        # CP949 file
        cp949_text, cp949_status = extract_text_safe(sample_txt_files["cp949"])
        assert "TXT_PARSED" in cp949_status
        assert "사업설명서" in cp949_text
        assert "예산안 산출내역서" in cp949_text

    def test_zero_byte_text_extraction(self, tmp_path: Path):
        """Verify 0-byte file returns empty text and EMPTY_FILE status without crashing."""
        empty_file = tmp_path / "empty.txt"
        empty_file.write_bytes(b"")
        text, status = extract_text_safe(empty_file)
        assert text == ""
        assert status == "EMPTY_FILE"

    def test_nonexistent_file(self, tmp_path: Path):
        """Verify non-existent file returns ERR_NOT_FOUND without exception."""
        ghost = tmp_path / "does_not_exist.hwpx"
        text, status = extract_text_safe(ghost)
        assert text == ""
        assert status == "ERR_NOT_FOUND"

    def test_sanitize_text_utility(self):
        """Verify sanitize_text preserves Korean, PUA, and normal whitespace while stripping control codes."""
        raw = "󰏚 제목\x00\x01\x02\n본문 1줄\t탭\r\n"
        cleaned = sanitize_text(raw)
        assert "󰏚 제목" in cleaned
        assert "\x00" not in cleaned
        assert "본문 1줄" in cleaned


class TestMetadataExtractor:
    """Tests for file statistics, SHA-256 hash calculation, and directory scanning."""

    def test_compute_sha256_known_content(self, tmp_path: Path):
        """Verify SHA-256 hash matches standard hashlib calculation."""
        f = tmp_path / "test_sha.txt"
        content = b"PUBLIC_ADMIN_CONFIDENTIAL_HASH_TEST_2026"
        f.write_bytes(content)

        expected_hash = hashlib.sha256(content).hexdigest()
        assert compute_sha256(f) == expected_hash

    def test_compute_sha256_zero_bytes(self, tmp_path: Path):
        """Verify 0-byte file matches the known EMPTY_SHA256 constant."""
        f = tmp_path / "zero.txt"
        f.write_bytes(b"")
        assert compute_sha256(f) == EMPTY_SHA256

    def test_extract_file_metadata(self, sample_hwpx_file: Path):
        """Verify metadata extraction gathers size, mtime, ctime, sha256, and text preview."""
        info = extract_file_metadata(sample_hwpx_file, extract_text=True)
        assert isinstance(info, FileInfo)
        assert info.filename == "2026 양재천 건강 페스티벌 추진계획.hwpx"
        assert info.extension == ".hwpx"
        assert info.size > 0
        assert len(info.sha256) == 64
        assert info.mtime > 0
        assert "2026년도 양재천 건강 페스티벌" in info.text_preview
        assert "HWPX_PARSED_OK" in info.status_flags

    def test_extract_metadata_zero_byte_file(self, tmp_path: Path):
        """Verify 0-byte file receives EMPTY_FILE_ZERO_BYTES flag."""
        zero_file = tmp_path / "zero_test.txt"
        zero_file.write_bytes(b"")
        info = extract_file_metadata(zero_file)
        assert info.size == 0
        assert info.sha256 == EMPTY_SHA256
        assert "EMPTY_FILE_ZERO_BYTES" in info.status_flags

    def test_scan_directory_recursive_and_filters(self, tmp_path: Path):
        """Verify scan_directory recursively discovers files and excludes hidden dirs."""
        work_dir = tmp_path / "scanner_test_dir"
        sub_dir = work_dir / "sub"
        hidden_dir = work_dir / ".git"

        work_dir.mkdir()
        sub_dir.mkdir()
        hidden_dir.mkdir()

        # Regular files
        (work_dir / "file1.txt").write_text("Hello 1", encoding="utf-8")
        (sub_dir / "file2.txt").write_text("Hello 2", encoding="utf-8")

        # Hidden files / files in hidden dirs
        (work_dir / ".hidden_file.txt").write_text("Secret", encoding="utf-8")
        (hidden_dir / "config").write_text("git config", encoding="utf-8")

        # Scan without hidden
        scanned = scan_directory(work_dir, recursive=True, include_hidden=False)
        scanned_names = [f.filename for f in scanned]

        assert "file1.txt" in scanned_names
        assert "file2.txt" in scanned_names
        assert ".hidden_file.txt" not in scanned_names
        assert "config" not in scanned_names
        assert len(scanned) == 2

    def test_scan_directory_max_files_limit(self, tmp_path: Path):
        """Verify scan_directory stops after max_files limit."""
        dir_path = tmp_path / "limit_test"
        dir_path.mkdir()
        for i in range(10):
            (dir_path / f"file_{i}.txt").write_text(f"content {i}", encoding="utf-8")

        scanned = scan_directory(dir_path, recursive=False, max_files=4)
        assert len(scanned) == 4
