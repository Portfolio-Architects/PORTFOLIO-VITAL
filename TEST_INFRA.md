# VITAL E2E Testing Infrastructure & Quality Assurance Specification (TEST_INFRA.md)

## 1. Test Philosophy & Principles

### 1.1 Opaque-Box & Requirement-Driven Architecture
- **Requirement-Driven**: All test cases and assertions are derived strictly from authoritative user requirements in `ORIGINAL_REQUEST.md` and `PROJECT.md § Feature Inventory`. Tests verify external contracts, observable input/output behaviors, data integrity, and mathematical invariants rather than internal private functions.
- **Authoritative Expected Output Derivation**:
  1. *Date Mathematics*: Wednesday deadline calculation $W$, current week performance $[W-2, W+4]$ (Mon~Sun), next week plan $[W+5, W+11]$ (Mon~Sun).
  2. *5-Type Administrative Classification*: Grounded in public administrative filing practices (`POLICY_PLAN`, `RESULT_REPORT`, `ADMIN_AUDIT`, `BUDGET_PLAN`, `WEEKLY_REPORT`).
  3. *Zero-Error Budget Forensic Rule (Rule R)*: $\text{Total Budget} \equiv \sum \text{Funding Sources} \equiv \sum \text{Itemized Costs}$, with Level 1 allocations strictly derived from individual thousand-ceilings: $\text{Level 1} \equiv \sum \lceil \text{Level 2}_k / 1,000 \rceil \times 1,000$. Error $\equiv 0\text{ KRW}$.
  4. *OWPML HWPX Invariants*: Strict ZIP format with uncompressed `mimetype` (`application/hwp+zip`) at offset 0, Bit-2 flag patching (value 4), OWPML Table 1 (`pageBreak="CELL"`, `repeatHeader="1"`, 2 columns `업무실적` vs `업무계획`), and 5-Pillar anti-overlap geometry.
  5. *7 Semantic Relations & Cybernetic Feedback*: Causal lifecycle linking Policy $\to$ Outcome $\to$ Audit $\to$ Next-Year BudgetPlan $\to$ Policy, verified via `traceUpstream`, `traceDownstream`, and `detectAuditGaps`.

### 1.2 Non-Destructive Working Surface Immunity (Rule O)
- Tests accessing `D:\Desktop` and `F:\_Organized_Archive` must operate in **100% read-only mode**.
- Temporary mock artifacts and generated output files are strictly confined to isolated temporary directories (`os.tmpdir()` or `scratch/test_output/`) and cleaned up in `afterAll` hooks.
- Zero mutation, moving, or deletion of user workspace files is mathematically guaranteed.

### 1.3 Self-Containment & Test Integrity
- Each test is isolated and independent: no reliance on execution order, side effects, or shared mutable variables.
- Anti-Facade Guarantee: Zero empty tests, zero mock assertions that bypass real logic, and zero suppressed failures. Tests exercise deterministic validation logic, JSON schema parsing, date calculations, graph traversal algorithms, and binary archive inspection.

---

## 2. Feature Inventory & Verification Checklist

### Tier 1: Core Feature Verification (Requirements R1, R2, R3)
- [x] **F1 (R2 Classifier)**: 5-type non-destructive classification heuristics for `POLICY_PLAN`, `RESULT_REPORT`, `ADMIN_AUDIT`, `BUDGET_PLAN`, `WEEKLY_REPORT`.
- [x] **F2 (R2 Metadata Extraction)**: Non-destructive extraction of budget figures, fiscal years, execution rates, audit findings, and project tags.
- [x] **F3 (R2 SSOT Schema Compliance)**: Canonical structure validation against `AdminDocIndexSchema` and `SeedOntologyDocsSchema`.
- [x] **F5 (R3 Lifecycle Entity Model)**: 4-phase administrative lifecycle entities (`Policy`, `Outcome`, `Audit`, `BudgetPlan`) + `WeeklyWork`.
- [x] **F6 (R3 7-Semantic Topology)**: Directed edges (`IMPLEMENTS`, `EVALUATES`, `CRITIQUES`, `MANDATES_IMPROVEMENT`, `FEEDBACK_LOOP`, `ALLOCATES_BUDGET`, `RECORDS_PROGRESS`).
- [x] **F7 (R3 Upstream/Downstream Traversal)**: `traceUpstream` and `traceDownstream` causal path discovery.
- [x] **F8 (R3 Audit Remediation Gap Detection)**: `detectAuditGaps` identifying unaddressed audit mandates.
- [x] **F9 (R3 Canvas 2D Adapter)**: Adapter projection into `OntologyNode[]` and `OntologyEdge[]` for 4-orbit visualization.
- [x] **F10 (R1 Wednesday Batch Calculation)**: Exact date cutoff engine for current-week performance $[W-2, W+4]$ and next-week plan $[W+5, W+11]$.
- [x] **F11 (R1 2-Column Comparative Table Layout)**: Table 0 (organization header) and Table 1 (2-column comparative layout `업무실적` vs `업무계획`).
- [x] **F12 (R1 HWPX Binary & OWPML Invariants)**: Offset 0 uncompressed `mimetype`, Bit-2 flag value 4, `pageBreak="CELL"`, and vertical lineseg alignment.

