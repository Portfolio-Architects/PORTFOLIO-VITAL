# Original User Request

## Initial Request — 2026-07-16T11:59:42+09:00

이 프로젝트는 바이탈 앱(`PORTFOLIO - VITAL`)의 3D 마인드맵 컴포넌트의 렌더링 속도를 대폭 개선하고, 무의미한 노드를 걸러내고 핵심 실무 키워드 위주로 노드를 생성하는 노드 파싱 알고리즘 고도화 및 사용자가 필요 시 수동으로 노드를 등록/관리할 수 있는 수동 노드 관리 인터페이스를 구축하는 것을 목표로 합니다.

Working directory: d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. AI 시맨틱 추출 엔진 고도화 및 검토 모달 도입
- **AI 필터링 극대화**: `src/app/api/llm/extract/route.ts`의 Gemini 프롬프트를 강화하여 무의미한 조사, 단순 수식어 등의 명사 노드 생성을 엄격히 제어하며, 백엔드 레벨에서 불용어 필터와 노드 개수 제약을 장착합니다.
- **추출 노드 검토 및 승인 모달**: 텍스트에서 시맨틱 그래프 추출 완료 시 Yjs 스토어에 바로 병합하지 않고, 유저가 추출된 노드와 관계 목록을 직접 검토(추가, 선택 삭제, 관계 편집)한 뒤 승인 버튼을 통해 최종 마인드맵에 반영하는 검토 팝업 UI를 구현합니다.

### R2. 마인드맵 3D 엔진 렌더링 성능 대폭 개선 (Target 60 FPS)
- **Dirty-Flag 기반 레이아웃 생략**: 토폴로지 변화(노드 추가/삭제/연결 변경)가 발생하지 않는 동안은 BFS 트리 생성 및 `computePositions` 내의 좌표 재계산을 완전히 생략하도록 `Dirty-Flag` 기법을 전역 적용합니다.
- **Frustum Culling**: 화면 Frustum(카메라 시야 범위) 바깥에 위치한 노드 및 엣지는 그리기 연산 및 물리 충돌 연산 대상에서 완전히 제외합니다.
- **충돌 방지 최적화**: 화면 충돌 해결 루프의 반복 횟수를 최적화하고, Damping 파라미터를 조율하여 프레임 드랍과 공전 시의 떨림(Jittering) 현상을 차단합니다.
- **Orbiting 연산 효율화**: 공전 애니메이션 실행 시 매 프레임 발생하는 삼각함수 호출을 가산각 기반 회전 행렬 연산 또는 정적 룩업으로 대체해 CPU 점유율을 대폭 낮춥니다.

### R3. 수동 노드 및 엣지 조작 인터페이스 (Yjs CRDT 연동)
- **노드 수동 생성/삭제**: 마인드맵 HUD/인스펙터(`MindMapInspector.tsx`) 상에 유저가 라벨을 입력해 새로운 노드를 수동으로 즉시 배치하고, 원치 않는 노드를 삭제할 수 있는 편집 폼을 추가합니다.
- **관계(Edge) 연결/해제 UI**: 마인드맵 상에서 노드들을 선택하거나 지정하여 노드 간의 엣지를 수동으로 추가(신규 SPO 관계 정의)하고 연결을 끊을 수 있는 관리 인터페이스를 도입합니다.
- **CRDT 실시간 협업 동기화**: 모든 수동 제어(노드/엣지 생성 및 삭제)는 Yjs CRDT 협업 스토어에 즉시 연동 및 실시간 싱크되어 작동해야 합니다.

## Verification Plan

### Automated Tests
- `npm run lint` 및 `npm run build`를 실행하여 리팩토링 결과에 대한 정적 타입/스타일 에러 및 빌드 무결성을 검증합니다.

### Manual Verification
- 임의의 위키 문서에서 "시맨틱 그래프 추출"을 트리거하여 추출 결과 검토 모달이 정상 팝업되는지 확인하고, 노드를 편집하여 최종 마인드맵에 병합되는지 검증합니다.
- HUD/인스펙터의 수동 폼을 통해 임의의 노드(`테스트노드_A`, `테스트노드_B`)를 생성하고, 두 노드 간에 `의존성` 관계 엣지를 생성한 뒤 마인드맵 상에 즉시 그려지는지 Yjs 연동을 확인합니다.
- 브라우저 개발자 도구의 성능 프로파일러를 띄워 마인드맵 공전 및 탐색 시 FPS가 안정적으로 60 FPS 이상 유지되는지, CPU 병목 연산 시간이 단축되었는지 검사합니다.

