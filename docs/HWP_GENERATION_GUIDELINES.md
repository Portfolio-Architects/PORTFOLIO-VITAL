# 대한민국 공공기관 한글(HWPX) 표준 서식 및 자동 생성 종합 지침서
# (Permanent Public Administration HWPX Generation Guidelines)

**관리 번호:** `VITAL-DOCS-HWPX-2026-V7`  
**제정 일자:** 2026. 10. 14. (개정: 2026. 11. 16.)  
**단일 진실 공급원(SSOT):** `docs/HWP_GENERATION_GUIDELINES.md`  
**적용 대상:** 방침서(`방침서 예시.hwpx` 3단 표준 · `5. 방침서.hwpx` 폴백 기반 바탕화면 출력), 공문서·기안문·보고서, 채팅창 응답 출력 및 컴파일 스크립트(`scratch/generate_new_hwpx.py`)

---

## ▣ 1. 총칙 및 기본 원칙

### ▢ 1. 제정 목적
- ｢행정업무의 운영 및 혁신에 관한 규정｣(대통령령) 및 공공기관 공문서 작성 표준에 근거하여, 시스템 내 모든 HWPX 문서와 AI 채팅창 행정 보고의 규격·서체·여백·위계·문장부호 일관성을 확립함.

### ▢ 2. 3대 기본 원칙
- **비파괴 복제 (Non-Destructive Replication):** 원본 템플릿(`.hwpx`) 직접 수정·덮어쓰기를 엄격히 금지하며, 신규 대상 경로로 복제한 뒤 `Contents/section0.xml` 본문 텍스트 노드만 치환함.
- **제어 객체 100% 보존:** 표(`hp:tbl`), 글상자(`hp:box`), 그림(`hp:picture`/`hp:pic`), 수식(`hp:equation`) 구조 원형을 유지함.
- **행정 개조식 및 채팅 간결 출력 (Rule M & P):** 감정·내면 심리 묘사·구어체를 배제하고 개조식(`-함`, `-됨`, `-임`)을 적용하며, 채팅·마크다운에서는 깨짐 PUA(`U+F03DA`)·이중 불릿(`- ❍`/`- •`/`- ※`)을 금지하고 `## ▣`/`### ▢`·단일 `- `로 **1문장 = 1줄**을 준수함.

---

## ▣ 2. 문서 유형별 표준 레이아웃

