# Project: PORTFOLIO VITAL Persistence & Performance Architecture

## Architecture
Modified Feature-Sliced Design (FSD) + Model-View-Controller (MVC):
- **Model (SSOT Storage)**: Local disk JSON files in `data/*.json` accessed through Next.js API route handlers (`src/app/api/data/route.ts`, `src/app/api/festival/yangjae/route.ts`). Atomic write file operations (`safeWriteFile`) with GFS backup rotation and per-sheet concurrency mutex locks (`withSheetLock`).
- **Controller (Custom React Query Hooks)**: Located strictly in `src/hooks/` (`useTasks`, `useBudget`, `useInventory`, `useYangjaeFestival`, `useBudgetSimulator`, `useWikiStorage`). Encapsulates queries, optimistic mutations, deterministic cache invalidation (`onSettled: invalidateQueries`), and auto-flush on unmount/blur.
- **View (UI Modules)**: Located in `src/components/` (Festival Dashboard, Workspace, MindMap3D, Budget Simulator, Tasks, Overview). Adheres to Dormant Tab Strategy (visited tabs remain mounted via CSS `hidden`/`block`), Rule H (dynamic import with pixel-accurate Skeleton UI fallbacks), Rule I (visibility pause & zombie polling suppression via `isActive` prop), and Rule J (leaf-level keystroke isolation, `useDeferredValue`, stable React keys).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Backend Concurrency Mutex Queue | Per-sheet async serialization mutex in `src/app/api/data/route.ts` to prevent race condition clobbering | M1 | Survey (Explorer 1) |
| 2 | Budget Simulations SSOT | Add `BUDGET_SIMULATIONS` to `ALLOWED_SHEETS` in `route.ts`, initialize `data/BUDGET_SIMULATIONS.json`, and dual-sync from `useBudgetSimulator` | M1 | Survey (Explorer 1, 3) |
| 3 | Non-blocking Festival API | Decouple Cloudflare replica sync to async background task and apply atomic file write in `/api/festival/yangjae/route.ts` | M1 | Survey (Explorer 1) |
| 4 | Universal Cache Invalidation | Add `onSettled: invalidateQueries` across `useTasks`, `useBudget`, `useInventory`, `useContacts` and tune `query-client` staleTime | M1 | Survey (Explorer 1, 3) |
| 5 | Wiki Unmount Flush | Flush pending debounced wiki changes immediately on unmount/pagehide in `useWikiStorage.ts` | M1 | Survey (Explorer 1, 3) |
| 6 | Budget Simulator SSOT Sync | Sync `updateEntry` in `useBudgetSimulator.ts` to linked `BudgetEntry` in `BUDGET_ENTRIES.json` | M1 | Survey (Explorer 1) |
| 7 | Workspace Sub-Tab Dormant Strategy | Preserve mounted DOM instances of `BudgetDashboard`, `InventoryList`, `BudgetSimulator` via CSS toggling in `WorkspaceView.tsx` | M2 | Survey (Explorer 2, 3) |
| 8 | Festival Sub-Tab Dormant Strategy | Preserve mounted DOM instances of `milestones` and `booths` views via CSS toggling in `YangjaeFestivalDashboard.tsx` | M2 | Survey (Explorer 2) |
| 9 | Zombie Polling Suppression | Add `isActive` prop to `YangjaeFestivalDashboard` and pass to `useYangjaeFestival` to pause polling when tab is hidden | M2 | Survey (Explorer 2) |
| 10 | Keystroke Decoupling & Auto-Save | Debounce draft emission and add immediate `onBlur` auto-save in `DetailEditRow`; memoize handlers to prevent parent thrashing | M2 | Survey (Explorer 2, 1) |
| 11 | Rich Text & Search Optimization | Debounce note editor updates in `MindMapNoteEditor` & `WikiEditor`; add `useDeferredValue` to `SimulationResultTable` search | M2 | Survey (Explorer 2) |
| 12 | Skeleton UI Guards (Rule H) | Implement `MindMap3DSkeleton` and `YangjaeFestivalSkeleton` fallbacks for dynamic imports | M2 | Survey (Explorer 2) |
| 13 | Memoization Leak Fix (Rule J) | Replace inline arrow function `addSignal={() => {}}` in `ProtectedApp.tsx` with stable memoized callback | M2 | Survey (Explorer 2) |
| 14 | Automated Persistence & Perf Tests | Add test suites for unmount flush, cache reconciliation, and tab dormant state preservation | M3 | Survey (Explorer 3) |
| 15 | Regression Baseline Verification | Execute all 27+ Jest suites (247+ tests) with 100% pass | M3 | Survey (Explorer 3) |
| 16 | Patch Logging & Rules Sync | Update `PORTFOLIO VITAL - Engineering Report.md` and execute `node scripts/sync-rules.js` | M3 | Survey (Explorer 3) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Universal Zero-Loss Persistence & Concurrency Pipeline | Backend mutex queue (`withSheetLock`), `BUDGET_SIMULATIONS` disk SSOT, non-blocking festival API, universal query invalidation, wiki unmount flush, budget simulator sync | none | DONE |
| M2 | Instantaneous Tab Switching & Zero-Lag UX Architecture | Dormant sub-tab strategy (`WorkspaceView`, `YangjaeFestivalDashboard`), zombie polling pause (`isActive`), keystroke decoupling & blur save (`DetailEditRow`), deferred search, skeletons, memoization fixes | M1 | DONE |
| M3 | Comprehensive Verification, Test Suite Hardening, Patch Logging & Rule Sync | New test suites for persistence/performance, full 32 test suites pass (296 tests), Engineering Report update, `node scripts/sync-rules.js` execution, Forensic Audit | M2 | DONE |