## Acceptance Criteria

### 마인드맵 성능 및 제어 기능 검증
- [ ] 텍스트 시맨틱 추출 시 바로 병합되지 않고 유저가 노드/엣지 목록을 검토·수정 후 승인할 수 있는 모달 팝업이 구현되어야 함.
- [ ] 토폴로지 비변경 상태 시 BFS 레이아웃 연산을 원천 생략하는 Dirty-Flag 기법 및 화면 바깥 요소에 대한 Frustum Culling이 적용되어야 함.
- [ ] 마인드맵 상에서 노드를 수동으로 생성/삭제하고, 노드 간 엣지를 생성/삭제할 수 있는 HUD/인스펙터 편집 조작계가 구현되어 Yjs 스토어와 실시간 동기화되어야 함.
- [ ] 마인드맵 동작 중 16ms 이하로 렌더 틱이 유지되어 랙 현상이 해결되어야 함.
- [ ] `npm run build` 및 `npm run lint` 검증을 에러 없이 성공적으로 통과해야 함.
- [ ] 변경 패치 정보가 `PORTFOLIO VITAL - Engineering Report.md`에 실시간으로 작성되고 `node scripts/sync-rules.js`를 통해 마일스톤 동기화가 이루어져야 함.

## Follow-up — 2026-07-16T03:52:32Z

VITAL 웹 애플리케이션의 메인 페이지 로딩 속도 향상 및 렌더링 성능을 극대화하기 위해 초기 자바스크립트 청크 축소, Dynamic Lazy Loading 최적화, 불필요한 리렌더링 차단, 그리고 메모리 관리를 포함한 극한의 최적화 작업을 수행합니다.

Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. 초기 진입 속도 및 스플래시 로딩 최적화
- 초기 로딩 시 다운로드되는 메인 JS 번들 크기를 최소화하기 위해, 첫 화면(대시보드) 렌더링에 필수적이지 않은 모든 컴포넌트(3D 마인드맵, 예산관리, 법령/지침 등)를 완전한 비동기 지연 임포트(`dynamic()` with `ssr: false` 및 지연 preloading) 처리합니다.
- 스플래시 화면(`Home` 컴포넌트 하단의 스플래시 오버레이) 노출 및 초기화 대기 시간(현재 약 1.8초 이상 설정된 타이머 등)을 사용자 경험에 방해되지 않는 최적의 시간(예: 데이터 로드 완료 즉시 전환)으로 단축합니다.

### R2. 탭 전환 시 UI 프리징 해제 및 렌더링 차단
- 대시보드, 예산관리, 마인드맵, 법령/지침 등의 메인 탭 전환 시 1프레임 이상의 렌더 프리징(UI 멈춤) 현상을 차단합니다.
- 리렌더링 부하가 큰 복합 컴포넌트(예: BudgetDashboard, InventoryList)와 하위 컴포넌트(카드, 리스트 아이템)들에 대해 `React.memo`를 통한 렌더링 전파 차단을 적용하고, 핸들러 함수와 가공 데이터 객체에 `useCallback` 및 `useMemo`를 엄격히 적용합니다.

### R3. 3D 마인드맵 렌더링 고속화 및 GC 렉 제거
- 3D 마인드맵 노드 및 간선 렌더링 성능을 극대화하여 대규모 데이터 로드 시 프레임 레이트(Target 60 FPS)를 유지합니다.
- 렌더링 루프(`requestAnimationFrame` 등) 및 궤도 연산 로직 내에서 삼각함수, 행렬 연산 및 매 프레임 발생하는 일시적 객체 생성을 최소화하고, 연산 결과 캐싱 및 객체 풀(Object Pooling) 패턴을 적용하여 가비지 컬렉터(GC)로 인한 미세 뚝끊김(Stuttering)을 방지합니다.
- 카메라 프러스텀 바깥의 노드는 렌더링을 완전히 생략하는 컬링(Culling)을 효율적으로 수행하도록 조율합니다.

