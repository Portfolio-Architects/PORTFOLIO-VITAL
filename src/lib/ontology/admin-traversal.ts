/**
 * VITAL Work & Wealth Architecture — Bidirectional Administrative Traversal Engine
 * Requirements: R3 (Admin Ontology & Traversal)
 * Standards: Rule O (Working Surface Immunity), Rule R (Zero-Error Budget Math)
 */

import {
  AdminOntologyGraph,
  AdminCausalChain,
  AdminAuditGap,
  SemanticEdgeType,
  AdminEntity,
  AdminStage,
  AdminOntologySummaryStats,
} from './admin-types';

/**
 * Finds any administrative node by its unique ID across all 5 entity collections.
 */
export function findNodeById(graph: AdminOntologyGraph, id: string): AdminEntity | null {
  const policy = graph.policies.find((p) => p.id === id);
  if (policy) return policy;

  const outcome = graph.outcomes.find((o) => o.id === id);
  if (outcome) return outcome;

  const audit = graph.audits.find((a) => a.id === id);
  if (audit) return audit;

  const budget = graph.budgetPlans.find((b) => b.id === id);
  if (budget) return budget;

  const weekly = graph.weeklyWorks.find((w) => w.id === id);
  if (weekly) return weekly;

  return null;
}

/**
 * 상향 역추적 (Upstream Trace)
 * Traverses backwards from BudgetPlan, Audit, Outcome, or WeeklyWork up to the originating Policy.
 *
 * @param nodeId Starting node identifier (e.g. BGT-2027-xxx, AUD-2026-xxx, OUT-2026-xxx, WRK-2026-xxx)
 * @param graph Complete administrative ontology graph
 * @returns Ordered chain from starting node upstream to root policy and edge sequence
 */
export function traceUpstream(nodeId: string, graph: AdminOntologyGraph): AdminCausalChain {
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
    const weekly = graph.weeklyWorks.find((w) => w.id === currentId);

    if (policy) {
      chain.push({ nodeId: policy.id, nodeType: 'POLICY', title: policy.title });
      break; // Reached upstream root policy
    } else if (outcome) {
      chain.push({ nodeId: outcome.id, nodeType: 'OUTCOME', title: outcome.title });
      // In graph edges, source might be policy and target outcome (or vice versa depending on direction)
      const inEdge = graph.edges.find(
        (e) => (e.target === currentId && e.type === 'IMPLEMENTS') ||
               (e.source === currentId && e.type === 'IMPLEMENTS')
      );
      if (inEdge && inEdge.target === currentId) {
        edgeSequence.push('IMPLEMENTS');
        currentId = inEdge.source;
      } else if (inEdge && inEdge.source === currentId) {
        edgeSequence.push('IMPLEMENTS');
        currentId = inEdge.target;
      } else {
        currentId = outcome.policyId || null;
        if (currentId) edgeSequence.push('IMPLEMENTS');
      }
    } else if (audit) {
      chain.push({ nodeId: audit.id, nodeType: 'AUDIT', title: audit.title });
      // Look for edge connecting to outcome
      const inEdge = graph.edges.find(
        (e) => (e.target === currentId && (e.type === 'EVALUATES' || e.type === 'CRITIQUES')) ||
               (e.source === currentId && (e.type === 'EVALUATES' || e.type === 'CRITIQUES'))
      );
      if (inEdge && inEdge.target === currentId) {
        edgeSequence.push(inEdge.type);
        currentId = inEdge.source;
      } else if (inEdge && inEdge.source === currentId) {
        edgeSequence.push(inEdge.type);
        currentId = inEdge.target;
      } else {
        currentId = audit.auditedOutcomeId || null;
        if (currentId) edgeSequence.push('EVALUATES');
      }
    } else if (budget) {
      chain.push({ nodeId: budget.id, nodeType: 'BUDGET_PLAN', title: budget.title });
      // Look for edge connecting to audit
      const inEdge = graph.edges.find(
        (e) => (e.target === currentId && e.type === 'MANDATES_IMPROVEMENT') ||
               (e.source === currentId && e.type === 'MANDATES_IMPROVEMENT')
      );
      if (inEdge && inEdge.target === currentId) {
        edgeSequence.push('MANDATES_IMPROVEMENT');
        currentId = inEdge.source;
      } else if (inEdge && inEdge.source === currentId) {
        edgeSequence.push('MANDATES_IMPROVEMENT');
        currentId = inEdge.target;
      } else if (budget.remediatedAuditIds && budget.remediatedAuditIds.length > 0) {
        edgeSequence.push('MANDATES_IMPROVEMENT');
        currentId = budget.remediatedAuditIds[0];
      } else {
        currentId = null;
      }
    } else if (weekly) {
      chain.push({ nodeId: weekly.id, nodeType: 'WEEKLY_WORK', title: weekly.title });
      const inEdge = graph.edges.find(
        (e) => (e.target === currentId && e.type === 'RECORDS_PROGRESS') ||
               (e.source === currentId && e.type === 'RECORDS_PROGRESS')
      );
      if (inEdge && inEdge.target === currentId) {
        edgeSequence.push('RECORDS_PROGRESS');
        currentId = inEdge.source;
      } else if (inEdge && inEdge.source === currentId) {
        edgeSequence.push('RECORDS_PROGRESS');
        currentId = inEdge.target;
      } else if (weekly.relatedPolicyId) {
        edgeSequence.push('RECORDS_PROGRESS');
        currentId = weekly.relatedPolicyId;
      } else {
        currentId = null;
      }
    } else {
      break;
    }
  }

  return { originId: nodeId, path: chain, edges: edgeSequence };
}

