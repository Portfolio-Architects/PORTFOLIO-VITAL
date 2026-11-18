/**
 * VITAL Work & Wealth Architecture — Admin Ontology to Canvas Engine Adapter
 * Requirements: R3 (Admin Ontology & Traversal), Zero-Allocation 60fps Compatibility
 * Converts AdminOntologyGraph into OntologyNode[] and OntologyEdge[] for OntologyCanvasEngine
 */

import {
  OntologyNode,
  OntologyEdge,
  OntologyGraph,
  EdgeType,
} from '@/lib/ontology.types';
import {
  AdminOntologyGraph,
  SemanticEdgeType,
  AdminStage,
  STAGE_ORBIT_INDEX,
  STAGE_COLORS,
} from './admin-types';

export interface ToAdminGraphOptions {
  filterProject?: string;
  filterStage?: AdminStage;
  includeWeeklyWork?: boolean;
  synthesizeProjectCenter?: boolean;
}

/**
 * Maps semantic administrative edge types to OntologyCanvasEngine edge types and physics weights.
 */
export function mapSemanticEdge(type: SemanticEdgeType): { type: EdgeType; weight: number } {
  switch (type) {
    case 'IMPLEMENTS':
      return { type: 'CAUSAL_DRIVE', weight: 1.0 };
    case 'EVALUATES':
      return { type: 'DEPENDENCY', weight: 0.9 };
    case 'CRITIQUES':
      return { type: 'BOTTLENECK', weight: -0.6 };
    case 'MANDATES_IMPROVEMENT':
      return { type: 'DECOUPLING', weight: 0.95 };
    case 'FEEDBACK_LOOP':
      return { type: 'FEEDBACK_LOOP', weight: 0.8 };
    case 'ALLOCATES_BUDGET':
      return { type: 'BUDGET_SOURCE', weight: 1.0 };
    case 'RECORDS_PROGRESS':
      return { type: 'COMPONENTS', weight: 0.7 };
    default:
      return { type: 'DEPENDENCY', weight: 0.5 };
  }
}

/**
 * Converts AdminOntologyGraph into an OntologyGraph compatible with OntologyCanvasEngine.
 */
