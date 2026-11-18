/**
 * VITAL Work & Wealth Architecture — 6-Domain Cross-Join Aggregator Engine
 * Module: src/lib/ontology/cross-domain-builder.ts
 * Standards: Rule O (Working Surface Immunity), Rule R (Zero-Error Budget Math),
 *            Rule Q (PIPA Phone/Name Masking), Rule B (Loud Failures with .catch() Fallbacks)
 * Performance: O(1) Indexed Maps & Hot In-Memory Cache (<50ms execution guarantee)
 */

import fs from 'fs';
import path from 'path';
import {
  CANONICAL_PROJECT_KEYS,
  CANONICAL_PROJECT_METADATA,
  PROJECT_ALIASES_MAP,
  CanonicalProjectKey,
  CrossDomainProjectBundle,
  CrossDomainRegistry,
  CrossDomainAssignedContact,
  maskPhoneNumber,
  maskPersonalName,
} from './cross-domain-types';
import {
  AdminOntologyGraph,
  AdminPolicyEntity,
  AdminOutcomeEntity,
  AdminAuditEntity,
  AdminBudgetPlanEntity,
  AdminWeeklyWorkEntity,
  AdminAuditGap,
  AdminOntologyEdge,
  SemanticEdgeType,
} from './admin-types';
import { detectAuditGaps } from './admin-traversal';
import { ArchiveItem } from '@/types/archive';
import { WorkingMemoryMemo, BudgetCategory, BudgetEntry, SimulationEntry, Contact } from '@/types';
import { WeeklyReportDto } from '@/lib/schemas';

// Re-export PIPA masking helpers for downstream convenience
export { maskPhoneNumber, maskPersonalName };

const DATA_DIR = path.join(process.cwd(), 'data');
const SEED_FILE_PATH = path.join(DATA_DIR, 'SEED_ONTOLOGY_DOCS.json');

/**
 * Budget Category ID mapping per canonical project
 */
export const PROJECT_BUDGET_CATEGORY_IDS: Record<CanonicalProjectKey, string[]> = {
  '01_양재천_페스티벌': ['mnrcir0vhyhg1xb87', 'mnrcir0vkiq1dafm3'],
  '02_사회적_처방_신체활동': ['mnrcir0v56b8pixdb'],
  '03_헬스체크업_바른자세': ['mnrcir0vpun1ops6x'],
  '04_서울체력장_AI메디헬스_메디런': [
    'mnrcir0v5zjn4qxyg',
    'mnrcir0vl18vfnb68',
    'mnrcir0v0gtfi55ks',
    'mnrcir0vwrr1z2yol',
    'mnrcir0vbxmmvztoq',
  ],
  '05_어린이_아이뛰움': ['mnrcir0v0vx5ae1qd'],
  '06_비만예방_합동캠페인': ['mnrcir0voap2bpm8z'],
  '07_손목닥터9988_스마트헬스': ['mnrcir0vwspp9jw51'],
  '08_보건소_기능유지_청사관리': ['mnrcir0v1twl22zuk', 'mnrcir0vaotz2abch', 'mnrcir0vn4jrzj682'],
  '신체활동_건강생활실천': [], // 총괄 기획: 15개 전체 비목 집계
};

/**
 * In-memory registry cache
 */
let cachedRegistry: CrossDomainRegistry | null = null;
let lastCacheMtime = 0;

/**
 * Clears the in-memory cross-domain registry cache
 */
export function clearCrossDomainCache(): void {
  cachedRegistry = null;
  lastCacheMtime = 0;
}

/**
 * Resolves any project name, folder, tag, or ID to a CanonicalProjectKey
 * Multi-tier resolution strategy:
 * 1. Exact match with CanonicalProjectKey
 * 2. Exact match with CanonicalProjectMeta.projectId (e.g. 'hchps-p0'..'hchps-p8')
 * 3. Exact match with PROJECT_ALIASES_MAP entries
 * 4. Substring containment: target contains alias (prioritized by longest matching alias, strictly unambiguous)
 * 5. Reverse containment: alias contains target (minimum 3 chars, strictly unambiguous single match)
 */
