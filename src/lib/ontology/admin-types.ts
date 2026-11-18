/**
 * VITAL Work & Wealth Architecture — Administrative Document & Task Ontology Types
 * Requirements: R3 (Admin Ontology & Traversal), R1 (Weekly HWPX Bridge)
 * Standards: Rule O (Working Surface Immunity), Rule R (Zero-Error Budget Math), Rule Q (PIPA Sanitization)
 */

// ============================================================================
// 1. Semantic Edge Types & Administrative Stages
// ============================================================================

export type SemanticEdgeType =
  | 'IMPLEMENTS'
  | 'EVALUATES'
  | 'CRITIQUES'
  | 'MANDATES_IMPROVEMENT'
  | 'FEEDBACK_LOOP'
  | 'ALLOCATES_BUDGET'
  | 'RECORDS_PROGRESS';

export type AdminStage =
  | 'POLICY_DIRECTIVE' // 1단계: 방침서 (기본계획 / 추진계획)
  | 'OUTCOME_REPORT'    // 2단계: 결과보고서 (실적 / 정산)
  | 'AUDIT_REVIEW'     // 3단계: 행정사무감사 (시정·개선 요구)
  | 'BUDGET_PLAN'      // 4단계: 차년도 예산편성 사업설명서
  | 'WEEKLY_WORK';     // 연계: 주간업무 기록 (Requirement R1)

export const SEMANTIC_EDGE_LABELS: Record<SemanticEdgeType, string> = {
  IMPLEMENTS: '방침서 계획 실행 종결',
  EVALUATES: '목표 달성률 성과 평가',
  CRITIQUES: '사업운영 감사 지적 및 평가',
  MANDATES_IMPROVEMENT: '시정요구 예산 반영 의무화',
  FEEDBACK_LOOP: '전년도 집행실적 환류',
  ALLOCATES_BUDGET: '차년도 사업예산 배분 확정',
  RECORDS_PROGRESS: '주간 업무 진행상황 기록',
};

export const STAGE_LABELS: Record<AdminStage, string> = {
  POLICY_DIRECTIVE: '1단계: 방침서(추진계획)',
  OUTCOME_REPORT: '2단계: 결과보고서(추진실적)',
  AUDIT_REVIEW: '3단계: 행정사무감사(시정요구)',
  BUDGET_PLAN: '4단계: 차년도 예산편성 사업설명서',
  WEEKLY_WORK: '주간업무보고 기록',
};

export const STAGE_ORBIT_INDEX: Record<AdminStage, number> = {
  POLICY_DIRECTIVE: 1,
  OUTCOME_REPORT: 2,
  AUDIT_REVIEW: 3,
  BUDGET_PLAN: 4,
  WEEKLY_WORK: 2,
};

export const STAGE_COLORS: Record<AdminStage, { bg: string; text: string; border: string; hex: string }> = {
  POLICY_DIRECTIVE: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    hex: '#0055FF',
  },
  OUTCOME_REPORT: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    hex: '#00CC44',
  },
  AUDIT_REVIEW: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    hex: '#FF0044',
  },
  BUDGET_PLAN: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    hex: '#8800FF',
  },
  WEEKLY_WORK: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    hex: '#FF6600',
  },
};

// ============================================================================
// 2. 4-Phase Lifecycle Entity Models
// ============================================================================

/**
 * 1단계: 방침서 엔티티 (Policy Directive)
 */
export interface AdminPolicyEntity {
  id: string;
  title: string;
  year: number;
  department: string;
  project: string;
  budgetAmount: number;
  objectives: string[];

  // 메타데이터 및 확장 필드
  stage?: 'POLICY_DIRECTIVE';
  docId?: string;
  projectId?: string;
  projectKey?: string;
  approvalDate?: string;
  drafter?: string;
  approver?: string;
  statutoryBasis?: string[];
  purpose?: string;
  targetQuotas?: Array<{
    kpi: string;
    targetValue: number;
    unit: string;
  }>;
  budgetCeiling?: {
    total: number;
    fund: number;
    city: number;
    district: number;
  };
  sourceDocPath?: string;
}

/**
 * 2단계: 결과보고서 엔티티 (Outcome Report)
 */
export interface AdminOutcomeEntity {
  id: string;
  policyId: string;
  title: string;
  year: number;
  executionRate: number;
  achievements: string[];
  spentBudget: number;

  // 메타데이터 및 확장 필드
  stage?: 'OUTCOME_REPORT';
  docId?: string;
  projectId?: string;
  projectKey?: string;
  reportDate?: string;
  achievementMetrics?: Array<{
    kpi: string;
    targetValue: number;
    actualValue: number;
    achievementRate: number;
    unit: string;
  }>;
  budgetExecution?: {
    allocated: number;
    spent: number;
    balance: number;
    executionRate: number;
    dailyExpenseSpent?: number;
    generalSpent?: number;
  };
  keyAchievements?: string[];
  difficultiesAndImprovements?: string[];
  sourceDocPath?: string;
}

/**
 * 3단계: 행정사무감사 엔티티 (Audit Review)
 */
export interface AdminAuditEntity {
  id: string;
  title: string;
  year: number;
  auditedOutcomeId: string;
  auditFindings: string[];
  correctiveMandates: string[];