### ▢ 1. 방침서·정책보고서 및 사업계획서 (`--policy`)
- **최우선 표준 양식 & 출력 가드 (★ 필수 엄수):**
  - 1순위 `방침서 예시.hwpx`(부재 시 `5. 방침서.hwpx` 공백 갑지 폴백)를 `D:\Desktop\` $\to$ `D:\Desktop\_Organized_Archive\` $\to$ `F:\_Organized_Archive\` 순 자동 탐색함.
  - 출력물은 반드시 **바탕화면(`D:\Desktop\<방침서명>.hwpx`)**에 신규 저장하며 원본 덮어쓰기를 차단함(`assert_non_destructive_paths`, 예시 사진 `BinData/image2~5` `prune_unreferenced_bindata` 제거, `Preview/PrvText.txt` 재합성).
- **3단 표준 구조 (`방침서 예시.hwpx` 기준):**
  1. **1쪽 전자결재 표지 (`P000`~`P003`, `69,419 <= 71,436` HWPUnits):** 개인정보 배너·결재란(`등록번호`·`공개구분`·`주무관~부구청장`·`*협조1~22`), 표지 제목 박스(`tc[@name="제목"]`, `HY견고딕 17pt` 소제목 + `28pt` 본제목), 강남구 심볼(`BinData/image1.png`)·표지 연월(`휴먼명조 23pt 진하게`), 하단 기관·부서명(`강   남   구` `28pt` / `(보건행정과)` `23pt 진하게`).
  2. **2쪽 사전검토서 (`P004`, `pageBreak="1"`):** `【 관련 규정 및 제반사항 사전검토서 】`(`HY견고딕 22pt`, `#000080` 헤더) 9대 항목(① 관련 규정, ② 공직선거법, ③ 추진 경위, ④ 예산 사항, ⑤ 수혜자, ⑥ 공공갈등 등급 `①~⑫`, ⑦ 분야별 검토 `[계속/신규]`·`①~⑤`, ⑧ 타 기관 사례, ⑨ 전문가 자문).
  3. **3쪽+ 정식 본문 (`pageBreak="1"`):**
     - 제목 배너(`3x1` 표: `17pt` 소제목 + `28pt` 본제목) $\to$ 목적 요약 상자(`1x1` 상단 `0.1mm`·하단 `0.7mm` `#808080`, `HY중고딕 15pt`, 줄간격 `180%`) $\to$ 버건디 로마숫자 배지(`Ⅰ~Ⅴ`, 좌측 `#AE3E5A` `HY견명조 20pt 진하게` 백색 + 우측 `#7F7F7F` `0.7mm` `HY견고딕 18pt`) $\to$ `▢`(`15pt`)·`❍`(`14pt`, `(부서명)` 진하게)·`-`(`12pt`)·`※`(`13pt`) $\to$ 좌우 개방형 도표(좌우 `NONE`, 헤더 `#F2F2F2`+하단 `DOUBLE_SLIM 0.7mm`, `맑은 고딕 11pt`, 최하단 `0.4mm` 실선) $\to$ `CLICK_HERE` `fieldEnd` 균형 후 `  끝.`.

### ▢ 2. 상황·동향보고서 / 회의보고서 / 행사보고서 골격
| 유형 | 1단계 (`▣` / HWPX `U+F03DA`) | 2단계 (`▢`) | 3~4단계 (`❍` · `-`) | 마감 (`▢` · 도표) |
|:---|:---|:---|:---|:---|
| **상황·동향보고서** | 발생 개요(일시·장소·유형·경위) | 피해 현황(인명 비식별·시설·추이) | 주요 조치 실적(응급·공조·대응반) | 향후 조치 계획 · 보고자 직제명 |
| **회의보고서** | 회의 개요(회의명·일시·장소·주재) | 참석자 현황(비식별 준거) | 상정 안건(`❍`) · 토의 요지(`-`) | 심의·의결 결과 · 향후 이행 계획 |
| **행사·결과평가서** | 행사 개요(명칭·일시·장소·참여) | 공식 식순(훈령 제438호 약식 1) | 부스·코스(`❍`) · 안전/의료(`-`) | 예산 집행 결산(도표) · 개선점(`▢`) |

---

## ▣ 3. 용지 규격 및 여백 기준 (A4 국배판)

| 여백 구분 | 표준 수치 (mm) | 한글 내부 단위 (HWP Unit) | 비고 |
|:---|:---:|:---:|:---|
| **용지 규격** | $210.0 \times 297.0$ | $59,528 \times 84,188$ | A4 표준 국배판 |
| **위쪽 / 아래쪽 여백** | **15.0 mm** | 4,252 unit | 문서 상·하단 여백 |
| **왼쪽 / 오른쪽 여백** | **20.0 mm** | 5,669 unit | 좌·우 편철 기본 여백 |
| **머리말 / 꼬리말 여백** | **10.0 mm** | 2,835 unit | 쪽 번호·기관명 · 누락 방지 가드 |
| **제본(편철)** | **0.0 mm** | 0 unit | 상철/좌철 기본값 0 |

---

## ▣ 4. 서체 및 글자 크기 위계 (일반 공문·보고서 기준)

- **표준 서체:** 본문(휴먼명조·한양신명조·한컴바탕), 헤드라인/도표(맑은 고딕·KoPub돋움·HY헤드라인M), 포스터/사이니지(`HY견고딕` `H2GTRE.TTF`).

