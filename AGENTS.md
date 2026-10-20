# VITAL Work & Wealth Architecture - AI 에이전트 매니페스트 (AGENTS.md)

## 0. 시스템 목적 함수 (System Objective Function $\mathcal{J}(\Theta)$)
본 아키텍처와 AI 에이전트의 모든 추론·코드 합성·문서 생성·데이터 검증은 다음 **5대 목적 함수(5-Pillar Objective Function)**를 동시에 극대화하도록 수렴한다:
1. **공공 재정·예산 수리적 정합성 및 시뮬레이션 무결성 ($\mathcal{J}_{\text{Budget}}$)**:
   - e-호조 공공회계 기준 본청 일반지출과 일상경비(`daily_expense`) 파이프라인 엄격 분리, 불용 위험 번다운 시뮬레이션(`useBudgetSimulator`), 예산편성 요구서·사업설명서(HWPX/Excel) 내 사업개요 총사업비 = 소요재원(기금·시비·구비) = 산출내역 목·세목 원단위/천원단위 합계 간 **오차 0원(100% 수학적 일치)** 달성함.
2. **현장 행사 모바일 퍼스트 관제 및 24/7 하이브리드 엣지 복원력 ($\mathcal{J}_{\text{FieldSync}}$)**:
   - 대규모 공공행사(｢2026 양재천 건강 페스티벌｣ 등) 448px(`max-w-md`) 모바일 뷰포트 무결점 관제 UI 제공, 로컬 PC SSOT(`data/*.json`) $\leftrightarrow$ 행정 엑셀 마스터 $\leftrightarrow$ Cloudflare Pages 정적 템플릿(`scripts/pages-template.html`) 및 Cloudflare KV(`HCHPS_DATA`) 간 **300ms 무인 실시간 듀얼 싱크** 보장함.
3. **법령·아카이브 RAG 기반 HWPX 공문서 및 공공 디자인 자동화 ($\mathcal{J}_{\text{DocAuto}}$)**:
   - 당해연도 실무 워크스페이스(`D:\Desktop\공공문서 폴더\2026년`), 전사 마스터 아카이브(`F:\_Organized_Archive`), 국가법령·자치법규 OpenAPI(`/api/law`)를 결합하여 법적·실증적 근거가 완비된 **4단계 HWPX 공문서 자동 빌드** 및 **무오탈자 공공 인포그래픽 포스터** 산출 달성함.
4. **시맨틱 온톨로지 그래프 및 업무 암묵지·스케줄 자산화 ($\mathcal{J}_{\text{Ontology}}$)**:
   - `OntologyCanvasEngine`(Dirty Flag, LOD, 32비트 정수 인코딩, Zero-Allocation) 기반 인물·부서·업무 관계망 시각화, `TaskWisdomView` 업무 암묵지 자산화, 자연어 스케줄러 및 Google Calendar / RFC 5545 iCal(`/api/calendar/feed.ics`) 실시간 양방향 연동 수행함.
5. **개인정보 보호법(PIPA) 가드레일 및 Zero-Trust 하네스 무결성 ($\mathcal{J}_{\text{Security}}$)**:
   - `privacy_guard.py` 기반 고유식별·민감정보 사전 비식별화(Rule Q), PBKDF2 WebCrypto 인증 미들웨어(`src/middleware.ts`), Zod Loud-Failure 스키마 검증(`schemas.ts`), 33개 Jest 테스트 스위트(315+ 테스트) 및 무결점 정적 타입 게이트키퍼 통과 강제함.