### R4. API 데이터 페칭 지연 제거 및 로컬 캐싱 강화
- `/api/data` 라우트 등 로컬 JSON 데이터 조회 시 파일 I/O 병목을 최소화하고, React Query(`useTasks`, `useBudget` 등)의 `staleTime`, `gcTime` 설정을 정교화하여 불필요한 API 다중 재요청을 차단하고 로컬 메모리 캐시를 최우선 활용하도록 개선합니다.

## Acceptance Criteria

### 로딩 성능
- [ ] 첫 진입 시 스플래시 로딩 오버레이가 데이터 로드 완료 및 락 해제 후 지연 없이 부드럽게 걷힌다.
- [ ] 브라우저 개발자 도구의 Performance 탭에서 메인 탭 전환 시 CPU 메인 스레드 점유로 인한 Long Task(50ms 이상) 횟수가 현저히 감소한다.

### 렌더링 정밀도
- [ ] `React Developer Tools`의 Highlight Updates를 켰을 때, 특정 노드나 예산 셀 변경 시 무관한 부모/형제 컴포넌트들의 중복 렌더링이 발생하지 않는다.
- [ ] 3D 마인드맵 조작 시 프레임이 눈에 띄게 끊기지 않고 부드럽게(Target 60 FPS) 회전 및 줌이 수행된다.

### 빌드 안정성
- [ ] `npm run build` 결과물 빌드 시 청크 분할 및 최적화가 정상 처리되어 프로덕션 빌드가 성공한다.

## Verification Plan

### Automated Tests
- `npm run build`

### Manual Verification
- 브라우저 개발자 도구의 네트워크/성능 탭을 켜서 청크 크기 및 탭 전환 시 스레드 점유 상태를 육안 및 타임라인으로 검사합니다.

## Follow-up — 2026-07-21T01:21:59Z

Execute a comprehensive performance optimization across the VITAL web application to achieve ultra-fast tab switching (<50ms) and zero rendering lag by scoping top-level hooks, pausing non-active 3D WebGL render loops, caching physics calculations, and optimizing DB polling intervals.

Working directory: d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. Top-Level Hook Scoping & Conditional Computing
- Update `ProtectedApp` in `src/app/page.tsx` so heavy hooks (`useMergedSignals`, `useGraphCustomization`) pause execution and skip calculations when their target view (e.g. `mindmap`) is not active.
- Memoize `aiContextData` and signal extraction results to completely avoid re-computation during tab switches.

### R2. 3D WebGL Frame Pause & Physics Freezing
- Update `OntologyRenderer.tsx` and `MindMap3D.tsx` to immediately pause the `requestAnimationFrame` physics loop and freeze node positions when the user navigates away from the mindmap tab.
- Instantly resume rendering upon tab activation without triggering a whiplash/re-simulation lag spike.

### R3. DB Polling & React Query Refetch Optimization
- Update `useGraphCustomization.ts` to suspend the 10-second `readSheet('MAP_CUSTOMIZATION')` polling loop when the mindmap tab is inactive or hidden (`document.visibilityState === 'hidden'`).
- Ensure React Query refetching for `useTasks`, `useBudget`, `useInventory`, etc., is debounced and cached cleanly.

### R4. Integrity & Automated Verification
- Ensure `npx tsc --noEmit` and `node scripts/run-harness.js` complete with 0 errors, 0 warnings, 0 architectural violations, and 0 performance bottlenecks.

## Acceptance Criteria

### Performance & Responsiveness
- [ ] Tab switching between Dashboard, Workspace, MindMap, and Projects responds in under 50ms without UI freezing.
- [ ] Moving away from the 3D MindMap tab completely halts its CPU/GPU physics loop.
- [ ] `node scripts/run-harness.js` passes with 0 errors, 0 warnings, 0 violations, and 0 bottlenecks.

## Follow-up — 2026-07-22T09:59:14+09:00

PORTFOLIO VITAL 프로젝트의 `PORTFOLIO VITAL - Engineering Report.md` 문서를 최신 코드베이스 통계, 렌더링 성능 지표, 모듈 인벤토리, R1/R2/R3 패치 이력 및 하네스 검증 결과로 종합 고도화하고 `AGENTS.md`와 동기화합니다.

Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. 코드베이스 실시간 통계 및 인벤토리 재산출
코드베이스를 스캔하여 총 TS/TSX 파일 수, 코드 라인 수, 커스텀 훅 목록(29개+), API 라우트 엔드포인트 목록 및 컴포넌트 구조를 정확히 측정하고 `PORTFOLIO VITAL - Engineering Report.md` Section 3 및 Section 5 항목에 반영합니다.

