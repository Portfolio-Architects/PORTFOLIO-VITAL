/**
 * VITAL Work & Wealth Architecture — Tier 5 Adversarial Coverage Hardening Suite
 * Tests Pipeline 2 (Bidirectional Ontology Traversal) & Pipeline 3 (Wednesday Batcher)
 * Standards: Rule G, Rule M, Rule P, Rule R, TEST_INFRA.md Tier 5
 */

import {
  traceUpstream,
  traceDownstream,
  detectAuditGaps,
  searchAdminNodes,
  calculateOntologyStats,
  findNodeById,
} from '@/lib/ontology/admin-traversal';
import {
  AdminOntologyGraph,
  AdminPolicyEntity,
  AdminOutcomeEntity,
  AdminAuditEntity,
  AdminBudgetPlanEntity,
  AdminWeeklyWorkEntity,
  AdminOntologyEdge,
} from '@/lib/ontology/admin-types';
import {
  computeWednesdayBatchPeriods,
  formatPeriodLabel,
  formatWeeklyBlockToLines,
  groupWeeklyItemsByProject,
  buildWeeklyColumnParagraphs,
  aggregateTasksForWednesday,
  WeeklyProjectBlock,
} from '@/lib/weekly/wednesday-batcher';
import { TaskDto, WeeklyWorkItemDto } from '@/lib/schemas';