/**
 * 하향 순추적 (Downstream Trace)
 * Traverses forward from Policy through Outcome and Audit to Next-Year BudgetPlan.
 *
 * @param nodeId Starting node identifier (e.g. POL-2026-xxx)
 * @param graph Complete administrative ontology graph
 * @returns Ordered chain from root policy downstream to leaf budget plan and edge sequence
 */
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
      const outEdge = graph.edges.find(
        (e) => (e.source === currentId && e.type === 'IMPLEMENTS') ||
               (e.target === currentId && e.type === 'IMPLEMENTS')
      );
      if (outEdge && outEdge.source === currentId) {
        edgeSequence.push('IMPLEMENTS');
        currentId = outEdge.target;
      } else if (outEdge && outEdge.target === currentId) {
        edgeSequence.push('IMPLEMENTS');
        currentId = outEdge.source;
      } else {
        const matchingOutcome = graph.outcomes.find((o) => o.policyId === currentId);
        currentId = matchingOutcome ? matchingOutcome.id : null;
        if (currentId) edgeSequence.push('IMPLEMENTS');
      }
    } else if (outcome) {
      chain.push({ nodeId: outcome.id, nodeType: 'OUTCOME', title: outcome.title });
      const outEdge = graph.edges.find(
        (e) => (e.source === currentId && (e.type === 'EVALUATES' || e.type === 'CRITIQUES')) ||
               (e.target === currentId && (e.type === 'EVALUATES' || e.type === 'CRITIQUES'))
      );
      if (outEdge && outEdge.source === currentId) {
        edgeSequence.push(outEdge.type);
        currentId = outEdge.target;
      } else if (outEdge && outEdge.target === currentId) {
        edgeSequence.push(outEdge.type);
        currentId = outEdge.source;
      } else {
        const matchingAudit = graph.audits.find((a) => a.auditedOutcomeId === currentId);
        currentId = matchingAudit ? matchingAudit.id : null;
        if (currentId) edgeSequence.push('EVALUATES');
      }
    } else if (audit) {
      chain.push({ nodeId: audit.id, nodeType: 'AUDIT', title: audit.title });
      const outEdge = graph.edges.find(
        (e) => (e.source === currentId && e.type === 'MANDATES_IMPROVEMENT') ||
               (e.target === currentId && e.type === 'MANDATES_IMPROVEMENT')
      );
      if (outEdge && outEdge.source === currentId) {
        edgeSequence.push('MANDATES_IMPROVEMENT');
        currentId = outEdge.target;
      } else if (outEdge && outEdge.target === currentId) {
        edgeSequence.push('MANDATES_IMPROVEMENT');
        currentId = outEdge.source;
      } else {
        const matchingBudget = graph.budgetPlans.find((b) =>
          b.remediatedAuditIds?.includes(currentId!)
        );
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
 * 감사 미반영 누락 감지 (Audit Gap Detector)
 * Detects audit findings and corrective mandates that have no corresponding remediation
 * or zero budget allocation in subsequent budget plans.
 *
 * @param graph Complete administrative ontology graph
 * @returns Array of detected audit gaps
 */
export function detectAuditGaps(graph: AdminOntologyGraph): AdminAuditGap[] {
  const gaps: AdminAuditGap[] = [];

  for (const audit of graph.audits) {
    const mandates =
      audit.correctiveMandates && audit.correctiveMandates.length > 0
        ? audit.correctiveMandates
        : (audit.auditFindings && audit.auditFindings.length > 0
            ? audit.auditFindings
            : ['시정·개선 처분 요구사항 미기재']);

    for (const mandate of mandates) {
      // Find edge or remediation link
      const mandateEdge = graph.edges.find(
        (e) =>
          (e.source === audit.id || e.target === audit.id) &&
          e.type === 'MANDATES_IMPROVEMENT'
      );

      const targetBudgetId = mandateEdge
        ? (mandateEdge.source === audit.id ? mandateEdge.target : mandateEdge.source)
        : null;

      const remediatingBudget = graph.budgetPlans.find(
        (b) =>
          b.remediatedAuditIds?.includes(audit.id) ||
          (targetBudgetId !== null && b.id === targetBudgetId)
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
        const alloc = remediatingBudget.itemizedBreakdown?.reduce(
          (sum, it) => sum + (it.amount || 0),
          0
        ) ?? 0;

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
 * Searches across all administrative nodes in the graph using keyword tokens.
 */
export function searchAdminNodes(
  graph: AdminOntologyGraph,
  query: string
): Array<{ node: AdminEntity; stage: AdminStage; matchReason: string }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: Array<{ node: AdminEntity; stage: AdminStage; matchReason: string }> = [];

  const testMatch = (node: AdminEntity, stage: AdminStage) => {
    let reason = '';
    if (node.id.toLowerCase().includes(q)) {
      reason = `ID 일치 (${node.id})`;
    } else if (node.title.toLowerCase().includes(q)) {
      reason = `제목 일치 (${node.title})`;
    } else if ('project' in node && node.project && node.project.toLowerCase().includes(q)) {
      reason = `사업명 일치 (${node.project})`;
    } else if ('department' in node && node.department && node.department.toLowerCase().includes(q)) {
      reason = `부서명 일치 (${node.department})`;
    } else if ('objectives' in node && node.objectives?.some((o) => o.toLowerCase().includes(q))) {
      reason = '사업목표 키워드 일치';
    } else if ('auditFindings' in node && node.auditFindings?.some((f) => f.toLowerCase().includes(q))) {
      reason = '감사지적사항 키워드 일치';
    } else if ('itemizedBreakdown' in node && node.itemizedBreakdown?.some((i) => i.item.toLowerCase().includes(q))) {
      reason = '예산세부내역 키워드 일치';
    }

    if (reason) {
      results.push({ node, stage, matchReason: reason });
    }
  };

  for (const p of graph.policies) testMatch(p, 'POLICY_DIRECTIVE');
  for (const o of graph.outcomes) testMatch(o, 'OUTCOME_REPORT');
  for (const a of graph.audits) testMatch(a, 'AUDIT_REVIEW');
  for (const b of graph.budgetPlans) testMatch(b, 'BUDGET_PLAN');
  for (const w of graph.weeklyWorks) testMatch(w, 'WEEKLY_WORK');

  return results;
}

/**
 * Computes administrative ontology statistics.
 */
export function calculateOntologyStats(graph: AdminOntologyGraph): AdminOntologySummaryStats {
  const totalPolicies = graph.policies.length;
  const totalOutcomes = graph.outcomes.length;
  const totalAudits = graph.audits.length;
  const totalBudgetPlans = graph.budgetPlans.length;
  const totalWeeklyWorks = graph.weeklyWorks.length;
  const totalNodes =
    totalPolicies + totalOutcomes + totalAudits + totalBudgetPlans + totalWeeklyWorks;
  const totalEdges = graph.edges.length;
  const gaps = detectAuditGaps(graph);

  const totalBudgetKrw = graph.budgetPlans.reduce((sum, b) => sum + (b.totalBudget || 0), 0);

  return {
    totalNodes,
    totalPolicies,
    totalOutcomes,
    totalAudits,
    totalBudgetPlans,
    totalWeeklyWorks,
    totalEdges,
    totalGaps: gaps.length,
    totalBudgetKrw,
  };
}
