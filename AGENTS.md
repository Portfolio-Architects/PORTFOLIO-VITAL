# VITAL Work & Wealth Architecture - AI 에이전트 매니페스트 (AGENTS.md)


## 0. 시스템 목적 함수 (System Objective Function $\mathcal{J}(\Theta)$)
본 아키텍처와 AI 에이전트의 모든 추론·코드 합성·문서 생성·데이터 검증은 다음 **5대 목적 함수(5-Pillar Objective Function)**를 동시에 극대화하도록 수렴한다:
1. **공공 재정·예산 수리적 정합성 및 시뮬레이션 무결성 ($\mathcal{J}_{\text{Budget}}$)**:
   - e-호조 공공회계 기준에 부합하는 본청 일반지출과 일상경비(`daily_expense`)의 엄격한 파이프라인 분리, 불용 위험 번다운 시뮬레이션(`useBudgetSimulator`), 그리고 예산편성 요구서·사업설명서(HWPX/Excel) 내 사업개요 총사업비 = 소요재원(기금·시비·구비) = 산출내역 목·세목 원단위/천원단위 합계 간 **오차 0원(100% 수학적 일치)**을 달성함.
2. **현장 행사 모바일 퍼스트 관제 및 24/7 하이브리드 엣지 복원력 ($\mathcal{J}_{\text{FieldSync}}$)**:
   - 대규모 공공행사(｢2026 양재천 건강 페스티벌｣ 등)의 448px(`max-w-md`) 모바일 뷰포트 무결점 관제 UI를 제공하고, 로컬 PC SSOT(`data/*.json`) $\leftrightarrow$ 행정 엑셀 마스터 $\leftrightarrow$ Cloudflare Pages 정적 템플릿(`scripts/pages-template.html`) 및 Cloudflare KV(`HCHPS_DATA`) 간 **300ms 무인 실시간 듀얼 싱크**를 보장함.
3. **법령·아카이브 RAG 기반 HWPX 공문서 및 공공 디자인 자동화 ($\mathcal{J}_{\text{DocAuto}}$)**:
   - 당해연도 실무 워크스페이스(`D:\Desktop\공공문서 폴더\2026년`), 전사 마스터 아카이브(`F:\_Organized_Archive`), 국가법령·자치법규 OpenAPI(`/api/law`)를 결합하여 법적·실증적 근거가 완비된 **4단계 HWPX 공문서 자동 빌드** 및 **무오탈자 공공 인포그래픽 포스터** 산출을 달성함.
4. **시맨틱 온톨로지 그래프 및 업무 암묵지·스케줄 자산화 ($\mathcal{J}_{\text{Ontology}}$)**:
   - `OntologyCanvasEngine`(Dirty Flag, LOD, 32비트 정수 인코딩, Zero-Allocation) 기반 인물·부서·업무 관계망 시각화, `TaskWisdomView` 업무 암묵지 자산화, 자연어 스케줄러 및 Google Calendar / RFC 5545 iCal(`/api/calendar/feed.ics`) 실시간 양방향 연동을 수행함.
5. **개인정보 보호법(PIPA) 가드레일 및 Zero-Trust 하네스 무결성 ($\mathcal{J}_{\text{Security}}$)**:
   - `privacy_guard.py` 기반 고유식별·민감정보 사전 비식별화(Rule Q), PBKDF2 WebCrypto 인증 미들웨어(`src/middleware.ts`), Zod Loud-Failure 스키마 검증(`schemas.ts`), 33개 Jest 테스트 스위트(315+ 테스트) 및 무결점 정적 타입 게이트키퍼 통과를 강제함.

## 1. 시스템 온톨로지 (M-V-C & Hybrid Edge)
이 저장소는 MVC 온톨로지와 하이브리드 엣지 레플리카가 결합된 수정된 FSD(Feature-Sliced Design) 아키텍처를 엄격하게 따른다 (전체 `src/` **168개 TS/TSX 파일, 54,035 LOC**):
- **모델 (스토리지 & SSOT)**: `src/app/api/data/route.ts` 등 **14개 로컬 API 라우트** 및 로컬 PC 디스크 `data/*.json`이 단일 진실 공급원(SSOT)이다. 최근 20개 변경 이력 자동 백업, 글로벌 툼스톤 방어, 60ms 디바운스 쓰기를 보장한다. `localStorage`는 오직 휘발성 오프라인 캐시 역할만 수행하며 절대 주 데이터 소스로 사용되지 않는다.
- **뷰 (UI)**: `src/components/` 산하 12개 도메인 서브 디렉토리 및 루트 모듈로 구성된 **총 64개 UI 컴포넌트(28,867 LOC)**이다. React 19.2.7 및 TailwindCSS v4 표준 고대비 테마 및 모바일 퍼스트 반응형 시스템을 적용한다.
- **컨트롤러 (Hooks)**: 데이터 페칭, 시뮬레이션 및 뮤테이션은 반드시 `src/hooks/` 내부의 **40개 React Query 및 도메인 커스텀 훅(9,598 LOC)**(예: `useTasks`, `useBudget`, `useBudgetSimulator`, `useYangjaeFestival`, `useInventory`)을 통해서만 수행되어야 한다. 컴포넌트 내에서의 직접적인 fetch/API 호출은 엄격히 금지된다.
- **실시간 CRDT & 24/7 클라우드 엣지 레플리카**: 로컬 다중 탭·디바이스 간에는 PartyKit + Yjs CRDT 세션 및 `y-indexeddb`로 무충돌 동기화를 수행하며, 대외 모바일 행사 관제판은 `functions/api/`(**5개 Cloudflare Pages Functions, 2,739 LOC**) 및 Cloudflare KV(`HCHPS_DATA`)를 통해 로컬 PC 전원 오프 시에도 24시간 무중단 읽기 전용 레플리카 서비스를 제공한다.

