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

## 3. 다중 에이전트 파이프라인 맵
- `src/lib/agents/planner.ts`: 작업 분해 및 컨텍스트 검색.
- `src/lib/agents/generator.ts`: 실행 및 코드 합성.
- `src/lib/agents/evaluator.ts`: Zod 스키마 및 TypeScript 검증 피드백 루프.

## 4. 최신 동기화된 마일스톤 (Synced Milestones Log)
- **최신 동기화 일자:** 2026-09-07
- **동기화된 마일스톤:**
  - [Milestone 127: Section Chief Phone Official Extension 7010 (02-3423-7010) Reaffirmation & Precision Sync Release] Reaffirmed and updated Section Chief (과장님/보건행정과장) official direct line to 02-3423-7010 (ext: 7010) across STAFF_PHONE_MAP, attendee badge linkers, DetailEditRow placeholder, pages-template.html Cloudflare replica, and CONTACTS.json SSOT with 100% test pass (25/25 Festival Tests, 238/238 All Tests). (2026-09-07)
  - [Milestone 126: Section Chief Phone 02-3423-7116 Update & Agency J-Min (Kim Da-hee) 010-8494-0544 Contact Integration Release] Updated Section Chief (과장님/보건행정과장) official phone number to 02-3423-7116 (ext: 7116) and integrated Agency J-Min (제이민 커뮤니케이션 / 김다희 팀장님) 010-8494-0544 (ext: 0544) across festival dashboard STAFF_PHONE_MAP, attendee badge linkers, peoplePattern regex, pages-template.html Cloudflare replica, and CONTACTS.json SSOT with 100% test pass (26/26 Suites, 238/238 Tests). (2026-09-07)
  - [Milestone 125: Sidebar Navigation Tab Streamlining & MindMap/Project Deprecation Release] Streamlined Sidebar.tsx top/dock navigation to 3 core modules (대시보드, 예산관리, 양재천 페스티벌), removing redundant mindmap and project tabs per user preference while preserving modular route integrity and zero regression in global test suites. (2026-09-07)
  - [Milestone 124: Next.js Middleware Route Protection Delegation, Sidebar Navigation Tab Parity & MindMap Interactive Node Creation Restoration for Playwright E2E Release] Restored official src/middleware.ts and unified with src/proxy.ts, eliminating || isDev || isLocalHost bypass so unauthenticated visitors redirect to /login while maintaining public bypasses for /festival, /api/festival, /api/calendar, /api/auth. Restored mindmap and project tabs in Sidebar.tsx with Lucide icons Network and FolderKanban. Restored interactive canvas double-click handling and '새 노드 추가' modal in MindMap3D.tsx, resolved useBudgetSimulator synchronous mutation, achieving 100% Jest pass (26/26 Suites, 238/238 Tests) and 0 TypeScript compiler errors. (2026-09-07)
  - [Milestone 123: Integrated Budget Risk Burn-down Monitoring & Execution Commitment Simulator Release] Unified isolated 불용 위험 모니터링 (11 risk categories) and 예산 시뮬레이터 into an integrated commitment accounting and burn-down hub. Connected simulation plans to SSOT BUDGET_ENTRIES.json as isPlanned: true, wired 1-click settlement lifecycle (정산 전환) with status badge tracking, and added real-time burn-down header metrics and QuickPlanModal actions in BudgetDashboard. (2026-09-07)
  - [Milestone 122: Recursive Self-Improvement Loop & Autonomous Evolution Harness Decommission Release] Deleted self-evolution.js and diagnose-targets.js scripts, eliminated background 3-minute schedule tick (RSI_TICK) infinite loop instructions from AGENTS.md manifest, streamlined run-harness.js into pure Zod database integrity & ESLint verifier, completely stopping uncommanded commits and autonomous codebase mutations. (2026-09-07)
  - [Milestone 120: Global Test Suite 100% Pass (26/26 Suites, 238/238 Tests), Auth Decoupling & Optimistic Cache Mutation Synchronization Release] Fixed LoginPage test text & placeholder discrepancies, eliminated redundant onSettled query cache invalidations in useBudget & useContacts, wired MindMap3D engine lifecycle & unmount destroy cleanup, restored mindmap & project views in ProtectedApp, achieving 0 errors across entire CI test harness and TypeScript compiler. (2026-09-07)
  - [Milestone 119: Budget Dashboard Risk Alert Compact Card & Collapsible 2-Column Grid UX Optimization Release] Bulky risk alert banner replaced with compact 1-line mini-card, 2-column scrollable grid expander, information overload resolution, with 0-error gatekeeper test pass. (2026-09-07)
  - [Milestone 118: SNS Preview Metadata (OpenGraph/Twitter) & Zero-Framework Cloudflare Pages Standalone Static Engine Release] OpenGraph and Twitter metadata tags, zero-framework standalone pages template, zero-redirect bundle compiler with 25/25 test suite pass. (2026-09-04)
  - [Milestone 117: Medical Category Multi-Alias Filter Integration, 8-Milestones/12-Booths Fallback Sync & Pages Build Optimization Release] Full multi-alias mapping for medical categories (전문 의료·검진, 의료·검진, 의료 검진), complete 8-milestones & 12-booths fallback data synchronization, Pages build script integration, with 25/25 test suite pass. (2026-09-04)
  - [Milestone 116: Cloudflare Pages 24/7 Read-Only Replica API & Local SSOT Dual-Sync Engine Release] Cloudflare Pages Function replica endpoint, local SSOT dual-sync publisher with offline fallback, workers types configuration, with 25/25 test suite pass. (2026-09-04)
  - [Milestone 115: Yangjae Festival Team Leader Phone Extension Official 7031 Update & Multi-Alias Extension Mapping Release] Kim Ji-young team leader official extension updated to 7031 with multi-alias support (지영팀장님, 지영 팀장님, 김지영팀장), placeholder update, with 25/25 test suite pass. (2026-09-04)
  - 그 외 과거 누적 마일스톤 총 200건 통합 요약 (초기 ~ 2026-09-04 이전 패치 내역)