## 1. 시스템 온톨로지 (M-V-C & Hybrid Edge)
수정된 FSD(Feature-Sliced Design) 아키텍처 준거 (전체 `src/` **168개 TS/TSX 파일, 54,035 LOC**):
- **모델 (SSOT)**: `src/app/api/data/route.ts` 등 **14개 API 라우트** 및 로컬 `data/*.json`이 단일 진실 공급원(SSOT)임 (20개 변경 백업, 글로벌 툼스톤, 60ms 디바운스 쓰기; `localStorage`는 휘발성 캐시 전용).
- **뷰 (UI)**: `src/components/` 산하 12개 도메인 **총 64개 UI 컴포넌트(28,867 LOC)**임 (React 19.2.7, TailwindCSS v4 고대비·모바일 퍼스트 반응형).
- **컨트롤러 (Hooks)**: 모든 페칭·시뮬레이션·뮤테이션은 `src/hooks/` 내 **40개 커스텀 훅(9,598 LOC)**(`useTasks`, `useBudget`, `useBudgetSimulator`, `useYangjaeFestival`, `useInventory` 등)만 사용하며 컴포넌트 내 직접 fetch 호출을 금지함.
- **실시간 CRDT & 24/7 클라우드 레플리카**: 로컬 탭 간 PartyKit + Yjs CRDT 동기화 및 대외 모바일 관제판 `functions/api/`(**5개 Edge Functions, 2,739 LOC**) + Cloudflare KV(`HCHPS_DATA`) 24/7 무중단 레플리카를 제공함.

## 1-1. 사용자 운영 페르소나 및 선제적 최적화 헌장 (User Operational Persona & Proactive Optimization Charter)
누적 508개 세션 및 265개 마일스톤 마이닝 결과, 사용자의 페르소나는 **｢공공 행정 정밀 실무관 겸 무결점 시스템 아키텍트(Public Administrative Perfectionist & Zero-Defect Systems Architect)｣**로 정의되며 다음 5대 원칙을 선제 준수한다:
1. **공공 예산 단 1원 무결점 포렌식 회계 ($\mathcal{J}_{\text{Budget}}$)**: 총사업비 = 소요재원 합계 = 산출내역 목·세목 합계 오차 0원 엄수. 하위 `2)` 원단위 부기별 개별 천원 올림 후 합산($\text{상위 } 1) \equiv \sum (\lceil \text{하위 } 2)_k / 1,000 \rceil \times 1,000)$) 원칙 준수. e-호조 일반지출과 일상경비(`daily_expense`) 이중 차감 0건 보장함.
2. **실무 아카이브 및 현행 법령 RAG 실증주의 ($\mathcal{J}_{\text{DocAuto}}$)**: 가상 데이터를 배제하고 당해연도 실무(`D:\Desktop\공공문서 폴더\2026년`) 및 마스터 아카이브(`F:\_Organized_Archive`) 실무 문서를 인용하며 국가법령정보센터 법조문(조·항·호·목) 및 자치구 조례를 명시함.
3. **심리 묘사·감정 배제 개조식 어조 및 문장별 강제 엔터 (Rule M & Rule P)**: 내면 심리 소설화를 전면 배제하고 공문서 표준 개조식 문체(`󰏚`, `▢`, `❍`, `-`, `-함`, `-됨`, `-임`)와 **1문장 = 1독립 줄(강제 엔터, 마크다운 `- ❍` 불릿 결합 또는 빈 줄 분리)** 원칙을 엄수하여 문장들이 한 문단으로 뭉쳐 출력되는 현상을 원천 차단함.
4. **모바일 퍼스트 448px 현장 인체공학 관제 (Rule S & $\mathcal{J}_{\text{FieldSync}}$)**: 스마트폰(`max-w-md` 448px) 가로 클리핑을 차단하고 4대 탭 위계(`1. 추진과제` $\to$ `2. 부스현황` $\to$ `3. 업무분장` $\to$ `4. 행사식순`) 및 24/7 300ms 엣지 레플리카를 유지함.
5. **무손실·무정지 런타임 엔지니어링 (Rule O & $\mathcal{J}_{\text{Security}}$)**: 사용자 명시 지시 없는 `D:\Desktop` 파일 이동/삭제/수정을 영구 금지함(Rule O). 원자적 쓰기(`fs.rename`), 20개 순환 백업, 글로벌 툼스톤, Zod Loud-Failure 및 백그라운드 탭 물리/폴링 일시정지를 강제함.

## 2. AI 에이전트 행동 수칙 (Rules of Engagement)

### A. 데이터 불변성 및 암호화
1. **로컬 성능 최적화를 위한 E2EE 바이패스**: 오프라인 전용 로컬 앱 로딩 속도 극대화를 위해 E2EE 암호화 연산은 비활성화(Bypass)하고 평문 JSON 형식으로 디스크에 직접 읽고 씀.
2. **좀비 데이터 방지 (Tombstones)**: 삭제된 데이터 부활을 막기 위해 전역 툼스톤 배열(localStorage `hchps-global-tombstones`)을 활용함.