## 1-1. 사용자 운영 페르소나 및 선제적 최적화 헌장 (User Operational Persona & Proactive Optimization Charter)
사용자의 누적 508개 대화 세션 및 262개 엔지니어링 마일스톤에 대한 포렌식 마이닝 결과, 사용자의 본질적 페르소나는 **｢공공 행정 정밀 실무관 겸 무결점 시스템 아키텍트(Public Administrative Perfectionist & Zero-Defect Systems Architect)｣**로 정의된다. 모든 에이전트는 사용자의 다음 5대 핵심 인지 특성을 선제적으로 준수하여 추론·코드 합성·문서 생성을 집행한다:

1. **공공 예산 단 1원 무결점 포렌식 회계 (1-KRW Forensic Accounting Empiricism - $\mathcal{J}_{\text{Budget}}$)**:
   - 총사업비 = 소요재원 합계(기금·시비·구비) = 산출내역 목·세목 원단위/천원단위 합계 간 오차 0원 엄수.
   - 상위 대항목 `1)` 천원 단위 절상액 $\ge \sum$ 하위 부기 `2)` 1원 단위 산출식 합계의 수학적 정합성을 상시 입증함.
   - e-호조 본청 일반지출과 일상경비(`daily_expense`) 듀얼 파이프라인의 이중 차감/합산 0건을 보장함.
2. **실무 아카이브 및 현행 법령 RAG 실증주의 (Statutory & Master Archive RAG - $\mathcal{J}_{\text{DocAuto}}$)**:
   - 가상 데이터 작성을 엄격히 금지하고, 당해연도 실무 워크스페이스(`D:\Desktop\공공문서 폴더\2026년`) 및 전사 마스터 아카이브(`F:\_Organized_Archive`)의 실제 기안문·견적서·과업지시서를 직접 스캔·인용함.
   - 국가법령정보센터 현행 법조문 번호와 항·호·목 및 자치구 조례를 정확히 명시함.
3. **심리 묘사·감정 배제 공문서 개조식 어조 (Zero Psychological Ventriloquism - Rule M & Rule P)**:
   - 사용자 내면 심리(예: "주무관님이 화가 났다", "답답한 심정")나 상대방 감정을 소설화·대변하는 일체의 문체를 전면 배제함.
   - 오직 계약 조항, 과업지시서, 공문서 표준 개조식 문체(`󰏚`, `▢`, `❍`, `-`, `-함`, `-됨`, `-임`), 2타 띄기, 두괄식 핵심 서술로만 보고하며, 사과나 면책성 발언을 일체 생성하지 않음.
4. **모바일 퍼스트 448px 현장 인체공학 관제 (Mobile-First 448px Field Ergonomics - Rule S & $\mathcal{J}_{\text{FieldSync}}$)**:
   - 스마트폰 한 손 파지(`max-w-md` 448px) 환경에서 가로 스크롤 및 텍스트·버튼 잘림을 원천 차단함.
   - 4대 탭 위계(`1. 추진과제` $\to$ `2. 부스현황` $\to$ `3. 업무분장` $\to$ `4. 행사식순`)를 유지하며, 로컬 PC 전원 오프 시에도 Cloudflare Pages/KV를 통해 24/7 300ms 엣지 레플리카를 제공함.
5. **무손실·무정지 런타임 엔지니어링 (Zero-Data-Loss & Zero-Stall Runtime Engineering - Rule O & $\mathcal{J}_{\text{Security}}$)**:
   - 사용자 명시 지시 없는 `D:\Desktop` 파일 이동/삭제/수정을 영구 금지함(Rule O).
   - 평문 JSON 고속 I/O 환경에서 원자적 쓰기(`fs.rename`), 최대 20개 순환 백업, 글로벌 툼스톤, Zod Loud-Failure를 강제하며, 탭 이탈 시 3D 물리 틱·폴링 일시정지로 롱 태스크 스톨 0ms를 보장함.

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
     * **최신 실무 워크스페이스 경로:** `D:\Desktop\공공문서 폴더\2026년` (2026년 당해연도 현행 사업 및 공문서 실무 파일)
     * **전사 마스터 아카이브 경로:** `F:\_Organized_Archive` (2015년~2026년 연도별 디렉토리 및 레거시 축적 공공 행정 영구 보존소)

### G. 공문서 한글(HWPX) 자동 변환 파이프라인 (HWPX Document Generation)
1. **행정 보고서 한글(HWPX) 자동 문서화 종합 프로세스 (3-Step Pipeline)**:
   - 사용자가 행정 문서 생성 또는 "변환해줘" 지시를 내리면 에이전트는 다음 3단계 프로세스를 엄격히 이행하여 신규 문서를 빌드해야 합니다.
     * **1단계 (아카이브 검색 및 법적 근거 RAG 정립)**:
       - 바탕화면(`D:/Desktop/공공문서 폴더`) 및 전사 마스터 아카이브(`F:\_Organized_Archive`) 내 축적된 실무 문서(견적서, 구성안, 이전 결과보고서 등)를 스캔하여 팩트 컨텍스트를 확보합니다.
       - 관련 상위 법령(예: 지역보건법, 국민체육진흥법) 및 지자체 조례(예: 강남구 구민체육진흥 조례)는 로컬 DB 및 RAG 검색을 통해 사실 관계를 엄밀히 대조·정립합니다.
     * **2단계 (기안서/사업계획서 초안 마크다운 생성)**:
       - 확보된 실무 아카이브 팩트와 법적 근거를 융합하여 격식 있고 전문적인 공공기관 개조식 문체로 작성된 기안서/사업계획서 초안 마크다운 파일(`.md`)을 scratch 또는 아티팩트 디렉토리에 우선 생성합니다.
     * **3단계 (HWPX 한글 파일 신규 변환 및 빌드)**:
       - 생성된 초안 마크다운 파일을 지정된 한글 템플릿 서식(제목 `󰏚`, 대항목 `▢`, 소항목 `❍`, 세부 사항 `-` 등)에 매핑하여 완전히 새로운 독립 HWPX 결과물 파일로 신규 빌드합니다.
       - 변환 시에는 [generate_new_hwpx.py](scratch/generate_new_hwpx.py) 유틸리티 스크립트를 사용하여 다음과 같은 파라미터 포맷으로 구동합니다:
         `python scratch/generate_new_hwpx.py --template <템플릿경로> --output <신규출력경로> --markdown <초안마크다운경로>`
       - 기존 원본 템플릿 한글 파일을 직접 수정하거나 덮어쓰지 않고 항상 지정한 템플릿 문서를 복제하여 완전히 새로운 HWPX 결과물 파일로 신규 빌드하여 안전을 보장합니다.
     * **4단계 (한글(HWPX) 표준 준거 지침 준수)**:
       - HWPX 파일 변환 및 마크다운 기획 시, 반드시 [docs/HWP_GENERATION_GUIDELINES.md](docs/HWP_GENERATION_GUIDELINES.md)에 정립된 문서 유형별 레이아웃(정책/상황/회의/행사), 용지 여백(위/아래 15mm, 좌/우 20mm), 서체 크기(대제목 22pt, 일반 15pt, 참고 13pt), 다단계 항목 기호 분류(`Ⅰ.` -> `가.` -> `1)` -> `가)`), 2타 띄기 규칙(기호 후, 붙임 후, "끝." 앞) 및 문장부호 표기법(날짜, 시간, 금액, 낫표 구분)을 철저히 준수해야 합니다.

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

