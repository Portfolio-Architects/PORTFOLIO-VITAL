// Mock next/server to bypass Next.js server-side loading issues in Jest
jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: jest.fn().mockImplementation((body: any, init?: any) => {
        return {
          status: init?.status || 200,
          json: async () => body,
        };
      }),
    },
  };
});

function createGetRequest(url: string): any {
  return { url };
}

import {
  AdminOntologyGraph,
  AdminPolicyEntity,
  AdminOutcomeEntity,
  AdminAuditEntity,
  AdminBudgetPlanEntity,
  AdminWeeklyWorkEntity,
  AdminOntologyEdge,
  SemanticEdgeType,
} from '@/lib/ontology/admin-types';
import {
  traceUpstream,
  traceDownstream,
  detectAuditGaps,
  searchAdminNodes,
  calculateOntologyStats,
  findNodeById,
} from '@/lib/ontology/admin-traversal';
import { toAdminGraph, mapSemanticEdge } from '@/lib/ontology/toAdminGraph';
import { loadAdminOntologyGraph, GET, POST, invalidateOntologyCache } from '@/app/api/admin-ontology/route';
import {
  buildCrossDomainRegistry,
  buildProjectBundle,
  resolveCanonicalProjectKey,
  maskPhoneNumber,
} from '@/lib/ontology/cross-domain-builder';
import {
  CANONICAL_PROJECT_KEYS,
  PROJECT_ALIASES_MAP,
  CanonicalProjectKey,
  CrossDomainProjectBundleSchema,
  CrossDomainRegistrySchema,
} from '@/lib/ontology/cross-domain-types';
import { resolveAndValidatePath } from '@/app/api/archive/open/route';