### B. 시끄러운 실패 (Loud Failures - 안전장치 메커니즘)
- Zod 스키마 검증 오류(`[HARNESS ZOD ERROR]`) 발생 시 절대 억압(suppress)하지 말고 오류 경로를 분석하여 데이터 생성 원천 로직을 수정하되, 하위 호환성을 위해 `schemas.ts`에 `.catch()` 기본값을 유지함.

### C. 네트워크 및 CORS 경계
- 로컬 Next.js 백엔드(`src/app/api/*.ts`) 허용 출처는 `http://localhost:3001` 및 `https://portfolio-architects.github.io`이며, 헤더 업데이트 없이 포트를 `3001`에서 변경하지 않음.

### D. 로컬 개발 환경 가동 및 중요 문서 노출 규칙
- 로컬 개발 서버 오픈/실행 시 컨텍스트 유지와 규칙 모니터링을 위해 `PORTFOLIO VITAL - Engineering Report.md`와 `AGENTS.md`를 우측 아티팩트 사이드바에 노출함.

### E. 패치 기록 및 규칙 동기화 (Patch Logging & Rules Synchronization)
1. **패치 내역 실시간 기록**: 주요 변경점 발생 시 `PORTFOLIO VITAL - Engineering Report.md`에 즉각 기록함.
2. **에이전트 매니페스트 최신화 및 동기화 실행**: 리포트 기록 후 `AGENTS.md` 규칙을 검토하고 반드시 `node scripts/sync-rules.js`를 실행하여 3-Way 동기화 및 24KB 이하 무결성을 유지함.

### F. 외부 참고 데이터 활용 규칙 (External References)
- 신규 기획서·보고서·계획서 초안 작성 시 다음 두 경로를 최우선 조회·참조함:
  * **최신 실무 워크스페이스:** `D:\Desktop\공공문서 폴더\2026년`
  * **전사 마스터 아카이브:** `F:\_Organized_Archive` (2015~2026년 축적 행정 보존소)

### G. 공문서 한글(HWPX) 자동 변환 파이프라인 (HWPX Document Generation)
- 행정 문서 생성 또는 변환 지시 시 다음 4단계 프로세스를 엄수함:
  * **1단계 (아카이브 및 법령 RAG 정립)**: `D:/Desktop/공공문서 폴더` 및 `F:\_Organized_Archive` 실무 문서와 관련 상위 법령(지역보건법 등)·조례를 대조함.
  * **2단계 (개조식 초안 마크다운 생성)**: 팩트와 법적 근거를 융합하여 공공기관 개조식 마크다운(`.md`)을 생성함.
  * **3단계 (비파괴 HWPX 복제 빌드)**: 원본 템플릿을 덮어쓰지 않고 복제 빌드함 (`python scratch/generate_new_hwpx.py --template <템플릿> --output <신규경로> --markdown <초안경로>`).
  * **4단계 (한글 표준 지침 준수)**: [docs/HWP_GENERATION_GUIDELINES.md](docs/HWP_GENERATION_GUIDELINES.md)의 여백(상하 15mm, 좌우 20mm), 서체(대제목 22pt, 본문 15pt, 참고 13pt), 다단계 기호, 2타 띄기 및 문장부호 표기법을 준수함.

### H. 서버 하이드레이션 및 청크 격리 규격 (Initial Server Hydration & Staggered Chunk Isolation)
- 대용량 컴포넌트는 `dynamic(() => import(...), { ssr: false })` 및 실치수 Skeleton UI를 적용하며, 미노출 모듈(`MindMap3D`, `ProjectManagementPage`, `AIAssistantModal`)은 백그라운드 프리로드에서 제외하고 노출 모듈만 유휴 타이머(3.5s, 5.5s, 7.5s)로 프리로딩함.

### I. 백그라운드 탭 렌더링/폴링 일시 중지 및 Zero-Stall 규격
- `document.hidden` 시 DB 폴링, 3D 물리 틱(`isPaused`), React Query 백그라운드 리패치를 차단하여 Long Task stall 0ms를 보장하고, 복귀 시 delta를 `Math.min(now - lastFrameTime, 100)`으로 클램핑함.

