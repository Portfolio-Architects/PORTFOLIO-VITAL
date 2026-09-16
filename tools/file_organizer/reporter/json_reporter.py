"""JSON audit report generator for public administration file organization.

Produces a fully structured, machine-readable audit report adhering to the
specification in analysis_r2_dryrun_simulation.md.
"""

import json
from pathlib import Path
import re
from typing import Any, Dict, List, Optional

from tools.file_organizer.main import MigrationPlan, MigrationItem


def extract_version_tag(filename: str) -> Optional[str]:
    """Extract version tag from filename if present, or return None."""
    for tag in ["진짜최종", "최최종", "최종", "확정", "제출용", "제출", "배포용", "수정본", "수정", "초안", "가안", "원안"]:
        if tag in filename:
            return tag
    m = re.search(r'v(?:er)?\.?\s*(\d+(?:\.\d+)*)', filename, re.IGNORECASE)
    if m:
        return f"v{m.group(1)}"
    m2 = re.search(r'수정\s*(\d+)', filename)
    if m2:
        return f"수정{m2.group(1)}"
    return None


def map_stage_to_phase(stage: str) -> str:
    """Map internal stage string to standard enum phase name."""
    if "기획" in stage or "품의" in stage:
        return "기획·품의"
    elif "예산" in stage or "지출" in stage:
        return "예산·지출"
    elif "집행" in stage or "행사" in stage:
        return "집행·행사"
    elif "결과" in stage or "정산" in stage:
        return "결과보고·정산"
    else:
        return "기타·미분류"


def build_json_audit_dict(plan: MigrationPlan) -> Dict[str, Any]:
    """Transform MigrationPlan into full JSON audit report payload."""
    items_payload: List[Dict[str, Any]] = []

    for idx, item in enumerate(plan.items, start=1):
        fn = item.source_path.name
        res = item.classification
        tag = extract_version_tag(fn)

        phase_str = map_stage_to_phase(res.stage)

        is_dup = res.is_duplicate
        dup_type = "EXACT_HASH" if is_dup else "NONE"
        is_primary = res.is_latest_version and not is_dup
        is_versioned = res.is_historical_version or (res.canonical_base != fn) or (tag is not None)

        item_dict = {
            "item_id": f"item_{idx:04d}",
            "original_path": str(item.source_path),
            "original_filename": fn,
            "file_size_bytes": item.size,
            "sha256": item.sha256,
            "file_extension": item.source_path.suffix.lower(),
            "classification": {
                "tier1_year": res.year,
                "tier2_project": res.project,
                "tier3_phase": phase_str,
                "tier4_doctype": res.doc_type,
                "confidence": round(res.confidence, 3),
                "match_criteria": res.grounds
            },
            "version_analysis": {
                "is_versioned": is_versioned,
                "version_tag": tag,
                "clean_base_title": res.canonical_base,
                "is_duplicate": is_dup,
                "duplicate_type": dup_type,
                "cluster_id": res.version_family_key,
                "is_primary_representative": is_primary
            },
            "planned_action": item.planned_action,
            "target_path": str(item.target_path),
            "target_filename": item.target_filename,
            "collision_strategy": item.collision_strategy
        }
        items_payload.append(item_dict)

    report_dict = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "PublicAdminFileOrganizerAuditReport",
        "report_version": plan.tool_version,
        "execution_metadata": {
            "timestamp": plan.timestamp,
            "mode": "DRY_RUN" if plan.dry_run else "EXECUTION",
            "source_directory": str(plan.source_dir) if plan.source_dir else "",
            "target_directory": str(plan.target_dir) if plan.target_dir else "",
            "tool_version": plan.tool_version,
            "scan_duration_seconds": round(plan.scan_duration_seconds, 4)
        },
        "summary_metrics": plan.summary_metrics,
        "phase_breakdown": plan.phase_breakdown,
        "items": items_payload
    }

    return report_dict


def generate_json_report(plan: MigrationPlan, output_path: Path | str) -> Dict[str, Any]:
    """Generate and write JSON audit report to disk.

    Args:
        plan: The MigrationPlan to serialize.
        output_path: Target JSON file path.

    Returns:
        The generated report dictionary.
    """
    out_file = Path(output_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)

    report_data = build_json_audit_dict(plan)

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)

    return report_data


class JSONReporter:
    """Reporter class for emitting structured JSON audit manifests."""

    @staticmethod
    def render(plan: MigrationPlan) -> str:
        """Render JSON report to formatted string."""
        data = build_json_audit_dict(plan)
        return json.dumps(data, ensure_ascii=False, indent=2)

    @staticmethod
    def save(plan: MigrationPlan, output_path: Path | str) -> Path:
        """Render and save JSON report to file."""
        p = Path(output_path).resolve()
        generate_json_report(plan, p)
        return p