| 위계 레벨 | 대표 용도 | 글자 크기 | 속성 | 장평 / 자간 | 정렬 / 줄간격 |
|:---|:---|:---:|:---:|:---:|:---:|
| **문서 대제목** | 최상단 안건명 (`▣` / `U+F03DA`) | **22 pt** | 진하게 | 100% / -5% | 가운데, 160% |
| **중간 제목 (1단계)** | 추진배경, 개요, 기본방침 (`▢`) | **16 ~ 18 pt** | 진하게 | 100% / -5% | 양쪽, 160% |
| **소제목 / 핵심내용** | 주요내용, 세부추진과제 (`❍`) | **15 pt** | 보통/진하게 | 100% / -5% | 양쪽, 160% |
| **일반 본문 문단** | 구체적 서술·실행 항목 (`-`) | **15 pt** | 보통 | 100% / -5% | 양쪽, 160% |
| **세부 실행 부기** | 산출근거·일정·장소 (`•`) | **13 ~ 14 pt** | 보통 | 100% / -3% | 양쪽, 150% |
| **도표 내부 텍스트** | 표 헤더 및 셀 데이터 | **11 ~ 13 pt** | 보통/헤더 진하게 | 95% / -5% | 중앙/수치 우측, 130% |
| **각주 및 유의사항** | 법령 출처, 주의사항 (`※`) | **11 ~ 12 pt** | 보통 | 95% / -5% | 양쪽, 130% |

---

## ▣ 5. 다단계 기호 위계 및 AI 채팅·마크다운 출력 표준

### ▢ 1. 법정 공문서 8단계 위계 (대통령령 제31380호)
```text
1. 첫째 (15pt, 진하게, 0타) -> 가. 둘째 (2타) -> 1) 셋째 (4타) -> 가) 넷째 (13~14pt, 6타)
   -> ⑴ 다섯째 (13pt, 8타) -> ㈎ 여섯째 (10타) -> ① 일곱째 (12pt, 12타) -> ㉮ 여덟째 (14타)
```

### ▢ 2. 기획서·보고서 딩뱃 위계 (HWPX XML 전용)
```text
[체크딩뱃 U+F03DA] 대과제/제목 (22pt 진하게, 뒤 1~2타) -> ▢ 중간제목 (16~18pt 진하게, 뒤 1타)
  -> ❍ 주요내용 (15pt, 뒤 1타) -> - 세부항목 (15pt, 들여쓰기 2타) -> • 보충 (13~14pt, 4타) -> ※ 유의사항 (11~12pt)
```

### ▢ 3. AI 채팅창 및 마크다운 문서 표준 출력 규격
- **깨짐 PUA·이중 불릿 전면 금지:** 웹 폰트 깨짐을 유발하는 `U+F03DA`는 HWPX XML에만 사용하며, 채팅·마크다운은 `## ▣`·`### ▢` 및 단일 네이티브 불릿(`- **[핵심 라벨]**` $\to$ `  - `)만 사용함(이중 불릿 `- ❍ `, `- • `, `- ※ ` 금지).
- **2단계 간결 위계 & 1문장 = 1줄:** 단답(5줄 이내)은 `## ▣` 직하단 단일 불릿 2~4줄, 복합 보고는 두괄식 요약 1~2줄 후 최대 `## ▣` $\to$ `### ▢` 및 2단계 리스트로 제한하며 한 줄 내 마침표 문장 2개 이상 연기를 금지함.
- **표·링크·유의사항 분리:** 3개 이상 비교·수치 항목은 마크다운 표(`---:`/`:---:`)로 구조화하고, 파일은 basename 기반 `[파일명](file:///절대경로#L시작-L끝)` 클릭 링크로, 주의사항은 하단 독립 줄 `> ※ **[유의사항]** ...함.`으로 분리함.

---

