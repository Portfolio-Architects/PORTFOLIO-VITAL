import os
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from generate_new_hwpx import (
    NS_MAP,
    HP_P,
    HP_RUN,
    HP_T,
    HP_TBL,
    HP_POS,
    HP_SZ,
    HP_TR,
    HP_TC,
    HP_SUBLIST,
    HP_CELLADDR,
    HP_CELLSPAN,
    HP_CELLSZ,
    HP_CELLMARGIN,
    HP_LINESEGA,
    HP_LINESEG,
    HH_PARAPR,
    HH_LINESPACING,
    HC_INTENT,
    char_visual_width,
    wrap_text_positions,
    get_cell_margins,
    flatten_t_node,
    extract_p_text,
    ensure_linesegarray_last,
    set_p_text,
    update_paragraph_text,
    normalize_header_styles,
    recalc_tc_linesegs,
    tc_needs_recalc,
    set_tc_lines,
    enforce_inline_table_flow,
    sync_table_geometry,
    layout_sec_paragraph,
    recalc_section_layout,
    verify_hwpx_no_overlap,
    build_new_hwpx,
)


def test_pillar_1_linesegarray_and_child_order():
    # 1. Edge cases on wrap_text_positions
    assert wrap_text_positions("", 5000, 1100) == [0]
    assert wrap_text_positions("   ", 5000, 1100) == [0]
    assert wrap_text_positions("단일줄", 20000, 1100) == [0]

    # Long Korean text should wrap into multiple monotonically increasing textpos offsets without trailing-space blank lines
    long_txt = "강남구보건소 건강증진팀 2026년 양재천 건강 페스티벌 및 서울체력장 강남센터 운영 결과보고서     "
    tpos = wrap_text_positions(long_txt, 8000, 1100)
    assert len(tpos) >= 3, f"Expected >=3 wrapped lines, got {tpos}"
    assert tpos == sorted(set(tpos)), f"textpos not strictly increasing: {tpos}"
    for k in range(len(tpos)):
        end = tpos[k + 1] if k + 1 < len(tpos) else len(long_txt)
        assert long_txt[tpos[k]:end].strip() != "", f"Blank wrapped line at {k}: {tpos}"

    # 2. Child order inversion healing (<hp:linesegarray> before <hp:run>)
    p = ET.Element(HP_P)
    r1 = ET.SubElement(p, HP_RUN, {'charPrIDRef': '10'})
    t1 = ET.SubElement(r1, HP_T)
    t1.text = "첫번째"
    lsa = ET.SubElement(p, HP_LINESEGA)
    ET.SubElement(lsa, HP_LINESEG, {'textpos': '0', 'vertpos': '0', 'vertsize': '1100'})
    r2 = ET.SubElement(p, HP_RUN, {'charPrIDRef': '11'})
    t2 = ET.SubElement(r2, HP_T)
    t2.text = "두번째"

    ensure_linesegarray_last(p)
    child_tags = [c.tag.split('}')[-1] for c in p]
    assert child_tags == ['run', 'run', 'linesegarray'], f"Unexpected child order: {child_tags}"
    print("[PASS] Pillar 1: wrap_text_positions & ensure_linesegarray_last")


