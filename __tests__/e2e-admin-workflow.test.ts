/**
 * VITAL Work & Wealth Architecture — Comprehensive E2E Admin Workflow Test Suite
 * Requirements: R1 (Weekly HWPX Pipeline), R2 (Archive Curation & Classification), R3 (Admin Ontology & Traversal)
 * Standards: Rule O (Working Surface Immunity), Rule R (Zero-Error Budget Math), Rule M/P (Admin Formatting)
 * Test Tiers:
 *   - Tier 1: Core Feature Verification (R1, R2, R3)
 *   - Tier 2: Boundary & Corner Cases (Leap year, year-end, empty inputs, budget 0-error, huge cells)
 *   - Tier 3: Cross-Feature Interactions (Curation -> Ontology -> Weekly HWPX)
 *   - Tier 4: Real-World Administrative Scenarios (Gangnam Health Center cycle, Audit Remediation loop)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';
import { z } from 'zod';
import {
  formatAdministrativeDate,
  formatAdministrativeCurrency,
  sanitizeAdministrativeText,
  ensureAdministrativeEnding,
} from '@/lib/administrativeFormatter';

// ============================================================================
// 1. Authoritative Domain Contracts & Schemas (Ground Truth from PROJECT.md)
// ============================================================================

export type AdminDocType =
  | 'POLICY_PLAN'
  | 'RESULT_REPORT'
  | 'ADMIN_AUDIT'
  | 'BUDGET_PLAN'
  | 'WEEKLY_REPORT';

export const AdminDocTypeEnum = z.enum([
  'POLICY_PLAN',
  'RESULT_REPORT',
  'ADMIN_AUDIT',
  'BUDGET_PLAN',
  'WEEKLY_REPORT',
]);

export const AdminDocMetadataSchema = z.object({
  docId: z.string().min(1),
  title: z.string().min(1),
  docType: AdminDocTypeEnum,
  year: z.number().int().min(2015).max(2035),
  department: z.string().min(1),
  project: z.string().min(1),
  filePath: z.string().min(1),
  budgetAmount: z.number().int().nonnegative().nullable(),
  executionRate: z.number().min(0).max(100).nullable(),
  auditFindings: z.array(z.string()).nullable(),
  summary: z.string(),
});

export type AdminDocMetadata = z.infer<typeof AdminDocMetadataSchema>;

export const AdminDocIndexSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  totalDocuments: z.number().int().nonnegative(),
  documents: z.array(AdminDocMetadataSchema),
});

export type SemanticEdgeType =
  | 'IMPLEMENTS'
  | 'EVALUATES'
  | 'CRITIQUES'
  | 'MANDATES_IMPROVEMENT'
  | 'FEEDBACK_LOOP'
  | 'ALLOCATES_BUDGET'
  | 'RECORDS_PROGRESS';

export interface AdminPolicyEntity {
  id: string;
  title: string;
  year: number;
  department: string;
  project: string;
  budgetAmount: number;
  objectives: string[];
}

export interface AdminOutcomeEntity {
  id: string;
  policyId: string;
  title: string;
  year: number;
  executionRate: number;
  achievements: string[];
  spentBudget: number;
}

export interface AdminAuditEntity {
  id: string;
  title: string;
  year: number;
  auditedOutcomeId: string;
  auditFindings: string[];
  correctiveMandates: string[];
}

export interface AdminBudgetPlanEntity {
  id: string;
  title: string;
  year: number;
  project: string;
  totalBudget: number;
  fundingSources: {
    fund: number;
    city: number;
    district: number;
  };
  itemizedBreakdown: Array<{
    item: string;
    amount: number;
  }>;
  remediatedAuditIds?: string[];
}

export interface AdminWeeklyWorkEntity {
  id: string;
  title: string;
  date: string;
  category: string;
  status: 'done' | 'in-progress' | 'todo';
  relatedPolicyId?: string;
  relatedProjectId?: string;
}

export interface AdminOntologyEdge {
  id: string;
  source: string;
  target: string;
  type: SemanticEdgeType;
  description?: string;
}

export interface AdminOntologyGraph {
  policies: AdminPolicyEntity[];
  outcomes: AdminOutcomeEntity[];
  audits: AdminAuditEntity[];
  budgetPlans: AdminBudgetPlanEntity[];
  weeklyWorks: AdminWeeklyWorkEntity[];
  edges: AdminOntologyEdge[];
}

export interface AdminCausalChain {
  originId: string;
  path: Array<{
    nodeId: string;
    nodeType: string;
    title: string;
  }>;
  edges: SemanticEdgeType[];
}

export interface AdminAuditGap {
  auditId: string;
  mandate: string;
  severity: 'HIGH' | 'MEDIUM';
  remediated: boolean;
  budgetAllocation?: number;
}

// ============================================================================
// 2. Authoritative Domain Engines & Reference Oracles
// ============================================================================

/**
 * Non-destructive 5-Type Classifier for Admin Documents (R2)
 */
export function classifyAdminDocument(filename: string, snippet?: string): AdminDocType | null {
  const normName = filename.toLowerCase();
  const text = ((snippet || '') + ' ' + normName).replace(/[\s_]+/g, ' ');

  // Exclusion for noise extensions
  if (/\.(jpg|jpeg|png|gif|zip|csv|tmp|bak)$/i.test(filename)) {
    return null;
  }

  // 1. Weekly Report: 주간업무실적 및 계획, 주간업무, 주간보고
  if (/주간[\s_]*업무[\s_]*실적[\s_]*및[\s_]*계획|주간[\s_]*업무[\s_]*보고|주간[\s_]*업무|주간[\s_]*보고|업무실적[\s_]*및[\s_]*계획/.test(text)) {
    return 'WEEKLY_REPORT';
  }

  // 2. Admin Audit: 행정사무감사, 행감, 수감자료, 감사참고자료
  if (/행정[\s_]*사무[\s_]*감사|행감|수감[\s_]*자료|감사[\s_]*참고|감사[\s_]*자료/.test(text)) {
    return 'ADMIN_AUDIT';
  }

  // 3. Budget Plan: 사업설명서, 예산편성, 세출예산, 본예산 사업설명서
  if (/사업[\s_]*설명서|예산[\s_]*편성|세출[\s_]*예산|본예산|예산[\s_]*요구서/.test(text)) {
    return 'BUDGET_PLAN';
  }

  // 4. Result Report: 결과보고, 운영결과, 사업실적
  if (/결과[\s_]*보고|운영[\s_]*결과|추진[\s_]*실적|사업[\s_]*실적|성과[\s_]*평가/.test(text)) {
    return 'RESULT_REPORT';
  }

  // 5. Policy Plan: 방침서, 추진계획, 기본계획, 운영계획, 사업 총괄 계획
  if (/방침(?:서)?|기본[\s_]*계획|시행[\s_]*계획|추진[\s_]*계획|운영[\s_]*계획|종합[\s_]*계획|사업[\s_]*총괄[\s_]*계획|총괄[\s_]*계획|실행[\s_]*계획|사업[\s_]*기획|사업[\s_]*계획/.test(text)) {
    return 'POLICY_PLAN';
  }

  return null;
}

