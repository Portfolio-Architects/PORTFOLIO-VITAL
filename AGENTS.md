# VITAL Work & Wealth Architecture - AI 에이전트 매니페스트 (AGENTS.md)


## 1. 시스템 온톨로지 (M-V-C)
이 저장소는 MVC 온톨로지가 혼합된 수정된 FSD(Feature-Sliced Design) 아키텍처를 엄격하게 따릅니다:
- **모델 (스토리지)**: `src/app/api/data/route.ts` (로컬 PC 디스크 `data/*.json`)가 단일 진실 공급원(SSOT)입니다. 최근 20개 변경 이력 자동 백업 및 60ms 디바운스 쓰기를 보장합니다. `localStorage`는 오직 휘발성 오프라인 캐시 역할만 수행하며 절대 주 데이터 소스로 사용되지 않습니다.
- **뷰 (UI)**: `src/components/dashboard` 및 기능별 서브 컴포넌트(41개 UI 모듈)입니다. React 19.2.7 및 TailwindCSS v4 표준 고대비 다크 테마 시스템을 적용합니다.
- **컨트롤러 (Hooks)**: 데이터 페칭 및 뮤테이션은 반드시 `src/hooks/` 내부의 React Query 커스텀 훅(예: `useTasks`, `useBudget`, `useInventory`)을 통해서만 수행되어야 합니다. 컴포넌트 내에서의 직접적인 fetch/API 호출은 엄격히 금지됩니다.
- **실시간 CRDT & 영속성**: PartyKit + Yjs CRDT 세션 및 `y-indexeddb`를 결합하여 다중 디바이스 간 오프라인 지원 및 실시간 무충돌 상태 동기화를 구현합니다.

## 2. AI 에이전트 행동 수칙 (Rules of Engagement)

### A. 데이터 불변성 및 암호화
1. **로컬 성능 최적화를 위한 E2EE 바이패스**: 로컬 개발 및 오프라인 전용 앱 특성에 맞게 새로고침 로딩 속도를 극대화하기 위해, E2EE 암호화 연산은 완전히 비활성화(Bypass)하고 평문(Plain Text) JSON 형식으로 디스크에 직접 읽고 씁니다.
2. **좀비 데이터 방지 (Tombstones)**: 로컬 파일 시스템은 결과적 일관성 이슈가 없으나, 다중 인스턴스 동기화 복원력을 위해 삭제된 데이터가 부활하는 것을 막고자 전역 툼스톤 배열(localStorage의 `hchps-global-tombstones`)을 활용해야 합니다.

### B. 시끄러운 실패 (Loud Failures - 안전장치 메커니즘)
코드를 뮤테이션하려다 Zod 스키마 검증 오류가 발생하면, 시스템이 경고를 발생시킬 것입니다 (`[HARNESS ZOD ERROR]`). 
- 이 오류들을 억압(suppress)하지 마십시오.
- 오류 페이로드를 읽고 정확히 어느 필드(경로)에서 타입 기대치를 충족하지 못했는지 파악하십시오.
- 하위 호환성을 위해 `schemas.ts`에 항상 대체 기본값(`.catch()`)을 제공하되, 근본적인 데이터 생성 로직 자체를 수정해야 합니다.

### C. 네트워크 및 CORS 경계
로컬 PC Next.js 백엔드(`src/app/api/*.ts`)는 접근 권한 및 출처를 통제합니다.
허용된 출처(Allowed Origins):
- `http://localhost:3001`
- `https://portfolio-architects.github.io`
이 헤더들을 업데이트하지 않고 localhost 포트를 `3001`에서 절대 변경하지 마십시오.

### D. 로컬 개발 환경 가동 및 중요 문서 노출 규칙
1. **로컬 개발 서버 기동 시 문서 아티팩트 자동 노출**: 로컬 개발 서버를 오픈/실행하는 작업을 인지하거나 수행할 때, 개발 컨텍스트 유지와 에이전트 준수 규칙을 즉시 모니터링하기 위하여 반드시 `PORTFOLIO VITAL - Engineering Report.md` 파일과 `AGENTS.md` 파일을 우측 아티팩트 사이드바(Artifact Sidebar)에 띄워야 합니다.

