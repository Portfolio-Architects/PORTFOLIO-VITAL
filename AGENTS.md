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

### F. 재귀적 자가 개선 루틴 (Recursive Self-Improvement Routine) - 오토 & 진화형(Auto & Evolving)
1. **수시 자가 진단 및 리팩토링**: 매 작업 마무리 또는 특정 패치 반영 단계에서 코드의 비효율성과 아키텍처적 부채를 수시로 자가 진단하고, 자율적인 리팩토링 및 튜닝을 실행해야 합니다.
2. **자체 치유 루프 자동 가동**: 런타임/빌드 에러나 타입/Zod 스키마 검증 오류가 발견될 경우, 사용자의 개입을 기다리지 않고 자가 치유(Self-Healing) 프로세스를 실행하여 오류를 선제적으로 조치해야 합니다.
3. **재귀적 자기개선 시 최대 토큰 동원**: 자가 진단, 리팩토링, 또는 자가 치유(Self-Healing) 루프를 구동할 때는 문맥의 누락이나 텍스트 잘림을 방지하고 정확한 추론을 수반할 수 있도록 항상 안티그라비티 에이전트 자체의 생성 토큰 소비량을 최댓값(예: API 호출 한도인 `maxOutputTokens: 8192` 등)으로 설정하여 최대 한도의 토큰을 아낌없이 동원해야 합니다.
4. **오토-트리거 백그라운드 리팩토링**: 런타임 오류가 없더라도 사용하지 않는 코드, 타입 불안정성, 스타일 가이드 위배 등 린트 경고가 5개 이상 누적되거나 파일 와처(File Watcher)가 빌드 결과 비효율적인 모듈 번들을 감지하면 즉시 백그라운드 스케줄러(`schedule` 도구)를 통해 비동기 리팩토링 루프를 자동 트리거하고 결과를 리포트합니다.
5. **진화형 피드백 자동 병합 (Feedback Evolution Loop)**: 사용자 수정/거절 지시 유형을 분석하여, 수정 빈도가 높은 파일 계층(예: 3D 마인드맵 UI, 예산 대조 테이블 등)에 대해 컴포넌트 스타일 및 정합성 강화를 위한 '집중 보강 학습 모드'를 활성화하고, 관련 코드 생성 지침을 실시간으로 업데이트하여 프롬프트를 자가 진화시킵니다.
6. **무인 자율 배포 및 자동 승인(Non-Interactive Auto-Deployment)**: 백그라운드 크론/스케줄러(`task-442` 등)에 의해 자율 개선 틱이 수행될 때는, 사용자의 수동 개입(Proceed 대기)을 유발하는 `RequestFeedback: true` 설정을 **철저히 배제(false로 고정)**합니다. 리팩토링된 코드가 `run-harness.js` (eslint, zod, tsc) 검증을 통과하면, 어떠한 수동 승인 절차 없이 즉시 배포(Auto-Merge) 처리하여 무중단 무인 자율 구동을 실현합니다.

### G. 외부 참고 데이터 활용 규칙 (External References)
1. **기획 및 계획서 초안 작성 시 우선 참조 경로**:
   - 향후 새로운 기획서, 보고서, 혹은 계획서의 초안을 작성할 경우, 반드시 아래 지정된 두 경로 내의 파일 목록을 조회하고 관련 자료를 우선적으로 분석·참고하여 작성해야 합니다:
     * **수동 이동된 데이터 경로:** `F:\부엉이_정리됨\2026년` (기초 보건 계획서, 결과보고서 및 공문서 서식)
     * **연도별 아카이브 경로:** `F:\부엉이_정리됨` (2021년~2026년 연도별 디렉토리 내 축적된 실무 업무 파일)

### H. 공문서 한글(HWPX) 자동 변환 파이프라인 (HWPX Document Generation)
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

