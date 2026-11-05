# Project: Administrative Document Ontology & Automated Weekly HWPX Pipeline

## Architecture
Modified Feature-Sliced Design (FSD) + Model-View-Controller (MVC) + Hybrid Edge:
- **Model (SSOT Storage & Curation Engine)**:
  - Raw filesystem source (Read-only, Rule O compliant): `D:\Desktop` and `F:\_Organized_Archive` (`data/ARCHIVE_INDEX.json`).
  - Curated Caches & SSOT: `data/ADMIN_DOC_INDEX.json`, `data/SEED_ONTOLOGY_DOCS.json`, `data/WEEKLY_REPORTS.json`.
  - API Routes: `src/app/api/admin-ontology/route.ts`, `src/app/api/weekly-report/route.ts`, `src/app/api/data/route.ts`.
- **Controller (Query Hooks & Traversal Algorithms)**:
  - Located in `src/hooks/` (`useAdminOntology.ts`, `useWeeklyReports.ts`, `useTasks.ts`).
  - Bidirectional Graph Engine: `src/lib/ontology/admin-traversal.ts` (`traceUpstream`, `traceDownstream`, `detectAuditGaps`).
  - Wednesday Batch Aggregator: `src/lib/weekly/wednesday-batcher.ts`.
- **View (Interactive Graph & Inspection UI)**:
  - High-performance Canvas 2D Adapter: `src/lib/ontology/toAdminGraph.ts` connecting to `OntologyCanvasEngine.ts`.
  - Inspection & Generation UI: `src/components/ontology/AdminOntologyExplorer.tsx`, `src/components/ontology/AdminOntologyDrawer.tsx`, `src/components/weekly/WeeklyReportManager.tsx`.
- **Compiler (Document Auto-Generation Toolchain)**:
  - Standard Public Admin HWPX Builder: `scripts/generate_weekly_hwpx.py` adopting `docs/HWP_GENERATION_GUIDELINES.md` V3, 5-Pillar text overlap defense, multi-page comparative table (`pageBreak="CELL"`), and ZIP header bit-2 patching.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Archive & Desktop Non-destructive Classifier | 5-type regex & heuristic classifier for policy, result, audit, budget, weekly report | M1 | Survey (Explorer 2) |
| 2 | Admin Metadata & Budget Extractor | Non-destructive extraction of budget amounts, execution records, project tags, audit findings | M1 | Survey (Explorer 2) |
| 3 | Seed Ontology Dataset SSOT | Generation of `data/ADMIN_DOC_INDEX.json` and `data/SEED_ONTOLOGY_DOCS.json` with Rule O compliance | M1 | Survey (Explorer 2) |
| 4 | Admin Document Zod Schema & Validation | Formal Zod schema in `src/lib/schemas.ts` and integration with `scripts/run-harness.js` | M1 | Survey (Explorer 2, 3) |
| 5 | 4-Phase Administrative Lifecycle Entity Model | Typed models for Policy, Outcome, Audit, BudgetPlan, WeeklyWork | M2 | Survey (Explorer 3) |
| 6 | 7-Semantic Edge & Relation Topology | Semantic edges (`IMPLEMENTS`, `EVALUATES`, `CRITIQUES`, `MANDATES_IMPROVEMENT`, `FEEDBACK_LOOP`, `ALLOCATES_BUDGET`, `RECORDS_PROGRESS`) | M2 | Survey (Explorer 3) |
| 7 | Bidirectional Causal Traversal Algorithm | `traceUpstream`, `traceDownstream`, and `detectAuditGaps` implementation | M2 | Survey (Explorer 3) |
| 8 | Admin Ontology REST API | `/api/admin-ontology/route.ts` supporting bidirectional queries, audit gap detection, and graph fetching | M2 | Survey (Explorer 3) |
| 9 | Admin Ontology Visual Explorer & Inspector Drawer | Canvas 2D graph adapter and 448px responsive inspector drawer UI | M2 | Survey (Explorer 3) |
| 10 | Weekly Task Accumulation & Wednesday Batching Engine | Weekly tasks logging, category grouping, and Wednesday deadline cut-off filter | M3 | Survey (Explorer 1) |
| 11 | Comparative 2-Column Master HWPX Generator | Python generator for authentic 2-column comparative weekly reports (`업무실적` vs `업무계획`) | M3 | Survey (Explorer 1) |
| 12 | OWPML Geometry & Multi-Page Cell Sync | In-cell paragraph formatting, `pageBreak="CELL"`, 0.1px lineseg alignment, ZIP header bit-2 patching | M3 | Survey (Explorer 1) |
| 13 | Weekly Report REST API & Generation Hook | Trigger and download weekly HWPX reports via UI / API (`/api/weekly-report/route.ts`) | M3 | Survey (Explorer 1) |
| 14 | Opaque-box E2E Test Suite (Tiers 1-4) | Comprehensive test suite verifying curation, ontology querying, and HWPX compilation | M4 | E2E Testing Track |
| 15 | White-box Adversarial Coverage Hardening (Tier 5) | Adversarial test cases, boundary validation, and corruption fuzzing | M4 | E2E Testing Track |
| 16 | Forensic Audit & Governance Rule Sync | PIPA sanitization check, Rule O filesystem immunity check, `sync-rules.js` execution, and Forensic Auditor verification | M4 | Survey (Orchestrator) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | R2 실무 아카이브 및 바탕화면 핵심 문서 비파괴 선별·분류 인덱서 | 5대 핵심 행정 문서(방침, 결과, 감사, 예산, 주간) 비파괴 분류기, 메타데이터/예산액 추출기, `ADMIN_DOC_INDEX.json`, `SEED_ONTOLOGY_DOCS.json`, Zod 하네스 | none | PLANNED |
| M2 | R3 행정 문서·업무 온톨로지 데이터 모델, 양방향 순회 엔진 및 탐색기 | 4대 생애주기 엔티티, 7대 시맨틱 엣지, `traceUpstream`/`traceDownstream`/`detectAuditGaps`, REST API, Canvas 2D 어댑터 및 448px 인스펙터 UI | M1 | PLANNED |
| M3 | R1 주간업무 누적 관리 및 수요일 공공 표준 2단 대조 HWPX 자동 빌드 | 주간업무 기록 스키마, 수요일 배치 필터, 2단 대조(`업무실적` vs `업무계획`) HWPX 컴파일러, OWPML 기하학 동기화, ZIP 헤더 복원, REST API | M1, M2 | PLANNED |
| M4 | 최종 마일스톤: E2E 100% 통과, 적대적 커버리지 강화, 포렌식 무결성 감사 | Phase 1 (Tier 1-4 E2E 100% 통과), Phase 2 (Tier 5 적대적 하드닝), Rule E/G/M/O/Q/R 검증, `run-harness.js`, `sync-rules.js`, Forensic Auditor 무결성 감사 | M1, M2, M3 | PLANNED |