## ▣ 6. 띄어쓰기 및 문장부호 표기 표준

### ▢ 1. 2타 띄기 규칙
- **항목·들여쓰기:** 항목 기호 직후 1~2타 띄기, 하위 항목은 직전 상위 항목 글자 시작점에서 2타 들여쓰기 적용함.
- **붙임 및 문서 종결:** `붙임  1. 세부계획서 1부.`(2타 띄기, 다수 시 `1.` 아래 정렬) 및 본문·붙임 마지막 글자 뒤 정확히 2공백 후 `  끝.` 표기함.

### ▢ 2. 행정 문장부호 및 단위 표기
- **연월일:** `2026. 9. 14.`('일' 뒤 마침표+공백 필수; 기간 `2026. 9. 14.~9. 21.`).
- **시간·금액:** 24시각제 `14:00`, `09:30~12:20` / 본문 금액 `금10,000,000원(금일천만원)`(도표 셀 `10,000,000원`).
- **낫표:** 법령·규정·훈령·지침·사업명은 홑낫표(`｢ ｣` / `< >`), 도서·간행물·신문은 겹낫표(`『 』` / `《 》`).

---

## ▣ 7. XML 인플레이스 빌드 파이프라인 및 5대 텍스트 겹침 원천 차단 규격 (`scratch/generate_new_hwpx.py`)

### ▢ 1. 4단계 실행 파이프라인 및 실시간 아카이브·양식·법령 참조 규격
```text
[Step 1] F:\_Organized_Archive(2015~2026) · D:\Desktop\_Organized_Archive · D:\Desktop(읽기 전용) + data/ADMIN_DOC_INDEX.json · ARCHIVE_INDEX.json + /api/law · DRF(OC=LAW_API_KEY 50자)
   ▼
[Step 2] 개조식 마크다운 초안 (메타데이터 · 1문장 1줄 · 개조식 -함/-됨 · G2B 8자리-2자리 하이픈 · privacy_guard.py --scan)
   ▼
[Step 3] 비파괴 복제 (방침서 예시.hwpx --policy / 5. 방침서.hwpx / template.hwpx) -> header.xml 정규화 -> 순수 hp:t 치환 -> 5대 겹침 차단 재계산 -> ZIP Bit-2 패치
   ▼
[Step 4] verify_hwpx_no_overlap() 0건 결함 검증 및 온톨로지 역방향 환류 (SCHEDULES.json · ADMIN_DOC_INDEX.json · WORKING_MEMORY.json)
```
- **국가법령·자치법규·행정규칙 실시간 조회 (`src/app/api/law/route.ts` & 법제처 DRF):**
  - **인증·IP:** `.env.local` 내 `LAW_API_KEY`(`open.law.go.kr` 50자 `OC` 식별값, 평문 노출 금지) + 등록 공인 IP 사용.
  - **로컬 API:** 목록 `/api/law?target={law|ordin|admrul}&query=<검색어>`, 본문 `/api/law?target={law|ordin|admrul}&mst=<일련번호>&type=XML|HTML`.
  - **직접 DRF:** 목록 `http://www.law.go.kr/DRF/lawSearch.do?OC=$LAW_API_KEY&target={law|ordin|admrul}&type=XML&query=<검색어>`, 본문 `law`·`ordin`은 `MST=<일련번호>`, `admrul`은 `ID=<행정규칙일련번호>`로 `lawService.do` 호출 후 `<law id="...">`/`<admrul id="...">`/`<ordin id="...">` 및 `<![CDATA[...]]>` 값을 파싱함.

