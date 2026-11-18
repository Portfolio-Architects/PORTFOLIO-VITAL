/**
 * VITAL Work & Wealth Architecture — Admin Ontology REST API Route
 * Requirements: R3 (Admin Ontology & Traversal)
 * Standards: Rule O (Working Surface Immunity), Rule R (Zero-Error Budget Math), Rule Q (PIPA Sanitization)
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
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
import {
  buildCrossDomainRegistry,
  buildProjectBundle,
  clearCrossDomainCache,
} from '@/lib/ontology/cross-domain-builder';

const execFileAsync = promisify(execFile);

const SEED_FILE_PATH = path.join(process.cwd(), 'data', 'SEED_ONTOLOGY_DOCS.json');

interface CachedGraph {
  mtimeMs: number;
  graph: AdminOntologyGraph;
}

let cachedGraph: CachedGraph | null = null;

/**
 * Invalidates in-memory ontology graph and cross-domain caches.
 * Exported for explicit cache resets and unit tests.
 */
export function invalidateOntologyCache(): void {
  cachedGraph = null;
  clearCrossDomainCache();
}

/**
 * Loads and normalizes AdminOntologyGraph from data/SEED_ONTOLOGY_DOCS.json with hot cache.
 */
export function loadAdminOntologyGraph(): AdminOntologyGraph {
  try {
    if (!fs.existsSync(SEED_FILE_PATH)) {
      return {
        policies: [],
        outcomes: [],
        audits: [],
        budgetPlans: [],
        weeklyWorks: [],
        edges: [],
      };
    }

    const stat = fs.statSync(SEED_FILE_PATH);
    if (cachedGraph && cachedGraph.mtimeMs === stat.mtimeMs) {
      return cachedGraph.graph;
    }

    const raw = JSON.parse(fs.readFileSync(SEED_FILE_PATH, 'utf8'));

    const rawEntities = raw.entities || {};

    const policies: AdminPolicyEntity[] = (rawEntities.policies || []).map((p: any) => ({
      ...p,
      stage: 'POLICY_DIRECTIVE',
      project: p.project || p.projectKey || '신체활동_건강생활실천',
      department: p.department || '보건행정과',
      budgetAmount: p.budgetAmount ?? p.budgetCeiling?.total ?? 0,
      objectives: Array.isArray(p.objectives)
        ? p.objectives
        : ['구민 건강증진 및 신체활동 활성화'],
    }));

    const outcomes: AdminOutcomeEntity[] = (rawEntities.outcomes || []).map((o: any) => ({
      ...o,
      stage: 'OUTCOME_REPORT',
      policyId: o.policyId || 'POL-2026-001',
      executionRate: typeof o.executionRate === 'number' ? o.executionRate : 100,
      spentBudget: o.spentBudget ?? o.budgetExecution?.spent ?? 0,
      achievements: Array.isArray(o.achievements)
        ? o.achievements
        : ['사업목표 달성 및 구민 건강만족도 제고'],
    }));

    const audits: AdminAuditEntity[] = (rawEntities.audits || []).map((a: any) => ({
      ...a,
      stage: 'AUDIT_REVIEW',
      year: a.year ?? a.auditYear ?? 2026,
      auditedOutcomeId: a.auditedOutcomeId || 'OUT-2026-004',
      auditFindings: Array.isArray(a.auditFindings)
        ? a.auditFindings
        : (a.findings || ['사업운영 관리체계 보완 요구']),
      correctiveMandates: Array.isArray(a.correctiveMandates)
        ? a.correctiveMandates
        : (a.mandates || a.auditFindings || ['차년도 사업설명서 분리 명기']),
    }));

    const budgetPlans: AdminBudgetPlanEntity[] = (rawEntities.budgetPlans || []).map((b: any) => ({
      ...b,
      stage: 'BUDGET_PLAN',
      year: b.year ?? b.fiscalYear ?? 2027,
      project: b.project || b.projectKey || '보건소_기능유지_청사관리',
      totalBudget: typeof b.totalBudget === 'number' ? b.totalBudget : 0,
      fundingSources: b.fundingSources || {
        fund: 0,
        city: 0,
        district: b.totalBudget || 0,
      },
      itemizedBreakdown: Array.isArray(b.itemizedBreakdown)
        ? b.itemizedBreakdown
        : [{ item: '프로그램 운영비', amount: b.totalBudget || 0 }],
      remediatedAuditIds: Array.isArray(b.remediatedAuditIds) ? b.remediatedAuditIds : [],
    }));

    const weeklyWorks: AdminWeeklyWorkEntity[] = (rawEntities.weeklyWorks || []).map((w: any) => ({
      ...w,
      stage: 'WEEKLY_WORK',
      status: w.status || 'done',
      date: w.date || w.submissionDate || '2026-11-04',
      category: w.category || w.projectKey || '신체활동_건강생활실천',
    }));

    // Edges normalization
    const edges: AdminOntologyEdge[] = [];
    const edgeSet = new Set<string>();

    const addEdge = (
      id: string,
      source: string,
      target: string,
      type: SemanticEdgeType,
      label?: string
    ) => {
      const key = `${source}->${target}:${type}`;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      edges.push({ id, source, target, type, label });
    };

    if (Array.isArray(raw.edges)) {
      for (const e of raw.edges) {
        addEdge(e.id || `edge-${edges.length + 1}`, e.source, e.target, e.type, e.label);
      }
    }

    if (Array.isArray(raw.relations)) {
      for (const r of raw.relations) {
        addEdge(
          `rel-${edges.length + 1}`,
          r.sourceId,
          r.targetId,
          r.relationType,
          r.label || r.description
        );
      }
    }

    // Connect outcomes to policies
    for (const o of outcomes) {
      if (o.policyId) {
        addEdge(`edge-auto-${edges.length + 1}`, o.policyId, o.id, 'IMPLEMENTS');
      }
    }

    // Connect audits to outcomes
    for (const a of audits) {
      if (a.auditedOutcomeId) {
        addEdge(`edge-auto-${edges.length + 1}`, o_target_id(a.auditedOutcomeId), a.id, 'CRITIQUES');
      }
    }

    function o_target_id(id: string) {
      return id;
    }

    // Connect budgetPlans to audits
    for (const b of budgetPlans) {
      if (b.remediatedAuditIds && b.remediatedAuditIds.length > 0) {
        for (const audId of b.remediatedAuditIds) {
          addEdge(`edge-auto-${edges.length + 1}`, audId, b.id, 'MANDATES_IMPROVEMENT');
        }
      }
    }

    // Connect weeklyWorks to policies
    for (const w of weeklyWorks) {
      if (w.relatedPolicyId) {
        addEdge(`edge-auto-${edges.length + 1}`, w.id, w.relatedPolicyId, 'RECORDS_PROGRESS');
      }
    }

    const graph: AdminOntologyGraph = {
      policies,
      outcomes,
      audits,
      budgetPlans,
      weeklyWorks,
      edges,
      metadata: raw.metadata,
    };

    cachedGraph = { mtimeMs: stat.mtimeMs, graph };
    return graph;
  } catch (error) {
    console.error('[API ADMIN-ONTOLOGY ERROR] Failed to load seed graph:', error);
    return {
      policies: [],
      outcomes: [],
      audits: [],
      budgetPlans: [],
      weeklyWorks: [],
      edges: [],
    };
  }
}