### I. 서버 하이드레이션 및 청크 격리 규격 (Initial Server Hydration & Staggered Chunk Isolation)
1. **Dynamic Import 필수 적용**: Next.js SSR 하이드레이션 불일치를 영구 차단하고 초기 JavaScript 청크 용량을 줄이기 위해 대용량 컴포넌트(`MindMap3D`, `PortfolioDashboardView`, `WorkspaceView`, `ProjectManagementPage`, `SecurityLockScreen`, `AppLogModal`, `AIAssistantModal` 등)는 반드시 `dynamic(() => import(...), { ssr: false })`로 동적 임포트합니다.
2. **Skeleton UI 가드 배치**: 동적 임포트 시 레이아웃 시프트(CLS)를 예방하기 위해 실치수 규격의 고대비 뼈대 컴포넌트(`WeeklySchedulerSkeleton`, `MindMap3DSkeleton` 등)를 fallback으로 구현해야 합니다.
3. **Staggered Chunk Preloading**: 초기 하이드레이션 마운트 완료 후 비동기 번들 프리로딩을 진행할 때, 메인 스레드 프리징을 막기 위해 `requestIdleCallback` 내에서 순차 지연 타이머(3.5s, 5.5s, 7.5s 등)를 적용합니다.

### J. 백그라운드 탭 렌더링/폴링 일시 중지 및 Zero-Stall 규격 (Zero-Stall & Visibility Pause Standards)
1. **탭 이탈 시 렌더링 & 폴링 일시 중지**: `document.hidden` 또는 탭 블러 시 DB 와처 폴링, 3D WebGL 물리 시뮬레이션 틱(`isPaused`), 및 React Query 백그라운드 리패치(`refetchIntervalInBackground: false`, `refetchOnWindowFocus: false`)를 완전 차단하여 Long Task stall 0ms를 보장합니다.
2. **탭 복귀 시 안전성 보장 (Whiplash 방지)**: 탭이 `'visible'` 상태로 복귀할 때 0ms 즉각 재개하되, delta 타임스탬프 간격을 `Math.min(now - lastFrameTime, 100)`으로 클램핑하여 물리 충돌 발산 및 순간 이동 현상을 격리 차단합니다.

### K. UI 가상화 및 DOM 렌더링 재구성 보장 (Virtualization & DOM Reconciliation Guard)
1. **윈도잉 가상화 적용**: 대용량 목록 및 타일 그리드(예: `InventoryList.tsx`)는 `useVirtualGrid` 등 Zero-Dependency 윈도윈 가상화 훅을 사용하여 상/하단 스페이서 높이만 유지하고 가시 영역의 DOM 노드만 렌더링합니다.
2. **안정적인 React Key 부여**: 가상화 목록이나 정렬 가능한 카드에는 배열 인덱스 키 사용을 엄격히 금지하고, 무작위 DOM 파괴를 막기 위해 객체의 고유 ID (`key={item.id}`)를 필수 부여합니다.
3. **Props 메모이제이션 및 단일 경로 전달**: `React.memo`, `useCallback`, `useMemo`를 활성화하여 부모의 임시 상태 변화가 하부 카드 및 3D 시뮬레이션 캔버스 전체 리렌더링을 일으키지 않도록 $O(1)$ 범위로 스코프를 차단합니다.

### L. 자연어 스케줄러 & 구글 캘린더 연동 파이프라인 (Natural Schedule & Google Calendar Pipeline)
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

