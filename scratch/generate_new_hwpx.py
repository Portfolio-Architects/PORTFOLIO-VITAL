import zipfile
import os
import re
import shutil
import tempfile
import xml.etree.ElementTree as ET
import copy
import struct
import sys
import argparse
from datetime import datetime

DEFAULT_POLICY_EXAMPLE_CANDIDATES = (
    r"D:\Desktop\방침서 예시.hwpx",
    r"D:\Desktop\_Organized_Archive\방침서 예시.hwpx",
    r"F:\_Organized_Archive\방침서 예시.hwpx",
)
DEFAULT_POLICY_TEMPLATE_CANDIDATES = (
    r"D:\Desktop\5. 방침서.hwpx",
    r"D:\Desktop\_Organized_Archive\5. 방침서.hwpx",
    r"F:\_Organized_Archive\5. 방침서.hwpx",
)
DEFAULT_POLICY_EXAMPLE = DEFAULT_POLICY_EXAMPLE_CANDIDATES[0]
DEFAULT_POLICY_TEMPLATE = DEFAULT_POLICY_TEMPLATE_CANDIDATES[0]
PROTECTED_POLICY_TEMPLATES = DEFAULT_POLICY_EXAMPLE_CANDIDATES + DEFAULT_POLICY_TEMPLATE_CANDIDATES
DEFAULT_DESKTOP_DIR = r"D:\Desktop"


def resolve_default_policy_template():
    """Prefer '방침서 예시.hwpx' canonical policy reference when available, else fallback to '5. 방침서.hwpx'."""
    for cand in DEFAULT_POLICY_EXAMPLE_CANDIDATES:
        if os.path.exists(cand):
            return cand
    for cand in DEFAULT_POLICY_TEMPLATE_CANDIDATES:
        if os.path.exists(cand):
            return cand
    return DEFAULT_POLICY_TEMPLATE

# Configure UTF-8 stdout
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
    'ooxmlchart': 'http://www.hancom.co.kr/hwpml/2016/ooxmlchart',
    'hwpunitchar': 'http://www.hancom.co.kr/hwpml/2016/HwpUnitChar',
    'epub': 'http://www.idpf.org/2007/ops',
    'config': 'urn:oasis:names:tc:opendocument:xmlns:config:1.0',
}
for _k, _v in NS_MAP.items():
    ET.register_namespace(_k, _v)

HP_P = f"{{{NS_MAP['hp']}}}p"
HP_RUN = f"{{{NS_MAP['hp']}}}run"
HP_T = f"{{{NS_MAP['hp']}}}t"
HP_TBL = f"{{{NS_MAP['hp']}}}tbl"
HP_PIC = f"{{{NS_MAP['hp']}}}pic"
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
HH_RATIO = f"{{{NS_MAP['hh']}}}ratio"
HH_SPACING = f"{{{NS_MAP['hh']}}}spacing"
HH_LINESPACING = f"{{{NS_MAP['hh']}}}lineSpacing"
HC_INTENT = f"{{{NS_MAP['hc']}}}intent"

CTRL_OBJECT_TAGS = {
    'tbl', 'box', 'picture', 'pic', 'equation', 'shape',
    'container', 'line', 'rect', 'ellipse', 'arc', 'polygon',
    'curve', 'connectLine', 'textart', 'chart', 'video', 'ole',
}


def char_visual_width(ch, vertsize, scale=0.92):
    """Estimate HWPUnit width of a character given vertsize and charPr ratio/spacing scale."""
    vertsize = max(100, int(vertsize))
    if ord(ch) > 127:
        return max(1, int(vertsize * 0.90 * scale))
    return max(1, int(vertsize * 0.45 * scale))


def wrap_text_positions(text, horzsize, vertsize, scale=0.92):
    """
    Compute list of starting character indices (textpos) for each wrapped line of `text`
    within `horzsize` HWPUnits, matching Hancom Office's BREAK_WORD behavior:
    - Never creates a standalone line consisting only of trailing spaces.
    - Never breaks after a short prefix stub when a long compound token follows.
    """
    if not text:
        return [0]
    horzsize = max(1200, int(horzsize))
    vertsize = max(100, int(vertsize))
    n = len(text)
    tokens = []
    i = 0
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
        elif cur_line_w >= horzsize * 0.72 and vis_w <= horzsize * 0.45:
            textpos_list.append(start)
            cur_line_w = full_w
        else:
            for idx in range(start, end):
                ch = text[idx]
                cw = char_visual_width(ch, vertsize, scale)
                if ch == ' ':
                    # Trailing spaces hang at line end without triggering a wrap
                    cur_line_w += cw
                elif cur_line_w + cw > horzsize and cur_line_w > 0:
                    textpos_list.append(idx)
                    cur_line_w = cw
                else:
                    cur_line_w += cw
    return textpos_list


def get_cell_margins(tc_elem, default_m=141):
    """
    Return (left_m, right_m, top_m, bot_m) in HWPUnits.
    Resolves 4,294,967,295 (0xFFFFFFFF = -1, meaning inherit table inMargin) to `default_m`.
    """
    cell_margin = tc_elem.find(f'./{HP_CELLMARGIN}')
    if cell_margin is None:
        return default_m, default_m, default_m, default_m

    def _parse_m(attr_name):
        try:
            raw = int(cell_margin.attrib.get(attr_name, str(default_m)))
        except ValueError:
            return default_m
        if raw < 0 or raw >= 10000:
            return default_m
        return raw

    return _parse_m('left'), _parse_m('right'), _parse_m('top'), _parse_m('bottom')


def _clean_t_text_and_flatten(t_node, mutate=False):
    """
    Extract clean text from <hp:t> and optionally flatten child tags in-place.
    - Converts inline <hp:lineBreak/> and <hp:fwSpace/> to a space while preserving their .tail.
    - When <hp:t> already has non-empty leading .text AND contains <hp:markpenBegin/>, discards the
      stale markpenBegin.tail ghost text left behind by prior naive t.text assignment.
    - When <hp:t> has empty leading .text, preserves <hp:markpenBegin/> .tail as the legitimate text.
    """
    children = list(t_node)
    if not children:
        return t_node.text or ''
    has_leading_text = bool((t_node.text or '').strip())
    parts = [t_node.text or '']
    for child in children:
        tag_name = child.tag.split('}')[-1]
        if tag_name in ('fwSpace', 'lineBreak'):
            parts.append(' ')
            if child.tail:
                parts.append(child.tail)
        elif tag_name == 'markpenBegin' and has_leading_text:
            # Discard stale highlighted ghost tail when t_node.text was already overwritten
            pass
        else:
            if child.tail:
                parts.append(child.tail)
        if mutate:
            t_node.remove(child)
    cleaned = ''.join(parts)
    if mutate:
        t_node.text = cleaned
    return cleaned


def flatten_t_node(t_node):
    """Flatten any child tags (e.g. hp:lineBreak, hp:fwSpace, hp:markpenBegin/End) inside hp:t."""
    return _clean_t_text_and_flatten(t_node, mutate=True)


def extract_p_text(p_elem):
    """Extract paragraph text from runs that do not host sub-tables or pictures/shapes."""
    chunks = []
    for r in p_elem.findall(f'./{HP_RUN}'):
        if any(el.tag.split('}')[-1] in CTRL_OBJECT_TAGS for el in r.iter()):
            continue
        for t in r.findall(f'./{HP_T}'):
            chunks.append(_clean_t_text_and_flatten(t, mutate=False))
    return ''.join(chunks)


def ensure_linesegarray_last(p_elem):
    """
    Ensure <hp:linesegarray> is strictly the final child of <hp:p> after all <hp:run> elements.
    Prevents XSD child-order inversion (<hp:linesegarray> before <hp:run>) and duplicate arrays.
    """
    lsas = p_elem.findall(f'./{HP_LINESEGA}')
    if not lsas:
        return
    last_lsa = lsas[-1]
    for lsa in lsas:
        p_elem.remove(lsa)
    p_elem.append(last_lsa)


def set_p_text(p_elem, text, char_pr_id=None):
    """
    Set plain text on a paragraph element while preserving run style, removing stray child tags
    inside hp:t, removing surplus pure-text runs/t-nodes from their actual parent, and keeping
    <hp:linesegarray> at the end of <hp:p>.
    """
    runs = p_elem.findall(f'./{HP_RUN}')
    pure_runs = []
    for r in runs:
        has_ctrl = any(
            el.tag.split('}')[-1] in CTRL_OBJECT_TAGS
            for el in r.iter()
        )
        if not has_ctrl:
            pure_runs.append(r)

    if pure_runs:
        r0 = pure_runs[0]
        if char_pr_id is not None:
            r0.attrib['charPrIDRef'] = str(char_pr_id)
        t_nodes = r0.findall(f'./{HP_T}')
        if t_nodes:
            t0 = t_nodes[0]
            for child in list(t0):
                t0.remove(child)
            t0.text = text
            for extra_t in t_nodes[1:]:
                r0.remove(extra_t)
        else:
            t_new = ET.Element(HP_T)
            t_new.text = text
            r0.append(t_new)
        for extra_r in pure_runs[1:]:
            p_elem.remove(extra_r)
    else:
        r_new = ET.Element(HP_RUN)
        if char_pr_id is not None:
            r_new.attrib['charPrIDRef'] = str(char_pr_id)
        t_new = ET.Element(HP_T)
        t_new.text = text
        r_new.append(t_new)
        p_elem.append(r_new)

    ensure_linesegarray_last(p_elem)


def update_paragraph_text(p_node, text, ns=None):
    """
    Safely updates the text of a paragraph by replacing only pure text hp:t nodes.
    Crucially avoids altering any inner text nodes of nested control shapes (tables, boxes)
    and guarantees clean single-run text + trailing <hp:linesegarray> order.
    """
    set_p_text(p_node, text)


def extract_charpr_scale(hdr_elem):
    """Build charPr scale lookup dict from header.xml (ratio * spacing)."""
    cpr_scale = {}
    if hdr_elem is None:
        return cpr_scale
    for cpr in hdr_elem.iter(HH_CHARPR):
        cid = cpr.attrib.get('id')
        r_el = cpr.find(f'./{HH_RATIO}')
        s_el = cpr.find(f'./{HH_SPACING}')
        ratio = int(r_el.attrib.get('hangul', '100')) if r_el is not None else 100
        spacing = int(s_el.attrib.get('hangul', '0')) if s_el is not None else 0
        if cid is not None:
            cpr_scale[cid] = (ratio / 100.0) * (1.0 + spacing / 100.0)
    return cpr_scale


def extract_charpr_heights(hdr_elem):
    """Build charPr height (HWPUnits, 100 = 1pt) lookup dict from header.xml."""
    cpr_heights = {}
    if hdr_elem is None:
        return cpr_heights
    for cpr in hdr_elem.iter(HH_CHARPR):
        cid = cpr.attrib.get('id')
        h_raw = cpr.attrib.get('height')
        if cid is not None and h_raw is not None:
            try:
                cpr_heights[cid] = max(100, int(h_raw))
            except ValueError:
                pass
    return cpr_heights


def extract_parapr_lspacing(hdr_elem):
    """Build paraPr PERCENT lineSpacing lookup dict from header.xml."""
    ppr_ls = {}
    if hdr_elem is None:
        return ppr_ls
    for ppr in hdr_elem.iter(HH_PARAPR):
        pid = ppr.attrib.get('id')
        if pid is None:
            continue
        for el in ppr.iter(HH_LINESPACING):
            if el.attrib.get('type', 'PERCENT') == 'PERCENT':
                try:
                    ppr_ls[pid] = max(100, int(el.attrib.get('value', '160')))
                except ValueError:
                    ppr_ls[pid] = 160
                break
    return ppr_ls


def get_excel_defective_ids(hdr_elem):
    """
    Inspect header.xml to identify Excel-imported defective paraPr IDs and style IDs,
    as well as a valid non-condensed replacement paraPr ID.
    When hdr_elem is None (standalone unit tests), defaults to ({'129', '119'}, {'45'}, '77').
    """
    if hdr_elem is None:
        return {'129', '119'}, {'45'}, '77'

    HH_STYLE = f"{{{NS_MAP['hh']}}}style"
    HH_ALIGN = f"{{{NS_MAP['hh']}}}align"
    bad_style_ids = set()
    for st in hdr_elem.iter(HH_STYLE):
        sid = st.attrib.get('id')
        sname = (st.attrib.get('name', '') + ' ' + st.attrib.get('engName', '')).lower()
        if sid and ('xl' in sname):
            bad_style_ids.add(sid)

    ppr_map = {}
    bad_ppr_ids = set()
    for ppr in hdr_elem.iter(HH_PARAPR):
        pid = ppr.attrib.get('id')
        if not pid:
            continue
        ppr_map[pid] = ppr
        has_squeeze = any(el.attrib.get('lineWrap') == 'SQUEEZE' for el in ppr.iter())
        align_el = ppr.find(f'./{HH_ALIGN}')
        is_center = align_el is not None and align_el.attrib.get('horizontal') == 'CENTER'
        has_neg_intent = any(int(el.attrib.get('value', '0')) < 0 for el in ppr.iter(HC_INTENT))
        if has_squeeze or (pid == '129' and has_neg_intent) or (is_center and has_neg_intent):
            bad_ppr_ids.add(pid)
        elif pid in ('129', '119') and '45' in bad_style_ids:
            bad_ppr_ids.add(pid)

    replacement_ppr_id = None
    if '77' in ppr_map and ppr_map['77'].attrib.get('condense', '0') == '0':
        replacement_ppr_id = '77'
    elif '0' in ppr_map:
        replacement_ppr_id = '0'

    return bad_ppr_ids, bad_style_ids, replacement_ppr_id


def normalize_header_styles(hdr_elem):
    """
    Normalize Excel-imported compressed paragraph styles in Contents/header.xml:
    - Reset negative indent on paraPr 129 (and any CENTER-aligned paraPr with negative indent) to 0.
    - Convert lineWrap="SQUEEZE" to lineWrap="BREAK" to prevent horizontal character collision.
    - Normalize compressed PERCENT lineSpacing (< 100%) to at least 130%.
    """
    if hdr_elem is None:
        return
    HH_ALIGN = f"{{{NS_MAP['hh']}}}align"
    for ppr in hdr_elem.iter(HH_PARAPR):
        pid = ppr.attrib.get('id')
        align_el = ppr.find(f'./{HH_ALIGN}')
        is_center = align_el is not None and align_el.attrib.get('horizontal') == 'CENTER'
        if pid == '129' or is_center:
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
                    ls_val = int(el.attrib.get('value', '160'))
                    if 0 <= ls_val < 100:
                        el.attrib['value'] = '130'
                except ValueError:
                    pass