### R2. 엔지니어링 패치 내역 및 마일스톤 정교화
최근 완료된 R1(하이드레이션 및 청크 격리), R2(가상화 및 DOM 최적화), R3(무충돌 영속성 및 0-Stall 보장), 3D 마인드맵 rendering/GC 최적화, PBKDF2 캐싱 패치 등의 구체적 기술적 원인, 해결 방안, 성과를 챕터별로 정밀하게 작성하고 체계화합니다.

### R3. 하네스 자동 검증 및 무결성 수립
`npx tsc --noEmit` 및 `node scripts/run-harness.js`를 실행하여 0 compiler errors, 0 lint warnings, 0 architectural violations, 0 performance bottlenecks를 실증적으로 달성합니다.

### R4. 에이전트 매니페스트(AGENTS.md) 자동 동기화
`node scripts/sync-rules.js` 도구를 실행하여 엔지니어링 리포트의 마일스톤 로그를 `AGENTS.md` 파일 하단에 즉시 자동으로 최신화 동기화합니다.

## Acceptance Criteria

### Engineering Documentation Quality
- [ ] `PORTFOLIO VITAL - Engineering Report.md` 파일의 모든 통계, 스택 버전, 아키텍처 다이어그램 및 패치 내역이 최신 실측 상태와 100% 일치함
- [ ] 최근 반영된 R1/R2/R3 지연 예방 및 렌더링 최적화 패치 내역이 빠짐없이 명확하게 기술됨

### Automated Verification
- [ ] `npx tsc --noEmit` 명령 실행 결과 0 errors 달성
- [ ] `node scripts/run-harness.js` 실행 결과 0 warnings, 0 violations, 0 bottlenecks 통과
- [ ] `node scripts/sync-rules.js` 실행 완료 및 `AGENTS.md` 파일 정상 동기화 확인

## Follow-up — 2026-07-23T11:22:03Z

# Teamwork Project Prompt — System-Wide Freeze & Architectural Violation Elimination

Eliminate all UI thread freeze stalls (>100ms) across all modules (`mindmap`, `project`, `dashboard`, `workspace`), fix the architectural violation in `LocalhostStatusHUD.tsx` by eliminating direct `fetch()` calls inside UI components, and enforce 100% Zero-Stall performance.

Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. Architectural Violation Removal (Direct Fetch Elimination)
Refactor `LocalhostStatusHUD.tsx` to eliminate direct `fetch()` API calls inside the UI component, moving data fetching into a dedicated custom hook (`useLocalhostHealth.ts`) in strict compliance with the MVC ontology.

### R2. MindMap 3D WebGL Physics & Delta Clamping Optimization
Optimize `MindMap3D.tsx` to completely pause 3D physics ticks and WebGL rendering when `document.hidden` or `activeModule !== 'mindmap'`. Clamp frame delta to `Math.min(now - lastFrameTime, 33.3)` on tab resume to eliminate 3,420ms thread stalls.

### R3. Project Tab & WeeklyScheduler Component Optimization
Isolate heavy DOM rendering in `ProjectManagementPage.tsx` and `WeeklyScheduler.tsx` using `React.memo`, dynamic chunk preloading, and memoized callbacks to prevent 2,839ms layout freeze spikes.

### R4. Zero-Stall & Gatekeeper Verification Guarantee
Ensure 0 Long Task thread stalls (>100ms) across all modules and verify that `node scripts/run-harness.js` passes with 0 TypeScript compilation errors, 0 Zod schema errors, 0 Architectural violations, and 0 ESLint warnings.

## Acceptance Criteria

### Functionality & Performance
- [ ] Architectural violation in `LocalhostStatusHUD.tsx` is 100% resolved (0 direct `fetch` calls in UI).
- [ ] `MindMap3D` WebGL physics pauses completely on background tabs, preventing 3,420ms resume freezes.
- [ ] `ProjectManagementPage` and `WeeklyScheduler` render smoothly without DOM re-layout stalls.
- [ ] UI thread stall >100ms count is 0 across all modules (`mindmap`, `project`, `dashboard`, `workspace`).