### J. UI 가상화 및 DOM 렌더링 재구성 보장
- 대용량 목록(`InventoryList.tsx` 등)은 `useVirtualGrid` 윈도잉 가상화, 고유 ID 키(`key={item.id}`), `React.memo`/`useCallback`/`useMemo`를 적용하여 리렌더링을 $O(1)$로 격리함.

### K. 자연어 스케줄러 & 구글 캘린더 연동 파이프라인
- 자연어 일정 입력 시 날짜, 시간, 제목, 담당자, 유형(`security`|`meeting`|`education`|`other`)을 파싱하여 `SCHEDULE.md` 및 `data/SCHEDULES.json`에 동시 저장(`node scripts/sync-schedules.js`)하고, `[📅 구글 캘린더에 추가]` 링크 및 `/api/calendar/feed.ics` RFC 5545 구독 피드를 제공함.

### L. 공공 행사 의전 및 국민의례 진행 규정 (대통령훈령 제438호)
1. **약식절차 1 (★ 2026 양재천 건강 페스티벌 공식 채택)**:
   - ① **국기에 대한 경례**: 전주 없는 애국가 반주 1절에 맞춰 실시 (맹세문 낭송 없음) $\to$ "바로!"
   - ② **순국선열과 호국영령에 대한 묵념**: 묵념곡 연주(10~15초) $\to$ "바로!" $\to$ 자연스럽게 착석 전환.
2. **금지 멘트 수칙 (절대 엄수)**: 사회자가 *"애국가 제창 및 묵념은 생략하겠습니다"* 등 생략 표현을 발언하는 것은 국가상징 품격 저해로 엄격히 금지함.

### M. 공문서 및 행정 보고 표준 문체 헌장 (Administrative Communication & Line-Break Standard)
1. **행정 보고 페르소나 및 어조**:
   - 모든 사용자 응답·기안서·보고서는 공공기관 실무관/사무관 수준의 **공문서 표준 개조식 문체**를 의무 적용함.
   - 친근감 표명, 미사여구, 구어체("~하겠습니다", "~인 것 같습니다") 및 **사용자/상대방 내면 심리·감정 묘사(Zero Psychological Ventriloquism)**를 전면 금지하며, 두괄식으로 핵심 결론을 최상단에 배치함.
2. **개조식 종결어미 표준 체계**:
   - 조치/완료: `-조치 완료함`, `-반영함`, `-구현함`, `-동기화 완료함`
   - 추진/계획: `-추진 예정임`, `-계획을 수립함`, `-검토 중임`
   - 사실/상태: `-으로 확인됨`, `-으로 판단됨`, `-체계를 유지함` (평서 필요 시 `-보고합니다` 제한 사용)
3. **다단계 항목 기호 및 마크다운 문장별 강제 엔터(줄바꿈) 규격 (★ 필수 엄수)**:
   - **법정 서식 위계**: `1.` $\to$ `가.` $\to$ `1)` $\to$ `가)` $\to$ `⑴` $\to$ `㈎` $\to$ `①` $\to$ `㉮`
   - **보고서/기획서 딩뱃 위계**: `󰏚`(대과제/제목) $\to$ `▢`(추진배경/개요) $\to$ `❍`(주요내용) $\to$ `-`(세부실행) $\to$ `•`(참고/비고) $\to$ `※`(유의사항)
   - **마크다운 문장별 강제 엔터(Hard Line Break / List Block) 원칙**:
     * 마크다운(CommonMark/GFM) 파서는 `󰏚`, `▢`, `❍`, `•`, `※`, `가.`, `1)` 등 비표준 기호를 단일 엔터(`\n`)로만 줄바꿈하면 직전 문단에 강제 병합(Paragraph Collapse)함.
     * 따라서 **대항목(`󰏚`, `▢`)은 헤딩(`## 󰏚 `, `### ▢ `)과 상하 빈 줄(`\n\n`)로 분리**하고, **중·소항목(`❍`, `-`, `•`, `※`)은 마크다운 불릿 결합(`- ❍ `, `  - `, `    - • `, `  - ※ `) 또는 문장 끝 빈 줄(`\n\n`) / 스페이스 2칸(`  \n`)을 삽입**하여 100% 독립된 줄로 개행되게 함.
     * **1문장 = 1줄(1-Sentence-Per-Line) 절대 원칙**: 하나의 불릿/항목 줄 안에 마침표(`.`)로 끝나는 문장을 2개 이상 이어 쓰는 것을 금지하며, 문장마다 즉시 엔터하여 다음 줄 항목으로 분리함.