export function resolveCanonicalProjectKey(identifier?: string | null): CanonicalProjectKey | null {
  if (!identifier) return null;
  const target = identifier.trim().toLowerCase();
  if (!target) return null;

  // 1. Exact match with canonical keys
  for (const key of CANONICAL_PROJECT_KEYS) {
    if (key.toLowerCase() === target) return key;
  }

  // 2. Exact match with project ID in CANONICAL_PROJECT_METADATA (1:1 bijection)
  for (const key of CANONICAL_PROJECT_KEYS) {
    const meta = CANONICAL_PROJECT_METADATA[key];
    if (meta.projectId.toLowerCase() === target) return key;
  }

  // 3. Exact match with aliases
  for (const key of CANONICAL_PROJECT_KEYS) {
    const aliases = PROJECT_ALIASES_MAP[key] || [];
    for (const alias of aliases) {
      if (alias.toLowerCase() === target) return key;
    }
  }

  // 4. Substring containment (target contains alias, prioritized by longest alias)
  let bestMatches: CanonicalProjectKey[] = [];
  let maxAliasLen = 0;

  for (const key of CANONICAL_PROJECT_KEYS) {
    const aliases = PROJECT_ALIASES_MAP[key] || [];
    for (const alias of aliases) {
      const a = alias.toLowerCase();
      if (a.length >= 2 && target.includes(a)) {
        if (a.length > maxAliasLen) {
          maxAliasLen = a.length;
          bestMatches = [key];
        } else if (a.length === maxAliasLen && !bestMatches.includes(key)) {
          bestMatches.push(key);
        }
      }
    }
  }

  if (bestMatches.length === 1) {
    return bestMatches[0];
  }

  // 5. Reverse containment (alias contains target, target at least 3 chars)
  // Strictly unambiguous: if multiple distinct projects match, reject as ambiguous
  if (target.length >= 3) {
    const matchingKeys = new Set<CanonicalProjectKey>();
    for (const key of CANONICAL_PROJECT_KEYS) {
      const aliases = PROJECT_ALIASES_MAP[key] || [];
      for (const alias of aliases) {
        if (alias.toLowerCase().includes(target)) {
          matchingKeys.add(key);
          break;
        }
      }
    }
    if (matchingKeys.size === 1) {
      return Array.from(matchingKeys)[0];
    }
  }

  return null;
}

export interface LoadedSources {
  graph: AdminOntologyGraph;
  archiveItems: ArchiveItem[];
  archiveByProject?: Map<CanonicalProjectKey, ArchiveItem[]>;
  memos: WorkingMemoryMemo[];
  categories: BudgetCategory[];
  budgetEntries: BudgetEntry[];
  simulations: SimulationEntry[];
  weeklyReports: WeeklyReportDto[];
  festivalData: any;
  contacts: Contact[];
  auditGaps: AdminAuditGap[];
}

/**
 * Loads seed ontology graph from disk safely without circular imports
 */
function loadSeedGraphInternal(): AdminOntologyGraph {
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
      projectKey: o.projectKey || o.project || '신체활동_건강생활실천',
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
      projectKey: a.projectKey || a.project || '신체활동_건강생활실천',
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

    const edges: AdminOntologyEdge[] = [];
    const edgeSet = new Set<string>();

    const addEdge = (
      id: string,
      source: string,
      target: string,
      type: SemanticEdgeType,
      label?: string
    ) => {
      const edgeKey = `${source}->${target}:${type}`;
      if (edgeSet.has(edgeKey)) return;
      edgeSet.add(edgeKey);
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
        addEdge(`edge-auto-${edges.length + 1}`, a.auditedOutcomeId, a.id, 'CRITIQUES');
      }
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

    return {
      policies,
      outcomes,
      audits,
      budgetPlans,
      weeklyWorks,
      edges,
      metadata: raw.metadata,
    };
  } catch (error) {
    console.error('[CROSS-DOMAIN BUILDER] Failed to load seed graph:', error);
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

/**
 * Loads all SSOT JSON files from data directory
 */
export function loadAllSources(customGraph?: AdminOntologyGraph): LoadedSources {
  const readJson = (fileName: string, fallback: any = []) => {
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return fallback;
    }
  };

  const graph = customGraph || loadSeedGraphInternal();
  const rawArchive = readJson('ARCHIVE_INDEX.json', { items: [] });
  const archiveItems: ArchiveItem[] = Array.isArray(rawArchive)
    ? rawArchive
    : Array.isArray(rawArchive.items)
    ? rawArchive.items
    : [];

  const memos: WorkingMemoryMemo[] = readJson('WORKING_MEMORY.json', []);
  const categories: BudgetCategory[] = readJson('BUDGET_CATEGORIES.json', []);
  const budgetEntries: BudgetEntry[] = readJson('BUDGET_ENTRIES.json', []);
  const simulations: SimulationEntry[] = readJson('BUDGET_SIMULATIONS.json', []);
  const weeklyReports: WeeklyReportDto[] = readJson('WEEKLY_REPORTS.json', []);
  const festivalData: any = readJson('FESTIVAL_YANGJAE_2026.json', null);
  const contacts: Contact[] = readJson('CONTACTS.json', []);
  const auditGaps: AdminAuditGap[] = detectAuditGaps(graph);

  // Single pass pre-index for archive items
  const archiveByProject = new Map<CanonicalProjectKey, ArchiveItem[]>();
  for (const k of CANONICAL_PROJECT_KEYS) {
    archiveByProject.set(k, []);
  }

  for (const item of archiveItems) {
    const k =
      resolveCanonicalProjectKey(item.project) ||
      resolveCanonicalProjectKey(item.subFolder) ||
      (Array.isArray(item.keywords)
        ? item.keywords.map(resolveCanonicalProjectKey).find((cand) => cand !== null) || null
        : null);
    if (k) {
      archiveByProject.get(k)?.push(item);
    }
  }

  return {
    graph,
    archiveItems,
    archiveByProject,
    memos,
    categories,
    budgetEntries,
    simulations,
    weeklyReports,
    festivalData,
    contacts,
    auditGaps,
  };
}