### Automated Verification
- [ ] `node scripts/run-harness.js` passes cleanly with 0 Architectural Violations, 0 TSC errors, 0 Zod errors, 0 ESLint warnings.
- [ ] `node scripts/sync-rules.js` updates `AGENTS.md` milestone log.

## Follow-up — 2026-07-23T04:50:24Z

Eliminate the 2-3s UI thread freeze when entering the Budget Management page by implementing module pre-evaluation, component virtualization, GC allocation optimization, and isolation of background signal computations.

Working directory: d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL

## Requirements

### R1. Optimize Module Preloading & Idle Evaluation
- Reduce initial component parse stall by adjusting `WorkspaceView` staggered preloading timing or performing idle pre-compilation.

### R2. Virtualize Budget Category Cards & Eliminate Excess DOM Nodes
- Apply DOM virtualization (`useVirtualGrid` / windowing) or memoized chunk rendering to `PolicyGroupCard` and `BudgetCategoryCardItem` list rendering.

### R3. Fix GC Memory Allocation Spikes in `getCategoryStats`
- Cache `excludePlanned` stats calculation or avoid object instantiations inside render loops to prevent GC pressure.

## Acceptance Criteria


### Performance & Verification
- [ ] No UI thread long task (> 100ms) on entering the Budget Management page.
- [ ] `npx tsc --noEmit` completes with 0 errors.
- [ ] `node scripts/run-harness.js` passes clean.

## Follow-up — 2026-08-03T07:19:51Z

현재 남은 예산(집행 잔액)을 기준으로 앞으로 사용할 확정 지출 내역을 입력하여, 세부사업 및 통계목별로 남는 예산과 추가 집행 필요 금액을 실시간으로 추산하고 시뮬레이션하는 '예산 시뮬레이터(Budget Simulator)' 모듈 개발.

Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. PORTFOLIO - VITAL 기존 예산 데이터 연동 및 지출 예정 입력 UI
- 기존 `useBudget` 훅 및 `data/` 로컬 예산 데이터(세부사업, 통계목별 집행 현황)와 연동.
- 향후 사용할 확정 지출 예정 항목(항목명, 금액, 수량, 관련 세부사업, 통계목 매핑)을 추가/수정/삭제/테스트할 수 있는 시뮬레이션 입력 인터페이스 구현.
- 세부사업 및 통계목 입력 시 자동 매핑 및 세부사업/통계목별 즉각적인 드롭다운 필터링 제공.

### R2. 세부사업 & 통계목별 잔액 계산 엔진 (Zero-Stall $O(1)$ ~ $O(N)$)
- [현재 집행 잔액] - [입력된 확정 지출 예정액] = [최종 예상 잔액]을 실시간으로 계산.
- 세부사업별, 통계목별로 남는 예산(잔액)과 목표 집행 대비 추가로 더 집행해야 하는 필요 금액(집행 과부족액)을 동적 산출.

### R3. 시뮬레이션 대시보드 UI & 예산 잔액 현황 시각화
- 통계목별/세부사업별 시뮬레이션 결과 테이블 및 가상화 그리드 적용.
- 예산 초과(음수 잔액) 또는 과다 잔여 발생 시 고대비 시각 경고 하이라이팅 표시.
- 기존 대시보드 뷰와의 매끄러운 탭 전환 및 하이드레이션 격리 규칙 적용.

## Acceptance Criteria

### 핵심 시뮬레이션 검증 (Functional Criteria)
- [ ] 세부사업 및 통계목별 현재 잔액과 입력된 확정 지출 예정액의 연산 결과(예상 잔액, 추가 집행 필요액)가 정확히 대조/표시되는가?
- [ ] 세부사업 및 통계목 드롭다운 선택 시 해당 범주의 시뮬레이션 내역이 즉시 자동 필터링되는가?
- [ ] 예산 소진/초과 항목에 대한 시각적 경고(UI 하이라이트)가 제공되는가?
- [ ] `npx tsc --noEmit` 컴파일 및 `node scripts/run-harness.js` 검증 오류가 0건인가?






## Follow-up — 2026-08-13T13:16:11+09:00

지역축제(예산 5~7천만원 규모) 개최의 실수를 최소화하고 완벽한 행사를 진행할 수 있도록 3D 마인드맵 페이지를 형사들의 '수사 보드(Detective Investigation Board)' 스타일의 이벤트 종합 트래킹 및 검증 시스템으로 개편합니다.