  // 메타데이터 및 확장 필드
  stage?: 'AUDIT_REVIEW';
  relatedPolicyId?: string;
  docId?: string;
  projectId?: string;
  projectKey?: string;
  docRegNum?: string;
  auditYear?: number;
  auditCategory?: 'COUNCIL_AUDIT' | 'INTERNAL_AUDIT' | 'JOINT_INSPECTION' | string;
  auditOrg?: string;
  critiqueTitle?: string;
  critiqueContent?: string;
  severity?: 'CRITICAL' | 'WARNING' | 'RECOMMENDATION' | 'HIGH' | 'MEDIUM';
  actionRequired?: string;
  actionPlan?: string;
  actionStatus?: 'COMPLETED' | 'IN_PROGRESS' | 'PLANNED';
  sourceDocPath?: string;
}

/**
 * 4단계: 차년도 예산편성 사업설명서 엔티티 (Budget Plan)
 */
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

  // 메타데이터 및 확장 필드
  stage?: 'BUDGET_PLAN';
  docId?: string;
  projectId?: string;
  projectKey?: string;
  fiscalYear?: number;
  policyProject?: string;
  unitProject?: string;
  detailedProject?: string;
  docRegNum?: string;
  fundingSplits?: Array<{
    source: '기금' | '시비' | '구비' | string;
    amount: number;
  }>;
  prevYearBudget?: number;
  prevYearExecutionRate?: number;
  budgetDeltaReason?: string;
  auditReflections?: Array<{
    auditId: string;
    reflectedChanges: string;
    isAuditAddressed: boolean;
  }>;
  detailedCalculations?: Array<{
    statItem: string;
    calculation: string;
    amount: number;
  }>;
  sourceDocPath?: string;
}

/**
 * 연계 엔티티: 주간업무 기록 (Weekly Work Entry - Requirement R1 브릿지)
 */
export interface AdminWeeklyWorkEntity {
  id: string;
  title: string;
  date: string;
  category: string;
  status: 'done' | 'in-progress' | 'todo';
  relatedPolicyId?: string;
  relatedProjectId?: string;

  // 메타데이터 및 확장 필드
  stage?: 'WEEKLY_WORK';
  docId?: string;
  projectId?: string;
  projectKey?: string;
  weekNumber?: number;
  year?: number;
  period?: string;
  submissionDate?: string;
  pastWeekTasks?: string[];
  currentWeekTasks?: string[];
  futureWeekTasks?: string[];
  linkedEntityIds?: {
    policyId?: string;
    outcomeId?: string;
    auditId?: string;
    budgetPlanId?: string;
  };
  sourceDocPath?: string;
}

export type AdminEntity =
  | AdminPolicyEntity
  | AdminOutcomeEntity
  | AdminAuditEntity
  | AdminBudgetPlanEntity
  | AdminWeeklyWorkEntity;

// ============================================================================
// 3. Graph, Relation, Traversal & Audit Gap Models
// ============================================================================

export interface AdminOntologyEdge {
  id: string;
  source: string;
  target: string;
  type: SemanticEdgeType;
  description?: string;
  label?: string;
  weight?: number;
}

export interface AdminOntologyGraph {
  policies: AdminPolicyEntity[];
  outcomes: AdminOutcomeEntity[];
  audits: AdminAuditEntity[];
  budgetPlans: AdminBudgetPlanEntity[];
  weeklyWorks: AdminWeeklyWorkEntity[];
  edges: AdminOntologyEdge[];
  metadata?: {
    totalProjects?: number;
    totalNodes?: number;
    totalEdges?: number;
    ruleCompliance?: string[];
    [key: string]: unknown;
  };
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

export interface AdminOntologySummaryStats {
  totalNodes: number;
  totalPolicies: number;
  totalOutcomes: number;
  totalAudits: number;
  totalBudgetPlans: number;
  totalWeeklyWorks: number;
  totalEdges: number;
  totalGaps: number;
  totalBudgetKrw: number;
}

// ============================================================================
// 4. Type Guards
// ============================================================================

export function isPolicyEntity(node: AdminEntity): node is AdminPolicyEntity {
  return 'budgetAmount' in node && 'objectives' in node;
}

export function isOutcomeEntity(node: AdminEntity): node is AdminOutcomeEntity {
  return 'policyId' in node && 'executionRate' in node;
}

export function isAuditEntity(node: AdminEntity): node is AdminAuditEntity {
  return 'auditedOutcomeId' in node && 'auditFindings' in node;
}

export function isBudgetPlanEntity(node: AdminEntity): node is AdminBudgetPlanEntity {
  return 'totalBudget' in node && 'fundingSources' in node;
}

export function isWeeklyWorkEntity(node: AdminEntity): node is AdminWeeklyWorkEntity {
  return 'category' in node && 'status' in node && !('totalBudget' in node);
}

export function getNodeStage(node: AdminEntity): AdminStage {
  if (node.stage) return node.stage;
  if (isPolicyEntity(node)) return 'POLICY_DIRECTIVE';
  if (isOutcomeEntity(node)) return 'OUTCOME_REPORT';
  if (isAuditEntity(node)) return 'AUDIT_REVIEW';
  if (isBudgetPlanEntity(node)) return 'BUDGET_PLAN';
  return 'WEEKLY_WORK';
}