def test_pillar_2_table_geometry_and_rowspan():
    # Build a synthetic 3-row, 2-col table where Row 1 Col 0 has rowSpan=2
    host_p = ET.Element(HP_P)
    host_lsa = ET.SubElement(host_p, HP_LINESEGA)
    ET.SubElement(host_lsa, HP_LINESEG, {'textpos': '0', 'vertpos': '0', 'vertsize': '1000', 'textheight': '1000', 'baseline': '850', 'spacing': '300', 'horzpos': '0', 'horzsize': '48000', 'flags': '393216'})
    host_r = ET.SubElement(host_p, HP_RUN)
    tbl = ET.SubElement(host_r, HP_TBL, {'rowCnt': '3', 'colCnt': '2'})
    ET.SubElement(tbl, HP_SZ, {'width': '20000', 'height': '3000'})
    ET.SubElement(tbl, HP_POS, {'treatAsChar': '0', 'vertOffset': '5000'})

    def make_tc(col_addr, row_addr, width, height, row_span=1, text="샘플"):
        tc = ET.Element(HP_TC)
        ET.SubElement(tc, HP_CELLADDR, {'colAddr': str(col_addr), 'rowAddr': str(row_addr)})
        ET.SubElement(tc, HP_CELLSPAN, {'colSpan': '1', 'rowSpan': str(row_span)})
        ET.SubElement(tc, HP_CELLSZ, {'width': str(width), 'height': str(height)})
        ET.SubElement(tc, HP_CELLMARGIN, {'left': '141', 'right': '141', 'top': '141', 'bottom': '141'})
        sub = ET.SubElement(tc, HP_SUBLIST)
        p = ET.SubElement(sub, HP_P)
        r = ET.SubElement(p, HP_RUN)
        t = ET.SubElement(r, HP_T)
        t.text = text
        lsa = ET.SubElement(p, HP_LINESEGA)
        ET.SubElement(lsa, HP_LINESEG, {'textpos': '0', 'vertpos': '0', 'vertsize': '1000', 'textheight': '1000', 'baseline': '850', 'spacing': '300', 'horzpos': '0', 'horzsize': str(width - 282), 'flags': '393216'})
        return tc

    # Row 0 (header)
    tr0 = ET.SubElement(tbl, HP_TR)
    tr0.append(make_tc(0, 0, 5000, 1282, 1, "구분"))
    tr0.append(make_tc(1, 0, 6000, 1282, 1, "세부내용"))

    # Row 1 (col 0 has rowSpan=2, col 1 has multi-line text)
    tr1 = ET.SubElement(tbl, HP_TR)
    tc_merged = make_tc(0, 1, 5000, 1282, 2, "병합셀")
    tc_r1_c1 = make_tc(1, 1, 6000, 1282, 1, "")
    tr1.append(tc_merged)
    tr1.append(tc_r1_c1)
    set_tc_lines(tc_r1_c1, ["첫번째 줄 텍스트입니다", "두번째 줄 텍스트입니다", "세번째 줄 텍스트입니다"], shrink_height=True)

    # Row 2 (only col 1 present because col 0 is spanned from Row 1)
    tr2 = ET.SubElement(tbl, HP_TR)
    tc_r2_c1 = make_tc(1, 2, 6000, 1282, 1, "단일 줄 텍스트")
    tr2.append(tc_r2_c1)
    recalc_tc_linesegs(tc_r2_c1, shrink_height=True)

    enforce_inline_table_flow(tbl)
    total_h = sync_table_geometry(host_p, tbl, update_host_lseg=True)

    r0_h = int(tr0.findall(f'./{HP_TC}')[0].find(f'./{HP_CELLSZ}').attrib['height'])
    r1_h = int(tc_r1_c1.find(f'./{HP_CELLSZ}').attrib['height'])
    r2_h = int(tc_r2_c1.find(f'./{HP_CELLSZ}').attrib['height'])
    merged_h = int(tc_merged.find(f'./{HP_CELLSZ}').attrib['height'])

    assert r1_h > 3000, f"Expected 3-line cell height > 3000, got {r1_h}"
    assert merged_h == r1_h + r2_h, f"Expected rowSpan=2 height {r1_h + r2_h}, got {merged_h}"
    assert total_h == r0_h + r1_h + r2_h, f"Expected total_h {r0_h + r1_h + r2_h}, got {total_h}"
    assert tbl.find(f'./{HP_SZ}').attrib['height'] == str(total_h)
    assert host_p.find(f'./{HP_LINESEGA}/{HP_LINESEG}').attrib['vertsize'] == str(total_h)
    assert tbl.find(f'./{HP_POS}').attrib['treatAsChar'] == '1'
    assert tbl.find(f'./{HP_POS}').attrib['vertOffset'] == '0'
    print("[PASS] Pillar 2 & 3: sync_table_geometry, rowSpan height sum & enforce_inline_table_flow")