## Interface Contracts
### `src/app/api/data/route.ts` ↔ `src/hooks/*`
- `ALLOWED_SHEETS`: Array of allowed sheet names. Includes `'BUDGET_SIMULATIONS'`.
- `withSheetLock<T>(sheet: string, fn: () => Promise<T>): Promise<T>`: Serializes read-modify-write calls per sheet.
- Response format: `{ success: true, count?: number, data?: any }` or `{ success: false, error: string }`.

### `src/components/ProtectedApp.tsx` ↔ `src/components/festival/YangjaeFestivalDashboard.tsx`
- Prop: `isActive?: boolean` (defaults to `true`).
- When `isActive === false`, internal `useYangjaeFestival(isActive)` disables background interval polling (`refetchInterval: false`).

### `src/components/festival/YangjaeFestivalDashboard.tsx` ↔ `DetailEditRow`
- `onUpdate: (formatted: string) => void` (stable memoized reference per row).
- `onBlur?: () => void` or internal debounced change with immediate blur flush.
- `onTransfer`, `onMoveUp`, `onMoveDown`: Stable memoized callbacks.

## Code Layout
- Backend routes: `src/app/api/data/route.ts`, `src/app/api/festival/yangjae/route.ts`
- Query client & cache: `src/lib/query-client.ts`, `src/lib/sheets-api.ts`
- Controller hooks: `src/hooks/useTasks.ts`, `src/hooks/useBudget.ts`, `src/hooks/useInventory.ts`, `src/hooks/useYangjaeFestival.ts`, `src/hooks/useBudgetSimulator.ts`, `src/hooks/useWikiStorage.ts`, `src/hooks/useContacts.ts`
- UI views & components: `src/components/ProtectedApp.tsx`, `src/components/WorkspaceView.tsx`, `src/components/festival/YangjaeFestivalDashboard.tsx`, `src/components/festival/ui/DetailEditRow.tsx`, `src/components/budget/ui/SimulationResultTable.tsx`, `src/components/skeletons/*`
- Tests: `__tests__/**/*.test.ts*`, `src/**/*.test.ts*`
- Rules & documentation: `PORTFOLIO VITAL - Engineering Report.md`, `AGENTS.md`, `scripts/sync-rules.js`