## Interface Contracts
### `scripts/curate_admin_archive.py` ↔ `data/ADMIN_DOC_INDEX.json` & `data/SEED_ONTOLOGY_DOCS.json`
- `curate_documents(desktop_path, archive_root, index_json) -> AdminDocIndexDto`
- Output Schema:
  - `docId`: string (e.g. `doc-adm-001`)
  - `title`: string
  - `docType`: `'POLICY_PLAN' | 'RESULT_REPORT' | 'ADMIN_AUDIT' | 'BUDGET_PLAN' | 'WEEKLY_REPORT'`
  - `year`: number (e.g. 2026)
  - `department`: string (e.g. `보건행정과`, `건강증진팀`)
  - `project`: string (e.g. `강남_AI_메디헬스_센터`, `양재천_건강_페스티벌`, `서울체력장_강남센터`)
  - `filePath`: string (original absolute path, read-only)
  - `budgetAmount`: number | null (in KRW, strictly matched)
  - `executionRate`: number | null (percentage 0-100)
  - `auditFindings`: string[] | null
  - `summary`: string (PIPA masked snippet)

### `src/lib/ontology/admin-traversal.ts` ↔ `src/app/api/admin-ontology/route.ts`
- `traceUpstream(nodeId: string, graph: AdminOntologyGraph): AdminCausalChain`
  - Traces an Audit or Budget item back to Outcome Report and originating Policy.
- `traceDownstream(nodeId: string, graph: AdminOntologyGraph): AdminCausalChain`
  - Traces a Policy through Outcome, Audit findings, and subsequent Year Budget allocations.
- `detectAuditGaps(graph: AdminOntologyGraph): AdminAuditGap[]`
  - Detects audit corrective actions not reflected in subsequent budget plans.

### `scripts/generate_weekly_hwpx.py` ↔ `src/app/api/weekly-report/route.ts`
- CLI Signature: `python scripts/generate_weekly_hwpx.py --input-json <path> --output-hwpx <path> --target-date YYYY-MM-DD`
- Request / Response:
  - Input: `WeeklyReportBatchDto` containing `period` (실적기간/계획기간), `department`, `author`, `categories` with `tasks`
  - Output: Binary HWPX buffer with uncompressed `mimetype` at offset 0, Bit 2 flags patched, valid OWPML table.

## Code Layout
- Archive curation & indexing: `scripts/curate_admin_archive.py`, `src/lib/curation/*`
- Data assets (SSOT): `data/ADMIN_DOC_INDEX.json`, `data/SEED_ONTOLOGY_DOCS.json`, `data/WEEKLY_REPORTS.json`
- Ontology models & traversal: `src/lib/ontology/admin-types.ts`, `src/lib/ontology/admin-traversal.ts`, `src/lib/ontology/toAdminGraph.ts`
- Weekly report automation: `scripts/generate_weekly_hwpx.py`, `src/lib/weekly/wednesday-batcher.ts`
- API routes: `src/app/api/admin-ontology/route.ts`, `src/app/api/weekly-report/route.ts`
- UI views & components: `src/components/ontology/AdminOntologyExplorer.tsx`, `src/components/ontology/AdminOntologyDrawer.tsx`, `src/components/weekly/WeeklyReportManager.tsx`
- Zod schemas: `src/lib/schemas.ts`
- Test suites: `__tests__/curation-indexer.test.ts`, `__tests__/admin-ontology.test.ts`, `__tests__/weekly-hwpx.test.ts`, `__tests__/e2e-workflow.test.ts`
- Governance: `PORTFOLIO VITAL - Engineering Report.md`, `AGENTS.md`, `scripts/sync-rules.js`