def test_pillar_4_overflow_and_squeeze_normalization():
    # 1. Test header.xml normalization (paraPr 129 negative indent, SQUEEZE, compressed lineSpacing)
    hdr = ET.Element(f"{{{NS_MAP['hh']}}}head")
    ppr = ET.SubElement(hdr, HH_PARAPR, {'id': '129', 'lineWrap': 'SQUEEZE'})
    intent = ET.SubElement(ppr, HC_INTENT, {'value': '-2400'})
    lspacing = ET.SubElement(ppr, HH_LINESPACING, {'type': 'PERCENT', 'value': '75'})

    normalize_header_styles(hdr)
    assert ppr.attrib['lineWrap'] == 'BREAK'
    assert intent.attrib['value'] == '0'
    assert lspacing.attrib['value'] == '130'

    # 2. Test 0xFFFFFFFF (4294967295) cellMargin overflow protection
    tc = ET.Element(HP_TC)
    ET.SubElement(tc, HP_CELLSZ, {'width': '8000', 'height': '4294967295'})
    ET.SubElement(tc, HP_CELLMARGIN, {
        'left': '4294967295',
        'right': '4294967295',
        'top': '4294967295',
        'bottom': '-1',
    })
    assert get_cell_margins(tc) == (141, 141, 141, 141)

    sub = ET.SubElement(tc, HP_SUBLIST)
    p = ET.SubElement(sub, HP_P, {'paraPrIDRef': '129', 'styleIDRef': '45'})
    r = ET.SubElement(p, HP_RUN)
    t = ET.SubElement(r, HP_T)
    t.text = "엑셀 복사 셀 오버플로우 방어 테스트"

    assert tc_needs_recalc(tc) is True
    recalc_tc_linesegs(tc)
    assert p.attrib['paraPrIDRef'] == '77'
    assert p.attrib['styleIDRef'] == '0'
    new_h = int(tc.find(f'./{HP_CELLSZ}').attrib['height'])
    assert 1000 <= new_h <= 10000, f"Expected normal cell height, got {new_h}"
    assert tc_needs_recalc(tc) is False
    print("[PASS] Pillar 4: normalize_header_styles & 0xFFFFFFFF cellMargin overflow guard")


def test_pillar_5_multi_run_and_linebreak_cleanup():
    # Create a paragraph with multiple pure runs, multiple hp:t in a single run, inline lineBreak/fwSpace with .tail, AND a control run (tbl)
    p = ET.Element(HP_P)
    r_ctrl = ET.SubElement(p, HP_RUN, {'charPrIDRef': '1'})
    ET.SubElement(r_ctrl, HP_TBL, {'id': '999'})

    r_text1 = ET.SubElement(p, HP_RUN, {'charPrIDRef': '42'})
    t1 = ET.SubElement(r_text1, HP_T)
    t1.text = "기존텍스트1"
    lb = ET.SubElement(t1, f"{{{NS_MAP['hp']}}}lineBreak")
    lb.tail = "유령꼬리텍스트"
    t2 = ET.SubElement(r_text1, HP_T)
    t2.text = "기존텍스트2_같은런내부"

    r_text2 = ET.SubElement(p, HP_RUN, {'charPrIDRef': '43'})
    t3 = ET.SubElement(r_text2, HP_T)
    t3.text = "기존텍스트3_두번째런"

    lsa = ET.SubElement(p, HP_LINESEGA)
    ET.SubElement(lsa, HP_LINESEG, {'textpos': '0', 'vertpos': '0', 'vertsize': '1500'})

    # Update paragraph text - must not throw ValueError and must preserve r_ctrl and charPrIDRef='42'
    update_paragraph_text(p, "신규 클린 텍스트")
    assert extract_p_text(p) == "신규 클린 텍스트"
    assert p.find(f'.//{HP_TBL}') is not None, "Control table run was lost!"
    runs = p.findall(f'./{HP_RUN}')
    assert len(runs) == 2, f"Expected 1 ctrl run + 1 pure text run, got {len(runs)}"
    assert runs[1].attrib.get('charPrIDRef') == '42'
    assert len(runs[1].findall(f'./{HP_T}')) == 1
    assert len(list(runs[1].find(f'./{HP_T}'))) == 0, "Child tags inside hp:t were not removed!"
    assert [c.tag.split('}')[-1] for c in p][-1] == 'linesegarray'

    # Test <hp:markpenBegin> ghost .tail stripping when t.text was already overwritten vs preserving when t.text is empty
    t_ghost = ET.Element(HP_T)
    t_ghost.text = "훈련용품 및 인센티브"
    mp1 = ET.SubElement(t_ghost, f"{{{NS_MAP['hp']}}}markpenBegin", {'color': '#FFFFFF'})
    mp1.tail = "홍보물품"
    ET.SubElement(t_ghost, f"{{{NS_MAP['hp']}}}markpenEnd")
    assert flatten_t_node(t_ghost) == "훈련용품 및 인센티브"
    assert len(list(t_ghost)) == 0

    t_legit = ET.Element(HP_T)
    t_legit.text = None
    mp2 = ET.SubElement(t_legit, f"{{{NS_MAP['hp']}}}markpenBegin", {'color': '#FFFF00'})
    mp2.tail = "하이라이트본문"
    mp2_end = ET.SubElement(t_legit, f"{{{NS_MAP['hp']}}}markpenEnd")
    mp2_end.tail = "후속본문"
    assert flatten_t_node(t_legit) == "하이라이트본문후속본문"
    assert len(list(t_legit)) == 0
    print("[PASS] Pillar 5: multi-run/multi-t & inline lineBreak/markpenBegin ghost tail cleanup")