def recalc_tc_linesegs(tc_elem, cpr_scale=None, shrink_height=False, bad_ppr_ids=None, bad_style_ids=None, replacement_ppr_id='77', cpr_heights=None, ppr_lspacing=None):
    """
    Recalculate <hp:linesegarray> for all <hp:p> inside a table cell <hp:tc>/<hp:subList>:
    1. Resolves 0xFFFFFFFF cellMargin values to 141 HWPUnits.
    2. Normalizes compressed Excel paraPrIDRef and styleIDRef when applicable.
    3. Propagates nested <hp:tbl>/<hp:sz height> or <hp:pic>/<hp:curSz height> into host paragraph <hp:lineseg vertsize> and cumulative vertpos.
    4. Wraps text into proper multiple <hp:lineseg> entries with strictly increasing vertpos.
    5. Updates <hp:cellSz height="..."/> without integer overflow.
    """
    if bad_ppr_ids is None:
        bad_ppr_ids = {'129', '119'}
    if bad_style_ids is None:
        bad_style_ids = {'45'}

    sublist = tc_elem.find(f'./{HP_SUBLIST}')
    container = sublist if sublist is not None else tc_elem
    p_list = container.findall(f'./{HP_P}')
    if not p_list:
        return

    cell_sz = tc_elem.find(f'./{HP_CELLSZ}')
    cell_width = int(cell_sz.attrib.get('width', '10000')) if cell_sz is not None else 10000
    left_m, right_m, top_m, bot_m = get_cell_margins(tc_elem, default_m=141)
    default_horzsize = max(1200, cell_width - left_m - right_m)

    first_ls = tc_elem.find(f'.//{HP_LINESEG}')
    def_vertsize = int(first_ls.attrib.get('vertsize', '1100')) if first_ls is not None else 1100
    def_textheight = int(first_ls.attrib.get('textheight', str(def_vertsize))) if first_ls is not None else def_vertsize
    def_baseline = int(first_ls.attrib.get('baseline', str(int(def_vertsize * 0.85)))) if first_ls is not None else int(def_vertsize * 0.85)
    def_spacing = int(first_ls.attrib.get('spacing', str(int(def_vertsize * 0.3)))) if first_ls is not None else int(def_vertsize * 0.3)
    def_horzpos = first_ls.attrib.get('horzpos', '0') if first_ls is not None else '0'

    cum_vertpos = 0
    last_spacing = def_spacing
    for p in p_list:
        if replacement_ppr_id and p.attrib.get('paraPrIDRef') in bad_ppr_ids:
            p.attrib['paraPrIDRef'] = str(replacement_ppr_id)
        if p.attrib.get('styleIDRef') in bad_style_ids:
            p.attrib['styleIDRef'] = '0'

        inner_tbl = p.find(f'.//{HP_TBL}')
        inner_pic = p.find(f'.//{HP_PIC}')
        if inner_tbl is not None or inner_pic is not None:
            if inner_tbl is not None:
                sync_table_geometry(p, inner_tbl, update_host_lseg=True)
            p_lsa = p.find(f'./{HP_LINESEGA}')
            if p_lsa is None:
                p_lsa = ET.SubElement(p, HP_LINESEGA)
            p_lsegs = p_lsa.findall(f'./{HP_LINESEG}')
            if not p_lsegs:
                p_ls = ET.SubElement(p_lsa, HP_LINESEG, {
                    'textpos': '0',
                    'vertpos': str(cum_vertpos),
                    'vertsize': str(def_vertsize),
                    'textheight': str(def_textheight),
                    'baseline': str(def_baseline),
                    'spacing': str(def_spacing),
                    'horzpos': str(def_horzpos),
                    'horzsize': str(default_horzsize),
                    'flags': '393216',
                })
                p_lsegs = [p_ls]
            inner_obj_h = 0
            if inner_tbl is not None:
                isz = inner_tbl.find(f'./{HP_SZ}')
                if isz is not None:
                    inner_obj_h = int(isz.attrib.get('height', '0'))
            elif inner_pic is not None:
                for ptag in (f"{{{NS_MAP['hp']}}}curSz", HP_SZ):
                    psz = inner_pic.find(f'./{ptag}')
                    if psz is not None and int(psz.attrib.get('height', '0')) > 0:
                        inner_obj_h = int(psz.attrib.get('height', '0'))
                        break
            for ls_i, p_ls in enumerate(p_lsegs):
                p_vsize = int(p_ls.attrib.get('vertsize', str(def_vertsize)))
                if ls_i == 0 and inner_obj_h > 0:
                    p_vsize = max(p_vsize, inner_obj_h)
                    p_ls.attrib['vertsize'] = str(p_vsize)
                    p_ls.attrib['textheight'] = str(p_vsize)
                    p_ls.attrib['baseline'] = str(int(p_vsize * 0.85))
                p_sp = max(0, int(p_ls.attrib.get('spacing', str(def_spacing))))
                p_ls.attrib['vertpos'] = str(cum_vertpos)
                cum_vertpos += p_vsize + p_sp
                last_spacing = p_sp
            ensure_linesegarray_last(p)
            continue

        p_first_ls = p.find(f'./{HP_LINESEGA}/{HP_LINESEG}')
        if p_first_ls is not None:
            vertsize = int(p_first_ls.attrib.get('vertsize', str(def_vertsize)))
            textheight = int(p_first_ls.attrib.get('textheight', str(vertsize)))
            baseline = int(p_first_ls.attrib.get('baseline', str(int(vertsize * 0.85))))
            spacing = max(0, int(p_first_ls.attrib.get('spacing', str(def_spacing))))
            horzpos = p_first_ls.attrib.get('horzpos', def_horzpos)
        else:
            run_heights = [
                cpr_heights[r.attrib.get('charPrIDRef')]
                for r in p.findall(f'./{HP_RUN}')
                if cpr_heights and r.attrib.get('charPrIDRef') in cpr_heights
            ]
            vertsize = max(run_heights) if run_heights else def_vertsize
            textheight = vertsize
            baseline = int(vertsize * 0.85)
            ppr_id = p.attrib.get('paraPrIDRef')
            if ppr_lspacing and ppr_id in ppr_lspacing:
                ls_pct = max(100, ppr_lspacing[ppr_id])
                spacing = int(vertsize * max(0.15, (ls_pct - 100) / 100.0))
            else:
                spacing = int(vertsize * 0.30)
            horzpos = def_horzpos
        horzsize = max(1200, default_horzsize - int(horzpos))
        if p_first_ls is not None:
            orig_hs = int(p_first_ls.attrib.get('horzsize', str(horzsize)))
            if 1200 <= orig_hs <= max(cell_width, 1500):
                horzsize = orig_hs
        line_step = vertsize + spacing
        last_spacing = spacing

        scale = 0.92
        if cpr_scale:
            cids = [r.attrib.get('charPrIDRef') for r in p.findall(f'./{HP_RUN}') if r.attrib.get('charPrIDRef') in cpr_scale]
            if cids:
                scale = min(cpr_scale[cid] for cid in cids)

        for t_node in p.findall(f'.//{HP_T}'):
            flatten_t_node(t_node)

        txt = extract_p_text(p)
        tpos_list = wrap_text_positions(txt, horzsize, vertsize, scale=scale)

        old_lsa = p.find(f'./{HP_LINESEGA}')
        if old_lsa is not None:
            p.remove(old_lsa)

        new_lsa = ET.Element(HP_LINESEGA)
        for line_idx, tpos in enumerate(tpos_list):
            ls = ET.Element(HP_LINESEG)
            ls.attrib['textpos'] = str(tpos)
            ls.attrib['vertpos'] = str(cum_vertpos)
            ls.attrib['vertsize'] = str(vertsize)
            ls.attrib['textheight'] = str(textheight)
            ls.attrib['baseline'] = str(baseline)
            ls.attrib['spacing'] = str(spacing)
            ls.attrib['horzpos'] = str(horzpos)
            ls.attrib['horzsize'] = str(horzsize)
            ls.attrib['flags'] = '393216' if line_idx == 0 else '1441792'
            new_lsa.append(ls)
            cum_vertpos += line_step
        p.append(new_lsa)

    cspan = tc_elem.find(f'./{HP_CELLSPAN}')
    rspan = int(cspan.attrib.get('rowSpan', '1')) if cspan is not None else 1

    if cell_sz is not None and cum_vertpos > 0:
        needed_h = max(0, cum_vertpos - last_spacing) + top_m + bot_m
        cur_h = int(cell_sz.attrib.get('height', '0'))
        if cur_h > 100000 or (shrink_height and rspan == 1):
            cell_sz.attrib['height'] = str(needed_h)
        else:
            cell_sz.attrib['height'] = str(max(cur_h, needed_h))


def tc_needs_recalc(tc_elem, bad_ppr_ids=None, bad_style_ids=None):
    """
    Return True if a table cell has:
    - duplicate or non-increasing vertpos across its paragraphs (including control paragraphs),
    - a nested <hp:tbl> whose height exceeds its host <hp:lineseg vertsize> or overlaps the next paragraph,
    - inverted child order (<hp:linesegarray> before <hp:run>),
    - missing linesegarray,
    - unflattened <hp:t> child tags (inline lineBreak/fwSpace or ghost markpenBegin tail),
    - <hp:cellSz height> integer overflow (> 100000) or single-span cellSz.height < max(vertpos + vertsize),
    - abnormally narrow horzsize (< 1200) on non-empty text, or
    - defective Excel squeeze/negative-indent paraPrIDRef/styleIDRef.
    """
    if bad_ppr_ids is None:
        bad_ppr_ids = {'129', '119'}
    if bad_style_ids is None:
        bad_style_ids = {'45'}

    sublist = tc_elem.find(f'./{HP_SUBLIST}')
    container = sublist if sublist is not None else tc_elem
    p_list = container.findall(f'./{HP_P}')
    if not p_list:
        return False

    cspan = tc_elem.find(f'./{HP_CELLSPAN}')
    rspan = int(cspan.attrib.get('rowSpan', '1')) if cspan is not None else 1
    cell_sz = tc_elem.find(f'./{HP_CELLSZ}')
    cur_h = 0
    if cell_sz is not None:
        try:
            cur_h = int(cell_sz.attrib.get('height', '0'))
            if cur_h > 100000:
                return True
        except ValueError:
            return True

    vpos_all = []
    max_ls_bottom = 0
    min_required_next_vpos = 0

    for p in p_list:
        if p.attrib.get('paraPrIDRef') in bad_ppr_ids or p.attrib.get('styleIDRef') in bad_style_ids:
            return True
        tags = [c.tag.split('}')[-1] for c in p]
        if 'linesegarray' in tags and 'run' in tags:
            if tags.index('linesegarray') < max(i for i, t in enumerate(tags) if t == 'run'):
                return True

        inner_tbl = p.find(f'.//{HP_TBL}')
        inner_pic = p.find(f'.//{HP_PIC}')
        lsegs = p.findall(f'./{HP_LINESEGA}/{HP_LINESEG}')
        if not lsegs:
            return True

        if inner_tbl is not None:
            isz = inner_tbl.find(f'./{HP_SZ}')
            th = int(isz.attrib.get('height', '0')) if isz is not None else 0
            ls0_vs = int(lsegs[0].attrib.get('vertsize', '0'))
            ls0_vp = int(lsegs[0].attrib.get('vertpos', '0'))
            if th > 0 and ls0_vs < th:
                return True
            if ls0_vp < min_required_next_vpos:
                return True
            vpos_all.append(ls0_vp)
            eff_vs = max(ls0_vs, th)
            min_required_next_vpos = ls0_vp + eff_vs
            max_ls_bottom = max(max_ls_bottom, min_required_next_vpos)
            continue

        if inner_pic is not None:
            for ls in lsegs:
                vp = int(ls.attrib.get('vertpos', '0'))
                vs = int(ls.attrib.get('vertsize', '0'))
                if vp < min_required_next_vpos:
                    return True
                vpos_all.append(vp)
                min_required_next_vpos = vp + vs
                max_ls_bottom = max(max_ls_bottom, min_required_next_vpos)
            continue

        for t_node in p.findall(f'.//{HP_T}'):
            for child in t_node:
                cname = child.tag.split('}')[-1]
                if cname in ('lineBreak', 'fwSpace'):
                    return True
                if cname == 'markpenBegin' and (t_node.text or '').strip() and (child.tail or '').strip():
                    return True

        txt = extract_p_text(p).strip()
        for ls in lsegs:
            hs = int(ls.attrib.get('horzsize', '0'))
            if txt and 0 < hs < 1200:
                return True
            vp = int(ls.attrib.get('vertpos', '0'))
            vs = int(ls.attrib.get('vertsize', '0'))
            if vp < min_required_next_vpos:
                return True
            vpos_all.append(vp)
            max_ls_bottom = max(max_ls_bottom, vp + vs)

    if len(vpos_all) > 1:
        if len(set(vpos_all)) < len(vpos_all):
            return True
        if any(vpos_all[i] >= vpos_all[i + 1] for i in range(len(vpos_all) - 1)):
            return True

    if rspan == 1 and cur_h > 0 and max_ls_bottom > cur_h:
        return True

    return False


def set_tc_lines(tc_elem, lines, proto_paragraphs=None, cpr_scale=None, shrink_height=False):
    """
    Replace paragraphs inside a table cell (hp:tc/hp:subList) with `lines` and recalculate linesegarray.
    If `proto_paragraphs` is provided (or cell has multiple distinct paragraph styles), uses
    `proto_paragraphs[min(idx, len(proto_paragraphs)-1)]` to preserve per-line alignment & bold/regular styles.
    """
    sublist = tc_elem.find(f'./{HP_SUBLIST}')
    container = sublist if sublist is not None else tc_elem
    p_list = container.findall(f'./{HP_P}')
    if not p_list:
        return
    if not lines:
        lines = ['']
    protos = [copy.deepcopy(p) for p in (proto_paragraphs if proto_paragraphs is not None else p_list)]
    for p in list(p_list):
        container.remove(p)
    for idx, line in enumerate(lines):
        new_p = copy.deepcopy(protos[min(idx, len(protos) - 1)])
        for r in list(new_p.findall(f'./{HP_RUN}')):
            if any(el.tag.split('}')[-1] in CTRL_OBJECT_TAGS for el in r.iter()):
                new_p.remove(r)
        set_p_text(new_p, line)
        container.append(new_p)
    recalc_tc_linesegs(tc_elem, cpr_scale=cpr_scale, shrink_height=shrink_height)


def enforce_inline_table_flow(tbl_elem):
    """Set treatAsChar="1" and vertOffset="0" on <hp:tbl>/<hp:pos> to prevent floating table overlap."""
    if tbl_elem is None:
        return
    pos = tbl_elem.find(f'./{HP_POS}')
    if pos is not None:
        pos.attrib['treatAsChar'] = '1'
        pos.attrib['vertOffset'] = '0'


def sync_table_geometry(p_elem, tbl_elem, update_host_lseg=False):
    """
    Ensure every non-rowSpan cell in each <hp:tr> shares a uniform row height,
    solve and synchronize staggered or multi-rowSpan cells to the sum of their spanned row heights,
    and update <hp:tbl>/<hp:sz height="..."/> to match the sum of row heights.
    When `update_host_lseg=True`, also updates the host paragraph's <hp:lineseg vertsize>.
    """
    if tbl_elem is None:
        return 0
    rows = tbl_elem.findall(f'./{HP_TR}')
    num_rows = len(rows)
    if num_rows == 0:
        return 0

    row_heights = [0] * num_rows
    single_span_by_row = [[] for _ in range(num_rows)]
    multi_span_cells = []

    for r_idx, tr in enumerate(rows):
        for tc in tr.findall(f'./{HP_TC}'):
            cspan = tc.find(f'./{HP_CELLSPAN}')
            rspan = int(cspan.attrib.get('rowSpan', '1')) if cspan is not None else 1
            csz = tc.find(f'./{HP_CELLSZ}')
            if csz is None:
                continue
            h = int(csz.attrib.get('height', '0'))
            if rspan == 1:
                if 0 < h < 100000:
                    row_heights[r_idx] = max(row_heights[r_idx], h)
                single_span_by_row[r_idx].append(csz)
            else:
                multi_span_cells.append((r_idx, rspan, csz, h if 0 < h < 500000 else 0))

    # Propagate height constraints from multi-rowSpan cells (sorted by end row, then span length)
    # so rows with zero single-span cells (e.g. staggered approval header tables) retain exact heights.
    for r_idx, rspan, csz, h in sorted(multi_span_cells, key=lambda x: (x[0] + x[1], x[1])):
        end_r = min(num_rows, r_idx + rspan)
        if end_r <= r_idx or h <= 0:
            continue
        cur_span_h = sum(row_heights[r_idx:end_r])
        if cur_span_h < h:
            deficit = h - cur_span_h
            zero_rows = [r for r in range(r_idx, end_r) if row_heights[r] == 0]
            if zero_rows:
                per_r = deficit // len(zero_rows)
                for r in zero_rows:
                    row_heights[r] = per_r
                row_heights[zero_rows[-1]] += deficit - per_r * len(zero_rows)
            else:
                # All spanned rows already have positive heights;Only expand if no other multi-span cell conflicts
                row_heights[end_r - 1] += deficit

    total_h = sum(row_heights)
    for r_idx in range(num_rows):
        row_h = row_heights[r_idx]
        if row_h > 0:
            for csz in single_span_by_row[r_idx]:
                csz.attrib['height'] = str(row_h)

    for r_idx, rspan, csz, _ in multi_span_cells:
        end_r = min(num_rows, r_idx + rspan)
        span_h = sum(row_heights[r_idx:end_r])
        if span_h > 0:
            csz.attrib['height'] = str(span_h)

    sz = tbl_elem.find(f'./{HP_SZ}')
    if sz is not None and total_h > 0:
        sz.attrib['height'] = str(total_h)

    if update_host_lseg and p_elem is not None and total_h > 0:
        ls = p_elem.find(f'./{HP_LINESEGA}/{HP_LINESEG}')
        if ls is not None:
            ls.attrib['vertsize'] = str(total_h)
            ls.attrib['textheight'] = str(total_h)
            ls.attrib['baseline'] = str(int(total_h * 0.85))
    return total_h


def layout_sec_paragraph(p_elem, start_vertpos, horzsize=53860, cpr_scale=None):
    """
    Recalculate <hp:linesegarray> for a top-level section paragraph <hp:p>
    starting at `start_vertpos`, returning the next cumulative `vertpos`.
    """
    first_ls = p_elem.find(f'./{HP_LINESEGA}/{HP_LINESEG}')
    vertsize = int(first_ls.attrib.get('vertsize', '1400')) if first_ls is not None else 1400
    textheight = int(first_ls.attrib.get('textheight', str(vertsize))) if first_ls is not None else vertsize
    baseline = int(first_ls.attrib.get('baseline', str(int(vertsize * 0.85)))) if first_ls is not None else int(vertsize * 0.85)
    spacing = int(first_ls.attrib.get('spacing', str(int(vertsize * 0.3)))) if first_ls is not None else int(vertsize * 0.3)
    horzpos = first_ls.attrib.get('horzpos', '0') if first_ls is not None else '0'
    horzsize = int(first_ls.attrib.get('horzsize', str(horzsize))) if first_ls is not None else horzsize
    line_step = vertsize + spacing

    tbls = p_elem.findall(f'./{HP_RUN}/{HP_TBL}')
    if tbls:
        th = sum(
            int(t.find(f'./{HP_SZ}').attrib.get('height', str(vertsize)))
            if t.find(f'./{HP_SZ}') is not None else vertsize
            for t in tbls
        )
        old_lsa = p_elem.find(f'./{HP_LINESEGA}')
        old_lsegs = old_lsa.findall(f'./{HP_LINESEG}') if old_lsa is not None else []
        if len(old_lsegs) > 1:
            cur_ls_v = start_vertpos
            for ls in old_lsegs:
                ls_vs = int(ls.attrib.get('vertsize', str(vertsize)))
                ls_sp = int(ls.attrib.get('spacing', str(spacing)))
                ls.attrib['vertpos'] = str(cur_ls_v)
                cur_ls_v += ls_vs + ls_sp
            ensure_linesegarray_last(p_elem)
            return cur_ls_v
        if old_lsa is not None and old_lsegs:
            for ls in old_lsegs:
                ls.attrib['vertpos'] = str(start_vertpos)
                ls.attrib['vertsize'] = str(max(int(ls.attrib.get('vertsize', '0')), th))
            ensure_linesegarray_last(p_elem)
        else:
            if old_lsa is not None:
                p_elem.remove(old_lsa)
            new_lsa = ET.SubElement(p_elem, HP_LINESEGA)
            ET.SubElement(new_lsa, HP_LINESEG, {
                'textpos': '0',
                'vertpos': str(start_vertpos),
                'vertsize': str(th),
                'textheight': str(th),
                'baseline': str(int(th * 0.85)),
                'spacing': str(spacing),
                'horzpos': str(horzpos),
                'horzsize': str(horzsize),
                'flags': '393216',
            })
            ensure_linesegarray_last(p_elem)
        return start_vertpos + th + spacing

    has_banner = any(el.tag.split('}')[-1] in ('container', 'rect', 'box', 'picture', 'pic', 'shape') for el in p_elem.iter())
    if has_banner:
        old_lsa = p_elem.find(f'./{HP_LINESEGA}')
        if old_lsa is not None:
            cur_ls_v = start_vertpos
            for ls in old_lsa.findall(f'./{HP_LINESEG}'):
                ls_vs = int(ls.attrib.get('vertsize', str(vertsize)))
                ls_sp = int(ls.attrib.get('spacing', str(spacing)))
                ls.attrib['vertpos'] = str(cur_ls_v)
                cur_ls_v += ls_vs + ls_sp
            ensure_linesegarray_last(p_elem)
            return cur_ls_v
        return start_vertpos + line_step

    scale = 0.92
    if cpr_scale:
        cids = [r.attrib.get('charPrIDRef') for r in p_elem.findall(f'./{HP_RUN}') if r.attrib.get('charPrIDRef') in cpr_scale]
        if cids:
            scale = min(cpr_scale[cid] for cid in cids)

    for t_node in p_elem.findall(f'.//{HP_T}'):
        flatten_t_node(t_node)

    txt = extract_p_text(p_elem)
    tpos_list = wrap_text_positions(txt, horzsize, vertsize, scale=scale)

    old_lsa = p_elem.find(f'./{HP_LINESEGA}')
    if old_lsa is not None:
        p_elem.remove(old_lsa)

    new_lsa = ET.Element(HP_LINESEGA)
    cur_v = start_vertpos
    for line_idx, tpos in enumerate(tpos_list):
        ls = ET.Element(HP_LINESEG)
        ls.attrib['textpos'] = str(tpos)
        ls.attrib['vertpos'] = str(cur_v)
        ls.attrib['vertsize'] = str(vertsize)
        ls.attrib['textheight'] = str(textheight)
        ls.attrib['baseline'] = str(baseline)
        ls.attrib['spacing'] = str(spacing)
        ls.attrib['horzpos'] = str(horzpos)
        ls.attrib['horzsize'] = str(horzsize)
        ls.attrib['flags'] = '393216' if line_idx == 0 else '1441792'
        new_lsa.append(ls)
        cur_v += line_step
    p_elem.append(new_lsa)
    return cur_v


