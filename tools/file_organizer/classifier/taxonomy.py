"""Public administration 4-tier taxonomy models and validation routines."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from tools.file_organizer.config import (
    YEAR_NORMALIZED_LIST,
    YEAR_UNKNOWN,
    PROJECT_ONTOLOGY,
    PROJECT_UNKNOWN,
    STAGE_LIST,
    STAGE_UNKNOWN,
    DOCUMENT_TYPES,
    DOC_TYPE_UNKNOWN
)


@dataclass
class ClassificationResult:
    """Standard container for the 4-tier public administration classification."""
    year: str
    project: str
    stage: str
    doc_type: str
    canonical_base: str
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    is_latest_version: bool = True
    is_historical_version: bool = False
    version_family_key: Optional[str] = None
    target_rel_path: Optional[Path] = None
    confidence: float = 1.0
    grounds: List[str] = field(default_factory=list)
    status_flags: List[str] = field(default_factory=list)

    def compute_target_rel_path(self, filename: Optional[str] = None) -> Path:
        """Compute relative target path within the 4-tier hierarchy.

        If marked as a duplicate, routes into _Duplicates prefix.
        """
        dest_filename = filename if filename else self.canonical_base
        if self.is_duplicate:
            path = Path("_Duplicates") / self.year / self.project / self.stage / dest_filename
        else:
            path = Path(self.year) / self.project / self.stage / self.doc_type / dest_filename
        self.target_rel_path = path
        return path

    def to_dict(self) -> dict:
        """Convert classification result to serializable dict."""
        return {
            "year": self.year,
            "project": self.project,
            "stage": self.stage,
            "doc_type": self.doc_type,
            "canonical_base": self.canonical_base,
            "is_duplicate": self.is_duplicate,
            "duplicate_of": self.duplicate_of,
            "is_latest_version": self.is_latest_version,
            "is_historical_version": self.is_historical_version,
            "version_family_key": self.version_family_key,
            "target_rel_path": str(self.target_rel_path) if self.target_rel_path else None,
            "confidence": round(self.confidence, 3),
            "grounds": self.grounds,
            "status_flags": self.status_flags
        }


def is_valid_year(year: str) -> bool:
    """Check if year conforms to standard format or fallback."""
    return year in YEAR_NORMALIZED_LIST or year == YEAR_UNKNOWN


def is_valid_project(project: str) -> bool:
    """Check if project is in known ontologies or matches custom project standard."""
    return bool(project and len(project) >= 2)


def is_valid_stage(stage: str) -> bool:
    """Check if stage is one of the 4 defined administrative lifecycle stages."""
    return stage in STAGE_LIST


def is_valid_doc_type(doc_type: str) -> bool:
    """Check if doc_type is in defined standard document types."""
    return doc_type in DOCUMENT_TYPES