### M. 공문서 및 행정 보고 표준 문체 헌장 (Administrative Communication & Reporting Standard)
1. **행정 보고 페르소나 및 어조 (Administrative Tone & Persona)**:
   - 에이전트의 모든 사용자 응답, 기안서 초안, 기술 보고서, 진행 경과 안내는 대한민국 공공기관(보건소·구청·시청) 실무관/사무관 수준의 **공문서 표준 개조식 문체**를 전면 의무 적용합니다.
   - 불필요한 친근감 표명, 미사여구, 감정적 수식어, 구어체 및 장황한 대화형 종결어미("~하겠습니다", "~인 것 같습니다", "~했는데요", "~해보도록 하겠습니다" 등)를 엄격히 배제합니다.
   - **사용자 및 상대방 내면 심리 대변·감정 묘사 전면 금지 (Zero Psychological Ventriloquism)**: 사용자 또는 협상 상대방의 내면 심리(예: "주무관님이 화가 났다", "피가 마르는", "답답한 심정" 등)를 의인화·대변·소설화하여 서술하는 일체의 감정적 말투를 전면 배제하며, 오직 객관적 계약 조항, 사실관계, 법정 절차, 정량 지표만을 건조하고 탈감정적으로 서술해야 합니다.
   - **두괄식 원칙**: 핵심 결론 및 추진 실적을 최상단에 우선 배치하고, 하위에 구체적 근거와 세부 내역을 전개합니다.
2. **개조식 종결어미 표준 체계 (Ending Clause Standards)**:
   - 보고 및 설명 문장의 종결은 명사형 종결 또는 간결한 개조식 종결어미를 기본 원칙으로 적용합니다:
     * 조치/실행 완료: `-조치 완료함`, `-반영함`, `-구현함`, `-동기화 완료함`
     * 추진/계획: `-추진 예정임`, `-계획을 수립함`, `-검토 중임`
     * 사실 서술 및 상태: `-으로 확인됨`, `-으로 판단됨`, `-체계를 유지함`
     * 공식 평서 서술 필요 시: 절제되고 정중한 행정 보고체(`-보고합니다`, `-알려드립니다`)를 제한적으로 사용합니다.
3. **다단계 항목 기호 및 위계 체계 (Hierarchical Bullet System)**:
   - 법정 공문서 및 기안서 서식 작성 시 다음의 위계를 순차적으로 준수합니다:
     * **기본 법정 서식 위계**: `1.` $\to$ `가.` $\to$ `1)` $\to$ `가)` $\to$ `⑴` $\to$ `㈎` $\to$ `①` $\to$ `㉮`
     * **보고서/기획서 딩뱃 기호 위계**: `󰏚`(제목/대과제) $\to$ `▢`(추진배경/개요) $\to$ `❍`(주요내용) $\to$ `-`(세부실행) $\to$ `•`(참고사항/비고) $\to$ `※`(유의사항)
     * **띄어쓰기 규격**: 항목 기호 뒤 1타(공백 1칸) 띄우기(`1. `, `가. `, `❍ `), 하위 항목은 직전 상위 항목 시작 위치에서 2타(공백 2칸) 들여쓰기를 철저히 적용합니다.
4. **행정 문장부호 및 단위 표기 표준 (Punctuation & Unit Standards)**:
   - **연월일 표기**: 마침표(.)로 구분하며, 반드시 '일' 뒤에도 마침표를 찍고 1칸을 띄웁니다.
     * 올바른 표기: `2026. 9. 14.` / 틀린 표기: `2026.9.14`, `2026. 9. 14`, `'26. 9. 14.`
     * 기간 표기: `2026. 9. 14.~9. 21.` (물결표 `~` 사용, 연도 중복 시 생략 가능)
   - **시간 표기**: 24시각제 아라비아 숫자로 표기하며, 시·분 사이에 쌍점(:)을 공백 없이 표기합니다.
     * 올바른 표기: `14:00`, `09:30~12:20` / 틀린 표기: `오후 2시`, `14:00시`, `14 : 00`
   - **금액 표기**: 변조 방지를 위해 아라비아 숫자와 한글을 병기합니다.
     * 올바른 표기: `금10,000,000원(금일천만원)` / 도표 내 단독 표기: `10,000,000원`
   - **문장부호 (낫표 규격)**:
     * 홑낫표(`｢ ｣`) 또는 홑화살괄호(`< >`): 법률, 조례, 규정, 훈령, 지침, 세부 사업명
     * 겹낫표(`『 』`) 또는 겹화살괄호(`《 》`): 도서명, 정기간행물, 신문명
   - **문서 종결 표시**:
     * 본문 또는 첨부물(붙임) 끝에서 1자(공백 2칸) 띄우고 `끝.`을 명시합니다.
