# ▣ VITAL Architecture — Comprehensive Codebase Analysis & Step-by-Step Refactoring Roadmap

> **Author**: Senior Refactoring Architecture Team  
> **Date**: 2026-11-10  
> **Status**: APPROVED & ACTIVE (Phases 1–4)  
> **Governance Reference**: `AGENTS.md`, `PROJECT.md`, `docs/VLDS_DESIGN_SYSTEM.md`  
> **Target System**: VITAL Work & Wealth Platform (Modified FSD + MVC + Hybrid Edge, 168 TS/TSX files, 54,230+ LOC)

---

## 1. Executive Summary & Architectural Context

The VITAL platform serves as an enterprise-grade administrative and financial operating system for local public health governance. Over 315 engineering milestones, the codebase has scaled to **54,230+ lines of TypeScript code (LOC)** across 168 source files.

While the system enforces rigorous standards—including 12-domain Zod runtime schemas, 38 Jest regression suites (390+ tests), and mathematical budget invariants (0-won error)—rapid feature evolution has introduced technical debt, architectural coupling, and code sprawl across the three architectural layers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MODIFIED FSD ARCHITECTURE LAYERS                      │
├────────────────────────────────┬────────────────────────────────────────────┤
│ 1. View Layer (UI & VLDS)      │ 98 components (28,348 LOC)                 │
│    `src/components/`           │ 6 files > 1,000 LOC; monolithic hotspots   │
├────────────────────────────────┼────────────────────────────────────────────┤
│ 2. Controller Layer (Hooks)    │ 42 custom hooks (9,701 LOC)                │
│    `src/hooks/`                │ Top 5 hooks = 52.7% LOC; 11 dead hooks     │
├────────────────────────────────┼────────────────────────────────────────────┤
│ 3. Model & Storage Layer (API) │ 20 API routes, 27 SSOT JSONs (16,181 LOC)  │
│    `src/app/api/`, `data/`     │ Validation masking; split-brain writes     │
└────────────────────────────────┴────────────────────────────────────────────┘
```

This roadmap synthesizes the exhaustive cross-layer surveys of the architecture team into an actionable, four-phase refactoring initiative designed to systematically eliminate monoliths, restore controller isolation, unify data storage, and eliminate dead code without incurring runtime regression.

---

## 2. Layer-by-Layer Comprehensive Codebase Audit

### 2.1 View Layer (Frontend UI & Components)

A survey of `src/components/` and `src/app/` (98 component files) identified the following architectural bottlenecks:

#### A. Monolithic Hotspots
- **`YangjaeFestivalDashboard.tsx` (4,978 LOC)**:
  - Contains 35 `useState`, 38 `useCallback`, and 11 `useMemo` declarations in a single file.
  - Combines 4 major administrative tabs (`추진과제`, `부스현황`, `업무분장`, `행사식순`), PIN security modals, duty reassignments, PIPA string masking, and Excel sync.
  - Text filtering re-evaluates the entire 4,978-line tree, risking frame stutter on mobile devices.
- **`WeeklyScheduler.tsx` (1,870 LOC)**:
  - 10 logically independent subcomponents defined in a single file (`ScheduleModal`, `GoogleCalendarSyncModal`, `ScheduleForm`, `ScheduleItem`, `WeekDayColumn`, `MonthSchedulePill`, `MonthCell`, `TimetableScheduleItem`, `TimetableSlotCell`, and the orchestrator component).
  - High cyclomatic complexity hampers modular testing, although subcomponents are already functionally isolated with `React.memo`.
- **`SimulationResultTable.tsx` (1,439 LOC)**:
  - Renders 3 distinct presentation modes (`project`, `stat`, `entry`) and level-3 financial ledger entries without virtualization.
- **`ArchiveExplorerView.tsx` (1,334 LOC)**:
  - Controls 3 separate workflows (`archive`, `ontology`, `weekly`). Renders 6,201 index entries without pagination or virtual scrolling.

#### B. Architectural Coupling & Phantom Prop Drilling
- **`ProtectedApp.tsx` $\to$ `WorkspaceView.tsx`**:
  - `ProtectedApp` initializes `useInventory` and injects 7 inventory mutators and `addSignal` into `WorkspaceView`.
  - `WorkspaceView` declares these props solely for parent interface compatibility and **never consumes them** in its implementation.
- **Inconsistent Hook Consumption**:
  - `BudgetDashboard` receives 14 drill-down props from `ProtectedApp`, whereas its sibling `BudgetSimulator` directly consumes `useBudget()` and `useBudgetSimulator()`.

#### C. M-V-C Controller Isolation Violations (Direct `fetch()` Calls)
Contrary to `AGENTS.md` Rule 1 ("Components must strictly consume custom hooks in `src/hooks/`; inline `fetch()` is prohibited"), **12 direct `fetch()` calls** exist across 5 component files:
- `ArchiveExplorerView.tsx` (lines 203, 216): direct queries to `/api/admin-ontology`.
- `YangjaeFestivalDashboard.tsx` (line 2141): direct POST to `/api/festival/yangjae/sync-excel`.
- `AdminOntologyDrawer.tsx` (lines 86, 153): direct queries to `/api/admin-ontology` and `/api/archive/open`.
- `AdminOntologyExplorer.tsx` (lines 107, 125, 158): direct queries to `/api/admin-ontology`.
- `WeeklyReportManager.tsx` (lines 70, 110, 136, 162): 4 direct queries to `/api/weekly-report`.

#### D. Design System (VLDS) Non-Conformance & Dead Components
- **Zero Primitive Adoption**: Pre-built VLDS primitives (`Button`, `Badge`, `NumericText`, `KpiStatCard`) have 0% adoption across feature views, resulting in duplicated raw JSX elements.
- **Legacy Style Residue**: 529 `dark:` classes, 32 `backdrop-blur` filters, 167 `transition-all` declarations, and 7 `.glass-panel` utilities violate the single-light-theme, low-power desktop specification.
- **Orphan UI Components (11 files, 3,100+ LOC)**: Completely unreferenced in runtime navigation (`AddDataModal`, `LawSystemPage`, `LawSearchPanel`, `TaskModal`, `WeeklyReportView`, `DynamicForceGraph`, `WorkingMemoryBoard`, `SemanticReviewModal`, `WikiEditor`, `QuickPlanModal`, `InventoryList`).

---

### 2.2 Controller Layer (State Management & Custom Hooks)

A survey of `src/hooks/` (42 custom hooks, 9,701 LOC) identified significant technical debt and stability risks:

#### A. Massive Embedded Data Fixtures
- **`src/hooks/useYangjaeFestival.ts` (2,383 LOC)**:
  - Lines 119 to 2314 contain a **2,195-line static JSON literal** (`YANGJAE_FALLBACK_DATA`), which duplicates `data/FESTIVAL_YANGJAE_2026.json`.
  - The actual React hook logic occupies only 89 lines (lines 2315–2403). The fixture bloats hook bundle size and editor performance.

#### B. Dead and Dormant Legacy Hooks (15 hooks, 2,369 LOC)
- **11 Completely Dead Hooks (1,078 LOC)**: Zero references across all 168 source files:
  `useWikiStorage`, `useNotificationAlerts`, `useFreezeDetector`, `useMergedSignals`, `useGlobalSearch`, `useReportGenerator`, `useFileRadar`, `useSecurityLock`, `useAILinker`, `useLlmExtract`, `useClassificationWords`.
- **4 Dormant / Test-Only Hooks (1,291 LOC)**:
  `useGraphCustomization` (759 LOC, remnant of removed `MindMap3D`), `useFestivalValidation` (382 LOC, only in unit tests), `useScheduleAlerts` (101 LOC), `useLocalContacts` (49 LOC).

#### C. Conflicting State Management Paradigms
The application maintains four diverging state patterns:
1. **React Query (`@tanstack/react-query`)**: Cache-backed, reactive cross-component synchronization (`useBudget`, `useTasks`, `useInventory`, `useContacts`).
2. **Component-Local `useGoogleSheet`**: `useProjects`, `useMeetings`, `useSchedules` utilize local `useState`. Calling `useProjects` in multiple components creates isolated, desynchronized state instances.
3. **Module-Scoped Singleton**: `useWorkingMemory` uses a module-level variable `hasFetchedFromServer = false`. Once flipped to `true`, route transitions permanently block subsequent fetches.
4. **CRDT Yjs Store**: `useYjsStore`, `useAgentStatus`.

#### D. Critical Data Integrity Flaws & Antipatterns
- **Simulation Desynchronization Bug (`useBudgetSimulator.ts:512-543`)**:
  `settleEntry` awaits synchronous mutations (`updateBudgetEntry`, `addBudgetEntry`). If `addBudgetEntry` returns `null` due to budget limit checks (`checkLimit`), `settleEntry` still updates the simulation item status to `SETTLED` with `settledEntryId: undefined`. This marks the simulation as executed without writing the financial ledger row into `BUDGET_ENTRIES`.
- **UI Blocking Alerts**: `useBudget.ts` directly invokes `window.alert(...)` at lines 425, 432, 469, and 677, halting JS thread execution and breaking headless test automation.
- **Boilerplate Duplication**: Optimistic query updates repeated 25+ times across hooks; `useSyncExternalStore` over `localStorage` duplicated verbatim across 4 hooks.

---

### 2.3 Model & Storage Layer (API, Schemas, Data & Test Harness)

A survey of `src/app/api/` (20 routes), `src/lib/schemas.ts`, and `data/` (27 JSON files) revealed:

#### A. Server-Side Validation Masking & Security Exposure
- **Zod Validation Masking (`src/app/api/data/route.ts:187-214`)**:
  `validateDataPayload` invokes `getDomainSchema(sheet)`, which provides lenient schemas with `.catch()` clauses on every field. Consequently, `schema.safeParse()` always returns `success: true`. Furthermore, the unparsed raw client payload (`cleanData`) is committed directly to disk, bypassing data sanitization.
- **Security Vulnerabilities**:
  - `src/app/api/drive/route.ts`: Executes `python scripts/fast_parser.py <filePath>` with arbitrary client-supplied paths without root containment (`ALLOWED_ROOTS`), exposing a Local File Inclusion (LFI) vector.
  - `src/app/api/calendar/import/route.ts`: Fetches arbitrary user-supplied `icsUrl` values without domain allowlisting, exposing a Server-Side Request Forgery (SSRF) vector.

#### B. Split-Brain Direct File Writes
While `src/app/api/data/route.ts` employs mutex locks (`withSheetLock`), atomic `.tmp` renames, and 3-tier backups, other endpoints bypass this infrastructure:
- `src/app/api/calendar/import/route.ts:78`: Overwrites `SCHEDULES.json` via raw `fs.writeFile`.
- `src/app/api/weekly-report/route.ts:228`: Overwrites `WEEKLY_REPORTS.json` via uncoordinated `fs.writeFile`.
- `src/app/api/memo/route.ts:145`: Writes `WORKING_MEMORY.json` via synchronous standalone renames.
- `src/app/api/local-contacts/route.ts:79`: Writes plain text entries to `data/local_contacts.txt`.

#### C. Schema Triplication Technical Debt
Schemas are declared three separate times:
1. `src/lib/schemas.ts` (lenient runtime schemas with `.catch()`).
2. `src/lib/schemas.ts` (strict audit schemas without `.catch()`).
3. `scripts/run-harness.js` (860 LOC duplicate CommonJS schema definitions).
This requires an entire 407-line regression suite (`__tests__/harness-schema-parity.test.ts`) solely to monitor schema drift between files.

---

## 3. Prioritized 4-Phase Refactoring Execution Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FOUR-PHASE REFACTORING EXECUTION PLAN                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 1: Immediate Decoupling & High-Risk Integrity Fixes (Milestone 1-2)  │
│  ├─ P1-A: WeeklyScheduler.tsx Monolith Decomposition (1,870 -> 350 LOC)     │
│  ├─ P1-B: useYangjaeFestival.ts Fallback Fixture Extraction (2,195 LOC)     │
│  ├─ P1-C: useBudgetSimulator settleEntry Data Integrity Bug Fix             │
│  ├─ P1-D: /api/data Strict Schema Validation & Sanitized Storage            │
│  └─ P1-E: /api/drive LFI & /api/calendar/import SSRF Security Hardening     │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 2: Core Domain Monolith Modularization & Controller Isolation        │
│  ├─ P2-A: YangjaeFestivalDashboard.tsx 4-Tab Modularization (4,978 LOC)     │
│  ├─ P2-B: Extract Direct fetch() into Custom Hooks (M-V-C Recovery)         │
│  ├─ P2-C: SimulationResultTable & ArchiveExplorerView Virtualization        │
│  └─ P2-D: Eliminate Phantom Prop Drilling in ProtectedApp / WorkspaceView   │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 3: State & Storage Layer Consolidation                               │
│  ├─ P3-A: Unified Server Storage Service (safeWriteFile, Lock, Backups)     │
│  ├─ P3-B: Decouple e-호조 Budget Validator from /api/data Route            │
│  ├─ P3-C: Migrate useProjects / useMeetings / useSchedules to React Query   │
│  ├─ P3-D: Resolve useWorkingMemory Re-entry Fetching Bug                    │
│  └─ P3-E: Generic useLocalStorageStore & Mutation Factories                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 4: Dead Code Elimination, Schema SSOT & Design System Hardening      │
│  ├─ P4-A: Quarantine / Prune 11 Dead Hooks & Legacy MindMap3D Hooks         │
│  ├─ P4-B: Prune 4 Orphaned API Routes & 1.9MB Dormant Data Files            │
│  ├─ P4-C: Unify Zod Schema SSOT (Replace CJS Copy in run-harness.js)        │
│  └─ P4-D: Purge 529 dark: Classes & Adopt Standard VLDS Primitives          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Immediate Decoupling & High-Risk Integrity Fixes

**Objective**: Address the highest-ROI structural monoliths and critical data integrity/security risks with zero regression to external APIs or UI behavior.

#### Task 1.1: `WeeklyScheduler.tsx` Monolith Modularization (Top-Priority UI Refactor)
- **Target File**: `src/components/dashboard/WeeklyScheduler.tsx` (1,870 LOC $\to$ ~350 LOC)
- **Extracted Subcomponents** (`src/components/dashboard/scheduler/`):
  1. `types.ts`: `ScheduleEvent`, `ScheduleModalProps`, `ScheduleFormProps`, `WeekDayColumnProps`, etc.
  2. `ScheduleModal.tsx`: Event detail and edit modal (lines 91–461).
  3. `GoogleCalendarSyncModal.tsx`: RFC 5545 and Google Calendar export dialog (lines 462–636).
  4. `ScheduleForm.tsx`: Schedule creation and modification form (lines 637–1002).
  5. `ScheduleItem.tsx`: List-view schedule card (lines 1003–1098).
  6. `WeekDayColumn.tsx`: Day column rendering for 7-day week view (lines 1099–1191).
  7. `MonthSchedulePill.tsx`: Pill presentation in calendar cells (lines 1192–1230).
  8. `MonthCell.tsx`: Month-view grid cell with overflow popovers (lines 1231–1303).
  9. `TimetableScheduleItem.tsx`: Timetable grid item card (lines 1304–1345).
  10. `TimetableSlotCell.tsx`: Hourly grid slot cell (lines 1346–1390).
- **Orchestrator Role**: `WeeklyScheduler.tsx` retains view-mode switching (`week`, `month`, `timetable`, `list`), date navigation, and preset dispatching.
- **Backward Compatibility**: Default export `WeeklyScheduler` and all types preserved with identical signatures.
- **Risk Mitigation**: All extracted subcomponents retain existing `React.memo` wrapping and callback signatures.

#### Task 1.2: `useYangjaeFestival.ts` Fallback Decoupling (Top-Priority Hook Refactor)
- **Target File**: `src/hooks/useYangjaeFestival.ts` (2,383 LOC $\to$ ~188 LOC)
- **Extracted Constant**: `src/lib/constants/yangjaeFestivalFallback.ts` (2,195 LOC static fixture).
- **Backward Compatibility**: Re-export `YANGJAE_FALLBACK_DATA` and `initialFallbackData` directly from `useYangjaeFestival.ts`.
- **Risk Mitigation**: Ensures Cloudflare KV 4-Way sync (`Rule S`) and Jest test suites (`useFestivalValidation.test.ts`) continue accessing identical symbols.

#### Task 1.3: Fix `useBudgetSimulator:settleEntry` Data Desynchronization
- **Target File**: `src/hooks/useBudgetSimulator.ts`
- **Correction**: Verify that `addBudgetEntry` successfully creates a ledger record before marking the simulation item as `SETTLED`. If budget limits block creation, abort status mutation and return an error payload to the UI.

#### Task 1.4: `/api/data` Strict Validation & Sanitized Storage
- **Target File**: `src/app/api/data/route.ts`
- **Correction**: Validate incoming client rows against strict domain schemas. Persist the sanitized `parsed.data` output rather than unvalidated raw client payloads.

#### Task 1.5: Security Hardening for `/api/drive` and `/api/calendar/import`
- **Target Files**: `src/app/api/drive/route.ts`, `src/app/api/calendar/import/route.ts`
- **Correction**: Enforce path confinement within `ALLOWED_ROOTS` for drive parsing; validate external iCal URLs against an approved protocol and domain whitelist.

---

### Phase 2: Core Domain Monolith Modularization & Controller Isolation

**Objective**: Modularize second-tier monolithic components, eliminate direct `fetch()` calls from UI views, and resolve props drilling.

#### Task 2.1: `YangjaeFestivalDashboard.tsx` 4-Tab Modularization
- **Target File**: `src/components/festival/YangjaeFestivalDashboard.tsx` (4,978 LOC $\to$ ~450 LOC)
- **Extracted Modules** (`src/components/festival/yangjae/`):
  - `MilestonesTab.tsx` (Tab 1: 추진과제 리스트 및 마일스톤)
  - `BoothsTab.tsx` (Tab 2: 19개 부스 현황 및 상세 모달)
  - `DutiesTab.tsx` (Tab 3: 현장 업무분장 및 비상연락망)
  - `ScheduleTab.tsx` (Tab 4: 개막식 및 행사식순)
  - `SecurityPinModal.tsx` & `DutyAssignmentModal.tsx`
  - `festivalUtils.ts` (Phone formatter, PIPA maskers)
- **Risk Mitigation**: Verify mobile 448px (`max-w-md`) viewport bounds and ensure Cloudflare Pages template sync (`scripts/pages-template.html`) remains uncompromised.

#### Task 2.2: Extract Direct `fetch()` Calls into Custom Hooks
- **Target Files**: `ArchiveExplorerView.tsx`, `AdminOntologyExplorer.tsx`, `WeeklyReportManager.tsx`
- **New Hooks**:
  - `src/hooks/useAdminOntology.ts`: Encapsulates cross-join queries, graph visualization endpoints, and reindexing.
  - `src/hooks/useWeeklyReport.ts`: Encapsulates weekly report queries, batch compilation, and HWPX generation.
- **Outcome**: Restores 100% adherence to `AGENTS.md` M-V-C controller guidelines.

#### Task 2.3: UI Virtualization for Large Administrative Datasets
- **Target Files**: `SimulationResultTable.tsx` (1,439 LOC), `ArchiveExplorerView.tsx` (1,334 LOC)
- **Correction**: Integrate windowed virtualization (`useVirtualGrid` / `@tanstack/react-virtual`) for the 6,201-record archive index and nested budget ledgers, keeping DOM node count under 150 nodes.

#### Task 2.4: Eliminate Phantom Props in `ProtectedApp` and `WorkspaceView`
- **Target Files**: `src/components/ProtectedApp.tsx`, `src/components/WorkspaceView.tsx`, `src/components/budget/BudgetDashboard.tsx`
- **Correction**: Remove unused inventory and signal props from `WorkspaceView`. Refactor `BudgetDashboard` to consume `useBudget()` directly.

---

### Phase 3: State & Storage Layer Consolidation

**Objective**: Unify split-brain file writing into a single transactional server service, decouple complex budget business logic, and migrate disparate state stores to React Query.

#### Task 3.1: Centralized Server Storage Service
- **New File**: `src/lib/server/storage-service.ts`
- **Responsibilities**:
  - Centralizes `safeWriteFile`, `safeReadFile`, and `withSheetLock` mutex synchronization.
  - Centralizes 3-tier backup rotation (Son 20 backups, Father 7 days, Grandfather 4 weeks).
- **Migration**: Refactor `/api/data`, `/api/festival/yangjae`, `/api/calendar/import`, `/api/weekly-report`, and `/api/memo` to route all disk mutations through this single service.

#### Task 3.2: Decouple e-호조 Budget Business Logic from `/api/data`
- **New File**: `src/lib/server/budget-validator.ts`
- **Responsibilities**: Extracts the 120-line budget ceiling, daily expense isolation (`daily_expense`), and lock validation logic out of `src/app/api/data/route.ts` into pure testable functions.

#### Task 3.3: Unify Scheduling, Project, and Meeting State under React Query
- **Target Hooks**: `src/hooks/useProjects.ts`, `src/hooks/useMeetings.ts`, `src/hooks/useSchedules.ts`
- **Correction**: Replace component-local `useGoogleSheet` state with React Query stores (`['PROJECTS']`, `['MEETINGS']`, `['SCHEDULES']`), ensuring instant reactive updates across split-screen views.

#### Task 3.4: Resolve `useWorkingMemory` Route Navigation Re-fetch Trap
- **Target Hook**: `src/hooks/useWorkingMemory.ts`
- **Correction**: Replace the module-scoped `hasFetchedFromServer` latch with React Query's query cache `staleTime`, enabling proper background revalidation upon view re-entry.

#### Task 3.5: Generic React Query Mutation & LocalStorage Synchronization Utilities
- **New Utilities**:
  - `src/lib/useLocalStorageStore.ts`: Replaces duplicated `useSyncExternalStore` implementations across 4 hooks.
  - `src/hooks/factories/useEntityCrud.ts`: Standardizes optimistic mutation boilerplate across entity hooks.

---

### Phase 4: Dead Code Elimination, Schema SSOT & Design System Hardening

**Objective**: Eliminate dead code, harmonize Zod schema declarations to a single source of truth, and enforce VLDS design consistency.

#### Task 4.1: Quarantine / Remove 11 Dead Custom Hooks
- **Targets**: `useWikiStorage`, `useNotificationAlerts`, `useFreezeDetector`, `useMergedSignals`, `useGlobalSearch`, `useReportGenerator`, `useFileRadar`, `useSecurityLock`, `useAILinker`, `useLlmExtract`, `useClassificationWords`.
- **Action**: Deprecate and remove dead hooks; isolate legacy test fixtures (`useGraphCustomization`, `useFestivalValidation`) within `src/__tests__/fixtures/`.

#### Task 4.2: Deprecate Orphaned API Endpoints & Stale Data Files
- **Endpoints**: `/api/ai-linker`, `/api/file-radar`, `/api/llm/extract`, `/api/report-generator`.
- **Data Files**: Archive `data/ARCHIVE_MIGRATION_LOG.json` (1.92 MB), `data/FILE_RADAR_CACHE.json`, and stale root backup snapshots.

#### Task 4.3: Unify Zod Schema Single Source of Truth
- **Action**: Update `scripts/run-harness.js` to dynamically load `Strict*Schema` definitions directly from `src/lib/schemas.ts` via TypeScript module execution, eliminating the 860-line CommonJS schema mirror and the need for `harness-schema-parity.test.ts`.

#### Task 4.4: Enforce VLDS Style Cleanliness & Component Primitives
- **Action**: Strip 529 legacy `dark:` selectors, 32 `backdrop-blur` instances, and 167 `transition-all` declarations across UI files. Replace inline button and modal markups with standard VLDS primitives (`Button`, `Modal`, `Badge`).

---

## 4. Prioritized Master Initiative Matrix (P1 to P12)

| Rank | Initiative | Target Layer & File(s) | Impact / LOC Delta | Complexity | Risk | Refactoring ROI |
|:---:|:---|:---|:---:|:---:|:---:|:---|
| **P1** | **WeeklyScheduler Decomposition** | `src/components/dashboard/WeeklyScheduler.tsx` | -1,520 LOC in orchestrator | Low | Low | **Very High** |
| **P2** | **Festival Fallback Fixture Extraction** | `src/hooks/useYangjaeFestival.ts` | -2,195 LOC in hook file | Low | Low | **Very High** |
| **P3** | **Budget Simulation Settle Desync Fix** | `src/hooks/useBudgetSimulator.ts` | Mathematical ledger integrity | Low | High | **Very High** |
| **P4** | **`/api/data` Strict Zod Sanitization** | `src/app/api/data/route.ts` | Closes unvalidated writes | Low | High | **High** |
| **P5** | **YangjaeFestivalDashboard Modularization**| `src/components/festival/` | -4,500 LOC in main view | High | Medium | **High** |
| **P6** | **Component `fetch()` to Hooks Migration**| Archive, Ontology, Weekly views | M-V-C compliance (12 calls) | Medium | Low | **High** |
| **P7** | **Unified Server Storage Service** | `src/lib/server/storage-service.ts` | Closes split-brain writes (5 APIs)| Medium | Medium | **High** |
| **P8** | **React Query State Unification** | `useProjects`, `useMeetings`, `useSchedules`| Eliminates state isolation bugs | Medium | Medium | **High** |
| **P9** | **Orphaned MindMap API Route Pruning** | 4 API routes, 1.9MB JSON files | Attack surface reduction | Low | Low | **High** |
| **P10**| **11 Dead Custom Hooks Elimination** | `src/hooks/` (11 dead files) | -1,078 LOC dead weight | Low | Low | **Medium** |
| **P11**| **Harness Schema SSOT Unification** | `scripts/run-harness.js` | Eliminates 860 LOC duplication | Medium | Medium | **Medium** |
| **P12**| **VLDS Design System Conformance** | 32 UI components | -529 dark:, -32 blur classes | Medium | Low | **Medium** |

---

## 5. Dependency Graph & Phase Sequencing

```
Phase 1 (Immediate Decoupling)
├── P1: WeeklyScheduler Refactor ───────────────► Standalone (No blockers)
├── P2: Festival Fallback Decoupling ───────────► Standalone (No blockers)
├── P3: Budget Simulator Bug Fix ───────────────► Preserves zero-sum ledger invariants
├── P4: /api/data Validation Recovery ──────────► Prerequisite for Phase 3 Storage Service
└── P5: Security Hardening (drive/import) ──────► Standalone security patch