Working directory: d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. 형사 수사 보드(Corkboard & Red String) 스타일 UI 및 캔버스 개편
- 3D 마인드맵/캔버스에 코르크 보드 분위기 및 핀, 빨간 연결선(Red String), 증거/서류 포스트잇 카드 노드 렌더링
- 노드 상태별(미완료/진행중/검증완료/위험경고) 수사관 검증 배지 및 시각적 알림 핀 표시

### R2. 축제 전용 템플릿 프리셋 및 도메인 자동 배치
- 5~7천만원 축제 규모에 최적화된 5대 도메인 템플릿 프리셋 주입 (인허가/안전관리, 무대/공연/음향, 홍보/마케팅, 먹거리/부스, 예산/계약)
- 1-Click 템플릿 즉시 로드 및 세부 구성 요소 자동 노드화 파이프라인

### R3. 실수 제로(Zero-Mistake) 실시간 검증 & 경고 엔진
- 인허가(지자체 신고, 경찰 도로점용, 소방 안전점검, 안전관리계획서) 필수 제출 항목 누락 방지 자동 경고 가드
- 5~7천만원 예산 범위 대비 세부 항목 지출 비율 및 집행 초과/미입력 항목 실시간 탐지 알림

## Acceptance Criteria



## Follow-up — 2026-08-13T13:16:11+09:00

지역축제(예산 5~7천만원 규모) 개최의 실수를 최소화하고 완벽한 행사를 진행할 수 있도록 3D 마인드맵 페이지를 형사들의 '수사 보드(Detective Investigation Board)' 스타일의 이벤트 종합 트래킹 및 검증 시스템으로 개편합니다.

Working directory: d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. 형사 수사 보드(Corkboard & Red String) 스타일 UI 및 캔버스 개편
- 3D 마인드맵/캔버스에 코르크 보드 분위기 및 핀, 빨간 연결선(Red String), 증거/서류 포스트잇 카드 노드 렌더링
- 노드 상태별(미완료/진행중/검증완료/위험경고) 수사관 검증 배지 및 시각적 알림 핀 표시

### R2. 축제 전용 템플릿 프리셋 및 도메인 자동 배치
- 5~7천만원 축제 규모에 최적화된 5대 도메인 템플릿 프리셋 주입 (인허가/안전관리, 무대/공연/음향, 홍보/마케팅, 먹거리/부스, 예산/계약)
- 1-Click 템플릿 즉시 로드 및 세부 구성 요소 자동 노드화 파이프라인

### R3. 실수 제로(Zero-Mistake) 실시간 검증 & 경고 엔진
- 인허가(지자체 신고, 경찰 도로점용, 소방 안전점검, 안전관리계획서) 필수 제출 항목 누락 방지 자동 경고 가드
- 5~7천만원 예산 범위 대비 세부 항목 지출 비율 및 집행 초과/미입력 항목 실시간 탐지 알림

## Acceptance Criteria

### 기능 및 UI 무결성
- [ ] 수사 보드 테마 (코르크 배경, 핀, 빨간 실선 엣지) 캔버스 정상 렌더링
- [ ] 축제 전용 5대 도메인 템플릿 프리셋 로드 및 노드 구성
- [ ] 필수 인허가/안전 항목 미비 시 캔버스 내 위험 알림 배지 및 경고 노출

### 코드 및 품질 무결성
- [ ] TypeScript (`npx tsc --noEmit`) 0 오류 통과
- [ ] 시스템 게이트키퍼 (`node scripts/run-harness.js`) 0 오류, 0 린트 경고, 0 아키텍처 위반 통과

## Follow-up — 2026-08-20T01:43:37Z

This is a single self-contained performance refactoring; keep it small and focused.

Comprehensive full-stack performance refactoring and structural optimization to dramatically accelerate application boot speed, eliminate UI thread freezes, and achieve optimal rendering efficiency for PORTFOLIO - VITAL.

Working directory: d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. Initial Boot & Hydration Acceleration
- Optimize client-side bundle boundaries and enforce dynamic imports (dynamic(() => import(...), { ssr: false })) with skeleton fallback guards for all heavy view modules.
- Streamline server hydration and eliminate any synchronous layout reflows (getBoundingClientRect, MutationObserver layout thrashing) during initial mount.
- Apply staggered chunk preloading in requestIdleCallback to prevent main thread blocking during initialization.