describe('Admin Ontology Data Models & Traversal Engine (Milestone 2)', () => {
  // Mock test graph fixtures representing real public health admin flow
  const mockPolicy: AdminPolicyEntity = {
    id: 'POL-2026-MEDIRUN',
    stage: 'POLICY_DIRECTIVE',
    title: '2026년 서울체력장 및 메디런 운영 기본계획',
    year: 2026,
    department: '보건행정과 건강증진팀',
    project: '04_서울체력장_AI메디헬스_메디런',
    budgetAmount: 1557000000,
    objectives: ['구민 맞춤형 체력인증 및 신체활동 활성화 인프라 구축'],
  };

  const mockOutcome: AdminOutcomeEntity = {
    id: 'OUT-2026-MEDIRUN',
    stage: 'OUTCOME_REPORT',
    policyId: 'POL-2026-MEDIRUN',
    title: '2026년 서울체력장 상반기 운영 결과보고',
    year: 2026,
    executionRate: 91.4,
    spentBudget: 1423000000,
    achievements: ['목표 인원 4,500명 대비 4,820명 달성 (달성률 107.1%)'],
  };

  const mockAudit: AdminAuditEntity = {
    id: 'AUD-2026-MEDIRUN-01',
    stage: 'AUDIT_REVIEW',
    title: '2026년도 행정사무감사 체력인증센터 운영 지적사항',
    year: 2026,
    auditedOutcomeId: 'OUT-2026-MEDIRUN',
    auditFindings: ['야외 체력프로그램 운영물품 안전관리 규정 보완 요구'],
    correctiveMandates: ['차년도 예산 사업설명서에 안전관리 및 훈련용품 분리 명기'],
    severity: 'WARNING',
  };

  const mockBudgetPlan: AdminBudgetPlanEntity = {
    id: 'BGT-2027-MEDIRUN',
    stage: 'BUDGET_PLAN',
    title: '2027년도 AI 메디헬스 및 체력인증센터 운영 본예산 사업설명서',
    year: 2027,
    project: '04_서울체력장_AI메디헬스_메디런',
    totalBudget: 1742152000,
    fundingSources: {
      fund: 0,
      city: 0,
      district: 1742152000,
    },
    itemizedBreakdown: [
      { item: '안전관리 및 훈련용품비', amount: 2663000 },
      { item: '프로그램 운영비', amount: 1739489000 },
    ],
    remediatedAuditIds: ['AUD-2026-MEDIRUN-01'],
  };

  const mockWeeklyWork: AdminWeeklyWorkEntity = {
    id: 'WRK-2026-W43-01',
    stage: 'WEEKLY_WORK',
    title: '10월 4주 서울체력장 메디런 운영 주간업무 실적 및 계획',
    date: '2026-10-21',
    category: '04_서울체력장_AI메디헬스_메디런',
    status: 'done',
    relatedPolicyId: 'POL-2026-MEDIRUN',
  };

  const mockEdges: AdminOntologyEdge[] = [
    {
      id: 'e1',
      source: 'POL-2026-MEDIRUN',
      target: 'OUT-2026-MEDIRUN',
      type: 'IMPLEMENTS',
    },
    {
      id: 'e2',
      source: 'OUT-2026-MEDIRUN',
      target: 'AUD-2026-MEDIRUN-01',
      type: 'CRITIQUES',
    },
    {
      id: 'e3',
      source: 'AUD-2026-MEDIRUN-01',
      target: 'BGT-2027-MEDIRUN',
      type: 'MANDATES_IMPROVEMENT',
    },
    {
      id: 'e4',
      source: 'BGT-2027-MEDIRUN',
      target: 'OUT-2026-MEDIRUN',
      type: 'FEEDBACK_LOOP',
    },
    {
      id: 'e5',
      source: 'BGT-2027-MEDIRUN',
      target: 'POL-2026-MEDIRUN',
      type: 'ALLOCATES_BUDGET',
    },
    {
      id: 'e6',
      source: 'WRK-2026-W43-01',
      target: 'POL-2026-MEDIRUN',
      type: 'RECORDS_PROGRESS',
    },
  ];

  const mockGraph: AdminOntologyGraph = {
    policies: [mockPolicy],
    outcomes: [mockOutcome],
    audits: [mockAudit],
    budgetPlans: [mockBudgetPlan],
    weeklyWorks: [mockWeeklyWork],
    edges: mockEdges,
  };

  describe('1. Upstream Traversal (traceUpstream)', () => {
    test('traces backward from BudgetPlan through Audit and Outcome to originating Policy', () => {
      const result = traceUpstream('BGT-2027-MEDIRUN', mockGraph);

      expect(result.originId).toBe('BGT-2027-MEDIRUN');
      expect(result.path).toHaveLength(4);

      expect(result.path[0]).toEqual({
        nodeId: 'BGT-2027-MEDIRUN',
        nodeType: 'BUDGET_PLAN',
        title: mockBudgetPlan.title,
      });
      expect(result.path[1]).toEqual({
        nodeId: 'AUD-2026-MEDIRUN-01',
        nodeType: 'AUDIT',
        title: mockAudit.title,
      });
      expect(result.path[2]).toEqual({
        nodeId: 'OUT-2026-MEDIRUN',
        nodeType: 'OUTCOME',
        title: mockOutcome.title,
      });
      expect(result.path[3]).toEqual({
        nodeId: 'POL-2026-MEDIRUN',
        nodeType: 'POLICY',
        title: mockPolicy.title,
      });

      expect(result.edges).toEqual(['MANDATES_IMPROVEMENT', 'CRITIQUES', 'IMPLEMENTS']);
    });

    test('traces backward starting from Audit to Policy', () => {
      const result = traceUpstream('AUD-2026-MEDIRUN-01', mockGraph);

      expect(result.path).toHaveLength(3);
      expect(result.path[0].nodeId).toBe('AUD-2026-MEDIRUN-01');
      expect(result.path[1].nodeId).toBe('OUT-2026-MEDIRUN');
      expect(result.path[2].nodeId).toBe('POL-2026-MEDIRUN');
    });

    test('traces backward starting from WeeklyWork to Policy', () => {
      const result = traceUpstream('WRK-2026-W43-01', mockGraph);

      expect(result.path).toHaveLength(2);
      expect(result.path[0].nodeId).toBe('WRK-2026-W43-01');
      expect(result.path[1].nodeId).toBe('POL-2026-MEDIRUN');
      expect(result.edges).toContain('RECORDS_PROGRESS');
    });

    test('stops gracefully at isolated or root node without error', () => {
      const result = traceUpstream('POL-2026-MEDIRUN', mockGraph);
      expect(result.path).toHaveLength(1);
      expect(result.path[0].nodeId).toBe('POL-2026-MEDIRUN');
      expect(result.edges).toHaveLength(0);
    });

    test('returns empty path for non-existent node ID', () => {
      const result = traceUpstream('NON-EXISTENT', mockGraph);
      expect(result.path).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('2. Downstream Traversal (traceDownstream)', () => {
    test('traces forward from Policy through Outcome and Audit to BudgetPlan', () => {
      const result = traceDownstream('POL-2026-MEDIRUN', mockGraph);

      expect(result.originId).toBe('POL-2026-MEDIRUN');
      expect(result.path).toHaveLength(4);

      expect(result.path[0]).toEqual({
        nodeId: 'POL-2026-MEDIRUN',
        nodeType: 'POLICY',
        title: mockPolicy.title,
      });
      expect(result.path[1]).toEqual({
        nodeId: 'OUT-2026-MEDIRUN',
        nodeType: 'OUTCOME',
        title: mockOutcome.title,
      });
      expect(result.path[2]).toEqual({
        nodeId: 'AUD-2026-MEDIRUN-01',
        nodeType: 'AUDIT',
        title: mockAudit.title,
      });
      expect(result.path[3]).toEqual({
        nodeId: 'BGT-2027-MEDIRUN',
        nodeType: 'BUDGET_PLAN',
        title: mockBudgetPlan.title,
      });

      expect(result.edges).toEqual(['IMPLEMENTS', 'CRITIQUES', 'MANDATES_IMPROVEMENT']);
    });

    test('stops gracefully at leaf BudgetPlan node', () => {
      const result = traceDownstream('BGT-2027-MEDIRUN', mockGraph);
      expect(result.path).toHaveLength(1);
      expect(result.path[0].nodeId).toBe('BGT-2027-MEDIRUN');
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('3. Audit Gap Detection (detectAuditGaps)', () => {
    test('returns zero gaps when all audits are remediated with budget allocation', () => {
      const gaps = detectAuditGaps(mockGraph);
      expect(gaps).toHaveLength(0);
    });

    test('detects HIGH severity gap when an audit has no remediating budget plan', () => {
      const unaddressedAudit: AdminAuditEntity = {
        id: 'AUD-2026-UNRESOLVED',
        title: '신체활동 행사 안전펜스 설치 미비 지적',
        year: 2026,
        auditedOutcomeId: 'OUT-2026-MEDIRUN',
        auditFindings: ['행사장 안전펜스 기준 미달'],
        correctiveMandates: ['차년도 안전펜스 임차료 예산 신규 반영'],
      };

      const testGraph: AdminOntologyGraph = {
        ...mockGraph,
        audits: [...mockGraph.audits, unaddressedAudit],
      };

      const gaps = detectAuditGaps(testGraph);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].auditId).toBe('AUD-2026-UNRESOLVED');
      expect(gaps[0].mandate).toBe('차년도 안전펜스 임차료 예산 신규 반영');
      expect(gaps[0].severity).toBe('HIGH');
      expect(gaps[0].remediated).toBe(false);
    });

    test('detects MEDIUM severity gap when an audit is remediated but with 0 KRW budget allocation', () => {
      const zeroBudgetPlan: AdminBudgetPlanEntity = {
        id: 'BGT-2027-ZERO',
        title: '2027년도 예산설명서 (0원 배정)',
        year: 2027,
        project: '04_서울체력장_AI메디헬스_메디런',
        totalBudget: 0,
        fundingSources: { fund: 0, city: 0, district: 0 },
        itemizedBreakdown: [{ item: '안전용품', amount: 0 }],
        remediatedAuditIds: ['AUD-2026-MEDIRUN-01'],
      };

      const testGraph: AdminOntologyGraph = {
        ...mockGraph,
        budgetPlans: [zeroBudgetPlan],
      };

      const gaps = detectAuditGaps(testGraph);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].auditId).toBe('AUD-2026-MEDIRUN-01');
      expect(gaps[0].severity).toBe('MEDIUM');
      expect(gaps[0].budgetAllocation).toBe(0);
    });
  });

  describe('4. Canvas Graph Adapter (toAdminGraph)', () => {
    test('converts AdminOntologyGraph into OntologyNode[] and OntologyEdge[] with correct orbits', () => {
      const canvasGraph = toAdminGraph(mockGraph);

      expect(canvasGraph.nodes).toHaveLength(5);
      expect(canvasGraph.edges).toHaveLength(6);

      // Verify orbit assignments
      const polNode = canvasGraph.nodes.find((n) => n.id === 'POL-2026-MEDIRUN');
      const outNode = canvasGraph.nodes.find((n) => n.id === 'OUT-2026-MEDIRUN');
      const audNode = canvasGraph.nodes.find((n) => n.id === 'AUD-2026-MEDIRUN-01');
      const bgtNode = canvasGraph.nodes.find((n) => n.id === 'BGT-2027-MEDIRUN');
      const wrkNode = canvasGraph.nodes.find((n) => n.id === 'WRK-2026-W43-01');

      expect(polNode?.customOrbitIndex).toBe(1);
      expect(outNode?.customOrbitIndex).toBe(2);
      expect(audNode?.customOrbitIndex).toBe(3);
      expect(bgtNode?.customOrbitIndex).toBe(4);
      expect(wrkNode?.customOrbitIndex).toBe(2);

      // Verify groups and layer IDs
      expect(polNode?.group).toBe('CORE_PROJECT');
      expect(outNode?.group).toBe('MACRO_RESEARCH');
      expect(audNode?.group).toBe('SYSTEM_RISK');
      expect(bgtNode?.group).toBe('DCF_MODELING');
    });

    test('maps semantic edges to canvas edge types and weights', () => {
      expect(mapSemanticEdge('IMPLEMENTS')).toEqual({ type: 'CAUSAL_DRIVE', weight: 1.0 });
      expect(mapSemanticEdge('EVALUATES')).toEqual({ type: 'DEPENDENCY', weight: 0.9 });
      expect(mapSemanticEdge('CRITIQUES')).toEqual({ type: 'BOTTLENECK', weight: -0.6 });
      expect(mapSemanticEdge('MANDATES_IMPROVEMENT')).toEqual({ type: 'DECOUPLING', weight: 0.95 });
      expect(mapSemanticEdge('FEEDBACK_LOOP')).toEqual({ type: 'FEEDBACK_LOOP', weight: 0.8 });
      expect(mapSemanticEdge('ALLOCATES_BUDGET')).toEqual({ type: 'BUDGET_SOURCE', weight: 1.0 });
      expect(mapSemanticEdge('RECORDS_PROGRESS')).toEqual({ type: 'COMPONENTS', weight: 0.7 });
    });

    test('filters out orphan edges whose nodes are missing', () => {
      const graphWithOrphan: AdminOntologyGraph = {
        ...mockGraph,
        edges: [
          ...mockGraph.edges,
          {
            id: 'orphan-edge',
            source: 'MISSING-SRC',
            target: 'MISSING-TGT',
            type: 'IMPLEMENTS',
          },
        ],
      };

      const canvasGraph = toAdminGraph(graphWithOrphan);
      expect(canvasGraph.edges.find((e) => e.source === 'MISSING-SRC')).toBeUndefined();
    });

    test('synthesizes Orbit 0 center node when synthesizeProjectCenter is enabled', () => {
      const canvasGraph = toAdminGraph(mockGraph, {
        filterProject: '04_서울체력장_AI메디헬스_메디런',
        synthesizeProjectCenter: true,
      });

      const center = canvasGraph.nodes.find((n) => n.customOrbitIndex === 0);
      expect(center).toBeDefined();
      expect(center?.id).toBe('CENTER-04_서울체력장_AI메디헬스_메디런');
    });
  });

  describe('5. Node Search & Statistics', () => {
    test('searchAdminNodes finds nodes matching title or id keywords', () => {
      const results = searchAdminNodes(mockGraph, '메디런');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.node.id === 'POL-2026-MEDIRUN')).toBe(true);
    });

    test('searchAdminNodes returns empty array on empty query', () => {
      expect(searchAdminNodes(mockGraph, '')).toEqual([]);
    });

    test('calculateOntologyStats computes accurate aggregation totals', () => {
      const stats = calculateOntologyStats(mockGraph);
      expect(stats.totalNodes).toBe(5);
      expect(stats.totalPolicies).toBe(1);
      expect(stats.totalOutcomes).toBe(1);
      expect(stats.totalAudits).toBe(1);
      expect(stats.totalBudgetPlans).toBe(1);
      expect(stats.totalWeeklyWorks).toBe(1);
      expect(stats.totalEdges).toBe(6);
      expect(stats.totalGaps).toBe(0);
      expect(stats.totalBudgetKrw).toBe(1742152000);
    });

    test('findNodeById locates nodes across all 5 collections', () => {
      expect(findNodeById(mockGraph, 'POL-2026-MEDIRUN')).toBeDefined();
      expect(findNodeById(mockGraph, 'OUT-2026-MEDIRUN')).toBeDefined();
      expect(findNodeById(mockGraph, 'AUD-2026-MEDIRUN-01')).toBeDefined();
      expect(findNodeById(mockGraph, 'BGT-2027-MEDIRUN')).toBeDefined();
      expect(findNodeById(mockGraph, 'WRK-2026-W43-01')).toBeDefined();
      expect(findNodeById(mockGraph, 'UNKNOWN')).toBeNull();
    });
  });

  describe('6. Real SEED_ONTOLOGY_DOCS.json & REST API Endpoints', () => {
    test('loadAdminOntologyGraph successfully loads seed dataset from disk', () => {
      const seedGraph = loadAdminOntologyGraph();

      expect(seedGraph.policies.length).toBeGreaterThan(0);
      expect(seedGraph.outcomes.length).toBeGreaterThan(0);
      expect(seedGraph.audits.length).toBeGreaterThan(0);
      expect(seedGraph.budgetPlans.length).toBeGreaterThan(0);
      expect(seedGraph.edges.length).toBeGreaterThan(0);
    });

    test('GET /api/admin-ontology?action=graph returns graph and statistics', async () => {
      const req = createGetRequest('http://localhost:3001/api/admin-ontology?action=graph');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.graph).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(data.stats.totalNodes).toBeGreaterThan(0);
    });

    test('GET /api/admin-ontology?action=trace returns upstream and downstream results', async () => {
      const seedGraph = loadAdminOntologyGraph();
      const sampleAudit = seedGraph.audits[0];

      if (sampleAudit) {
        const reqUp = createGetRequest(
          `http://localhost:3001/api/admin-ontology?action=trace&direction=upstream&nodeId=${sampleAudit.id}`
        );
        const resUp = await GET(reqUp);
        const dataUp = await resUp.json();

        expect(resUp.status).toBe(200);
        expect(dataUp.success).toBe(true);
        expect(dataUp.trace.originId).toBe(sampleAudit.id);
      }

      const samplePolicy = seedGraph.policies[0];
      if (samplePolicy) {
        const reqDown = createGetRequest(
          `http://localhost:3001/api/admin-ontology?action=trace&direction=downstream&nodeId=${samplePolicy.id}`
        );
        const resDown = await GET(reqDown);
        const dataDown = await resDown.json();

        expect(resDown.status).toBe(200);
        expect(dataDown.success).toBe(true);
        expect(dataDown.trace.originId).toBe(samplePolicy.id);
      }
    });

    test('GET /api/admin-ontology?action=gaps returns audit gaps', async () => {
      const req = createGetRequest('http://localhost:3001/api/admin-ontology?action=gaps');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.gaps)).toBe(true);
    });

    test('GET /api/admin-ontology?action=search returns matching nodes', async () => {
      const req = createGetRequest('http://localhost:3001/api/admin-ontology?action=search&q=보건');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.results)).toBe(true);
    });

    test('GET /api/admin-ontology returns 400 on missing or invalid parameters', async () => {
      const reqNoId = createGetRequest('http://localhost:3001/api/admin-ontology?action=trace');
      const resNoId = await GET(reqNoId);
      expect(resNoId.status).toBe(400);

      const reqInvalidAction = createGetRequest('http://localhost:3001/api/admin-ontology?action=unknown_action');
      const resInvalidAction = await GET(reqInvalidAction);
      expect(resInvalidAction.status).toBe(400);
    });
  });

  describe('7. 6-Domain Cross-Join Aggregator & Builder (Milestone 1)', () => {
    test('resolveCanonicalProjectKey accurately resolves keys, IDs, and aliases', () => {
      expect(resolveCanonicalProjectKey('01_양재천_페스티벌')).toBe('01_양재천_페스티벌');
      expect(resolveCanonicalProjectKey('hchps-p1')).toBe('01_양재천_페스티벌');
      expect(resolveCanonicalProjectKey('양재천')).toBe('01_양재천_페스티벌');
      expect(resolveCanonicalProjectKey('양재천 건강 페스티벌')).toBe('01_양재천_페스티벌');
      expect(resolveCanonicalProjectKey('공공PT')).toBe('02_사회적_처방_신체활동');
      expect(resolveCanonicalProjectKey('사회적 처방')).toBe('02_사회적_처방_신체활동');
      expect(resolveCanonicalProjectKey('체력인증센터')).toBe('04_서울체력장_AI메디헬스_메디런');
      expect(resolveCanonicalProjectKey('AI메디헬스')).toBe('04_서울체력장_AI메디헬스_메디런');
      expect(resolveCanonicalProjectKey('어린이_아이뛰움')).toBe('05_어린이_아이뛰움');
      expect(resolveCanonicalProjectKey('비만예방')).toBe('06_비만예방_합동캠페인');
      expect(resolveCanonicalProjectKey('손목닥터9988')).toBe('07_손목닥터9988_스마트헬스');
      expect(resolveCanonicalProjectKey('청사관리')).toBe('08_보건소_기능유지_청사관리');
      expect(resolveCanonicalProjectKey('신체활동')).toBe('신체활동_건강생활실천');
      expect(resolveCanonicalProjectKey('unknown_nonexistent_xyz')).toBeNull();
      expect(resolveCanonicalProjectKey('')).toBeNull();
      expect(resolveCanonicalProjectKey(null)).toBeNull();
    });

    test('canonical project IDs map 1:1 to canonical projects without collision', () => {
      const expectedIdMap: Record<string, CanonicalProjectKey> = {
        'hchps-p0': '신체활동_건강생활실천',
        'hchps-p1': '01_양재천_페스티벌',
        'hchps-p2': '02_사회적_처방_신체활동',
        'hchps-p3': '03_헬스체크업_바른자세',
        'hchps-p4': '05_어린이_아이뛰움',
        'hchps-p5': '06_비만예방_합동캠페인',
        'hchps-p6': '07_손목닥터9988_스마트헬스',
        'hchps-p7': '04_서울체력장_AI메디헬스_메디런',
        'hchps-p8': '08_보건소_기능유지_청사관리',
      };

      for (const [id, expectedKey] of Object.entries(expectedIdMap)) {
        // Lowercase, uppercase, whitespace-padded
        expect(resolveCanonicalProjectKey(id)).toBe(expectedKey);
        expect(resolveCanonicalProjectKey(id.toUpperCase())).toBe(expectedKey);
        expect(resolveCanonicalProjectKey(`  ${id}  \n`)).toBe(expectedKey);
      }
    });

    test('all aliases across all 9 canonical projects resolve unambiguously', () => {
      for (const [canonicalKey, aliases] of Object.entries(PROJECT_ALIASES_MAP)) {
        for (const alias of aliases) {
          const resolved = resolveCanonicalProjectKey(alias);
          expect(resolved).toBe(canonicalKey);
        }
      }
    });

    test('no duplicate or cross-project alias collision exists in PROJECT_ALIASES_MAP', () => {
      const aliasOwners = new Map<string, string[]>();
      for (const [key, aliases] of Object.entries(PROJECT_ALIASES_MAP)) {
        for (const alias of aliases) {
          const lower = alias.trim().toLowerCase();
          if (!aliasOwners.has(lower)) {
            aliasOwners.set(lower, []);
          }
          aliasOwners.get(lower)!.push(key);
        }
      }

      for (const [alias, owners] of aliasOwners.entries()) {
        expect(owners).toHaveLength(1);
      }
    });

    test('ambiguous short prefixes or multi-match queries resolve to null safely', () => {
      expect(resolveCanonicalProjectKey('hchps')).toBeNull();
      expect(resolveCanonicalProjectKey('hchps-')).toBeNull();
      expect(resolveCanonicalProjectKey('hchps-p')).toBeNull();
      expect(resolveCanonicalProjectKey('건강')).toBeNull();
      expect(resolveCanonicalProjectKey('신체')).toBeNull();
      expect(resolveCanonicalProjectKey('스마트')).toBeNull();
    });

    test('maskPhoneNumber correctly sanitizes phone numbers under Rule Q', () => {
      expect(maskPhoneNumber('010-1234-5678')).toBe('010-****-5678');
      expect(maskPhoneNumber('02-123-4567')).toBe('02-***-4567');
      expect(maskPhoneNumber('031-1234-5678')).toBe('031-****-5678');
      expect(maskPhoneNumber('')).toBe('');
      expect(maskPhoneNumber(undefined)).toBe('');
    });

    test('buildCrossDomainRegistry builds all 9 canonical projects with valid schema', async () => {
      const registry = await buildCrossDomainRegistry();

      expect(Object.keys(registry)).toHaveLength(9);
      for (const key of CANONICAL_PROJECT_KEYS) {
        expect(registry[key]).toBeDefined();
        expect(registry[key].projectKey).toBe(key);

        // Zod validation on every bundle
        const parsed = CrossDomainProjectBundleSchema.safeParse(registry[key]);
        expect(parsed.success).toBe(true);

        // Rule R check: spentBudget calculation & non-negative
        const budget = registry[key].budget;
        expect(budget.spentBudget).toBeGreaterThanOrEqual(0);
        expect(budget.remainingBudget).toBeGreaterThanOrEqual(0);
        expect(budget.dailyExpenseRemaining).toBeGreaterThanOrEqual(0);

        // Rule Q check: all contact phone numbers must be masked
        for (const contact of registry[key].festivalAndContacts.assignedContacts) {
          if (contact.phone) {
            expect(contact.phone).toMatch(/\*{3,4}/);
          }
        }
      }

      // Check festival project specific details
      const festivalBundle = registry['01_양재천_페스티벌'];
      expect(festivalBundle.festivalAndContacts.isFestivalProject).toBe(true);
      expect(festivalBundle.festivalAndContacts.festivalSummary).toBeDefined();
      expect(festivalBundle.festivalAndContacts.festivalSummary?.boothsCount).toBe(20);
      expect(festivalBundle.festivalAndContacts.festivalSummary?.dutiesCount).toBe(41);
    });

    test('buildProjectBundle retrieves single project bundle by key or alias', async () => {
      const bundle = await buildProjectBundle('양재천');
      expect(bundle).toBeDefined();
      expect(bundle?.projectKey).toBe('01_양재천_페스티벌');

      const nullBundle = await buildProjectBundle('nonexistent_project_xyz');
      expect(nullBundle).toBeNull();
    });
  });

  describe('8. Cross-Join & Reindex REST API Endpoints & Archive Path Resolver (Milestone 1)', () => {
    test('GET /api/admin-ontology?action=cross-join returns full 9-project registry', async () => {
      const req = createGetRequest('http://localhost:3001/api/admin-ontology?action=cross-join');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.totalProjects).toBe(9);
      expect(data.data).toBeDefined();
      expect(Object.keys(data.data)).toHaveLength(9);
    });

    test('GET /api/admin-ontology?action=cross-join&projectKey=... returns single project bundle', async () => {
      const req = createGetRequest(
        'http://localhost:3001/api/admin-ontology?action=cross-join&projectKey=01_양재천_페스티벌'
      );
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.projectKey).toBe('01_양재천_페스티벌');
      expect(data.data.projectKey).toBe('01_양재천_페스티벌');
      expect(data.data.ontology).toBeDefined();
      expect(data.data.budget).toBeDefined();
    });

    test('GET /api/admin-ontology?action=cross-join with invalid projectKey returns 404', async () => {
      const req = createGetRequest(
        'http://localhost:3001/api/admin-ontology?action=cross-join&projectKey=nonexistent_xyz'
      );
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.success).toBe(false);
    });

    test('POST /api/admin-ontology rejects missing or invalid action with 400', async () => {
      const req = { json: async () => ({ action: 'invalid_action' }) };
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test('POST /api/admin-ontology with action=reindex executes curate script non-destructively', async () => {
      const req = { json: async () => ({ action: 'reindex' }) };
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.reindexed).toBe(true);
      expect(data.durationMs).toBeGreaterThan(0);
      expect(data.stats).toBeDefined();
      expect(data.graph).toBeDefined();
      expect(data.crossJoin).toBeDefined();
      expect(Object.keys(data.crossJoin)).toHaveLength(9);
    }, 30000);

    test('resolveAndValidatePath in archive open route validates Desktop and Archive whitelist', () => {
      // Desktop absolute paths
      expect(resolveAndValidatePath('D:\\Desktop\\test.hwpx').ok).toBe(true);
      expect(resolveAndValidatePath('d:\\desktop\\subfolder\\document.xlsx').ok).toBe(true);
      expect(resolveAndValidatePath('D:\\Desktop\\공공문서 폴더\\2026년\\report.hwpx').ok).toBe(true);
      expect(resolveAndValidatePath('D:\\Desktop').ok).toBe(true);
      expect(resolveAndValidatePath('D:\\Desktop\\').ok).toBe(true);

      // Master Archive paths
      expect(resolveAndValidatePath('F:\\_Organized_Archive\\2026년\\plan.hwpx').ok).toBe(true);
      expect(resolveAndValidatePath('2026년\\plan.hwpx').ok).toBe(true);
      expect(resolveAndValidatePath('F:\\_Organized_Archive').ok).toBe(true);
      expect(resolveAndValidatePath('F:\\_Organized_Archive\\').ok).toBe(true);

      // Legitimate URL-encoded filenames
      expect(resolveAndValidatePath('D:\\Desktop\\test%20file.hwpx').ok).toBe(true);
      expect(resolveAndValidatePath('D:\\Desktop\\%ED%95%9C%EA%B8%80%EB%AC%B8%EC%84%9C.hwpx').ok).toBe(true);

      // Traversal attacks and unauthorized paths
      expect(resolveAndValidatePath('D:\\Desktop\\..\\Windows\\notepad.exe').ok).toBe(false);
      expect(resolveAndValidatePath('F:\\_Organized_Archive\\..\\Windows\\cmd.exe').ok).toBe(false);
      expect(resolveAndValidatePath('C:\\Windows\\System32\\cmd.exe').ok).toBe(false);
      expect(resolveAndValidatePath('').ok).toBe(false);
      expect(resolveAndValidatePath(null as any).ok).toBe(false);
    });

    test('resolveAndValidatePath strictly blocks URL-encoded traversal and null bytes', () => {
      // Single-encoded traversal vectors
      expect(resolveAndValidatePath('D:\\Desktop\\%2e%2e%2fWindows')).toEqual({
        ok: false,
        status: 403,
        error: expect.stringMatching(/Forbidden path traversal/i),
      });
      expect(resolveAndValidatePath('D:\\Desktop\\..%2f..%2fWindows')).toEqual({
        ok: false,
        status: 403,
        error: expect.stringMatching(/Forbidden path traversal/i),
      });
      expect(resolveAndValidatePath('D:\\Desktop\\..%5cWindows')).toEqual({
        ok: false,
        status: 403,
        error: expect.stringMatching(/Forbidden path traversal/i),
      });
      expect(resolveAndValidatePath('..%2f..%2fWindows%2fsystem32%2fcmd.exe')).toEqual({
        ok: false,
        status: 403,
        error: expect.stringMatching(/Forbidden path traversal/i),
      });

      // Double-encoded traversal vectors
      expect(resolveAndValidatePath('D:\\Desktop\\%252e%252e%252fWindows')).toEqual({
        ok: false,
        status: 403,
        error: expect.stringMatching(/Forbidden path traversal/i),
      });

      // Prefix spoofing attacks
      expect(resolveAndValidatePath('D:\\DesktopFake\\malicious.exe')).toEqual({
        ok: false,
        status: 403,
        error: expect.stringMatching(/Forbidden path traversal/i),
      });
      expect(resolveAndValidatePath('F:\\_Organized_Archive_Fake\\payload.exe')).toEqual({
        ok: false,
        status: 403,
        error: expect.stringMatching(/Forbidden path traversal/i),
      });

      // Poison null bytes (literal, single-encoded, double-encoded)
      expect(resolveAndValidatePath('D:\\Desktop\\test%00.txt')).toEqual({
        ok: false,
        status: 400,
        error: 'Null bytes forbidden in path',
      });
      expect(resolveAndValidatePath('D:\\Desktop\\test\0.txt')).toEqual({
        ok: false,
        status: 400,
        error: 'Null bytes forbidden in path',
      });
      expect(resolveAndValidatePath('D:\\Desktop\\test%2500.txt')).toEqual({
        ok: false,
        status: 400,
        error: 'Null bytes forbidden in path',
      });

      // Malformed URI encoding
      expect(resolveAndValidatePath('D:\\Desktop\\%ZZ')).toEqual({
        ok: false,
        status: 400,
        error: 'Malformed URI encoding in path',
      });
    });
  });

  describe('9. PIPA Phone Masking Remediation (maskPhoneNumber)', () => {
    test('masks multi-phone strings separated by commas, semicolons, or slashes', () => {
      expect(maskPhoneNumber('02-6224-9040, 010-4911-6899')).toBe('02-***-9040, 010-****-6899');
      expect(maskPhoneNumber('010-1234-5678 / 010-9876-5432')).toBe('010-****-5678, 010-****-5432');
      expect(maskPhoneNumber('02-123-4567; 010-2222-3333')).toBe('02-***-4567, 010-****-3333');
      expect(maskPhoneNumber('0221337517, 01098734873')).toBe('02-***-7517, 010-****-4873');
    });

    test('masks raw digits correctly for mobile and landline', () => {
      expect(maskPhoneNumber('01012345678')).toBe('010-****-5678');
      expect(maskPhoneNumber('0212345678')).toBe('02-***-5678');
      expect(maskPhoneNumber('021234567')).toBe('02-***-4567');
      expect(maskPhoneNumber('03112345678')).toBe('031-****-5678');
      expect(maskPhoneNumber('0311234567')).toBe('031-***-4567');
    });

    test('masks formatted landlines and mobiles with 3-digit or 4-digit exchanges', () => {
      expect(maskPhoneNumber('02-123-4567')).toBe('02-***-4567');
      expect(maskPhoneNumber('02-6224-9040')).toBe('02-***-9040');
      expect(maskPhoneNumber('031-1234-5678')).toBe('031-****-5678');
      expect(maskPhoneNumber('031-123-4567')).toBe('031-***-4567');
      expect(maskPhoneNumber('010-9999-8888')).toBe('010-****-8888');
    });

    test('handles whitespace, dots, and trailing range extensions', () => {
      expect(maskPhoneNumber('  010-1234-5678  ')).toBe('010-****-5678');
      expect(maskPhoneNumber('010.1234.5678')).toBe('010-****-5678');
      expect(maskPhoneNumber('010 1234 5678')).toBe('010-****-5678');
      expect(maskPhoneNumber('010 1234-5678')).toBe('010-****-5678');
      expect(maskPhoneNumber('010-12345678')).toBe('010-****-5678');
      expect(maskPhoneNumber('02-796-1907~9')).toBe('02-***-1907~9');
    });

    test('handles edge cases gracefully', () => {
      expect(maskPhoneNumber('')).toBe('');
      expect(maskPhoneNumber(undefined)).toBe('');
      expect(maskPhoneNumber('   ')).toBe('');
      expect(maskPhoneNumber('000')).toBe('000');
    });
  });
});
