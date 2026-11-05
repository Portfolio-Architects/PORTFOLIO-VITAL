import zipfile
import os
import shutil
import xml.etree.ElementTree as ET
import copy
import struct
import sys
import argparse

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
    Resolves 4294967295 (0xFFFFFFFF = -1, meaning inherit table inMargin) to `default_m`.
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
                    if 0 < ls_val < 100:
                        el.attrib['value'] = '130'
                except ValueError:
                    pass


def recalc_tc_linesegs(tc_elem, cpr_scale=None, shrink_height=False, bad_ppr_ids=None, bad_style_ids=None, replacement_ppr_id='77'):
    """
    Recalculate <hp:linesegarray> for all <hp:p> inside a table cell <hp:tc>/<hp:subList>:
    1. Resolves 0xFFFFFFFF cellMargin values to 141 HWPUnits.
    2. Normalizes compressed Excel paraPrIDRef and styleIDRef when applicable.
    3. Propagates nested <hp:tbl>/<hp:sz height> into host paragraph <hp:lineseg vertsize> and cumulative vertpos.
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
            inner_tbl_h = 0
            if inner_tbl is not None:
                isz = inner_tbl.find(f'./{HP_SZ}')
                if isz is not None:
                    inner_tbl_h = int(isz.attrib.get('height', '0'))
            for ls_i, p_ls in enumerate(p_lsegs):
                p_vsize = int(p_ls.attrib.get('vertsize', str(def_vertsize)))
                if ls_i == 0 and inner_tbl_h > 0:
                    p_vsize = max(p_vsize, inner_tbl_h)
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
        vertsize = int(p_first_ls.attrib.get('vertsize', str(def_vertsize))) if p_first_ls is not None else def_vertsize
        textheight = int(p_first_ls.attrib.get('textheight', str(vertsize))) if p_first_ls is not None else def_textheight
        baseline = int(p_first_ls.attrib.get('baseline', str(int(vertsize * 0.85)))) if p_first_ls is not None else def_baseline
        spacing = max(0, int(p_first_ls.attrib.get('spacing', str(def_spacing)))) if p_first_ls is not None else max(0, def_spacing)
        horzpos = p_first_ls.attrib.get('horzpos', def_horzpos) if p_first_ls is not None else def_horzpos
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

    tbl = p_elem.find(f'./{HP_RUN}/{HP_TBL}')
    if tbl is None:
        tbl = p_elem.find(f'.//{HP_TBL}')
    if tbl is not None:
        sz = tbl.find(f'./{HP_SZ}')
        th = int(sz.attrib.get('height', str(vertsize))) if sz is not None else vertsize
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
        if old_lsa is not None:
            for ls in old_lsegs:
                ls.attrib['vertpos'] = str(start_vertpos)
            ensure_linesegarray_last(p_elem)
        return start_vertpos + th + spacing

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
        line_str = line.strip()

        # Table Row Detection
        if line_str.startswith('|') and line_str.endswith('|'):
            # Skip separator line
            if '---' in line_str:
                continue
            cols = [c.strip() for c in line_str.split('|')[1:-1]]
            current_table_rows.append(cols)
            in_table = True
            continue
        else:
            if in_table:
                if current_table_rows:
                    parsed_lines.append(('TABLE', current_table_rows))
                    current_table_rows = []
                in_table = False

        if not line_str:
            parsed_lines.append(('SPACER', ''))
            continue

        # Match headings and list items
        if line_str.startswith('# '):
            parsed_lines.append(('TITLE', line_str[2:].strip()))
        elif line_str.startswith('## '):
            parsed_lines.append(('HEADING_1', line_str[3:].strip()))
        elif line_str.startswith('### '):
            parsed_lines.append(('HEADING_2', line_str[4:].strip()))
        elif line_str.startswith('- ❍ ') or line_str.startswith('* ❍ '):
            parsed_lines.append(('ITEM_BULLET', line_str[2:].strip()))
        elif line_str.startswith('- ') or line_str.startswith('* '):
            parsed_lines.append(('ITEM', line_str[2:].strip()))
        elif line_str.startswith('▢') or line_str.startswith('❍') or line_str.startswith('▪'):
            parsed_lines.append(('ITEM_BULLET', line_str))
        else:
            parsed_lines.append(('NORMAL', line_str))

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


def build_new_hwpx(template_path, output_path, md_path):
    temp_dir = os.path.join(os.path.dirname(os.path.abspath(output_path)), "temp_build_hwpx")
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir, exist_ok=True)

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
        text_tokens = [t for t in parsed_md if t[0] not in ['TABLE', 'SPACER'] and t[1].strip()]

        num_existing = len(direct_p_nodes)
        num_new = len(text_tokens)

        print(f"Template has {num_existing} direct plain text paragraphs. Markdown has {num_new} valid text paragraphs.")

        # 6. Update paragraph text in-place while maintaining clean single-run structure
        for idx in range(num_existing):
            old_p = direct_p_nodes[idx]
            if idx < num_new:
                tag, text = text_tokens[idx]

                if tag == 'TITLE':
                    formatted_text = text if text.startswith('󰏚') else f"󰏚 {text}"
                elif tag == 'HEADING_1':
                    formatted_text = text if text.startswith(('󰏚', '▢')) else f"▢ {text}"
                elif tag == 'HEADING_2':
                    formatted_text = text if text.startswith(('󰏚', '▢', '❍')) else f"❍ {text}"
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
        for sec_rel_name, orig_sec_bytes in orig_extra_sec_bytes.items():
            sec_disk_path = os.path.join(temp_dir, *sec_rel_name.split('/'))
            if os.path.exists(sec_disk_path):
                extra_tree = ET.parse(sec_disk_path)
                extra_root = extra_tree.getroot()
                heal_section_tables_and_layout(extra_root, cpr_scale=cpr_scale, hdr_elem=hdr_root)
                preserve_xml_header_and_save(orig_sec_bytes, extra_root, sec_disk_path, root_tag_prefix='<hs:sec')
                extra_sec_paths[sec_rel_name] = sec_disk_path

        # 8. Save XMLs preserving original XML declarations & root namespace headers
        if hdr_root is not None and orig_hdr_bytes is not None:
            preserve_xml_header_and_save(orig_hdr_bytes, hdr_root, header_xml_path, root_tag_prefix='<hh:head')

        preserve_xml_header_and_save(orig_s0_bytes, root, section_xml_path, root_tag_prefix='<hs:sec')
        print("Successfully restored original XML declaration and namespace prefixes.")

        if os.path.exists(output_path):
            os.remove(output_path)

        # 9. Pack ZIP archive preserving 100% of the original metadata
        with zipfile.ZipFile(template_path, 'r') as z_in:
            with zipfile.ZipFile(output_path, 'w') as z_out:
                for info in z_in.infolist():
                    if info.filename == "Contents/header.xml" and hdr_root is not None:
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
    parser = argparse.ArgumentParser(description="Convert Markdown Draft to HWPX with Safe In-place Text Updates and 5-Pillar Anti-Overlap Layout Recalculation.")
    parser.add_argument('--template', required=True, help="Path to base HWPX template")
    parser.add_argument('--output', required=True, help="Path to output HWPX file")
    parser.add_argument('--markdown', required=True, help="Path to input Markdown file")
    args = parser.parse_args()

    ok = build_new_hwpx(args.template, args.output, args.markdown)
    if not ok:
        sys.exit(1)