def test_end_to_end_compiler_and_gatekeeper():
    out_medirun = os.path.join(os.path.dirname(__file__), "test_e2e_medirun.hwpx")
    out_seoul = os.path.join(os.path.dirname(__file__), "test_e2e_seoul.hwpx")
    out_2027 = os.path.join(os.path.dirname(__file__), "test_e2e_2027.hwpx")
    try:
        # 1. 2026_메디런_프로그램_운영_계획.hwpx
        ok1 = build_new_hwpx(
            os.path.join(os.path.dirname(__file__), "2026_메디런_프로그램_운영_계획.hwpx"),
            out_medirun,
            os.path.join(os.path.dirname(__file__), "2026_메디런_프로그램_운영_계획.md"),
        )
        assert ok1 is True
        m1 = verify_hwpx_no_overlap(out_medirun)
        assert all(
            m1[k] == 0
            for k in (
                'squeeze_count',
                'neg_intent_129',
                'compressed_lspacing',
                'inverted_order_p',
                'dup_vpos_cells',
                'huge_height_cells',
                'narrow_hsize_cells',
                'bad_parapr_cells',
                'ghost_t_nodes',
                'bad_zip_flags',
            )
        )
        with zipfile.ZipFile(out_medirun, 'r') as z1:
            sec1 = ET.fromstring(z1.read('Contents/section0.xml'))
            tbls1 = list(sec1.iter(HP_TBL))
            # Staggered rowSpan approval Table 2 (0-indexed 1) must preserve its 11976 height even if sync_table_geometry is called
            assert sync_table_geometry(None, tbls1[1]) == 11976
            # Healed Tbl 12 (0-indexed 12) must have synchronized sz.height == 7975 and treatAsChar == '1'
            assert int(tbls1[12].find(f'./{HP_SZ}').attrib['height']) == 7975
            assert tbls1[12].find(f'./{HP_POS}').attrib['treatAsChar'] == '1'

        # 2. 서울체력장_강남센터_개소식_추진계획.hwpx (nested Table 5 inside Table 4 R0C0)
        ok2 = build_new_hwpx(
            os.path.join(os.path.dirname(__file__), "서울체력장_강남센터_개소식_추진계획.hwpx"),
            out_seoul,
            os.path.join(os.path.dirname(__file__), "20261022_메디런_운영물품_세부내역표.md"),
        )
        assert ok2 is True
        m2 = verify_hwpx_no_overlap(out_seoul)
        assert all(
            m2[k] == 0
            for k in (
                'squeeze_count',
                'neg_intent_129',
                'compressed_lspacing',
                'inverted_order_p',
                'dup_vpos_cells',
                'huge_height_cells',
                'narrow_hsize_cells',
                'bad_parapr_cells',
                'ghost_t_nodes',
                'bad_zip_flags',
            )
        )
        with zipfile.ZipFile(out_seoul, 'r') as z2:
            sec2 = ET.fromstring(z2.read('Contents/section0.xml'))
            tbls2 = list(sec2.iter(HP_TBL))
            outer_tbl = tbls2[3]
            inner_tbl = tbls2[4]
            inner_h = int(inner_tbl.find(f'./{HP_SZ}').attrib['height'])
            outer_tc = outer_tbl.find(f'./{HP_TR}/{HP_TC}')
            outer_ps = outer_tc.find(f'./{HP_SUBLIST}').findall(f'./{HP_P}')
            p3_ls = outer_ps[3].find(f'./{HP_LINESEGA}/{HP_LINESEG}')
            p4_ls = outer_ps[4].find(f'./{HP_LINESEGA}/{HP_LINESEG}')
            p3_vp = int(p3_ls.attrib['vertpos'])
            p3_vs = int(p3_ls.attrib['vertsize'])
            p4_vp = int(p4_ls.attrib['vertpos'])
            assert p3_vs == inner_h, f"Nested table host p[3] vertsize {p3_vs} != inner_h {inner_h}"
            assert p4_vp >= p3_vp + p3_vs, f"Following paragraph p[4] vertpos {p4_vp} overlaps inner table bottom {p3_vp + p3_vs}"

        # 3. 2027_강남구보건소_신체활동_사업_총괄계획서.hwpx (header-aware paraPr normalization without corrupting clean paraPr 119/129)
        ok3 = build_new_hwpx(
            os.path.join(os.path.dirname(__file__), "2027_강남구보건소_신체활동_사업_총괄계획서.hwpx"),
            out_2027,
            os.path.join(os.path.dirname(__file__), "2026_메디런_프로그램_운영_계획.md"),
        )
        assert ok3 is True
        m3 = verify_hwpx_no_overlap(out_2027)
        assert all(m3[k] == 0 for k in m3 if k != 'sections')
        with zipfile.ZipFile(out_2027, 'r') as z3:
            sec3 = ET.fromstring(z3.read('Contents/section0.xml'))
            ppr_refs = {p.attrib.get('paraPrIDRef') for tc in sec3.iter(HP_TC) for p in tc.iter(HP_P)}
            assert '119' in ppr_refs and '129' in ppr_refs, "Clean paraPr 119/129 were wrongly overwritten!"

        print("[PASS] End-to-End build_new_hwpx & verify_hwpx_no_overlap on 3 real HWPX templates (including nested tables & staggered rowSpan)")
    finally:
        for fpath in (out_medirun, out_seoul, out_2027):
            if os.path.exists(fpath):
                os.remove(fpath)