## 4. 재귀적 자기 개선 (Recursive Self-Improvement) - 오토 & 진화형(Auto & Evolving)
시스템과 AI 에이전트는 지속적인 자기 진단, 자동 스케줄러(Auto-Loop), 그리고 패치 분석 기반 자율 학습(Self-Evolution)을 결합하여 영속적으로 성능을 향상시킵니다:
- **자가 치유 (Self-Healing - Auto)**: 평가자(Evaluator)가 Zod 스키마 또는 TypeScript 검증 오류(`[HARNESS ZOD ERROR]`)를 검출하면 사람의 개입 없이 에러 스택을 역추적해 데이터 로직을 자율 수정하며, 3회 이상 치유 실패 시 동적으로 대체 코드 경로(Fallback path) 및 `.catch()` 기본값을 생성하여 다운타임을 0으로 유지합니다.
- **코드 및 아키텍처 자동 리팩토링 (Auto-Refactoring)**: 런타임 지연 프로파일러 데이터와 에러 로그를 분석해 프레임 드랍(60 FPS 미만)이 빈발하거나, 번들 크기가 비대해진 모듈을 탐지하는 즉시 쉘 리팩토링 및 중복 렌더링 최적화 코드를 자동으로 작성·반영합니다.
- **무인 자율 승인 (Auto-Approval)**: 자율 개선에 의해 변형된 코드는 harness 테스트 통과 시 사용자의 승인 대기 없이 즉시 프로덕션 코드로 병합되며, 기안 승인 단계를 완전 우회하여 0-Interactive 무인 자동화 배포 파이프라인으로 작동합니다.
- **프롬프트 진화 루프 (Prompt Evolution - Evolving)**: 매 패치 및 트랜잭션 성공/실패 사례의 전후 맥락을 분석하고, RAG 지식베이스에 축적된 Reranking 및 Context Retrieval 성공률 데이터를 기반으로 프롬프트 구문을 동적으로 보강하고 최적의 지시 템플릿을 스스로 진화시킵니다.
- **에이전트 매니페스트 (AGENTS.md) 자체 개선 루프 (Manifest Evolution)**: 프로젝트의 발전 단계, 새로운 기술 부채 해결 결과 및 사용자 피드백을 정량 수치로 분석하여, `AGENTS.md`에 명시된 시스템 규칙 and 행동 지침을 스스로 검토하고 더 효율적인 규칙 구조로 자율 갱신 및 컴팩션(Compaction)합니다.
- **자가 진단 및 개선 오토 루프 (Auto-Loop Self-Improvement)**: 백그라운드 타이머 및 `schedule` 크론 작업(`task-122` 등)을 통해 3분마다 `run-harness.js`가 구동되어 `data/diagnose_report.json`이 자동 최신화됩니다. 에이전트는 틱 메시지를 수신하는 즉시 최신 진단 보고서를 로드하여 아키텍처 규칙 위반(UI 컴포넌트 내 직접 API 호출 등) 및 성능 병목(dynamic import 누락, 불필요한 useEffect 등) 요소를 자동으로 파악합니다. 파악된 핵심 결함에 대해 즉시 자율적으로 코드 최적화 패치를 실행하며, 하네스 검증 통과 후 사용자의 승인 개입을 완전히 생략하고 `[auto] self-improvement: optimize ...` 메시지와 함께 Git에 무인 배포(Auto-Commit & Auto-Merge)합니다.

### 4-2. 자율 진화 및 무한 루프 구동 프로토콜 (Autonomous Evolution Protocol)
1. **무한 틱 스케줄러 체인 (Infinity Tick Chain)**:
   - 에이전트는 작업 종료 및 유휴 상태 진입 시 반드시 `schedule` 도구를 사용하여 3분(180초) 뒤의 틱 알림(`Prompt: "RSI_TICK"`)을 설정해야 합니다.
   - 틱 알림이 오면 `run-harness.js` 및 `diagnose-targets.js`를 비동기로 구동하여 최신 진단 보고서를 로드하고, 미사용 코드나 잠재 성능 병목이 발견되면 사용자의 개입 없이 코드를 수정(Evolutionary Fix)합니다.
   - 수정 완료 및 하네스 검증 성공 시, 즉시 패치를 기록하고 **다시 3분 뒤의 `schedule` 틱을 연쇄 호출**하여 무한 진화 루프를 연결시킵니다.
2. **진화적 결함 탐색 모델 (Evolutionary Code Scanning)**:
   - 런타임/컴파일 에러가 없더라도, 다음 리팩토링 대상을 자율 색출합니다:
     - 돔 복잡성이나 중복 렌더링을 유발하는 UI 내 인라인 스타일/함수 선언.
     - `any` 타입 캐스팅 및 느슨한 타입 지정이 감지되는 라이브러리/컴포넌트.
     - 하드코딩된 상수 및 2회 이상 중복 구현된 유틸리티 함수.
   - **자동 성능 개선 강제 규칙 (Auto-Fix on Detection)**: `data/diagnose_report.json`에서 루프 복잡도 등 실질적인 성능 병목 요소가 1건 이상 탐지되는 즉시, 에이전트는 사용자의 개입을 기다리지 않고 해당 코드 영역을 자율적으로 리팩토링하여 최적화 패치를 즉각 자동 적용해야 합니다. 단순 결과 보고나 방치 행위는 엄격히 금지됩니다.
3. **자율적 안전 가드 및 복구 (Self-Rollback Guard)**:
   - 자율 패치 도중 ESLint, TypeScript(tsc) 빌드 검증 또는 Zod 무결성 테스트가 실패할 경우, 사용자의 승인 없이도 롤백 로직을 구동해 코드를 이전의 안전 상태로 복원합니다.
   - 3회 연속 실패한 동일 파일 영역에 대해서는 즉시 `[FALLBACK mode]`를 선언하고, 해당 코드 경로에 대한 동적 디버깅용 안전 가드 및 캐치 구문을 생성하여 전체 다운타임을 예방합니다.