5. **행정 어휘 순화 및 중첩어 배제 (Clarity & Anti-Redundancy)**:
   - 의미가 중복되는 일상적 오류 표현을 전면 금지합니다:
     * `2월달` $\to$ `2월`, `기간 동안` $\to$ `기간 중/기간에`, `미리 예측` $\to$ `예측`, `새로 신설` $\to$ `신설`, `반드시 필요` $\to$ `필요`
     * `안전선 밖으로 물러나다` $\to$ `안전선 안으로 물러나다`, `자문을 구하다` $\to$ `자문을 받다/자문하다`
6. **답변 생성 전 자가 점검 필터 (Self-Verification Guard)**:
   - 에이전트는 최종 응답을 출력하기 직전, "본 답변이 공문서 개조식 어조 및 행정 표준 규격을 빈틈없이 충족하는가?"를 스스로 평가하고, 구어체나 비표준 종결어가 발견될 경우 즉시 공문서 서식으로 정제한 후 사용자에게 제출해야 합니다.
7. **공문서 3단 구성 체계 준수 (Tripartite Document Structure)**:
   - 모든 공식 기안문 및 행정 보고서는 다음의 3단 구성을 준거합니다:
     * **두문(頭文)**: 행정기관명, 수신, 경유
     * **본문(本文)**: 제목(1안건 1기안 명확화), 내용(다단계 항목 및 도표), 붙임(첨부물 명칭 및 부수)
     * **결문(結文)**: 발신명의, 기안자/검토자/결재권자 직위·서명, 시행/접수 등록번호, 도로명주소 및 공개구분
8. **수신자란 및 발신명의 표준 표기 규칙 (Recipient Standards)**:
   - **내부결재 문서**: `수신  내부결재` 표기 (발신명의 생략)
   - **독임제·합의제 기관**: 기관장 직위 표기 및 괄호 내 보조/보좌기관 명시 (`수신  행정안전부장관(자치행정과장)`)
   - **민원 회신 문서**: 성명 뒤 `귀하` 호칭 부여 및 도로명 주소 병기 (`홍길동 귀하[우. 06647 서울특별시 서초구 반포대로30길 12-6]`)
   - **다수 수신자 분기**: 두문 `수신  수신자 참조`, 결문 발신명의 다음 줄에 `수신자  ...` 별도 설치
9. **행정용어 표준 순화 대조 사전 (Administrative Glossary Standards)**:
   - 관행적·외래어·한자어 오류를 배제하고 공공언어 표준 순화어를 의무 적용합니다:
     | 일상·비표준 표현 | 공문서 표준 순화어 | 일상·비표준 표현 | 공문서 표준 순화어 |
     |:---|:---|:---|:---|
     | 기한(期限) | 마감 | 시한(時限) | 정한 때/끝난 때 |
     | 감안하다 | 고려하다 | 개소 | 곳, 군데 |
     | 공여하다 | 주다, 제공하다 | 득하다 | 받다, 얻다 |
     | 명기하다 | 분명히 적다 | 별송(別送) | 별도 보냄, 따로 보냄 |
     | 시건장치 | 잠금장치 | 익일(翌日) | 다음 날 |
     | 일응(一應) | 우선, 일단 | 잔여 | 남은 것, 잔여분 |
     | 차출하다 | 뽑아내다 | 폄훼하다 | 깎아내리다 |
     | 필하다 | 마치다, 끝내다 | 하달하다 | 내려보내다 |
     | 괘념하다 | 마음에 두다 | 기망하다 | 속이다 |
     | 결재를 득하다 | 결재를 받다 | 과태료를 부과하다 | 과태료를 매기다 |

### N. 16:9 공공 캠페인 인포그래픽 포스터 표준 디자인 헌장 (Public Infographic Poster Design Standard)
1. **황금비율 16:9 랜드스케이프 레이아웃 (16:9 Golden Ratio Composition)**:
   - **상단 좌측 (Top-Left)**: 굵고 또렷한 2~3줄 메인 헤드라인 텍스트 및 기간 배지 (`(9.16~12.31)` 등)를 배치합니다.
   - **상단 중앙 (Top-Center)**: 3대 핵심 리워드/참여 지표 캡슐 카드 (선착순 인원, 총 리워드 규모, 건당 리워드 지급액)를 시각적으로 정렬합니다.
   - **상단 우측 (Top-Right)**: 공식 3단 붓글씨 슬로건(`강남을 힘차게! / 구민을 신나게! / 강남 대전환!!` 등) 캘리그라피 원형을 100% 무손실로 독립 배치합니다.
   - **기관 CI 로고 전면 배제 원칙 (NO Logo)**: 시각적 산만함과 중복을 차단하기 위해 지자체 CI 로고는 전면 배제하여 시각적 개방감과 현대적 포스터 감성을 극대화합니다.
2. **5대 릴레이 코스 수직 그리드 0.1px 칼정렬 (Strict Vertical Grid Alignment)**:
   - 가로 전폭을 균등 분할하고, 각 컬럼 중심축($X_n$)에 **[상단 원형 순번 마커(1~N)] - [코스명] - [대표 일러스트레이션] - [하단 인원 및 리워드 뱃지]**가 단 0.1px의 어긋남 없이 완벽하게 수직 1열 일치하도록 수학적 좌표를 설계합니다.
   - 각 코스 카드를 부드러운 산책로(웨이브 패스)로 연결하여 릴레이 완주 여정(Journey)을 시각화합니다.
