---
name: vital-hwpx-docgen
description: >-
  당해연도 실무 공문서와 전사 아카이브 RAG 검색을 결합하여 공공기관 표준 서식에 부합하는 한글(HWPX) 문서를 비파괴 신규 빌드 또는 인플레이스 치유·업데이트하는 스킬.
  방침서(3단 표준)·물품구매 계획·주간업무·일반 공문서 기안, 품목 화보 BinData 3중 매핑, G2B 물품분류번호 하이픈 표기 및 5대 겹침 차단 한글 조판 요구 시 사용
  (예산 산출표·405-01 검산은 vital-budget-audit, PIPA 스캔·온톨로지 환류·마일스톤 동기화는 vital-governance-ops, 포스터·품목 화보 합성은 vital-public-infographic과 연계).
---

# 한글(HWPX) 공문서 자동 생성 및 서식 컴파일 스킬 (vital-hwpx-docgen)

## ▣ 1. 개요 및 목적 함수

### ▢ 1. 시스템 목적 함수 및 SSOT 경계
- 본 스킬은 **$\mathcal{J}_{\text{DocAuto}}$ (법령·아카이브 RAG 기반 HWPX 자동화)**와 `AGENTS.md` `Rule F, G, M`을 전담함.
- **조판·문체 SSOT:** `docs/HWP_GENERATION_GUIDELINES.md`, `src/lib/administrativeFormatter.ts`
- **컴파일·주간 엔진:** `scratch/generate_new_hwpx.py`, `scripts/generate_weekly_hwpx.py`
- **표준 템플릿:** `방침서 예시.hwpx`(방침서 1순위) · `5. 방침서.hwpx`(폴백 갑지, `D:\Desktop`·`D:\Desktop\_Organized_Archive`·`F:\_Organized_Archive` 자동 탐색), `public/templates/template.hwpx`(일반 공문, 백업 `scratch/user_template_backup.hwpx`), `public/templates/template_weekly.hwpx`(주간업무)
- **사전 가드:** `scripts/privacy_guard.py`, `scripts/rsi_evaluator.js`

### ▢ 2. 타 스킬 연계 핸드오프 및 $\mathcal{J}_{\text{Ontology}}$ 역방향 환류
- **예산·물품구매 (`vital-budget-audit`):** 세출예산·`101-04` 인건비·`405-01` 물품구매(추정가격 $\lfloor\text{총액}/1.1\rfloor$, 부가세, 계약 사전절차) 표 작성 전 3중 총액 오차 0원을 확정함.
- **거버넌스 (`vital-governance-ops`):** 초안 빌드 전 `privacy_guard.py --scan`(G2B 10자리 코드는 `세부품명번호 60109399-01` 하이픈 표기로 계좌 오탐 방어)을 실행하고 스크립트 개선 시 `sync-rules.js`를 연계함.
- **시각물·행사 (`vital-public-infographic`, `vital-festival-4way-sync`):** 포스터·다중 품목 격자 화보(`BinData` 3중 매핑)·행사 식순 확정 스펙을 HWPX에 반영함.
- **역방향 환류 (Closed-Loop):** 확정된 법정 기한(납품기한, 일상감사·계약심사 후 14일 이내 집행전말보고 등)은 `data/SCHEDULES.json`(`scripts/sync-schedules.js`), 신규 공문 메타데이터는 `data/ADMIN_DOC_INDEX.json`(`scripts/curate_admin_archive.py`), 후속 과업은 `data/WORKING_MEMORY.json`에 환류함.

---

## ▣ 2. 활성화·비활성화 조건

### ▢ 1. 활성화 발화 패턴
- "공문서/기안서/방침서 초안 작성 및 한글(HWPX) 변환", "전년도 결과보고서·견적서 참고 2026년 계획서 작성", "지침 서식(딩뱃·2타 띄기) 교정 및 기존 HWPX 인플레이스 업데이트".

### ▢ 2. 비활성화 조건
- 예산 단수 산출·5대 보험료·`405-01` 수리 감사 (`vital-budget-audit`).
- 16:9·2:3 포스터·코스도·격자 화보 PNG 합성 (`vital-public-infographic`).

---

## ▣ 3. 데이터 소스 · 양식 · 법령 RAG 규격

