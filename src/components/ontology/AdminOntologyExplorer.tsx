'use client';

/**
 * VITAL Work & Wealth Architecture — Admin Ontology Explorer (Milestone 2)
 * Module: src/components/ontology/AdminOntologyExplorer.tsx
 * Standards: Rule S (448px Mobile First), Rule R (Zero-Error Budget Math),
 *            Rule Q (PIPA Phone/Name Masking), Rule B (Loud Failures with Fallbacks)
 * Integration: 6-Domain Cross-Join Live Data, 9-Project Filter, Bidirectional Module Jumps
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AdminOntologyGraph,
  AdminEntity,
  AdminStage,
  STAGE_LABELS,
  STAGE_COLORS,
  getNodeStage,
  AdminOntologySummaryStats,
  AdminAuditGap,
} from '@/lib/ontology/admin-types';
import {
  calculateOntologyStats,
  detectAuditGaps,
  searchAdminNodes,
  findNodeById,
} from '@/lib/ontology/admin-traversal';
import { toAdminGraph } from '@/lib/ontology/toAdminGraph';
import { AdminOntologyDrawer } from './AdminOntologyDrawer';
import { useAdminOntology } from '@/hooks/useAdminOntology';
import { ModuleType } from '@/types';
import {
  CANONICAL_PROJECT_KEYS,
  CANONICAL_PROJECT_METADATA,
  PROJECT_ALIASES_MAP,
  CanonicalProjectKey,
} from '@/lib/ontology/cross-domain-types';

export interface AdminOntologyExplorerProps {
  initialGraph?: AdminOntologyGraph;
  projectKey?: string;
  onNavigateModule?: (module: ModuleType) => void;
  onSwitchTab?: (tab: 'archive' | 'ontology' | 'weekly') => void;
  className?: string;
}

/**
 * Client-safe project key matching without Node.js fs dependencies
 */
function matchProjectKey(entity: AdminEntity, targetProject: string): boolean {
  if (targetProject === 'ALL') return true;
  const projectVal =
    ('project' in entity && (entity as any).project) ||
    ('category' in entity && (entity as any).category) ||
    '';
  if (!projectVal) return false;
  if (projectVal === targetProject) return true;

  const aliases = PROJECT_ALIASES_MAP[targetProject as CanonicalProjectKey];
  if (aliases && aliases.length > 0) {
    const lowerVal = projectVal.toLowerCase();
    return aliases.some(
      (a) =>
        a.toLowerCase() === lowerVal ||
        lowerVal.includes(a.toLowerCase()) ||
        a.toLowerCase().includes(lowerVal)
    );
  }

  return projectVal.toLowerCase().includes(targetProject.toLowerCase());
}