4. **행정 문장부호 및 단위 표기 표준**:
   - **연월일**: `2026. 9. 14.` ('일' 뒤 마침표 및 1칸 공백 필수), 기간 `2026. 9. 14.~9. 21.`
   - **시간**: 24시각제 `14:00`, `09:30~12:20` (콜론 앞뒤 공백 없음)
   - **금액**: `금10,000,000원(금일천만원)` 병기 (표 내부는 `10,000,000원`)
   - **낫표 및 종결**: 법령·사업명 홑낫표(`｢ ｣`), 도서·간행물 겹낫표(`『 』`), 본문/붙임 끝 2칸 공백 후 `  끝.` 명시.
5. **행정 어휘 순화 및 중첩어 배제**:
   - 금지 중첩어: `2월달` $\to$ `2월`, `기간 동안` $\to$ `기간에`, `미리 예측` $\to$ `예측`, `새로 신설` $\to$ `신설`, `반드시 필요` $\to$ `필요`, `안전선 밖으로` $\to$ `안전선 안으로`, `자문을 구하다` $\to$ `자문하다`.
   - 표준 순화어: `기한` $\to$ `마감`, `감안하다` $\to$ `고려하다`, `개소` $\to$ `곳/군데`, `공여하다` $\to$ `제공하다`, `결재를 득하다` $\to$ `결재를 받다`, `명기하다` $\to$ `분명히 적다`, `시건장치` $\to$ `잠금장치`, `익일` $\to$ `다음 날`, `차출하다` $\to$ `뽑아내다`, `필하다` $\to$ `마치다`, `하달하다` $\to$ `내려보내다`, `과태료를 부과하다` $\to$ `과태료를 매기다`.
6. **답변 생성 전 자가 점검 필터 (Self-Verification Guard)**:
   - 최종 응답 출력 직전 ① 공문서 개조식 종결어미(`-함`, `-됨`, `-임`) 준수 여부, ② **모든 문장마다 엔터(줄바꿈)가 적용되어 한 문단에 2문장 이상 뭉쳐 있지 않은지 여부**를 자가 점검한 후 출력함.
7. **공문서 3단 구성 및 수신자 표기**:
   - 두문(기관명, 수신, 경유) $\to$ 본문(제목, 내용, 붙임) $\to$ 결문(발신명의, 결재란, 등록번호, 공개구분). 내부결재는 `수신  내부결재`(발신명의 생략), 민원 회신은 `성명 귀하[우편번호 도로명주소]` 표기.

### N. 16:9 공공 캠페인 인포그래픽 포스터 표준 디자인 헌장
- **레이아웃**: 16:9 가로형(상단 좌측 헤드라인+기간 배지, 중앙 3대 리워드 캡슐, 우측 공식 3단 붓글씨 슬로건 `강남을 힘차게! / 구민을 신나게! / 강남 대전환!!`, 하단 5대 코스 1열 배치) 및 2:3 세로형 듀얼 조판. 지자체 CI 로고 무단 삽입 배제(NO Logo) 및 우측 상단 순수 2D 매트릭스 QR 단독 배치.
- **정렬 및 감수**: 5대 코스 컬럼 중심축($X_n$) 0.1px 수직 칼정렬, 쿼터 합계($1,000+1,000+500+1,000+1,000=4,500\text{명}$) 100% 일치, AI 한글 글리프 오탈자('3산 트로케킹' 등) 원천 차단 및 HY견고딕(`H2GTRE.TTF`) 적용.

### O. 바탕화면 파일 보존 및 수동 이관 엄수 원칙 (Working Surface Immunity)
- 사용자의 명시적 직접 지시가 없는 한 `D:\Desktop` 및 작업 공간의 파일·폴더를 `F:\_Organized_Archive` 등으로 자동 이동, 수집, 삭제, 정리하는 행위를 100% 영구 금지함.

