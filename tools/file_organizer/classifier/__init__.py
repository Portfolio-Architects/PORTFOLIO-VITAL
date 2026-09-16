"""Classifier package: 4-tier taxonomy, rule engine, and deduplicator."""

from tools.file_organizer.classifier.taxonomy import (
    ClassificationResult,
    is_valid_year,
    is_valid_project,
    is_valid_stage,
    is_valid_doc_type
)
from tools.file_organizer.classifier.rule_engine import (
    extract_year,
    extract_project,
    extract_stage,
    extract_doc_type,
    classify_file
)
from tools.file_organizer.classifier.deduplicator import (
    get_canonical_base_name,
    calculate_version_score,
    process_deduplication_and_versions
)

__all__ = [
    "ClassificationResult",
    "is_valid_year",
    "is_valid_project",
    "is_valid_stage",
    "is_valid_doc_type",
    "extract_year",
    "extract_project",
    "extract_stage",
    "extract_doc_type",
    "classify_file",
    "get_canonical_base_name",
    "calculate_version_score",
    "process_deduplication_and_versions"
]
