"""Human-readable Markdown and standalone styled HTML audit report generator.

Strictly follows AGENTS.md Rule M administrative reporting standards:
- Dingbat item hierarchy: 󰏚(Title) -> ▢(Overview) -> ❍(Main) -> -(Detail) -> •(Note)
- Legal sub-bullet sequence: 1. -> 가. -> 1) -> 가)
- Punctuation standards: Date with dot after day (2026. 9. 16. ), 24-hr time, ending with two spaces + '끝.'
- Concise administrative wording with noun-phrase or standard administrative ending clauses.
"""

from datetime import datetime, timezone
import html
from pathlib import Path
from typing import Any, Dict, List, Optional

from tools.file_organizer.main import MigrationPlan, MigrationItem
from tools.file_organizer.config import YEAR_UNKNOWN, PROJECT_UNKNOWN


def format_file_size(size_bytes: int) -> str:
    """Format bytes into human-readable string with KB/MB."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"


def format_admin_datetime(iso_timestamp: str) -> str:
    """Format ISO timestamp into administrative Korean date/time string: YYYY. M. D. HH:MM."""
    try:
        dt = datetime.fromisoformat(iso_timestamp)
        return f"{dt.year}. {dt.month}. {dt.day}. {dt.strftime('%H:%M')}"
    except Exception:
        now = datetime.now()
        return f"{now.year}. {now.month}. {now.day}. {now.strftime('%H:%M')}"


def render_markdown_report(plan: MigrationPlan) -> str:
    """Generate official administrative Markdown audit report."""
    metrics = plan.summary_metrics
    pb = plan.phase_breakdown
    total = metrics["total_scanned_files"]
    classified = metrics["total_classified_files"]
    unclassified = metrics["total_unclassified_files"]
    duplicates = metrics["total_duplicates_detected"]

    classified_pct = f"{(classified / total * 100):.1f}%" if total > 0 else "0.0%"
    unclassified_pct = f"{(unclassified / total * 100):.1f}%" if total > 0 else "0.0%"
    dup_pct = f"{(duplicates / total * 100):.1f}%" if total > 0 else "0.0%"

    dt_str = format_admin_datetime(plan.timestamp)
    mode_str = "사전 시뮬레이션 (Dry-Run: 원본 파일 100% 무변경·불변 검증 완료)" if plan.dry_run else "실제 이관 실행 (Execution)"

    lines: List[str] = [
        "󰏚 [공공 행정 문서 표준 아카이브 사전 시뮬레이션(Dry-Run) 결과보고서]",
        "",
        "1. 시뮬레이션 개요",
        f"  가. 점검일시: {dt_str}",
        f"  나. 대상 디렉토리: {plan.source_dir}",
        f"  다. 목표 아카이브: {plan.target_dir}",
        f"  라. 점검 모드: {mode_str}",
        f"  마. 소요 시간: {plan.scan_duration_seconds:.3f}초",
        "",
        "2. 종합 통계",
        "  | 구분 | 대상 건수 | 비율 | 비고 |",
        "  |:---|:---:|:---:|:---|",
        f"  | 총 스캔 문서 | {total:,}건 | 100.0% | 총 용량: {format_file_size(plan.total_size)} |",
        f"  | 3단계 이상 분류 성공 | {classified:,}건 | {classified_pct} | 연도/사업/단계 확정 |",
        f"  | 중복 및 버전 파편 파일 | {duplicates:,}건 | {dup_pct} | _Duplicates 격리 배치 |",
        f"  | 미분류 및 수동검토 필요 | {unclassified:,}건 | {unclassified_pct} | 기타·미분류 폴더 배치 |",
        "",
        "3. 공공 표준 4대 업무단계별 분류 현황",
    ]

    # Phase Breakdown
    p_plan = pb.get("planning_approval", 0)
    p_bud = pb.get("budget_expenditure", 0)
    p_evt = pb.get("execution_event", 0)
    p_out = pb.get("outcome_settlement", 0)
    p_unc = pb.get("unclassified", 0)

    lines.extend([
        f"  가. 기획·품의: {p_plan:,}건 ({(p_plan / total * 100):.1f}%) — 기본계획서, 추진계획안, 기안문, 과업지시서" if total else "  가. 기획·품의: 0건 (0.0%)",
        f"  나. 예산·지출: {p_bud:,}건 ({(p_bud / total * 100):.1f}%) — 지출결의서, 산출내역서, 구매견적서, 수의계약사유서" if total else "  나. 예산·지출: 0건 (0.0%)",
        f"  다. 집행·행사: {p_evt:,}건 ({(p_evt / total * 100):.1f}%) — 행사계획안, 식순, 사회자대본, 리플릿문안, 참석자명단" if total else "  다. 집행·행사: 0건 (0.0%)",
        f"  라. 결과보고·정산: {p_out:,}건 ({(p_out / total * 100):.1f}%) — 결과보고서, 정산검사서, 성과보고서, 회계검사보고" if total else "  라. 결과보고·정산: 0건 (0.0%)",
        f"  마. 기타·미분류: {p_unc:,}건 ({(p_unc / total * 100):.1f}%) — 임시 메모, 비표준 포맷" if total else "  마. 기타·미분류: 0건 (0.0%)",
        "",
        "4. 상세 파일 이관 계획 명세표",
        "  | 순번 | 원본 파일명 | 규격 | 추출 연도 | 사업구분 | 업무단계 | 예상 이관 경로 | 신뢰도 | 중복/버전 |",
        "  |:---:|:---|:---:|:---:|:---|:---|:---|:---:|:---:|"
    ])

    for idx, item in enumerate(plan.items, start=1):
        fn = item.source_path.name
        ext = item.source_path.suffix.upper().lstrip(".")
        res = item.classification

        # Status badge string
        if res.is_duplicate:
            ver_status = "중복파일"
        elif res.is_latest_version:
            ver_status = "대표본"
        elif res.is_historical_version:
            ver_status = "버전파일"
        else:
            ver_status = "일반"

        # Truncate filename if excessively long for clean table formatting
        disp_fn = fn if len(fn) <= 35 else f"{fn[:32]}..."
        rel_target = str(res.target_rel_path) if res.target_rel_path else str(item.target_path)
        disp_target = rel_target if len(rel_target) <= 45 else f"...{rel_target[-42:]}"

        conf_str = f"{int(res.confidence * 100)}%"

        lines.append(
            f"  | {idx} | {disp_fn} | {ext} | {res.year} | {res.project} | {res.stage} | {disp_target} | {conf_str} | {ver_status} |"
        )

    lines.extend([
        "",
        "  끝."
    ])

    return "\n".join(lines)


def generate_markdown_report(plan: MigrationPlan, output_path: Path | str) -> str:
    """Render and write Markdown report to disk."""
    out_file = Path(output_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)
    content = render_markdown_report(plan)
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(content)
    return content


def render_html_report(plan: MigrationPlan) -> str:
    """Generate standalone styled HTML audit report with vanilla JS live filtering."""
    metrics = plan.summary_metrics
    pb = plan.phase_breakdown
    total = metrics["total_scanned_files"]
    classified = metrics["total_classified_files"]
    unclassified = metrics["total_unclassified_files"]
    duplicates = metrics["total_duplicates_detected"]

    dt_str = format_admin_datetime(plan.timestamp)
    mode_str = "사전 시뮬레이션 (Dry-Run: 원본 100% 무변경)" if plan.dry_run else "실제 이관 실행 (Execution)"

    # Build rows HTML
    rows_html: List[str] = []
    for idx, item in enumerate(plan.items, start=1):
        fn = html.escape(item.source_path.name)
        ext = html.escape(item.source_path.suffix.upper().lstrip("."))
        res = item.classification
        year = html.escape(res.year)
        project = html.escape(res.project)
        stage = html.escape(res.stage)
        doc_type = html.escape(res.doc_type)
        target = html.escape(str(res.target_rel_path if res.target_rel_path else item.target_path))
        conf_val = int(res.confidence * 100)
        size_str = format_file_size(item.size)

        # Confidence class
        if conf_val >= 85:
            conf_badge = f'<span class="badge badge-conf-high">{conf_val}%</span>'
        elif conf_val >= 70:
            conf_badge = f'<span class="badge badge-conf-mid">{conf_val}%</span>'
        else:
            conf_badge = f'<span class="badge badge-conf-low">{conf_val}%</span>'

        # Stage badge
        if "기획" in stage or "품의" in stage:
            stage_badge = f'<span class="badge badge-stage-plan">{stage}</span>'
        elif "예산" in stage or "지출" in stage:
            stage_badge = f'<span class="badge badge-stage-bud">{stage}</span>'
        elif "집행" in stage or "행사" in stage:
            stage_badge = f'<span class="badge badge-stage-evt">{stage}</span>'
        elif "결과" in stage or "정산" in stage:
            stage_badge = f'<span class="badge badge-stage-out">{stage}</span>'
        else:
            stage_badge = f'<span class="badge badge-stage-unc">{stage}</span>'

        # Status badge
        if res.is_duplicate:
            status_badge = '<span class="badge badge-dup">중복파일 (격리)</span>'
        elif res.is_latest_version:
            status_badge = '<span class="badge badge-primary">대표본</span>'
        elif res.is_historical_version:
            status_badge = '<span class="badge badge-ver">버전파일</span>'
        else:
            status_badge = '<span class="badge badge-norm">일반</span>'

        row = f"""<tr data-stage="{stage}">
  <td class="text-center">{idx}</td>
  <td class="font-mono">{fn}</td>
  <td class="text-center">{ext}</td>
  <td class="text-right">{size_str}</td>
  <td class="text-center">{year}</td>
  <td>{project}</td>
  <td class="text-center">{stage_badge}</td>
  <td>{doc_type}</td>
  <td class="font-mono text-sm">{target}</td>
  <td class="text-center">{conf_badge}</td>
  <td class="text-center">{status_badge}</td>
