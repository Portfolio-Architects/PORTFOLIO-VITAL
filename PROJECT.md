# Project: VITAL Web Application Comprehensive Codebase Analysis & Step-by-Step Refactoring

## Architecture
Modified Feature-Sliced Design (FSD) + Model-View-Controller (MVC) + Hybrid Edge:
- **View Layer (`src/components/`)**:
  - 98 components, 23 files > 500 LOC, 6 files > 1,000 LOC.
  - Monolithic hotspots analyzed: `YangjaeFestivalDashboard.tsx` (4,978 LOC), `WeeklyScheduler.tsx` (1,870 LOC), `SimulationResultTable.tsx` (1,439 LOC), `ArchiveExplorerView.tsx` (1,334 LOC).
  - Target FSD Structure: Component modularization into sub-feature folders (`src/components/dashboard/scheduler/`).
- **Controller Layer (`src/hooks/`)**:
  - 42 custom hooks (9,701 LOC).
  - Monolithic hotspots: `useYangjaeFestival.ts` (2,383 LOC with 2,195 LOC embedded fixture), `useGraphCustomization.ts` (759 LOC), `useBudgetSimulator.ts` (712 LOC), `useBudget.ts` (694 LOC).
  - Target State Consolidation: Extract data fixtures to `src/lib/constants/`, eliminate dead hooks, unify state management under React Query.
- **Model Layer (`src/app/api/`, `src/lib/schemas.ts`, `data/*.json`)**:
  - 20 API routes, Zod schemas, 27 SSOT data files.
  - Hotspots: `/api/data` validation masking with `.catch()`, split-brain direct writes, orphaned legacy routes (`ai-linker`, `drive`, etc.).
  - Target Model Consolidation: Unified storage service, strict schema validation, orphaned route deprecation.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Comprehensive Codebase Analysis Report | Cross-layer audit (UI, Hooks, API, Schemas, Data, Tests) with empirical metrics | M1 | Survey (Explorers 1, 2, 3) |
| 2 | Step-by-Step Refactoring Roadmap Document | Detailed roadmap (`docs/REFACTORING_ROADMAP.md`) with phases, scope, dependencies, and risk mitigation | M1 | Survey (Explorers 1, 2, 3) |
| 3 | Top-Priority UI Monolith Modularization | Decompose `WeeklyScheduler.tsx` (1,870 LOC) into `src/components/dashboard/scheduler/` subcomponents | M2 | Survey (Explorer 1) |
| 4 | Top-Priority Hook Fixture Decoupling | Decouple 2,195 LOC `YANGJAE_FALLBACK_DATA` fixture from `useYangjaeFestival.ts` into constants | M2 | Survey (Explorer 2) |
| 5 | Full Regression & Gate Verification | 53 Jest test suites (643 tests), `scripts/run-harness.js`, TypeScript 0 errors, Forensic Auditor verification | M3 | Testing & Audit Track |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Comprehensive Analysis & Refactoring Roadmap | Synthesize findings into formal `docs/REFACTORING_ROADMAP.md` covering 4 phases, 12 prioritized initiatives, dependency graphs, and risk mitigation | Survey Complete | DONE |
| M2 | Top-Priority Code Refactoring Implementation | Execute top-priority refactoring: modularize `WeeklyScheduler.tsx` into `scheduler/` subcomponents and extract `YANGJAE_FALLBACK_DATA` from `useYangjaeFestival.ts` with 100% backward compatibility | M1 | DONE |
| M3 | Full Regression, Integrity & Gate Verification | Run all 53 Jest test suites (643 tests), `node scripts/run-harness.js`, `npx tsc --noEmit`, Reviewers (2), Challengers (2), and Forensic Auditor verification | M2 | DONE |

## Interface Contracts
### `WeeklyScheduler.tsx` ↔ `src/components/dashboard/scheduler/*`
- Orchestrator: `WeeklyScheduler.tsx` remains the public export at `src/components/dashboard/WeeklyScheduler.tsx` (499 LOC, ~358 LOC core).
- Extracted Subcomponents in `src/components/dashboard/scheduler/`:
  - `types.ts` (153 LOC): Shared schedule interfaces (`ScheduleEvent`, `ViewMode`, `FormState`, etc.) and time calculation utilities.
  - `ScheduleModal.tsx` (356 LOC): Event detail and edit modal with declarative key-reset pattern.
  - `ScheduleForm.tsx` (367 LOC): Event creation and modification form.
  - `GoogleCalendarSyncModal.tsx` (181 LOC): RFC 5545 and Google Calendar sync dialog.
  - `WeekDayColumn.tsx` (90 LOC): Week-view single day column.
  - `MonthCell.tsx` (72 LOC) & `MonthSchedulePill.tsx` (41 LOC): Month-view grid cells and event pills.
  - `TimetableSlotCell.tsx` (49 LOC) & `TimetableScheduleItem.tsx` (43 LOC): Hourly timetable grid items.
  - `ScheduleItem.tsx` (96 LOC): List-view schedule card.
  - `index.ts` (11 LOC): Re-export barrel.
- Backward Compatibility: `WeeklyScheduler` default export and all named exports preserved identically via `export * from './scheduler';`.

### `useYangjaeFestival.ts` ↔ `src/lib/constants/yangjaeFestivalFallback.ts`
- Constant Extraction: `YANGJAE_FALLBACK_DATA` exported from `src/lib/constants/yangjaeFestivalFallback.ts` (2,196 LOC).
- Re-export Contract: `useYangjaeFestival.ts` re-exports `YANGJAE_FALLBACK_DATA` and `initialFallbackData` for 100% backward compatibility.
- Hook Signature: `useYangjaeFestival(isActive?: boolean): UseYangjaeFestivalResult` preserved identically (211 LOC).

## Code Layout
- Roadmap documentation: `docs/REFACTORING_ROADMAP.md`
- Frontend UI components: `src/components/dashboard/WeeklyScheduler.tsx`, `src/components/dashboard/scheduler/*`
- Custom hooks & constants: `src/hooks/useYangjaeFestival.ts`, `src/lib/constants/yangjaeFestivalFallback.ts`
- Test suites: `__tests__/`, `src/__tests__/` (53 test suites, 643 tests)
- Governance: `AGENTS.md`, `PORTFOLIO VITAL - Engineering Report.md`, `scripts/run-harness.js`