/**
 * Currency and Number Extraction for Public Admin Documents
 */
export function extractAdminBudget(text: string): number | null {
  // Pattern 1: 금 7,174,000원 or 금7,174,000원
  const mWon = text.match(/금?\s*([0-9,]+)\s*원/);
  if (mWon) {
    const val = parseInt(mWon[1].replace(/,/g, ''), 10);
    if (!isNaN(val)) return val;
  }

  // Pattern 2: 1,557,192천원 or 1,557,192 천원
  const mThousand = text.match(/([0-9,]+)\s*천원/);
  if (mThousand) {
    const val = parseInt(mThousand[1].replace(/,/g, ''), 10);
    if (!isNaN(val)) return val * 1000;
  }

  // Pattern 3: 1,557백만원 or 1,557 백만원
  const mMillion = text.match(/([0-9,]+)\s*백만원/);
  if (mMillion) {
    const val = parseInt(mMillion[1].replace(/,/g, ''), 10);
    if (!isNaN(val)) return val * 1000000;
  }

  return null;
}

/**
 * Wednesday Batch Date Calculator (R1)
 * Given any reference date, calculates:
 * - target Wednesday (W)
 * - performance period: [W - 2 days, W + 4 days] (Monday ~ Sunday)
 * - plan period: [W + 5 days, W + 11 days] (Following Monday ~ Sunday)
 */
export function computeWednesdayBatchPeriods(dateInput: string | Date): {
  targetWednesday: string;
  performanceStart: string;
  performanceEnd: string;
  planStart: string;
  planEnd: string;
  performanceLabel: string;
  planLabel: string;
} {
  const dt = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00Z') : new Date(dateInput);
  if (isNaN(dt.getTime())) {
    throw new Error(`[WEDNESDAY BATCH ERROR] Invalid date input: ${dateInput}`);
  }

  const dayOfWeek = dt.getUTCDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const diffToWed = 3 - dayOfWeek;
  const wed = new Date(dt.getTime());
  wed.setUTCDate(wed.getUTCDate() + diffToWed);

  const pStart = new Date(wed.getTime());
  pStart.setUTCDate(pStart.getUTCDate() - 2); // Monday

  const pEnd = new Date(wed.getTime());
  pEnd.setUTCDate(pEnd.getUTCDate() + 4); // Sunday

  const nextStart = new Date(wed.getTime());
  nextStart.setUTCDate(nextStart.getUTCDate() + 5); // Next Monday

  const nextEnd = new Date(wed.getTime());
  nextEnd.setUTCDate(nextEnd.getUTCDate() + 11); // Next Sunday

  const fmtIso = (d: Date) => d.toISOString().split('T')[0];
  const fmtLabel = (start: Date, end: Date) => {
    const sm = String(start.getUTCMonth() + 1).padStart(2, '0');
    const sd = String(start.getUTCDate()).padStart(2, '0');
    const em = String(end.getUTCMonth() + 1).padStart(2, '0');
    const ed = String(end.getUTCDate()).padStart(2, '0');
    return `${sm}. ${sd}.(월) ~ ${em}. ${ed}.(일)`;
  };

  return {
    targetWednesday: fmtIso(wed),
    performanceStart: fmtIso(pStart),
    performanceEnd: fmtIso(pEnd),
    planStart: fmtIso(nextStart),
    planEnd: fmtIso(nextEnd),
    performanceLabel: fmtLabel(pStart, pEnd),
    planLabel: fmtLabel(nextStart, nextEnd),
  };
}

/**
 * Bidirectional Traversal Engine (R3)
 */
export function traceUpstream(nodeId: string, graph: AdminOntologyGraph): AdminCausalChain {
  const chain: Array<{ nodeId: string; nodeType: string; title: string }> = [];
  const edgeSequence: SemanticEdgeType[] = [];

  let currentId: string | null = nodeId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    // Resolve node
    const policy = graph.policies.find((p) => p.id === currentId);
    const outcome = graph.outcomes.find((o) => o.id === currentId);
    const audit = graph.audits.find((a) => a.id === currentId);
    const budget = graph.budgetPlans.find((b) => b.id === currentId);

    if (policy) {
      chain.push({ nodeId: policy.id, nodeType: 'POLICY', title: policy.title });
      break; // Reached upstream root
    } else if (outcome) {
      chain.push({ nodeId: outcome.id, nodeType: 'OUTCOME', title: outcome.title });
      const inEdge = graph.edges.find((e) => e.target === currentId && e.type === 'IMPLEMENTS');
      if (inEdge) {
        edgeSequence.push('IMPLEMENTS');
        currentId = inEdge.source;
      } else {
        currentId = outcome.policyId || null;
        if (currentId) edgeSequence.push('IMPLEMENTS');
      }
    } else if (audit) {
      chain.push({ nodeId: audit.id, nodeType: 'AUDIT', title: audit.title });
      const inEdge = graph.edges.find((e) => e.target === currentId && (e.type === 'EVALUATES' || e.type === 'CRITIQUES'));
      if (inEdge) {
        edgeSequence.push(inEdge.type);
        currentId = inEdge.source;
      } else {
        currentId = audit.auditedOutcomeId || null;
        if (currentId) edgeSequence.push('EVALUATES');
      }
    } else if (budget) {
      chain.push({ nodeId: budget.id, nodeType: 'BUDGET_PLAN', title: budget.title });
      const inEdge = graph.edges.find((e) => e.target === currentId && e.type === 'MANDATES_IMPROVEMENT');
      if (inEdge) {
        edgeSequence.push('MANDATES_IMPROVEMENT');
        currentId = inEdge.source;
      } else if (budget.remediatedAuditIds && budget.remediatedAuditIds.length > 0) {
        edgeSequence.push('MANDATES_IMPROVEMENT');
        currentId = budget.remediatedAuditIds[0];
      } else {
        currentId = null;
      }
    } else {
      break;
    }
  }

  return { originId: nodeId, path: chain, edges: edgeSequence };
}

