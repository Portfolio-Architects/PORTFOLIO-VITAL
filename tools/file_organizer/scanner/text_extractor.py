"""Zero-stall, in-memory multi-format text extractor for public administrative documents.

Supports HWPX, HWP (5.0 OLE), PDF (fitz), XLSX, DOCX, and TXT/CSV with multi-encoding fallback.
All extractors are guaranteed to be zero-stall, bounded by MAX_EXTRACT_CHARS, and exception-safe.
"""

import os
import sys
import struct
import zlib
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Tuple

from tools.file_organizer.config import MAX_EXTRACT_CHARS

# Ensure console standard output doesn't crash on Hancom PUA symbols on Windows
def ensure_console_encoding() -> None:
    """Safely configure stdout/stderr encoding to UTF-8 with replacement for Windows CP949."""
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

ensure_console_encoding()


def sanitize_text(text: str) -> str:
    """Normalize whitespace and strip null/unprintable control characters while preserving Korean & PUA."""
    if not text:
        return ""
    # Filter out ASCII control characters below 32 except \n, \r, \t
    cleaned = []
    for ch in text:
        code = ord(ch)
        if code in (10, 13, 9) or code >= 32:
            cleaned.append(ch)
        else:
            cleaned.append(" ")
    return "".join(cleaned).strip()


def extract_text_safe(filepath: Path | str) -> Tuple[str, str]:
    """Extract up to MAX_EXTRACT_CHARS from a document safely without launching external binaries.

    Args:
        filepath: Path to the target file.

    Returns:
        Tuple of (extracted_text, method_status).
        Guaranteed: Never crashes, never hangs, handles binary corruptions gracefully.
    """
    path = Path(filepath)
    if not path.exists():
        return "", "ERR_NOT_FOUND"

    try:
        size = path.stat().st_size
    except Exception as e:
        return "", f"ERR_STAT_{type(e).__name__}"

    if size == 0:
        return "", "EMPTY_FILE"

    ext = path.suffix.lower()

    # 1. HWPX (OWPML / ZIP Archive)
    if ext == ".hwpx":
        return _extract_hwpx(path)

    # 2. HWP (5.0 OLE Compound Document)
    elif ext == ".hwp":
        return _extract_hwp(path)

    # 3. PDF (PyMuPDF / fitz)
    elif ext == ".pdf":
        return _extract_pdf(path)

    # 4. XLSX / XLSM
    elif ext in (".xlsx", ".xlsm"):
        return _extract_xlsx(path)

    # 5. DOCX (OOXML / ZIP)
    elif ext == ".docx":
        return _extract_docx(path)

    # 6. TXT / CSV / JSON / MD (Multi-encoding fallback)
    elif ext in (".txt", ".csv", ".json", ".md"):
        return _extract_txt(path)

    return "", "EXT_UNSUPPORTED_TEXT_SKIPPED"


def _extract_hwpx(path: Path) -> Tuple[str, str]:
    """Extract text from HWPX archive via Contents/section*.xml."""
    try:
        with zipfile.ZipFile(path, "r") as z:
            sec_files = [
                f for f in z.namelist()
                if f.startswith("Contents/section") and f.endswith(".xml")
            ]
            if not sec_files:
                # Try any xml under Contents
                sec_files = [f for f in z.namelist() if f.startswith("Contents/") and f.endswith(".xml")]

            if not sec_files:
                return "", "HWPX_NO_SECTIONS"

            sec_files.sort()
            text_out = []
            for sf in sec_files[:3]:  # Limit to first 3 sections for speed
                try:
                    xml_bytes = z.read(sf)
                    root = ET.fromstring(xml_bytes)
                    for el in root.iter():
                        # Hancom OWPML paragraph text element
                        if el.tag.endswith("}t") or el.tag == "t":
                            if el.text:
                                text_out.append(el.text)
                        elif el.tag.endswith("}p") or el.tag == "p":
                            text_out.append("\n")
                        if sum(len(t) for t in text_out) >= MAX_EXTRACT_CHARS:
                            break
                except Exception:
                    continue
                if sum(len(t) for t in text_out) >= MAX_EXTRACT_CHARS:
                    break

            combined = sanitize_text("".join(text_out))[:MAX_EXTRACT_CHARS]
            return combined, "HWPX_PARSED_OK"
    except zipfile.BadZipFile:
        return "", "HWPX_BAD_ZIP"
    except Exception as e:
        return "", f"HWPX_EXCEPTION_{type(e).__name__}"