### E. 패치 기록 및 규칙 동기화 (Patch Logging & Rules Synchronization)
1. **패치 내역 실시간 기록**: 커밋 수행 또는 신규 프롬프트 입력 등 주요 작업 변경점(패치)이 발생할 때마다, 구체적인 변경 내역을 `PORTFOLIO VITAL - Engineering Report.md`에 즉각 기록해야 합니다.
2. **에이전트 매니페스트 동적 최신화**: 기록된 엔지니어링 리포트의 패치 내역을 토대로, `AGENTS.md` 파일의 아키텍처, 행동 수칙 및 파이프라인 규칙을 수시로 검토하고 즉각 업데이트해야 합니다.
3. **자동 동기화 도구 실행**: 패치 기록이 완료되면 반드시 `node scripts/sync-rules.js` 스크립트를 실행하여 `AGENTS.md` 파일 하단의 최신 동기화된 마일스톤 로그를 자동으로 최신화해 주어야 합니다.

### F. 외부 참고 데이터 활용 규칙 (External References)
1. **기획 및 계획서 초안 작성 시 우선 참조 경로**:
   - 향후 새로운 기획서, 보고서, 혹은 계획서의 초안을 작성할 경우, 반드시 아래 지정된 두 경로 내의 파일 목록을 조회하고 관련 자료를 우선적으로 분석·참고하여 작성해야 합니다:
     * **수동 이동된 데이터 경로:** `F:\부엉이_정리됨\2026년` (기초 보건 계획서, 결과보고서 및 공문서 서식)
     * **연도별 아카이브 경로:** `F:\부엉이_정리됨` (2021년~2026년 연도별 디렉토리 내 축적된 실무 업무 파일)