### 4-3. 성능 도약 및 구조적 최적화 규격 (Performance Leap & Structural Optimization Standards)
에이전트는 단순히 정적 오류를 검사하고 현상을 파악하는 것에서 탈피하여, 실제로 런타임 속도와 반응성을 도약시키는 알고리즘 및 렌더링 구조 개편을 자율 수행해야 합니다:
1. **시간 복잡도 혁신 (Complexity Leap - 상시 필수 수행)**:
   - **진단 리포트가 0건이더라도 상시 구동하여**, 렌더 틱이나 상호작용 이벤트 내에 존재하는 순차 검색($O(N)$), 필터 루프, 또는 중복 순회 루프를 색출하고 **Map/Set 구조를 활용한 $O(1)$ 상수 시간 룩업**으로 즉각 강제 전환합니다.
   - BFS/DFS 그래프 탐색 시 노드/간선의 위상 변화가 없을 때는 캐시 데이터를 직접 반환하도록 **전역 위상 Dirty-Flag 기법**을 장착합니다.
2. **가비지 컬렉터(GC) 렉 영구 차단 (Zero-Allocation & Pooling)**:
   - 삼각함수 호출, 임시 캔버스 문자열 파싱, 렌더 루프 내 일시적 객체 생성 등 매 프레임 발생하는 GC 유발 영역을 검출합니다.
   - 폰트/텍스트 넓이 사전 로딩 및 캐싱, 회전 변환 행렬 캐싱, 간선/파티클용 **객체 Pool 패턴**을 자동 구현해 GC 힙 할당을 제로(0)화합니다.
3. **렌더 파이프라인 및 UI 스레드 격리 (Pipeline & Thread Isolation)**:
   - React와 WebSocket/Yjs 트랜잭션 결합 시 발생하는 과다 리렌더링 병목을 발견하면, 외부 상태 전파 시 `useSyncExternalStore`와 **16ms 디바운싱(Debounce) 락 가드**를 적용해 묶음 일괄 처리(Batching)를 강제합니다.
   - 최초 기동 또는 탭 전환 시의 UI 프리징 방지를 위해, 무거운 다중 컴포넌트는 **순차 분산 프리로드(Staggered Preloading)** 혹은 **동적 지연 임포트(`dynamic()` with `ssr: false`)**를 적용해 메인 스레드 점유율을 50% 이하로 격리합니다.
   - 부모 컴포넌트 리렌더링 전파를 방어할 수 있도록 렌더가 무거운 하부 뷰 및 카드에 대해 **`React.memo` 분할 기법 및 useCallback/useMemo 정교화**를 적극 적용합니다.
4. **정량적 벤치마크 검증 및 자율 피드백 병합 (Quantitative Verification Loop)**:
   - 최적화 패치 전후의 Next.js 빌드 청크 용량, 프레임 레이트(Target 60 FPS), API 응답 시간 변화를 수치화하여 분석합니다.
   - 최적화에 성공한 구조적 패턴은 `AGENTS.md` 및 프롬프트 룰에 자율적으로 병합(Evolution)시켜 향후 생성되는 컴포넌트가 해당 고성능 아키텍처를 기본 탑재하도록 유도합니다.

### 4-4. Gatekeeper 검증 및 Zero-Stall 보증 규격 (Gatekeeper & Zero-Stall Standards)
1. **전역 0-Stall 검증 조건**:
   - `npx tsc --noEmit` (TypeScript 컴파일 0 오류)
   - `node scripts/run-harness.js` (Zod 스키마 0 오류, ESLint 0 오류/경고, MVC 온톨로지 위반 0건)
   - Long Task Stall (> 100ms) 0건 달성 및 유지.
2. **자동화 검증 스위트 동기화**:
   - 무인 자율 구동 시 위 3개 검증 스위트를 통과한 변경 건만 자율 배포(Auto-Merge)되며, 패치 완료 시 `node scripts/sync-rules.js`를 구동하여 `AGENTS.md` 하단 마일스톤 로그를 100% 최신 상태로 유지합니다.