export function toAdminGraph(
  adminGraph: AdminOntologyGraph,
  options: ToAdminGraphOptions = {}
): OntologyGraph {
  const {
    filterProject,
    filterStage,
    includeWeeklyWork = true,
    synthesizeProjectCenter = false,
  } = options;

  const nodes: OntologyNode[] = [];
  const nodeIds = new Set<string>();

  // Center node synthesis (Orbit 0)
  if (synthesizeProjectCenter && filterProject) {
    const centerId = `CENTER-${filterProject}`;
    nodes.push({
      id: centerId,
      label: filterProject.replace(/^[0-9]+_/, '').replace(/_/g, ' '),
      group: 'CORE_PROJECT',
      baseValue: 100,
      customColor: '#FFFFFF',
      customOrbitIndex: 0,
      layerId: 0,
      meta: {
        isCenterNode: true,
        projectKey: filterProject,
      },
    });
    nodeIds.add(centerId);
  }

  // 1. Policy Directive Nodes (Orbit 1)
  if (!filterStage || filterStage === 'POLICY_DIRECTIVE') {
    for (const p of adminGraph.policies) {
      if (filterProject && p.project && !p.project.includes(filterProject)) continue;
      if (nodeIds.has(p.id)) continue;

      nodes.push({
        id: p.id,
        label: p.title,
        group: 'CORE_PROJECT',
        baseValue: 85,
        layerId: 3, // Knowledge / Policy
        customColor: STAGE_COLORS.POLICY_DIRECTIVE.hex,
        customOrbitIndex: STAGE_ORBIT_INDEX.POLICY_DIRECTIVE,
        meta: {
          ...p,
          stage: 'POLICY_DIRECTIVE',
          stageLabel: '1단계: 방침서',
          budget: p.budgetAmount,
        },
      });
      nodeIds.add(p.id);
    }
  }

  // 2. Outcome Report Nodes (Orbit 2)
  if (!filterStage || filterStage === 'OUTCOME_REPORT') {
    for (const o of adminGraph.outcomes) {
      if (nodeIds.has(o.id)) continue;

      nodes.push({
        id: o.id,
        label: o.title,
        group: 'MACRO_RESEARCH',
        baseValue: 80,
        layerId: 2, // Execution / Work
        customColor: STAGE_COLORS.OUTCOME_REPORT.hex,
        customOrbitIndex: STAGE_ORBIT_INDEX.OUTCOME_REPORT,
        meta: {
          ...o,
          stage: 'OUTCOME_REPORT',
          stageLabel: '2단계: 결과보고서',
          executionRate: o.executionRate,
          spentBudget: o.spentBudget,
        },
      });
      nodeIds.add(o.id);
    }
  }

  // 3. Administrative Audit Nodes (Orbit 3)
  if (!filterStage || filterStage === 'AUDIT_REVIEW') {
    for (const a of adminGraph.audits) {
      if (nodeIds.has(a.id)) continue;

      nodes.push({
        id: a.id,
        label: a.title,
        group: 'SYSTEM_RISK',
        baseValue: 90,
        layerId: 3, // Knowledge / Audit
        customColor: STAGE_COLORS.AUDIT_REVIEW.hex,
        customOrbitIndex: STAGE_ORBIT_INDEX.AUDIT_REVIEW,
        meta: {
          ...a,
          stage: 'AUDIT_REVIEW',
          stageLabel: '3단계: 행정사무감사',
          findings: a.auditFindings,
          mandates: a.correctiveMandates,
        },
      });
      nodeIds.add(a.id);
    }
  }

  // 4. Budget Plan Nodes (Orbit 4)
  if (!filterStage || filterStage === 'BUDGET_PLAN') {
    for (const b of adminGraph.budgetPlans) {
      if (filterProject && b.project && !b.project.includes(filterProject)) continue;
      if (nodeIds.has(b.id)) continue;

      nodes.push({
        id: b.id,
        label: b.title,
        group: 'DCF_MODELING',
        baseValue: 85,
        layerId: 1, // Resource / Budget
        customColor: STAGE_COLORS.BUDGET_PLAN.hex,
        customOrbitIndex: STAGE_ORBIT_INDEX.BUDGET_PLAN,
        meta: {
          ...b,
          stage: 'BUDGET_PLAN',
          stageLabel: '4단계: 차년도 사업설명서',
          totalBudget: b.totalBudget,
          remediatedAuditIds: b.remediatedAuditIds,
        },
      });
      nodeIds.add(b.id);
    }
  }

  // 5. Weekly Work Nodes (Orbit 2)
  if (includeWeeklyWork && (!filterStage || filterStage === 'WEEKLY_WORK')) {
    for (const w of adminGraph.weeklyWorks) {
      if (nodeIds.has(w.id)) continue;

      nodes.push({
        id: w.id,
        label: w.title,
        group: 'DATA_PIPELINE',
        baseValue: 70,
        layerId: 2, // Execution / Work
        customColor: STAGE_COLORS.WEEKLY_WORK.hex,
        customOrbitIndex: STAGE_ORBIT_INDEX.WEEKLY_WORK,
        meta: {
          ...w,
          stage: 'WEEKLY_WORK',
          stageLabel: '주간업무보고 기록',
          date: w.date,
          status: w.status,
        },
      });
      nodeIds.add(w.id);
    }
  }

  // Convert Edges (filtering out orphan edges)
  const edges: OntologyEdge[] = [];
  const edgeKeys = new Set<string>();

  for (const e of adminGraph.edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
      continue; // Skip orphan edges
    }

    const key = `${e.source}->${e.target}:${e.type}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);

    const mapped = mapSemanticEdge(e.type);
    edges.push({
      source: e.source,
      target: e.target,
      type: mapped.type,
      weight: e.weight ?? mapped.weight,
    });
  }

  // If center node exists, connect to top-level policy nodes
  if (synthesizeProjectCenter && filterProject) {
    const centerId = `CENTER-${filterProject}`;
    for (const p of adminGraph.policies) {
      if (nodeIds.has(p.id)) {
        edges.push({
          source: centerId,
          target: p.id,
          type: 'CAUSAL_DRIVE',
          weight: 1.0,
        });
      }
    }
  }

  return { nodes, edges };
}