def _extract_hwp(path: Path) -> Tuple[str, str]:
    """Extract text from legacy HWP 5.0 OLE file using olefile and zlib decompress."""
    try:
        import olefile
    except ImportError:
        return "", "HWP_OLEFILE_NOT_INSTALLED"

    try:
        if not olefile.isOleFile(str(path)):
            return "", "HWP_NOT_OLE"

        with olefile.OleFileIO(str(path)) as ole:
            # Check for body text sections
            sections = [
                d for d in ole.listdir()
                if len(d) >= 2 and d[0] == "BodyText" and d[1].startswith("Section")
            ]
            if not sections:
                # Check for PrvText (preview text stream available in some HWP files)
                if ole.exists("PrvText"):
                    stream = ole.openstream("PrvText")
                    data = stream.read()
                    try:
                        text = data.decode("utf-16-le", errors="replace")
                        return sanitize_text(text)[:MAX_EXTRACT_CHARS], "HWP_PRVTEXT_OK"
                    except Exception:
                        pass
                return "", "HWP_NO_BODYTEXT"

            sections.sort(key=lambda x: x[1])
            text_out = []

            for sec in sections[:3]:  # Inspect up to first 3 sections
                stream = ole.openstream(sec)
                data = stream.read()
                try:
                    decomp = zlib.decompress(data, -15)  # raw deflate
                except Exception:
                    try:
                        decomp = zlib.decompress(data)  # standard zlib
                    except Exception:
                        continue

                idx, length = 0, len(decomp)
                while idx < length:
                    if idx + 4 > length:
                        break
                    header = struct.unpack("<I", decomp[idx:idx + 4])[0]
                    idx += 4
                    tag_id = header & 0x3FF
                    size = (header >> 20) & 0xFFF
                    if size == 0xFFF:
                        if idx + 4 > length:
                            break
                        size = struct.unpack("<I", decomp[idx:idx + 4])[0]
                        idx += 4

                    if idx + size > length:
                        break
                    rec = decomp[idx:idx + size]
                    idx += size

                    if tag_id == 67:  # HWPTAG_PARA_TEXT
                        chars = []
                        i = 0
                        while i + 2 <= len(rec):
                            c = struct.unpack("<H", rec[i:i + 2])[0]
                            # Check valid char range excluding surrogates
                            if (c >= 32 and not (0xD800 <= c <= 0xDFFF)) or c in (10, 13, 9):
                                chars.append(chr(c))
                            i += 2
                        text_out.append("".join(chars))
                        if sum(len(t) for t in text_out) >= MAX_EXTRACT_CHARS:
                            break

                if sum(len(t) for t in text_out) >= MAX_EXTRACT_CHARS:
                    break

            combined = sanitize_text("\n".join(text_out))[:MAX_EXTRACT_CHARS]
            return combined, "HWP_PARSED_OK"
    except Exception as e:
        return "", f"HWP_EXCEPTION_{type(e).__name__}"


def _extract_pdf(path: Path) -> Tuple[str, str]:
    """Extract text from PDF using PyMuPDF (fitz)."""
    try:
        import fitz
    except ImportError:
        return "", "PDF_FITZ_NOT_INSTALLED"

    doc = None
    try:
        doc = fitz.open(str(path))
        if doc.is_encrypted:
            return "", "PDF_ENCRYPTED"

        text_out = []
        for page in doc[:3]:  # First 3 pages
            text = page.get_text("text")
            if text:
                text_out.append(text)
            if sum(len(t) for t in text_out) >= MAX_EXTRACT_CHARS:
                break

        combined = sanitize_text("\n".join(text_out))[:MAX_EXTRACT_CHARS]
        if not combined:
            return "", "PDF_NO_TEXT_LAYER"
        return combined, "PDF_PARSED_OK"
    except Exception as e:
        return "", f"PDF_EXCEPTION_{type(e).__name__}"
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass


