# -*- coding: utf-8 -*-
"""
양재천 걷자! 건강 페스티벌 부스 종합 현황 & 업무분장표 & 식순 타임테이블 엑셀 동기화 엔진
(scripts/sync_festival_excel.py)

기능:
1. 프론트엔드 JSON SSOT (data/FESTIVAL_YANGJAE_2026.json) -> 바탕화면 Excel (SSOT 마스터) 자동 생성
2. 바탕화면 Excel -> 프론트엔드 JSON 역방향 파싱 및 무손실 동기화 (부스 20개, 업무분장 43개, 식순 17개)
3. 6대 업무 구획 (운영, 코스, 부스, VIP의전, 직원식사, 쓰레기처리) 및 보건소/체육회/대행사 인력 자동 집계
4. 행정 표준 규격 및 고품질 서식 적용 (맑은 고딕, Deep Navy #1F4E79, 지브라 스트라이프, 합계/총계 수식)
"""
import os
import sys
import json
import glob
import re
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Ensure UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(PROJECT_ROOT, 'data', 'FESTIVAL_YANGJAE_2026.json')
DESKTOP_DIR = r'D:\Desktop'

FONT_FAMILY = "맑은 고딕"
NAVY_PRIMARY = "1F4E79"
NAVY_DARK = "0D2B45"
ZEBRA_FILL = "F2F5F9"

MASTER_EXCEL_FILENAME = "2026_양재천_걷자_건강페스티벌_종합현황_ver 261006_SSOT.xlsx"
MASTER_EXCEL_PATH = os.path.join(DESKTOP_DIR, MASTER_EXCEL_FILENAME)
BACKUP_DIR = os.path.join(DESKTOP_DIR, "양재천페스티벌_이전버전")

def get_master_desktop_excel_path():
    """Return the single canonical SSOT Excel workbook path on Desktop."""
    return MASTER_EXCEL_PATH

def get_latest_desktop_excel_path():
    """
    Get the master Excel file path for SSOT.
    If the canonical master file exists, it is ALWAYS returned (SSOT).
    If not, fall back to any legacy ver *.xlsx on desktop.
    """
    if os.path.exists(MASTER_EXCEL_PATH):
        return MASTER_EXCEL_PATH
    patterns = [
        os.path.join(DESKTOP_DIR, "2026_양재천_걷자_건강페스티벌_종합현황_ver *.xlsx"),
        os.path.join(DESKTOP_DIR, "2026_양재천_걷자_건강페스티벌_부스_종합현황_ver *.xlsx"),
    ]
    files = []
    for pat in patterns:
        files.extend(glob.glob(pat))
    valid_files = [f for f in files if not f.endswith('.tmp') and not os.path.basename(f).startswith('~$')]
    if not valid_files:
        return MASTER_EXCEL_PATH
    valid_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    return valid_files[0]

def get_target_desktop_excel_path(date_str=None):
    """Always return the single canonical SSOT master Excel path."""
    return MASTER_EXCEL_PATH