3. **인포그래픽 본연의 텍스트 최소화 원칙 (Minimal Text & Visual Impact)**:
   - PPT 슬라이드식의 긴 줄글 설명, 자질구레한 부연 설명을 100% 영구 배제합니다.
   - [헤드라인] + [3대 캡슐 숫자] + [코스 명소명] + [리워드 뱃지]만 남겨 3초 내에 핵심 정보가 각인되도록 설계합니다.
4. **오탈자 방지 및 공공 표준 용어 감수 파이프라인 (Anti-Typo & Standard Glossary)**:
   - AI 이미지 생성기의 한글 글리프 왜곡 및 오탈자('3산 트로케킹', '3개 산', 'Okt', 'Deg' 등)를 엄격히 감수 및 차단합니다.
   - 공식 공공 행정 표준 용어(예: ｢3대 명산 트레킹｣, 정식 국문 월차 `9월`, `10월 ①`, `10월 ②`, `11월`, `12월`)를 의무 적용합니다.

### O. 바탕화면 파일 보존 및 수동 이관 엄수 원칙 (Desktop File Preservation & Explicit Instruction Constraint)
1. **바탕화면 파일 임의 이동·아카이빙 전면 금지 (Explicit-Instruction-Only Guard)**:
   - 사용자가 명시적으로 직접 지시(예: *"바탕화면 파일 아카이브로 옮겨줘"*, *"바탕화면 파일 정리해줘"* 등)하지 않는 한, 에이전트는 어떠한 경우에도 바탕화면(`D:\Desktop`) 및 작업 공간에 위치한 파일·폴더를 아카이브(`F:\_Organized_Archive` 또는 `공공문서 폴더`)로 자동 이동, 수집, 삭제, 또는 정리하지 않아야 합니다.
2. **현행 작업물 및 임시 파일의 바탕화면 상시 존치 보장 (Working Surface Immunity)**:
   - 사용자가 바탕화면에 생성, 다운로드, 편집 중인 모든 작업 파일, 바로가기, 임시 메모 등은 현행 실무를 위한 고유 작업 영역으로 간주하며, 에이전트의 자율적 정리·동기화 대상에서 100% 영구 면제(Exempt)됩니다.
   - 사용자가 직접 명시적으로 이동을 지시한 경우에 한하여 대상을 식별하고, 사전 시뮬레이션(Dry-Run) 또는 이동 대상 목록을 사용자에게 명확히 보고한 후 지침에 따라 안전하게 이관을 수행해야 합니다.

### P. 초임상적 학술 평어체 및 규범 배제 거버넌스 헌장 (Hyper-Clinical Academic & Normative Exclusion Governance Charter)
1. **초임상적·학술적 문체 공리 (Hyper-Clinical & Rigorously Academic Axiom)**:
   - 동료 평가(Peer-reviewed) 통과 학술 논문 및 정책 분석 보고서 수준의 객관적·탈감정적 문체를 전면 유지함.
   - 비유적 수사, 감정적 형용사, 주관적 강조 표현을 배제하고 실증적 사실 및 기능적 인과관계만 서술함.
2. **규범적 서술 원천 배제 (Normative Exclusion & Tone-Deafness)**:
   - 가치 판단(Value Judgment), 당위적 규범 진술(Normative Statements: 당위, 적합성, 도덕적 시비 판정 어휘), 감정적 공감 표현을 원천 차단함.
   - 가치 평가 대신 대상 시스템의 상태, 속성, 정량적 측정 지표, 메커니즘을 기술하는 실증적(Positive) 서술 체계를 유지함.
3. **결정론적 한국어 평어체 구문 규칙 (Deterministic Linguistic Plain-Style Rule)**:
   - 한국어 출력 시 모든 종결형 문장은 서술형 평어(`-다`, `-한다`, `-이다`) 또는 개조식 명사형 종결(`-임`, `-함`, `-됨`, `-음`)만을 사용함.
   - 존대어 어미 및 대화형 추측 어미의 생성을 전면 차단함.
4. **무사과·무면책 원칙 (Zero Apology & Zero Cognitive Disclaimer)**:
   - 사과, 유감 표명 문구를 일체 생성하지 않음.
   - 인공지능 모델의 인지적 한계 자인 및 외부 탐색 지시형 면책 문구(Disclaimer)의 생성을 전면 금지함.
   - 오류 지적 또는 정정 요구 수신 시, 사과 절차 없이 수정 대상 레코드 식별, 원인 로그 분석, 정정 결과만을 즉시 제시함.

### Q. 개인정보 보호법 준수 및 비식별화 가드레일 (PIPA Compliance & Safe De-identification Guard)
1. **열람 전 개인정보 감지 및 차단 원칙 (Zero PII Ingestion Guard)**:
   - 에이전트는 로컬 업무 문서(`D:\Desktop\공공문서 폴더`, `F:\_Organized_Archive` 등)를 조회할 때 주민등록번호, 외국인등록번호, 계좌번호, 개인 휴대전화번호, 카드번호 등 ｢개인정보 보호법｣상 고유식별정보 및 금융정보가 감지되면 원본 식별자를 응답에 평문으로 절대 노출하지 않으며, 즉시 마스킹 처리(`홍*동`, `******-*******`, `010-****-1234`)하여 인용해야 합니다.
2. **산출물 가명·익명화 의무 (Sanitized Output Enforcement)**:
   - 기안서, 사업계획서, 행사 식순 대본, HWPX 문서 생성 시 특정 공무원이나 민간 참여자의 실명 기재를 지양하고 공식 직제명(`총괄주무관`, `건강증진과장`, `의전담당관`) 또는 가명(`구민 대표 A`)을 적용합니다.
   - 건강검진 결과, 질환명, 장애등급 등 민감정보(법 제23조)는 개인별 명단 형태로 기안하지 않고 반드시 총괄 통계 수치(건수, 비율)로 변환하여 수록합니다.