describe('Tier 5 Adversarial Coverage Hardening Suite', () => {
  // ==========================================================================
  // PIPELINE 2: Bidirectional Ontology Traversal Stress Testing
  // ==========================================================================
  describe('Pipeline 2: Bidirectional Ontology Traversal (admin-traversal.ts)', () => {
    // ------------------------------------------------------------------------
    // 1. Dangling References & Missing Nodes
    // ------------------------------------------------------------------------
    test('Dangling References: traceUpstream terminates cleanly when node links to non-existent upstream IDs', () => {
      const graph: AdminOntologyGraph = {
        metadata: { totalProjects: 1, totalNodes: 2, totalEdges: 1, ruleCompliance: [] },
        policies: [],
        outcomes: [
          {
            id: 'OUT-2026-999',
            stage: 'OUTCOME_REPORT',
            docId: 'doc-999',
            projectId: 'p1',
            projectKey: 'proj1',
            policyId: 'POL-GHOST-404', // Dangling reference
            title: '고아 결과보고서',
            year: 2026,
            reportDate: '2026-10-01',
            executionRate: 90,
            spentBudget: 5000000,
            achievements: ['일부 달성'],
            sourceDocPath: 'D:\\mock\\path.hwpx',
          },
        ],
        audits: [
          {
            id: 'AUD-2026-999',
            stage: 'AUDIT_REVIEW',
            docId: 'doc-888',
            projectId: 'p1',
            projectKey: 'proj1',
            auditedOutcomeId: 'OUT-GHOST-404', // Dangling reference
            title: '고아 감사보고서',
            year: 2026,
            auditYear: 2026,
            severity: 'WARNING',
            critiqueTitle: '지적',
            auditFindings: ['지적사항'],
            correctiveMandates: ['시정명령'],
            actionStatus: 'IN_PROGRESS',
            sourceDocPath: 'D:\\mock\\audit.hwpx',
          },
        ],
        budgetPlans: [
          {
            id: 'BGT-2027-999',
            stage: 'BUDGET_PLAN',
            docId: 'doc-777',
            projectId: 'p1',
            projectKey: 'proj1',
            project: 'proj1',
            year: 2027,
            fiscalYear: 2027,
            title: '고아 사업설명서',
            totalBudget: 10000000,
            fundingSources: { fund: 0, city: 0, district: 10000000 },
            itemizedBreakdown: [{ item: '용품비', amount: 10000000 }],
            remediatedAuditIds: ['AUD-GHOST-404'], // Dangling reference
            sourceDocPath: 'D:\\mock\\budget.hwpx',
          },
        ],
        weeklyWorks: [
          {
            id: 'WRK-2026-999',
            stage: 'WEEKLY_WORK',
            docId: 'doc-666',
            projectId: 'p1',
            projectKey: 'proj1',
            title: '고아 주간업무',
            date: '2026-11-04',
            category: '신체활동',
            status: 'done',
            relatedPolicyId: 'POL-GHOST-404', // Dangling reference
          },
        ],
        edges: [
          {
            id: 'edge-ghost',
            source: 'GHOST_SOURCE_1',
            target: 'GHOST_TARGET_2',
            type: 'IMPLEMENTS',
            label: '유령 엣지',
          },
        ],
      };

      // Upstream from dangling outcome
      const resOut = traceUpstream('OUT-2026-999', graph);
      expect(resOut.path.length).toBe(1);
      expect(resOut.path[0].nodeId).toBe('OUT-2026-999');

      // Upstream from dangling audit
      const resAud = traceUpstream('AUD-2026-999', graph);
      expect(resAud.path.length).toBe(1);
      expect(resAud.path[0].nodeId).toBe('AUD-2026-999');

      // Upstream from dangling budget
      const resBgt = traceUpstream('BGT-2027-999', graph);
      expect(resBgt.path.length).toBe(1);
      expect(resBgt.path[0].nodeId).toBe('BGT-2027-999');

      // Upstream from dangling weekly
      const resWrk = traceUpstream('WRK-2026-999', graph);
      expect(resWrk.path.length).toBe(1);
      expect(resWrk.path[0].nodeId).toBe('WRK-2026-999');
    });

    test('Dangling References: traceDownstream terminates cleanly when target edges point to non-existent nodes', () => {
      const graph: AdminOntologyGraph = {
        metadata: { totalProjects: 1, totalNodes: 1, totalEdges: 1, ruleCompliance: [] },
        policies: [
          {
            id: 'POL-2026-001',
            stage: 'POLICY_DIRECTIVE',
            docId: 'doc-001',
            projectId: 'p1',
            projectKey: 'proj1',
            project: 'proj1',
            title: '단독 방침서',
            year: 2026,
            approvalDate: '2026-01-01',
            department: '보건소',
            budgetAmount: 1000,
            objectives: [],
            sourceDocPath: 'D:\\mock\\pol.hwpx',
          },
        ],
        outcomes: [],
        audits: [],
        budgetPlans: [],
        weeklyWorks: [],
        edges: [
          {
            id: 'edge-to-nowhere',
            source: 'POL-2026-001',
            target: 'NON_EXISTENT_OUTCOME',
            type: 'IMPLEMENTS',
            label: '허위 엣지',
          },
        ],
      };

      const res = traceDownstream('POL-2026-001', graph);
      expect(res.path.length).toBe(1);
      expect(res.path[0].nodeId).toBe('POL-2026-001');
      expect(res.edges).toEqual(['IMPLEMENTS']);
    });

    // ------------------------------------------------------------------------
    // 2. Self-Referential Cycles & Circular Feedback Loops
    // ------------------------------------------------------------------------
    test('Self-Referential Cycle: Node pointing to itself does not trigger infinite loop', () => {
      const selfLoopGraph: AdminOntologyGraph = {
        metadata: { totalProjects: 1, totalNodes: 2, totalEdges: 2, ruleCompliance: [] },
        policies: [
          {
            id: 'POL-SELF',
            stage: 'POLICY_DIRECTIVE',
            docId: 'doc-self',
            projectId: 'p1',
            projectKey: 'proj1',
            project: 'proj1',
            title: '자체 루프 방침',
            year: 2026,
            approvalDate: '2026-01-01',
            department: '보건소',
            budgetAmount: 1000,
            objectives: [],
            sourceDocPath: 'D:\\mock\\self.hwpx',
          },
        ],
        outcomes: [
          {
            id: 'OUT-SELF',
            stage: 'OUTCOME_REPORT',
            docId: 'doc-out',
            projectId: 'p1',
            projectKey: 'proj1',
            policyId: 'OUT-SELF', // Self-loop in property
            title: '자체 루프 결과',
            year: 2026,
            reportDate: '2026-10-01',
            executionRate: 100,
            spentBudget: 1000,
            achievements: ['자체 달성'],
            sourceDocPath: 'D:\\mock\\out.hwpx',
          },
        ],
        audits: [],
        budgetPlans: [],
        weeklyWorks: [],
        edges: [
          {
            id: 'edge-self-pol',
            source: 'POL-SELF',
            target: 'POL-SELF',
            type: 'IMPLEMENTS',
            label: '자체 루프',
          },
          {
            id: 'edge-self-out',
            source: 'OUT-SELF',
            target: 'OUT-SELF',
            type: 'IMPLEMENTS',
            label: '자체 루프 결과',
          },
        ],
      };

      const start = Date.now();
      const resUp = traceUpstream('OUT-SELF', selfLoopGraph);
      const resDown = traceDownstream('POL-SELF', selfLoopGraph);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // Must terminate instantly
      expect(resUp.path.length).toBeGreaterThanOrEqual(1);
      expect(resDown.path.length).toBeGreaterThanOrEqual(1);
    });

    test('Circular Graph: Multi-node circular dependency (A -> B -> C -> A) terminates gracefully', () => {
      // Construct circle: OUT-1 -> AUD-1 -> BGT-1 -> OUT-1
      const circularGraph: AdminOntologyGraph = {
        metadata: { totalProjects: 1, totalNodes: 3, totalEdges: 3, ruleCompliance: [] },
        policies: [],
        outcomes: [
          {
            id: 'OUT-CIRC-1',
            stage: 'OUTCOME_REPORT',
            docId: 'd1',
            projectId: 'p1',
            projectKey: 'proj1',
            policyId: 'POL-NONE',
            title: '순환 결과',
            year: 2026,
            reportDate: '2026-10-01',
            executionRate: 100,
            spentBudget: 1000,
            achievements: ['순환 실적'],
            sourceDocPath: 'D:\\mock\\1.hwpx',
          },
        ],
        audits: [
          {
            id: 'AUD-CIRC-1',
            stage: 'AUDIT_REVIEW',
            docId: 'd2',
            projectId: 'p1',
            projectKey: 'proj1',
            auditedOutcomeId: 'OUT-CIRC-1',
            title: '순환 감사',
            year: 2026,
            auditYear: 2026,
            severity: 'CRITICAL',
            critiqueTitle: '순환 지적',
            auditFindings: ['지적사항'],
            correctiveMandates: ['시정명령'],
            actionStatus: 'IN_PROGRESS',
            sourceDocPath: 'D:\\mock\\2.hwpx',
          },
        ],
        budgetPlans: [
          {
            id: 'BGT-CIRC-1',
            stage: 'BUDGET_PLAN',
            docId: 'd3',
            projectId: 'p1',
            projectKey: 'proj1',
            project: 'proj1',
            year: 2027,
            fiscalYear: 2027,
            title: '순환 예산',
            totalBudget: 1000,
            fundingSources: { fund: 0, city: 0, district: 1000 },
            itemizedBreakdown: [{ item: '용품비', amount: 1000 }],
            remediatedAuditIds: ['AUD-CIRC-1'],
            sourceDocPath: 'D:\\mock\\3.hwpx',
          },
        ],
        weeklyWorks: [],
        edges: [
          {
            id: 'e1',
            source: 'OUT-CIRC-1',
            target: 'AUD-CIRC-1',
            type: 'CRITIQUES',
            label: '감사지적',
          },
          {
            id: 'e2',
            source: 'AUD-CIRC-1',
            target: 'BGT-CIRC-1',
            type: 'MANDATES_IMPROVEMENT',
            label: '시정요구',
          },
          {
            id: 'e3',
            source: 'BGT-CIRC-1',
            target: 'OUT-CIRC-1',
            type: 'FEEDBACK_LOOP',
            label: '환류',
          },
        ],
      };

      const start = Date.now();
      const resUp = traceUpstream('BGT-CIRC-1', circularGraph);
      const resDown = traceDownstream('OUT-CIRC-1', circularGraph);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(resUp.path.length).toBeLessThanOrEqual(4);
      expect(resDown.path.length).toBeLessThanOrEqual(4);
    });

    // ------------------------------------------------------------------------
    // 3. Completely Disconnected Nodes & Large Isolated Sets
    // ------------------------------------------------------------------------
    test('Disconnected Nodes: Traversal on completely isolated node returns 1-element chain', () => {
      const emptyGraph: AdminOntologyGraph = {
        metadata: { totalProjects: 0, totalNodes: 0, totalEdges: 0, ruleCompliance: [] },
        policies: [
          {
            id: 'POL-ISOLATED',
            stage: 'POLICY_DIRECTIVE',
            docId: 'doc-iso',
            projectId: 'p0',
            projectKey: 'iso',
            project: 'iso',
            title: '고립 방침서',
            year: 2026,
            approvalDate: '2026-01-01',
            department: '보건소',
            budgetAmount: 500,
            objectives: [],
            sourceDocPath: 'D:\\mock\\iso.hwpx',
          },
        ],
        outcomes: [],
        audits: [],
        budgetPlans: [],
        weeklyWorks: [],
        edges: [],
      };

      const resUp = traceUpstream('POL-ISOLATED', emptyGraph);
      expect(resUp.path).toEqual([{ nodeId: 'POL-ISOLATED', nodeType: 'POLICY', title: '고립 방침서' }]);
      expect(resUp.edges).toEqual([]);

      const resDown = traceDownstream('POL-ISOLATED', emptyGraph);
      expect(resDown.path).toEqual([{ nodeId: 'POL-ISOLATED', nodeType: 'POLICY', title: '고립 방침서' }]);
      expect(resDown.edges).toEqual([]);
    });

    // ------------------------------------------------------------------------
    // 4. Multiple Branching Audit Gaps & Zero/Negative Budget Allocations
    // ------------------------------------------------------------------------
    test('Multiple Branching Audit Gaps: Detects HIGH vs MEDIUM gaps across multiple mandates and budget allocations', () => {
      const gapGraph: AdminOntologyGraph = {
        metadata: { totalProjects: 1, totalNodes: 4, totalEdges: 2, ruleCompliance: [] },
        policies: [],
        outcomes: [],
        audits: [
          // Audit 1: Unremediated (HIGH severity for each mandate)
          {
            id: 'AUD-UNREMEDIATED',
            stage: 'AUDIT_REVIEW',
            docId: 'd-unrem',
            projectId: 'p1',
            projectKey: 'proj1',
            auditedOutcomeId: 'OUT-NONE',
            title: '미반영 감사',
            year: 2026,
            auditYear: 2026,
            severity: 'HIGH',
            critiqueTitle: '미반영 지적',
            auditFindings: ['지적사항'],
            correctiveMandates: ['조치사항 1', '조치사항 2', '조치사항 3'],
            actionStatus: 'IN_PROGRESS',
            sourceDocPath: 'D:\\mock\\unrem.hwpx',
          },
          // Audit 2: Remediated but with 0 KRW allocation (MEDIUM severity)
          {
            id: 'AUD-ZERO-BUDGET',
            stage: 'AUDIT_REVIEW',
            docId: 'd-zero',
            projectId: 'p1',
            projectKey: 'proj1',
            auditedOutcomeId: 'OUT-NONE',
            title: '0원 편성 감사',
            year: 2026,
            auditYear: 2026,
            severity: 'MEDIUM',
            critiqueTitle: '0원 편성 지적',
            auditFindings: ['지적사항'],
            correctiveMandates: ['0원 조치사항'],
            actionStatus: 'IN_PROGRESS',
            sourceDocPath: 'D:\\mock\\zero.hwpx',
          },
          // Audit 3: Fully remediated with positive allocation (0 gaps)
          {
            id: 'AUD-RESOLVED',
            stage: 'AUDIT_REVIEW',
            docId: 'd-ok',
            projectId: 'p1',
            projectKey: 'proj1',
            auditedOutcomeId: 'OUT-NONE',
            title: '정상 반영 감사',
            year: 2026,
            auditYear: 2026,
            severity: 'WARNING',
            critiqueTitle: '해결 지적',
            auditFindings: ['지적사항'],
            correctiveMandates: ['정상 조치사항'],
            actionStatus: 'COMPLETED',
            sourceDocPath: 'D:\\mock\\ok.hwpx',
          },
          // Audit 4: Empty correctiveMandates and empty auditFindings fallback
          {
            id: 'AUD-FALLBACK',
            stage: 'AUDIT_REVIEW',
            docId: 'd-fb',
            projectId: 'p1',
            projectKey: 'proj1',
            auditedOutcomeId: 'OUT-NONE',
            title: '폴백 감사',
            year: 2026,
            auditYear: 2026,
            severity: 'HIGH',
            critiqueTitle: '빈 지적',
            correctiveMandates: [],
            auditFindings: [],
            actionStatus: 'IN_PROGRESS',
            sourceDocPath: 'D:\\mock\\fb.hwpx',
          },
        ],
        budgetPlans: [
          // Budget for Audit 2: 0 KRW allocation
          {
            id: 'BGT-ZERO',
            stage: 'BUDGET_PLAN',
            docId: 'd-bgt-zero',
            projectId: 'p1',
            projectKey: 'proj1',
            project: 'proj1',
            year: 2027,
            fiscalYear: 2027,
            title: '0원 예산계획',
            totalBudget: 0,
            fundingSources: { fund: 0, city: 0, district: 0 },
            itemizedBreakdown: [{ item: '실제 편성 없음', amount: 0 }],
            remediatedAuditIds: ['AUD-ZERO-BUDGET'],
            sourceDocPath: 'D:\\mock\\bgt_zero.hwpx',
          },
          // Budget for Audit 3: Positive allocation
          {
            id: 'BGT-RESOLVED',
            stage: 'BUDGET_PLAN',
            docId: 'd-bgt-ok',
            projectId: 'p1',
            projectKey: 'proj1',
            project: 'proj1',
            year: 2027,
            fiscalYear: 2027,
            title: '정상 예산계획',
            totalBudget: 5000000,
            fundingSources: { fund: 0, city: 0, district: 5000000 },
            itemizedBreakdown: [{ item: '개선사업비', amount: 5000000 }],
            remediatedAuditIds: ['AUD-RESOLVED'],
            sourceDocPath: 'D:\\mock\\bgt_ok.hwpx',
          },
        ],
        weeklyWorks: [],
        edges: [
          {
            id: 'e-zero',
            source: 'AUD-ZERO-BUDGET',
            target: 'BGT-ZERO',
            type: 'MANDATES_IMPROVEMENT',
            label: '0원 연결',
          },
          {
            id: 'e-ok',
            source: 'AUD-RESOLVED',
            target: 'BGT-RESOLVED',
            type: 'MANDATES_IMPROVEMENT',
            label: '정상 연결',
          },
        ],
      };

      const gaps = detectAuditGaps(gapGraph);

      // Audit 1 has 3 mandates -> 3 HIGH gaps
      const unremGaps = gaps.filter((g) => g.auditId === 'AUD-UNREMEDIATED');
      expect(unremGaps.length).toBe(3);
      expect(unremGaps.every((g) => g.severity === 'HIGH')).toBe(true);

      // Audit 2 has 1 mandate with 0 allocation -> 1 MEDIUM gap
      const zeroGaps = gaps.filter((g) => g.auditId === 'AUD-ZERO-BUDGET');
      expect(zeroGaps.length).toBe(1);
      expect(zeroGaps[0].severity).toBe('MEDIUM');
      expect(zeroGaps[0].budgetAllocation).toBe(0);

      // Audit 3 is resolved -> 0 gaps
      const okGaps = gaps.filter((g) => g.auditId === 'AUD-RESOLVED');
      expect(okGaps.length).toBe(0);

      // Audit 4 has fallback mandate -> 1 HIGH gap
      const fbGaps = gaps.filter((g) => g.auditId === 'AUD-FALLBACK');
      expect(fbGaps.length).toBe(1);
      expect(fbGaps[0].mandate).toBe('시정·개선 처분 요구사항 미기재');
      expect(fbGaps[0].severity).toBe('HIGH');
    });

    // ------------------------------------------------------------------------
    // 5. Search & Stats Boundary Cases
    // ------------------------------------------------------------------------
    test('Search & Stats: Empty query, special symbols, and empty graph stats', () => {
      const emptyGraph: AdminOntologyGraph = {
        metadata: { totalProjects: 0, totalNodes: 0, totalEdges: 0, ruleCompliance: [] },
        policies: [],
        outcomes: [],
        audits: [],
        budgetPlans: [],
        weeklyWorks: [],
        edges: [],
      };

      expect(searchAdminNodes(emptyGraph, '')).toEqual([]);
      expect(searchAdminNodes(emptyGraph, '   ')).toEqual([]);
      expect(searchAdminNodes(emptyGraph, '!@#$%^&*()')).toEqual([]);

      const stats = calculateOntologyStats(emptyGraph);
      expect(stats.totalNodes).toBe(0);
      expect(stats.totalEdges).toBe(0);
      expect(stats.totalGaps).toBe(0);
      expect(stats.totalBudgetKrw).toBe(0);

      expect(findNodeById(emptyGraph, 'NON_EXISTENT')).toBeNull();
    });
  });

  // ==========================================================================
  // PIPELINE 3: Wednesday Batcher & Date Geometry Stress Testing
  // ==========================================================================
  describe('Pipeline 3: Wednesday Batcher & Date Geometry (wednesday-batcher.ts)', () => {
    // ------------------------------------------------------------------------
    // 1. Year-End & Leap-Year Transitions
    // ------------------------------------------------------------------------
    test('Date Geometry: Year-End Transition across New Year boundary (2026-12-30 Wed)', () => {
      // Dec 30, 2026 is a Wednesday
      const periods = computeWednesdayBatchPeriods('2026-12-30');
      expect(periods.targetWednesday).toBe('2026-12-30');
      // Performance: Dec 28, 2026 (Mon) ~ Jan 03, 2027 (Sun)
      expect(periods.performanceStart).toBe('2026-12-28');
      expect(periods.performanceEnd).toBe('2027-01-03');
      // Plan: Jan 04, 2027 (Mon) ~ Jan 10, 2027 (Sun)
      expect(periods.planStart).toBe('2027-01-04');
      expect(periods.planEnd).toBe('2027-01-10');

      expect(periods.performanceLabel).toBe('12. 28.(월) ~ 01. 03.(일)');
      expect(periods.planLabel).toBe('01. 04.(월) ~ 01. 10.(일)');
    });

    test('Date Geometry: Leap-Year Transition (Feb 2024 leap day spanning)', () => {
      // Feb 28, 2024 is a Wednesday
      const periods = computeWednesdayBatchPeriods('2024-02-28');
      expect(periods.targetWednesday).toBe('2024-02-28');
      // Performance spans Feb 26 (Mon) to Mar 3 (Sun), including Feb 29 leap day!
      expect(periods.performanceStart).toBe('2024-02-26');
      expect(periods.performanceEnd).toBe('2024-03-03');
      // Plan spans Mar 4 (Mon) to Mar 10 (Sun)
      expect(periods.planStart).toBe('2024-03-04');
      expect(periods.planEnd).toBe('2024-03-10');

      expect(periods.performanceLabel).toBe('02. 26.(월) ~ 03. 03.(일)');
      expect(periods.planLabel).toBe('03. 04.(월) ~ 03. 10.(일)');
    });

    test('Date Geometry: Non-Wednesday Submissions properly align to nearest Wednesday', () => {
      // Monday 2026-11-02 -> shifts to Wednesday 2026-11-04
      const pMon = computeWednesdayBatchPeriods('2026-11-02');
      expect(pMon.targetWednesday).toBe('2026-11-04');

      // Friday 2026-11-06 -> day 5, diff = 3 - 5 = -2 -> Wednesday 2026-11-04
      const pFri = computeWednesdayBatchPeriods('2026-11-06');
      expect(pFri.targetWednesday).toBe('2026-11-04');

      // Sunday 2026-11-08 -> day 0, diff = 3 - 0 = +3 -> Wednesday 2026-11-11
      const pSun = computeWednesdayBatchPeriods('2026-11-08');
      expect(pSun.targetWednesday).toBe('2026-11-11');
    });

    test('Date Geometry: Malformed Date Inputs trigger Loud-Failure errors', () => {
      expect(() => computeWednesdayBatchPeriods(null as unknown as string)).toThrow(
        '[WEDNESDAY BATCH ERROR] Invalid date input: null or undefined'
      );
      expect(() => computeWednesdayBatchPeriods('')).toThrow(
        '[WEDNESDAY BATCH ERROR] Invalid date input: null or undefined'
      );
      expect(() => computeWednesdayBatchPeriods('NOT_A_VALID_DATE')).toThrow(
        '[WEDNESDAY BATCH ERROR] Invalid date input: NOT_A_VALID_DATE'
      );
    });

    // ------------------------------------------------------------------------
    // 2. Empty Weekly Report Arrays & Zero States
    // ------------------------------------------------------------------------
    test('Empty States: aggregateTasksForWednesday returns clean batch report on empty tasks array', () => {
      const { periods, weeklyReport } = aggregateTasksForWednesday([], '2026-11-04');
      expect(periods.targetWednesday).toBe('2026-11-04');
      expect(weeklyReport.items).toEqual([]);
      expect(weeklyReport.id).toBe('weekly-20261104');
    });

    test('Empty States: groupWeeklyItemsByProject and buildWeeklyColumnParagraphs with empty blocks', () => {
      const grouped = groupWeeklyItemsByProject([]);
      expect(grouped.performance).toEqual([]);
      expect(grouped.plan).toEqual([]);

      const col = buildWeeklyColumnParagraphs([], 'performance', '11. 02.(월) ~ 11. 08.(일)');
      expect(col.blocks).toEqual([]);
      expect(col.renderedParagraphs).toEqual([]);
    });

    // ------------------------------------------------------------------------
    // 3. Multi-Category Collisions & Ordering
    // ------------------------------------------------------------------------
    test('Multi-Category Collisions: Priority categorization and project ordering resolution', () => {
      const tasks: TaskDto[] = [
        {
          id: 'task-1',
          title: '서울체력장 및 공공PT 복합 사업 추진',
          description: '체력측정 장비 캘리브레이션',
          category: '서울체력장', // Matches order 8
          status: 'done',
          priority: 'high',
          dueDate: '2026-11-03', // Inside performance period
          tags: ['서울체력장'],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-03T00:00:00Z',
        },
        {
          id: 'task-2',
          title: '취약계층 공공PT 맞춤형 운동처방',
          description: '어르신 낙상예방',
          category: '취약계층 공공PT', // Matches order 9
          status: 'done',
          priority: 'medium',
          dueDate: '2026-11-04',
          tags: ['공공PT'],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-04T00:00:00Z',
        },
        {
          id: 'task-3',
          title: '비만예방 걷기대회 사전준비',
          description: '코스 안전요원 배치',
          category: '비만예방', // Matches order 10
          status: 'in-progress', // Plan status
          priority: 'high',
          dueDate: '2026-11-10', // Inside plan period (Nov 9~15)
          tags: ['비만예방'],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-05T00:00:00Z',
        },
        {
          id: 'task-4',
          title: '기타 신규 사업 기획',
          description: '미분류 카테고리',
          category: '신규자체사업', // Matches fallback order 12
          status: 'todo',
          priority: 'low',
          dueDate: '2026-11-12', // Inside plan period
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-05T00:00:00Z',
        },
      ];

      const { weeklyReport } = aggregateTasksForWednesday(tasks, '2026-11-04');
      const grouped = groupWeeklyItemsByProject(weeklyReport.items);

      // Performance should be sorted by projectOrder: order 8 before order 9
      expect(grouped.performance.length).toBe(2);
      expect(grouped.performance[0].projectOrder).toBe(8);
      expect(grouped.performance[0].projectName).toBe('서울체력장 강남센터');
      expect(grouped.performance[1].projectOrder).toBe(9);
      expect(grouped.performance[1].projectName).toBe('취약계층 공공 PT 프로그램');

      // Plan should be sorted by projectOrder: order 10 before order 12
      expect(grouped.plan.length).toBe(2);
      expect(grouped.plan[0].projectOrder).toBe(10);
      expect(grouped.plan[0].projectName).toBe('비만예방 및 걷기 챌린지');
      expect(grouped.plan[1].projectOrder).toBe(12);
      expect(grouped.plan[1].projectName).toBe('신규자체사업');
    });

    // ------------------------------------------------------------------------
    // 4. Formatting Typography & Bullet Hierarchy Verification
    // ------------------------------------------------------------------------
    test('Typography Invariants: formatWeeklyBlockToLines formats Korean public admin bullets (○, -)', () => {
      const block: WeeklyProjectBlock = {
        projectOrder: 8,
        projectName: '서울체력장 강남센터',
        period: '2026. 11. 2.(월) ~ 11. 8.(일)',
        target: '강남구민 500명',
        location: '보건소 별관 2층',
        contents: [
          '체력측정 및 운동처방 실시\n  - 근력 및 심폐지구력 평가\n  - 개인별 맞춤 상담',
          '장비 소독 및 안전점검',
        ],
        metrics: '실적 480명 달성',
        status: 'performance',
      };

      const lines = formatWeeklyBlockToLines(block);
      expect(lines[0]).toBe('8. 서울체력장 강남센터');
      expect(lines[1]).toContain('○ 기    간 :');
      expect(lines[2]).toContain('○ 대    상 :');
      expect(lines[3]).toContain('○ 장    소 :');
      expect(lines[4]).toBe(' ○ 내    용');
      expect(lines.some((l) => l.includes('- 근력 및 심폐지구력 평가'))).toBe(true);
      expect(lines.some((l) => l.includes('○ 실    적 : 실적 480명 달성'))).toBe(true);
    });

    // ------------------------------------------------------------------------
    // 5. Extreme Scale Stress Test (1,000 tasks)
    // ------------------------------------------------------------------------
    test('Scale Stress Test: Aggregating 1,000 tasks executes under 50ms with zero memory leaks', () => {
      const massiveTasks: TaskDto[] = [];
      const categories = ['서울체력장', '공공PT', '비만예방', '손목닥터', '기타사업'];

      for (let i = 1; i <= 1000; i++) {
        const isDone = i % 2 === 0;
        // Half in performance window (2026-11-03), half in plan window (2026-11-10)
        const dueDate = isDone ? '2026-11-03' : '2026-11-10';
        massiveTasks.push({
          id: `task-scale-${i}`,
          title: `대용량 업무 과제 #${i}`,
          description: `스트레스 테스트 상세 내용 #${i}`,
          category: categories[i % categories.length],
          status: isDone ? 'done' : 'in-progress',
          priority: 'medium',
          dueDate,
          tags: ['스트레스'],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-04T00:00:00Z',
        });
      }

      const t0 = Date.now();
      const { weeklyReport } = aggregateTasksForWednesday(massiveTasks, '2026-11-04');
      const duration = Date.now() - t0;

      expect(duration).toBeLessThan(100);
      expect(weeklyReport.items.length).toBeGreaterThan(0);

      const grouped = groupWeeklyItemsByProject(weeklyReport.items);
      const perfCol = buildWeeklyColumnParagraphs(grouped.performance, 'performance', weeklyReport.performancePeriod);
      const planCol = buildWeeklyColumnParagraphs(grouped.plan, 'plan', weeklyReport.planPeriod);

      expect(perfCol.renderedParagraphs.length).toBeGreaterThan(0);
      expect(planCol.renderedParagraphs.length).toBeGreaterThan(0);
    });
  });
});