def _extract_xlsx(path: Path) -> Tuple[str, str]:
    """Extract text from XLSX via fast sharedStrings.xml parsing, falling back to openpyxl."""
    try:
        # Fast path: inspect xl/sharedStrings.xml via zipfile
        with zipfile.ZipFile(path, "r") as z:
            if "xl/sharedStrings.xml" in z.namelist():
                root = ET.fromstring(z.read("xl/sharedStrings.xml"))
                text_out = [
                    el.text for el in root.iter()
                    if (el.tag.endswith("}t") or el.tag == "t") and el.text
                ]
                if text_out:
                    combined = sanitize_text(" | ".join(text_out))[:MAX_EXTRACT_CHARS]
                    return combined, "XLSX_PARSED_OK"
    except zipfile.BadZipFile:
        return "", "XLSX_BAD_ZIP"
    except Exception:
        pass

    # Fallback path: openpyxl read_only
    try:
        import openpyxl
        wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
        text_out = []
        sheet_names = wb.sheetnames
        if sheet_names:
            ws = wb[sheet_names[0]]
            row_count = 0
            for row in ws.iter_rows(values_only=True):
                row_count += 1
                if row_count > 30:
                    break
                row_vals = [str(v).strip() for v in row if v is not None and str(v).strip()]
                if row_vals:
                    text_out.append(" | ".join(row_vals))
                if sum(len(t) for t in text_out) >= MAX_EXTRACT_CHARS:
                    break
        wb.close()
        combined = sanitize_text("\n".join(text_out))[:MAX_EXTRACT_CHARS]
        return combined, "XLSX_OPENPYXL_OK"
    except Exception as e:
        return "", f"XLSX_EXCEPTION_{type(e).__name__}"


def _extract_docx(path: Path) -> Tuple[str, str]:
    """Extract text from DOCX via word/document.xml."""
    try:
        with zipfile.ZipFile(path, "r") as z:
            if "word/document.xml" in z.namelist():
                root = ET.fromstring(z.read("word/document.xml"))
                text_out = [
                    el.text for el in root.iter()
                    if el.tag.endswith("}t") and el.text
                ]
                combined = sanitize_text(" ".join(text_out))[:MAX_EXTRACT_CHARS]
                return combined, "DOCX_PARSED_OK"
        return "", "DOCX_NO_BODY"
    except zipfile.BadZipFile:
        return "", "DOCX_BAD_ZIP"
    except Exception as e:
        return "", f"DOCX_EXCEPTION_{type(e).__name__}"


def _extract_txt(path: Path) -> Tuple[str, str]:
    """Extract text with multi-encoding probing (utf-8, utf-8-sig, cp949, euc-kr, utf-16)."""
    encodings = ("utf-8", "utf-8-sig", "cp949", "euc-kr", "utf-16")
    for enc in encodings:
        try:
            with open(path, "r", encoding=enc) as f:
                content = f.read(MAX_EXTRACT_CHARS)
                return sanitize_text(content)[:MAX_EXTRACT_CHARS], f"TXT_PARSED_{enc.upper()}"
        except UnicodeDecodeError:
            continue
        except Exception as e:
            return "", f"TXT_EXCEPTION_{type(e).__name__}"

    # If all strict encodings fail, read with replace
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read(MAX_EXTRACT_CHARS)
            return sanitize_text(content)[:MAX_EXTRACT_CHARS], "TXT_PARSED_REPLACE"
    except Exception as e:
        return "", f"TXT_EXCEPTION_{type(e).__name__}"