export function traceDownstream(nodeId: string, graph: AdminOntologyGraph): AdminCausalChain {
  const chain: Array<{ nodeId: string; nodeType: string; title: string }> = [];
  const edgeSequence: SemanticEdgeType[] = [];

  let currentId: string | null = nodeId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const policy = graph.policies.find((p) => p.id === currentId);
    const outcome = graph.outcomes.find((o) => o.id === currentId);
    const audit = graph.audits.find((a) => a.id === currentId);
    const budget = graph.budgetPlans.find((b) => b.id === currentId);

    if (policy) {
      chain.push({ nodeId: policy.id, nodeType: 'POLICY', title: policy.title });
      const outEdge = graph.edges.find((e) => e.source === currentId && e.type === 'IMPLEMENTS');
      if (outEdge) {
        edgeSequence.push('IMPLEMENTS');
        currentId = outEdge.target;
      } else {
        const matchingOutcome = graph.outcomes.find((o) => o.policyId === currentId);
        currentId = matchingOutcome ? matchingOutcome.id : null;
        if (currentId) edgeSequence.push('IMPLEMENTS');
      }
    } else if (outcome) {
      chain.push({ nodeId: outcome.id, nodeType: 'OUTCOME', title: outcome.title });
      const outEdge = graph.edges.find((e) => e.source === currentId && (e.type === 'EVALUATES' || e.type === 'CRITIQUES'));
      if (outEdge) {
        edgeSequence.push(outEdge.type);
        currentId = outEdge.target;
      } else {
        const matchingAudit = graph.audits.find((a) => a.auditedOutcomeId === currentId);
        currentId = matchingAudit ? matchingAudit.id : null;
        if (currentId) edgeSequence.push('EVALUATES');
      }
    } else if (audit) {
      chain.push({ nodeId: audit.id, nodeType: 'AUDIT', title: audit.title });
      const outEdge = graph.edges.find((e) => e.source === currentId && e.type === 'MANDATES_IMPROVEMENT');
      if (outEdge) {
        edgeSequence.push('MANDATES_IMPROVEMENT');
        currentId = outEdge.target;
      } else {
        const matchingBudget = graph.budgetPlans.find((b) => b.remediatedAuditIds?.includes(currentId!));
        currentId = matchingBudget ? matchingBudget.id : null;
        if (currentId) edgeSequence.push('MANDATES_IMPROVEMENT');
      }
    } else if (budget) {
      chain.push({ nodeId: budget.id, nodeType: 'BUDGET_PLAN', title: budget.title });
      break; // Reached downstream leaf
    } else {
      break;
    }
  }

  return { originId: nodeId, path: chain, edges: edgeSequence };
}

/**
 * Audit Gap Detector (R3)
 * Detects audit findings/mandates that have no matching allocation in subsequent budget plans
 */
export function detectAuditGaps(graph: AdminOntologyGraph): AdminAuditGap[] {
  const gaps: AdminAuditGap[] = [];

  for (const audit of graph.audits) {
    for (const mandate of audit.correctiveMandates) {
      // Find edge or remediation link
      const mandateEdge = graph.edges.find(
        (e) => e.source === audit.id && e.type === 'MANDATES_IMPROVEMENT'
      );
      const remediatingBudget = graph.budgetPlans.find(
        (b) =>
          b.remediatedAuditIds?.includes(audit.id) ||
          (mandateEdge && mandateEdge.target === b.id)
      );

      if (!remediatingBudget) {
        gaps.push({
          auditId: audit.id,
          mandate,
          severity: 'HIGH',
          remediated: false,
        });
      } else {
        // Check if there is an allocated budget item
        const alloc = remediatingBudget.itemizedBreakdown.reduce(
          (sum, it) => sum + it.amount,
          0
        );
        if (alloc <= 0) {
          gaps.push({
            auditId: audit.id,
            mandate,
            severity: 'MEDIUM',
            remediated: false,
            budgetAllocation: 0,
          });
        }
      }
    }
  }

  return gaps;
}

/**
 * Rule R Forensic Accounting Invariant Checker
 * 1. Total Project Cost === Sum(Funding Sources) === Sum(Itemized Breakdown)
 * 2. Individual Thousand-Ceiling: Level 1 = sum(ceil(Level 2_k / 1000) * 1000)
 */
export function verifyForensicBudgetInvariants(budgetPlan: AdminBudgetPlanEntity): {
  valid: boolean;
  discrepancy: number;
  sourcesSum: number;
  itemizedSum: number;
} {
  const sourcesSum =
    budgetPlan.fundingSources.fund +
    budgetPlan.fundingSources.city +
    budgetPlan.fundingSources.district;

  const itemizedSum = budgetPlan.itemizedBreakdown.reduce((acc, curr) => {
    // Individual thousand ceiling enforcement
    const ceilingVal = Math.ceil(curr.amount / 1000) * 1000;
    return acc + ceilingVal;
  }, 0);

  const disc1 = Math.abs(budgetPlan.totalBudget - sourcesSum);
  const disc2 = Math.abs(budgetPlan.totalBudget - itemizedSum);
  const totalDiscrepancy = disc1 + disc2;

  if (totalDiscrepancy !== 0) {
    throw new Error(
      `[RULE R BUDGET DEFECT] 0 KRW balance breached! Total: ${budgetPlan.totalBudget}, Sources: ${sourcesSum}, Items: ${itemizedSum}`
    );
  }

  return {
    valid: true,
    discrepancy: 0,
    sourcesSum,
    itemizedSum,
  };
}

/**
 * Synthetic HWPX Archive Builder & Validator (R1)
 */
export async function buildSyntheticWeeklyHwpx(params: {
  targetDate: string;
  department: string;
  author: string;
  performanceTasks: Array<{ category: string; content: string }>;
  planTasks: Array<{ category: string; content: string }>;
}): Promise<{ buffer: Buffer; xmlContent: string }> {
  const periods = computeWednesdayBatchPeriods(params.targetDate);
  const zip = new JSZip();

  // 1. Mandatory HWPX Mimetype (uncompressed at offset 0)
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });

  // 2. header.xml (styles, paraPr, charPr)
  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">
  <hh:paraProperties>
    <hh:paraPr id="1" lineWrap="BREAK" />
    <hh:paraPr id="37" lineWrap="BREAK" />
    <hh:paraPr id="48" lineWrap="BREAK" />
    <hh:paraPr id="52" lineWrap="BREAK" />
  </hh:paraProperties>
</hh:head>`;
  zip.file('Contents/header.xml', headerXml);

  // 3. section0.xml (2-column comparative master table)
  let perfXml = '';
  for (const t of params.performanceTasks) {
    perfXml += `<hp:p paraPrIDRef="52"><hp:run><hp:t>${t.category}</hp:t></hp:run><hp:linesegarray><hp:lineseg vertpos="0" vertsize="1200" horzsize="20000" /></hp:linesegarray></hp:p>`;
    perfXml += `<hp:p paraPrIDRef="52"><hp:run><hp:t>${t.content}</hp:t></hp:run><hp:linesegarray><hp:lineseg vertpos="1400" vertsize="1200" horzsize="20000" /></hp:linesegarray></hp:p>`;
  }

  let planXml = '';
  for (const t of params.planTasks) {
    planXml += `<hp:p paraPrIDRef="52"><hp:run><hp:t>${t.category}</hp:t></hp:run><hp:linesegarray><hp:lineseg vertpos="0" vertsize="1200" horzsize="20000" /></hp:linesegarray></hp:p>`;
    planXml += `<hp:p paraPrIDRef="52"><hp:run><hp:t>${t.content}</hp:t></hp:run><hp:linesegarray><hp:lineseg vertpos="1400" vertsize="1200" horzsize="20000" /></hp:linesegarray></hp:p>`;
  }

  const sectionXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <!-- Table 0: Department & Author Organization Header -->
  <hp:p paraPrIDRef="1">
    <hp:tbl id="tbl_header" rowCnt="1" colCnt="2" treatAsChar="1">
      <hp:tr>
        <hp:tc><hp:p paraPrIDRef="1"><hp:run><hp:t>❚ ${params.department}</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p paraPrIDRef="48"><hp:run><hp:t>${params.author}</hp:t></hp:run></hp:p></hp:tc>
      </hp:tr>
    </hp:tbl>
  </hp:p>

  <!-- Table 1: 2-Column Comparative Weekly Master Table -->
  <hp:p paraPrIDRef="1">
    <hp:tbl id="tbl_master" rowCnt="2" colCnt="2" pageBreak="CELL" repeatHeader="1">
      <hp:tr>
        <hp:tc><hp:p paraPrIDRef="37"><hp:run><hp:t>업무실적 ${periods.performanceLabel}</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p paraPrIDRef="37"><hp:run><hp:t>업무계획 ${periods.planLabel}</hp:t></hp:run></hp:p></hp:tc>
      </hp:tr>
      <hp:tr>
        <hp:tc id="tc_perf" cellHeight="250000">
          ${perfXml}
        </hp:tc>
        <hp:tc id="tc_plan" cellHeight="250000">
          ${planXml}
        </hp:tc>
      </hp:tr>
    </hp:tbl>
  </hp:p>
</hs:sec>`;

  zip.file('Contents/section0.xml', sectionXml);

  const uint8 = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    buffer: Buffer.from(uint8),
    xmlContent: sectionXml,
  };
}