def test_loud_failure_gatekeeper_on_defective_hwpx():
    # Pre-existing templates contain known defects before compiler healing:
    # 1. 서울체력장_강남센터_개소식_추진계획.hwpx has 6 inverted_order_p paragraphs
    raw_seoul = os.path.join(os.path.dirname(__file__), "서울체력장_강남센터_개소식_추진계획.hwpx")
    m_seoul = verify_hwpx_no_overlap(raw_seoul, raise_on_error=False)
    assert m_seoul['inverted_order_p'] > 0, f"Expected pre-existing inverted_order_p > 0, got {m_seoul}"
    try:
        verify_hwpx_no_overlap(raw_seoul, raise_on_error=True)
        assert False, "Expected RuntimeError on defective HWPX, but none was raised!"
    except RuntimeError as e:
        assert "[HWPX OVERLAP GATEKEEPER ERROR]" in str(e)

    # 2. 2026_메디런_프로그램_운영_계획.hwpx has dup_vpos_cells, undersized cells, and ghost markpenBegin tails
    raw_medirun = os.path.join(os.path.dirname(__file__), "2026_메디런_프로그램_운영_계획.hwpx")
    m_medirun = verify_hwpx_no_overlap(raw_medirun, raise_on_error=False)
    assert m_medirun['dup_vpos_cells'] > 0, f"Expected pre-existing dup_vpos_cells > 0, got {m_medirun}"
    assert m_medirun['huge_height_cells'] > 0, f"Expected pre-existing undersized cells > 0, got {m_medirun}"
    assert m_medirun['ghost_t_nodes'] > 0, f"Expected pre-existing ghost_t_nodes > 0, got {m_medirun}"
    print("[PASS] Loud-Failure Gatekeeper: accurately catches pre-existing overlap defects & raises RuntimeError")


if __name__ == '__main__':
    test_pillar_1_linesegarray_and_child_order()
    test_pillar_2_table_geometry_and_rowspan()
    test_pillar_4_overflow_and_squeeze_normalization()
    test_pillar_5_multi_run_and_linebreak_cleanup()
    test_loud_failure_gatekeeper_on_defective_hwpx()
    test_end_to_end_compiler_and_gatekeeper()
    print("=== ALL 5-PILLAR HWPX ANTI-OVERLAP TESTS PASSED 100% ===")