### ▢ 1. 아카이브·바탕화면 및 법령·조례 RAG (`src/app/api/law/route.ts` & 법제처 DRF)
- **아카이브 및 색인:** `F:\_Organized_Archive`(2015~2026년, `2026년`·`공공문서 폴더` 포함), `D:\Desktop\_Organized_Archive`, `D:\Desktop`(읽기 전용 최신본·신규 방침서 출력), `data/ADMIN_DOC_INDEX.json`, `data/ARCHIVE_INDEX.json`, `data/SEED_ONTOLOGY_DOCS.json`.
- **인증키 소스:** `.env.local` 내 `LAW_API_KEY` (`open.law.go.kr` 50자 `OC` 식별값 + 등록 공인 IP 사용, 평문 노출 금지).
- **로컬 엔드포인트:** 목록 `/api/law?target=law|ordin|admrul&query=<검색어>` · 본문 `/api/law?target=law|ordin|admrul&mst=<일련번호>&type=XML|HTML` (`admrul`은 `ID=`, `law`/`ordin`은 `MST=` 자동 분기).
- **직접 DRF 조회:** 목록 `http://www.law.go.kr/DRF/lawSearch.do?OC=$LAW_API_KEY&target={law|ordin|admrul}&type=XML&query=<검색어>`, 본문 `http://www.law.go.kr/DRF/lawService.do?OC=$LAW_API_KEY&target={law|ordin}&type=XML&MST=<일련번호>` (`admrul`은 `ID=<행정규칙일련번호>`) 호출 후 `<law id="...">`/`<admrul id="...">`/`<ordin id="...">` 및 `<![CDATA[...]]>` 값을 파싱함.