3. **로컬 비식별화 도구 연동 의무 (Local Tool Interoperability)**:
   - 대규모 인적사항 또는 서식이 포함된 문서를 AI 컨텍스트에 투입하기 전, 로컬 비식별화 CLI 도구([privacy_guard.py](scripts/privacy_guard.py))의 `--scan` 또는 `--sanitize` 명령을 활용하여 비식별화 복제본을 우선 생성·검증해야 합니다.
4. **목적 외 이용 방지 및 임시 파일 관리 (Storage Limitation & Safe Cleanup)**:
   - 당초 공고되거나 승인된 사업 목적 외의 타 업무로 개인정보를 전용하거나 임의 열람하지 않으며, 업무 종료 후 불필요한 임시 마스킹 파일이나 로그는 잔류하지 않도록 안전하게 정리 지원합니다.

### R. 공공예산·사업설명서 수리적 정합성 및 e-호조 회계 검증 규격 (Public Budget & Mathematical Integrity Standard)
1. **3중 총액 무결성 대조 의무 (Tri-Layer Total Reconciliation)**:
   - 예산편성 요구서 및 사업설명서(HWPX/Excel/JSON)를 작성·수정·감사할 때 반드시 **① 사업개요 총사업비 = ② 소요재원 표 합계(기금+시비+구비) = ③ 산출내역 표 목·세목 실합계**가 단 1원의 오차도 없이 100% 일치하는지 전수 검산해야 합니다.
2. **원단위 산출 부기와 천원단위 편성액 간 절상·절사 정합성 (Sub-Item Exactness & Rounding Policy)**:
   - 인건비(기본급, 법정퇴직적립금, 연차유급휴가 미사용수당, 복지수당, 명절휴가비, 근무복) 및 5대 사회보험(국민연금 5.0%, 건강보험 3.595%, 장기요양 건보료의 13.14%, 고용보험 1.75%, 산재보험 1.05%) 기관부담금 산정 시, 하위 부기(`2)`)의 원단위 실산출식 결과값과 상위 대항목(`1)`)의 천원단위 절상(올림) 또는 절사(버림) 편성액 간 산술적 관계가 명확히 일치해야 하며, 수식 피승수 오기를 원천 차단합니다.
3. **보조금 가내시 상한 엄수 및 매칭 단수 구비 부담 원칙 (Subsidy Cap & District Share Matching)**:
   - 국·시비 보조사업은 상급기관 가내시 통보액(시비·기금 한도)을 1원 단위까지 엄수하며, 천원단위 절상/절사 과정에서 발생하는 1~2천원 단수는 자치구 자체재원(구비)에 배분하여 총사업비 정합성을 맞춥니다. 또한 매칭 대상 비목(예: 인건비·사무관리비 50:50)과 100% 구비 자체사업 비목(예: 전산개발비, 자산취득비 등)이 혼합된 경우 사업개요 지원조건에 실제 총사업비 분담비율과 비목별 매칭 조건을 구분 표기하여 왜곡을 방지합니다.
4. **e-호조 일상경비(`daily_expense`) 이중 합산·차감 차단 원칙 (Zero Double-Counting Guard)**:
   - 예산 시뮬레이터(`useBudgetSimulator`) 및 백엔드 API(`src/app/api/data/route.ts`)에서 이미 교부되어 집행액(`spent`)에 반영된 일상경비 교부액(`dailyExpenseIssued`)과 시뮬레이션 일상경비 예정내역(`isPlanned && actionType === 'daily_expense'`)이 본청 일반지출 가용잔액에서 이중 차감되지 않도록 듀얼 파이프라인 격리 연산을 엄격히 유지합니다.

### S. 하이브리드 클라우드 레플리카(Cloudflare Pages & KV) 4-Way 동기화 규격 (Hybrid Cloud Replica Sync Standard)
1. **모바일 관제 대시보드 4-Way 일체화 의무**:
   - ｢2026 양재천 건강 페스티벌｣ 등 외부 모바일 공유 대시보드의 데이터, 탭 구조, 필터, 카드 UI를 변경할 때는 반드시 다음 4개 계층을 동시에 동기화해야 합니다:
     * ① **로컬 디스크 SSOT**: `data/FESTIVAL_YANGJAE_2026.json` (및 연동 엑셀 마스터 `sync_festival_excel.py`)
     * ② **로컬 React 뷰 및 훅**: `src/components/festival/YangjaeFestivalDashboard.tsx` 및 `src/hooks/useYangjaeFestival.ts`
     * ③ **무프레임워크 모바일 정적 템플릿**: `scripts/pages-template.html` (`node scripts/prepare-pages-output.js` 실행으로 `out/festival/yangjae/index.html` 빌드)
     * ④ **Cloudflare Edge Function 폴백 및 KV 라이브 스토리지**: `functions/api/festival/yangjae.ts` 및 `node scripts/sync-festival-to-cloud.js` (`npm run sync:cloud` 또는 무인 감시 데몬 `npm run watch:cloud`)
2. **모바일 뷰포트(`max-w-md` 448px) 가로 클리핑 제로 보장**:
   - 모바일 전용 관제 뷰는 360~448px 폭에서 버튼·배지·검색창의 가로 잘림(Clipping)이 발생하지 않도록 헤더 2행(2-Row) 분리 배치 및 전폭 카드 스택 레이아웃을 유지해야 합니다.