export async function GET(request: Request | any) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'graph';
    const graph = loadAdminOntologyGraph();

    if (action === 'graph') {
      const stats = calculateOntologyStats(graph);
      return NextResponse.json({
        success: true,
        graph,
        stats,
      });
    }

    if (action === 'cross-join') {
      const projectKey = searchParams.get('projectKey');
      if (projectKey) {
        const bundle = await buildProjectBundle(projectKey, graph);
        if (!bundle) {
          return NextResponse.json(
            { success: false, error: `Project bundle not found for key: ${projectKey}` },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          projectKey,
          data: bundle,
        });
      }

      const registry = await buildCrossDomainRegistry(graph);
      return NextResponse.json({
        success: true,
        data: registry,
        totalProjects: Object.keys(registry).length,
      });
    }

    if (action === 'trace') {
      const nodeId = searchParams.get('nodeId');
      const direction = searchParams.get('direction') || 'upstream';

      if (!nodeId) {
        return NextResponse.json(
          { success: false, error: 'Missing required query parameter: nodeId' },
          { status: 400 }
        );
      }

      if (direction === 'upstream') {
        const trace = traceUpstream(nodeId, graph);
        return NextResponse.json({ success: true, direction: 'upstream', trace });
      }

      if (direction === 'downstream') {
        const trace = traceDownstream(nodeId, graph);
        return NextResponse.json({ success: true, direction: 'downstream', trace });
      }

      if (direction === 'both') {
        const upstream = traceUpstream(nodeId, graph);
        const downstream = traceDownstream(nodeId, graph);
        return NextResponse.json({
          success: true,
          direction: 'both',
          upstream,
          downstream,
        });
      }

      return NextResponse.json(
        { success: false, error: `Invalid direction: ${direction}. Use 'upstream', 'downstream', or 'both'` },
        { status: 400 }
      );
    }

    if (action === 'gaps') {
      const gaps = detectAuditGaps(graph);
      return NextResponse.json({
        success: true,
        gaps,
        totalGaps: gaps.length,
      });
    }

    if (action === 'search') {
      const q = searchParams.get('q') || '';
      const results = searchAdminNodes(graph, q);
      return NextResponse.json({
        success: true,
        query: q,
        totalMatches: results.length,
        results,
      });
    }

    if (action === 'node') {
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json(
          { success: false, error: 'Missing required parameter: id' },
          { status: 400 }
        );
      }
      const node = findNodeById(graph, id);
      if (!node) {
        return NextResponse.json(
          { success: false, error: `Node not found: ${id}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, node });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API ADMIN-ONTOLOGY ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin-ontology
 * Body payload: { action: 'reindex' }
 * Executes curate_admin_archive.py non-destructively, clears memory caches,
 * and returns the freshly reindexed graph and 6-domain cross-join registry.
 */
export async function POST(request: Request | any) {
  try {
    let body: any = {};
    if (typeof request.json === 'function') {
      body = await request.json();
    } else if (request.body) {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    }

    const action = body.action || '';
    if (action !== 'reindex') {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid or missing action in POST. Supported actions: ['reindex']`,
        },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const scriptPath = path.join(process.cwd(), 'scripts', 'curate_admin_archive.py');
    const pythonBin = process.env.PYTHON_BIN || 'python';

    try {
      await execFileAsync(pythonBin, [scriptPath], {
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (subErr: any) {
      console.error('[API ADMIN-ONTOLOGY POST] Subprocess reindex failure:', subErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Subprocess reindex failed',
          details: subErr.stderr || subErr.message || String(subErr),
        },
        { status: 500 }
      );
    }

    // Invalidate caches
    invalidateOntologyCache();

    // Reload fresh graph and stats
    const graph = loadAdminOntologyGraph();
    const stats = calculateOntologyStats(graph);

    // Build fresh cross-domain registry
    const crossJoin = await buildCrossDomainRegistry(graph);
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      reindexed: true,
      durationMs,
      stats,
      graph,
      crossJoin,
    });
  } catch (error: any) {
    console.error('[API ADMIN-ONTOLOGY POST ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