### ▢ 2. 방침서 3단 표준 양식 및 원본 보호 가드
- **탐색 순위 (`--policy`):** `방침서 예시.hwpx` (`D:\Desktop\` $\to$ `D:\Desktop\_Organized_Archive\` $\to$ `F:\_Organized_Archive\`) $\to$ 폴백 `D:\Desktop\5. 방침서.hwpx` (1쪽 공백 갑지 전용).
- **3단 구조:** ① **1쪽 전자결재 표지**(`P000` 결재·협조란 + `P001` 소제목·본제목 + `P002` 강남구 심볼 `image1.png`·표지 연월 + `P003` 기관·부서명) $\to$ ② **2쪽 사전검토서**(`P004` 9개 법정 검토항목 및 `[계속/신규]`·협조 체크박스) $\to$ ③ **3쪽 이후 본문**(제목배너 + 목적요약 상자 + `#AE3E5A` 버건디 로마숫자 `Ⅰ~Ⅴ` 배지 + `▢` 15pt·`❍` 14pt·`-` 12pt·`※` 13pt + 좌우 개방형 `#F2F2F2` 표 + `  끝.`).
- **비파괴 출력 가드:** 반드시 **`D:\Desktop\<방침서명>.hwpx`**에 신규 저장하며 원본 덮어쓰기를 영구 금지함(`assert_non_destructive_paths`, 미참조 예시 사진 `prune_unreferenced_bindata`, `Preview/PrvText.txt` 재합성).
- **일반·주간 서식:** `public/templates/template.hwpx`(백업 `scratch/user_template_backup.hwpx`), `public/templates/template_weekly.hwpx`(`scripts/generate_weekly_hwpx.py`).

---

## ▣ 4. 단계별 실행 런북

### ▢ Phase 1. 실무 아카이브 스캔 및 법령 근거 RAG 정립
- 가상 수치를 배제하고 `ADMIN_DOC_INDEX.json`·`ARCHIVE_INDEX.json`·`F:\_Organized_Archive`·`D:\Desktop`의 직전 결과보고서·지출결의서·견적서 실측 수치를 확보함.
- `/api/law` 또는 DRF로 현행 법령·조례·행정규칙 시행일자와 조·항·호·목을 대조하여 2쪽 `사전검토서`와 본문 `Ⅰ 추진근거`에 특정함(예: ｢지역보건법｣ 제11조 제1항 제5호 가목).

### ▢ Phase 2. 공공 표준 개조식 마크다운 초안 작성
- 구어체·청유형·내면 심리 묘사(Rule P)를 배제하고 개조식 종결어미(`-함`, `-됨`, `-임`) 및 **1문장 = 1줄**을 적용함(HWPX XML 딩뱃 `U+F03DA` $\to$ `▢` $\to$ `❍` $\to$ `-` $\to$ `•` $\to$ `※` 및 법정 위계 `1.` $\to$ `가.` $\to$ `1)` $\to$ `가)` 세부 치수는 `docs/HWP_GENERATION_GUIDELINES.md` 참조).
- 방침서 메타데이터 키(`소제목:`, `작성일:`, `소관부서:`, `협조부서:`, `사업유형:`, `공직선거법:`, `추진경위:`, `예산사항:`, `수혜자:`, `> 목적요약`)를 포함하고, 조달청 G2B 10자리 코드는 `세부품명번호 60109399-01`(`8자리-2자리`) 하이픈 표준으로 표기해 계좌 오탐을 차단함.

### ▢ Phase 3. 비파괴 빌드 · 인플레이스 치유 · 화보 BinData 매핑 · 5대 겹침 차단
- **기작성 HWPX 인플레이스 치유:** 기존 표지·사전검토서(`P[00]~P[06]`) 원본 `<hp:linesegarray>`를 보존한 채 3쪽 이후 본문·신규 표에 대해서만 `normalize_header_styles` $\to$ `heal_section_tables_and_layout` $\to$ `layout_sec_paragraph` $\to$ `ensure_linesegarray_last`를 적용함.
- **화보 `BinData` 3중 매핑 프로토콜:** ① `BinData/imageN.png` 물리 저장 + ② `Contents/content.hpf` `<opf:item id="imageN" href="BinData/imageN.png" media-type="image/png" isEmbeded="1"/>` 등록 + ③ `Contents/section0.xml` `<hp:pic treatAsChar="1">`의 `orgSz`/`imgRect`/`imgClip`/`imgDim`=`px×75` HWPUnits, `curSz`(`42,000~42,500`), `scaMatrix` 및 호스트 `<hp:lineseg vertsize>` 3중 동기화.
- **5대 텍스트 겹침 원천 차단 엔진 (`scratch/generate_new_hwpx.py`, 상세 규격: `docs/HWP_GENERATION_GUIDELINES.md` 제7장):**

| 차단 규격 | 핵심 함수 | 적용 메커니즘 |
|:---:|:---|:---|
| **1. 줄세그먼트 재계산** | `recalc_tc_linesegs`, `layout_sec_paragraph`, `ensure_linesegarray_last` | `wrap_text_positions`로 `textpos`·단조 증가 `vertpos` 재계산 및 `<hp:linesegarray>` 최하단 자식 배치 |
| **2. 표 기하학 상향 전파** | `sync_table_geometry`, `heal_section_tables_and_layout` | `<hp:cellSz height>`·엇갈린 `rowSpan` 역산 및 최하위 중첩 표→외곽 표 `<hp:sz height>`·호스트 `<hp:lineseg>` 연쇄 동기화 |
| **3. 인라인 표 flow** | `enforce_inline_table_flow` | `<hp:pos treatAsChar="1" vertOffset="0"/>` 정규화로 부유 객체 겹침 차단 |
| **4. 압축·여백 오버플로우 차단** | `normalize_header_styles`, `get_excel_defective_ids`, `get_cell_margins` | `lineWrap="SQUEEZE"`→`BREAK`, `paraPr 129` 음수 들여쓰기 `0`, 줄간격 `130%`+, `0xFFFFFFFF` 여백 `141` 클램핑 |
| **5. 다중 런·유령 꼬리 제거** | `flatten_t_node`, `set_p_text`, `set_tc_lines` | `<hp:lineBreak/>`·`<hp:markpenBegin/>` `.tail` 평탄화 및 `r0.remove(extra_t)`/`p_elem.remove(extra_r)` 정리 |

- **제어 객체 격리 및 ZIP 패치:** 표·글상자·수식을 보존하고 `patch_zip_flags`(`struct.pack_into`)로 Bit 2 Fast Deflating(value 4)을 복원함.

### ▢ Phase 4. 표준 준거 및 무결성 최종 검증
- `docs/HWP_GENERATION_GUIDELINES.md` 여백(15/20/10mm)·서체·2타 띄기·행정 문장부호(`2026. 9. 14.`, `14:00`, `금10,000,000원(금일천만원)`, `  끝.`) 및 `verify_hwpx_no_overlap()`(`inverted_order_p`, `dup_vpos_cells`, `huge_height_cells`, `narrow_hsize_cells`, `squeeze_count`, `compressed_lspacing`, `ghost_t_nodes` 모두 `0`)를 검증함.

---

## ▣ 5. 전용 스크립트 및 검증 CLI

```bash
# 1. 초안 개인정보·G2B 오탐 사전 스캔
python scripts/privacy_guard.py --scan scratch/draft_policy.md

# 2-A. [방침서 1순위] 바탕화면 '방침서 예시.hwpx' 3단 표준 참조 바탕화면 신규 빌드
python scratch/generate_new_hwpx.py --policy --output "D:/Desktop/2026_신규사업_추진계획.hwpx" --markdown scratch/draft_policy.md

# 2-B. [방침서 폴백] 1쪽 공백 갑지('5. 방침서.hwpx') 전용 빌드
python scratch/generate_new_hwpx.py --template "D:/Desktop/_Organized_Archive/5. 방침서.hwpx" --output "D:/Desktop/2026_신규사업_약식방침.hwpx" --markdown scratch/draft_policy.md

# 2-C. [일반 공문 / 주간업무] 기본 템플릿 및 주간 2단 비교 빌드
python scratch/generate_new_hwpx.py --template public/templates/template.hwpx --output scratch/output.hwpx --markdown scratch/draft.md
python scripts/generate_weekly_hwpx.py --help

# 3. 행정 포매터 및 주간 HWPX 단위 테스트
npx jest __tests__/administrative-formatter.test.ts __tests__/weekly-hwpx.test.ts
```

---

## ▣ 6. 금지 패턴 및 안티패턴 체크리스트

| 구분 | 안티패턴 (Strictly Prohibited) | 정상 표준 대응책 (Compliant Standard) |
|:---:|:---|:---|
| **AP-H1** | 원본 `방침서 예시.hwpx`, `5. 방침서.hwpx`, `template.hwpx` 직접 덮어쓰기 또는 임의 폴더 출력 | `--policy` 3단 표준 복제 후 바탕화면(`D:\Desktop\<방침서명>.hwpx`) 신규 저장 |
| **AP-H2** | 내면 심리 대변·추상적 법령 서술("관련 법령에 의거") | 탈감정 사실 및 ｢지역보건법｣ 등 조·항·호·목 정확 인용 (Rule P) |
| **AP-H3** | 날짜 마침표 누락(`2026. 9. 14`), 붙임 1공백, `  끝.` 앞 2공백 누락 | `2026. 9. 14.`, `붙임  `, 문서 마감 `  끝.` 엄수 |
| **AP-H4** | 마크다운·채팅 내 깨짐 PUA(`U+F03DA`), 이중 불릿(`- ❍`), 문단 병합 | 채팅·마크다운 `## ▣`·`### ▢`·단일 `- ` 1문장 1줄(`U+F03DA`는 XML 전용) |
| **AP-H5** | `<hp:t>` 수정·복제 후 `<hp:linesegarray>` 미갱신·`<hp:run>` 앞 배치 | `recalc_tc_linesegs`·`layout_sec_paragraph` 재계산 및 `ensure_linesegarray_last` |
| **AP-H6** | 셀 개행·중첩 표 확장 후 `<hp:cellSz>`·병합 행·`<hp:tbl>/<hp:sz>` 미동기화 | `heal_section_tables_and_layout`·`sync_table_geometry` 상향 전파 |
| **AP-H7** | 가변 표 `treatAsChar="0"` 부유 배치, `SQUEEZE`·`paraPr 129`·`0xFFFFFFFF` 방치 | `enforce_inline_table_flow`, `normalize_header_styles`, `get_cell_margins`(`141`) 적용 |
| **AP-H8** | 잘못된 `p_node.remove(extra_t)` 호출 또는 `<hp:lineBreak/>`·형광펜 꼬리 방치 | `set_p_text`·`flatten_t_node`로 `r0.remove(extra_t)` 및 유령 꼬리 제거 |
| **AP-H9** | 기작성 업데이트 시 `P[00]~P[06]` 덮어쓰기, `BinData` 3중 매핑·G2B 하이픈 누락 | `P[00]~P[06]` 보존, `BinData`+`content.hpf`+`<hp:pic>` `px×75`, G2B `60109399-01` 적용 |

---

## ▣ 7. 출력 기준 및 사후 검증 게이트

- **공통 출력·평어체 SSOT 위임:** 채팅 출력 형식·표 우선·1문장 1줄·`Rule M`·`Rule P`·4대 자가 점검 게이트는 `AGENTS.md`를 준수함.
- **도메인 사후 검증 게이트:**
  - `python scripts/privacy_guard.py --scan <초안.md>` 개인식별정보 및 G2B 오탐 0건 확인함.
  - `scratch/generate_new_hwpx.py` 로그 내 `Verified 0 overlap defects` 및 `100% identical ZIP headers` 확인함.
  - 확정 법정 기한·문서 색인·후속 과업의 `SCHEDULES.json`·`ADMIN_DOC_INDEX.json`·`WORKING_MEMORY.json` 환류 완료 확인함.