def export_json_to_excel(target_path=None):
    if not os.path.exists(JSON_PATH):
        raise FileNotFoundError(f"JSON data not found at {JSON_PATH}")

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    meta = data.get('meta', {})
    booths = data.get('booths', [])
    duties = data.get('duties', [])
    schedules = data.get('schedule', [])

    today_dt = datetime.now()
    today_display = today_dt.strftime("%Y. %m. %d.")

    if not target_path:
        target_path = MASTER_EXCEL_PATH

    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # Common Styles
    font_title = Font(name=FONT_FAMILY, size=15, bold=True, color=NAVY_PRIMARY)
    font_subtitle = Font(name=FONT_FAMILY, size=9.5, color="595959")
    font_header = Font(name=FONT_FAMILY, size=10, bold=True, color="FFFFFF")
    font_data = Font(name=FONT_FAMILY, size=9.5, color="000000")
    font_data_bold = Font(name=FONT_FAMILY, size=9.5, bold=True, color="000000")
    font_total = Font(name=FONT_FAMILY, size=10, bold=True, color=NAVY_PRIMARY)

    fill_header = PatternFill(start_color=NAVY_PRIMARY, end_color=NAVY_PRIMARY, fill_type="solid")
    fill_sub_header = PatternFill(start_color="2F5597", end_color="2F5597", fill_type="solid")
    fill_zebra = PatternFill(start_color=ZEBRA_FILL, end_color=ZEBRA_FILL, fill_type="solid")
    fill_white = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    fill_total = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")

    cat_colors = {
        "운영": {"fill": "DBEAFE", "font": "1E40AF"},      # Blue
        "코스": {"fill": "E0E7FF", "font": "3730A3"},      # Indigo
        "부스": {"fill": "D1FAE5", "font": "065F46"},      # Emerald
        "VIP의전": {"fill": "F3E8FF", "font": "6B21A8"},   # Purple
        "직원식사": {"fill": "FEF3C7", "font": "92400E"},   # Amber
        "쓰레기처리": {"fill": "FFE4E6", "font": "9F1239"}  # Rose
    }

    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
    align_right = Alignment(horizontal="right", vertical="center", wrap_text=True)

    thin_gray = Side(style="thin", color="D9D9D9")
    thick_navy = Side(style="medium", color=NAVY_PRIMARY)
    double_navy = Side(style="double", color=NAVY_PRIMARY)

    border_cell = Border(left=thin_gray, right=thin_gray, top=thin_gray, bottom=thin_gray)
    border_header = Border(left=thin_gray, right=thin_gray, top=thick_navy, bottom=thick_navy)
    border_total = Border(left=thin_gray, right=thin_gray, top=thick_navy, bottom=double_navy)

    # =========================================================================
    # SHEET 1: 부스_종합현황 (14 Columns, Standard SSOT Layout)
    # =========================================================================
    ws1 = wb.create_sheet(title="부스_종합현황")
    ws1.views.sheetView[0].showGridLines = True

    ws1.merge_cells("A2:N2")
    ws1["A2"] = "｢제8회 강남구청장배 걷기대회 연계｣ 2026 양재천 걷자! 건강 페스티벌 부스 종합 현황"
    ws1["A2"].font = font_title
    ws1["A2"].alignment = Alignment(horizontal="left", vertical="center")
    ws1.row_dimensions[2].height = 28

    ws1.merge_cells("A3:N3")
    ws1["A3"] = f"■ 일시: 2026. 10. 31.(토) 08:40~13:30 (행사: 08:00~14:00) | 장소: 양재천 수변문화쉼터 (개포동 1279 일원) | 주관: 강남구보건소·강남구체육회 | 작성부서: 보건행정과 건강증진팀 (기준: {today_display})"
    ws1["A3"].font = font_subtitle
    ws1["A3"].alignment = Alignment(horizontal="left", vertical="center")
    ws1.row_dimensions[3].height = 20

    headers_s1 = [
        "연번", "구획", "운영 부서 / 기관명", "부스\n규모",
        "테이블", "의자", "상주\n인력", "부스\n책임자",
        "행정전화\n(유선)", "비상연락망\n(휴대전화)", "전기사용 유무", "전기 사용 내역",
        "부스 현수막 타이틀", "비고 / 특이사항"
    ]
    ws1.row_dimensions[5].height = 28
    for c_idx, h in enumerate(headers_s1, 1):
        cell = ws1.cell(row=5, column=c_idx, value=h)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = align_center
        cell.border = border_header

    start_r1 = 6
    for idx, b in enumerate(booths):
        cur_r = start_r1 + idx
        ws1.row_dimensions[cur_r].height = 26
        fill_curr = fill_zebra if idx % 2 == 1 else fill_white

        scale_val = b.get("scale", "")
        if isinstance(scale_val, str) and scale_val.endswith("동"):
            try:
                scale_num = int(scale_val.replace("동", "").strip())
            except ValueError:
                scale_num = scale_val
        else:
            scale_num = scale_val

        b_id = b.get("id", idx + 1)
        no_display = "-" if b_id == 1 else b_id - 1

        vals = [
            no_display,
            b.get("zone", ""),
            b.get("name", ""),
            scale_num,
            b.get("tables", 0),
            b.get("chairs", 0),
            b.get("staffCount", 0),
            b.get("manager", ""),
            b.get("adminPhone", ""),
            b.get("mobilePhone", ""),
            b.get("electricity", "X"),
            b.get("electricityDetail", "-"),
            b.get("bannerText", ""),
            b.get("remarks", "")
        ]

        for c_idx, val in enumerate(vals, 1):
            cell = ws1.cell(row=cur_r, column=c_idx, value=val)
            cell.font = font_data
            cell.fill = fill_curr
            cell.border = border_cell

            if c_idx in [1, 2, 4, 8, 9, 10, 11]:
                cell.alignment = align_center
            elif c_idx in [5, 6, 7]:
                cell.alignment = align_right
                cell.number_format = "#,##0"
            else:
                cell.alignment = align_left

            if c_idx == 11:
                if str(val).upper() == "O":
                    cell.font = Font(name=FONT_FAMILY, size=9.5, bold=True, color="1E40AF")
                    cell.fill = PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid")
                elif str(val).upper() == "X":
                    cell.font = Font(name=FONT_FAMILY, size=9.5, color="64748B")

    tot_r1 = start_r1 + len(booths)
    ws1.row_dimensions[tot_r1].height = 26

    ws1.cell(row=tot_r1, column=1, value="합 계 (총 19개 운영단위)").font = font_total
    ws1.cell(row=tot_r1, column=1).alignment = align_center
    ws1.cell(row=tot_r1, column=1).fill = fill_total

    ws1.cell(row=tot_r1, column=2, value="").fill = fill_total
    ws1.cell(row=tot_r1, column=3, value="").fill = fill_total

    cell_scale_tot = ws1.cell(row=tot_r1, column=4, value="36동+2대")
    cell_scale_tot.font = font_total
    cell_scale_tot.fill = fill_total
    cell_scale_tot.alignment = align_center

    cell_tbl_tot = ws1.cell(row=tot_r1, column=5, value=f"=SUM(E{start_r1}:E{tot_r1-1})")
    cell_tbl_tot.font = font_total
    cell_tbl_tot.fill = fill_total
    cell_tbl_tot.alignment = align_right
    cell_tbl_tot.number_format = "#,##0"

    cell_chr_tot = ws1.cell(row=tot_r1, column=6, value=f"=SUM(F{start_r1}:F{tot_r1-1})")
    cell_chr_tot.font = font_total
    cell_chr_tot.fill = fill_total
    cell_chr_tot.alignment = align_right
    cell_chr_tot.number_format = "#,##0"

    cell_stf_tot = ws1.cell(row=tot_r1, column=7, value=f"=SUM(G{start_r1}:G{tot_r1-1})")
    cell_stf_tot.font = font_total
    cell_stf_tot.fill = fill_total
    cell_stf_tot.alignment = align_right
    cell_stf_tot.number_format = "#,##0"

    for col in range(8, 15):
        c_rem = ws1.cell(row=tot_r1, column=col, value="-")
        c_rem.font = font_total
        c_rem.fill = fill_total
        c_rem.alignment = align_center

    for col in range(1, 15):
        ws1.cell(row=tot_r1, column=col).border = border_total

    col_widths_s1 = [6, 12, 26, 10, 10, 10, 10, 12, 16, 17, 13, 28, 40, 24]
    for idx, w in enumerate(col_widths_s1, 1):
        ws1.column_dimensions[get_column_letter(idx)].width = w
    ws1.freeze_panes = "D6"

    # =========================================================================
    # SHEET 2: 업무_분장표 (11 Columns, Standard SSOT Layout)
    # =========================================================================
    ws2 = wb.create_sheet(title="업무_분장표")
    ws2.views.sheetView[0].showGridLines = True

    ws2.merge_cells("A2:K2")
    ws2["A2"] = "｢2026 양재천 걷자! 건강 페스티벌｣ 업무 분장표"
    ws2["A2"].font = font_title
    ws2["A2"].alignment = Alignment(horizontal="left", vertical="center")
    ws2.row_dimensions[2].height = 28

    ws2.merge_cells("A3:K3")
    ws2["A3"] = f"■ 행사일시: 2026. 10. 31.(토) 08:00~14:00 | 기준일자: {today_display} | 주관: 강남구보건소·강남구체육회 | 구획: 1.운영/2.코스/3.부스/4.VIP의전/5.직원식사/6.쓰레기처리"
    ws2["A3"].font = font_subtitle
    ws2["A3"].alignment = Alignment(horizontal="left", vertical="center")
    ws2.row_dimensions[3].height = 20

    headers_s2 = [
        "연번", "업무 구획", "담당 부서 / 기관명", "보건소", "체육회", "대행사",
        "담당자", "행정전화", "휴대전화", "업무", "세부 과업"
    ]
    ws2.row_dimensions[5].height = 28
    for c_idx, h in enumerate(headers_s2, 1):
        cell = ws2.cell(row=5, column=c_idx, value=h)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = align_center
        cell.border = border_header

    start_r2 = 6
    last_cat = ""
    for idx, d in enumerate(duties):
        cur_r = start_r2 + idx
        fill_curr = fill_zebra if idx % 2 == 1 else fill_white

        cat = d.get("category", "")
        show_cat = cat if cat != last_cat else ""
        last_cat = cat

        hc = d.get("headcount", {})
        cnt_b = hc.get("bogun")
        cnt_s = hc.get("sports")
        cnt_a = hc.get("agency")

        # Fallback to parsing remarks if headcount object not present
        if cnt_b is None and cnt_s is None and cnt_a is None:
            rem = d.get("remarks", "")
            mb = re.search(r"보건소\s*(\d+)명", rem)
            ms = re.search(r"체육회\s*(\d+)명", rem)
            ma = re.search(r"대행사\s*(\d+)명", rem)
            cnt_b = int(mb.group(1)) if mb else None
            cnt_s = int(ms.group(1)) if ms else None
            cnt_a = int(ma.group(1)) if ma else None

        d_id = d.get("id", idx + 1)
        id_str = str(d_id) if not str(d_id).endswith("-1") else ""

        tasks = d.get("tasks", [])
        task_summary = f"• {tasks[0]}" if tasks else (f"• {d.get('role')}" if d.get("role") else "")
        subtask = "\n".join(f"• {t}" for t in tasks[1:]) if len(tasks) > 1 else ""

        staff_members = d.get("staffMembers", [])
        if staff_members:
            mgr_str = "\n".join(f"{m['name']} ({m['role']})" if m.get("role") else m["name"] for m in staff_members)
            admin_str = "\n".join(m.get("adminPhone", "") for m in staff_members if m.get("adminPhone"))
            mob_str = "\n".join(m.get("mobilePhone", "") for m in staff_members if m.get("mobilePhone"))
        else:
            mgr_str = d.get("manager", "")
            admin_str = d.get("adminPhone", "")
            mob_str = d.get("mobilePhone", "")

        line_count = max(len(tasks), len(staff_members), 1)
        ws2.row_dimensions[cur_r].height = max(26, line_count * 18 + 6)

        vals = [
            id_str,
            show_cat,
            d.get("deptOrOrg", ""),
            cnt_b if cnt_b and cnt_b > 0 else None,
            cnt_s if cnt_s and cnt_s > 0 else None,
            cnt_a if cnt_a and cnt_a > 0 else None,
            mgr_str,
            admin_str,
            mob_str,
            task_summary,
            subtask
        ]

        for c_idx, val in enumerate(vals, 1):
            cell = ws2.cell(row=cur_r, column=c_idx, value=val)
            cell.font = font_data
            cell.fill = fill_curr
            cell.border = border_cell

            if c_idx in [1, 2]:
                cell.alignment = align_center
            elif c_idx in [4, 5, 6]:
                cell.alignment = align_right
                if val is not None:
                    cell.number_format = "#,##0"
            elif c_idx in [7, 8, 9]:
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            elif c_idx in [3, 10, 11]:
                cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

            if c_idx == 2 and show_cat and show_cat in cat_colors:
                c_style = cat_colors[show_cat]
                cell.font = Font(name=FONT_FAMILY, size=9.5, bold=True, color=c_style["font"])
                cell.fill = PatternFill(start_color=c_style["fill"], end_color=c_style["fill"], fill_type="solid")

    tot_r2 = start_r2 + len(duties)
    ws2.row_dimensions[tot_r2].height = 26
    ws2.cell(row=tot_r2, column=3, value="합계").font = font_total
    ws2.cell(row=tot_r2, column=3).alignment = align_center
    ws2.cell(row=tot_r2, column=3).fill = fill_total

    cell_b_tot = ws2.cell(row=tot_r2, column=4, value=f"=SUM(D{start_r2}:D{tot_r2-1})")
    cell_b_tot.font = font_total; cell_b_tot.fill = fill_total; cell_b_tot.alignment = align_right; cell_b_tot.number_format = "#,##0"

    cell_s_tot = ws2.cell(row=tot_r2, column=5, value=f"=SUM(E{start_r2}:E{tot_r2-1})")
    cell_s_tot.font = font_total; cell_s_tot.fill = fill_total; cell_s_tot.alignment = align_right; cell_s_tot.number_format = "#,##0"

    cell_a_tot = ws2.cell(row=tot_r2, column=6, value=f"=SUM(F{start_r2}:F{tot_r2-1})")
    cell_a_tot.font = font_total; cell_a_tot.fill = fill_total; cell_a_tot.alignment = align_right; cell_a_tot.number_format = "#,##0"

    for col in [1, 2, 7, 8, 9, 10, 11]:
        c = ws2.cell(row=tot_r2, column=col, value="")
        c.fill = fill_total

    for col in range(1, 12):
        ws2.cell(row=tot_r2, column=col).border = border_total

    # Row 50: 총계
    tot_r2_grand = tot_r2 + 1
    ws2.row_dimensions[tot_r2_grand].height = 26
    ws2.cell(row=tot_r2_grand, column=3, value="총계").font = font_total
    ws2.cell(row=tot_r2_grand, column=3).alignment = align_center
    ws2.cell(row=tot_r2_grand, column=3).fill = fill_total

    cell_grand_tot = ws2.cell(row=tot_r2_grand, column=4, value=f"=SUM(D{tot_r2}:F{tot_r2})")
    cell_grand_tot.font = font_total; cell_grand_tot.fill = fill_total; cell_grand_tot.alignment = align_right; cell_grand_tot.number_format = "#,##0"

    for col in [1, 2, 5, 6, 7, 8, 9, 10, 11]:
        c = ws2.cell(row=tot_r2_grand, column=col, value="")
        c.fill = fill_total

    for col in range(1, 12):
        ws2.cell(row=tot_r2_grand, column=col).border = border_total

    col_widths_s2 = [6, 12, 24, 8, 8, 8, 18, 15, 16, 36, 36]
    for idx, w in enumerate(col_widths_s2, 1):
        ws2.column_dimensions[get_column_letter(idx)].width = w
    ws2.freeze_panes = "D6"

    # =========================================================================
    # SHEET 3: 당일_식순타임테이블 (7 Columns, Standard SSOT Layout)
    # =========================================================================
    if schedules:
        ws3 = wb.create_sheet(title="당일_식순타임테이블")
        ws3.views.sheetView[0].showGridLines = True

        ws3.merge_cells("A2:G2")
        ws3["A2"] = "｢2026 양재천 걷자! 건강 페스티벌｣ 행사 당일 타임테이블 (식순)"
        ws3["A2"].font = font_title
        ws3["A2"].alignment = Alignment(horizontal="left", vertical="center")
        ws3.row_dimensions[2].height = 28

        headers_s3 = ["연번", "식순 구분", "시간대", "소요시간", "프로그램 / 행사 내용", "주관 / 담당", "비고"]
        ws3.row_dimensions[4].height = 26
        for c_idx, h in enumerate(headers_s3, 1):
            cell = ws3.cell(row=4, column=c_idx, value=h)
            cell.font = font_header
            cell.fill = fill_sub_header
            cell.alignment = align_center
            cell.border = border_header

        start_r3 = 5
        for idx, s in enumerate(schedules):
            cur_r = start_r3 + idx
            ws3.row_dimensions[cur_r].height = 24
            fill_curr = fill_zebra if idx % 2 == 1 else fill_white

            vals = [
                s.get("id", idx + 1),
                s.get("phase", ""),
                s.get("time", ""),
                s.get("duration", "-"),
                s.get("title", ""),
                s.get("lead", "-"),
                s.get("note", "")
            ]

            for c_idx, val in enumerate(vals, 1):
                cell = ws3.cell(row=cur_r, column=c_idx, value=val)
                cell.font = font_data
                cell.fill = fill_curr
                cell.border = border_cell
                if c_idx in [1, 2, 3, 4]:
                    cell.alignment = align_center
                elif c_idx == 5:
                    cell.alignment = align_left
                    cell.font = font_data_bold
                else:
                    cell.alignment = align_left

        col_widths_s3 = [6, 14, 16, 12, 45, 24, 28]
        for idx, w in enumerate(col_widths_s3, 1):
            ws3.column_dimensions[get_column_letter(idx)].width = w
        ws3.freeze_panes = "C5"

    # Save to disk (SSOT: strictly overwrite the master file)
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    try:
        wb.save(target_path)
        print(f"[Export-Success] Successfully overwritten SSOT master Excel workbook: {target_path}")
        return target_path, "MASTER"
    except PermissionError:
        print(f"[Export-Locked] Error: '{os.path.basename(target_path)}' is currently open in Excel.", file=sys.stderr)
        print(f"[Export-Locked] Please save and close Excel, then retry sync.", file=sys.stderr)
        sys.exit(13)