def heal_section_tables_and_layout(sec_elem, cpr_scale=None, hdr_elem=None, page_height_limit=72000):
    """
    Heal all table cells and tables in `sec_elem` bottom-up (innermost nested tables first,
    then outer tables), flatten all residual <hp:t> child tags, and recalculate section layout.
    Returns the number of table cells recalculated.
    """
    bad_ppr_ids, bad_style_ids, replacement_ppr_id = get_excel_defective_ids(hdr_elem)
    cpr_heights = extract_charpr_heights(hdr_elem)
    ppr_lspacing = extract_parapr_lspacing(hdr_elem)
    parent_map = {c: p for p in sec_elem.iter() for c in p}

    def find_immediate_host_p(elem):
        curr = elem
        while curr in parent_map:
            curr = parent_map[curr]
            if curr.tag == HP_P:
                return curr
        return None

    def get_table_depth(tbl_elem):
        d = 0
        curr = tbl_elem
        while curr in parent_map:
            curr = parent_map[curr]
            if curr.tag == HP_TBL:
                d += 1
        return d

    all_tables = list(sec_elem.iter(HP_TBL))
    # Sort deepest (innermost) tables first so inner table heights bubble up to outer cells/tables
    all_tables_bottom_up = sorted(all_tables, key=get_table_depth, reverse=True)

    recalc_cells = 0
    healed_tables = set()

    for tbl in all_tables_bottom_up:
        tbl_modified = False
        for tr in tbl.findall(f'./{HP_TR}'):
            for tc in tr.findall(f'./{HP_TC}'):
                has_healed_inner = any(
                    inner_t in healed_tables
                    for inner_t in tc.findall(f'.//{HP_TBL}')
                )
                if has_healed_inner or tc_needs_recalc(tc, bad_ppr_ids=bad_ppr_ids, bad_style_ids=bad_style_ids):
                    recalc_tc_linesegs(
                        tc,
                        cpr_scale=cpr_scale,
                        bad_ppr_ids=bad_ppr_ids,
                        bad_style_ids=bad_style_ids,
                        replacement_ppr_id=replacement_ppr_id,
                        cpr_heights=cpr_heights,
                        ppr_lspacing=ppr_lspacing,
                    )
                    recalc_cells += 1
                    tbl_modified = True

        # Check if any row has mismatched single-span cell heights or if tbl/sz.height < sum of row heights
        rows = tbl.findall(f'./{HP_TR}')
        row_max_hs = []
        has_row_mismatch = False
        for tr in rows:
            single_hs = [
                int(tc.find(f'./{HP_CELLSZ}').attrib.get('height', '0'))
                for tc in tr.findall(f'./{HP_TC}')
                if tc.find(f'./{HP_CELLSZ}') is not None
                and (tc.find(f'./{HP_CELLSPAN}') is None or int(tc.find(f'./{HP_CELLSPAN}').attrib.get('rowSpan', '1')) == 1)
            ]
            if len(set(single_hs)) > 1:
                has_row_mismatch = True
            row_max_hs.append(max(single_hs) if single_hs else 0)

        sz = tbl.find(f'./{HP_SZ}')
        cur_tbl_h = int(sz.attrib.get('height', '0')) if sz is not None else 0
        if tbl_modified or has_row_mismatch or (len(rows) > 1 and cur_tbl_h < sum(row_max_hs)):
            host_p = find_immediate_host_p(tbl)
            new_tbl_h = sync_table_geometry(host_p, tbl, update_host_lseg=True)
            if tbl_modified and new_tbl_h > cur_tbl_h:
                enforce_inline_table_flow(tbl)
            healed_tables.add(tbl)

    # Flatten any remaining child tags (e.g. benign markpenBegin/End) across all <hp:t> in the section
    for t_node in sec_elem.iter(HP_T):
        if len(list(t_node)) > 0:
            flatten_t_node(t_node)

    recalc_section_layout(sec_elem, cpr_scale=cpr_scale, page_height_limit=page_height_limit)
    return recalc_cells


def recalc_section_layout(sec_elem, cpr_scale=None, page_height_limit=72000):
    """
    Recalculate top-level paragraph <hp:linesegarray> across a section (<hs:sec>),
    resetting vertical position at pageBreak="1" or page boundary, and ensuring
    <hp:linesegarray> is always the last child of every <hp:p>.
    """
    cur_v = 0
    for p in sec_elem.findall(f'./{HP_P}'):
        if p.attrib.get('pageBreak') == '1' or cur_v >= page_height_limit:
            cur_v = 0
        cur_v = layout_sec_paragraph(p, cur_v, cpr_scale=cpr_scale)

    for p in sec_elem.iter(HP_P):
        ensure_linesegarray_last(p)


def reindex_table_rows(tbl_elem):
    """Update rowCnt and cellAddr rowAddr on all rows/cells of a table."""
    rows = tbl_elem.findall(f'./{HP_TR}')
    tbl_elem.attrib['rowCnt'] = str(len(rows))
    for r_idx, tr in enumerate(rows):
        for tc in tr.findall(f'./{HP_TC}'):
            addr = tc.find(f'./{HP_CELLADDR}')
            if addr is not None:
                addr.attrib['rowAddr'] = str(r_idx)


def preserve_xml_header_and_save(orig_xml_bytes, root_elem, out_xml_path, root_tag_prefix='<hs:sec'):
    """Write XML element tree while preserving the original XML declaration and root namespace attributes."""
    tree = ET.ElementTree(root_elem)
    tree.write(out_xml_path, encoding='utf-8', xml_declaration=False)
    orig_str = orig_xml_bytes.decode('utf-8')
    sec_start = orig_str.find(root_tag_prefix)
    if sec_start == -1:
        return
    sec_end = orig_str.find('>', sec_start)
    orig_header = orig_str[:sec_end + 1]

    with open(out_xml_path, 'r', encoding='utf-8') as f:
        gen_str = f.read()
    g_start = gen_str.find(root_tag_prefix)
    if g_start == -1:
        return
    g_end = gen_str.find('>', g_start)
    final_str = orig_header + gen_str[g_end + 1:]
    with open(out_xml_path, 'w', encoding='utf-8') as f:
        f.write(final_str)


def patch_zip_flags(hwpx_path):
    """Restore Bit 2 (Fast Deflating, value 4) in ZIP local and central directory headers for Hancom Office."""
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