Phase 2 (Monolith Modularization & M-V-C)
├── P6: YangjaeFestivalDashboard Modularization ─► Requires P2 (Fallback Decoupled)
├── P7: Direct fetch() Extraction to Hooks ─────► Standalone
└── P8: Virtualization & Prop Drilling Cleanup ─► Standalone UI optimization

Phase 3 (State & Storage Consolidation)
├── P9: Server Storage Service ─────────────────► Consolidates writes patched in P4
├── P10: Budget Validator Decoupling ───────────► Depends on P9
└── P11: Scheduling/Projects React Query ───────► Depends on P1 (Scheduler Modularized)

Phase 4 (Dead Code & Governance Hardening)
├── P12: Dead Hooks & Orphan Routes Cleanup ────► Requires all prior phases complete
└── P13: Schema SSOT Unification ───────────────► Requires P4 & P9 stability
```

---

## 6. Risk Management & Regression Prevention Strategy

To ensure zero disruption to live operations, all refactoring tasks must adhere to the following governance safeguards:

1. **Dual-Gate CI Verification Protocol**:
   - Every file modification must immediately pass `node scripts/run-harness.js` (12-domain Zod gatekeeper and 3-Way milestone sync).
   - TypeScript static type checking must report 0 errors via `npx tsc --noEmit`.
   - All 38 Jest test suites (390+ tests) must pass without regressions (`npm test`).
2. **Mathematical Invariant Safeguard (`Rule 1 & Rule R`)**:
   - Budget calculations must enforce:
     $$\text{Total Project Budget} \equiv \sum \text{Funding Sources} \equiv \sum \lceil \text{Item Amounts} \rceil_{1,000}$$
   - General expenditure and daily expenditure (`daily_expense`) pipelines must remain strictly isolated.
3. **Public Interface & Backward Compatibility Contract**:
   - Extracted subcomponents and constants must be re-exported by their original parent files to prevent breaking downstream consumers or external test harnesses.
4. **Desktop Preservation Principle (`Rule O`)**:
   - Automated scripts and refactoring tasks must never delete, relocate, or overwrite files in `D:\Desktop` without explicit user instruction.

---

## 7. Immediate Execution Plan (Phase 1 / Milestones 1 & 2 Focus)

The immediate implementation focus centers on **Phase 1 Tasks 1.1 and 1.2**:
1. **Decompose `src/components/dashboard/WeeklyScheduler.tsx`** into `src/components/dashboard/scheduler/` subcomponents, shrinking the orchestrator to ~350 LOC while preserving all exports and UI behavior.
2. **Extract `YANGJAE_FALLBACK_DATA`** from `src/hooks/useYangjaeFestival.ts` into `src/lib/constants/yangjaeFestivalFallback.ts`, shrinking the hook file from 2,383 LOC to ~188 LOC with 100% backward compatibility.
3. **Validate across full regression gates** (`run-harness.js`, `tsc --noEmit`, all 38 Jest suites).