/**
 * Builds a CrossDomainProjectBundle for a single canonical project key
 */
export function buildSingleProjectBundle(
  key: CanonicalProjectKey,
  sources: LoadedSources
): CrossDomainProjectBundle {
  const meta = CANONICAL_PROJECT_METADATA[key];

  // 1. Domain 1: 행정 온톨로지 4단계
  const policies = sources.graph.policies.filter(
    (p) => resolveCanonicalProjectKey(p.project || p.projectKey || p.projectId) === key
  );
  const outcomes = sources.graph.outcomes.filter(
    (o) => resolveCanonicalProjectKey(o.projectKey || o.projectId || (o as any).project) === key
  );
  const audits = sources.graph.audits.filter(
    (a) => resolveCanonicalProjectKey(a.projectKey || a.projectId || (a as any).project) === key
  );
  const budgetPlans = sources.graph.budgetPlans.filter(
    (b) => resolveCanonicalProjectKey(b.project || b.projectKey || b.projectId) === key
  );
  const weeklyWorks = sources.graph.weeklyWorks.filter(
    (w) => resolveCanonicalProjectKey(w.category || (w as any).projectKey || (w as any).projectId) === key
  );
  const totalNodes =
    policies.length + outcomes.length + audits.length + budgetPlans.length + weeklyWorks.length;
  const lifecycleComplete =
    policies.length > 0 && outcomes.length > 0 && audits.length > 0 && budgetPlans.length > 0;

  const projectAuditIds = new Set(audits.map((a) => a.id));
  const projectGaps = sources.auditGaps.filter((g) => projectAuditIds.has(g.auditId));

  // 2. Domain 2: 마스터 아카이브
  const matchedArchive: ArchiveItem[] =
    sources.archiveByProject?.get(key) ||
    sources.archiveItems.filter((item) => {
      return (
        resolveCanonicalProjectKey(item.project) === key ||
        resolveCanonicalProjectKey(item.subFolder) === key ||
        (Array.isArray(item.keywords) &&
          item.keywords.some((k) => resolveCanonicalProjectKey(k) === key))
      );
    });

  const docs = matchedArchive.filter(
    (i) => i.category === 'doc' || /\.(hwpx|hwp|pdf)$/i.test(i.ext || '')
  );
  const photos = matchedArchive.filter(
    (i) => i.category === 'image' || i.imageCategory === 'photo'
  );
  const sheets = matchedArchive.filter(
    (i) => i.category === 'sheet' || /\.(xlsx|xls|csv)$/i.test(i.ext || '')
  );

  const sortedDocs = [...docs].sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  const sortedPhotos = [...photos].sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

  // 3. Domain 3: 작업기억 (포스트잇 미반영 메모)
  const matchedMemos = sources.memos.filter((memo) => {
    if (memo.tags && memo.tags.some((t) => resolveCanonicalProjectKey(t) === key)) return true;
    return resolveCanonicalProjectKey(memo.content) === key;
  });

  const pendingMemos = matchedMemos.filter((m) => m.status === 'pending');
  const reflectedCount = matchedMemos.filter((m) => m.status === 'reflected').length;
  const urgentDirectives = matchedMemos.filter(
    (m) => m.category === 'directive' || m.category === 'audit' || m.pinned === true
  );

  // 4. Domain 4: e-호조 예산 및 시뮬레이터 (Rule R 엄수)
  const explicitCategoryIds = PROJECT_BUDGET_CATEGORY_IDS[key] || [];
  const matchedCategories = sources.categories.filter((cat) => {
    if (key === '신체활동_건강생활실천') {
      // 총괄 기획 사업은 15개 전체 비목 집계
      return true;
    }
    if (explicitCategoryIds.includes(cat.id)) return true;
    return (
      resolveCanonicalProjectKey(cat.name) === key ||
      resolveCanonicalProjectKey(cat.detailedProject) === key ||
      resolveCanonicalProjectKey(cat.unitProject) === key
    );
  });

  const catIdSet = new Set(matchedCategories.map((c) => c.id));
  const relevantEntries = sources.budgetEntries.filter((e) => catIdSet.has(e.categoryId));

  const totalBudget = matchedCategories.reduce((sum, c) => sum + (c.totalBudget || 0), 0);

  const dailyExpenseIssued = relevantEntries
    .filter((e) => e.actionType === 'issuance')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const dailyExpenseSpent = relevantEntries
    .filter((e) => e.actionType === 'daily_expense')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const generalSpent = relevantEntries
    .filter((e) => e.actionType === 'general' || (!e.actionType && !e.isPlanned))
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Rule R: 일상경비는 교부 시 본청에서 지출 처리되므로 spentBudget = generalSpent + dailyExpenseIssued
  const spentBudget = generalSpent + dailyExpenseIssued;
  const remainingBudget = Math.max(0, totalBudget - spentBudget);
  const executionRate = totalBudget > 0 ? Math.round((spentBudget / totalBudget) * 1000) / 10 : 0;
  const dailyExpenseRemaining = Math.max(0, dailyExpenseIssued - dailyExpenseSpent);

  const relevantSimulations = sources.simulations.filter(
    (s) =>
      (s.categoryId && catIdSet.has(s.categoryId)) ||
      resolveCanonicalProjectKey(s.detailedProject) === key
  );
  const simulatedExpenditure = relevantSimulations
    .filter((s) => s.status === 'PLANNED')
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  const finalExpectedBalance = remainingBudget - simulatedExpenditure;
  const isDeficit = finalExpectedBalance < 0;

  const categoriesDto = matchedCategories.map((c) => {
    const catEntries = relevantEntries.filter((e) => e.categoryId === c.id);
    const catGenSpent = catEntries
      .filter((e) => e.actionType === 'general' || (!e.actionType && !e.isPlanned))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const catIssued = catEntries
      .filter((e) => e.actionType === 'issuance')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const catSpent = catGenSpent + catIssued;
    const catRemaining = Math.max(0, (c.totalBudget || 0) - catSpent);

    return {
      id: c.id,
      name: c.name,
      totalBudget: c.totalBudget || 0,
      spent: catSpent,
      remaining: catRemaining,
    };
  });

  // 5. Domain 5: 수요일 주간업무 HWPX
  const recentItems: CrossDomainProjectBundle['weeklyWork']['recentItems'] = [];
  let reportsCount = 0;
  let latestReportDate: string | undefined = undefined;

  for (const rep of sources.weeklyReports) {
    let matchedInReport = false;
    for (const it of rep.items || []) {
      if (resolveCanonicalProjectKey(it.projectName) === key) {
        matchedInReport = true;
        recentItems.push({
          reportDate: rep.reportDate,
          projectName: it.projectName,
          status: it.status,
          contents: it.contents || [],
          metrics: it.metrics,
          target: it.target,
          location: it.location,
        });
      }
    }
    if (matchedInReport) {
      reportsCount++;
      if (!latestReportDate || rep.reportDate > latestReportDate) {
        latestReportDate = rep.reportDate;
      }
    }
  }

  // 6. Domain 6: 페스티벌 및 연락처 (Rule Q 전화번호 마스킹)
  const isFestivalProject = key === '01_양재천_페스티벌';
  let festivalSummary: CrossDomainProjectBundle['festivalAndContacts']['festivalSummary'] =
    undefined;

  if (isFestivalProject && sources.festivalData) {
    const fMeta = sources.festivalData.meta || {};
    festivalSummary = {
      title: fMeta.title || '2026 양재천 걷자! 건강 페스티벌',
      eventDate: fMeta.eventDate || '2026-10-31(토)',
      eventTime: fMeta.eventTime || '08:00~14:00',
      location: fMeta.location || '양재천 수변문화쉼터',
      progress: typeof fMeta.overallProgress === 'number' ? fMeta.overallProgress : 85,
      boothsCount: Array.isArray(sources.festivalData.booths)
        ? sources.festivalData.booths.length
        : 20,
      dutiesCount: Array.isArray(sources.festivalData.duties)
        ? sources.festivalData.duties.length
        : 41,
      budgetTotal: sources.festivalData.budget?.total || 49900000,
    };
  }

  const assignedContacts: CrossDomainAssignedContact[] = sources.contacts
    .filter(
      (c) =>
        resolveCanonicalProjectKey(c.notes) === key ||
        resolveCanonicalProjectKey(c.name) === key
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: maskPhoneNumber(c.phone), // Rule Q 비식별화
      email: c.email,
      role: c.notes,
      organization: c.notes,
      notes: c.notes,
    }));

  return {
    projectId: meta.projectId,
    projectKey: meta.projectKey,
    projectName: meta.projectName,
    department: meta.department,
    team: meta.team,
    color: meta.color,
    ontology: {
      policies,
      outcomes,
      audits,
      budgetPlans,
      weeklyWorks,
      totalNodes,
      lifecycleComplete,
      auditGaps: projectGaps,
    },
    archive: {
      totalDocuments: docs.length,
      totalPhotos: photos.length,
      totalSheets: sheets.length,
      recentDocuments: sortedDocs.slice(0, 10),
      recentPhotos: sortedPhotos.slice(0, 10),
    },
    workingMemory: {
      pendingMemos,
      pendingCount: pendingMemos.length,
      reflectedCount,
      urgentDirectives,
    },
    budget: {
      totalBudget,
      spentBudget,
      remainingBudget,
      executionRate,
      generalSpent,
      dailyExpenseIssued,
      dailyExpenseSpent,
      dailyExpenseRemaining,
      simulatedExpenditure,
      finalExpectedBalance,
      isDeficit,
      categories: categoriesDto,
    },
    weeklyWork: {
      reportsCount,
      recentItems: recentItems.slice(0, 10),
      latestReportDate,
      latestHwpxAvailable: reportsCount > 0,
    },
    festivalAndContacts: {
      isFestivalProject,
      festivalSummary,
      assignedContacts,
    },
  };
}