def archive_legacy_versions():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    moved_count = 0
    pattern = os.path.join(DESKTOP_DIR, "2026_양재천_걷자_건강페스티벌_부스_종합현황_ver *.xlsx")
    for f in glob.glob(pattern):
        base = os.path.basename(f)
        if base.startswith('~$') or os.path.abspath(f).lower() == os.path.abspath(MASTER_EXCEL_PATH).lower():
            continue
        dest = os.path.join(BACKUP_DIR, base)
        try:
            if os.path.exists(dest):
                os.remove(dest)
            import shutil
            shutil.move(f, dest)
            print(f"[Archive-Success] Moved legacy file: {base} -> {BACKUP_DIR}")
            moved_count += 1
        except PermissionError:
            print(f"[Archive-Notice] File '{base}' is currently open in Excel. Will remain until closed.")
        except Exception as err:
            print(f"[Archive-Error] Could not move '{base}': {err}")
    return moved_count

def import_excel_to_json(excel_path=None):
    if not excel_path:
        excel_path = get_latest_desktop_excel_path()
    if not excel_path or not os.path.exists(excel_path):
        raise FileNotFoundError(f"Desktop Excel file not found: {excel_path}")

    print(f"[Import] Loading Desktop Excel from: {excel_path}")
    wb = openpyxl.load_workbook(excel_path, data_only=True)

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 1. Parse Sheet 1: 부스_종합현황
    if "부스_종합현황" in wb.sheetnames:
        ws1 = wb["부스_종합현황"]
        header_row1 = 5
        header_map1 = {}
        for r in range(4, 10):
            cols = {c: str(ws1.cell(r, c).value or '').strip() for c in range(1, ws1.max_column + 1)}
            if any('연번' in v for v in cols.values()) and any('부서' in v or '기관' in v for v in cols.values()):
                header_row1 = r
                for c, v in cols.items():
                    v_clean = v.replace('\n', '').strip()
                    if '연번' in v_clean: header_map1['id'] = c
                    elif '구획' in v_clean: header_map1['zone'] = c
                    elif '운영 부서' in v_clean or '기관명' in v_clean: header_map1['name'] = c
                    elif '규모' in v_clean: header_map1['scale'] = c
                    elif '프로그램' in v_clean: header_map1['program'] = c
                    elif '테이블' in v_clean: header_map1['tables'] = c
                    elif '의자' in v_clean: header_map1['chairs'] = c
                    elif '상주' in v_clean or '인력' in v_clean: header_map1['staffCount'] = c
                    elif '책임자' in v_clean: header_map1['manager'] = c
                    elif '행정전화' in v_clean: header_map1['adminPhone'] = c
                    elif '비상연락망' in v_clean or '휴대전화' in v_clean or '휴대폰' in v_clean: header_map1['mobilePhone'] = c
                    elif '전기사용' in v_clean or '전기 유무' in v_clean or v_clean == '전기': header_map1['electricity'] = c
                    elif '전기 사용' in v_clean or '전기 내역' in v_clean: header_map1['electricityDetail'] = c
                    elif '현수막' in v_clean: header_map1['bannerText'] = c
                    elif '비고' in v_clean or '특이사항' in v_clean: header_map1['remarks'] = c
                break

        program_presets = {
            1: '운영본부(2동), 응급의료부스(1동), VIP 대기실(2동)',
            2: '금연 · 절주 · 영양 보건 사업 홍보 부스 및 건강생활실천 1:1 상담',
            3: '내 신체나이 알아보기, 서울체력장 인증 체력측정 (성인: 2분제자리걷기·악력, 시니어: 의자일어서기)',
            4: '내 신체나이 알아보기, 『리얼피티 프로 플러스』 40초 바른자세·체형 정밀 분석 및 AI 맞춤 운동처방',
            5: '내 신체나이 알아보기 - 웰에이징센터 맞춤형 신체나이·근력 운동 실습 및 상담',
            6: '‘강남’구가 알려주고 ‘도’움되는 ‘감’염병 예방지식(강남도감) 퀴즈 및 수인성 감염병 예방 홍보',
            7: '손은 깨끗하게, 진드기는 멀리! 건강한 강남 ON (뷰박스 손씻기 형광 체험, 진드기 기피제 배부)',
            8: '평생 건강의 지름길, 만성질환 관리로부터! (혈압·혈당 무료 측정 및 대사증후군 1:1 상담)',
            9: '생명을 살리는 4분의 기적, 두근두근 CPR 심폐소생술 및 자동심장충격기(AED) 실습 체험존',
            10: '불법 마약 근절 및 가정 내 폐의약품 안심 수거 캠페인 (마약류 모형 전시 및 OX 퀴즈, VR 체험)',
            11: '마음건강 충전소 (우울·스트레스 선별검사, 마음안심버스 사업 홍보, 전문 정신건강 상담)',
            12: '강남구치매안심센터 행복한 기억찾기 캠페인 (치매 선별검사 및 인지강화 프로그램)',
            13: '강남구의사회 & 메드렉스병원 ‘머리부터 발끝까지 안전하게 걷자’ (관절·척추 정형외과 전문의 상담)',
            14: '바른자세가 건강의 시작, 한의학을 통한 체형검사 체험존 (체형 균형 및 경락 건강 상담)',
            15: '가정의학과 전문의 1:1 맞춤형 문진 및 만성질환 예방 생활습관 의학 전문 심층 상담',
            16: '중년 여성 유방 자가검진 촉지 교육, 부인과 여성질환 및 맞춤 영양 상담',
            17: '척추·관절 간이 침 치료, 근육 테이핑 요법 시연 및 척추 건강 1:1 한방 상담',
            18: '이동형 대형 치과검진버스 연계 구강 검진 및 구강건강 관리법 안내, 칫솔질 실습',
            19: '거북목·척추측만증 X-Ray 무료 방사선 촬영 및 척추교정 전문의 1:1 상담',
            20: '1:1 퍼스널 컬러 진단 및 계절별 산책·야외운동 맞춤 메이크업 재능기부 봉사'
        }

        new_booths = []
        for r in range(header_row1 + 1, ws1.max_row + 1):
            val_c1 = ws1.cell(row=r, column=1).value
            val_c3 = ws1.cell(row=r, column=header_map1.get("name", 3)).value
            if val_c1 is None and val_c3 is None:
                continue
            if str(val_c1 or "").startswith("합 계") or str(val_c1 or "").startswith("합계") or str(val_c3 or "").startswith("합 계"):
                break

            b_id = r - header_row1
            name = str(val_c3 or "").strip()
            scale = str(ws1.cell(row=r, column=header_map1.get("scale", 4)).value or "").strip()
            if scale.isdigit():
                scale = f"{scale}동"

            tbl = ws1.cell(row=r, column=header_map1.get("tables", 5)).value or 0
            chr_val = ws1.cell(row=r, column=header_map1.get("chairs", 6)).value or 0
            staff = ws1.cell(row=r, column=header_map1.get("staffCount", 7)).value or 0
            mgr = str(ws1.cell(row=r, column=header_map1.get("manager", 8)).value or "").strip()
            admin_p = str(ws1.cell(row=r, column=header_map1.get("adminPhone", 9)).value or "").strip()
            mob_p = str(ws1.cell(row=r, column=header_map1.get("mobilePhone", 10)).value or "").strip()
            elec = str(ws1.cell(row=r, column=header_map1.get("electricity", 11)).value or "").strip()
            elec_d = str(ws1.cell(row=r, column=header_map1.get("electricityDetail", 12)).value or "").strip()
            banner = str(ws1.cell(row=r, column=header_map1.get("bannerText", 13)).value or "").strip()
            rem = str(ws1.cell(row=r, column=header_map1.get("remarks", 14)).value or "").strip()

            prog = ""
            if "program" in header_map1:
                prog = str(ws1.cell(row=r, column=header_map1["program"]).value or "").strip()
            if not prog:
                prog = program_presets.get(b_id, banner)

            if b_id == 1 or ("보건행정과" in name and "운영본부" in banner):
                cat = "운영본부"
            elif any(k in name for k in ["보건행정과", "건강관리과", "질병관리과", "의약과"]):
                cat = "보건소 부서"
            else:
                cat = "민간"

            new_booths.append({
                "id": b_id,
                "category": cat,
                "name": name,
                "scale": scale,
                "program": prog,
                "status": "확정",
                "tables": int(tbl) if str(tbl).isdigit() else 0,
                "chairs": int(chr_val) if str(chr_val).isdigit() else 0,
                "staffCount": int(staff) if str(staff).isdigit() else 0,
                "manager": mgr,
                "phone": (admin_p if admin_p != "-" else "") or (mob_p if mob_p != "-" else ""),
                "adminPhone": admin_p if admin_p != "-" else "",
                "mobilePhone": mob_p if mob_p != "-" else "",
                "electricity": elec,
                "electricityDetail": elec_d if elec_d != "-" else "",
                "bannerText": banner,
                "remarks": rem if rem != "-" else ""
            })

        if new_booths:
            data['booths'] = new_booths
            print(f"[Import] Parsed {len(new_booths)} booths from Sheet 1.")

    # 2. Parse Sheet 2: 업무_분장표
    if "업무_분장표" in wb.sheetnames:
        ws2 = wb["업무_분장표"]
        header_row2 = 5
        header_map2 = {}
        for r in range(4, 10):
            cols = {c: str(ws2.cell(r, c).value or '').strip() for c in range(1, ws2.max_column + 1)}
            if any('연번' in v for v in cols.values()) and any('구획' in v or '부서' in v for v in cols.values()):
                header_row2 = r
                for c, v in cols.items():
                    v_clean = v.replace('\n', '').strip()
                    if '연번' in v_clean: header_map2['id'] = c
                    elif '구획' in v_clean: header_map2['category'] = c
                    elif '부서' in v_clean or '기관' in v_clean: header_map2['dept'] = c
                    elif v_clean == '보건소': header_map2['cnt_bogun'] = c
                    elif v_clean == '체육회': header_map2['cnt_sports'] = c
                    elif v_clean == '대행사': header_map2['cnt_agency'] = c
                    elif '담당자' in v_clean or '책임자' in v_clean: header_map2['manager'] = c
                    elif '행정전화' in v_clean: header_map2['adminPhone'] = c
                    elif '비상연락망' in v_clean or '휴대전화' in v_clean or '휴대폰' in v_clean: header_map2['mobilePhone'] = c
                    elif v_clean == '업무': header_map2['task_summary'] = c
                    elif '과업' in v_clean or '체크리스트' in v_clean: header_map2['tasks'] = c
                    elif '역할' in v_clean: header_map2['role'] = c
                    elif '비고' in v_clean or '협조' in v_clean: header_map2['remarks'] = c
                break

        cat_normalize = {
            '운영총괄': '운영',
            '무대': '운영',
            '운영부스': '운영',
            'VIP의전': 'VIP의전',
            '코스': '코스',
            '부스 및 행사장': '부스',
            '부스 및\n행사장': '부스',
            '부스': '부스',
            '직원식사': '직원식사',
            '쓰레기처리': '쓰레기처리'
        }

        duties_list = []
        last_cat = "운영"
        last_no = "1"

        for r in range(header_row2 + 1, ws2.max_row + 1):
            c1 = ws2.cell(row=r, column=header_map2.get("id", 1)).value
            c3 = ws2.cell(row=r, column=header_map2.get("dept", 3)).value
            if c1 is None and c3 is None:
                continue
            if str(c3 or "").strip() in ["합계", "총계"] or str(c1 or "").strip() in ["합계", "총계"]:
                break

            if c1 is not None and str(c1).strip() and str(c1).strip() != "-":
                no_str = str(c1).strip()
                last_no = no_str
            else:
                no_str = f"{last_no}-1" if last_no else str(r - header_row2)

            raw_cat = str(ws2.cell(row=r, column=header_map2.get("category", 2)).value or "").strip()
            if raw_cat:
                last_cat = cat_normalize.get(raw_cat.replace("\n", " "), cat_normalize.get(raw_cat, raw_cat))
            cat = last_cat

            dept = str(c3 or "").strip()

            cnt_bogun = ws2.cell(row=r, column=header_map2["cnt_bogun"]).value if "cnt_bogun" in header_map2 else None
            cnt_sports = ws2.cell(row=r, column=header_map2["cnt_sports"]).value if "cnt_sports" in header_map2 else None
            cnt_agency = ws2.cell(row=r, column=header_map2["cnt_agency"]).value if "cnt_agency" in header_map2 else None

            b_num = int(cnt_bogun) if cnt_bogun is not None and str(cnt_bogun).isdigit() else 0
            s_num = int(cnt_sports) if cnt_sports is not None and str(cnt_sports).isdigit() else 0
            a_num = int(cnt_agency) if cnt_agency is not None and str(cnt_agency).isdigit() else 0

            mgr = str(ws2.cell(row=r, column=header_map2.get("manager", 7)).value or "").strip()
            admin_p = str(ws2.cell(row=r, column=header_map2.get("adminPhone", 8)).value or "").strip()
            mob_p = str(ws2.cell(row=r, column=header_map2.get("mobilePhone", 9)).value or "").strip()

            col_task = str(ws2.cell(row=r, column=header_map2["task_summary"]).value or "").strip() if "task_summary" in header_map2 else ""
            col_subtask = str(ws2.cell(row=r, column=header_map2["tasks"]).value or "").strip() if "tasks" in header_map2 else ""

            tasks = []
            if col_task and col_task != "-":
                for line in col_task.split("\n"):
                    line_clean = re.sub(r"^[•\-\*\d\.\)\s]+", "", line).strip()
                    if line_clean and line_clean not in tasks:
                        tasks.append(line_clean)
            if col_subtask and col_subtask != "-":
                for line in col_subtask.split("\n"):
                    line_clean = re.sub(r"^[•\-\*\d\.\)\s]+", "", line).strip()
                    if line_clean and line_clean not in tasks:
                        tasks.append(line_clean)

            role = str(ws2.cell(row=r, column=header_map2["role"]).value or "").strip() if "role" in header_map2 else ""
            if not role or role == "-":
                role = tasks[0] if tasks else "행사 지원"

            rem_parts = []
            if b_num > 0: rem_parts.append(f"보건소 {b_num}명")
            if s_num > 0: rem_parts.append(f"체육회 {s_num}명")
            if a_num > 0: rem_parts.append(f"대행사 {a_num}명")

            remarks_val = str(ws2.cell(row=r, column=header_map2["remarks"]).value or "").strip() if "remarks" in header_map2 else ""
            if remarks_val and remarks_val != "-":
                rem_parts.append(remarks_val)
            remarks = ", ".join(rem_parts)

            staff_members = []
            mgr_lines = [l.strip() for l in mgr.split("\n") if l.strip()]
            admin_lines = [l.strip() for l in admin_p.split("\n") if l.strip()]
            mob_lines = [l.strip() for l in mob_p.split("\n") if l.strip()]

            for s_idx, m_line in enumerate(mgr_lines):
                m_match = re.match(r"^([^(]+)(?:\(([^)]+)\))?", m_line)
                if m_match:
                    s_name = m_match.group(1).strip()
                    s_role = m_match.group(2).strip() if m_match.group(2) else ""
                else:
                    s_name = m_line.strip()
                    s_role = ""
                s_admin = admin_lines[s_idx] if s_idx < len(admin_lines) else (admin_lines[0] if admin_lines else "")
                s_mob = mob_lines[s_idx] if s_idx < len(mob_lines) else (mob_lines[0] if mob_lines else "")
                staff_members.append({
                    "name": s_name,
                    "role": s_role,
                    "adminPhone": s_admin if s_admin != "-" else "",
                    "mobilePhone": s_mob if s_mob != "-" else ""
                })

            duties_list.append({
                "id": int(no_str) if no_str.isdigit() else no_str,
                "category": cat,
                "deptOrOrg": dept,
                "role": role,
                "manager": mgr,
                "phone": (admin_p if admin_p != "-" else "") or (mob_p if mob_p != "-" else ""),
                "adminPhone": admin_p if admin_p != "-" else "",
                "mobilePhone": mob_p if mob_p != "-" else "",
                "tasks": tasks,
                "staffMembers": staff_members,
                "headcount": {
                    "bogun": b_num,
                    "sports": s_num,
                    "agency": a_num
                },
                "remarks": remarks
            })

        if duties_list:
            data['duties'] = duties_list
            print(f"[Import] Parsed {len(duties_list)} duties from Sheet 2.")

    # 3. Parse Sheet 3: 당일_식순타임테이블
    sheet3_name = None
    for s_name in ["당일_식순타임테이블", "행사_식순", "타임테이블"]:
        if s_name in wb.sheetnames:
            sheet3_name = s_name
            break

    if sheet3_name:
        ws3 = wb[sheet3_name]
        header_row3 = 4
        header_map3 = {}
        for r in range(2, 8):
            cols = {c: str(ws3.cell(r, c).value or "").strip() for c in range(1, ws3.max_column + 1)}
            if any("연번" in v for v in cols.values()) and any("식순" in v or "프로그램" in v or "시간" in v for v in cols.values()):
                header_row3 = r
                for c, v in cols.items():
                    v_clean = v.replace("\n", "").strip()
                    if "연번" in v_clean: header_map3["id"] = c
                    elif "식순" in v_clean or "구분" in v_clean: header_map3["phase"] = c
                    elif "시간대" in v_clean or "시간" in v_clean: header_map3["time"] = c
                    elif "소요" in v_clean: header_map3["duration"] = c
                    elif "프로그램" in v_clean or "내용" in v_clean: header_map3["title"] = c
                    elif "주관" in v_clean or "담당" in v_clean: header_map3["lead"] = c
                    elif "비고" in v_clean: header_map3["note"] = c
                break

        schedule_list = []
        for r in range(header_row3 + 1, ws3.max_row + 1):
            no = ws3.cell(row=r, column=header_map3.get("id", 1)).value
            title = ws3.cell(row=r, column=header_map3.get("title", 5)).value
            if no is None and title is None:
                continue
            s_id = int(no) if no is not None and str(no).strip().isdigit() else len(schedule_list) + 1
            phase = str(ws3.cell(row=r, column=header_map3.get("phase", 2)).value or "").strip()
            time_val = str(ws3.cell(row=r, column=header_map3.get("time", 3)).value or "").strip()
            duration = str(ws3.cell(row=r, column=header_map3.get("duration", 4)).value or "").strip()
            title_val = str(title or "").strip()
            lead_val = str(ws3.cell(row=r, column=header_map3.get("lead", 6)).value or "").strip()
            note_val = str(ws3.cell(row=r, column=header_map3.get("note", 7)).value or "").strip()
            if not title_val:
                continue

            schedule_list.append({
                "id": s_id,
                "phase": phase,
                "time": time_val,
                "duration": duration if duration else "-",
                "title": title_val,
                "lead": lead_val if lead_val else "-",
                "status": "예정",
                "note": note_val if note_val != "-" else ""
            })

        if schedule_list:
            data['schedule'] = schedule_list
            print(f"[Import] Parsed {len(schedule_list)} schedule items from Sheet 3.")

    # Update metadata
    data['meta']['lastUpdated'] = datetime.now().strftime("%Y-%m-%d")

    # Save to JSON
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[Import-Success] Synchronized Desktop Excel into {JSON_PATH}")
    return True