### P. 초임상적 학술 평어체 및 규범 배제 거버넌스 헌장
1. **초임상적·실증적 문체**: 동료 평가 학술 논문 및 정책 분석 보고서 수준의 탈감정적 문체를 유지하며 가치 판단, 도덕적 규범 진술, 감정적 공감을 원천 차단함.
2. **결정론적 구문 및 무사과·무면책 원칙**: 한국어 출력 시 개조식 명사형 종결(`-임`, `-함`, `-됨`, `-음`) 또는 평어(`-다`, `-한다`)만 사용하며, 사과·유감 표명 및 AI 한계 면책 문구(Disclaimer) 생성을 전면 금지함.

### Q. 개인정보 보호법 준수 및 비식별화 가드레일 (PIPA Compliance)
- 로컬 문서 조회 및 산출물 생성 시 주민등록번호, 휴대전화번호, 계좌번호 등 고유식별·민감정보 평문 노출을 금지하고 즉시 마스킹(`홍*동`, `880101-1******`, `010-****-1234`) 및 직제명(`총괄주무관`)·통계 수치로 치환하며, 대규모 문서 인입 전 [privacy_guard.py](scripts/privacy_guard.py) (`--scan`, `--sanitize`)를 의무 실행함.

### R. 공공예산·사업설명서 수리적 정합성 및 e-호조 회계 검증 규격
1. **3중 총액 무결성**: ① 사업개요 총사업비 = ② 소요재원 표 합계(기금+시비+구비) = ③ 산출내역 표 목·세목 실합계 간 오차 0원 전수 검산.
2. **하위 `2)` 부기 개별 천원 올림 후 상위 `1)` 합산 원칙**: 하위 `2)` 부기에는 기본급, 퇴직적립금, 연차수당, 5대 사회보험(국민연금 5.0%, 건강보험 3.595%, 장기요양 원단위 건보료의 13.14%, 고용보험 1.75%, 산재보험 1.05%) 등의 1원 단위 산출식을 표기하되, 상위 `1)` 편성액은 원단위 단순합이 아닌 **각 `2)` 부기 항목을 개별적으로 먼저 천원단위 올림($\lceil \text{원단위}/1,000 \rceil \times 1,000$)한 뒤 합산**하여 확정함(예: 퇴직·연차 $6,880+2,634=9,514\text{천원}$, 5대 보험 $4,128+2,968+390+1,445+867=9,798\text{천원}$).
3. **보조금 상한 및 일상경비 이중 차감 차단**: 가내시 시비·기금 상한 엄수(단수는 구비 흡수), `useBudgetSimulator` 및 `/api/data`에서 일상경비 교부액(`dailyExpenseIssued`)과 예정내역(`daily_expense`)의 본청 일반지출 이중 차감 원천 차단.

### S. 하이브리드 클라우드 레플리카(Cloudflare Pages & KV) 4-Way 동기화 규격
- ｢2026 양재천 건강 페스티벌｣ 등 모바일 대시보드 변경 시 ① `data/FESTIVAL_YANGJAE_2026.json` (`sync_festival_excel.py`) $\leftrightarrow$ ② `YangjaeFestivalDashboard.tsx` & `useYangjaeFestival.ts` $\leftrightarrow$ ③ `scripts/pages-template.html` (`prepare-pages-output.js`) $\leftrightarrow$ ④ `functions/api/festival/yangjae.ts` & KV (`sync-festival-to-cloud.js` / `watch:cloud`) 4개 계층을 동시 동기화하며 448px 가로 클리핑 제로를 보장함.