### R2. Runtime UI Thread & Zero-Stall Rendering Pipeline
- Maintain 0 Long Task Stalls (>50ms) across all UI interactions, tab switches, and canvas operations.
- Optimize high-frequency Yjs/React state subscriptions using useSyncExternalStore and 16ms debounced batching locks.
- Eliminate per-frame memory allocations and GC spikes in 3D MindMap / Canvas rendering loops using object pooling and primitive key encoding.

### R3. Data Structure & State Transition Complexity Leap (O(1))
- Replace O(N) sequential array iterations, filters, and searches within high-frequency render paths and selectors with O(1) Map/Set lookups.
- Maintain dirty-flag caching for topological graph traversal and hierarchical summaries to avoid redundant recalculations.

### R4. Architectural Consistency & Quality Gatekeeper
- Strictly preserve the M-V-C ontology: ensure 100% of data fetching/mutations remain inside React Query custom hooks in src/hooks/ and no direct fetch calls exist inside UI components.
- Maintain full offline resilience, E2EE bypass local plain-text JSON storage, and multi-device CRDT synchronization compatibility.

## Acceptance Criteria

### Automated Quality Gates
- [ ] TypeScript compilation (npx tsc --noEmit) passes with 0 errors.
- [ ] Automated harness verification (node scripts/run-harness.js) passes with 0 Zod errors, 0 ESLint warnings, 0 MVC ontology violations, and 0 performance bottlenecks.
- [ ] Existing Jest unit and integration test suite (npx jest) passes 100%.