## 5. 최신 동기화된 마일스톤 (Synced Milestones Log)
- **최신 동기화 일자:** 2026-09-07
- **동기화된 마일스톤:**
  - [Milestone 120: Global Test Suite 100% Pass (26/26 Suites, 238/238 Tests), Auth Decoupling & Optimistic Cache Mutation Synchronization Release] Fixed LoginPage test text & placeholder discrepancies, eliminated redundant onSettled query cache invalidations in useBudget & useContacts, wired MindMap3D engine lifecycle & unmount destroy cleanup, restored mindmap & project views in ProtectedApp, achieving 0 errors across entire CI test harness and TypeScript compiler. (2026-09-07)
  - [Milestone 119: Budget Dashboard Risk Alert Compact Card & Collapsible 2-Column Grid UX Optimization Release] Bulky risk alert banner replaced with compact 1-line mini-card, 2-column scrollable grid expander, information overload resolution, with 0-error gatekeeper test pass. (2026-09-07)
  - [Milestone 118: SNS Preview Metadata (OpenGraph/Twitter) & Zero-Framework Cloudflare Pages Standalone Static Engine Release] OpenGraph and Twitter metadata tags, zero-framework standalone pages template, zero-redirect bundle compiler with 25/25 test suite pass. (2026-09-04)
  - [Milestone 117: Medical Category Multi-Alias Filter Integration, 8-Milestones/12-Booths Fallback Sync & Pages Build Optimization Release] Full multi-alias mapping for medical categories (전문 의료·검진, 의료·검진, 의료 검진), complete 8-milestones & 12-booths fallback data synchronization, Pages build script integration, with 25/25 test suite pass. (2026-09-04)
  - [Milestone 116: Cloudflare Pages 24/7 Read-Only Replica API & Local SSOT Dual-Sync Engine Release] Cloudflare Pages Function replica endpoint, local SSOT dual-sync publisher with offline fallback, workers types configuration, with 25/25 test suite pass. (2026-09-04)
  - [Milestone 115: Yangjae Festival Team Leader Phone Extension Official 7031 Update & Multi-Alias Extension Mapping Release] Kim Ji-young team leader official extension updated to 7031 with multi-alias support (지영팀장님, 지영 팀장님, 김지영팀장), placeholder update, with 25/25 test suite pass. (2026-09-04)
  - [Milestone 114: Yangjae Festival parseDetail & getStaffInfo Map O(1) Caching & Callback Stabilization Release] Map-based O(1) constant-time caching for regex parseDetail and getStaffInfo, emitChange useCallback reference preservation, with 25/25 test suite pass. (2026-09-04)
  - [Milestone 113: Yangjae Festival DetailEditRow React.memo Isolation, GC-Free Staff Entries & Hoisted Style Constants Release] React.memo boundary isolation for detail edit rows, precomputed STAFF_PHONE_ENTRIES zero-allocation lookup, module-scoped LARGE_FONT_STYLES constant, type-safe unknown error guards, with 25/25 test suite pass. (2026-09-04)
  - [Milestone 112: Yangjae Festival SMS Share Template Executive Compaction & High-Polish Weekly Tasks Release] Ultra-compact executive sharing format, elimination of redundant overview boilerplate, staff alternative day-off accentuation, 5-point administrative high-polish weekly tasks, with 25/25 test suite pass. (2026-09-04)
  - [Milestone 111: Yangjae Festival Booth Order Dynamic Repositioning & Seamless Sequential Normalization Release] Interactive booth reorder controls (▲/▼), category-aware swapping, live No.1~No.N position tracking, remote tunnel admin authorization, with 25/25 test suite pass. (2026-09-04)
  - [Milestone 110: Yangjae Festival Booth Reordering (▲/▼) Interactive Wire-Up, Category Sequence Polish & Zero-Warning Codebase Purity Release] Interactive booth reorder controls (▲/▼), boundary disablement, 100% zero-warning codebase purity, with 24/24 test suite pass. (2026-09-04)
  - [Milestone 109: Yangjae Festival Detail Input Field Isolation & High-Visibility Remarks Blue Accent Release] Detail parsing negative lookahead guard for date/attendees input isolation, eye-catching text-blue-600 remarks accent, with 24/24 test suite pass. (2026-09-04)
  - 그 외 과거 누적 마일스톤 총 194건 통합 요약 (초기 ~ 2026-09-04 이전 패치 내역)