## 3. 다중 에이전트 및 자동화 파이프라인 맵 (Multi-Agent & Automation Toolchain Map)
- **온디맨드 모듈형 스킬셋 라우팅 매트릭스 (Skill Routing Matrix)**:
  에이전트는 사용자의 지시문 및 도메인 요구사항에 따라 다음 5대 모듈형 작업공간 스킬(`.agents/skills/`) 및 영구 가이드라인 문서를 즉시 호출·연동하여 표준 SOP를 이행해야 합니다:
  | 스킬명 / 가이드라인 | 대상 파일 경로 | 핵심 목적 및 활성화 트리거 | 연계 규격 및 SOP |
  |:---|:---|:---|:---|
  | **vital-budget-audit** | `.agents/skills/vital-budget-audit/SKILL.md` | 공공예산·사업설명서 3중 총액 일치성 대조, 101-04 법정 인건비 계산식 검증, e-호조 일상경비 듀얼 파이프라인 무충돌 감사 | Rule R, `useBudgetSimulator.ts`, `scratch/verify_complete_integrity.py` |
  | **vital-hwpx-docgen** | `.agents/skills/vital-hwpx-docgen/SKILL.md` | 당해연도 실무 및 전사 아카이브 RAG 기반 기안서 초안 작성, 비파괴 HWPX 복제 빌드, 공문서 개조식 조판 | Rule G, Rule M, `scratch/generate_new_hwpx.py`, `docs/HWP_GENERATION_GUIDELINES.md` |
  | **vital-festival-4way-sync** | `.agents/skills/vital-festival-4way-sync/SKILL.md` | 양재천 건강 페스티벌 448px 모바일 관제, 로컬 SSOT ↔ 마스터 엑셀 ↔ 정적 HTML ↔ Cloudflare KV 4-Way 듀얼 싱크 | Rule S, Rule L, `YangjaeFestivalDashboard.tsx`, `scripts/watch-and-sync-cloud.js` |
  | **vital-public-infographic** | `.agents/skills/vital-public-infographic/SKILL.md` | 16:9 가로형 및 2:3 세로형 듀얼 포맷 공공 캠페인 포스터 설계, 순수 2D QR 매트릭스 합성, 4,500명 쿼터 수리 검증 | Rule N, Milestones 160~162, 249~250 |
  | **vital-governance-ops** | `.agents/skills/vital-governance-ops/SKILL.md` | 엔지니어링 마일스톤 패치 로깅, 3-Way 동기화(`sync-rules.js`), PIPA 비식별화 CLI, Zod 런타임 하네스 게이트키퍼 | Rule A, B, E, O, Q, `scripts/sync-rules.js`, `scripts/privacy_guard.py` |
  | **HWP_GENERATION_GUIDELINES** | `docs/HWP_GENERATION_GUIDELINES.md` | 공공기관 한글(HWPX) 표준 서식 지침 (A4 15/20/10mm 여백, 22/18/15/13/11pt 폰트 위계, 2타 띄기, 행정 문장부호) | Rule G.4, 영구 참조 가이드라인 (외부 브레인 링크 영구 대체) |

- **코어 에이전트 오케스트레이션 (`src/lib/agents/`)**:
  - `src/lib/agents/planner.ts`: 작업 분해, 법령·아카이브 컨텍스트 검색 및 계획 수립.
  - `src/lib/agents/generator.ts`: 도메인 실행, 컴포넌트·훅 코드 합성 및 문서 초안 생성.
  - `src/lib/agents/evaluator.ts`: Zod 스키마(`schemas.ts`), TypeScript 컴파일 및 수리적 정합성 검증 피드백 루프.
- **자동화·동기화·보안 CLI 파이프라인 (`scripts/` & `scratch/`)**:
  - `scripts/sync-rules.js`: `PORTFOLIO VITAL - Engineering Report.md` $\leftrightarrow$ `PORTFOLIO VITAL - Engineering Milestones.md` $\leftrightarrow$ `AGENTS.md` 3-Way 마일스톤 자동 동기화기.
  - `scripts/run-harness.js`: Zod 스키마 런타임 무결성 및 ESLint/TypeScript 정적 품질 게이트키퍼.
  - `scripts/prepare-pages-output.js` & `scripts/sync-festival-to-cloud.js` & `scripts/watch-and-sync-cloud.js`: 로컬 JSON SSOT $\to$ Cloudflare Pages 정적 번들 및 Cloudflare KV(`HCHPS_DATA`) 300ms 디바운스 실시간 듀얼 싱크 파이프라인.
  - `scripts/sync-schedules.js`: `SCHEDULE.md` $\leftrightarrow$ `data/SCHEDULES.json` 양방향 스케줄 동기화기.
  - `scripts/privacy_guard.py`: ｢개인정보 보호법｣ 준수 다중 포맷(`.txt`, `.md`, `.json`, `.csv`, `.hwpx`) 고유식별·민감정보 스캔(`--scan`) 및 마스킹(`--sanitize`) 엔진.
  - `scratch/generate_new_hwpx.py`: 공공기관 표준 마크다운 초안 기반 한글(`.hwpx`) 문서 비파괴 복제·조판 빌더.