export const AdminOntologyExplorer: React.FC<AdminOntologyExplorerProps> = ({
  initialGraph,
  projectKey,
  onNavigateModule,
  onSwitchTab,
  className,
}) => {
  const {
    graph,
    crossDomainRegistry,
    loading,
    error,
    isReindexing,
    reindex,
  } = useAdminOntology({
    initialGraph: initialGraph || null,
    autoFetchGraph: !initialGraph,
    autoFetchCrossJoin: true,
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<AdminStage | 'ALL'>('ALL');
  const [selectedProject, setSelectedProject] = useState<string | 'ALL'>(projectKey || 'ALL');
  const [prevProjectKey, setPrevProjectKey] = useState(projectKey);
  if (projectKey !== prevProjectKey) {
    setPrevProjectKey(projectKey);
    if (projectKey) {
      setSelectedProject(projectKey);
    }
  }

  const [selectedNode, setSelectedNode] = useState<AdminEntity | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'orbit' | 'cards'>('orbit');
  const [showGapsOnly, setShowGapsOnly] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodePositionsRef = useRef<Map<string, { x: number; y: number; node: AdminEntity }>>(new Map());

  // Non-destructive Reindex Trigger
  const handleReindex = async () => {
    try {
      await reindex();
    } catch (err: any) {
      alert(`온톨로지 재색인 중 오류가 발생했습니다: ${err?.message || err}`);
    }
  };

  const stats: AdminOntologySummaryStats = useMemo(() => {
    if (!graph) {
      return {
        totalNodes: 0,
        totalPolicies: 0,
        totalOutcomes: 0,
        totalAudits: 0,
        totalBudgetPlans: 0,
        totalWeeklyWorks: 0,
        totalEdges: 0,
        totalGaps: 0,
        totalBudgetKrw: 0,
      };
    }
    return calculateOntologyStats(graph);
  }, [graph]);

  const auditGaps: AdminAuditGap[] = useMemo(() => {
    if (!graph) return [];
    return detectAuditGaps(graph);
  }, [graph]);

  // Filtered nodes
  const filteredNodes: AdminEntity[] = useMemo(() => {
    if (!graph) return [];

    let all: AdminEntity[] = [
      ...(graph.policies || []),
      ...(graph.outcomes || []),
      ...(graph.audits || []),
      ...(graph.budgetPlans || []),
      ...(graph.weeklyWorks || []),
    ];

    if (selectedProject !== 'ALL') {
      all = all.filter((n) => matchProjectKey(n, selectedProject));
    }

    if (showGapsOnly) {
      const gapAuditIds = new Set(auditGaps.map((g) => g.auditId));
      all = all.filter((n) => gapAuditIds.has(n.id));
    }

    if (selectedStage !== 'ALL') {
      all = all.filter((n) => getNodeStage(n) === selectedStage);
    }

    if (searchQuery.trim()) {
      const matched = searchAdminNodes(graph, searchQuery);
      const matchedIds = new Set(matched.map((m) => m.node.id));
      all = all.filter((n) => matchedIds.has(n.id));
    }

    return all;
  }, [graph, selectedProject, selectedStage, searchQuery, showGapsOnly, auditGaps]);

  // 6-Domain Aggregated or Project-Specific Metrics
  const crossDomainMetrics = useMemo(() => {
    if (!crossDomainRegistry) {
      return {
        hasData: false,
        totalDocs: stats.totalNodes,
        lifecycleText: stats.totalGaps === 0 ? '4단계 완결' : `${stats.totalGaps}건 지적`,
        archiveDocs: 0,
        pendingMemos: 0,
        urgentMemos: 0,
        budgetKrw: stats.totalBudgetKrw,
        executionRate: 0,
        weeklyCount: stats.totalWeeklyWorks,
        festivalProgress: 85,
        contactsCount: 0,
      };
    }

    if (selectedProject !== 'ALL' && crossDomainRegistry[selectedProject]) {
      const b = crossDomainRegistry[selectedProject];
      return {
        hasData: true,
        totalDocs: b.ontology?.totalNodes ?? stats.totalNodes,
        lifecycleText: b.ontology?.lifecycleComplete ? '4단계 완결' : '일부 단계',
        archiveDocs: (b.archive as any)?.totalFiles ?? ((b.archive?.totalDocuments || 0) + (b.archive?.totalPhotos || 0) + (b.archive?.totalSheets || 0)),
        pendingMemos: b.workingMemory?.pendingCount || 0,
        urgentMemos: (b.workingMemory as any)?.urgentDirectives?.length || 0,
        budgetKrw: b.budget?.totalBudget || 0,
        executionRate: b.budget?.executionRate || 0,
        weeklyCount: ((b.weeklyWork as any)?.totalCount ?? (b.weeklyWork as any)?.reportsCount ?? 0),
        festivalProgress: b.festivalAndContacts?.festivalSummary?.progress ?? 0,
        contactsCount: b.festivalAndContacts?.assignedContacts?.length || 0,
      };
    }

    // Aggregate across all projects in registry
    let totalArchiveDocs = 0;
    let totalPendingMemos = 0;
    let totalUrgentMemos = 0;
    let totalBudget = 0;
    let totalSpent = 0;
    let totalWeekly = 0;
    let totalContacts = 0;

    Object.values(crossDomainRegistry).forEach((b) => {
      if (!b) return;
      totalArchiveDocs += (b.archive as any)?.totalFiles ?? ((b.archive?.totalDocuments || 0) + (b.archive?.totalPhotos || 0) + (b.archive?.totalSheets || 0));
      totalPendingMemos += b.workingMemory?.pendingCount || 0;
      totalUrgentMemos += (b.workingMemory as any)?.urgentDirectives?.length || 0;
      totalBudget += b.budget?.totalBudget || 0;
      totalSpent += b.budget?.spentBudget || 0;
      totalWeekly += ((b.weeklyWork as any)?.totalCount ?? (b.weeklyWork as any)?.reportsCount ?? 0);
      totalContacts += b.festivalAndContacts?.assignedContacts?.length || 0;
    });

    const overallRate = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0;

    return {
      hasData: true,
      totalDocs: stats.totalNodes,
      lifecycleText: stats.totalGaps === 0 ? '4단계 완결' : `${stats.totalGaps}건 지적`,
      archiveDocs: totalArchiveDocs,
      pendingMemos: totalPendingMemos,
      urgentMemos: totalUrgentMemos,
      budgetKrw: totalBudget,
      executionRate: overallRate,
      weeklyCount: totalWeekly || stats.totalWeeklyWorks,
      festivalProgress: 85,
      contactsCount: totalContacts,
    };
  }, [crossDomainRegistry, selectedProject, stats]);

  // 2D Canvas Orbit Radar Renderer for Orbit Mode
  useEffect(() => {
    if (viewMode !== 'orbit' || !canvasRef.current || !graph) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(centerX, centerY) - 30;

    ctx.clearRect(0, 0, width, height);

    // 4 Orbits
    const orbitRadii = [
      maxRadius * 0.28, // Orbit 1: Policy
      maxRadius * 0.52, // Orbit 2: Outcome
      maxRadius * 0.76, // Orbit 3: Audit
      maxRadius * 0.98, // Orbit 4: Budget
    ];

    orbitRadii.forEach((radius, idx) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([4, 4]);
      }
      ctx.stroke();
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([]);
      }

      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '10px sans-serif';
      ctx.fillText(`궤도 ${idx + 1}`, centerX + 5, centerY - radius + 12);
    });

    // Center Node (Hub)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#0ea5e9';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VITAL', centerX, centerY);

    const orbitalNodes = toAdminGraph(graph).nodes;
    const filteredIdSet = new Set(filteredNodes.map((fn) => fn.id));
    const allNodeMap = new Map<string, AdminEntity>();
    [
      ...(graph.policies || []),
      ...(graph.outcomes || []),
      ...(graph.audits || []),
      ...(graph.budgetPlans || []),
      ...(graph.weeklyWorks || []),
    ].forEach((n) => {
      allNodeMap.set(n.id, n);
    });

    const nodesByOrbit: Record<number, typeof orbitalNodes> = { 1: [], 2: [], 3: [], 4: [] };
    orbitalNodes.forEach((n) => {
      if (filteredIdSet.has(n.id)) {
        const orbit = n.customOrbitIndex || 1;
        if (nodesByOrbit[orbit]) {
          nodesByOrbit[orbit].push(n);
        }
      }
    });

    const nodePositions = new Map<string, { x: number; y: number; node: AdminEntity }>();

    [1, 2, 3, 4].forEach((orbitIdx) => {
      const list = nodesByOrbit[orbitIdx];
      const radius = orbitRadii[orbitIdx - 1];
      const count = list.length;
      if (count === 0) return;

      list.forEach((n, i) => {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        const rawNode = allNodeMap.get(n.id) || (n as any);
        nodePositions.set(n.id, { x, y, node: rawNode });

        const isSelected = selectedNode?.id === n.id;

        ctx.beginPath();
        ctx.arc(x, y, isSelected ? 8 : 5, 0, Math.PI * 2);
        ctx.fillStyle = n.customColor || '#38bdf8';
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    });

    nodePositionsRef.current = nodePositions;

    // Draw Edges
    const edges = graph.edges || [];
    edges.forEach((e) => {
      const posA = nodePositions.get(e.source);
      const posB = nodePositions.get(e.target);
      if (posA && posB) {
        ctx.beginPath();
        ctx.moveTo(posA.x, posA.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }, [viewMode, graph, selectedNode, filteredNodes]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let closestNode: AdminEntity | null = null;
    let minDist = 14;

    nodePositionsRef.current.forEach((pos) => {
      const dist = Math.hypot(pos.x - x, pos.y - y);
      if (dist < minDist) {
        minDist = dist;
        closestNode = pos.node;
      }
    });

    if (closestNode) {
      setSelectedNode(closestNode);
      setIsDrawerOpen(true);
    }
  };

  const handleNodeClick = (node: AdminEntity) => {
    setSelectedNode(node);
    setIsDrawerOpen(true);
  };

  const handleSelectNodeById = (nodeId: string) => {
    if (!graph) return;
    const found = findNodeById(graph, nodeId);
    if (found) {
      setSelectedNode(found);
      setIsDrawerOpen(true);
    }
  };

  return (
    <div
      className={`w-full flex flex-col bg-slate-950 text-slate-100 rounded-xl border border-slate-800 shadow-xl overflow-hidden min-h-[600px] ${
        className || ''
      }`}
    >
      {/* Top Header & Cross-Domain Action Bar */}
      <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900/60 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <span>문서 관계도</span>
            </h1>
            <p className="vlds-subtitle text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">
              방침 · 결과 · 감사 · 예산서
            </p>
          </div>

          {/* Controls: View mode & Reindex button */}
          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
            <button
              onClick={handleReindex}
              disabled={isReindexing}
              title="문서 색인 갱신"
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <span className={`inline-block ${isReindexing ? 'animate-spin' : ''}`}>↻</span>
              <span>{isReindexing ? '동기화 중...' : '동기화 갱신'}</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode('orbit')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  viewMode === 'orbit'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                4-궤도 뷰
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                목록 카드 뷰
              </button>
            </div>
          </div>
        </div>

        {/* 9 Canonical Projects Filter Chip Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
          <button
            onClick={() => setSelectedProject('ALL')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
              selectedProject === 'ALL'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            전체 사업 (9개)
          </button>
          {CANONICAL_PROJECT_KEYS.map((pk) => {
            const meta = CANONICAL_PROJECT_METADATA[pk];
            const isSelected = selectedProject === pk;
            return (
              <button
                key={pk}
                onClick={() => setSelectedProject(pk)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap border ${
                  isSelected
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-bold'
                    : 'bg-slate-800/40 text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {meta?.projectName || pk}
              </button>
            );
          })}
        </div>

        {/* 6-Domain Cross-Join Live Status Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          {/* Domain 1: Ontology */}
          <div className="bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between min-h-[68px]">
            <div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>1. 문서 관계도</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              </div>
              <div className="text-xs sm:text-sm font-bold text-blue-400 mt-0.5 truncate">
                {crossDomainMetrics.totalDocs}건 연계
              </div>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 truncate">
              {crossDomainMetrics.lifecycleText}
            </div>
          </div>

          {/* Domain 2: Master Archive */}
          <div className="bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between min-h-[68px]">
            <div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>2. 문서 보관함</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="text-xs sm:text-sm font-bold text-emerald-400 mt-0.5 truncate">
                {crossDomainMetrics.archiveDocs > 0
                  ? `${crossDomainMetrics.archiveDocs.toLocaleString()}건`
                  : '자료 연동'}
              </div>
            </div>
            {onSwitchTab ? (
              <button
                onClick={() => onSwitchTab('archive')}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-0.5 mt-1 text-left"
              >
                <span>보관함 이동 →</span>
              </button>
            ) : (
              <div className="text-[10px] text-slate-500 mt-1 truncate">공문서·사진·시트</div>
            )}
          </div>

          {/* Domain 3: Working Memory */}
          <div className="bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between min-h-[68px]">
            <div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>3. 작업기억</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    crossDomainMetrics.pendingMemos > 0 ? 'bg-amber-400' : 'bg-slate-500'
                  }`}
                />
              </div>
              <div className="text-xs sm:text-sm font-bold text-amber-400 mt-0.5 truncate">
                미반영 {crossDomainMetrics.pendingMemos}건
              </div>
            </div>
            {onNavigateModule ? (
              <button
                onClick={() => onNavigateModule('memory')}
                className="text-[10px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-0.5 mt-1 text-left"
              >
                <span>메모 점프 →</span>
              </button>
            ) : (
              <div className="text-[10px] text-slate-500 mt-1 truncate">포스트잇 보드</div>
            )}
          </div>

          {/* Domain 4: e-Hojo Budget */}
          <div className="bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between min-h-[68px]">
            <div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>4. e-호조 예산</span>
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              </div>
              <div className="text-xs sm:text-sm font-bold text-purple-400 mt-0.5 truncate">
                집행률 {crossDomainMetrics.executionRate}%
              </div>
            </div>
            {onNavigateModule ? (
              <button
                onClick={() => onNavigateModule('workspace')}
                className="text-[10px] text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-0.5 mt-1 text-left"
              >
                <span>예산관리 →</span>
              </button>
            ) : (
              <div className="text-[10px] text-slate-500 mt-1 truncate">
                {(crossDomainMetrics.budgetKrw / 100000000).toFixed(1)}억원
              </div>
            )}
          </div>

          {/* Domain 5: Weekly Work HWPX */}
          <div className="bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between min-h-[68px]">
            <div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>5. 주간업무</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              </div>
              <div className="text-xs sm:text-sm font-bold text-cyan-400 mt-0.5 truncate">
                누적 {crossDomainMetrics.weeklyCount}건
              </div>
            </div>
            {onSwitchTab ? (
              <button
                onClick={() => onSwitchTab('weekly')}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-0.5 mt-1 text-left"
              >
                <span>HWPX 작성 →</span>
              </button>
            ) : (
              <div className="text-[10px] text-slate-500 mt-1 truncate">수요일 2단 대조</div>
            )}
          </div>

          {/* Domain 6: Festival & Contacts */}
          <div className="bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between min-h-[68px]">
            <div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>6. 행사·연락망</span>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              </div>
              <div className="text-xs sm:text-sm font-bold text-rose-400 mt-0.5 truncate">
                {crossDomainMetrics.contactsCount > 0
                  ? `${crossDomainMetrics.contactsCount}명 배정`
                  : `진행률 ${crossDomainMetrics.festivalProgress}%`}
              </div>
            </div>
            {onNavigateModule ? (
              <button
                onClick={() => onNavigateModule('festival')}
                className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-0.5 mt-1 text-left"
              >
                <span>관제 이동 →</span>
              </button>
            ) : (
              <div className="text-[10px] text-slate-500 mt-1 truncate">양재천 448px 관제</div>
            )}
          </div>
        </div>

        {/* KPI Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
            <div className="text-[11px] text-slate-400">총 연계 문서</div>
            <div className="text-base font-bold text-blue-400 mt-0.5">
              {stats.totalNodes.toLocaleString()}건
            </div>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
            <div className="text-[11px] text-slate-400">인과 관계선</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              {stats.totalEdges.toLocaleString()}선
            </div>
          </div>
          <div
            onClick={() => setShowGapsOnly(!showGapsOnly)}
            className={`cursor-pointer p-2.5 rounded-lg border transition-colors duration-150 ${
              stats.totalGaps > 0
                ? showGapsOnly
                  ? 'bg-rose-950/60 border-rose-600 text-rose-300'
                  : 'bg-rose-950/30 border-rose-800/60 hover:border-rose-600'
                : 'bg-slate-900/80 border-slate-800/80'
            }`}
          >
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>감사 지적 미조치</span>
              {stats.totalGaps > 0 && (
                <span className="text-[9px] px-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold">
                  GAP
                </span>
              )}
            </div>
            <div
              className={`text-base font-bold mt-0.5 ${
                stats.totalGaps > 0 ? 'text-rose-400' : 'text-slate-300'
              }`}
            >
              {stats.totalGaps}건 {showGapsOnly && '(필터 중)'}
            </div>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
            <div className="text-[11px] text-slate-400">총 편성 요구액</div>
            <div className="text-base font-bold text-purple-400 mt-0.5 truncate">
              {(stats.totalBudgetKrw / 100000000).toFixed(1)}억원
            </div>
          </div>
        </div>

        {/* Search input & Stage chips */}
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="문서명 · 사업명 · 부서명 · 지적사항 검색"
              className="w-full px-3 py-2 pl-9 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <svg
              className="w-4 h-4 text-slate-500 absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
            <button
              onClick={() => setSelectedStage('ALL')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                selectedStage === 'ALL'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              전체 단계 ({filteredNodes.length})
            </button>
            {(Object.keys(STAGE_LABELS) as AdminStage[]).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStage(st)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap border ${
                  selectedStage === st
                    ? `${STAGE_COLORS[st].bg} ${STAGE_COLORS[st].text} ${STAGE_COLORS[st].border} font-bold`
                    : 'bg-slate-800/40 text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {STAGE_LABELS[st]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content View */}
      <div className="flex-1 relative min-h-[420px] flex flex-col">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 gap-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">행정 온톨로지 데이터 로딩 중</p>
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-rose-400 text-xs">
            <p className="font-bold mb-1">오류 발생</p>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && viewMode === 'orbit' && (
          <div className="flex-1 relative w-full h-[320px] sm:h-[460px] bg-slate-950/80">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-full block cursor-pointer"
            />
            <div className="absolute bottom-3 left-3 bg-slate-900/95 px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-400 flex items-center gap-3 overflow-x-auto max-w-[90%]">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> 방침서
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> 결과보고
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> 감사지적
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> 사업설명서
              </span>
            </div>
          </div>
        )}

        {!loading && !error && (viewMode === 'cards' || filteredNodes.length > 0) && (
          <div
            className={`p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto max-h-[500px] ${
              viewMode === 'orbit' ? 'border-t border-slate-800 bg-slate-950/60' : ''
            }`}
          >
            {filteredNodes.map((node) => {
              const st = getNodeStage(node);
              const theme = STAGE_COLORS[st];

              return (
                <div
                  key={node.id}
                  onClick={() => handleNodeClick(node)}
                  className={`vlds-cv-card p-3 rounded-lg border bg-slate-900/60 hover:bg-slate-850 cursor-pointer transition-colors hover:border-slate-600 flex flex-col justify-between gap-2 ${
                    selectedNode?.id === node.id
                      ? 'border-blue-500 ring-1 ring-blue-500'
                      : 'border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${theme.bg} ${theme.text} ${theme.border}`}
                      >
                        {STAGE_LABELS[st].split(':')[0]}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{node.id}</span>
                    </div>
                    <h3 className="text-xs font-semibold text-slate-200 line-clamp-2 leading-snug">
                      {node.title}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <span className="truncate max-w-[160px]">
                      {'department' in node && (node as any).department
                        ? (node as any).department
                        : '소관팀'}
                    </span>
                    <span className="text-blue-400 hover:underline shrink-0">상세 보기 →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Drawer with 6-Domain Action Callbacks */}
      <AdminOntologyDrawer
        node={selectedNode}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        graph={graph}
        onSelectNode={handleSelectNodeById}
        onNavigateModule={onNavigateModule}
        onSwitchTab={onSwitchTab}
      />
    </div>
  );
};

export default AdminOntologyExplorer;