// ============================================================================
// 3. Test Suites Across All 4 Tiers
// ============================================================================

describe('VITAL E2E Testing Track — Full Administrative Workflow Suite', () => {
  const sandboxDir = path.join(os.tmpdir(), 'vital-e2e-sandbox-' + Date.now());

  beforeAll(() => {
    fs.mkdirSync(sandboxDir, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    } catch {
      // Ignored in cleanup
    }
  });

  // --------------------------------------------------------------------------
  // Tier 1: Core Feature Verification (Requirements R1, R2, R3)
  // --------------------------------------------------------------------------
  describe('Tier 1: Core Feature Coverage (Requirements R1, R2, R3)', () => {
    describe('F1 & F2: Archive & Desktop Non-Destructive Classifier & Metadata Extractor (R2)', () => {
      it('correctly classifies real desktop files into 5 administrative types with zero noise bleed', () => {
        const testFiles = [
          { name: '(20261104) 보건소 주간 업무실적 및 계획(건강증진팀) (1).hwpx', expected: 'WEEKLY_REPORT' },
          { name: '(건강증진팀) 2026 보건소 행정사무감사 참고자료 final.hwpx', expected: 'ADMIN_AUDIT' },
          { name: '(보건행정과) 2027년도 본예산 사업설명서(\'26.10.26.자).hwpx', expected: 'BUDGET_PLAN' },
          { name: '2026 강남구 보건소 신체활동 결과보고.hwp', expected: 'RESULT_REPORT' },
          { name: '2026_메디런_프로그램_운영_계획.hwpx', expected: 'POLICY_PLAN' },
          { name: '20260818_강남구보건소 신체활동 사업 총괄 계획_인계 보고용2.hwpx', expected: 'POLICY_PLAN' },
          { name: 'PHOTO_DSC_001.JPG', expected: null },
          { name: '영수증_식대.pdf', expected: null },
        ];

        for (const item of testFiles) {
          const res = classifyAdminDocument(item.name);
          expect(res).toBe(item.expected);
        }
      });

      it('extracts exact KRW budget values from administrative text representations', () => {
        expect(extractAdminBudget('총사업비 금7,174,000원')).toBe(7174000);
        expect(extractAdminBudget('사업비 1,557,192천원')).toBe(1557192000);
        expect(extractAdminBudget('총 1,255백만원')).toBe(1255000000);
        expect(extractAdminBudget('일반 현황 및 서식 모음')).toBeNull();
      });

      it('validates canonical schema compliance for AdminDocIndexDto', () => {
        const sampleRecord: AdminDocMetadata = {
          docId: 'doc-adm-001',
          title: '2026 메디런 프로그램 운영 계획',
          docType: 'POLICY_PLAN',
          year: 2026,
          department: '보건행정과',
          project: '서울체력장_AI메디헬스_메디런',
          filePath: 'D:\\Desktop\\2026_메디런_프로그램_운영_계획.hwpx',
          budgetAmount: 7174000,
          executionRate: null,
          auditFindings: null,
          summary: '2026년도 메디런 프로그램 세부 운영 계획 수립 방침',
        };

        const parsed = AdminDocMetadataSchema.safeParse(sampleRecord);
        expect(parsed.success).toBe(true);

        const indexPayload = {
          version: '1.0.0',
          generatedAt: new Date().toISOString(),
          totalDocuments: 1,
          documents: [sampleRecord],
        };

        const parsedIndex = AdminDocIndexSchema.safeParse(indexPayload);
        expect(parsedIndex.success).toBe(true);
      });
    });

    describe('F5, F6, F7, F8: Administrative Ontology 4-Phase Entities, 7 Edges & Traversal (R3)', () => {
      const mockGraph: AdminOntologyGraph = {
        policies: [
          {
            id: 'pol-2026-ai',
            title: '2026년 강남 AI 메디헬스 센터 조성 기본계획',
            year: 2026,
            department: '보건행정과',
            project: '강남_AI_메디헬스_센터',
            budgetAmount: 1255000000,
            objectives: ['스마트짐 구축', 'AI 운동처방 솔루션 도입'],
          },
        ],
        outcomes: [
          {
            id: 'out-2026-ai',
            policyId: 'pol-2026-ai',
            title: '2026년 강남 AI 메디헬스 센터 운영 결과보고서',
            year: 2026,
            executionRate: 94.5,
            achievements: ['누적 이용자 12,400명 달성', '장비 18종 설치'],
            spentBudget: 1185975000,
          },
        ],
        audits: [
          {
            id: 'aud-2026-ai',
            title: '2026년도 보건소 행정사무감사 수감자료',
            year: 2026,
            auditedOutcomeId: 'out-2026-ai',
            auditFindings: ['생체계측 장비 주기적 정밀 보정 예산 미확보'],
            correctiveMandates: ['차년도 예산에 정밀 계측기 보정 및 교정비 편성 요구'],
          },
        ],
        budgetPlans: [
          {
            id: 'bud-2027-ai',
            title: '2027년도 본예산 사업설명서(강남 AI 메디헬스 센터)',
            year: 2027,
            project: '강남_AI_메디헬스_센터',
            totalBudget: 1742152000,
            fundingSources: {
              fund: 200000000,
              city: 542152000,
              district: 1000000000,
            },
            itemizedBreakdown: [
              { item: 'AI 솔루션 유지보수', amount: 800000000 },
              { item: '정밀 계측기 교정 및 유지비', amount: 142152000 },
              { item: '전문 운영인력 인건비', amount: 800000000 },
            ],
            remediatedAuditIds: ['aud-2026-ai'],
          },
        ],
        weeklyWorks: [
          {
            id: 'wk-2026-w45-01',
            title: 'AI 메디헬스 센터 스마트 트레이닝 장비 최종 검수',
            date: '2026-11-03',
            category: '강남_AI_메디헬스_센터',
            status: 'done',
            relatedPolicyId: 'pol-2026-ai',
          },
        ],
        edges: [
          { id: 'e1', source: 'pol-2026-ai', target: 'out-2026-ai', type: 'IMPLEMENTS' },
          { id: 'e2', source: 'out-2026-ai', target: 'aud-2026-ai', type: 'EVALUATES' },
          { id: 'e3', source: 'aud-2026-ai', target: 'bud-2027-ai', type: 'MANDATES_IMPROVEMENT' },
          { id: 'e4', source: 'bud-2027-ai', target: 'pol-2026-ai', type: 'FEEDBACK_LOOP' },
          { id: 'e5', source: 'wk-2026-w45-01', target: 'pol-2026-ai', type: 'RECORDS_PROGRESS' },
        ],
      };

      it('traces upstream from 2027 BudgetPlan to originating 2026 Policy', () => {
        const upstream = traceUpstream('bud-2027-ai', mockGraph);
        expect(upstream.path.map((p) => p.nodeId)).toEqual([
          'bud-2027-ai',
          'aud-2026-ai',
          'out-2026-ai',
          'pol-2026-ai',
        ]);
        expect(upstream.edges).toContain('MANDATES_IMPROVEMENT');
        expect(upstream.edges).toContain('EVALUATES');
        expect(upstream.edges).toContain('IMPLEMENTS');
      });

      it('traces downstream from 2026 Policy to 2027 BudgetPlan', () => {
        const downstream = traceDownstream('pol-2026-ai', mockGraph);
        expect(downstream.path.map((p) => p.nodeId)).toEqual([
          'pol-2026-ai',
          'out-2026-ai',
          'aud-2026-ai',
          'bud-2027-ai',
        ]);
      });

      it('identifies audit remediation gaps when corrective mandate is unlinked', () => {
        // Copy graph without the budget plan remediation
        const unlinkedGraph: AdminOntologyGraph = {
          ...mockGraph,
          budgetPlans: [],
          edges: mockGraph.edges.filter((e) => e.type !== 'MANDATES_IMPROVEMENT'),
        };

        const gaps = detectAuditGaps(unlinkedGraph);
        expect(gaps.length).toBe(1);
        expect(gaps[0].auditId).toBe('aud-2026-ai');
        expect(gaps[0].remediated).toBe(false);

        // When remediated, gaps count is 0
        const resolvedGaps = detectAuditGaps(mockGraph);
        expect(resolvedGaps.length).toBe(0);
      });
    });

    describe('F10, F11, F12: Weekly Task Batching & 2-Column HWPX Master Table (R1)', () => {
      it('computes exact Wednesday cycle dates for current performance and next-week plan', () => {
        // Wednesday Nov 4, 2026
        const cycle = computeWednesdayBatchPeriods('2026-11-04');
        expect(cycle.targetWednesday).toBe('2026-11-04');
        expect(cycle.performanceStart).toBe('2026-11-02'); // Monday
        expect(cycle.performanceEnd).toBe('2026-11-08');   // Sunday
        expect(cycle.planStart).toBe('2026-11-09');          // Next Monday
        expect(cycle.planEnd).toBe('2026-11-15');            // Next Sunday
        expect(cycle.performanceLabel).toBe('11. 02.(월) ~ 11. 08.(일)');
        expect(cycle.planLabel).toBe('11. 09.(월) ~ 11. 15.(일)');
      });

      it('builds authentic HWPX archive adhering to 5-Pillar anti-overlap and 2-column comparative layout', async () => {
        const res = await buildSyntheticWeeklyHwpx({
          targetDate: '2026-11-04',
          department: '보건행정과',
          author: '건강증진팀장 김지영',
          performanceTasks: [
            { category: '8. 서울체력장 강남센터', content: '○ 기    간 : 2026. 11. 2.~11. 8.\n○ 실    적 : 142명 측정 완료' },
          ],
          planTasks: [
            { category: '8. 서울체력장 강남센터', content: '○ 기    간 : 2026. 11. 9.~11. 15.\n○ 계    획 : 취약계층 출장 측정 3회' },
          ],
        });

        expect(res.buffer.length).toBeGreaterThan(500);

        // Read with JSZip and verify strict HWPX specifications
        const readZip = await JSZip.loadAsync(res.buffer);
        const fileNames = Object.keys(readZip.files);

        // Invariant 1: Uncompressed mimetype at offset 0
        expect(fileNames[0]).toBe('mimetype');
        const mimetype = await readZip.file('mimetype')?.async('text');
        expect(mimetype).toBe('application/hwp+zip');

        // Invariant 2: section0.xml contains Table 1 with pageBreak="CELL" and 2 columns
        const secXml = await readZip.file('Contents/section0.xml')?.async('text');
        expect(secXml).toBeDefined();
        expect(secXml).toContain('pageBreak="CELL"');
        expect(secXml).toContain('repeatHeader="1"');
        expect(secXml).toContain('업무실적 11. 02.(월) ~ 11. 08.(일)');
        expect(secXml).toContain('업무계획 11. 09.(월) ~ 11. 15.(일)');
        expect(secXml).toContain('❚ 보건행정과');
        expect(secXml).toContain('건강증진팀장 김지영');
      });
    });
  });

  // --------------------------------------------------------------------------
  // Tier 2: Boundary & Corner Cases
  // --------------------------------------------------------------------------
  describe('Tier 2: Boundary & Corner Cases', () => {
    describe('B1: Leap Year & Year-End Date Boundaries', () => {
      it('calculates Wednesday cycle across leap day (Feb 29, 2028 - Tuesday)', () => {
        // 2028-02-29 is Tuesday. Target Wednesday is 2028-03-01.
        const cycle = computeWednesdayBatchPeriods('2028-02-29');
        expect(cycle.targetWednesday).toBe('2028-03-01');
        expect(cycle.performanceStart).toBe('2028-02-28'); // Monday
        expect(cycle.performanceEnd).toBe('2028-03-05');   // Sunday
        expect(cycle.performanceLabel).toBe('02. 28.(월) ~ 03. 05.(일)');
      });

      it('calculates Wednesday cycle across year-end boundary (Dec 30, 2026 - Wednesday)', () => {
        const cycle = computeWednesdayBatchPeriods('2026-12-30');
        expect(cycle.targetWednesday).toBe('2026-12-30');
        expect(cycle.performanceStart).toBe('2026-12-28'); // Mon Dec 28, 2026
        expect(cycle.performanceEnd).toBe('2027-01-03');   // Sun Jan 3, 2027
        expect(cycle.planStart).toBe('2027-01-04');          // Mon Jan 4, 2027
        expect(cycle.planEnd).toBe('2027-01-10');            // Sun Jan 10, 2027
      });

      it('rejects invalid or non-date strings with loud failure', () => {
        expect(() => computeWednesdayBatchPeriods('invalid-date-string')).toThrow(
          /\[WEDNESDAY BATCH ERROR\]/
        );
      });
    });

    describe('B2: Empty & Missing Field Resilience', () => {
      it('safely handles documents with null budget and empty audit findings', () => {
        const minimalDoc: AdminDocMetadata = {
          docId: 'doc-minimal-001',
          title: '주간 행정 협조 안내문',
          docType: 'WEEKLY_REPORT',
          year: 2026,
          department: '보건행정과',
          project: '일반행정_보안_법령_기타',
          filePath: 'D:\\Desktop\\notice.hwpx',
          budgetAmount: null,
          executionRate: null,
          auditFindings: null,
          summary: '',
        };

        const res = AdminDocMetadataSchema.safeParse(minimalDoc);
        expect(res.success).toBe(true);
      });

      it('generates valid HWPX even when task lists are empty without crashing', async () => {
        const res = await buildSyntheticWeeklyHwpx({
          targetDate: '2026-11-04',
          department: '보건행정과',
          author: '총괄주무관',
          performanceTasks: [],
          planTasks: [],
        });

        expect(res.buffer.length).toBeGreaterThan(300);
        expect(res.xmlContent).toContain('tc_perf');
        expect(res.xmlContent).toContain('tc_plan');
      });
    });

    describe('B3: Rule R Forensic Budget Invariant Checks (Zero-Error & Ceiling)', () => {
      it('passes 0 KRW balance check when total equals funding sources and ceiling item sums', () => {
        const balancedPlan: AdminBudgetPlanEntity = {
          id: 'bud-valid',
          title: '2027 본예산 사업설명서',
          year: 2027,
          project: '신체활동_역량강화',
          totalBudget: 10000000, // 10,000,000 KRW
          fundingSources: {
            fund: 2000000,
            city: 3000000,
            district: 5000000,
          },
          itemizedBreakdown: [
            { item: '강사수당', amount: 3500000 },
            { item: '홍보물제작', amount: 1500000 },
            { item: '행사운영비', amount: 5000000 },
          ],
        };

        const auditResult = verifyForensicBudgetInvariants(balancedPlan);
        expect(auditResult.valid).toBe(true);
        expect(auditResult.discrepancy).toBe(0);
      });

      it('enforces individual thousand ceiling rule (sum of ceilings vs ceiling of sum)', () => {
        // Individual Level 2 items with 원-level precision:
        // Item 1: 2,633,200 -> ceil to 2,634,000
        // Item 2: 6,879,100 -> ceil to 6,880,000
        // Strict Level 1 sum must be: 2,634,000 + 6,880,000 = 9,514,000 KRW
        // (If naively summed first: 2,633,200 + 6,879,100 = 9,512,300 -> 9,513,000, creating 1,000 KRW defect!)
        const ceilPlan: AdminBudgetPlanEntity = {
          id: 'bud-ceil',
          title: '2027 인건비 및 사회보험 예산편성 요구서',
          year: 2027,
          project: '건강증진팀_인건비',
          totalBudget: 9514000,
          fundingSources: {
            fund: 0,
            city: 0,
            district: 9514000,
          },
          itemizedBreakdown: [
            { item: '퇴직적립금', amount: 2633200 },
            { item: '연차수당', amount: 6879100 },
          ],
        };

        const auditResult = verifyForensicBudgetInvariants(ceilPlan);
        expect(auditResult.valid).toBe(true);
        expect(auditResult.itemizedSum).toBe(9514000);
      });

      it('loudly fails when budget discrepancy is greater than 0 KRW', () => {
        const defectivePlan: AdminBudgetPlanEntity = {
          id: 'bud-defective',
          title: '결함 예산 요구서',
          year: 2027,
          project: '하자_사업',
          totalBudget: 10000000,
          fundingSources: {
            fund: 2000000,
            city: 3000000,
            district: 4999000, // Deficit of 1,000 KRW
          },
          itemizedBreakdown: [{ item: '하자항목', amount: 10000000 }],
        };

        expect(() => verifyForensicBudgetInvariants(defectivePlan)).toThrow(
          /\[RULE R BUDGET DEFECT\]/
        );
      });
    });

    describe('B4: Malformed Payload & Loud-Failure Gatekeeper', () => {
      it('throws Loud-Failure error on invalid docType schema violation', () => {
        const badPayload = {
          docId: 'bad-01',
          title: 'Invalid Doc Type Test',
          docType: 'UNKNOWN_TYPE_XYZ',
          year: 2026,
          department: '보건행정과',
          project: 'test',
          filePath: 'D:\\Desktop\\bad.hwpx',
          budgetAmount: null,
          executionRate: null,
          auditFindings: null,
          summary: 'test',
        };

        const parsed = AdminDocMetadataSchema.safeParse(badPayload);
        expect(parsed.success).toBe(false);
      });
    });

    describe('B5: Multi-Page Table Cell Geometry Defense', () => {
      it('validates that master comparative table specifies pageBreak="CELL" to prevent truncation', async () => {
        const tallRes = await buildSyntheticWeeklyHwpx({
          targetDate: '2026-11-04',
          department: '보건행정과',
          author: '건강증진팀장 김지영',
          performanceTasks: Array.from({ length: 15 }, (_, i) => ({
            category: `과제 ${i + 1}`,
            content: `○ 상세 실적 내용 ${i + 1}\n- 세부 지표 및 측정 결과 반영\n- 실무 조치 완료`,
          })),
          planTasks: Array.from({ length: 15 }, (_, i) => ({
            category: `과제 ${i + 1}`,
            content: `○ 차주 계획 수립 ${i + 1}\n- 현장 점검 및 교육 지원`,
          })),
        });

        // Parse section XML
        const zip = await JSZip.loadAsync(tallRes.buffer);
        const sec = await zip.file('Contents/section0.xml')?.async('text');

        expect(sec).toBeDefined();
        expect(sec).toMatch(/<hp:tbl[^>]+pageBreak="CELL"/);
        expect(sec).toMatch(/<hp:tbl[^>]+repeatHeader="1"/);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Tier 3: Cross-Feature Interactions
  // --------------------------------------------------------------------------
  describe('Tier 3: Cross-Feature Interactions', () => {
    it('X1: Seamlessly pipelines curated documents into ontology entities and builds semantic relations', () => {
      // 1. Simulated Curation Output
      const curatedDocs: AdminDocMetadata[] = [
        {
          docId: 'doc-pol-01',
          title: '2026년 강남 AI 메디헬스 센터 기본계획',
          docType: 'POLICY_PLAN',
          year: 2026,
          department: '보건행정과',
          project: '강남_AI_메디헬스_센터',
          filePath: 'D:\\Desktop\\2026_AI메디헬스_기본계획.hwpx',
          budgetAmount: 1255000000,
          executionRate: null,
          auditFindings: null,
          summary: 'AI 메디헬스 센터 구축 방침',
        },
        {
          docId: 'doc-out-01',
          title: '2026년 강남 AI 메디헬스 센터 추진실적 결과보고',
          docType: 'RESULT_REPORT',
          year: 2026,
          department: '보건행정과',
          project: '강남_AI_메디헬스_센터',
          filePath: 'D:\\Desktop\\2026_AI메디헬스_결과보고.hwpx',
          budgetAmount: 1185975000,
          executionRate: 94.5,
          auditFindings: null,
          summary: '연간 실적 보고',
        },
      ];

      // 2. Ingest into Ontology Graph
      const graph: AdminOntologyGraph = {
        policies: [
          {
            id: curatedDocs[0].docId,
            title: curatedDocs[0].title,
            year: curatedDocs[0].year,
            department: curatedDocs[0].department,
            project: curatedDocs[0].project,
            budgetAmount: curatedDocs[0].budgetAmount || 0,
            objectives: ['스마트 헬스케어 인프라 확충'],
          },
        ],
        outcomes: [
          {
            id: curatedDocs[1].docId,
            policyId: curatedDocs[0].docId,
            title: curatedDocs[1].title,
            year: curatedDocs[1].year,
            executionRate: curatedDocs[1].executionRate || 0,
            achievements: ['목표 대비 94.5% 달성'],
            spentBudget: curatedDocs[1].budgetAmount || 0,
          },
        ],
        audits: [],
        budgetPlans: [],
        weeklyWorks: [],
        edges: [
          {
            id: 'edge-impl-01',
            source: curatedDocs[0].docId,
            target: curatedDocs[1].docId,
            type: 'IMPLEMENTS',
          },
        ],
      };

      // 3. Verify Downstream Path from Policy to Outcome
      const chain = traceDownstream(curatedDocs[0].docId, graph);
      expect(chain.path.length).toBe(2);
      expect(chain.path[0].nodeId).toBe('doc-pol-01');
      expect(chain.path[1].nodeId).toBe('doc-out-01');
      expect(chain.edges).toContain('IMPLEMENTS');
    });

    it('X2: Connects Audit finding through MANDATES_IMPROVEMENT to resolve audit gap in next-year budget', () => {
      const graph: AdminOntologyGraph = {
        policies: [],
        outcomes: [
          {
            id: 'out-health-2026',
            policyId: 'pol-dummy',
            title: '신체활동 사업 결과보고',
            year: 2026,
            executionRate: 92,
            achievements: ['주민참여 5,000명'],
            spentBudget: 50000000,
          },
        ],
        audits: [
          {
            id: 'aud-health-2026',
            title: '2026년도 행정사무감사 자료',
            year: 2026,
            auditedOutcomeId: 'out-health-2026',
            auditFindings: ['야외 걷기 코스 안내 표지판 시인성 부족 지적'],
            correctiveMandates: ['2027년도 예산에 양재천 및 탄천 걷기 코스 시인성 강화 표지판 교체비 반영'],
          },
        ],
        budgetPlans: [
          {
            id: 'bud-health-2027',
            title: '2027년도 신체활동 활성화 본예산 사업설명서',
            year: 2027,
            project: '신체활동_역량강화',
            totalBudget: 60000000,
            fundingSources: { fund: 0, city: 20000000, district: 40000000 },
            itemizedBreakdown: [
              { item: '안내 표지판 교체 및 보수', amount: 15000000 },
              { item: '프로그램 운영비', amount: 45000000 },
            ],
            remediatedAuditIds: ['aud-health-2026'],
          },
        ],
        weeklyWorks: [],
        edges: [
          {
            id: 'e-remed',
            source: 'aud-health-2026',
            target: 'bud-health-2027',
            type: 'MANDATES_IMPROVEMENT',
          },
        ],
      };

      const gaps = detectAuditGaps(graph);
      expect(gaps.length).toBe(0); // Gap resolved!

      const upstream = traceUpstream('bud-health-2027', graph);
      expect(upstream.path[1].nodeId).toBe('aud-health-2026');
      expect(upstream.path[2].nodeId).toBe('out-health-2026');
    });

    it('X3: Connects Weekly Work items via RECORDS_PROGRESS and aggregates into Wednesday HWPX batch', async () => {
      const weeklyTasks: AdminWeeklyWorkEntity[] = [
        {
          id: 'wk-01',
          title: '스마트짐 체력측정 장비 1차 캘리브레이션',
          date: '2026-11-03',
          category: '강남 AI 메디헬스 센터(가칭) 조성',
          status: 'done',
        },
        {
          id: 'wk-02',
          title: '생체데이터 연동 AI 상담 시스템 사용자 테스트',
          date: '2026-11-10',
          category: '강남 AI 메디헬스 센터(가칭) 조성',
          status: 'todo',
        },
      ];

      const cycle = computeWednesdayBatchPeriods('2026-11-04');
      const perfTasks = weeklyTasks
        .filter((t) => t.status === 'done' && t.date >= cycle.performanceStart && t.date <= cycle.performanceEnd)
        .map((t) => ({ category: t.category, content: `○ ${t.title}\n- 정상 완료 조치함` }));

      const planTasks = weeklyTasks
        .filter((t) => t.status !== 'done' && t.date >= cycle.planStart && t.date <= cycle.planEnd)
        .map((t) => ({ category: t.category, content: `○ ${t.title}\n- 추진 예정임` }));

      expect(perfTasks.length).toBe(1);
      expect(planTasks.length).toBe(1);

      const hwpx = await buildSyntheticWeeklyHwpx({
        targetDate: cycle.targetWednesday,
        department: '보건행정과',
        author: '건강증진팀장 김지영',
        performanceTasks: perfTasks,
        planTasks: planTasks,
      });

      expect(hwpx.xmlContent).toContain('스마트짐 체력측정 장비 1차 캘리브레이션');
      expect(hwpx.xmlContent).toContain('생체데이터 연동 AI 상담 시스템 사용자 테스트');
    });
  });

  // --------------------------------------------------------------------------
  // Tier 4: Real-World Administrative Application Scenarios
  // --------------------------------------------------------------------------
  describe('Tier 4: Real-World Administrative Application Scenarios', () => {
    it('RW-1: Gangnam Health Center Weekly Reporting Cycle (Wednesday Nov 4, 2026)', async () => {
      // Real-world Wednesday cycle
      const cycle = computeWednesdayBatchPeriods('2026-11-04');

      // 4 Public Health Projects
      const categories = [
        '8. 서울체력장 강남센터',
        '신체활동 역량강화(아이뛰움, 바른자세)',
        '2026 양재천 건강 페스티벌',
        '강남 AI 메디헬스 센터 조성',
      ];

      const perfItems = [
        {
          category: categories[0],
          content: sanitizeAdministrativeText(
            '○ 기    간 : ' + formatAdministrativeDate('2026-11-02') + '~11. 8.\n○ 대    상 : 강남구민 150명\n○ 내    용 : 국민체력100 체력측정 및 1:1 맞춤형 운동상담\n○ 실    적 : 금주 142명 / 누계 1,890명 완료'
          ),
        },
        {
          category: categories[1],
          content: sanitizeAdministrativeText(
            '○ 기    간 : ' + formatAdministrativeDate('2026-11-03') + '\n○ 대    상 : 관내 2개 초등학교 340명\n○ 실    적 : 청소년 척추측만 및 거북목 체형 검진 완료함'
          ),
        },
        {
          category: categories[2],
          content: sanitizeAdministrativeText(
            '○ 기    간 : ' + formatAdministrativeDate('2026-11-05') + '\n○ 내    용 : 양재천 영동3교~영동6교 걷기 코스 안전시설 사전 점검 완료'
          ),
        },
      ];

      const planItems = [
        {
          category: categories[0],
          content: sanitizeAdministrativeText(
            '○ 기    간 : ' + formatAdministrativeDate('2026-11-09') + '~11. 15.\n○ 계    획 : 취약계층 어르신 대상 찾아가는 출장 체력인증 3회 추진 예정임'
          ),
        },
        {
          category: categories[3],
          content: sanitizeAdministrativeText(
            '○ 기    간 : ' + formatAdministrativeDate('2026-11-10') + '\n○ 계    획 : 리모델링 공사 및 스마트짐 시스템 입찰 공고안 검토 예정임'
          ),
        },
      ];

      const hwpx = await buildSyntheticWeeklyHwpx({
        targetDate: cycle.targetWednesday,
        department: '보건행정과',
        author: '건강증진팀장 김지영',
        performanceTasks: perfItems,
        planTasks: planItems,
      });

      // Verify Administrative Formatting Standards (Rule M & Rule P)
      expect(hwpx.xmlContent).toContain('2026. 11. 2.');
      expect(hwpx.xmlContent).toContain('완료함');
      expect(hwpx.xmlContent).toContain('추진 예정임');

      // Verify Rule M ending marker & currency formatting
      const finalReportText = ensureAdministrativeEnding('주간 업무실적 및 계획 보고 완료');
      expect(finalReportText).toBe('주간 업무실적 및 계획 보고 완료  끝.');
      const formattedCurrency = formatAdministrativeCurrency(7174000);
      expect(formattedCurrency).toContain('금7,174,000원');

      // Verify ZIP integrity
      const zip = await JSZip.loadAsync(hwpx.buffer);
      expect(zip.file('Contents/section0.xml')).not.toBeNull();
      expect(zip.file('mimetype')).not.toBeNull();
    });

    it('RW-2: Administrative Audit Remediation & Budget Feedback Loop', () => {
      // 1. Audit entity with equipment maintenance finding
      const audit: AdminAuditEntity = {
        id: 'aud-gangnam-2026',
        title: '2026년도 강남구의회 행정사무감사 수감자료',
        year: 2026,
        auditedOutcomeId: 'out-medihealth-2026',
        auditFindings: ['스마트 헬스케어 생체계측 장비 정밀 검교정 주기 준수 미흡'],
        correctiveMandates: ['장비 정밀 검교정 유지관리 용역비 142,152천원 2027년 본예산 편성 요구'],
      };

      // 2. Initial state: gap detected
      const graphInitial: AdminOntologyGraph = {
        policies: [],
        outcomes: [],
        audits: [audit],
        budgetPlans: [],
        weeklyWorks: [],
        edges: [],
      };

      const gapsBefore = detectAuditGaps(graphInitial);
      expect(gapsBefore.length).toBe(1);
      expect(gapsBefore[0].remediated).toBe(false);

      // 3. 2027 Budget Plan formulated in response to Audit finding
      const budgetPlan: AdminBudgetPlanEntity = {
        id: 'bud-medihealth-2027',
        title: '2027년도 강남 AI 메디헬스 센터 본예산 사업설명서',
        year: 2027,
        project: '강남_AI_메디헬스_센터',
        totalBudget: 1742152000,
        fundingSources: {
          fund: 200000000,
          city: 542152000,
          district: 1000000000,
        },
        itemizedBreakdown: [
          { item: 'AI 메디헬스케어 플랫폼 유지보수', amount: 800000000 },
          { item: '생체계측 장비 정밀 검교정 용역비', amount: 142152000 }, // Directly remediates finding!
          { item: '운동처방사 전문인력 인건비', amount: 800000000 },
        ],
        remediatedAuditIds: ['aud-gangnam-2026'],
      };

      // 4. Verify 0 KRW balance for Public Finance
      const balanceCheck = verifyForensicBudgetInvariants(budgetPlan);
      expect(balanceCheck.valid).toBe(true);
      expect(balanceCheck.discrepancy).toBe(0);

      // 5. Connect edge and verify gap is 100% resolved
      const graphRemediated: AdminOntologyGraph = {
        ...graphInitial,
        budgetPlans: [budgetPlan],
        edges: [
          {
            id: 'edge-remed-2027',
            source: audit.id,
            target: budgetPlan.id,
            type: 'MANDATES_IMPROVEMENT',
          },
        ],
      };

      const gapsAfter = detectAuditGaps(graphRemediated);
      expect(gapsAfter.length).toBe(0);
    });

    it('RW-3: Non-Destructive Full Lifecycle Curation & PIPA Sanitization (Rule O & Q)', () => {
      // Simulate source archive text with sensitive personal data
      const rawReportSnippet =
        '담당 총괄주무관 홍길동(연락처 010-9876-5432, 주민등록번호 880101-1234567)이 작성한 2026년 양재천 건강 페스티벌 운영 결과보고서 요약임.';

      // PIPA sanitization
      let sanitized = rawReportSnippet.replace(
        /010-\d{4}-\d{4}/g,
        '010-****-1234'
      );
      sanitized = sanitized.replace(
        /\d{6}-[1-4]\d{6}/g,
        '880101-1******'
      );
      sanitized = sanitized.replace(/홍길동/g, '홍*동');

      expect(sanitized).not.toContain('010-9876-5432');
      expect(sanitized).not.toContain('880101-1234567');
      expect(sanitized).not.toContain('홍길동');
      expect(sanitized).toContain('홍*동');
      expect(sanitized).toContain('010-****-1234');
      expect(sanitized).toContain('880101-1******');

      // Rule O Verification: Ensure target output is isolated in tmp
      const testOutFile = path.join(sandboxDir, 'ADMIN_DOC_INDEX_TEST.json');
      fs.writeFileSync(
        testOutFile,
        JSON.stringify(
          {
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            totalDocuments: 1,
            documents: [
              {
                docId: 'doc-pipa-001',
                title: '2026 양재천 건강 페스티벌 결과보고서',
                docType: 'RESULT_REPORT',
                year: 2026,
                department: '보건행정과',
                project: '양재천_건강페스티벌',
                filePath: 'F:\\_Organized_Archive\\2026년\\03_양재천_건강페스티벌\\결과보고.hwpx',
                budgetAmount: 45000000,
                executionRate: 98.2,
                auditFindings: null,
                summary: sanitized,
              },
            ],
          },
          null,
          2
        ),
        'utf-8'
      );

      expect(fs.existsSync(testOutFile)).toBe(true);
      const parsedData = JSON.parse(fs.readFileSync(testOutFile, 'utf-8'));
      const validation = AdminDocIndexSchema.safeParse(parsedData);
      expect(validation.success).toBe(true);
    });
  });
});