def verify_hwpx_no_overlap(hwpx_path, raise_on_error=True):
    """
    Self-verification gatekeeper validating the 5 anti-overlap invariants on a built HWPX archive:
    1. Zero inverted child order (<hp:linesegarray> before <hp:run>) in any <hp:p>.
    2. Zero duplicate or non-increasing vertpos across <hp:lineseg> in any table cell <hp:tc>
       (including nested table / picture host paragraphs).
    3. Zero <hp:cellSz height> integer overflow (> 100000 on single-span cells), zero undersized
       single-span cells (cellSz.height < max(vertpos + vertsize)), zero mismatched single-span
       cell heights within the same row, and zero narrow horzsize (< 1200).
    4. Zero lineWrap="SQUEEZE", zero compressed PERCENT lineSpacing (< 100%), zero negative indent
       on paraPr 129 in header.xml, and zero defective Excel paraPr/style refs in cells.
    5. Zero ghost markpenBegin tail or inline lineBreak/fwSpace inside <hp:t>, and 100% ZIP Bit-2
       Fast Deflating flag (value 4) on all DEFLATED entries.
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

    bad_ppr_ids, bad_style_ids, _ = get_excel_defective_ids(hdr)

    squeeze_count = 0
    neg_intent_129 = 0
    compressed_lspacing = 0
    if hdr is not None:
        for ppr in hdr.iter(HH_PARAPR):
            pid = ppr.attrib.get('id')
            if pid == '129':
                for intent_el in ppr.iter(HC_INTENT):
                    if int(intent_el.attrib.get('value', '0')) < 0:
                        neg_intent_129 += 1
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
    narrow_hsize_cells = []
    bad_parapr_cells = []
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
                    if cname in ('lineBreak', 'fwSpace') or (cname == 'markpenBegin' and (t_node.text or '').strip() and (child.tail or '').strip()):
                        ghost_t_nodes.append((sec_name, p_idx, cname))

        for tc_idx, tc in enumerate(sec.iter(HP_TC)):
            cell_sz = tc.find(f'./{HP_CELLSZ}')
            cspan = tc.find(f'./{HP_CELLSPAN}')
            rspan = int(cspan.attrib.get('rowSpan', '1')) if cspan is not None else 1
            ch = int(cell_sz.attrib.get('height', '0')) if cell_sz is not None else 0
            if cell_sz is not None:
                if (rspan == 1 and ch > 100000) or ch > 500000:
                    huge_height_cells.append((sec_name, tc_idx, ch))

            sublist = tc.find(f'./{HP_SUBLIST}')
            container = sublist if sublist is not None else tc
            ps = container.findall(f'./{HP_P}')
            vpos = []
            max_ls_bottom = 0
            min_next_vp = 0
            has_nested_overlap = False

            for sp in ps:
                if sp.attrib.get('paraPrIDRef') in bad_ppr_ids or sp.attrib.get('styleIDRef') in bad_style_ids:
                    bad_parapr_cells.append((sec_name, tc_idx, sp.attrib))
                inner_tbl = sp.find(f'.//{HP_TBL}')
                inner_pic = sp.find(f'.//{HP_PIC}')
                lsegs = sp.findall(f'./{HP_LINESEGA}/{HP_LINESEG}')
                if inner_tbl is not None:
                    isz = inner_tbl.find(f'./{HP_SZ}')
                    th = int(isz.attrib.get('height', '0')) if isz is not None else 0
                    if lsegs:
                        vp = int(lsegs[0].attrib.get('vertpos', '0'))
                        vs = int(lsegs[0].attrib.get('vertsize', '0'))
                        if vp < min_next_vp or (th > 0 and vs < th):
                            has_nested_overlap = True
                        vpos.append(vp)
                        min_next_vp = vp + max(vs, th)
                        max_ls_bottom = max(max_ls_bottom, min_next_vp)
                    continue
                if inner_pic is not None:
                    for ls in lsegs:
                        vp = int(ls.attrib.get('vertpos', '0'))
                        vs = int(ls.attrib.get('vertsize', '0'))
                        if vp < min_next_vp:
                            has_nested_overlap = True
                        vpos.append(vp)
                        min_next_vp = vp + vs
                        max_ls_bottom = max(max_ls_bottom, min_next_vp)
                    continue

                txt = extract_p_text(sp).strip()
                for ls in lsegs:
                    hs = int(ls.attrib.get('horzsize', '0'))
                    if txt and 0 < hs < 1200:
                        narrow_hsize_cells.append((sec_name, tc_idx, hs, txt[:25]))
                    vp = int(ls.attrib.get('vertpos', '0'))
                    vs = int(ls.attrib.get('vertsize', '0'))
                    if vp < min_next_vp:
                        has_nested_overlap = True
                    vpos.append(vp)
                    max_ls_bottom = max(max_ls_bottom, vp + vs)

            if has_nested_overlap or (len(vpos) > 1 and (len(set(vpos)) < len(vpos) or any(vpos[i] >= vpos[i + 1] for i in range(len(vpos) - 1)))):
                dup_vpos_cells.append((sec_name, tc_idx, vpos))

            if rspan == 1 and ch > 0 and max_ls_bottom > ch:
                huge_height_cells.append((sec_name, tc_idx, f'undersized:{ch}<{max_ls_bottom}'))

    metrics = {
        'sections': len(sections),
        'squeeze_count': squeeze_count,
        'neg_intent_129': neg_intent_129,
        'compressed_lspacing': compressed_lspacing,
        'inverted_order_p': len(inverted_order_p),
        'dup_vpos_cells': len(dup_vpos_cells),
        'huge_height_cells': len(huge_height_cells),
        'narrow_hsize_cells': len(narrow_hsize_cells),
        'bad_parapr_cells': len(bad_parapr_cells),
        'ghost_t_nodes': len(ghost_t_nodes),
        'bad_zip_flags': len(bad_zip_flags),
    }

    if raise_on_error:
        errors = []
        if squeeze_count > 0:
            errors.append(f'lineWrap="SQUEEZE" in header.xml: {squeeze_count}')
        if neg_intent_129 > 0:
            errors.append(f'negative indent on paraPr 129 in header.xml: {neg_intent_129}')
        if compressed_lspacing > 0:
            errors.append(f'compressed PERCENT lineSpacing (<100%) in header.xml: {compressed_lspacing}')
        if inverted_order_p:
            errors.append(f'inverted child order (<hp:linesegarray> before <hp:run>): {inverted_order_p[:5]}')
        if dup_vpos_cells:
            errors.append(f'duplicate/non-increasing/overlapping vertpos in cells: {dup_vpos_cells[:5]}')
        if huge_height_cells:
            errors.append(f'cellSz height overflow or undersized cell: {huge_height_cells[:5]}')
        if narrow_hsize_cells:
            errors.append(f'abnormally narrow horzsize (<1200): {narrow_hsize_cells[:5]}')
        if bad_parapr_cells:
            errors.append(f'un-normalized Excel paraPr in cells: {bad_parapr_cells[:5]}')
        if ghost_t_nodes:
            errors.append(f'unflattened <hp:t> inline/ghost tags: {ghost_t_nodes[:5]}')
        if bad_zip_flags:
            errors.append(f'DEFLATED ZIP entries without Bit-2 flag (4): {bad_zip_flags[:5]}')
        if errors:
            raise RuntimeError('[HWPX OVERLAP GATEKEEPER ERROR] ' + ' | '.join(errors))

    return metrics


def strip_markdown_inline(text):
    """Strip Markdown bold/italic/code markers (**bold**, `code`) for clean HWPX plain text."""
    if not text:
        return ''
    cleaned = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    cleaned = re.sub(r'`([^`]+)`', r'\1', cleaned)
    return cleaned.strip()


def parse_markdown(md_path):
    """
    Parses a markdown file and categorizes each line.
    Handles table rows and merges them into a single ('TABLE', rows_list) token.
    """
    if not os.path.exists(md_path):
        print(f"Error: Markdown file not found at {md_path}")
        return []

    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    parsed_lines = []
    current_table_rows = []
    in_table = False

    for line in lines:
        raw_rstripped = line.rstrip('\r\n')
        leading_spaces = len(raw_rstripped) - len(raw_rstripped.lstrip(' \t'))
        line_str = raw_rstripped.strip()

        # Table Row Detection
        if line_str.startswith('|') and line_str.endswith('|'):
            if re.match(r'^\|[\s:\-\|]+\|$', line_str):
                continue
            cols = [strip_markdown_inline(c.strip()) for c in line_str.split('|')[1:-1]]
            current_table_rows.append(cols)
            in_table = True
            continue
        else:
            if in_table:
                if current_table_rows:
                    parsed_lines.append(('TABLE', current_table_rows))
                    current_table_rows = []
                in_table = False

        if not line_str or line_str == '---':
            parsed_lines.append(('SPACER', ''))
            continue

        # Match headings and list items
        if line_str.startswith('# '):
            parsed_lines.append(('TITLE', strip_markdown_inline(line_str[2:].strip())))
        elif line_str.startswith('## '):
            parsed_lines.append(('HEADING_1', strip_markdown_inline(line_str[3:].strip())))
        elif line_str.startswith('### '):
            parsed_lines.append(('HEADING_2', strip_markdown_inline(line_str[4:].strip())))
        elif line_str.startswith('> '):
            q_txt = strip_markdown_inline(line_str[2:].strip())
            if q_txt.startswith('※'):
                parsed_lines.append(('ITEM_BULLET', q_txt))
            else:
                parsed_lines.append(('META_CANDIDATE', q_txt))
        elif line_str.startswith('- ❍ ') or line_str.startswith('* ❍ '):
            parsed_lines.append(('ITEM_BULLET', strip_markdown_inline(line_str[2:].strip())))
        elif (line_str.startswith('- ') or line_str.startswith('* ')) and leading_spaces >= 2:
            sub_txt = strip_markdown_inline(line_str[2:].strip())
            sub_txt = re.sub(r'^[•·]\s*', '', sub_txt)
            parsed_lines.append(('SUB_ITEM', sub_txt))
        elif line_str.startswith('- ') or line_str.startswith('* '):
            parsed_lines.append(('ITEM', strip_markdown_inline(line_str[2:].strip())))
        elif line_str.startswith(('▢', '❍', '▪', '▣', '•', '※')):
            parsed_lines.append(('ITEM_BULLET', strip_markdown_inline(line_str)))
        else:
            parsed_lines.append(('NORMAL', strip_markdown_inline(line_str)))

    # Flush remaining table
    if in_table and current_table_rows:
        parsed_lines.append(('TABLE', current_table_rows))

    return parsed_lines


def has_ctrl_objects(p_node, ns=None):
    """
    Checks if a paragraph contains tables, boxes, equations, drawings, shapes or images.
    If it does, we must preserve it and not overwrite or delete it as a plain text paragraph.
    """
    for elem in p_node.iter():
        tag_local = elem.tag.split('}')[-1]
        if tag_local in CTRL_OBJECT_TAGS:
            return True
    return False


def assert_non_destructive_paths(template_path, output_path):
    """
    Enforce Rule O & Non-Destructive Replication (AP-H1):
    Forbid overwriting the input template or Desktop reference/template files ('방침서 예시.hwpx', '5. 방침서.hwpx').
    """
    abs_tpl = os.path.normcase(os.path.abspath(template_path))
    abs_out = os.path.normcase(os.path.abspath(output_path))
    protected_abs = {abs_tpl} | {
        os.path.normcase(os.path.abspath(p)) for p in PROTECTED_POLICY_TEMPLATES
    }
    if abs_out in protected_abs:
        raise RuntimeError(
            f"[NON-DESTRUCTIVE TEMPLATE GUARD ERROR] 원본 양식·예시 파일('{output_path}')을 직접 덮어쓰는 행위는 금지됩니다. "
            f"바탕화면 내 신규 파일명(예: D:\\Desktop\\2026_신규사업_추진계획.hwpx)을 --output으로 지정하십시오."
        )


def is_policy_example_template(root, ns):
    """
    Detect whether `section0.xml` represents the canonical Gangnam-gu Policy Example reference
    (`D:\\Desktop\\방침서 예시.hwpx`), containing Page 1 Electronic Approval Cover + Page 2
    Pre-Review Checklist (`관련 규정 및 제반사항 사전검토서`) + Page 3+ Roman Numeral Badge widgets.
    """
    full_text = ''.join(root.itertext())
    has_prereview = '관련 규정 및 제반사항 사전검토서' in full_text
    has_cover = (root.find('.//hp:tc[@name="제목"]', ns) is not None) or ('등록번호' in full_text)
    return has_prereview and has_cover


def is_policy_cover_template(root, ns):
    """
    Detect whether `section0.xml` represents the blank 1-page Gangnam-gu Policy Approval Cover
    template (`D:\\Desktop\\5. 방침서.hwpx`), which has an approval header table, a cover title cell
    (`tc[@name="제목"]`), an agency footer table (`강 남 구`), and no pre-populated body section.
    """
    if is_policy_example_template(root, ns):
        return False
    has_title_cell = root.find('.//hp:tc[@name="제목"]', ns) is not None
    full_text = ''.join(root.itertext())
    has_agency_cover = ('강 남 구' in full_text) and ('등록번호' in full_text)
    top_plain_ps = [
        p for p in root.findall('./hp:p', ns)
        if not has_ctrl_objects(p, ns)
    ]
    return (has_title_cell or has_agency_cover) and len(top_plain_ps) <= 5


ROMAN_NUMERALS = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ', 'Ⅺ', 'Ⅻ']


def strip_section_prefix(heading_text):
    """Strip leading Roman numerals, Arabic section numbers, or dingbats from a section heading."""
    s = (heading_text or '').strip()
    s = re.sub(r'^[󰏚▣■▢❍]+\s*', '', s)
    s = re.sub(r'^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+|[IVX]+|\d+)\s*[\.\)]\s*', '', s)
    s = re.sub(r'^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+\s+', '', s)
    return s.strip()


def extract_policy_metadata(parsed_md, cli_subtitle=None, cli_date=None, cli_dept=None):
    """
    Extract cover, pre-review (`사전검토서`), and executive-summary metadata from CLI arguments,
    optional top-of-markdown key:value lines, and automatic body inference, returning
    `(metadata_dict, filtered_body_tokens)`.
    """
    now = datetime.now()
    default_date = f"{now.year}. {now.month}. {now.day}."
    meta = {
        'title': '',
        'subtitle': cli_subtitle if cli_subtitle is not None else '',
        'date': cli_date if cli_date is not None else '',
        'cover_date': '',
        'dept': cli_dept if cli_dept is not None else '',
        'doc_no': '',
        'approval_date': '',
        'disclosure': '부분공개(5)',
        'coop_depts': [],
        'purpose': '',
        'legal_basis': [],
        'election_law': '해당사항 없음',
        'background': '',
        'budget_note': '',
        'beneficiary': '',
        'conflict_note': '해당사항 없음 (민원 및 공공갈등 유발 요인 없음)',
        'project_type': '',
        'field_review': '관련 법규 및 부서 협조사항 사전 검토 완료',
        'other_cases': '해당사항 없음',
        'expert_review': '해당사항 없음',
    }

    key_patterns = [
        ('subtitle', r'^(?:소제목|부제|슬로건)\s*[:：]\s*(.+)$'),
        ('date', r'^(?:작성일|작성일자|기안일|기안일자|등록일자|일자|날짜)\s*[:：]\s*(.+)$'),
        ('cover_date', r'^(?:표지일자|표지연월)\s*[:：]\s*(.+)$'),
        ('dept', r'^(?:소관부서|담당부서|작성부서|부서명|부서)\s*[:：]\s*(.+)$'),
        ('doc_no', r'^(?:등록번호|시행번호|문서번호)\s*[:：]\s*(.+)$'),
        ('approval_date', r'^(?:결재일자|시행일자)\s*[:：]\s*(.+)$'),
        ('disclosure', r'^(?:공개구분|공개여부)\s*[:：]\s*(.+)$'),
        ('purpose', r'^(?:추진목적|사업목적|목적요약|요약)\s*[:：]\s*(.+)$'),
        ('election_law', r'^(?:공직선거법|선거법검토)\s*[:：]\s*(.+)$'),
        ('background', r'^(?:추진경위)\s*[:：]\s*(.+)$'),
        ('budget_note', r'^(?:예산사항)\s*[:：]\s*(.+)$'),
        ('beneficiary', r'^(?:수혜자|수혜대상|수혜자및범위)\s*[:：]\s*(.+)$'),
        ('conflict_note', r'^(?:공공갈등|갈등진단)\s*[:：]\s*(.+)$'),
        ('project_type', r'^(?:사업유형|추진구분)\s*[:：]\s*(.+)$'),
        ('field_review', r'^(?:분야별검토|제반사항)\s*[:：]\s*(.+)$'),
        ('other_cases', r'^(?:타기관사례|타구사례)\s*[:：]\s*(.+)$'),
        ('expert_review', r'^(?:전문가자문|자문검토)\s*[:：]\s*(.+)$'),
    ]

    body_tokens = []
    seen_title = False
    seen_first_h1 = False

    for idx, (tag, val) in enumerate(parsed_md):
        if tag in ('META_CANDIDATE', 'NORMAL', 'ITEM') and idx < 24 and not seen_first_h1 and isinstance(val, str):
            m_coop = re.match(r'^(?:협조부서|협조자)\s*[:：]\s*(.+)$', val)
            if m_coop:
                raw_c = m_coop.group(1).strip()
                if raw_c not in ('없음', '-', '해당없음'):
                    meta['coop_depts'] = [c.strip() for c in re.split(r'[,/·]', raw_c) if c.strip()]
                continue
            m_law = re.match(r'^(?:관련근거|법적근거|관련규정)\s*[:：]\s*(.+)$', val)
            if m_law:
                meta['legal_basis'] = [s.strip() for s in re.split(r'[;/]', m_law.group(1)) if s.strip()]
                continue

            matched_meta = False
            for m_key, pat in key_patterns:
                m_obj = re.match(pat, val)
                if m_obj:
                    if not meta[m_key] or m_key in ('disclosure', 'election_law', 'conflict_note', 'field_review', 'other_cases', 'expert_review'):
                        if not (m_key in ('subtitle', 'date', 'dept') and meta[m_key]):
                            meta[m_key] = m_obj.group(1).strip()
                    matched_meta = True
                    break
            if matched_meta:
                continue

            if tag == 'META_CANDIDATE':
                if not meta['purpose'] and seen_title:
                    meta['purpose'] = val.strip()
                else:
                    body_tokens.append(('NORMAL', val))
                continue

        if tag == 'TITLE' and isinstance(val, str):
            clean_t = re.sub(r'^[󰏚▣■▢]\s*', '', val).strip()
            if not meta['title']:
                meta['title'] = clean_t
            seen_title = True
            body_tokens.append((tag, val))
            continue

        if tag == 'HEADING_1' and isinstance(val, str):
            seen_first_h1 = True
            if not meta['title']:
                meta['title'] = strip_section_prefix(val)

        body_tokens.append((tag, val))

    if not meta['date']:
        meta['date'] = default_date
    if not meta['cover_date']:
        m_ym = re.match(r'^(\d{4})\.\s*(\d{1,2})\.', meta['date'])
        meta['cover_date'] = f"{m_ym.group(1)}. {int(m_ym.group(2))}." if m_ym else meta['date']
    if not meta['dept']:
        meta['dept'] = '보건행정과'

    # Auto-infer pre-review fields from body_tokens when not explicitly provided
    in_legal_sec = False
    has_budget_sec = False
    for tag, val in body_tokens:
        if tag == 'HEADING_1' and isinstance(val, str):
            sec_t = strip_section_prefix(val)
            in_legal_sec = ('근거' in sec_t)
            if '예산' in sec_t or '소요재원' in sec_t:
                has_budget_sec = True
            continue
        if isinstance(val, str):
            clean_line = re.sub(r'^[▢❍•\-‣※]\s*', '', val).strip()
            if in_legal_sec and clean_line and len(meta['legal_basis']) < 3:
                meta['legal_basis'].append(clean_line)
            if not meta['beneficiary']:
                m_target = re.match(r'^대\s*상\s*[:：]\s*(.+)$', clean_line)
                if m_target:
                    meta['beneficiary'] = f"대상 : {m_target.group(1).strip()}"
            if '예산' in clean_line and ('원' in clean_line or '비예산' in clean_line):
                has_budget_sec = has_budget_sec or ('비예산' not in clean_line)
                if '비예산' in clean_line and not meta['budget_note']:
                    meta['budget_note'] = '해당사항 없음 (비예산 사업)'

    if not meta['legal_basis']:
        meta['legal_basis'] = ['「지역보건법」 제11조(보건소의 기능 및 업무) 및 「국민건강증진법」 제19조(건강증진사업 등)']
    if not meta['background']:
        yr = meta['date'][:4] if len(meta['date']) >= 4 and meta['date'][:4].isdigit() else str(now.year)
        meta['background'] = f"{yr}년 강남구 {meta['title'] or '주요 보건사업'} 추진계획"
    if not meta['budget_note']:
        meta['budget_note'] = '검토 및 본문 적시' if has_budget_sec else '해당사항 없음 (비예산 자체 추진)'
    if not meta['beneficiary']:
        meta['beneficiary'] = '대상 : 강남구민'

    return meta, body_tokens


def ensure_policy_body_styles(hdr_root):
    """
    Append clean body & table styles (`charPr`, `paraPr`, `borderFill`) to `header.xml`
    without mutating any existing IDs used by the cover page.
    Returns a style ID dictionary for body generation.
    """
    HH_CHARPROPS = f"{{{NS_MAP['hh']}}}charProperties"
    HH_BORDERFILLS = f"{{{NS_MAP['hh']}}}borderFills"
    HH_PARAPROPS = f"{{{NS_MAP['hh']}}}paraProperties"
    HH_FONTREF = f"{{{NS_MAP['hh']}}}fontRef"
    HH_BOLD = f"{{{NS_MAP['hh']}}}bold"
    HH_ITALIC = f"{{{NS_MAP['hh']}}}italic"
    HH_UNDERLINE = f"{{{NS_MAP['hh']}}}underline"
    HH_ALIGN = f"{{{NS_MAP['hh']}}}align"
    HC_FILLBRUSH = f"{{{NS_MAP['hc']}}}fillBrush"
    HC_WINBRUSH = f"{{{NS_MAP['hc']}}}winBrush"

    styles = {
        'cpr_title': '15',
        'cpr_h1': '15',
        'cpr_h2': '4',
        'cpr_body': '4',
        'cpr_sub': '4',
        'cpr_note': '8',
        'cpr_tbl_hdr': '14',
        'cpr_tbl_cell': '12',
        'bf_tbl_hdr': '3',
        'bf_tbl_cell': '3',
        'bf_tbl_bottom': '3',
        'ppr_center': '0',
        'ppr_body': '1',
        'ppr_tbl_center': '18',
        'ppr_tbl_justify': '11',
        'ppr_tbl_right': '17',
    }
    if hdr_root is None:
        return styles

    # Detect available Hangul font IDs
    hangul_fonts = hdr_root.findall(f".//{{{NS_MAP['hh']}}}fontface[@lang='HANGUL']/{{{NS_MAP['hh']}}}font")
    avail_font_ids = {f.attrib.get('id', '0') for f in hangul_fonts}
    font_gothic = '0'
    font_headline = '1' if '1' in avail_font_ids else '0'
    font_myungjo = '2' if '2' in avail_font_ids else '0'
    font_mid_gothic = '3' if '3' in avail_font_ids else font_gothic

    cprs = hdr_root.find(f'.//{HH_CHARPROPS}')
    if cprs is not None and len(list(cprs)) > 0:
        proto_cpr = list(cprs)[-1]
        next_cid = max(int(el.attrib.get('id', '0')) for el in cprs) + 1

        def _append_cpr(height_hu, bold=False, font_id='2', spacing_val='-5'):
            nonlocal next_cid
            cid = str(next_cid)
            next_cid += 1
            cp = copy.deepcopy(proto_cpr)
            cp.attrib['id'] = cid
            cp.attrib['height'] = str(height_hu)
            cp.attrib['textColor'] = '#000000'
            cp.attrib['borderFillIDRef'] = '1'
            fref = cp.find(f'./{HH_FONTREF}')
            if fref is not None:
                for k in list(fref.attrib.keys()):
                    fref.attrib[k] = str(font_id)
            sp_el = cp.find(f'./{HH_SPACING}')
            if sp_el is not None:
                for k in list(sp_el.attrib.keys()):
                    sp_el.attrib[k] = str(spacing_val)
            for it_el in list(cp.findall(f'./{HH_ITALIC}')):
                cp.remove(it_el)
            for b_el in list(cp.findall(f'./{HH_BOLD}')):
                cp.remove(b_el)
            if bold:
                children = list(cp)
                ul_idx = next((i for i, ch in enumerate(children) if ch.tag == HH_UNDERLINE), len(children))
                cp.insert(ul_idx, ET.Element(HH_BOLD))
            cprs.append(cp)
            return cid

        styles['cpr_title'] = _append_cpr(2200, bold=True, font_id=font_headline, spacing_val='-5')
        styles['cpr_h1'] = _append_cpr(1600, bold=True, font_id=font_mid_gothic, spacing_val='-5')
        styles['cpr_h2'] = _append_cpr(1500, bold=True, font_id=font_myungjo, spacing_val='-5')
        styles['cpr_body'] = _append_cpr(1500, bold=False, font_id=font_myungjo, spacing_val='-5')
        styles['cpr_sub'] = _append_cpr(1300, bold=False, font_id=font_myungjo, spacing_val='-3')
        styles['cpr_note'] = _append_cpr(1200, bold=False, font_id=font_myungjo, spacing_val='-5')
        styles['cpr_tbl_hdr'] = _append_cpr(1100, bold=True, font_id=font_gothic, spacing_val='-5')
        styles['cpr_tbl_cell'] = _append_cpr(1100, bold=False, font_id=font_gothic, spacing_val='-5')
        cprs.attrib['itemCnt'] = str(len(list(cprs)))

    bfs = hdr_root.find(f'.//{HH_BORDERFILLS}')
    if bfs is not None and len(list(bfs)) > 0:
        proto_bf = next((b for b in bfs if b.attrib.get('id') == '3'), list(bfs)[-1])
        next_bf_id = max(int(el.attrib.get('id', '1')) for el in bfs) + 1

        def _append_bf(top_w='0.12 mm', bot_w='0.12 mm', left_w='0.12 mm', right_w='0.12 mm', bg_color=None):
            nonlocal next_bf_id
            bid = str(next_bf_id)
            next_bf_id += 1
            bf = copy.deepcopy(proto_bf)
            bf.attrib['id'] = bid
            for btag, bw in (('leftBorder', left_w), ('rightBorder', right_w), ('topBorder', top_w), ('bottomBorder', bot_w)):
                bel = bf.find(f"./{{{NS_MAP['hh']}}}{btag}")
                if bel is not None:
                    bel.attrib['type'] = 'SOLID'
                    bel.attrib['width'] = bw
                    bel.attrib['color'] = '#000000'
            for old_fb in list(bf.findall(f'./{HC_FILLBRUSH}')):
                bf.remove(old_fb)
            if bg_color:
                fb = ET.Element(HC_FILLBRUSH)
                ET.SubElement(fb, HC_WINBRUSH, {'faceColor': bg_color, 'hatchColor': '#999999', 'alpha': '0'})
                bf.append(fb)
            bfs.append(bf)
            return bid

        styles['bf_tbl_hdr'] = _append_bf(top_w='0.4 mm', bot_w='0.15 mm', bg_color='#F2F4F7')
        styles['bf_tbl_cell'] = _append_bf(top_w='0.12 mm', bot_w='0.12 mm', bg_color=None)
        styles['bf_tbl_bottom'] = _append_bf(top_w='0.12 mm', bot_w='0.4 mm', bg_color=None)
        bfs.attrib['itemCnt'] = str(len(list(bfs)))

    pprs = hdr_root.find(f'.//{HH_PARAPROPS}')
    if pprs is not None and len(list(pprs)) > 0:
        proto_ppr11 = next((p for p in pprs if p.attrib.get('id') == '11'), list(pprs)[-1])
        next_pid = max(int(el.attrib.get('id', '0')) for el in pprs) + 1
        ppr_right = copy.deepcopy(proto_ppr11)
        ppr_right.attrib['id'] = str(next_pid)
        al_el = ppr_right.find(f'./{HH_ALIGN}')
        if al_el is not None:
            al_el.attrib['horizontal'] = 'RIGHT'
        pprs.append(ppr_right)
        styles['ppr_tbl_right'] = str(next_pid)
        pprs.attrib['itemCnt'] = str(len(list(pprs)))

    return styles


def is_numeric_cell_text(txt):
    """Return True when a table cell value represents currency, percentage, or right-aligned numeric metrics."""
    s = (txt or '').strip()
    if not s or len(s) > 28:
        return False
    return bool(re.match(r'^[\+\-△▲▼]?\s*[\d,]+(?:\.\d+)?\s*(?:원|천원|백만원|억원|명|건|개|곳|군데|회|부|식|%|%p|점)?$', s))


def build_policy_table_paragraph(proto_tbl_elem, rows_data, styles, tbl_seq, cpr_scale=None):
    """
    Build a top-level <hp:p> hosting an inline <hp:tbl> (`treatAsChar="1"`) cloned from
    `proto_tbl_elem` so all Hancom Office XSD attributes remain 100% authentic.
    """
    num_rows = len(rows_data)
    num_cols = max((len(r) for r in rows_data), default=1)
    total_width = 49032

    # Compute proportional column widths bounded within [min_col_w, max_col_w]
    col_weights = []
    for c_idx in range(num_cols):
        max_len = max((len(r[c_idx]) if c_idx < len(r) else 2) for r in rows_data)
        col_weights.append(max(4, min(max_len + 2, 36)))
    weight_sum = sum(col_weights) or 1
    min_w = max(3200, total_width // max(num_cols * 3, 4))
    col_widths = [max(min_w, int(total_width * w / weight_sum)) for w in col_weights]
    scale_factor = total_width / float(sum(col_widths))
    col_widths = [int(w * scale_factor) for w in col_widths]
    col_widths[-1] += total_width - sum(col_widths)

    tbl = copy.deepcopy(proto_tbl_elem)
    tbl.attrib['id'] = str(0x743A6280 + tbl_seq)
    tbl.attrib['rowCnt'] = str(num_rows)
    tbl.attrib['colCnt'] = str(num_cols)
    tbl.attrib['pageBreak'] = 'CELL'
    tbl.attrib['repeatHeader'] = '1'
    tbl.attrib['borderFillIDRef'] = styles['bf_tbl_cell']

    sz_el = tbl.find(f'./{HP_SZ}')
    if sz_el is not None:
        sz_el.attrib['width'] = str(total_width)
    enforce_inline_table_flow(tbl)

    orig_rows = tbl.findall(f'./{HP_TR}')
    proto_tc = copy.deepcopy(orig_rows[0].findall(f'./{HP_TC}')[0])
    for tr in list(orig_rows):
        tbl.remove(tr)

    for r_idx, r_vals in enumerate(rows_data):
        tr = ET.Element(HP_TR)
        is_hdr = (r_idx == 0 and num_rows > 1)
        is_last = (r_idx == num_rows - 1 and num_rows > 1)
        for c_idx in range(num_cols):
            raw_val = r_vals[c_idx] if c_idx < len(r_vals) else ''
            cell_lines = [
                strip_markdown_inline(seg)
                for seg in raw_val.replace('<br/>', '\n').replace('<br>', '\n').split('\n')
            ] if raw_val else ['']

            tc = copy.deepcopy(proto_tc)
            tc.attrib['name'] = ''
            tc.attrib['header'] = '1' if is_hdr else '0'
            if is_hdr:
                tc.attrib['borderFillIDRef'] = styles['bf_tbl_hdr']
            elif is_last:
                tc.attrib['borderFillIDRef'] = styles['bf_tbl_bottom']
            else:
                tc.attrib['borderFillIDRef'] = styles['bf_tbl_cell']

            caddr = tc.find(f'./{HP_CELLADDR}')
            if caddr is not None:
                caddr.attrib['colAddr'] = str(c_idx)
                caddr.attrib['rowAddr'] = str(r_idx)
            cspan = tc.find(f'./{HP_CELLSPAN}')
            if cspan is not None:
                cspan.attrib['colSpan'] = '1'
                cspan.attrib['rowSpan'] = '1'
            csz = tc.find(f'./{HP_CELLSZ}')
            if csz is not None:
                csz.attrib['width'] = str(col_widths[c_idx])
                csz.attrib['height'] = '2400' if is_hdr else '2200'
            cmarg = tc.find(f'./{HP_CELLMARGIN}')
            if cmarg is not None:
                cmarg.attrib['left'] = '220'
                cmarg.attrib['right'] = '220'
                cmarg.attrib['top'] = '160'
                cmarg.attrib['bottom'] = '160'

            sublist = tc.find(f'./{HP_SUBLIST}')
            if sublist is not None:
                sublist.attrib['lineWrap'] = 'BREAK'
                sublist.attrib['vertAlign'] = 'CENTER'

            joined_val = ' '.join(cell_lines).strip()
            if is_hdr:
                ppr_id = styles['ppr_tbl_center']
                cpr_id = styles['cpr_tbl_hdr']
                vs_hu = 1100
            elif is_numeric_cell_text(joined_val):
                ppr_id = styles['ppr_tbl_right']
                cpr_id = styles['cpr_tbl_cell']
                vs_hu = 1100
            elif len(joined_val) <= 7 and (c_idx == 0 or c_idx == num_cols - 1):
                ppr_id = styles['ppr_tbl_center']
                cpr_id = styles['cpr_tbl_cell']
                vs_hu = 1100
            else:
                ppr_id = styles['ppr_tbl_justify']
                cpr_id = styles['cpr_tbl_cell']
                vs_hu = 1100

            p_container = sublist if sublist is not None else tc
            for old_sp in list(p_container.findall(f'./{HP_P}')):
                p_container.remove(old_sp)

            for line_str in cell_lines:
                sp = ET.Element(HP_P, {
                    'id': '0',
                    'paraPrIDRef': ppr_id,
                    'styleIDRef': '0',
                    'pageBreak': '0',
                    'columnBreak': '0',
                    'merged': '0',
                })
                r_el = ET.SubElement(sp, HP_RUN, {'charPrIDRef': cpr_id})
                t_el = ET.SubElement(r_el, HP_T)
                t_el.text = line_str
                lsa = ET.SubElement(sp, HP_LINESEGA)
                ET.SubElement(lsa, HP_LINESEG, {
                    'textpos': '0',
                    'vertpos': '0',
                    'vertsize': str(vs_hu),
                    'textheight': str(vs_hu),
                    'baseline': str(int(vs_hu * 0.85)),
                    'spacing': str(int(vs_hu * 0.30)),
                    'horzpos': '0',
                    'horzsize': str(max(1200, col_widths[c_idx] - 440)),
                    'flags': '393216',
                })
                p_container.append(sp)

            recalc_tc_linesegs(tc, cpr_scale=cpr_scale, shrink_height=False)
            tr.append(tc)
        tbl.append(tr)

    host_p = ET.Element(HP_P, {
        'id': '0',
        'paraPrIDRef': styles['ppr_body'],
        'styleIDRef': '0',
        'pageBreak': '0',
        'columnBreak': '0',
        'merged': '0',
    })
    r_host = ET.SubElement(host_p, HP_RUN, {'charPrIDRef': styles['cpr_body']})
    r_host.append(tbl)
    ET.SubElement(r_host, HP_T)
    lsa_host = ET.SubElement(host_p, HP_LINESEGA)
    ET.SubElement(lsa_host, HP_LINESEG, {
        'textpos': '0',
        'vertpos': '0',
        'vertsize': '2400',
        'textheight': '2400',
        'baseline': '2040',
        'spacing': '480',
        'horzpos': '0',
        'horzsize': '49608',
        'flags': '393216',
    })
    sync_table_geometry(host_p, tbl, update_host_lseg=True)
    return host_p


def populate_policy_cover_and_body(root, hdr_root, parsed_md, cpr_scale=None, cli_subtitle=None, cli_date=None, cli_dept=None):
    """
    Populate Page 1 (Official Gangnam-gu Policy Approval Cover `5. 방침서.hwpx`) without altering
    approval boxes, slogan artwork, or district emblem, and generate Page 2+ body paragraphs and
    inline tables with full 5-pillar anti-overlap layout recalculation.
    """
    ns = {'hp': NS_MAP['hp']}
    meta, body_tokens = extract_policy_metadata(
        parsed_md,
        cli_subtitle=cli_subtitle,
        cli_date=cli_date,
        cli_dept=cli_dept,
    )
    styles = ensure_policy_body_styles(hdr_root)
    if hdr_root is not None:
        cpr_scale.update(extract_charpr_scale(hdr_root))

    proto_tbl_elem = None

    # 1. Populate Cover Page cells selectively while preserving all images and approval cells
    for p in root.findall('./hp:p', ns):
        for tbl in p.findall('.//hp:tbl', ns):
            rows = tbl.findall('./hp:tr', ns)
            full_tbl_txt = ''.join(tbl.itertext())

            # (a) Cover Subtitle Box (`소제목입력부분`)
            if '소제목입력부분' in full_tbl_txt and rows:
                tc = rows[0].find('./hp:tc', ns)
                if tc is not None:
                    sub_p = tc.find('./hp:subList/hp:p', ns)
                    if sub_p is not None:
                        for old_r in list(sub_p.findall('./hp:run', ns)):
                            sub_p.remove(old_r)
                        r_new = ET.Element(HP_RUN, {'charPrIDRef': '19'})
                        t_new = ET.SubElement(r_new, HP_T)
                        t_new.text = meta['subtitle']
                        sub_p.append(r_new)
                        ensure_linesegarray_last(sub_p)
                        recalc_tc_linesegs(tc, cpr_scale=cpr_scale, shrink_height=False)
                        sync_table_geometry(p, tbl, update_host_lseg=True)

            # (b) Cover Main Title Box (`tc[@name="제목"]`)
            title_tc = tbl.find('.//hp:tc[@name="제목"]', ns)
            if title_tc is not None:
                proto_tbl_elem = copy.deepcopy(tbl)
                sub_p = title_tc.find('./hp:subList/hp:p', ns)
                if sub_p is not None and meta['title']:
                    set_p_text(sub_p, meta['title'], char_pr_id='15')
                    recalc_tc_linesegs(title_tc, cpr_scale=cpr_scale, shrink_height=False)
                    sync_table_geometry(p, tbl, update_host_lseg=True)

            # (c) Cover Date Box (`20.   .   .` in Row 1 while Row 0 holds image2.png)
            if len(rows) == 2 and '20.' in full_tbl_txt:
                date_tc = rows[1].find('./hp:tc', ns)
                if date_tc is not None:
                    sub_p = date_tc.find('./hp:subList/hp:p', ns)
                    if sub_p is not None:
                        set_p_text(sub_p, meta['date'], char_pr_id='21')
                        recalc_tc_linesegs(date_tc, cpr_scale=cpr_scale, shrink_height=False)
                        sync_table_geometry(p, tbl, update_host_lseg=True)

            # (d) Cover Agency & Department Footer (`강 남 구` / `( 보건행정과 )`)
            if '강 남 구' in full_tbl_txt and len(rows) >= 2:
                for sub_el in tbl.findall('.//hp:subList', ns):
                    if sub_el.attrib.get('lineWrap') == 'SQUEEZE':
                        sub_el.attrib['lineWrap'] = 'BREAK'
                for tc in rows[1].findall('./hp:tc', ns):
                    caddr = tc.find('./hp:cellAddr', ns)
                    if caddr is not None and caddr.attrib.get('colAddr') == '2':
                        sub_p = tc.find('./hp:subList/hp:p', ns)
                        if sub_p is not None:
                            set_p_text(sub_p, meta['dept'], char_pr_id='17')
                            recalc_tc_linesegs(tc, cpr_scale=cpr_scale, shrink_height=False)
                sync_table_geometry(p, tbl, update_host_lseg=True)

    if proto_tbl_elem is None:
        all_tbls = root.findall('.//hp:tbl', ns)
        if all_tbls:
            proto_tbl_elem = copy.deepcopy(all_tbls[-1])

    # 2. Locate end of Cover Page (after fieldEnd or last control paragraph) and clear trailing blank p
    top_ps = root.findall('./hp:p', ns)
    last_cover_idx = 0
    for idx, p in enumerate(top_ps):
        has_ctrl_or_field = has_ctrl_objects(p, ns) or (p.find('.//hp:ctrl', ns) is not None)
        if has_ctrl_or_field:
            last_cover_idx = idx
    for trailing_p in top_ps[last_cover_idx + 1:]:
        root.remove(trailing_p)

    # 3. Helper to create clean body paragraphs
    def _make_body_p(text, para_pr_id, char_pr_id, vertsize_hu, spacing_hu, page_break=False):
        p_el = ET.Element(HP_P, {
            'id': '0',
            'paraPrIDRef': str(para_pr_id),
            'styleIDRef': '0',
            'pageBreak': '1' if page_break else '0',
            'columnBreak': '0',
            'merged': '0',
        })
        r_el = ET.SubElement(p_el, HP_RUN, {'charPrIDRef': str(char_pr_id)})
        t_el = ET.SubElement(r_el, HP_T)
        t_el.text = text
        lsa = ET.SubElement(p_el, HP_LINESEGA)
        ET.SubElement(lsa, HP_LINESEG, {
            'textpos': '0',
            'vertpos': '0',
            'vertsize': str(vertsize_hu),
            'textheight': str(vertsize_hu),
            'baseline': str(int(vertsize_hu * 0.85)),
            'spacing': str(spacing_hu),
            'horzpos': '0',
            'horzsize': '49608',
            'flags': '393216',
        })
        return p_el

    # 4. Append Page 2+ body elements starting with explicit pageBreak="1"
    first_body_elem = True
    prev_was_spacer = False
    tbl_seq = 1

    for tag, val in body_tokens:
        if tag == 'SPACER':
            if not first_body_elem and not prev_was_spacer:
                root.append(_make_body_p('', styles['ppr_body'], styles['cpr_body'], 800, 320, page_break=False))
                prev_was_spacer = True
            continue

        if tag == 'TABLE':
            if proto_tbl_elem is not None and val:
                tbl_p = build_policy_table_paragraph(proto_tbl_elem, val, styles, tbl_seq, cpr_scale=cpr_scale)
                if first_body_elem:
                    tbl_p.attrib['pageBreak'] = '1'
                    first_body_elem = False
                root.append(tbl_p)
                tbl_seq += 1
                prev_was_spacer = False
            continue

        text = val.strip() if isinstance(val, str) else ''
        if not text:
            continue

        clean_h = re.sub(r'^[󰏚▣■▢❍]\s*', '', text).strip()

        if tag == 'TITLE':
            p_node = _make_body_p(
                f"󰏚 {clean_h}",
                styles['ppr_center'],
                styles['cpr_title'],
                2200,
                1100,
                page_break=first_body_elem,
            )
            root.append(p_node)
            first_body_elem = False
            root.append(_make_body_p('', styles['ppr_body'], styles['cpr_body'], 800, 320, page_break=False))
            prev_was_spacer = True
        elif tag == 'HEADING_1':
            if not first_body_elem and not prev_was_spacer:
                root.append(_make_body_p('', styles['ppr_body'], styles['cpr_body'], 700, 280, page_break=False))
            p_node = _make_body_p(
                f"▢ {clean_h}",
                styles['ppr_body'],
                styles['cpr_h1'],
                1600,
                800,
                page_break=first_body_elem,
            )
            root.append(p_node)
            first_body_elem = False
            prev_was_spacer = False
        elif tag == 'HEADING_2':
            p_node = _make_body_p(
                f"  ❍ {clean_h}",
                styles['ppr_body'],
                styles['cpr_h2'],
                1500,
                750,
                page_break=first_body_elem,
            )
            root.append(p_node)
            first_body_elem = False
            prev_was_spacer = False
        elif tag == 'SUB_ITEM':
            p_node = _make_body_p(
                f"      • {text}",
                styles['ppr_body'],
                styles['cpr_sub'],
                1300,
                580,
                page_break=first_body_elem,
            )
            root.append(p_node)
            first_body_elem = False
            prev_was_spacer = False
        elif tag == 'ITEM':
            if text.startswith('※'):
                p_node = _make_body_p(f"    {text}", styles['ppr_body'], styles['cpr_note'], 1200, 500, page_break=first_body_elem)
            elif text.startswith('•'):
                p_node = _make_body_p(f"      {text}", styles['ppr_body'], styles['cpr_sub'], 1300, 580, page_break=first_body_elem)
            else:
                p_node = _make_body_p(f"    - {text}", styles['ppr_body'], styles['cpr_body'], 1500, 720, page_break=first_body_elem)
            root.append(p_node)
            first_body_elem = False
            prev_was_spacer = False
        elif tag == 'ITEM_BULLET':
            if text.startswith(('▢', '▣')):
                p_node = _make_body_p(f"▢ {clean_h}", styles['ppr_body'], styles['cpr_h1'], 1600, 800, page_break=first_body_elem)
            elif text.startswith('❍'):
                p_node = _make_body_p(f"  ❍ {clean_h}", styles['ppr_body'], styles['cpr_h2'], 1500, 750, page_break=first_body_elem)
            elif text.startswith('•'):
                p_node = _make_body_p(f"      {text}", styles['ppr_body'], styles['cpr_sub'], 1300, 580, page_break=first_body_elem)
            elif text.startswith('※'):
                p_node = _make_body_p(f"    {text}", styles['ppr_body'], styles['cpr_note'], 1200, 500, page_break=first_body_elem)
            else:
                p_node = _make_body_p(f"  {text}", styles['ppr_body'], styles['cpr_body'], 1500, 720, page_break=first_body_elem)
            root.append(p_node)
            first_body_elem = False
            prev_was_spacer = False
        else:
            if text.startswith('※'):
                p_node = _make_body_p(f"    {text}", styles['ppr_body'], styles['cpr_note'], 1200, 500, page_break=first_body_elem)
            elif re.match(r'^\d+\.\s', text):
                p_node = _make_body_p(text, styles['ppr_body'], styles['cpr_h2'], 1500, 750, page_break=first_body_elem)
            elif re.match(r'^[가-하]\.\s', text):
                p_node = _make_body_p(f"  {text}", styles['ppr_body'], styles['cpr_body'], 1500, 720, page_break=first_body_elem)
            elif re.match(r'^\d+\)\s', text):
                p_node = _make_body_p(f"    {text}", styles['ppr_body'], styles['cpr_body'], 1500, 720, page_break=first_body_elem)
            elif re.match(r'^[가-하]\)\s', text):
                p_node = _make_body_p(f"      {text}", styles['ppr_body'], styles['cpr_sub'], 1300, 580, page_break=first_body_elem)
            else:
                p_node = _make_body_p(text, styles['ppr_body'], styles['cpr_body'], 1500, 720, page_break=first_body_elem)
            root.append(p_node)
            first_body_elem = False
            prev_was_spacer = False

    print(
        f"Populated Policy Cover ('{meta['title']}' | Date: {meta['date']} | Dept: {meta['dept']}) "
        f"and generated Page 2+ body ({tbl_seq - 1} inline table(s))."
    )


def build_example_style_table_paragraph(proto_tbl_elem, rows_data, tbl_seq, ppr_right_id, cpr_scale=None, cpr_heights=None, ppr_lspacing=None):
    """
    Build a top-level <hp:p> hosting an authentic Gangnam-gu open-sided public-admin <hp:tbl>
    cloned from `D:\\Desktop\\방침서 예시.hwpx` (`#F2F2F2` + `DOUBLE_SLIM 0.7mm` header `bf=21/22/23`,
    first data row `bf=24/25/26`, middle rows `bf=27/97/28`, bottom `0.4mm` row `bf=33/34/35`).
    """
    num_rows = len(rows_data)
    num_cols = max((len(r) for r in rows_data), default=1)
    total_width = 49108

    col_weights = []
    for c_idx in range(num_cols):
        max_len = max((len(r[c_idx]) if c_idx < len(r) else 2) for r in rows_data)
        col_weights.append(max(4, min(max_len + 2, 38)))
    weight_sum = sum(col_weights) or 1
    min_w = max(3400, total_width // max(num_cols * 3, 4))
    col_widths = [max(min_w, int(total_width * w / weight_sum)) for w in col_weights]
    scale_factor = total_width / float(sum(col_widths))
    col_widths = [int(w * scale_factor) for w in col_widths]
    col_widths[-1] += total_width - sum(col_widths)

    tbl = copy.deepcopy(proto_tbl_elem)
    tbl.attrib['id'] = str(0x74D2FA00 + tbl_seq)
    tbl.attrib['rowCnt'] = str(num_rows)
    tbl.attrib['colCnt'] = str(num_cols)
    tbl.attrib['pageBreak'] = 'CELL'
    tbl.attrib['repeatHeader'] = '1'
    tbl.attrib['borderFillIDRef'] = '97'

    sz_el = tbl.find(f'./{HP_SZ}')
    if sz_el is not None:
        sz_el.attrib['width'] = str(total_width)
    enforce_inline_table_flow(tbl)

    orig_rows = tbl.findall(f'./{HP_TR}')
    proto_tc = copy.deepcopy(orig_rows[0].findall(f'./{HP_TC}')[0])
    for tr in list(orig_rows):
        tbl.remove(tr)

    def _pick_cell_bf(r_idx, c_idx):
        is_left = (c_idx == 0)
        is_right = (c_idx == num_cols - 1)
        if num_cols == 1:
            return '4' if r_idx == 0 else '97'
        if r_idx == 0 and num_rows > 1:
            return '21' if is_left else ('23' if is_right else '22')
        if r_idx == num_rows - 1 and num_rows > 1:
            return '33' if is_left else ('35' if is_right else '34')
        if r_idx == 1 and num_rows > 2:
            return '24' if is_left else ('26' if is_right else '25')
        return '27' if is_left else ('28' if is_right else '97')

    for r_idx, r_vals in enumerate(rows_data):
        tr = ET.Element(HP_TR)
        is_hdr = (r_idx == 0 and num_rows > 1)
        for c_idx in range(num_cols):
            raw_val = r_vals[c_idx] if c_idx < len(r_vals) else ''
            cell_lines = [
                strip_markdown_inline(seg)
                for seg in raw_val.replace('<br/>', '\n').replace('<br>', '\n').split('\n')
            ] if raw_val else ['']

            tc = copy.deepcopy(proto_tc)
            tc.attrib['name'] = ''
            tc.attrib['header'] = '1' if is_hdr else '0'
            tc.attrib['borderFillIDRef'] = _pick_cell_bf(r_idx, c_idx)

            caddr = tc.find(f'./{HP_CELLADDR}')
            if caddr is not None:
                caddr.attrib['colAddr'] = str(c_idx)
                caddr.attrib['rowAddr'] = str(r_idx)
            cspan = tc.find(f'./{HP_CELLSPAN}')
            if cspan is not None:
                cspan.attrib['colSpan'] = '1'
                cspan.attrib['rowSpan'] = '1'
            csz = tc.find(f'./{HP_CELLSZ}')
            if csz is not None:
                csz.attrib['width'] = str(col_widths[c_idx])
                csz.attrib['height'] = '2701' if is_hdr else '2500'
            cmarg = tc.find(f'./{HP_CELLMARGIN}')
            if cmarg is not None:
                cmarg.attrib['left'] = '280'
                cmarg.attrib['right'] = '280'
                cmarg.attrib['top'] = '180'
                cmarg.attrib['bottom'] = '180'

            sublist = tc.find(f'./{HP_SUBLIST}')
            if sublist is not None:
                sublist.attrib['lineWrap'] = 'BREAK'
                sublist.attrib['vertAlign'] = 'CENTER'

            joined_val = ' '.join(cell_lines).strip()
            if is_hdr:
                ppr_id = '23'
                cpr_id = '35'
                vs_hu = 1200
            elif is_numeric_cell_text(joined_val):
                ppr_id = ppr_right_id
                cpr_id = '37'
                vs_hu = 1100
            elif len(joined_val) <= 8 and (c_idx == 0 or c_idx == num_cols - 1):
                ppr_id = '23'
                cpr_id = '37'
                vs_hu = 1100
            else:
                ppr_id = '24'
                cpr_id = '37'
                vs_hu = 1100

            p_container = sublist if sublist is not None else tc
            for old_sp in list(p_container.findall(f'./{HP_P}')):
                p_container.remove(old_sp)

            for line_str in cell_lines:
                sp = ET.Element(HP_P, {
                    'id': '0',
                    'paraPrIDRef': ppr_id,
                    'styleIDRef': '0',
                    'pageBreak': '0',
                    'columnBreak': '0',
                    'merged': '0',
                })
                r_el = ET.SubElement(sp, HP_RUN, {'charPrIDRef': cpr_id})
                t_el = ET.SubElement(r_el, HP_T)
                t_el.text = line_str
                lsa = ET.SubElement(sp, HP_LINESEGA)
                ET.SubElement(lsa, HP_LINESEG, {
                    'textpos': '0',
                    'vertpos': '0',
                    'vertsize': str(vs_hu),
                    'textheight': str(vs_hu),
                    'baseline': str(int(vs_hu * 0.85)),
                    'spacing': str(int(vs_hu * 0.30)),
                    'horzpos': '0',
                    'horzsize': str(max(1200, col_widths[c_idx] - 560)),
                    'flags': '393216',
                })
                p_container.append(sp)

            recalc_tc_linesegs(tc, cpr_scale=cpr_scale, shrink_height=False, cpr_heights=cpr_heights, ppr_lspacing=ppr_lspacing)
            tr.append(tc)
        tbl.append(tr)

    host_p = ET.Element(HP_P, {
        'id': '0',
        'paraPrIDRef': '22',
        'styleIDRef': '0',
        'pageBreak': '0',
        'columnBreak': '0',
        'merged': '0',
    })
    r_host = ET.SubElement(host_p, HP_RUN, {'charPrIDRef': '32'})
    r_host.append(tbl)
    ET.SubElement(r_host, HP_T)
    lsa_host = ET.SubElement(host_p, HP_LINESEGA)
    ET.SubElement(lsa_host, HP_LINESEG, {
        'textpos': '0',
        'vertpos': '0',
        'vertsize': '2701',
        'textheight': '2701',
        'baseline': '2295',
        'spacing': '400',
        'horzpos': '0',
        'horzsize': '49608',
        'flags': '393216',
    })
    sync_table_geometry(host_p, tbl, update_host_lseg=True)
    return host_p


def populate_from_policy_example(root, hdr_root, parsed_md, cpr_scale=None, cli_subtitle=None, cli_date=None, cli_dept=None):
    """
    Populate a new Gangnam-gu Policy Document (`방침서`) by referencing the canonical 3-part
    structure of `D:\\Desktop\\방침서 예시.hwpx`:
      - Page 1: Electronic Approval Cover (`P000`~`P003`: header grid, cover banner, emblem+date, `강 남 구 (부서명)`)
      - Page 2: Mandatory Pre-Review Checklist (`P004`: `【 관련 규정 및 제반사항 사전검토서 】` 9 review items)
      - Page 3+: Canonical Policy Body (`P008` Title Box, `P009` Purpose Summary Box, `P011` Burgundy
        Roman Numeral Badges `Ⅰ`~`Ⅴ`, `▢`->`❍`->`-` typography, open-sided `#F2F2F2` tables, and `  끝.`)
    """
    ns = {'hp': NS_MAP['hp']}
    meta, body_tokens = extract_policy_metadata(
        parsed_md,
        cli_subtitle=cli_subtitle,
        cli_date=cli_date,
        cli_dept=cli_dept,
    )

    # Ensure a right-aligned table cell paraPr exists in header.xml for numeric cells
    ppr_right_id = '67'
    if hdr_root is not None:
        HH_PARAPROPS = f"{{{NS_MAP['hh']}}}paraProperties"
        HH_ALIGN = f"{{{NS_MAP['hh']}}}align"
        pprs = hdr_root.find(f'.//{HH_PARAPROPS}')
        if pprs is not None and len(list(pprs)) > 0:
            proto_p24 = next((p for p in pprs if p.attrib.get('id') == '24'), list(pprs)[-1])
            next_pid = max(int(el.attrib.get('id', '0')) for el in pprs) + 1
            p_right = copy.deepcopy(proto_p24)
            p_right.attrib['id'] = str(next_pid)
            al = p_right.find(f'./{HH_ALIGN}')
            if al is not None:
                al.attrib['horizontal'] = 'RIGHT'
            pprs.append(p_right)
            pprs.attrib['itemCnt'] = str(len(list(pprs)))
            ppr_right_id = str(next_pid)
        cpr_scale.update(extract_charpr_scale(hdr_root))

    cpr_heights = extract_charpr_heights(hdr_root)
    ppr_lspacing = extract_parapr_lspacing(hdr_root)

    top_ps = root.findall('./hp:p', ns)
    fmt_subtitle = ''
    if meta['subtitle']:
        sub_s = meta['subtitle'].strip()
        fmt_subtitle = sub_s if sub_s.startswith(('「', '｢', '[', '(')) else f"「{sub_s}」"

    # Clone prototype body widgets from `방침서 예시.hwpx` BEFORE removing example body paragraphs
    proto_body_title_p = None
    proto_summary_box_p = None
    proto_roman_badge_p = None
    proto_data_tbl = None
    closing_field_end_ctrl = None

    for p in top_ps[5:]:
        tbl = p.find('./hp:run/hp:tbl', ns)
        if tbl is not None:
            rc = tbl.attrib.get('rowCnt')
            cc = tbl.attrib.get('colCnt')
            t_txt = ''.join(tbl.itertext())
            if proto_body_title_p is None and rc == '3' and cc == '1':
                proto_body_title_p = copy.deepcopy(p)
            elif proto_summary_box_p is None and rc == '1' and cc == '1' and ('목적으로' in t_txt or '하고자' in t_txt):
                proto_summary_box_p = copy.deepcopy(p)
            elif proto_roman_badge_p is None and rc == '1' and cc == '3' and 'Ⅰ' in t_txt:
                proto_roman_badge_p = copy.deepcopy(p)
            elif proto_data_tbl is None and int(cc or '0') >= 3 and int(rc or '0') >= 5:
                proto_data_tbl = copy.deepcopy(tbl)
        for ctrl in p.findall('.//hp:ctrl', ns):
            if any(ch.tag.split('}')[-1] == 'fieldEnd' for ch in ctrl):
                closing_field_end_ctrl = copy.deepcopy(ctrl)

    # 1. Update Page 1 Cover (`P000` ~ `P003`)
    if len(top_ps) >= 4:
        # P000: Approval Grid (`TBL[1]`)
        p0_tbls = top_ps[0].findall('./hp:run/hp:tbl', ns)
        if len(p0_tbls) >= 2:
            appr_tbl = p0_tbls[1]
            for tc in appr_tbl.findall('.//hp:tc', ns):
                nm = tc.attrib.get('name', '')
                sub_p = tc.find('./hp:subList/hp:p', ns)
                if sub_p is None:
                    continue
                if nm == '시행번호':
                    set_p_text(sub_p, meta['doc_no'], char_pr_id='130')
                elif nm == '@검토5':
                    set_p_text(sub_p, '', char_pr_id='89')
                elif nm == '등록일자':
                    set_p_text(sub_p, meta['date'], char_pr_id='130')
                elif nm == '시행일자':
                    set_p_text(sub_p, meta['approval_date'], char_pr_id='130')
                elif nm == '공개여부':
                    set_p_text(sub_p, meta['disclosure'], char_pr_id='130')
                elif nm.startswith('*협조'):
                    m_idx = re.match(r'^\*협조(\d+)$', nm)
                    slot_num = int(m_idx.group(1)) if m_idx else 99
                    coop_val = meta['coop_depts'][slot_num - 1] if 1 <= slot_num <= len(meta['coop_depts']) else ''
                    set_p_text(sub_p, coop_val, char_pr_id='134')

        # P001: Cover Title Box (`tc[@name="제목"]` + inner 3x1 banner)
        title_tc = top_ps[1].find('.//hp:tc[@name="제목"]', ns)
        if title_tc is not None:
            outer_ps = title_tc.findall('./hp:subList/hp:p', ns)
            if outer_ps:
                idx_title = f"{fmt_subtitle} {meta['title']}".strip()
                set_p_text(outer_ps[0], idx_title, char_pr_id='81')
            inner_tbl = title_tc.find('.//hp:tbl', ns)
            if inner_tbl is not None:
                in_rows = inner_tbl.findall('./hp:tr', ns)
                if len(in_rows) >= 2:
                    mid_tc = in_rows[1].find('./hp:tc', ns)
                    if mid_tc is not None:
                        mid_sub = mid_tc.find('./hp:subList', ns)
                        mid_ps = mid_sub.findall('./hp:p', ns) if mid_sub is not None else []
                        if fmt_subtitle and len(mid_ps) >= 2:
                            set_p_text(mid_ps[0], fmt_subtitle, char_pr_id='18')
                            set_p_text(mid_ps[1], meta['title'], char_pr_id='19')
                        elif mid_ps:
                            keep_p = mid_ps[-1]
                            for extra_p in mid_ps[:-1]:
                                mid_sub.remove(extra_p)
                            set_p_text(keep_p, meta['title'], char_pr_id='19')

        # P002: District Emblem (`image1.png`) + Cover Year/Month Date (`25,586` HWPUnits)
        p2_tbl = top_ps[2].find('./hp:run/hp:tbl', ns)
        if p2_tbl is not None:
            p2_sz = p2_tbl.find('./hp:sz', ns)
            orig_p2_h = int(p2_sz.attrib.get('height', '25586')) if p2_sz is not None else 25586
            p2_tc = p2_tbl.find('./hp:tr/hp:tc', ns)
            if p2_tc is not None:
                p2_csz = p2_tc.find('./hp:cellSz', ns)
                if p2_csz is not None:
                    p2_csz.attrib['height'] = str(max(int(p2_csz.attrib.get('height', '0')), orig_p2_h))
                p2_ps = p2_tc.findall('./hp:subList/hp:p', ns)
                if p2_ps:
                    set_p_text(p2_ps[-1], meta['cover_date'], char_pr_id='83')

        # P003: Agency & Department Footer (`강   남   구` / `(보건행정과)`)
        p3_tbl = top_ps[3].find('./hp:run/hp:tbl', ns)
        if p3_tbl is not None:
            p3_rows = p3_tbl.findall('./hp:tr', ns)
            if len(p3_rows) >= 2:
                for tc in p3_rows[1].findall('./hp:tc', ns):
                    caddr = tc.find('./hp:cellAddr', ns)
                    if caddr is not None and caddr.attrib.get('colAddr') == '2':
                        sub_p = tc.find('./hp:subList/hp:p', ns)
                        if sub_p is not None:
                            dept_clean = meta['dept'].strip('() ')
                            set_p_text(sub_p, f"({dept_clean})", char_pr_id='85')

    # 2. Update Page 2 Pre-Review Checklist (`P004`: `【 관련 규정 및 제반사항 사전검토서 】`)
    if len(top_ps) >= 5:
        p4_tbl = top_ps[4].find('./hp:run/hp:tbl', ns)
        if p4_tbl is not None:
            enforce_inline_table_flow(p4_tbl)
            p4_rows = p4_tbl.findall('./hp:tr', ns)

            def _find_p4_cell(row_idx, col_addr):
                if row_idx >= len(p4_rows):
                    return None
                for tc in p4_rows[row_idx].findall('./hp:tc', ns):
                    ca = tc.find('./hp:cellAddr', ns)
                    if ca is not None and ca.attrib.get('colAddr') == str(col_addr):
                        return tc
                return None

            def _set_p4_answer(row_idx, bullet_lines):
                tc = _find_p4_cell(row_idx, 1)
                if tc is None:
                    return
                formatted = [
                    ln if ln.lstrip().startswith('•') else f"• {ln.strip()}"
                    for ln in bullet_lines if ln and ln.strip()
                ] or ['• 해당사항 없음']
                set_tc_lines(tc, formatted, cpr_scale=cpr_scale, shrink_height=False)

            _set_p4_answer(3, meta['legal_basis'])
            _set_p4_answer(5, [meta['election_law']])
            _set_p4_answer(7, [meta['background']])
            _set_p4_answer(9, [meta['budget_note']])
            _set_p4_answer(11, [meta['beneficiary']])
            _set_p4_answer(13, [meta['conflict_note']])
            _set_p4_answer(15, [meta['field_review']])
            _set_p4_answer(17, [meta['other_cases']])
            _set_p4_answer(19, [meta['expert_review']])

            # Update `[계속 : ] / [신규 : ]` marker in R14 Col 0 if `사업유형` is specified
            tc_r14_c0 = _find_p4_cell(14, 0)
            if tc_r14_c0 is not None and meta['project_type']:
                is_new = ('신규' in meta['project_type'])
                is_cont = ('계속' in meta['project_type'])
                r14_ps = tc_r14_c0.findall('./hp:subList/hp:p', ns)
                for sp in r14_ps:
                    sp_t = extract_p_text(sp)
                    if '계속' in sp_t:
                        set_p_text(sp, f"[계속 : {'○' if is_cont else '  '} ]", char_pr_id='113')
                    elif '신규' in sp_t:
                        set_p_text(sp, f"[신규 : {'○' if is_new else '  '} ]", char_pr_id='114')

            # Update `① 관련부서 협조` check mark in R14 Col 1
            tc_r14_c1 = _find_p4_cell(14, 1)
            if tc_r14_c1 is not None:
                has_coop = bool(meta['coop_depts'])
                for sp in tc_r14_c1.findall('./hp:subList/hp:p', ns):
                    sp_t = extract_p_text(sp)
                    if '관련부서 협조' in sp_t:
                        mark = ' ○ ' if has_coop else '    '
                        updated_line = re.sub(r'\(\s*○?\s*\)', f'({mark})', sp_t)
                        set_p_text(sp, updated_line)

            # Page-2 Fit Guard: ensure P004 total height stays <= 69,800 HWPUnits so it never spills onto Page 3
            sync_table_geometry(top_ps[4], p4_tbl, update_host_lseg=True)
            p4_sz = p4_tbl.find('./hp:sz', ns)
            cur_p4_h = int(p4_sz.attrib.get('height', '0')) if p4_sz is not None else 0
            target_max_p4_h = 69800
            if cur_p4_h > target_max_p4_h:
                excess = cur_p4_h - target_max_p4_h
                for shrink_r in (5, 13, 15, 17, 19, 7, 9, 11):
                    if excess <= 0:
                        break
                    ans_tc = _find_p4_cell(shrink_r, 1)
                    if ans_tc is None:
                        continue
                    ans_csz = ans_tc.find('./hp:cellSz', ns)
                    if ans_csz is None:
                        continue
                    old_h = int(ans_csz.attrib.get('height', '0'))
                    # Compute minimum required content height (linesegs + margins)
                    lsegs = ans_tc.findall('.//hp:lineseg', ns)
                    content_h = sum(int(ls.attrib.get('vertsize', '1000')) + int(ls.attrib.get('spacing', '300')) for ls in lsegs)
                    min_h = max(1800, content_h + 450)
                    reducible = max(0, old_h - min_h)
                    if reducible > 0:
                        cut = min(excess, reducible)
                        ans_csz.attrib['height'] = str(old_h - cut)
                        # Also adjust paired merged left label cell (row shrink_r - 1, col 0)
                        lbl_tc = _find_p4_cell(shrink_r - 1, 0)
                        if lbl_tc is not None:
                            lbl_csz = lbl_tc.find('./hp:cellSz', ns)
                            if lbl_csz is not None:
                                lbl_csz.attrib['height'] = str(max(2000, int(lbl_csz.attrib.get('height', '0')) - cut))
                        excess -= cut
                sync_table_geometry(top_ps[4], p4_tbl, update_host_lseg=True)

    # 3. Remove all example festival body paragraphs (`P005` onwards) while keeping `P000`~`P004`
    for old_p in top_ps[5:]:
        root.remove(old_p)

    # Helper builders for Page 3+ canonical Gangnam-gu policy body
    def _make_example_p(runs_spec, para_pr_id, vertsize_hu, spacing_hu, page_break=False):
        p_el = ET.Element(HP_P, {
            'id': '0',
            'paraPrIDRef': str(para_pr_id),
            'styleIDRef': '0',
            'pageBreak': '1' if page_break else '0',
            'columnBreak': '0',
            'merged': '0',
        })
        for cpr_id, run_text in runs_spec:
            r_el = ET.SubElement(p_el, HP_RUN, {'charPrIDRef': str(cpr_id)})
            t_el = ET.SubElement(r_el, HP_T)
            t_el.text = run_text
        lsa = ET.SubElement(p_el, HP_LINESEGA)
        ET.SubElement(lsa, HP_LINESEG, {
            'textpos': '0',
            'vertpos': '0',
            'vertsize': str(vertsize_hu),
            'textheight': str(vertsize_hu),
            'baseline': str(int(vertsize_hu * 0.85)),
            'spacing': str(spacing_hu),
            'horzpos': '0',
            'horzsize': '49608',
            'flags': '393216',
        })
        return p_el

    def _make_roman_section_badge(roman_idx, title_str, page_break=False):
        roman_label = ROMAN_NUMERALS[roman_idx] if roman_idx < len(ROMAN_NUMERALS) else str(roman_idx + 1)
        clean_sec = strip_section_prefix(title_str)
        if proto_roman_badge_p is None:
            return _make_example_p([('28', f" {roman_label}. {clean_sec}")], '18', 1800, 900, page_break=page_break)
        badge_p = copy.deepcopy(proto_roman_badge_p)
        badge_p.attrib['pageBreak'] = '1' if page_break else '0'
        b_tbl = badge_p.find('./hp:run/hp:tbl', ns)
        if b_tbl is not None:
            b_tbl.attrib['id'] = str(0x74D2FB00 + roman_idx)
            enforce_inline_table_flow(b_tbl)
            tcs = b_tbl.findall('./hp:tr/hp:tc', ns)
            if len(tcs) >= 3:
                sp0 = tcs[0].find('./hp:subList/hp:p', ns)
                if sp0 is not None:
                    set_p_text(sp0, roman_label, char_pr_id='25')
                sp2 = tcs[2].find('./hp:subList/hp:p', ns)
                if sp2 is not None:
                    set_p_text(sp2, clean_sec, char_pr_id='27')
                # Dynamically widen Col 2 so titles stay on a single line (body table width 49,108 -> max col2 44,800)
                col2_w = max(13667, min(44800, len(clean_sec) * 2150 + 3000))
                csz2 = tcs[2].find('./hp:cellSz', ns)
                if csz2 is not None:
                    csz2.attrib['width'] = str(col2_w)
                bsz = b_tbl.find('./hp:sz', ns)
                if bsz is not None:
                    bsz.attrib['width'] = str(3407 + 835 + col2_w)
                for tc in tcs:
                    recalc_tc_linesegs(tc, cpr_scale=cpr_scale, shrink_height=False, cpr_heights=cpr_heights, ppr_lspacing=ppr_lspacing)
                sync_table_geometry(badge_p, b_tbl, update_host_lseg=True)
        return badge_p

    # 4. Emit Page 3 Top Banner (`P008` with `pageBreak="1"`) & Executive Summary Box (`P009`)
    body_started = False
    if proto_body_title_p is not None and meta['title']:
        bt_p = copy.deepcopy(proto_body_title_p)
        bt_p.attrib['pageBreak'] = '1'
        bt_tbl = bt_p.find('./hp:run/hp:tbl', ns)
        if bt_tbl is not None:
            bt_tbl.attrib['id'] = str(0x74D2FB80)
            enforce_inline_table_flow(bt_tbl)
            bt_rows = bt_tbl.findall('./hp:tr', ns)
            if len(bt_rows) >= 2:
                mid_tc = bt_rows[1].find('./hp:tc', ns)
                if mid_tc is not None:
                    mid_sub = mid_tc.find('./hp:subList', ns)
                    mid_ps = mid_sub.findall('./hp:p', ns) if mid_sub is not None else []
                    if fmt_subtitle and len(mid_ps) >= 2:
                        set_p_text(mid_ps[0], fmt_subtitle, char_pr_id='18')
                        set_p_text(mid_ps[1], meta['title'], char_pr_id='19')
                    elif mid_ps:
                        keep_p = mid_ps[-1]
                        for extra_p in mid_ps[:-1]:
                            mid_sub.remove(extra_p)
                        set_p_text(keep_p, meta['title'], char_pr_id='19')
            for tc in bt_tbl.findall('.//hp:tc', ns):
                recalc_tc_linesegs(tc, cpr_scale=cpr_scale, shrink_height=False, cpr_heights=cpr_heights, ppr_lspacing=ppr_lspacing)
            sync_table_geometry(bt_p, bt_tbl, update_host_lseg=True)
        root.append(bt_p)
        body_started = True

    if proto_summary_box_p is not None and meta['purpose']:
        sum_p = copy.deepcopy(proto_summary_box_p)
        sum_p.attrib['pageBreak'] = '0' if body_started else '1'
        sum_tbl = sum_p.find('./hp:run/hp:tbl', ns)
        if sum_tbl is not None:
            sum_tbl.attrib['id'] = str(0x74D2FB81)
            enforce_inline_table_flow(sum_tbl)
            sum_tc = sum_tbl.find('./hp:tr/hp:tc', ns)
            if sum_tc is not None:
                sum_sp = sum_tc.find('./hp:subList/hp:p', ns)
                if sum_sp is not None:
                    for old_ctrl_r in list(sum_sp.findall('./hp:run', ns)):
                        if old_ctrl_r.find('./hp:ctrl', ns) is not None:
                            sum_sp.remove(old_ctrl_r)
                    set_p_text(sum_sp, f" {meta['purpose'].strip()}", char_pr_id='22')
                recalc_tc_linesegs(sum_tc, cpr_scale=cpr_scale, shrink_height=False, cpr_heights=cpr_heights, ppr_lspacing=ppr_lspacing)
                sync_table_geometry(sum_p, sum_tbl, update_host_lseg=True)
        root.append(sum_p)
        root.append(_make_example_p([('24', '')], '15', 700, 280, page_break=False))
        body_started = True
        init_spacer = True
    else:
        init_spacer = False

    # 5. Emit Body Sections, Bullets, and Tables
    roman_seq = 0
    tbl_seq = 1
    prev_was_spacer = init_spacer
    has_explicit_end = False

    for tag, val in body_tokens:
        if tag == 'TITLE':
            # Already rendered in Cover (`P001`) and Page 3 Title Banner (`P008`)
            continue

        if tag == 'SPACER':
            if body_started and not prev_was_spacer:
                root.append(_make_example_p([('32', '')], '20', 700, 280, page_break=False))
                prev_was_spacer = True
            continue

        if tag == 'TABLE':
            if proto_data_tbl is not None and val:
                tbl_p = build_example_style_table_paragraph(
                    proto_data_tbl,
                    val,
                    tbl_seq,
                    ppr_right_id=ppr_right_id,
                    cpr_scale=cpr_scale,
                    cpr_heights=cpr_heights,
                    ppr_lspacing=ppr_lspacing,
                )
                if not body_started:
                    tbl_p.attrib['pageBreak'] = '1'
                    body_started = True
                root.append(tbl_p)
                tbl_seq += 1
                prev_was_spacer = False
            continue

        text = val.strip() if isinstance(val, str) else ''
        if not text:
            continue

        if text.endswith('끝.'):
            has_explicit_end = True

        if tag == 'HEADING_1':
            if body_started and not prev_was_spacer:
                root.append(_make_example_p([('32', '')], '20', 600, 240, page_break=False))
            badge_node = _make_roman_section_badge(roman_seq, text, page_break=(not body_started))
            root.append(badge_node)
            roman_seq += 1
            body_started = True
            prev_was_spacer = False
        elif tag == 'HEADING_2' or (tag == 'ITEM_BULLET' and text.startswith(('▢', '▣'))):
            clean_h2 = re.sub(r'^[󰏚▣■▢❍]+\s*', '', text).strip()
            p_node = _make_example_p([('32', f" ▢ {clean_h2}")], '18', 1500, 750, page_break=(not body_started))
            root.append(p_node)
            body_started = True
            prev_was_spacer = False
        elif tag == 'SUB_ITEM' or (tag in ('ITEM', 'ITEM_BULLET') and text.startswith('•')):
            clean_sub = re.sub(r'^[•\-]\s*', '', text).strip()
            p_node = _make_example_p([('4', f"    - {clean_sub}")], '2', 1200, 480, page_break=(not body_started))
            root.append(p_node)
            body_started = True
            prev_was_spacer = False
        elif text.startswith('※'):
            p_node = _make_example_p([('31', f"    {text}")], '2', 1300, 520, page_break=(not body_started))
            root.append(p_node)
            body_started = True
            prev_was_spacer = False
        elif tag in ('ITEM', 'ITEM_BULLET'):
            clean_it = re.sub(r'^[❍▪•\-]\s*', '', text).strip()
            m_lead = re.match(r'^(\([^)]+\))\s*(.*)$', clean_it)
            if m_lead:
                runs_spec = [('56', '   ❍ '), ('60', m_lead.group(1)), ('56', f" {m_lead.group(2)}")]
            else:
                runs_spec = [('56', f"   ❍ {clean_it}")]
            p_node = _make_example_p(runs_spec, '28', 1400, 700, page_break=(not body_started))
            root.append(p_node)
            body_started = True
            prev_was_spacer = False
        else:
            p_node = _make_example_p([('56', f"  {text}")], '18', 1400, 700, page_break=(not body_started))
            root.append(p_node)
            body_started = True
            prev_was_spacer = False

    # 6. Append Closing `끝.` with balanced `fieldEnd` matching Page 2 `P004`'s `CLICK_HERE` field
    end_text = '' if has_explicit_end else '  끝.'
    end_p = _make_example_p([('55', end_text)], '44', 1500, 600, page_break=False)
    if closing_field_end_ctrl is not None:
        r_ctrl = ET.Element(HP_RUN, {'charPrIDRef': '135'})
        r_ctrl.append(closing_field_end_ctrl)
        end_p.append(r_ctrl)
        ensure_linesegarray_last(end_p)
    root.append(end_p)

    print(
        f"Populated Policy Document from '방침서 예시.hwpx' ('{meta['title']}' | Date: {meta['date']} | Dept: {meta['dept']}) — "
        f"Page 1 Cover + Page 2 Pre-Review Checklist + Page 3+ Body ({roman_seq} Roman sections, {tbl_seq - 1} table(s))."
    )


def prune_unreferenced_bindata(temp_dir, xml_roots):
    """
    Inspect `Contents/content.hpf` and all active XML trees (`section*.xml`, `header.xml`).
    Any embedded `BinData/image*` item NOT referenced by `<hc:img binaryItemIDRef="..."/>`
    is pruned from `Contents/content.hpf` and returned in `removed_zip_entries` so example-only
    illustrations (e.g., Yangjaecheon festival photos in `방침서 예시.hwpx`) are never leaked into new policies.
    """
    referenced_ids = set()
    for xroot in xml_roots:
        if xroot is None:
            continue
        for el in xroot.iter():
            if el.tag.split('}')[-1] == 'img':
                bid = el.attrib.get('binaryItemIDRef')
                if bid:
                    referenced_ids.add(bid)

    hpf_path = os.path.join(temp_dir, 'Contents', 'content.hpf')
    removed_entries = set()
    updated_hpf_bytes = None
    if not os.path.exists(hpf_path):
        return removed_entries, updated_hpf_bytes

    with open(hpf_path, 'rb') as f:
        raw_hpf = f.read().decode('utf-8')

    def _filter_item(match):
        tag_str = match.group(0)
        m_id = re.search(r'\bid="([^"]+)"', tag_str)
        m_href = re.search(r'\bhref="([^"]+)"', tag_str)
        if m_id and m_href and m_href.group(1).startswith('BinData/'):
            item_id = m_id.group(1)
            href_val = m_href.group(1)
            if item_id not in referenced_ids:
                removed_entries.add(href_val)
                return ''
        return tag_str

    new_hpf = re.sub(r'\s*<opf:item\b[^>]*/\s*>', _filter_item, raw_hpf)
    if removed_entries:
        updated_hpf_bytes = new_hpf.encode('utf-8')
        with open(hpf_path, 'wb') as f:
            f.write(updated_hpf_bytes)
    return removed_entries, updated_hpf_bytes


def build_new_hwpx(template_path, output_path, md_path, subtitle=None, doc_date=None, dept=None):
    assert_non_destructive_paths(template_path, output_path)
    out_parent = os.path.dirname(os.path.abspath(output_path))
    if out_parent:
        os.makedirs(out_parent, exist_ok=True)
    temp_dir = tempfile.mkdtemp(prefix="vital_hwpx_build_")

    try:
        # 1. Copy template files to temp directory
        with zipfile.ZipFile(template_path, 'r') as z:
            z.extractall(temp_dir)
            names = z.namelist()
            orig_s0_bytes = z.read('Contents/section0.xml')
            orig_hdr_bytes = z.read('Contents/header.xml') if 'Contents/header.xml' in names else None
            extra_sec_names = sorted(
                n for n in names
                if n.startswith('Contents/section') and n.endswith('.xml') and n != 'Contents/section0.xml'
            )
            orig_extra_sec_bytes = {n: z.read(n) for n in extra_sec_names}
        print("Successfully extracted template HWPX.")

        header_xml_path = os.path.join(temp_dir, "Contents", "header.xml")
        hdr_root = None
        cpr_scale = {}
        if orig_hdr_bytes is not None and os.path.exists(header_xml_path):
            hdr_tree = ET.parse(header_xml_path)
            hdr_root = hdr_tree.getroot()
            normalize_header_styles(hdr_root)
            cpr_scale = extract_charpr_scale(hdr_root)

        bad_ppr_ids, bad_style_ids, replacement_ppr_id = get_excel_defective_ids(hdr_root)

        section_xml_path = os.path.join(temp_dir, "Contents", "section0.xml")
        tree = ET.parse(section_xml_path)
        root = tree.getroot()

        ns = {
            'hp': NS_MAP['hp'],
            'hs': NS_MAP['hs'],
            'hc': NS_MAP['hc'],
            'hh': NS_MAP['hh'],
        }

        # Build parent map for checking table cells and control ancestors
        parent_map = {c: p for p in root.iter() for c in p}

        def is_p_in_table(p_node):
            curr = p_node
            while curr in parent_map:
                curr = parent_map[curr]
                tag_local = curr.tag.split('}')[-1]
                if tag_local in ('tc', 'tbl', 'subList', 'box', 'rect', 'container', 'picture', 'pic', 'shape', 'header', 'footer'):
                    return True
            return False

        def find_host_paragraph(elem):
            curr = elem
            while curr in parent_map:
                curr = parent_map[curr]
                if curr.tag == HP_P:
                    return curr
            return None

        # 2. Extract paragraph style templates
        p_elements = root.findall('.//hp:p', ns)
        if not p_elements:
            print("Error: No paragraph elements found in template section0.xml.")
            return False

        # Parse Markdown
        parsed_md = parse_markdown(md_path)

        used_policy_example = False
        if is_policy_example_template(root, ns):
            used_policy_example = True
            populate_from_policy_example(
                root,
                hdr_root,
                parsed_md,
                cpr_scale=cpr_scale,
                cli_subtitle=subtitle,
                cli_date=doc_date,
                cli_dept=dept,
            )
        elif is_policy_cover_template(root, ns):
            populate_policy_cover_and_body(
                root,
                hdr_root,
                parsed_md,
                cpr_scale=cpr_scale,
                cli_subtitle=subtitle,
                cli_date=doc_date,
                cli_dept=dept,
            )
        else:
            # 3. Find and update tables in the template with markdown data
            tbl_elements = root.findall('.//hp:tbl', ns)
            table_tokens = [token for token in parsed_md if token[0] == 'TABLE']

            if table_tokens:
                md_table_data = table_tokens[0][1]  # use the first table in markdown

                # Determine start index of data rows in markdown (skip headers)
                md_start_row = 0
                if len(md_table_data) > 0:
                    first_row = md_table_data[0]
                    if any(k in "".join(first_row) for k in ["장비명", "품명", "연번", "구분", "항목", "사업명", "내용"]):
                        md_start_row = 1

                md_rows = md_table_data[md_start_row:]

                for i, tbl in enumerate(tbl_elements):
                    col_cnt = int(tbl.attrib.get('colCnt', 0))
                    if col_cnt < 5:
                        continue

                    rows = tbl.findall('hp:tr', ns)
                    if not rows:
                        continue

                    # Check headers
                    first_row = rows[0]
                    cells = first_row.findall('hp:tc', ns)
                    headers = []
                    for cell in cells:
                        cell_text = "".join(t.text for t in cell.findall('.//hp:t', ns) if t.text).strip()
                        headers.append(cell_text)

                    is_target = any("장비명" in h or "구성 사양" in h for h in headers)
                    if not is_target:
                        continue

                    print(f"Populating Table {i+1} with headers: {headers}")

                    # Build column mapping keyed by colAddr across any colSpan
                    col_map = {}
                    for c_idx, cell in enumerate(cells):
                        addr = cell.find('hp:cellAddr', ns)
                        cspan = cell.find('hp:cellSpan', ns)
                        col_start = int(addr.attrib.get('colAddr', str(c_idx))) if addr is not None else c_idx
                        col_span = int(cspan.attrib.get('colSpan', '1')) if cspan is not None else 1
                        h = headers[c_idx]
                        mapped_idx = None
                        if "연번" in h:
                            mapped_idx = 0
                        elif "장비명" in h or "품명" in h:
                            mapped_idx = 1
                        elif "항목" in h or "특징" in h:
                            mapped_idx = 2
                        elif "단가" in h or "금액" in h:
                            mapped_idx = 3
                        elif "비고" in h:
                            mapped_idx = 4
                        for c_addr in range(col_start, col_start + col_span):
                            col_map[c_addr] = mapped_idx

                    data_rows = rows[1:]
                    total_data_rows = max(len(md_rows), len(data_rows))
                    if len(data_rows) > 0:
                        last_row_cols = len(data_rows[-1].findall('hp:tc', ns))
                        first_row_cols = len(data_rows[0].findall('hp:tc', ns))
                        for cell0 in data_rows[0].findall('hp:tc', ns):
                            cspan0 = cell0.find('hp:cellSpan', ns)
                            if cspan0 is not None and int(cspan0.attrib.get('rowSpan', '1')) > 1 and last_row_cols < first_row_cols:
                                cspan0.attrib['rowSpan'] = str(total_data_rows)

                    # In-place update existing rows or append if we have more rows than template
                    for r_offset, row_data in enumerate(md_rows):
                        if r_offset < len(data_rows):
                            curr_row = data_rows[r_offset]
                        else:
                            curr_row = copy.deepcopy(data_rows[-1])
                            for cell in curr_row.findall('hp:tc', ns):
                                addr = cell.find('hp:cellAddr', ns)
                                if addr is not None:
                                    addr.attrib['rowAddr'] = str(1 + r_offset)
                                cspan = cell.find('hp:cellSpan', ns)
                                if cspan is not None and int(cspan.attrib.get('rowSpan', '1')) > 1:
                                    cspan.attrib['rowSpan'] = '1'
                            tbl.append(curr_row)

                        new_cells = curr_row.findall('hp:tc', ns)
                        for c_idx, cell in enumerate(new_cells):
                            addr = cell.find('hp:cellAddr', ns)
                            col_key = int(addr.attrib.get('colAddr', str(c_idx))) if addr is not None else c_idx
                            if col_key not in col_map or col_map[col_key] is None:
                                continue

                            md_col_idx = col_map[col_key]
                            if md_col_idx >= len(row_data):
                                continue
                            val = row_data[md_col_idx]
                            cell_lines = [seg.strip() for seg in val.replace('<br/>', '\n').replace('<br>', '\n').split('\n')] if val else ['']
                            set_tc_lines(cell, cell_lines, cpr_scale=cpr_scale, shrink_height=True)

                    # If there are surplus rows in the template, empty them instead of deleting
                    if len(md_rows) < len(data_rows):
                        for r_offset in range(len(md_rows), len(data_rows)):
                            surplus_row = data_rows[r_offset]
                            for c_idx, cell in enumerate(surplus_row.findall('hp:tc', ns)):
                                addr = cell.find('hp:cellAddr', ns)
                                col_key = int(addr.attrib.get('colAddr', str(c_idx))) if addr is not None else c_idx
                                if col_key not in col_map or col_map[col_key] is None:
                                    continue
                                set_tc_lines(cell, [''], cpr_scale=cpr_scale, shrink_height=True)

                    # Recalculate linesegs on all cells of the populated table, enforce inline flow, and sync geometry
                    reindex_table_rows(tbl)
                    enforce_inline_table_flow(tbl)
                    for tr in tbl.findall('hp:tr', ns):
                        for tc in tr.findall('hp:tc', ns):
                            recalc_tc_linesegs(
                                tc,
                                cpr_scale=cpr_scale,
                                shrink_height=True,
                                bad_ppr_ids=bad_ppr_ids,
                                bad_style_ids=bad_style_ids,
                                replacement_ppr_id=replacement_ppr_id,
                            )
                    host_p = find_host_paragraph(tbl)
                    sync_table_geometry(host_p, tbl, update_host_lseg=True)
                    print(f"Successfully populated and synchronized geometry for Table {i+1}.")

            # 4. Filter out direct plain text paragraphs (not inside tables/controls and does not contain control shapes)
            parent_map = {c: p for p in root.iter() for c in p}
            direct_p_nodes = []
            for p in root.findall('.//hp:p', ns):
                if not is_p_in_table(p) and not has_ctrl_objects(p, ns):
                    direct_p_nodes.append(p)

            # 5. Extract normal paragraphs to create from markdown (excluding TABLE and SPACER)
            text_tokens = [t for t in parsed_md if t[0] not in ['TABLE', 'SPACER', 'META_CANDIDATE'] and t[1].strip()]

            num_existing = len(direct_p_nodes)
            num_new = len(text_tokens)

            print(f"Template has {num_existing} direct plain text paragraphs. Markdown has {num_new} valid text paragraphs.")

            # 6. Update paragraph text in-place while maintaining clean single-run structure
            for idx in range(num_existing):
                old_p = direct_p_nodes[idx]
                if idx < num_new:
                    tag, text = text_tokens[idx]

                    clean_heading = re.sub(r'^[▣■]\s*', '', text)
                    if tag == 'TITLE':
                        formatted_text = clean_heading if clean_heading.startswith('󰏚') else f"󰏚 {clean_heading}"
                    elif tag == 'HEADING_1':
                        formatted_text = clean_heading if clean_heading.startswith(('󰏚', '▢')) else f"▢ {clean_heading}"
                    elif tag == 'HEADING_2':
                        formatted_text = clean_heading if clean_heading.startswith(('󰏚', '▢', '❍')) else f"❍ {clean_heading}"
                    elif tag == 'SUB_ITEM':
                        formatted_text = f"    • {text}"
                    elif tag == 'ITEM':
                        formatted_text = f"  - {text}"
                    elif tag == 'ITEM_BULLET':
                        formatted_text = f"  {text}"
                    else:
                        formatted_text = text

                    update_paragraph_text(old_p, formatted_text, ns)
                else:
                    update_paragraph_text(old_p, "", ns)

        # 7. Heal all tables bottom-up (innermost nested tables to outer tables) and recalculate section layout
        recalc_cells = heal_section_tables_and_layout(root, cpr_scale=cpr_scale, hdr_elem=hdr_root)
        if recalc_cells > 0:
            print(f"Recalculated linesegarray and synchronized geometry on {recalc_cells} additional table cells.")

        # Also heal any additional section*.xml files in multi-section HWPX archives
        extra_sec_paths = {}
        extra_roots = []
        for sec_rel_name, orig_sec_bytes in orig_extra_sec_bytes.items():
            sec_disk_path = os.path.join(temp_dir, *sec_rel_name.split('/'))
            if os.path.exists(sec_disk_path):
                extra_tree = ET.parse(sec_disk_path)
                extra_root = extra_tree.getroot()
                extra_roots.append(extra_root)
                heal_section_tables_and_layout(extra_root, cpr_scale=cpr_scale, hdr_elem=hdr_root)
                preserve_xml_header_and_save(orig_sec_bytes, extra_root, sec_disk_path, root_tag_prefix='<hs:sec')
                extra_sec_paths[sec_rel_name] = sec_disk_path

        removed_bindata, updated_hpf_bytes = (set(), None)
        if used_policy_example:
            removed_bindata, updated_hpf_bytes = prune_unreferenced_bindata(
                temp_dir, [root, hdr_root] + extra_roots
            )

        # 8. Save XMLs preserving original XML declarations & root namespace headers
        if hdr_root is not None and orig_hdr_bytes is not None:
            preserve_xml_header_and_save(orig_hdr_bytes, hdr_root, header_xml_path, root_tag_prefix='<hh:head')

        preserve_xml_header_and_save(orig_s0_bytes, root, section_xml_path, root_tag_prefix='<hs:sec')
        print("Successfully restored original XML declaration and namespace prefixes.")

        if os.path.exists(output_path):
            os.remove(output_path)

        # Synthesize fresh Preview/PrvText.txt from updated section0.xml so no stale template preview text leaks
        prv_lines = []
        for p_el in root.findall('./hp:p', ns):
            t_vals = [t.text.strip() for t in p_el.findall('.//hp:t', ns) if t.text and t.text.strip()]
            if t_vals:
                prv_lines.append(' '.join(t_vals))
        fresh_prv_bytes = ('\r\n'.join(prv_lines)[:2048]).encode('utf-8')

        # 9. Pack ZIP archive preserving 100% of the original metadata
        with zipfile.ZipFile(template_path, 'r') as z_in:
            with zipfile.ZipFile(output_path, 'w') as z_out:
                for info in z_in.infolist():
                    if info.filename in removed_bindata:
                        continue
                    if info.filename == "Contents/content.hpf" and updated_hpf_bytes is not None:
                        info.file_size = len(updated_hpf_bytes)
                        z_out.writestr(info, updated_hpf_bytes)
                    elif info.filename == "Preview/PrvText.txt":
                        info.file_size = len(fresh_prv_bytes)
                        z_out.writestr(info, fresh_prv_bytes)
                    elif info.filename == "Contents/header.xml" and hdr_root is not None:
                        with open(header_xml_path, 'rb') as f:
                            hdr_data = f.read()
                        info.file_size = len(hdr_data)
                        z_out.writestr(info, hdr_data)
                    elif info.filename == "Contents/section0.xml":
                        with open(section_xml_path, 'rb') as f:
                            xml_data = f.read()
                        info.file_size = len(xml_data)
                        z_out.writestr(info, xml_data)
                    elif info.filename in extra_sec_paths:
                        with open(extra_sec_paths[info.filename], 'rb') as f:
                            xml_data = f.read()
                        info.file_size = len(xml_data)
                        z_out.writestr(info, xml_data)
                    else:
                        file_data = z_in.read(info.filename)
                        z_out.writestr(info, file_data)

        # 10. Patch flag_bits in the ZIP file for DEFLATED files (Bit 2 = Fast Deflating = 4)
        patch_zip_flags(output_path)

        # 11. Run 5-pillar anti-overlap verification gatekeeper
        metrics = verify_hwpx_no_overlap(output_path)
        print(f"Verified 0 overlap defects: {metrics}")
        print(f"Successfully built HWPX with 100% identical ZIP headers at: {output_path}")
        return True

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error during HWPX document generation: {e}")
        return False
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Convert Markdown Draft to HWPX with Safe In-place Text Updates, Canonical Policy Reference ('방침서 예시.hwpx' / '5. 방침서.hwpx'), and 5-Pillar Anti-Overlap Layout Recalculation.")
    parser.add_argument('--policy', action='store_true', help="Use Desktop canonical policy reference ('D:\\Desktop\\방침서 예시.hwpx', fallback 'D:\\Desktop\\5. 방침서.hwpx')")
    parser.add_argument('--template', required=False, default=None, help="Path to base HWPX template (defaults to '방침서 예시.hwpx' when --policy is set)")
    parser.add_argument('--output', required=True, help="Path to output HWPX file (for policy documents, output to 'D:\\Desktop\\<파일명>.hwpx'; never overwrite '방침서 예시.hwpx' or '5. 방침서.hwpx')")
    parser.add_argument('--markdown', required=True, help="Path to input Markdown file")
    parser.add_argument('--subtitle', required=False, default=None, help="Optional cover/body subtitle for policy template")
    parser.add_argument('--date', required=False, default=None, help="Optional registration date (e.g. '2026. 11. 12.') for policy template")
    parser.add_argument('--dept', required=False, default=None, help="Optional department name (defaults to '보건행정과') for policy template")
    args = parser.parse_args()

    resolved_template = args.template or (resolve_default_policy_template() if args.policy else None)
    if not resolved_template:
        parser.error("Either --template <path> or --policy must be provided.")

    ok = build_new_hwpx(
        resolved_template,
        args.output,
        args.markdown,
        subtitle=args.subtitle,
        doc_date=args.date,
        dept=args.dept,
    )
    if not ok:
        sys.exit(1)