if __name__ == '__main__':
    mode = '--to-excel'
    if len(sys.argv) > 1:
        mode = sys.argv[1]

    if mode in ['--to-excel', '-e']:
        target = sys.argv[2] if len(sys.argv) > 2 else MASTER_EXCEL_PATH
        res, ver = export_json_to_excel(target)
        print(f"RESULT_FILE={res}")
        print(f"RESULT_VER={ver}")
    elif mode in ['--to-frontend', '-f']:
        src = sys.argv[2] if len(sys.argv) > 2 else None
        success = import_excel_to_json(src)
        if success and any(arg in sys.argv for arg in ['--cloud', '--sync', '-c']):
            import subprocess
            print("[Cloud-Sync] Automatically triggering Cloudflare Pages & KV sync...")
            subprocess.run(["node", "scripts/prepare-pages-output.js"], check=False)
            subprocess.run(["node", "scripts/sync-festival-to-cloud.js"], check=False)
    elif mode in ['--archive-legacy', '-a']:
        cnt = archive_legacy_versions()
        print(f"ARCHIVED_COUNT={cnt}")
    elif mode in ['--status', '-s']:
        latest = get_latest_desktop_excel_path()
        print(f"SSOT Master Excel: {MASTER_EXCEL_PATH} (Exists: {os.path.exists(MASTER_EXCEL_PATH)})")
        print(f"Active Desktop Excel: {latest}")
        if latest and os.path.exists(latest):
            wb = openpyxl.load_workbook(latest, data_only=True)
            print(f"Sheets in Excel: {wb.sheetnames}")
    else:
        print(f"Unknown mode: {mode}")
        print("Usage: python scripts/sync_festival_excel.py [--to-excel | --to-frontend [--cloud] | --archive-legacy | --status]")