### ▢ 2. XML 텍스트 인플레이스 치환 규칙
- **제어 객체 격리 (`has_ctrl_objects`):** `hp:tbl`, `hp:box`, `hp:picture`, `hp:pic`, `hp:equation`, `hp:rect`, `hp:container` 및 머리말·꼬리말 포함 문단은 본문 일괄 치환에서 격리함.
- **순수 런 단일화 (`set_p_text` / `update_paragraph_text`):** 첫 번째 런(`r0`) `charPrIDRef`를 보존하고 잉여 `hp:t`는 `r0.remove(extra_t)`, 잉여 `hp:run`은 `p_elem.remove(extra_r)`로 정리함.
- **표 셀 매핑 (`set_tc_lines`):** 파이프라인 테이블을 `<hp:tc>/<hp:subList>/<hp:p>` 행·열(`colAddr`)에 순차 매핑하고 줄 세그먼트를 재계산함.

### ▢ 3. 5대 텍스트 겹침(Text Overlap) 원천 차단 엔진 규격 (★ 필수 엄수)
- **[규격 1] `<hp:linesegarray>` 동적 재계산 및 자식 순서 강제 (`recalc_tc_linesegs`, `layout_sec_paragraph`, `ensure_linesegarray_last`):** `wrap_text_positions`(한글 `0.90`·영숫자 `0.45 × vertsize × scale`)로 `textpos`와 단조 증가 `vertpos`(`vertsize + spacing`)를 재계산하고, `<hp:linesegarray>`를 항상 모든 `<hp:run>` 뒤 `<hp:p>`의 마지막 자식으로 배치함.
- **[규격 2] 표 셀·중첩 표·병합 행·호스트 문단 연쇄 동기화 (`sync_table_geometry`, `heal_section_tables_and_layout`):**
  - 셀 높이(`<hp:cellSz height>`)를 `cum_vertpos - last_spacing + top_m + bot_m` 이상으로 갱신하고, `rowSpan == 1` 행 높이를 통일하며, 엇갈린 `rowSpan > 1` 병합 행은 구간 행 합산 제약식으로 역산함.
  - 모든 표를 깊이 역순(최하위 중첩 표 $\to$ 외곽 표)으로 순회해 `<hp:tbl>/<hp:sz height>` 및 직속 호스트 `<hp:lineseg vertsize/textheight/baseline>`까지 연쇄 반영함.
- **[규격 3] 인라인 배치(`treatAsChar="1"`) 강제 (`enforce_inline_table_flow`):** 가변 표의 부유(`treatAsChar="0"`) 겹침을 막기 위해 `<hp:pos treatAsChar="1" vertOffset="0"/>`으로 정규화함.
- **[규격 4] 엑셀 압축 스타일 정규화 및 `0xFFFFFFFF` 여백 클램핑 (`normalize_header_styles`, `get_excel_defective_ids`, `get_cell_margins`):** `header.xml`의 `lineWrap="SQUEEZE"` $\to$ `"BREAK"`, `paraPr 129` 음수 들여쓰기 $\to$ `0`, 줄간격(`<100%`) $\to$ `130%`로 정규화하고 결함 엑셀 문단 참조(`129`, `119`, `styleIDRef="45"`)만 비압축(`condense="0"`)으로 치환하며, `<hp:cellMargin>`의 `4,294,967,295`(`0xFFFFFFFF`) 상속값(`raw < 0` 또는 `raw >= 10000`)을 `141` HWPUnits로 클램핑함.
- **[규격 5] 다중 `<hp:run>`/`<hp:t>` 및 인라인 유령 꼬리 제거 (`flatten_t_node`, `set_p_text`):** `<hp:lineBreak/>`, `<hp:fwSpace/>`, `<hp:markpenBegin/>` `.tail` 유령 텍스트를 평탄화·제거하고 실제 부모 노드에서 잉여 노드를 삭제함.