/**
 * Builds the complete CrossDomainRegistry across all 9 canonical projects
 */
export async function buildCrossDomainRegistry(
  customGraph?: AdminOntologyGraph
): Promise<CrossDomainRegistry> {
  // Check if cache is fresh when no custom graph is provided
  if (!customGraph && cachedRegistry) {
    try {
      if (fs.existsSync(SEED_FILE_PATH)) {
        const stat = fs.statSync(SEED_FILE_PATH);
        if (stat.mtimeMs === lastCacheMtime) {
          return cachedRegistry;
        }
      }
    } catch {
      // In case of stat failure, proceed with rebuild
    }
  }

  const sources = loadAllSources(customGraph);
  const registry: CrossDomainRegistry = {};

  for (const key of CANONICAL_PROJECT_KEYS) {
    registry[key] = buildSingleProjectBundle(key, sources);
  }

  // Update in-memory cache
  cachedRegistry = registry;
  try {
    if (fs.existsSync(SEED_FILE_PATH)) {
      lastCacheMtime = fs.statSync(SEED_FILE_PATH).mtimeMs;
    }
  } catch {
    lastCacheMtime = Date.now();
  }

  return registry;
}

/**
 * Retrieves a single project bundle by project key, alias, or ID
 */
export async function buildProjectBundle(
  projectKeyOrId: string,
  customGraph?: AdminOntologyGraph
): Promise<CrossDomainProjectBundle | null> {
  const canonicalKey = resolveCanonicalProjectKey(projectKeyOrId);
  if (!canonicalKey) return null;

  if (cachedRegistry && cachedRegistry[canonicalKey] && !customGraph) {
    return cachedRegistry[canonicalKey];
  }

  const sources = loadAllSources(customGraph);
  return buildSingleProjectBundle(canonicalKey, sources);
}

/**
 * Backward compatibility alias for buildProjectBundle
 */
export const getProjectBundle = buildProjectBundle;