### Tier 2: Boundary & Corner Cases
- [x] **B1 (Wednesday Date Normalization)**: Edge cases for leap years (Feb 29), year-end boundaries (Dec 31 to Jan 1), and non-Wednesday date submissions.
- [x] **B2 (Empty & Missing Field Resilience)**: Graceful handling of null budget amounts, empty audit findings, zero execution rates, and missing optional tags.
- [x] **B3 (Budget Forensic Precision - Rule R)**: Total Project Cost = Funding Sources = Itemized Breakdown with 0 KRW delta; individual thousand-ceiling arithmetic validation.
- [x] **B4 (Corrupted / Malformed Payload Defense)**: Loud-Failure on schema violations, non-increasing lineseg vertpos, and inverted tag orders.
- [x] **B5 (Multi-Page Table Geometry)**: Tall cell content spanning $> 100,000$ HWPUnits with `pageBreak="CELL"`, verifying no vertical truncation or integer overflow.

### Tier 3: Cross-Feature Interactions
- [x] **X1 (Curation $\to$ Ontology Ingestion)**: Curated documents automatically ingested as typed lifecycle entities with valid semantic links.
- [x] **X2 (Audit Remediation $\to$ Next-Year Budget Plan)**: Audit entity findings linked via `MANDATES_IMPROVEMENT` to next-year `BudgetPlan`, resolving audit gap.
- [x] **X3 (Ontology Causal Chain $\to$ Weekly Task Progress)**: Weekly work items linked via `RECORDS_PROGRESS` to ongoing policy goals, aggregating into the Wednesday batch report.

---

## 3. Test Architecture & Runner Conventions

### 3.1 Test Execution Commands
- **Standard E2E Workflow Test Runner**:
  ```bash
  npm test -- __tests__/e2e-admin-workflow.test.ts
  ```
- **Verbose Output with Detailed Assertion Metrics**:
  ```bash
  npx jest __tests__/e2e-admin-workflow.test.ts --verbose --runInBand
  ```
- **All Admin & Ontology Test Suites**:
  ```bash
  npm test -- --testPathPattern="(e2e-admin-workflow|administrative-formatter|harness-schema-parity)"
  ```

### 3.2 Environment & Runner Specifications
| Component | Specification |
|:---|:---|
| **Test Runner** | Jest v30.3.0 (`next/jest.js` integration) |
| **Execution Environment** | `jest-environment-jsdom` with Node 20+ runtime |
| **Workers & Concurrency** | `--maxWorkers=2` (preventing filesystem contention) |
| **Default Timeout** | 15,000 ms per test suite |
| **Module Resolution** | `@/*` mapped to `<rootDir>/src/*` |

### 3.3 Pass/Fail Semantics
- **Zero Exit Code**: The test suite passes if and only if exit code is `0`.
- **Assertion Completeness**: All 4 Tiers must evaluate 100% of their test cases to green.
- **Loud-Failure Policy**: Any schema mismatch, budget discrepancy $> 0\text{ KRW}$, or HWPX geometry collision must immediately throw and fail the test.

---

## 4. Tier 4 Real-World Application Scenarios

| Scenario ID | Scenario Name | Real-World Administrative Context | Participating Modules | Expected Authoritative Outcome |
|:---|:---|:---|:---|:---|
| **RW-1** | **Gangnam Health Center Weekly Reporting Cycle** | Wednesday Nov 4, 2026 weekly submission for Health Promotion Team (`건강증진팀`), aggregating multi-project tasks across `서울체력장`, `신체활동 역량강화`, and `AI 메디헬스케어`. | `wednesday-batcher`, `WeeklyReportBatchDto`, `generate_weekly_hwpx`, `administrativeFormatter` | Valid 2-column comparative HWPX generated; Table 1 contains Performance (Nov 2~8) and Plan (Nov 9~15); ZIP flags patched with Bit-2 flag 4; all text formatted with administrative bullet hierarchy (`○`, `-`). |
| **RW-2** | **Administrative Audit Remediation & Budget Feedback Loop** | 2026 Admin Audit cites `강남 AI 메디헬스 센터` for insufficient equipment calibration. Gap detector flags missing remediation until 2027 Budget Plan allocates 1,742,152 thousand KRW for facility upgrades. | `admin-traversal`, `detectAuditGaps`, `traceUpstream`, `traceDownstream`, `BudgetPlanEntity` | `detectAuditGaps` detects gap when unlinked; upon adding `MANDATES_IMPROVEMENT` edge to 2027 BudgetPlan, gap count drops to 0; `traceUpstream` traces from 2027 Budget back to 2026 Policy; 3-way budget equality satisfies 0 error. |
| **RW-3** | **Non-Destructive Full Lifecycle Curation & PIPA Sanitization** | Comprehensive curation of mixed documents across desktop and archive, extracting metadata, sanitizing personal data, and preserving original filesystem timestamps. | `curate_admin_archive`, `AdminDocMetadataSchema`, `privacy_guard`, Rule O Checker | 5 document types classified accurately; PIPA masks personal phone numbers and names; original files in `D:\Desktop` have 0 mutations and unmodified timestamps; `data/ADMIN_DOC_INDEX.json` output validates against Zod schema. |

---

## 5. Coverage & Quality Thresholds

- **Scenario Pass Rate**: 100% (Zero tolerance for test failure).
- **Forensic Accounting Accuracy**: $100\%$ zero-error balance on public budget calculations ($\Delta = 0\text{ KRW}$).
- **Filesystem Integrity**: $0$ write operations directed at `D:\Desktop` or `F:\_Organized_Archive` during test runs.
- **Public Admin Standard Alignment**: $100\%$ adherence to Rule M, Rule P, Rule R, and `HWP_GENERATION_GUIDELINES.md` V3.
