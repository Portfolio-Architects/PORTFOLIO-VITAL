"""High-speed recursive file scanner and metadata extractor.

Extracts file statistics, SHA-256 chunked hashing, timestamps, and invokes
the zero-stall text extractor while safely handling Windows filesystem quirks.
"""

import os
import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Set

from tools.file_organizer.config import (
    HASH_BLOCK_SIZE,
    EMPTY_SHA256,
    SUPPORTED_TEXT_EXTENSIONS
)
from tools.file_organizer.scanner.text_extractor import extract_text_safe

# Default directories excluded from scanning to avoid loops and artifacts
DEFAULT_EXCLUDED_DIRS: Set[str] = {
    ".git", ".agents", "node_modules", "__pycache__", ".pytest_cache",
    ".idea", ".vscode", "_Duplicates", "_Organized_Archive", "PORTFOLIO", ".next", "scratch"
}


@dataclass
class FileInfo:
    """Standard container for file metadata and text preview."""
    path: Path
    filename: str
    extension: str  # Lowercase extension with leading dot, e.g. ".hwpx"
    size: int
    sha256: str
    mtime: float = 0.0
    ctime: float = 0.0
    text_preview: str = ""
    status_flags: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert FileInfo to dictionary for JSON reporting."""
        return {
            "path": str(self.path),
            "filename": self.filename,
            "extension": self.extension,
            "size": self.size,
            "sha256": self.sha256,
            "mtime": self.mtime,
            "ctime": self.ctime,
            "text_preview": self.text_preview[:200] if self.text_preview else "",
            "status_flags": self.status_flags
        }


def compute_sha256(filepath: Path | str, block_size: int = HASH_BLOCK_SIZE) -> str:
    """Compute SHA-256 hash using chunked streaming buffer.

    Correctly returns EMPTY_SHA256 for 0-byte files.
    """
    path = Path(filepath)
    if not path.exists():
        return ""

    hasher = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            while True:
                chunk = f.read(block_size)
                if not chunk:
                    break
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception:
        return ""


def extract_file_metadata(filepath: Path | str, extract_text: bool = True) -> FileInfo:
    """Extract full metadata and optional text preview for a single file.

    Guaranteed not to raise unhandled exceptions on read or permission errors.
    """
    path = Path(filepath).resolve()
    filename = path.name
    extension = path.suffix.lower()
    flags: List[str] = []

    try:
        st = path.stat()
        size = st.st_size
        mtime = st.st_mtime
        ctime = st.st_ctime
    except Exception as e:
        flags.append(f"STAT_ERROR_{type(e).__name__}")
        size = 0
        mtime = 0.0
        ctime = 0.0

    if size == 0:
        flags.append("EMPTY_FILE_ZERO_BYTES")
        sha256_hash = EMPTY_SHA256
    else:
        sha256_hash = compute_sha256(path)
        if not sha256_hash:
            flags.append("HASH_COMPUTE_FAILED")

    text_preview = ""
    if extract_text and size > 0 and extension in SUPPORTED_TEXT_EXTENSIONS:
        text, status = extract_text_safe(path)
        text_preview = text
        flags.append(status)

    return FileInfo(
        path=path,
        filename=filename,
        extension=extension,
        size=size,
        sha256=sha256_hash,
        mtime=mtime,
        ctime=ctime,
        text_preview=text_preview,
        status_flags=flags
    )


def scan_directory(
    root_dir: Path | str,
    recursive: bool = True,
    include_hidden: bool = False,
    max_files: Optional[int] = None,
    exclude_dirs: Optional[Set[str]] = None,
    extract_text: bool = True
) -> List[FileInfo]:
    """Recursively or flatly scan directory and collect FileInfo objects.

    Args:
        root_dir: Root directory path to scan.
        recursive: Whether to descend into subdirectories.
        include_hidden: Whether to include files/dirs starting with dot.
        max_files: Optional limit on total files scanned.
        exclude_dirs: Set of directory names to skip.
        extract_text: Whether to extract text previews.

    Returns:
        List of FileInfo objects sorted by path.
    """
    root = Path(root_dir).resolve()
    if not root.exists() or not root.is_dir():
        return []

    excluded = set(DEFAULT_EXCLUDED_DIRS)
    if exclude_dirs:
        excluded.update(exclude_dirs)

    results: List[FileInfo] = []

    if recursive:
        for dirpath, dirnames, filenames in os.walk(root):
            # Prune hidden or excluded directories
            dirnames[:] = [
                d for d in dirnames
                if (include_hidden or not d.startswith(".")) and d not in excluded
            ]

            for fn in filenames:
                if not include_hidden and fn.startswith("."):
                    continue
                if fn.lower().endswith((".lnk", ".ini", ".url")):
                    continue

                fp = Path(dirpath) / fn
                info = extract_file_metadata(fp, extract_text=extract_text)
                results.append(info)

                if max_files is not None and len(results) >= max_files:
                    return sorted(results, key=lambda x: str(x.path))
    else:
        try:
            for entry in root.iterdir():
                if entry.is_file():
                    if not include_hidden and entry.name.startswith("."):
                        continue
                    if entry.name.lower().endswith((".lnk", ".ini", ".url")):
                        continue
                    info = extract_file_metadata(entry, extract_text=extract_text)
                    results.append(info)
                    if max_files is not None and len(results) >= max_files:
                        break
        except Exception:
            pass

    return sorted(results, key=lambda x: str(x.path))