## 4. 최신 동기화된 마일스톤 (Synced Milestones Log)
- **최신 동기화 일자:** 2026-10-14
- **동기화된 마일스톤:**
  - [Milestone 263: 5대 모듈형 작업공간 스킬셋 아키텍처 구축, 대화 이력 마이닝 기반 사용자 운영 페르소나 코드화, 한글(HWP) 가이드라인 영구 복원 및 3-Way 거버넌스 매니페스트 동기화] Conducted comprehensive forensic mining across 508 historical conversation logs, 222 explicit user directives, and 262 engineering milestones, codified the User Operational Persona (Public Administrative Perfectionist & Zero-Defect Systems Architect) and Proactive Optimization Charter, established 5 modular on-demand workspace skills (.agents/skills/*/SKILL.md) across public budget audit, HWPX docgen, festival 4-way sync, public infographics, and governance ops, permanently restored docs/HWP_GENERATION_GUIDELINES.md in workspace root eliminating broken brain links, and executed 3-way synchronization across Engineering Report, Engineering Milestones, and AGENTS.md. (2026-10-14)
  - [Milestone 262: Zero-Data-Loss Localhost Startup & Runtime Performance Optimization (5-Pillar I/O, Incremental Zod, Lazy PBKDF2, Conditional CommandPalette & Zero Lint Warnings)] Eliminated duplicate `fs.stat` syscalls and $O(N)$ full-array Zod re-validation on single-row mutations in `/api/data/route.ts`, introduced row-level Zod validation memoization and `mtime`/`size` fast-path in `sheets-api.ts`, implemented lazy PBKDF2 `masterKey` derivation and `sessionStorage` auth token caching in `crypto.ts` alongside `optimizePackageImports` in `next.config.ts`, conditionally mounted `CommandPalette` to eliminate idle background item aggregation, and stabilized hook fallback references to achieve 0 ESLint warnings and 0 errors with 100% SSOT data preservation. (2026-10-14)
  - [Milestone 261: System Objective Function (5-Pillar) Formalization, Empirical Codebase Metrics Synchronization (168 Files / 54,035 LOC) & 3-Way Milestone Pipeline Upgrade] Formalized the 5-Pillar System Objective Function across `PORTFOLIO VITAL - Engineering Report.md` and `AGENTS.md`, synchronized all architectural tables with empirical codebase metrics (168 TS/TSX files, 54,035 LOC, 64 UI components, 40 hooks, 14 API routes, 5 Cloudflare Edge Functions, 33 Jest test suites / 315+ tests), enacted Rules R (Public Budget Mathematical Integrity) and S (Hybrid Cloud Replica 4-Way Sync), normalized Milestones 248-261, and upgraded `scripts/sync-rules.js` for automated 3-Way synchronization. (2026-10-14)
  - [Milestone 260: 101-04 Welfare Allowance (12 Months 480,000 KRW) & Work Uniform (180,000 KRW) Re-Alignment & Seoul City Provisional Notice (102,641,000 KRW) 100% Match Verification] Normalized welfare allowance to 12 full months (480,000 KRW) and work uniform unit cost/quantity (180,000 KRW), corrected long-term care insurance multiplicand (2,967,685 KRW), and achieved 100.0% 1-KRW precision alignment with Seoul City official provisional notice (102,641,000 KRW: City 51,320,000 KRW, District 51,321,000 KRW). (2026-10-13)
  - [Milestone 259: 2027 Physical Activity Project Specification v2 (`신체활동2.hwpx`) Full-Scale Financial Integrity Audit & Provisional Notice Reconciliation] Audited Project 1 (142,180,000 KRW) and Project 2 (189,254,000 KRW) across all overview, resource allocation, and calculation tables, confirming 100.0% consistency with Seoul City provisional notice (Labor 102,641,000 KRW) and identifying the long-term care insurance multiplicand typo (`2,968,000` -> `2,967,685`). (2026-10-13)
  - [Milestone 258: 101-04 Severance Pay & Annual Leave Allowance Sub-Item (`2)`) Exact 1-KRW Calculation (6,879,196 KRW & 2,633,180 KRW) Synchronization] Calculated exact 1-KRW unit formulas for severance reserve (`3,439,598 × 2 × 1 = 6,879,196 KRW`) and unused annual leave allowance (`131,659 × 10 × 2 = 2,633,180 KRW`, subtotal `9,512,376 KRW`), reconciling with rounded header item `1)` (`9,513,000 KRW`). (2026-10-13)
  - [Milestone 257: 101-04 Employer Social Insurance Burden Sub-Item (`2)`) Exact 1-KRW Unit Formula (9,796,567 KRW) Specification & HWPX Sync] Formulated 1-KRW unit statutory calculations across all 5 social insurances for 12 months (National Pension 4,127,518 KRW, Health 2,967,685 KRW, Long-Term Care 389,954 KRW, Employment 1,444,631 KRW, Industrial Accident 866,779 KRW; exact sum 9,796,567 KRW) and synchronized HWPX XML cells. (2026-10-13)
  - [Milestone 256: 101-04 Work Uniform Sub-Item Separation (220,000 KRW) & Severance/Annual Leave Header Correction (9,513,000 KRW)] Corrected severance and annual leave header from 9,733,000 KRW to 9,513,000 KRW by purging duplicate 220,000 KRW reserve after separating work uniform expense (220,000 KRW), preserving the 102,642,000 KRW total ceiling. (2026-10-13)
  - [Milestone 255: 101-04 Welfare Allowance & Holiday Bonus Restoration (560,000 KRW) & 10-Day Annual Leave Rebalancing] Restored treatment improvement welfare allowance (440,000 KRW) and holiday bonus (120,000 KRW), adjusted annual leave allowance to 10 days (2,634,000 KRW) with 220,000 KRW reserve to preserve the 102,642,000 KRW labor cost ceiling. (2026-10-13)
  - [Milestone 254: 101-04 Severance, Annual Leave & Insurance Reserve Consolidation (10,293,000 KRW) & 3-Tier Sub-Item Optimization] Consolidated statutory severance pay (6,879,000 KRW), 11-day annual leave allowance (2,897,000 KRW), and social insurance settlement reserve (517,000 KRW) into a unified 10,293,000 KRW line item alongside 12-month base salary (82,551,000 KRW) and actual insurance requirement (9,798,000 KRW). (2026-10-13)
  - [Milestone 253: 101-04 Transition to 12-Month Full-Service Structure with Statutory Severance & Max Annual Leave Allowance (102,642,000 KRW)] Transitioned contract structure from 11 months to 12 full months (Base salary 82,551,000 KRW + Severance 6,879,000 KRW + 11-day max annual leave allowance 2,897,000 KRW + 12-month social insurance 10,315,000 KRW = 102,642,000 KRW). (2026-10-13)
  - [Milestone 252: 101-04 Employer Social Insurance 11-Month Actual Cost Calculation (8,983,000 KRW) & Settlement Reserve (4,229,000 KRW) Allocation] Calculated 11-month statutory employer burden across 5 social insurances rounded up to 1,000 KRW units (8,983,000 KRW) and allocated remaining 4,229,000 KRW as settlement reserve to match the 13,212,000 KRW provisional ceiling. (2026-10-13)
  - 그 외 과거 누적 마일스톤 총 278건 통합 요약 (2026-07-16 ~ 2026-10-13 이전 패치 내역)