</tr>"""
        rows_html.append(row)

    table_rows = "\n".join(rows_html)

    html_content = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>공공 행정 문서 표준 아카이브 사전 시뮬레이션(Dry-Run) 결과보고서</title>
<style>
  :root {{
    --bg-main: #0f172a;
    --bg-card: #1e293b;
    --bg-card-hover: #334155;
    --border-color: #334155;
    --text-main: #f8fafc;
    --text-muted: #94a3b8;
    --color-primary: #38bdf8;
    --color-success: #10b981;
    --color-warning: #f59e0b;
    --color-danger: #ef4444;
    --color-purple: #8b5cf6;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", sans-serif;
    background-color: var(--bg-main);
    color: var(--text-main);
    line-height: 1.5;
    padding: 24px;
  }}
  .container {{ max-width: 1400px; margin: 0 auto; }}
  .header {{
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 24px 32px;
    margin-bottom: 24px;
  }}
  .header h1 {{ font-size: 1.6rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px; }}
  .header-meta {{ display: flex; flex-wrap: wrap; gap: 20px; font-size: 0.9rem; color: var(--text-muted); }}
  .header-meta span strong {{ color: var(--text-main); }}

  /* Metric Cards */
  .metrics-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }}
  .metric-card {{
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 18px 20px;
  }}
  .metric-card .title {{ font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px; }}
  .metric-card .value {{ font-size: 1.8rem; font-weight: 700; color: var(--text-main); }}
  .metric-card .sub {{ font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; }}

  /* Filter Bar */
  .controls-bar {{
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 14px 20px;
    margin-bottom: 16px;
  }}
  .search-input {{
    flex: 1;
    min-width: 250px;
    background: var(--bg-main);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 0.9rem;
  }}
  .search-input:focus {{ outline: none; border-color: var(--color-primary); }}
  .stage-filter {{
    background: var(--bg-main);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.9rem;
  }}

  /* Table */
  .table-container {{
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    overflow-x: auto;
  }}
  table {{ width: 100%; border-collapse: collapse; font-size: 0.88rem; text-align: left; }}
  th {{
    background: #111827;
    color: var(--text-muted);
    font-weight: 600;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-color);
    white-space: nowrap;
  }}
  td {{ padding: 10px 14px; border-bottom: 1px solid #1e293b; }}
  tr:hover td {{ background: var(--bg-card-hover); }}

  .text-center {{ text-align: center; }}
  .text-right {{ text-align: right; }}
  .font-mono {{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }}
  .text-sm {{ font-size: 0.8rem; }}

  /* Badges */
  .badge {{
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }}
  .badge-stage-plan {{ background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid #10b981; }}
  .badge-stage-bud  {{ background: rgba(37, 99, 235, 0.15); color: #60a5fa; border: 1px solid #2563eb; }}
  .badge-stage-evt  {{ background: rgba(139, 92, 246, 0.15); color: #a78bfa; border: 1px solid #8b5cf6; }}
  .badge-stage-out  {{ background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid #f59e0b; }}
  .badge-stage-unc  {{ background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid #64748b; }}

  .badge-conf-high {{ background: rgba(16, 185, 129, 0.2); color: #10b981; }}
  .badge-conf-mid  {{ background: rgba(245, 158, 11, 0.2); color: #f59e0b; }}
  .badge-conf-low  {{ background: rgba(239, 68, 68, 0.2); color: #ef4444; }}

  .badge-primary {{ background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #0284c7; }}
  .badge-dup     {{ background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid #dc2626; }}
  .badge-ver     {{ background: rgba(148, 163, 184, 0.15); color: #cbd5e1; }}
  .badge-norm    {{ background: rgba(71, 85, 105, 0.2); color: #94a3b8; }}

  .footer {{
    margin-top: 24px;
    text-align: right;
    font-size: 0.85rem;
    color: var(--text-muted);
  }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>󰏚 공공 행정 문서 표준 아카이브 사전 시뮬레이션(Dry-Run) 결과보고서</h1>
    <div class="header-meta">
      <span><strong>점검일시:</strong> {dt_str}</span>
      <span><strong>점검모드:</strong> {mode_str}</span>
      <span><strong>대상 경로:</strong> {html.escape(str(plan.source_dir))}</span>
      <span><strong>목표 경로:</strong> {html.escape(str(plan.target_dir))}</span>
      <span><strong>소요시간:</strong> {plan.scan_duration_seconds:.3f}초</span>
    </div>
  </div>

  <div class="metrics-grid">
    <div class="metric-card">
      <div class="title">총 스캔 파일</div>
      <div class="value">{total:,} <span style="font-size: 1rem;">건</span></div>
      <div class="sub">총 용량 {format_file_size(plan.total_size)}</div>
    </div>
    <div class="metric-card">
      <div class="title">분류 완료율</div>
      <div class="value" style="color: var(--color-success);">{metrics["classification_accuracy_percentage"]}%</div>
      <div class="sub">{classified:,}건 정상 분류</div>
    </div>
    <div class="metric-card">
      <div class="title">중복 및 버전 파편</div>
      <div class="value" style="color: var(--color-warning);">{duplicates:,} <span style="font-size: 1rem;">건</span></div>
      <div class="sub">격리 배치 대상</div>
    </div>
    <div class="metric-card">
      <div class="title">수동 검토 필요</div>
      <div class="value" style="color: var(--color-danger);">{unclassified:,} <span style="font-size: 1rem;">건</span></div>
      <div class="sub">미분류 / 기타</div>
    </div>
  </div>

  <div class="controls-bar">
    <input type="text" id="searchInput" class="search-input" placeholder="파일명, 사업명, 연도 검색 (실시간 필터)...">
    <select id="stageFilter" class="stage-filter">
      <option value="ALL">전체 업무단계</option>
      <option value="기획·품의">01_기획·품의</option>
      <option value="예산·지출">02_예산·지출</option>
      <option value="집행·행사">03_집행·행사</option>
      <option value="결과보고·정산">04_결과보고·정산</option>
      <option value="미분류">기타·미분류</option>
    </select>
    <div id="filterCount" style="font-size: 0.85rem; color: var(--text-muted); margin-left: auto;">
      표시 중: <strong id="visibleCount" style="color: var(--text-main);">{total}</strong> / {total}건
    </div>
  </div>

  <div class="table-container">
    <table id="planTable">
      <thead>
        <tr>
          <th>순번</th>
          <th>원본 파일명</th>
          <th>규격</th>
          <th>용량</th>
          <th>추출 연도</th>
          <th>사업구분</th>
          <th>업무단계</th>
          <th>문서유형</th>
          <th>예상 이관 경로</th>
          <th>신뢰도</th>
          <th>상태/비고</th>
        </tr>
      </thead>
      <tbody>
{table_rows}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <span>공공 행정 표준 아카이빙 파이프라인 (tools/file_organizer) &nbsp;&nbsp;끝.</span>
  </div>
</div>

<script>
  (function() {{
    const searchInput = document.getElementById('searchInput');
    const stageFilter = document.getElementById('stageFilter');
    const table = document.getElementById('planTable');
    const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    const visibleCountSpan = document.getElementById('visibleCount');

    function filterTable() {{
      const query = searchInput.value.toLowerCase().trim();
      const selectedStage = stageFilter.value;
      let visible = 0;

      for (let i = 0; i < rows.length; i++) {{
        const row = rows[i];
        const text = row.innerText.toLowerCase();
        const stage = row.getAttribute('data-stage') || '';

        const matchesQuery = !query || text.includes(query);
        const matchesStage = (selectedStage === 'ALL') || stage.includes(selectedStage);

        if (matchesQuery && matchesStage) {{
          row.style.display = '';
          visible++;
        }} else {{
          row.style.display = 'none';
        }}
      }}
      visibleCountSpan.textContent = visible;
    }}

    searchInput.addEventListener('input', filterTable);
    stageFilter.addEventListener('change', filterTable);
  }})();
</script>
</body>
</html>
"""
    return html_content


def generate_html_report(plan: MigrationPlan, output_path: Path | str) -> str:
    """Render and write HTML report to disk."""
    out_file = Path(output_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)
    content = render_html_report(plan)
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(content)
    return content


class MarkdownReporter:
    """Reporter class for emitting human-readable Markdown and HTML audit reports."""

    @staticmethod
    def render_markdown(plan: MigrationPlan) -> str:
        return render_markdown_report(plan)

    @staticmethod
    def save_markdown(plan: MigrationPlan, output_path: Path | str) -> Path:
        p = Path(output_path).resolve()
        generate_markdown_report(plan, p)
        return p

    @staticmethod
    def render_html(plan: MigrationPlan) -> str:
        return render_html_report(plan)

    @staticmethod
    def save_html(plan: MigrationPlan, output_path: Path | str) -> Path:
        p = Path(output_path).resolve()
        generate_html_report(plan, p)
        return p