### G. 공문서 한글(HWPX) 자동 변환 파이프라인 (HWPX Document Generation)
1. **행정 보고서 한글(HWPX) 자동 문서화 종합 프로세스 (3-Step Pipeline)**:
   - 사용자가 행정 문서 생성 또는 "변환해줘" 지시를 내리면 에이전트는 다음 3단계 프로세스를 엄격히 이행하여 신규 문서를 빌드해야 합니다.
     * **1단계 (아카이브 검색 및 법적 근거 RAG 정립)**:
       - 바탕화면(`d:/Desktop`) 및 연도별 아카이브 폴더(`F:\부엉이_정리됨`) 내 축적된 실무 문서(견적서, 구성안, 이전 결과보고서 등)를 스캔하여 팩트 컨텍스트를 확보합니다.
       - 관련 상위 법령(예: 지역보건법, 국민체육진흥법) 및 지자체 조례(예: 강남구 구민체육진흥 조례)는 로컬 DB 및 RAG 검색을 통해 사실 관계를 엄밀히 대조·정립합니다.
     * **2단계 (기안서/사업계획서 초안 마크다운 생성)**:
       - 확보된 실무 아카이브 팩트와 법적 근거를 융합하여 격식 있고 전문적인 공공기관 개조식 문체로 작성된 기안서/사업계획서 초안 마크다운 파일(`.md`)을 scratch 또는 아티팩트 디렉토리에 우선 생성합니다.
     * **3단계 (HWPX 한글 파일 신규 변환 및 빌드)**:
       - 생성된 초안 마크다운 파일을 지정된 한글 템플릿 서식(제목 `󰏚`, 대항목 `▢`, 소항목 `❍`, 세부 사항 `-` 등)에 매핑하여 완전히 새로운 독립 HWPX 결과물 파일로 신규 빌드합니다.
       - 변환 시에는 [generate_new_hwpx.py](file:///d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL/scratch/generate_new_hwpx.py) 유틸리티 스크립트를 사용하여 다음과 같은 파라미터 포맷으로 구동합니다:
         `python scratch/generate_new_hwpx.py --template <템플릿경로> --output <신규출력경로> --markdown <초안마크다운경로>`
       - 기존 원본 템플릿 한글 파일을 직접 수정하거나 덮어쓰지 않고 항상 지정한 템플릿 문서를 복제하여 완전히 새로운 HWPX 결과물 파일로 신규 빌드하여 안전을 보장합니다.
     * **4단계 (한글(HWPX) 표준 준거 지침 준수)**:
       - HWPX 파일 변환 및 마크다운 기획 시, 반드시 [hwp_generation_guidelines.md](file:///C:/Users/user/.gemini/antigravity/brain/dd5595a2-5ca7-474f-b260-2c04417f5905/hwp_generation_guidelines.md)에 정립된 문서 유형별 레이아웃(정책/상황/회의/행사), 용지 여백(위/아래 15mm, 좌/우 20mm), 서체 크기(대제목 22pt, 일반 15pt, 참고 13pt), 다단계 항목 기호 분류(`Ⅰ.` -> `가.` -> `1)` -> `가)`), 2타 띄기 규칙(기호 후, 붙임 후, "끝." 앞) 및 문장부호 표기법(날짜, 시간, 금액, 낫표 구분)을 철저히 준수해야 합니다.

### H. 서버 하이드레이션 및 청크 격리 규격 (Initial Server Hydration & Staggered Chunk Isolation)
1. **Dynamic Import 필수 적용**: Next.js SSR 하이드레이션 불일치를 영구 차단하고 초기 JavaScript 청크 용량을 줄이기 위해 대용량 컴포넌트(`MindMap3D`, `PortfolioDashboardView`, `WorkspaceView`, `ProjectManagementPage`, `SecurityLockScreen`, `AppLogModal`, `AIAssistantModal` 등)는 반드시 `dynamic(() => import(...), { ssr: false })`로 동적 임포트합니다.
2. **Skeleton UI 가드 배치**: 동적 임포트 시 레이아웃 시프트(CLS)를 예방하기 위해 실치수 규격의 고대비 뼈대 컴포넌트(`WeeklySchedulerSkeleton`, `MindMap3DSkeleton` 등)를 fallback으로 구현해야 합니다.
3. **Staggered Chunk Preloading**: 초기 하이드레이션 마운트 완료 후 비동기 번들 프리로딩을 진행할 때, 메인 스레드 프리징을 막기 위해 `requestIdleCallback` 내에서 순차 지연 타이머(3.5s, 5.5s, 7.5s 등)를 적용합니다.

### I. 백그라운드 탭 렌더링/폴링 일시 중지 및 Zero-Stall 규격 (Zero-Stall & Visibility Pause Standards)
1. **탭 이탈 시 렌더링 & 폴링 일시 중지**: `document.hidden` 또는 탭 블러 시 DB 와처 폴링, 3D WebGL 물리 시뮬레이션 틱(`isPaused`), 및 React Query 백그라운드 리패치(`refetchIntervalInBackground: false`, `refetchOnWindowFocus: false`)를 완전 차단하여 Long Task stall 0ms를 보장합니다.
2. **탭 복귀 시 안전성 보장 (Whiplash 방지)**: 탭이 `'visible'` 상태로 복귀할 때 0ms 즉각 재개하되, delta 타임스탬프 간격을 `Math.min(now - lastFrameTime, 100)`으로 클램핑하여 물리 충돌 발산 및 순간 이동 현상을 격리 차단합니다.

### J. UI 가상화 및 DOM 렌더링 재구성 보장 (Virtualization & DOM Reconciliation Guard)
1. **윈도잉 가상화 적용**: 대용량 목록 및 타일 그리드(예: `InventoryList.tsx`)는 `useVirtualGrid` 등 Zero-Dependency 윈도윈 가상화 훅을 사용하여 상/하단 스페이서 높이만 유지하고 가시 영역의 DOM 노드만 렌더링합니다.
2. **안정적인 React Key 부여**: 가상화 목록이나 정렬 가능한 카드에는 배열 인덱스 키 사용을 엄격히 금지하고, 무작위 DOM 파괴를 막기 위해 객체의 고유 ID (`key={item.id}`)를 필수 부여합니다.
3. **Props 메모이제이션 및 단일 경로 전달**: `React.memo`, `useCallback`, `useMemo`를 활성화하여 부모의 임시 상태 변화가 하부 카드 및 3D 시뮬레이션 캔버스 전체 리렌더링을 일으키지 않도록 $O(1)$ 범위로 스코프를 차단합니다.

### K. 자연어 스케줄러 & 구글 캘린더 연동 파이프라인 (Natural Schedule & Google Calendar Pipeline)
1. **자연어 입력 즉시 파싱 및 듀얼 스토리지 반영**:
   - 사용자가 채팅창에서 일정을 자연어(예: *"내일 14시 보건소 회의"*, *"8월 28일 오전 10시 보안점검(오창선)"* 등)로 입력하면, 에이전트는 날짜, 시간, 제목, 담당자, 유형(`security`|`meeting`|`education`|`other`), 비고를 자동 파악하여 `SCHEDULE.md` 및 `data/SCHEDULES.json`에 즉시 동시 저장합니다.
   - 응답 완료 시 해당 일정의 요약과 함께 **구글 캘린더 원클릭 등록 링크([📅 구글 캘린더에 추가])**를 함께 제공합니다.
2. **iCal 실시간 구독 피드 제공**:
   - `/api/calendar/feed.ics` 엔드포인트를 통해 RFC 5545 표준 iCalendar 피드를 제공하며, 사용자가 구글 캘린더 웹에서 "URL로 캘린더 추가"를 통해 바이탈 전체 일정을 스마트폰 및 웹 캘린더에 실시간 구독할 수 있도록 지원합니다.
3. **양방향 동기화 지원**:
   - 마크다운 텍스트 또는 JSON 데이터의 정합성 유지를 위해 `node scripts/sync-schedules.js` 스크립트를 활용하여 `SCHEDULE.md`와 `data/SCHEDULES.json` 간의 양방향 동기화를 보장합니다.

### L. 공공 행사 의전 및 국민의례 진행 규정 (Protocol & National Ceremonies Standards)
1. **대통령훈령 제438호(국민의례 규정) 절차 체계**:
   - **정식절차**: 국기에 대한 경례(경례곡+맹세문) $\to$ 애국가 제창(1~4절 또는 1절) $\to$ 순국선열과 호국영령에 대한 묵념(묵념곡)
   - **약식절차 1 (★ 2026 양재천 건강 페스티벌 공식 채택)**:
     * ① **국기에 대한 경례**: 전주가 없는 애국가 반주 1절에 맞춰 실시한다 (국기에 대한 맹세문은 낭송하지 않음).
     * ② **순국선열과 호국영령에 대한 묵념**: 묵념곡을 연주하되 묵념곡이 없으면 구령으로 10~15초 정도 실시한다 (행사 성격에 따라 생략 가능).
   - **약식절차 2**: 국기에 대한 경례만 실시 (국기에 대한 경례곡 또는 구령에 따름, 맹세문 낭송 없음).
2. **사회자 표준 진행 대본 (약식절차 1 준거)**:
   - **개식 안내**: "다음은 국민의례가 있겠습니다. 내빈 및 구민 여러분께서는 모두 자리에서 일어나 단상의 국기를 향해 주시기 바랍니다."
   - **국기에 대한 경례**: "국기에 대하여 경례!" $\to$ (전주 없는 애국가 반주 1절 연주, 연주 종료 시까지 경례 자세 유지)
   - **구호**: "바로!"
   - **묵념**: "이어서 순국선열과 호국영령에 대한 묵념을 올리겠습니다. 일동 묵념!" $\to$ (묵념곡 연주 10~15초)
   - **구호**: "바로!"
   - **식순 전환**: "(생략 멘트 일체 없이 곧바로 자연스럽게 착석 전환)" $\to$ "모두 자리에 정돈해(앉아) 주시기 바랍니다. 다음은 오늘 행사를 빛내주시기 위해 참석하신 내빈 여러분을 소개해 올리겠습니다."
3. **금지 멘트 수칙 (절대 엄수)**:
   - 사회자가 *"애국가 제창 및 순국선열에 대한 묵념은 생략하겠습니다"*, *"애국가 제창 등 이하 생략하겠습니다"* 등의 생략 표현을 발언하는 것은 국가상징의 품격을 저해하므로 **규정상 엄격히 금지**합니다.
   - 약식절차 1에서는 국기에 대한 경례 시 전주 없는 애국가 반주 1절에 맞춰 경례하고 이어서 묵념곡을 연주하므로, 별도의 애국가 가창(제창) 시간 없이도 신속하고 품격 있는 공공 의전 규정을 완벽하게 충족합니다.

## 3. 다중 에이전트 파이프라인 맵
- `src/lib/agents/planner.ts`: 작업 분해 및 컨텍스트 검색.
- `src/lib/agents/generator.ts`: 실행 및 코드 합성.
- `src/lib/agents/evaluator.ts`: Zod 스키마 및 TypeScript 검증 피드백 루프.

## 4. 최신 동기화된 마일스톤 (Synced Milestones Log)
- **최신 동기화 일자:** 2026-09-10
- **동기화된 마일스톤:**
  - [Milestone 147: Universal Zero-Loss Persistence & Concurrency Pipeline & Instantaneous Zero-Lag Tab Switching Architecture Release] Implemented backend concurrency mutex queue (withSheetLock), BUDGET_SIMULATIONS disk SSOT with bidirectional sync, dormant sub-tab strategy across Workspace and Festival views, zombie background polling suppression via isActive flag, keystroke decoupling with blur auto-save in DetailEditRow and MindMapNoteEditor, Rule H skeleton UI guards, and resolved initialTab tab-lock loop and cross-node note flush with 100% test pass (32/32 Suites, 296/296 Tests). (2026-09-10)
  - [Milestone 146: Sub-Task Category Transfer Across Milestone Tasks & Interactive Transfer Modal Release] Implemented sub-task category transfer pipeline across milestone tasks with interactive modal, automatic destination accordion auto-expansion, SSOT persistence, and DetailEditRow & reading view triggers with 100% test pass (29/29 Festival Tests, 26/26 Suites, 242/242 Tests). (2026-09-10)
  - [Milestone 145: Health Festival Kim Ji-hyeon (7173), SNUH Gangnam (010-5663-8276), UD (010-5192-2210), Gangnam Cha Hospital (010-2698-0992) Contact Integration Release] Integrated Kim Ji-hyeon (02-3423-7173 / ext: 7173), SNUH Gangnam Center (010-5663-8276 / ext: 8276), UD Dental (010-5192-2210 / ext: 2210), and Gangnam Cha Hospital (010-2698-0992 / ext: 0992) across STAFF_PHONE_MAP, attendee badge linkers, DetailEditRow placeholder, pages-template.html Cloudflare replica, and CONTACTS.json SSOT with 100% test pass (27/27 Festival Tests, 26/26 Suites, 240/240 Tests). (2026-09-10)
  - [Milestone 144: Festival Booth Header Wrapping Guard, Synchronized 2-Column Matrix Alignment & Premium Dark Card Overhaul Release] Refactored Booth Header with whitespace-nowrap and styled capsule badge to eliminate word-splitting, converted KPI Banner into a synchronized 3-tier 2-column matrix layout with matching horizontal baselines and distinct status chips, and synchronized Cloudflare Pages replica with 100% test pass (27/27 Festival Tests, 26/26 Suites, 240/240 Tests). (2026-09-10)
  - [Milestone 143: Health Festival Booth Scale Parsing & Real-time Metrics (참여 주체 수 및 총 필요 부스 동수) Integration Release] Implemented dynamic booth scale parsing (parseBoothScale) and aggregate metric calculation (total/confirmed entities, total/confirmed/pending dong scale, and examination bus counts), embedded a high-contrast KPI banner at the very top of Booth Status across YangjaeFestivalDashboard and Cloudflare Pages replica (pages-template.html & out/), and updated header badge with 100% test pass (27/27 Festival Tests, 26/26 Suites, 240/240 Tests). (2026-09-09)
  - [Milestone 142: Festival Booth Category Binary Streamlining (민간 & 보건소 부서) Release] Streamlined booth category taxonomy from 3 legacy groups to binary classification ('민간' and '보건소 부서') across FESTIVAL_YANGJAE_2026.json SSOT (11 booths), YangjaeFestivalDashboard filter tabs and cards, useYangjaeFestival fallback, Cloudflare Pages replica (pages-template.html & out/), and Edge Functions with 100% test pass (25/25 Festival Tests, 26/26 Suites, 238/238 Tests). (2026-09-09)
  - [Milestone 141: Health Festival Kim Hyeong-jong Extension 7250 (02-3423-7250) & Korea Body Information (010-9985-3732) Contact Integration Release] Integrated Kim Hyeong-jong (02-3423-7250 / ext: 7250) and Korea Body Information (010-9985-3732 / ext: 3732) across STAFF_PHONE_MAP, attendee badge linkers, DetailEditRow placeholder, pages-template.html Cloudflare replica, and CONTACTS.json SSOT with 100% test pass (25/25 Festival Tests, 26/26 Suites, 238/238 Tests). (2026-09-09)
  - [Milestone 140: Budget Simulator Daily Expense Unexecuted Balance (교부액 중 미집행비용) Tracking & Effective Available Funds Surface Integration Release] Added dailyExpenseIssued, dailyExpenseSpent, and dailyExpenseRemaining tracking across useBudgetSimulator project and stat item summaries, surfaced unexecuted daily expense badges and real effective available funds in SimulationResultTable (Level 2 stat rows, Level 1 group headers, project view, and table footer), added dedicated ' 일상경비 교부목만' toolbar quick filter chip, and updated SimulationSummaryCards with 100% test pass (26/26 Suites, 238/238 Tests). (2026-09-09)
  - [Milestone 139: Budget Simulator Key Duplication & SSOT MergedEntries Deduplication Hardening Release] Resolved React duplicate key console warning (Encountered two children with the same key), hardened useBudgetSimulator mergedEntries bidirectional deduplication between local storage and BUDGET_ENTRIES.json, and added defensive indexed keys across SimulationResultTable and SimulationEntryList with 100% test pass (26/26 Suites, 238/238 Tests). (2026-09-09)
  - [Milestone 138: Budget Simulator Hierarchical Level 3 Drilldown & Grouped Entry List Release] Implemented Level 3 nested simulation entry drilldown with inline settlement/edit/delete actions in Stat Item Balance view, added dedicated 'Registered Stat Items Only' quick filter chip and bulk toggle, and introduced 'Grouped by Stat Item' view mode in SimulationEntryList with 100% test pass. (2026-09-09)
  - [Milestone 137: Festival Timetable, Booth Roster & Outreach Organization Real-time Sync Release] Synchronized updated festival timeline (booth operation extended to 13:30, walk incentive cutoff at 12:30, cleanup 13:30-14:30), confirmed Gangnam Korean Medicine Association booth (26.9.8), and added Yangjaecheon Keepers outreach across SSOT and Cloudflare replica with 100% test pass. (2026-09-08)
  - [Milestone 136: Festival Task Date Tile Expansion & Typography Legibility Overhaul Release] Expanded date tile width (min-w-70px/76px, 86px large font) and enlarged date font sizes (14.5px/15px short, 13.5px full, font-black slate-950) across YangjaeFestivalDashboard, pages-template.html and Cloudflare replica, resolving visual legibility issues with 100% test pass. (2026-09-08)
  - 그 외 과거 누적 마일스톤 총 213건 통합 요약 (초기 ~ 2026-09-07 이전 패치 내역)