### Performance Benchmarks
- [ ] Local dev server (http://localhost:3001) boots and delivers warm page responses without stalling.
- [ ] Zero blocking long tasks (>50ms) detected during active workspace and mindmap canvas interactions.
- [ ] Rule synchronization (node scripts/sync-rules.js) executes cleanly and updates milestone logs in AGENTS.md.

## Follow-up — 2026-09-04T05:08:33Z

This is a single self-contained fix; keep it small and focused.
2026 양재천 페스티벌 모바일 관제판의 실시간 무새로고침 다중 디바이스 동기화(스마트 폴링), 추진과제 섹터 기본 접힘(Default Collapsed) 상태 설정, 그리고 모바일 공유 기능 고도화를 신속하고 정확하게 구현 및 검증한다.

Working directory: d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. 실시간 무새로고침 다중 디바이스 데이터 동기화 (Zero-Refresh Multi-Device Sync)
- 타 디바이스(스마트폰/태블릿/원격 브라우저)에서 사용자가 F5 새로고침을 누르지 않아도, 관리자의 수정 내역이 2~3초 이내에 자동 반영되도록 `src/hooks/useYangjaeFestival.ts`의 React Query 훅에 스마트 폴링(`refetchInterval: 2500`, `staleTime: 1000`, `refetchOnWindowFocus: true`)을 구축한다.
- Rule J(Zero-Stall & Visibility Pause) 규격에 따라 탭 비활성(`document.hidden`) 시에는 불필요한 백그라운드 폴링을 차단(`refetchIntervalInBackground: false`)하고, 탭 복귀 시 즉각 최신 데이터를 페칭한다.

### R2. 추진과제 섹터별 기본 접힘(Default Collapsed) 상태 설정
- `src/components/festival/YangjaeFestivalDashboard.tsx`의 6대 추진과제 아코디언 상태(`expandedTaskIds`) 초기값을 기본 빈 Set(`new Set()`)으로 설정하여, 메인 화면 로드 시 모든 과제 카드가 콤팩트하게 접힌 상태로 렌더링되도록 개선한다.
- [전체 펼치기 / 전체 접기] 버튼 및 개별 과제 클릭 시의 O(1) 토글 상호작용은 기존과 동일하게 완벽히 보존한다.

### R3. 공유 기능 고도화 및 실시간 동기화 상태 인디케이터
- 헤더 또는 메인 뷰 상단에 실시간 자동 동기화 상태를 알리는 시각적 배지(예: 🟢 실시간 자동 동기화 중)를 가볍게 배치하여 외부 접속자에게 신뢰감을 제공한다.
- 단톡방/문자 공유 템플릿의 최신 활성 Cloudflare 터널 URL(`https://tell-blanket-start-deserve.trycloudflare.com/festival/yangjae`) 및 주간(8.31.~9.4.) 추진실적 포맷이 손실 없이 복사/공유되도록 보장한다.

## Acceptance Criteria

### 실시간 데이터 동기화
- [ ] PC 관리자 화면에서 과제 상태나 부스, 행사 개요를 수정한 후 저장하면, 다른 모바일/원격 브라우저에서 수동 새로고침 없이 3초 이내에 자동으로 변경 사항이 반영된다.
- [ ] 브라우저 탭 비활성 시 불필요한 폴링이 멈추고, 탭으로 돌아왔을 때 즉시 최신 상태로 재동기화된다.

### 기본 접힘(Default Collapsed) 레이아웃
- [ ] 페이지 최초 접속 시 6대 핵심 추진과제가 모두 접힌(Collapsed) 상태로 시작하여 한눈에 모든 과제 타이틀을 스캔할 수 있다.
- [ ] 상단 [전체 펼치기]를 누르면 모든 과제가 즉시 펼쳐지고, 다시 누르면 전체가 접힌다.

### 시스템 무결성 및 빌드
- [ ] `node scripts/run-harness.js` 검증 통과 (0 Zod errors, 0 ESLint errors, 0 warnings).
- [ ] `npx tsc --noEmit` TypeScript 컴파일 0 오류 달성.
- [ ] 패치 완료 후 `PORTFOLIO VITAL - Engineering Report.md`에 마일스톤 기록 및 `node scripts/sync-rules.js` 실행 완료.

## Follow-up — 2026-09-10T01:54:06Z

Re-architect and harden the end-to-end data persistence and state synchronization pipeline across the PORTFOLIO VITAL system to permanently eliminate data loss and stale UI states (ensuring text and operational edits in Festival Dashboard, Workspace Wiki, and Budget Simulator are 100% reliably committed to local disk SSOT and immediately reflected in the frontend), while optimizing application architecture to achieve instantaneous, zero-lag tab transitions and overall UX responsiveness.

Working directory: d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. Universal Zero-Loss Text & State Synchronization Pipeline
- Ensure that all text input, note edits, and sub-task modifications across all modules (Festival Dashboard, Workspace Wiki/BlockNote, Budget Simulator, and Tasks) are deterministically captured, protected against race conditions, and persisted to the local disk SSOT (`data/*.json`).
- Eliminate any desynchronization between disk persistence and frontend state: UI components must immediately and reliably re-render the updated state without requiring manual browser reloads or falling back to stale cache.
- Implement robust optimistic updates, error boundaries, and auto-recovery mechanisms to prevent in-flight text or data from being discarded during navigation or tab switching.

### R2. Instantaneous Tab Switching & Zero-Lag UX Architecture
- Optimize rendering lifecycle, state management, and chunk isolation so that switching between top-level and sub-level tabs (Festival, Workspace, MindMap, Budget, Overview) feels instantaneous (<100ms visual transition).
- Prevent expensive re-renders, unneeded layout thrashing, and main-thread freezing when switching views or mounting complex components.
- Ensure smooth typing experience with zero keystroke lag or stuttering across all text areas and rich text editors.

## Verification Resources
- Existing comprehensive test suites: 26 Jest suites covering 242+ tests (`npm test`).
- Playwright E2E and visual verification scripts in `scratch/`.
- Local development server running on `http://localhost:3001` with local JSON SSOT in `data/`.

## Acceptance Criteria

### Data Reliability & Integrity
- [ ] 100% of text and operational edits in the Festival Dashboard, Workspace Wiki, and Budget Simulator are persisted to local disk SSOT and immediately visible in the UI without page reload.
- [ ] No edited data is lost, overwritten, or reverted when switching tabs, navigating away, or typing rapidly.
- [ ] Concurrency and debounced write pipelines handle rapid successive inputs with zero data corruption or uncommitted pending states.

### UX & Tab Switching Performance
- [ ] Tab switching transitions complete with near-instantaneous visual responsiveness (<100ms) with zero visible freeze.
- [ ] Typing in high-frequency input fields maintains continuous 60fps fluidity without dropped frames.
- [ ] All 26 existing Jest test suites (242+ tests) pass cleanly without any regression.