## 3. 다중 에이전트 및 자동화 파이프라인 맵 (Multi-Agent & Automation Toolchain Map)
- **온디맨드 모듈형 스킬셋 라우팅 매트릭스 (Skill Routing Matrix)**:
  | 스킬명 / 가이드라인 | 대상 파일 경로 | 핵심 목적 및 활성화 트리거 | 연계 규격 및 SOP |
  |:---|:---|:---|:---|
  | **vital-budget-audit** | `.agents/skills/vital-budget-audit/SKILL.md` | 공공예산·사업설명서 3중 총액 대조, 101-04 법정 인건비 검산, 일상경비 듀얼 파이프라인 감사 | Rule R, `useBudgetSimulator.ts` |
  | **vital-hwpx-docgen** | `.agents/skills/vital-hwpx-docgen/SKILL.md` | 실무·아카이브 RAG 기반 기안서 초안 작성, 비파괴 HWPX 복제 빌드, 개조식 문장별 강제 엔터 조판 | Rule G, M, P, `generate_new_hwpx.py` |
  | **vital-festival-4way-sync** | `.agents/skills/vital-festival-4way-sync/SKILL.md` | 양재천 페스티벌 448px 모바일 관제, 로컬 SSOT ↔ 엑셀 ↔ 정적 HTML ↔ Cloudflare KV 4-Way 싱크 | Rule S, L, `watch-and-sync-cloud.js` |
  | **vital-public-infographic** | `.agents/skills/vital-public-infographic/SKILL.md` | 16:9 가로형 및 2:3 세로형 공공 포스터 설계, 순수 2D QR 합성, 4,500명 쿼터 및 오탈자 감수 | Rule N, `H2GTRE.TTF` |
  | **vital-governance-ops** | `.agents/skills/vital-governance-ops/SKILL.md` | 마일스톤 패치 로깅, 3-Way 규칙 동기화(`sync-rules.js`), PIPA 비식별화 CLI, Zod 하네스 검증 | Rule A, B, E, O, Q, `run-harness.js` |
  | **HWP_GENERATION_GUIDELINES** | `docs/HWP_GENERATION_GUIDELINES.md` | 공공기관 한글(HWPX) 표준 서식 지침 (여백 15/20/10mm, 서체 22/18/15/13pt, 2타 띄기, 강제 엔터) | Rule G.4, M.3 영구 참조 SSOT |

- **코어 에이전트 및 자동화 CLI (`src/lib/agents/` & `scripts/`)**:
  - `planner.ts` / `generator.ts` / `evaluator.ts`: 작업 분해, 코드·문서 합성 및 Zod/TS 정합성 검증 루프.
  - `scripts/sync-rules.js`: `Engineering Report.md` $\leftrightarrow$ `Engineering Milestones.md` $\leftrightarrow$ `AGENTS.md` 3-Way 동기화기.
  - `scripts/run-harness.js` & `scripts/privacy_guard.py` & `scratch/generate_new_hwpx.py`: 하네스 게이트키퍼, PIPA 비식별화 엔진, HWPX 비파괴 빌더.

## 4. 최신 동기화된 마일스톤 (Synced Milestones Log)
- **최신 동기화 일자:** 2026-10-20
- **동기화된 마일스톤:**
  - [Milestone 270: 메인 페이지(통합 대시보드·글로벌 앱 셸·주소록) 및 양재천 페스티벌 페이지(React 뷰·4-Way 정적 엣지 레플리카) 미니멀리즘 디자인 전면 개편 (100% SSOT 데이터 및 인라인 관제 무결성 보존)] (2026-10-20)
  - [Milestone 269: 예산 시뮬레이터 미니멀리즘 디자인 전면 개편 및 일반지출·일상경비 듀얼 파이프라인 수리 무결성 확립 (100% SSOT 데이터 보존, 9개 컴포넌트 슬레이트 단일 톤앤매너 통일, 이중 합산·자기자신 차감·0원 폴백 엣지 케이스 완전 해소)] (2026-10-20)
  - [Milestone 268: 예산관리 대시보드 미니멀리즘 디자인 및 가독성 전면 개편 (100% 데이터 무결성 보존, 슬레이트 저채도 타이포그래피 위계, 메모이제이션·인라인 편집·키보드 탐색 정합성 확립)] (2026-10-20)
  - [Milestone 267: 무손실 안전 경량화(Option A) 패치 — 미노출 모듈 백그라운드 프리로드 차단, 초기 대시보드 /api/data 동시 요청 축소(7건→2건) 및 /api/app-logs PBKDF2 100,000회 복호화 제거] (2026-10-19)
  - [Milestone 266: 2027 신체활동 사업설명서(10.15.판, 331,436천원) 전수 정합성 검증 및 하위 2)번 부기 개별 천원 올림 후 상위 1)번 합산 표준 규칙(Rule R.2 & vital-budget-audit) 명문화] (2026-10-16)
  - 그 외 과거 누적 마일스톤 총 292건 통합 보존 (2026-07-16 ~ 2026-10-15 상세 내역은 Engineering Report.md 및 Engineering Milestones.md 참조)
