#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VITAL Work & Wealth Architecture — Weekly 2-Column Comparative HWPX Generator
Requirement: R1 (Weekly Administrative Work Reports & 2-Column Comparative Table)
Standards: Rule G, Rule M, Rule P, Rule O, docs/HWP_GENERATION_GUIDELINES.md

Generates authentic, public administration compliant HWPX weekly reports:
- Preserves 2-column comparative layout (Table 1: 업무실적 vs 업무계획)
- Preserves multi-page cell streaming: pageBreak="CELL", repeatHeader="1", treatAsChar="0"
- Strictly enforces 5-Pillar anti-overlap geometry:
    Pillar 1: Dynamic wrap_text_positions and linesegarray placed as last child
    Pillar 2: Cell height and row height synchronization (sync_table_geometry)
    Pillar 3: Flow control isolation (preserve treatAsChar="0" for multi-page table)
    Pillar 4: Header style normalization (BREAK word, 0xFFFFFFFF margin clamp)
    Pillar 5: Pure text node manipulation and ghost child cleanup
- Packs uncompressed mimetype at offset 0 and patches ZIP Bit 2 Fast Deflating flag (value 4)
- Self-verifies with verify_weekly_hwpx_no_overlap()
"""

import os
import sys
import shutil
import zipfile
import xml.etree.ElementTree as ET
import struct
import json
import argparse
from datetime import datetime, timedelta

# Reconfigure stdout to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

NS_MAP = {
    'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
    'hp10': 'http://www.hancom.co.kr/hwpml/2016/paragraph',
    'hs': 'http://www.hancom.co.kr/hwpml/2011/section',
    'hc': 'http://www.hancom.co.kr/hwpml/2011/core',
    'ha': 'http://www.hancom.co.kr/hwpml/2011/app',
    'hh': 'http://www.hancom.co.kr/hwpml/2011/head',
    'hhs': 'http://www.hancom.co.kr/hwpml/2011/history',
    'hm': 'http://www.hancom.co.kr/hwpml/2011/master-page',
    'hpf': 'http://www.hancom.co.kr/schema/2011/hpf',
    'dc': 'http://purl.org/dc/elements/1.1/',
    'opf': 'http://www.idpf.org/2007/opf/',
}
for _k, _v in NS_MAP.items():
    ET.register_namespace(_k, _v)

HP_P = f"{{{NS_MAP['hp']}}}p"
HP_RUN = f"{{{NS_MAP['hp']}}}run"
HP_T = f"{{{NS_MAP['hp']}}}t"
HP_TBL = f"{{{NS_MAP['hp']}}}tbl"
HP_POS = f"{{{NS_MAP['hp']}}}pos"
HP_SZ = f"{{{NS_MAP['hp']}}}sz"
HP_TR = f"{{{NS_MAP['hp']}}}tr"
HP_TC = f"{{{NS_MAP['hp']}}}tc"
HP_SUBLIST = f"{{{NS_MAP['hp']}}}subList"
HP_CELLADDR = f"{{{NS_MAP['hp']}}}cellAddr"
HP_CELLSPAN = f"{{{NS_MAP['hp']}}}cellSpan"
HP_CELLSZ = f"{{{NS_MAP['hp']}}}cellSz"
HP_CELLMARGIN = f"{{{NS_MAP['hp']}}}cellMargin"
HP_LINESEGA = f"{{{NS_MAP['hp']}}}linesegarray"
HP_LINESEG = f"{{{NS_MAP['hp']}}}lineseg"
HH_PARAPR = f"{{{NS_MAP['hh']}}}paraPr"
HH_CHARPR = f"{{{NS_MAP['hh']}}}charPr"
HH_LINESPACING = f"{{{NS_MAP['hh']}}}lineSpacing"
HC_INTENT = f"{{{NS_MAP['hc']}}}intent"


def compute_wednesday_dates(ref_date_str=None):
    """
    Computes Wednesday cycle dates:
    - W: target Wednesday
    - Performance period: [W-2, W+4] (Monday ~ Sunday)
    - Plan period: [W+5, W+11] (Following Monday ~ Sunday)
    """
    if ref_date_str:
        dt = datetime.strptime(ref_date_str[:10], '%Y-%m-%d')
    else:
        dt = datetime.now()

    # weekday(): 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
    day_of_week = dt.weekday()
    diff_to_wed = 2 - day_of_week
    wed = dt + timedelta(days=diff_to_wed)

    p_start = wed - timedelta(days=2)   # Monday
    p_end = wed + timedelta(days=4)     # Sunday
    n_start = wed + timedelta(days=5)   # Next Monday
    n_end = wed + timedelta(days=11)    # Next Sunday

    p_label = f"{p_start.month:02d}. {p_start.day:02d}.(월) ~ {p_end.month:02d}. {p_end.day:02d}.(일)"
    n_label = f"{n_start.month:02d}. {n_start.day:02d}.(월) ~ {n_end.month:02d}. {n_end.day:02d}.(일)"

    return {
        'targetWednesday': wed.strftime('%Y-%m-%d'),
        'performanceStart': p_start.strftime('%Y-%m-%d'),
        'performanceEnd': p_end.strftime('%Y-%m-%d'),
        'planStart': n_start.strftime('%Y-%m-%d'),
        'planEnd': n_end.strftime('%Y-%m-%d'),
        'performanceLabel': p_label,
        'planLabel': n_label,
    }


def find_base_template():
    r"""
    Finds the cleanest base weekly HWPX template in priority order:
    1. public/templates/template_weekly.hwpx
    2. scratch/template_weekly.hwpx
    3. F:\_Organized_Archive\2026년\01_기획총괄_주요업무_행감\(20261021) 보건소 주간 업무실적 및 계획(건강증진팀)_신체활동.hwpx
    4. D:\Desktop\(20261104) 보건소 주간 업무실적 및 계획(건강증진팀) (1).hwpx
    """
    candidates = [
        os.path.join(os.getcwd(), 'public', 'templates', 'template_weekly.hwpx'),
        os.path.join(os.getcwd(), 'scratch', 'template_weekly.hwpx'),
        r'F:\_Organized_Archive\2026년\01_기획총괄_주요업무_행감\(20261021) 보건소 주간 업무실적 및 계획(건강증진팀)_신체활동.hwpx',
        r'D:\Desktop\(20261104) 보건소 주간 업무실적 및 계획(건강증진팀) (1).hwpx',
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    raise FileNotFoundError("No weekly report base template found in candidates list.")


def char_visual_width(ch, vertsize=1200, scale=0.92):
    vertsize = max(100, int(vertsize))
    if ord(ch) > 127:
        return max(1, int(vertsize * 0.90 * scale))
    return max(1, int(vertsize * 0.45 * scale))


def wrap_text_positions(text, horzsize=24263, vertsize=1200, scale=0.92):
    """Calculates character wrapping indices matching BREAK_WORD behavior."""
    if not text:
        return [0]
    horzsize = max(1200, int(horzsize))
    tokens = []
    i = 0
    n = len(text)
    while i < n:
        start = i
        while i < n and text[i] != ' ':
            i += 1
        while i < n and text[i] == ' ':
            i += 1
        tokens.append((start, i, text[start:i]))

    textpos_list = [0]
    cur_line_w = 0
    for start, end, tok in tokens:
        vis_tok = tok.rstrip(' ')
        vis_w = sum(char_visual_width(c, vertsize, scale) for c in vis_tok)
        full_w = sum(char_visual_width(c, vertsize, scale) for c in tok)

        if cur_line_w + vis_w <= horzsize:
            cur_line_w += full_w
        else:
            if cur_line_w > 0:
                textpos_list.append(start)
                cur_line_w = 0
            if vis_w <= horzsize:
                cur_line_w = full_w
            else:
                c_idx = start
                line_accum = 0
                while c_idx < end:
                    cw = char_visual_width(text[c_idx], vertsize, scale)
                    if line_accum + cw > horzsize and line_accum > 0:
                        textpos_list.append(c_idx)
                        line_accum = 0
                    line_accum += cw
                    c_idx += 1
                cur_line_w = line_accum

    return textpos_list


def create_paragraph(text, para_pr_id=53, char_pr_id=45, horzsize=24263, vertsize=1200):
    """
    Builds a clean <hp:p> element containing:
    - single <hp:run> with <hp:t>
    - trailing <hp:linesegarray> placed as the last child
    """
    p_el = ET.Element(HP_P)
    p_el.attrib['paraPrIDRef'] = str(para_pr_id)
    p_el.attrib['styleIDRef'] = '0'
    p_el.attrib['pageBreak'] = '0'
    p_el.attrib['columnBreak'] = '0'
    p_el.attrib['merged'] = '0'

    r_el = ET.SubElement(p_el, HP_RUN)
    r_el.attrib['charPrIDRef'] = str(char_pr_id)

    t_el = ET.SubElement(r_el, HP_T)
    t_el.text = text if text else ''

    lsa_el = ET.SubElement(p_el, HP_LINESEGA)
    textpos_list = wrap_text_positions(text, horzsize=horzsize, vertsize=vertsize)

    spacing = int(vertsize * 0.3)
    textheight = vertsize
    baseline = int(vertsize * 0.85)

    for i, tp in enumerate(textpos_list):
        ls_el = ET.SubElement(lsa_el, HP_LINESEG)
        ls_el.attrib['textpos'] = str(tp)
        ls_el.attrib['vertpos'] = str(i * (vertsize + spacing))
        ls_el.attrib['vertsize'] = str(vertsize)
        ls_el.attrib['textheight'] = str(textheight)
        ls_el.attrib['baseline'] = str(baseline)
        ls_el.attrib['spacing'] = str(spacing)
        ls_el.attrib['horzpos'] = '0'
        ls_el.attrib['horzsize'] = str(horzsize)
        ls_el.attrib['flags'] = '393216'

    return p_el, len(textpos_list) * (vertsize + spacing)


def populate_weekly_cell(tc_el, items, status='performance', cell_width=24545):
    """
    Fills Table 1 Row 1 cell (left = performance, right = plan) with structured paragraphs:
    - 12pt Bold Blue #0000FF for project titles (paraPr=54, charPr=42)
    - 12pt Regular Black for sub-items (paraPr=53, charPr=45)
    - Recalculates linesegarray with strictly increasing cumulative vertpos
    """
    sublist = tc_el.find(f'./{HP_SUBLIST}')
    container = sublist if sublist is not None else tc_el

    # Clear existing paragraphs
    for p in list(container.findall(f'./{HP_P}')):
        container.remove(p)

    horzsize = cell_width - 282  # default 141 margin on left and right
    filter_items = [it for it in items if it.get('status') == status]
    filter_items.sort(key=lambda x: x.get('projectOrder', 1))

    total_vert_height = 0
    cum_vertpos = 0

    if not filter_items:
        # Placeholder paragraph
        p_el, h = create_paragraph('해당사항 없음', para_pr_id=53, char_pr_id=45, horzsize=horzsize)
        container.append(p_el)
        total_vert_height = h
        return total_vert_height

    for idx, item in enumerate(filter_items):
        # Spacer between project blocks
        if idx > 0:
            sp_p, _ = create_paragraph('', para_pr_id=54, char_pr_id=42, horzsize=horzsize, vertsize=800)
            lsa = sp_p.find(f'./{HP_LINESEGA}')
            for ls in lsa.findall(f'./{HP_LINESEG}'):
                ls.attrib['vertpos'] = str(cum_vertpos)
            cum_vertpos += 1000
            container.append(sp_p)

        # 1. Project Title
        p_order = item.get('projectOrder', idx + 1)
        p_name = item.get('projectName', '')
        title_text = p_name if p_name.startswith(f"{p_order}.") else f"{p_order}. {p_name}"
        title_p, th = create_paragraph(title_text, para_pr_id=54, char_pr_id=42, horzsize=horzsize, vertsize=1200)

        # Adjust cumulative vertpos for lines
        lsa = title_p.find(f'./{HP_LINESEGA}')
        for i, ls in enumerate(lsa.findall(f'./{HP_LINESEG}')):
            ls.attrib['vertpos'] = str(cum_vertpos + i * 1560)
        cum_vertpos += th
        container.append(title_p)

        # 2. Details
        details = []
        if item.get('period'):
            details.append(f" ○ 기    간 : {item['period']}")
        if item.get('target'):
            details.append(f" ○ 대    상 : {item['target']}")
        if item.get('location'):
            details.append(f" ○ 장    소 : {item['location']}")

        contents = item.get('contents', [])
        if contents:
            if len(contents) == 1 and '\n' not in contents[0]:
                details.append(f" ○ 내    용 : {contents[0]}")
            else:
                details.append(" ○ 내    용")
                for c in contents:
                    for line in c.split('\n'):
                        line = line.strip()
                        if line:
                            details.append(line if line.startswith('-') else f"   - {line}")

        if item.get('metrics'):
            m_label = '실    적' if status == 'performance' else '계    획'
            details.append(f" ○ {m_label} : {item['metrics']}")

        for d_text in details:
            det_p, dh = create_paragraph(d_text, para_pr_id=53, char_pr_id=45, horzsize=horzsize, vertsize=1200)
            lsa = det_p.find(f'./{HP_LINESEGA}')
            for i, ls in enumerate(lsa.findall(f'./{HP_LINESEG}')):
                ls.attrib['vertpos'] = str(cum_vertpos + i * 1560)
            cum_vertpos += dh
            container.append(det_p)

    total_vert_height = cum_vertpos + 282  # add top/bottom padding
    return total_vert_height


def normalize_header_styles(hdr_elem):
    """Normalizes header.xml styles (Pillar 4): lineWrap SQUEEZE -> BREAK, lineSpacing < 100% -> 130%."""
    if hdr_elem is None:
        return
    for ppr in hdr_elem.iter(HH_PARAPR):
        pid = ppr.attrib.get('id')
        if pid == '129':
            for intent_el in ppr.iter(HC_INTENT):
                try:
                    if int(intent_el.attrib.get('value', '0')) < 0:
                        intent_el.attrib['value'] = '0'
                except ValueError:
                    intent_el.attrib['value'] = '0'
        for el in ppr.iter():
            if el.attrib.get('lineWrap') == 'SQUEEZE':
                el.attrib['lineWrap'] = 'BREAK'
            if el.tag == HH_LINESPACING and el.attrib.get('type', 'PERCENT') == 'PERCENT':
                try:
                    v = int(el.attrib.get('value', '160'))
                    if 0 < v < 100:
                        el.attrib['value'] = '130'
                except ValueError:
                    pass


def patch_zip_flags(hwpx_path):
    """Restores Bit 2 Fast Deflating flag (value 4) in ZIP local and central directory headers."""
    with open(hwpx_path, 'r+b') as f:
        data = bytearray(f.read())
    offset = 0
    while offset < len(data) - 30:
        if data[offset:offset + 4] == b'PK\x03\x04':
            comp_method = struct.unpack_from('<H', data, offset + 8)[0]
            if comp_method == 8:
                struct.pack_into('<H', data, offset + 6, 4)
        offset += 1
    offset = 0
    while offset < len(data) - 46:
        if data[offset:offset + 4] == b'PK\x01\x02':
            comp_method = struct.unpack_from('<H', data, offset + 10)[0]
            if comp_method == 8:
                struct.pack_into('<H', data, offset + 8, 4)
        offset += 1
    with open(hwpx_path, 'wb') as f:
        f.write(data)


def build_weekly_hwpx(template_path, output_path, report_data):
    """
    Compiles a complete 2-column comparative weekly HWPX document:
    1. Reads template_path (non-destructive)
    2. Updates Table 0 (Organization Header)
    3. Updates Table 1 Row 0 (Date Headers)
    4. Injects Cell 0 (Performance actuals) and Cell 1 (Next-week plan)
    5. Synchronizes cell heights, row heights, and table geometries
    6. Packs into output_path with uncompressed mimetype and patched ZIP flags
    7. Verifies 0 defects with verify_weekly_hwpx_no_overlap
    """
    tmp_dir = os.path.join(os.path.dirname(output_path), f"tmp_weekly_{os.getpid()}")
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir)
    os.makedirs(tmp_dir, exist_ok=True)

    try:
        # Extract template
        with zipfile.ZipFile(template_path, 'r') as z:
            z.extractall(tmp_dir)

        # 1. Normalize header.xml
        hdr_path = os.path.join(tmp_dir, 'Contents', 'header.xml')
        if os.path.exists(hdr_path):
            hdr_tree = ET.parse(hdr_path)
            hdr_root = hdr_tree.getroot()
            normalize_header_styles(hdr_root)
            hdr_tree.write(hdr_path, encoding='utf-8', xml_declaration=True)

        # 2. Modify Contents/section0.xml
        sec_path = os.path.join(tmp_dir, 'Contents', 'section0.xml')
        sec_tree = ET.parse(sec_path)
        sec_root = sec_tree.getroot()

        tbls = sec_root.findall(f'.//{HP_TBL}')
        if len(tbls) < 2:
            raise ValueError(f"Template must contain at least 2 tables, found {len(tbls)}")

        tbl0 = tbls[0]
        tbl1 = tbls[1]

        # Update Table 0: Department and Team Title
        dept_name = report_data.get('departmentName', '보건행정과')
        team_title = report_data.get('teamTitle', '건강증진팀장 김지영')

        t0_rows = tbl0.findall(f'./{HP_TR}')
        if t0_rows:
            t0_cells = t0_rows[0].findall(f'./{HP_TC}')
            if len(t0_cells) >= 2:
                # Cell 0: Department
                t_node0 = t0_cells[0].find(f'.//{HP_T}')
                if t_node0 is not None:
                    t_node0.text = f"❚ {dept_name}"
                # Cell 1: Team Title
                t_node1 = t0_cells[1].find(f'.//{HP_T}')
                if t_node1 is not None:
                    t_node1.text = team_title

        # Update Table 1: Comparative Master Table
        # Ensure multi-page flow attributes
        tbl1.attrib['pageBreak'] = 'CELL'
        tbl1.attrib['repeatHeader'] = '1'
        pos_el = tbl1.find(f'./{HP_POS}')
        if pos_el is not None:
            pos_el.attrib['treatAsChar'] = '0'

        t1_rows = tbl1.findall(f'./{HP_TR}')
        if len(t1_rows) < 2:
            raise ValueError("Table 1 must have at least 2 rows (header row and content row)")

        # Row 0: Headers
        r0_cells = t1_rows[0].findall(f'./{HP_TC}')
        perf_label = report_data.get('performancePeriod', '')
        plan_label = report_data.get('planPeriod', '')

        if len(r0_cells) >= 2:
            # Cell 0: Performance header
            ps0 = r0_cells[0].findall(f'.//{HP_P}')
            if len(ps0) >= 2:
                t_top = ps0[0].find(f'.//{HP_T}')
                if t_top is not None:
                    t_top.text = '업무실적'
                t_sub = ps0[1].find(f'.//{HP_T}')
                if t_sub is not None:
                    t_sub.text = perf_label

            # Cell 1: Plan header
            ps1 = r0_cells[1].findall(f'.//{HP_P}')
            if len(ps1) >= 2:
                t_top = ps1[0].find(f'.//{HP_T}')
                if t_top is not None:
                    t_top.text = '업무계획 '
                t_sub = ps1[1].find(f'.//{HP_T}')
                if t_sub is not None:
                    t_sub.text = plan_label

        # Row 1: Content Cells
        r1_cells = t1_rows[1].findall(f'./{HP_TC}')
        items = report_data.get('items', [])

        left_h = populate_weekly_cell(r1_cells[0], items, status='performance')
        right_h = populate_weekly_cell(r1_cells[1], items, status='plan')

        # Synchronize Row 1 cell heights
        row1_h = max(left_h, right_h, 278950)
        for tc in r1_cells:
            cell_sz = tc.find(f'./{HP_CELLSZ}')
            if cell_sz is not None:
                cell_sz.attrib['height'] = str(row1_h)

        # Synchronize Table 1 total height
        t1_sz = tbl1.find(f'./{HP_SZ}')
        if t1_sz is not None:
            t1_sz.attrib['height'] = str(3388 + row1_h)

        # Ensure all linesegarrays are the last child in every paragraph
        for p in sec_root.iter(HP_P):
            children = list(p)
            lsa_indices = [i for i, c in enumerate(children) if c.tag == HP_LINESEGA]
            if lsa_indices and lsa_indices[-1] != len(children) - 1:
                lsa = p.find(f'./{HP_LINESEGA}')
                if lsa is not None:
                    p.remove(lsa)
                    p.append(lsa)

        sec_tree.write(sec_path, encoding='utf-8', xml_declaration=True)

        # 3. Repack into valid HWPX archive
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        if os.path.exists(output_path):
            os.remove(output_path)

        with zipfile.ZipFile(output_path, 'w') as z_out:
            # First, write mimetype uncompressed at offset 0
            mimetype_path = os.path.join(tmp_dir, 'mimetype')
            if os.path.exists(mimetype_path):
                z_out.write(mimetype_path, 'mimetype', compress_type=zipfile.ZIP_STORED)
            else:
                z_out.writestr('mimetype', 'application/hwp+zip', compress_type=zipfile.ZIP_STORED)

            # Write all other files
            for root_d, _, files in os.walk(tmp_dir):
                for f in files:
                    if f == 'mimetype':
                        continue
                    full_p = os.path.join(root_d, f)
                    rel_p = os.path.relpath(full_p, tmp_dir).replace('\\', '/')
                    z_out.write(full_p, rel_p, compress_type=zipfile.ZIP_DEFLATED)

        # 4. Patch ZIP Bit-2 Fast Deflating flags
        patch_zip_flags(output_path)

        # 5. Verify no overlap defects
        verify_weekly_hwpx_no_overlap(output_path)
        print(f"✅ [SUCCESS] Built valid weekly report HWPX at: {output_path}")

    finally:
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)

    return output_path


def verify_weekly_hwpx_no_overlap(hwpx_path, raise_on_error=True):
    """
    Self-verification gatekeeper for Weekly Report HWPX archives:
    1. Zero inverted order (<hp:linesegarray> before <hp:run>).
    2. Zero duplicate or non-increasing vertpos in cells.
    3. Multi-page cell height limit up to 500,000 for pageBreak="CELL" tables.
       Standard single-span limit 100,000 for non-multipage tables.
    4. Zero lineWrap="SQUEEZE", zero compressed lineSpacing (<100%).
    5. Zero ghost t nodes, zero bad ZIP flags.
    """
    bad_zip_flags = []
    with zipfile.ZipFile(hwpx_path, 'r') as z:
        for info in z.infolist():
            if info.compress_type == zipfile.ZIP_DEFLATED and info.flag_bits != 4:
                bad_zip_flags.append((info.filename, info.flag_bits))

        names = z.namelist()
        hdr = ET.fromstring(z.read('Contents/header.xml')) if 'Contents/header.xml' in names else None
        sec_names = sorted(n for n in names if n.startswith('Contents/section') and n.endswith('.xml'))
        sections = [(n, ET.fromstring(z.read(n))) for n in sec_names]

    squeeze_count = 0
    compressed_lspacing = 0
    if hdr is not None:
        for ppr in hdr.iter(HH_PARAPR):
            for el in ppr.iter():
                if el.attrib.get('lineWrap') == 'SQUEEZE':
                    squeeze_count += 1
                if el.tag == HH_LINESPACING and el.attrib.get('type', 'PERCENT') == 'PERCENT':
                    try:
                        v = int(el.attrib.get('value', '160'))
                        if 0 < v < 100:
                            compressed_lspacing += 1
                    except ValueError:
                        pass

    inverted_order_p = []
    dup_vpos_cells = []
    huge_height_cells = []
    ghost_t_nodes = []

    for sec_name, sec in sections:
        for p_idx, p in enumerate(sec.iter(HP_P)):
            tags = [c.tag.split('}')[-1] for c in p]
            if 'linesegarray' in tags and 'run' in tags:
                if tags.index('linesegarray') < max(i for i, t in enumerate(tags) if t == 'run'):
                    inverted_order_p.append((sec_name, p_idx, tags))
            for t_node in p.findall(f'.//{HP_T}'):
                for child in t_node:
                    cname = child.tag.split('}')[-1]
                    if cname in ('lineBreak', 'fwSpace'):
                        ghost_t_nodes.append((sec_name, p_idx, cname))

        # Check tables and cell heights
        for tbl_idx, tbl in enumerate(sec.iter(HP_TBL)):
            is_multipage = tbl.attrib.get('pageBreak') == 'CELL'
            for tc_idx, tc in enumerate(tbl.iter(HP_TC)):
                cell_sz = tc.find(f'./{HP_CELLSZ}')
                cspan = tc.find(f'./{HP_CELLSPAN}')
                rspan = int(cspan.attrib.get('rowSpan', '1')) if cspan is not None else 1
                ch = int(cell_sz.attrib.get('height', '0')) if cell_sz is not None else 0

                if cell_sz is not None:
                    max_h = 500000 if is_multipage else 100000
                    if (rspan == 1 and ch > max_h) or ch > 500000:
                        huge_height_cells.append((sec_name, tc_idx, ch))

                # Check vertpos progression
                sublist = tc.find(f'./{HP_SUBLIST}')
                container = sublist if sublist is not None else tc
                ps = container.findall(f'./{HP_P}')
                vpos = []
                has_overlap = False
                min_next_vp = 0

                for sp in ps:
                    for ls in sp.findall(f'./{HP_LINESEGA}/{HP_LINESEG}'):
                        vp = int(ls.attrib.get('vertpos', '0'))
                        vs = int(ls.attrib.get('vertsize', '0'))
                        if vp < min_next_vp:
                            has_overlap = True
                        vpos.append(vp)
                        min_next_vp = vp + vs

                if has_overlap or (len(vpos) > 1 and any(vpos[i] >= vpos[i + 1] for i in range(len(vpos) - 1))):
                    dup_vpos_cells.append((sec_name, tc_idx, vpos))

    errors = []
    if squeeze_count > 0:
        errors.append(f"lineWrap SQUEEZE in header.xml: {squeeze_count}")
    if compressed_lspacing > 0:
        errors.append(f"compressed lineSpacing (<100%): {compressed_lspacing}")
    if inverted_order_p:
        errors.append(f"inverted linesegarray order: {len(inverted_order_p)}")
    if dup_vpos_cells:
        errors.append(f"duplicate/decreasing vertpos in cells: {len(dup_vpos_cells)}")
    if huge_height_cells:
        errors.append(f"cellSz height overflow: {huge_height_cells}")
    if ghost_t_nodes:
        errors.append(f"ghost child inside <hp:t>: {len(ghost_t_nodes)}")
    if bad_zip_flags:
        errors.append(f"bad ZIP flag bits: {bad_zip_flags}")

    if errors and raise_on_error:
        raise RuntimeError(f"[WEEKLY HWPX OVERLAP GATEKEEPER ERROR] {' | '.join(errors)}")

    return {
        'sections': len(sections),
        'squeeze_count': squeeze_count,
        'compressed_lspacing': compressed_lspacing,
        'inverted_order_p': len(inverted_order_p),
        'dup_vpos_cells': len(dup_vpos_cells),
        'huge_height_cells': len(huge_height_cells),
        'ghost_t_nodes': len(ghost_t_nodes),
        'bad_zip_flags': len(bad_zip_flags),
    }


def main():
    parser = argparse.ArgumentParser(description="Generate Weekly Report HWPX Document")
    parser.add_argument('--date', type=str, default=None, help="Reference date (YYYY-MM-DD)")
    parser.add_argument('--data', type=str, default=None, help="Path to WEEKLY_REPORTS.json")
    parser.add_argument('--template', type=str, default=None, help="Base template HWPX path")
    parser.add_argument('--output', type=str, default=None, help="Output HWPX file path")
    parser.add_argument('--department', type=str, default='보건행정과', help="Department name")
    parser.add_argument('--team', type=str, default='건강증진팀장 김지영', help="Team leader title")
    args = parser.parse_args()

    dates = compute_wednesday_dates(args.date)
    target_wed = dates['targetWednesday']

    template_p = args.template if args.template and os.path.exists(args.template) else find_base_template()
    output_p = args.output if args.output else os.path.join(os.getcwd(), 'scratch', f"weekly_{target_wed.replace('-', '')}.hwpx")

    # Load report data
    report_data = None
    data_p = args.data if args.data else os.path.join(os.getcwd(), 'data', 'WEEKLY_REPORTS.json')
    if os.path.exists(data_p):
        with open(data_p, 'r', encoding='utf-8') as f:
            all_reports = json.load(f)
            for r in all_reports:
                if r.get('reportDate') == target_wed:
                    report_data = r
                    break

    if not report_data:
        report_data = {
            'id': f"weekly-{target_wed.replace('-', '')}",
            'reportDate': target_wed,
            'departmentName': args.department,
            'teamTitle': args.team,
            'performancePeriod': dates['performanceLabel'],
            'planPeriod': dates['planLabel'],
            'items': [
                {
                    'id': 'seed-01',
                    'projectOrder': 8,
                    'projectName': '서울체력장 강남센터 운영',
                    'period': f"{dates['performanceStart']} ~ {dates['performanceEnd']}",
                    'target': '관내 주민, 직장인, 학생 등',
                    'location': '강남스포츠문화센터 체력인증센터',
                    'contents': ['과학적 체력 측정 및 개인 맞춤형 운동처방 서비스 제공'],
                    'metrics': '금주 측정 48명 완료',
                    'status': 'performance',
                },
                {
                    'id': 'seed-02',
                    'projectOrder': 8,
                    'projectName': '서울체력장 강남센터 운영',
                    'period': f"{dates['planStart']} ~ {dates['planEnd']}",
                    'target': '관내 주민 및 기업체 직장인',
                    'location': '강남스포츠문화센터 체력인증센터',
                    'contents': ['찾아가는 이동 체력측정실 운영'],
                    'metrics': '목표 50명 측정 예정',
                    'status': 'plan',
                },
            ],
        }

    build_weekly_hwpx(template_p, output_p, report_data)


if __name__ == '__main__':
    main()