### ▢ 4. ZIP 헤더 패치, 기작성 치유, 화보 `BinData` 3중 매핑 및 G2B 가드
- **ZIP 헤더 복원 (`patch_zip_flags`):** 로컬(`PK\x03\x04`+6) 및 중앙 디렉토리(`PK\x01\x02`+8) 압축 플래그 Bit 2(value 4)를 `struct.pack_into('<H', ...)`로 복원함.
- **기작성 HWPX 인플레이스 치유:** 기존 `P[00]~P[06]`(표지·사전검토서·제목배너·목적요약) 원본 `<hp:linesegarray>`를 보존하고 변경 본문·표에만 `normalize_header_styles`·`heal_section_tables_and_layout`을 적용함.
- **화보 `BinData` 3중 매핑:** ① `BinData/imageN.png` 물리 저장 + ② `Contents/content.hpf` `<opf:item id="imageN" href="BinData/imageN.png" media-type="image/png" isEmbeded="1"/>` 등록 + ③ `Contents/section0.xml` `<hp:pic binaryItemIDRef="imageN" treatAsChar="1">`의 `orgSz`/`imgRect`/`imgClip`/`imgDim`=`px×75` HWPUnits, `curSz`·`scaMatrix = curSz/orgSz` 및 호스트 `<hp:lineseg vertsize>` 3중 동기화.
- **G2B 10자리 표준 하이픈 표기:** `privacy_guard.py` 은행계좌(`ACCOUNT`) 오탐 차단을 위해 `세부품명번호 60109399-01`(`8자리-2자리`) 표준 형식을 적용함.

### ▢ 5. 실행 CLI 명령어 표준
```bash
# [방침서 1순위] 바탕화면 '방침서 예시.hwpx' 3단 표준 참조 바탕화면 신규 빌드
python scratch/generate_new_hwpx.py --policy --output "D:/Desktop/2026_신규사업_추진계획.hwpx" --markdown "scratch/draft_policy.md"

# [일반 공문서] 기본 템플릿 기반 빌드
python scratch/generate_new_hwpx.py --template "public/templates/template.hwpx" --output "D:/Desktop/2026_신규사업계획서.hwpx" --markdown "scratch/draft_proposal.md"
```

---

## ▣ 8. 자가 점검 및 사후 확인 체크리스트 (7대 영역 · 16대 세부 항목)

- [ ] **[여백·폰트]** 상하 15.0mm, 좌우 20.0mm, 머리/꼬리 10.0mm 및 대제목 22pt·중간 16~18pt·본문 15pt·세부 13pt 준거 여부
- [ ] **[기호·레이아웃]** HWPX `U+F03DA`→`▢`→`❍`→`-` 적용 및 채팅·마크다운 깨짐 PUA·이중 불릿 0건, 2단계 위계·표 우선·클릭 링크·1문장=1줄 준수 여부
- [ ] **[띄어쓰기·종결·표기]** 기호 뒤 1~2타, 들여쓰기 2타, `붙임  ` 2타, 말미 `  끝.`, 날짜(`2026. 9. 14.`), 24시각제(`14:00`), 금액 병기, 홑낫표 준거 여부
- [ ] **[문체·보안·G2B]** Rule P(감정·심리 묘사 배제), `privacy_guard.py --scan` 노출 0건 및 G2B 하이픈(`60109399-01`) 준수 여부
- [ ] **[줄세그·표기하학·인라인]** `<hp:linesegarray>` 최하단 배치(`dup_vpos_cells == 0`, `inverted_order_p == 0`), 중첩 표 상향 동기화 및 `treatAsChar="1" vertOffset="0"` 여부
- [ ] **[압축·오버플로우·다중런]** `SQUEEZE`·음수 들여쓰기(`paraPr 129`)·`0xFFFFFFFF` 여백(`huge_height_cells == 0`) 및 유령 꼬리(`ghost_t_nodes == 0`) 차단 여부
- [ ] **[기작성치유·BinData·환류]** `P[00]~P[06]` 보존, `BinData` 3중 매핑(`px×75` HWPUnits) 및 `SCHEDULES.json`·`ADMIN_DOC_INDEX.json`·`WORKING_MEMORY.json` 환류 완료 여부

  끝.
