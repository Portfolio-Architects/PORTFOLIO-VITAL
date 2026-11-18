'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ModuleType } from '@/types';
import {
  AdminEntity,
  STAGE_LABELS,
  STAGE_COLORS,
  getNodeStage,
  AdminCausalChain,
  isPolicyEntity,
  isOutcomeEntity,
  isAuditEntity,
  isBudgetPlanEntity,
  isWeeklyWorkEntity,
} from '@/lib/ontology/admin-types';
import {
  traceUpstream,
  traceDownstream,
} from '@/lib/ontology/admin-traversal';
import { CrossDomainProjectBundle } from '@/lib/ontology/cross-domain-types';
import { useAdminOntology } from '@/hooks/useAdminOntology';

export interface AdminOntologyDrawerProps {
  node: AdminEntity | null;
  isOpen: boolean;
  onClose: () => void;
  graph?: any;
  onSelectNode?: (nodeId: string) => void;
  onNavigateModule?: (module: ModuleType) => void;
  onSwitchTab?: (tab: 'archive' | 'ontology' | 'weekly') => void;
}

export const AdminOntologyDrawer: React.FC<AdminOntologyDrawerProps> = ({
  node,
  isOpen,
  onClose,
  graph,
  onSelectNode,
  onNavigateModule,
  onSwitchTab,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'cross-domain' | 'trace' | 'forensics'>('details');
  const [upstreamTrace, setUpstreamTrace] = useState<AdminCausalChain | null>(null);
  const [downstreamTrace, setDownstreamTrace] = useState<AdminCausalChain | null>(null);
  const [isTracing, setIsTracing] = useState(false);

  // Admin Ontology Controller Hook
  const { fetchCrossJoin, openArchiveTarget, crossDomainError } = useAdminOntology({
    autoFetchGraph: false,
    autoFetchCrossJoin: false,
  });

  // Cross-Domain Bundle Live State
  const [bundle, setBundle] = useState<CrossDomainProjectBundle | null>(null);
  const [isLoadingBundle, setIsLoadingBundle] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const effectiveBundleError = bundleError || crossDomainError;

  // File/Folder Opening Action Feedback State
  const [openingAction, setOpeningAction] = useState<'file' | 'folder' | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // JSON Copy Feedback State
  const [copiedJson, setCopiedJson] = useState(false);

  // Extract canonical or raw project identifier from node
  const projectKey = useMemo(() => {
    if (!node) return null;
    return (
      (node as any).projectKey ||
      (node as any).project ||
      (node as any).projectId ||
      (node as any).category ||
      null
    );
  }, [node]);

  // Fetch Cross-Domain Live Bundle when node changes
  useEffect(() => {
    if (!isOpen || !node) {
      setBundle(null);
      return;
    }

    let isMounted = true;
    setIsLoadingBundle(true);
    setBundleError(null);

    fetchCrossJoin(projectKey || undefined)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          if ('ontology' in data && 'budget' in data) {
            setBundle(data as CrossDomainProjectBundle);
          } else {
            const reg = data as Record<string, CrossDomainProjectBundle>;
            const matched = projectKey && reg[projectKey]
              ? reg[projectKey]
              : Object.values(reg)[0] || null;
            setBundle(matched);
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setBundleError(err.message || '연계 데이터 조회 오류');
      })
      .finally(() => {
        if (isMounted) setIsLoadingBundle(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, node, projectKey, fetchCrossJoin]);

  if (!isOpen || !node) return null;

  const stage = getNodeStage(node);
  const stageTheme = STAGE_COLORS[stage] || STAGE_COLORS.POLICY_DIRECTIVE;
  const stageLabel = STAGE_LABELS[stage] || '1단계: 방침서 (정책기획)';

  // Upstream / Downstream Trace Handlers
  const handleTraceUpstream = () => {
    if (!graph) return;
    setIsTracing(true);
    const result = traceUpstream(node.id, graph);
    setUpstreamTrace(result);
    setActiveTab('trace');
    setIsTracing(false);
  };

  const handleTraceDownstream = () => {
    if (!graph) return;
    setIsTracing(true);
    const result = traceDownstream(node.id, graph);
    setDownstreamTrace(result);
    setActiveTab('trace');
    setIsTracing(false);
  };

  // Action 1: Open Archive Target (File or Containing Folder)
  const handleOpenArchive = async (targetPath: string | undefined, mode: 'file' | 'folder') => {
    if (!targetPath) {
      setActionFeedback({ type: 'error', text: '문서 경로가 지정되지 않았습니다.' });
      return;
    }
    setOpeningAction(mode);
    setActionFeedback(null);
    try {
      const res = await openArchiveTarget(targetPath, mode);
      if (!res.ok) {
        setActionFeedback({ type: 'error', text: res.error || '실행 요청 실패' });
      } else {
        setActionFeedback({
          type: 'success',
          text: mode === 'file' ? '문서 뷰어가 실행되었습니다.' : '폴더 탐색기가 실행되었습니다.',
        });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || '네트워크 요청 실패' });
    } finally {
      setOpeningAction(null);
      setTimeout(() => setActionFeedback(null), 3500);
    }
  };

  // Copy JSON Handler
  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(node, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Helper currency formatter
  const formatCurrency = (val?: number | null) => {
    if (typeof val !== 'number' || isNaN(val)) return '-';
    return `${val.toLocaleString()}원`;
  };

  // Check if current node is associated with Yangjae Festival
  const isYangjaeFestival = Boolean(
    bundle?.festivalAndContacts?.isFestivalProject ||
    node.title?.includes('양재천') ||
    node.title?.includes('페스티벌') ||
    (node as any).projectKey === '01_양재천_페스티벌' ||
    (node as any).project === '01_양재천_페스티벌'
  );

  return (
    <div
      role="dialog"
      aria-label="행정 문서 온톨로지 상세 정보"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900/95 border-l border-slate-800 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out text-slate-100"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-950/40">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${stageTheme.bg} ${stageTheme.text} ${stageTheme.border}`}
            >
              {stageLabel}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {node.id}
            </span>
            {'year' in node && node.year && (
              <span className="text-xs bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                {node.year}년
              </span>
            )}
          </div>
          <h2 className="text-sm font-bold text-slate-100 leading-snug break-words">
            {node.title}
          </h2>
          {'department' in node && (node as any).department && (
            <p className="text-xs text-slate-400 mt-1">
              소관: {(node as any).department}
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          aria-label="닫기"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 4-Phase Lifecycle Breadcrumb Bar */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/20 text-xs flex items-center justify-between gap-1 overflow-x-auto no-scrollbar shrink-0">
        <span
          className={`px-2 py-1 rounded text-[11px] font-medium shrink-0 ${
            stage === 'POLICY_DIRECTIVE'
              ? 'bg-blue-600 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          1. 방침
        </span>
        <span className="text-slate-600 shrink-0">→</span>
        <span
          className={`px-2 py-1 rounded text-[11px] font-medium shrink-0 ${
            stage === 'OUTCOME_REPORT'
              ? 'bg-emerald-600 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          2. 결과
        </span>
        <span className="text-slate-600 shrink-0">→</span>
        <span
          className={`px-2 py-1 rounded text-[11px] font-medium shrink-0 ${
            stage === 'AUDIT_REVIEW'
              ? 'bg-rose-600 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          3. 감사
        </span>
        <span className="text-slate-600 shrink-0">→</span>
        <span
          className={`px-2 py-1 rounded text-[11px] font-medium shrink-0 ${
            stage === 'BUDGET_PLAN'
              ? 'bg-purple-600 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          4. 예산
        </span>
      </div>

      {/* Tab Switcher (Rule S: 448px Responsive Horizontal Scroll) */}
      <div className="flex border-b border-slate-800 px-4 pt-2 bg-slate-950/20 overflow-x-auto no-scrollbar gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('details')}
          className={`pb-2 px-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'details'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          상세 속성
        </button>
        <button
          onClick={() => setActiveTab('cross-domain')}
          className={`pb-2 px-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1 ${
            activeTab === 'cross-domain'
              ? 'border-teal-500 text-teal-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>6대 도메인 연계</span>
          {bundle?.workingMemory?.pendingCount ? (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-300 font-bold">
              {bundle?.workingMemory?.pendingCount}
            </span>
          ) : null}
        </button>
        <button
          onClick={() => setActiveTab('trace')}
          className={`pb-2 px-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'trace'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          인과 순회 (Trace)
        </button>
        {isBudgetPlanEntity(node) && (
          <button
            onClick={() => setActiveTab('forensics')}
            className={`pb-2 px-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'forensics'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            예산 포렌식 검산
          </button>
        )}
      </div>

      {/* Floating Action Feedback Notification */}
      {actionFeedback && (
        <div
          className={`mx-4 mt-2 p-2 rounded text-xs flex items-center justify-between border ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
              : 'bg-rose-950/80 border-rose-700 text-rose-200'
          }`}
        >
          <span>{actionFeedback.text}</span>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-slate-200 ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ================================================================= */}
        {/* TAB 1: Details View */}
        {/* ================================================================= */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Quick Cross-Domain Access Bar */}
            <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                <span>전사 도메인 연계 퀵 점프</span>
                <button
                  onClick={() => setActiveTab('cross-domain')}
                  className="text-[10px] text-teal-400 hover:underline"
                >
                  통합 뷰 보기 →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {node.sourceDocPath && (
                  <>
                    <button
                      data-testid="btn-open-source-file"
                      onClick={() => handleOpenArchive(node.sourceDocPath, 'file')}
                      disabled={openingAction === 'file'}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 truncate"
                    >
                      <span>📄</span>
                      <span className="truncate">원본 공문서 열기</span>
                    </button>
                    <button
                      data-testid="btn-open-source-folder"
                      onClick={() => handleOpenArchive(node.sourceDocPath, 'folder')}
                      disabled={openingAction === 'folder'}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 truncate"
                    >
                      <span>📁</span>
                      <span className="truncate">폴더 위치 열기</span>
                    </button>
                  </>
                )}
                <button
                  data-testid="btn-jump-memory"
                  onClick={() => onNavigateModule?.('memory')}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 truncate"
                >
                  <span>📝</span>
                  <span className="truncate">작업기억 보드로 이동 ({bundle?.workingMemory?.pendingCount ?? 0})</span>
                </button>
                <button
                  data-testid="btn-jump-workspace"
                  onClick={() => onNavigateModule?.('workspace')}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 truncate"
                >
                  <span>📊</span>
                  <span className="truncate">예산관리로 이동 ({bundle?.budget?.executionRate ?? 0}%)</span>
                </button>
                <button
                  data-testid="btn-jump-simulator"
                  onClick={() => onNavigateModule?.('simulator')}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 truncate"
                >
                  <span>⚡</span>
                  <span className="truncate">예산 시뮬레이터로 이동</span>
                </button>
                <button
                  data-testid="btn-jump-weekly"
                  onClick={() => onSwitchTab?.('weekly')}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 truncate"
                >
                  <span>📅</span>
                  <span className="truncate">수요일 주간업무 작성으로 이동</span>
                </button>
                {isYangjaeFestival && (
                  <button
                    data-testid="btn-jump-festival"
                    onClick={() => onNavigateModule?.('festival')}
                    className="p-1.5 rounded bg-teal-900/40 hover:bg-teal-800/60 text-teal-200 border border-teal-700 flex items-center gap-1 truncate col-span-2"
                  >
                    <span>✨</span>
                    <span className="truncate">양재천 페스티벌 관제 모듈로 이동</span>
                  </button>
                )}
              </div>
            </div>

            {/* 1. Policy Details */}
            {isPolicyEntity(node) && (
              <div className="space-y-3">
                <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60">
                  <div className="text-xs text-slate-400 mb-1">총 사업예산 한도</div>
                  <div className="text-lg font-bold text-blue-400">
                    {formatCurrency(node.budgetAmount)}
                  </div>
                </div>

                {node.objectives && node.objectives.length > 0 && (
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                    <div className="text-xs font-semibold text-slate-300 mb-2">
                      주요 사업목표 (Objectives)
                    </div>
                    <ul className="text-xs space-y-1.5 text-slate-300 list-disc list-inside">
                      {node.objectives.map((obj, idx) => (
                        <li key={idx}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {node.targetQuotas && node.targetQuotas.length > 0 && (
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                    <div className="text-xs font-semibold text-slate-300 mb-2">
                      정량 목표치 (KPI)
                    </div>
                    <div className="space-y-1">
                      {node.targetQuotas.map((q, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-slate-300">
                          <span>{q.kpi}</span>
                          <span className="font-semibold text-blue-400">
                            {q.targetValue.toLocaleString()} {q.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Outcome Details */}
            {isOutcomeEntity(node) && (
              <div className="space-y-3">
                <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">목표 달성 및 집행률</span>
                    <span className="text-xs font-bold text-emerald-400">
                      {node.executionRate}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${Math.min(node.executionRate, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-300 pt-1">
                    <span>실집행액: {formatCurrency(node.spentBudget)}</span>
                    {node.budgetExecution && (
                      <span className="text-slate-400">
                        잔액: {formatCurrency(node.budgetExecution.balance)}
                      </span>
                    )}
                  </div>
                </div>

                {node.achievements && node.achievements.length > 0 && (
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                    <div className="text-xs font-semibold text-slate-300 mb-2">
                      주요 성과 요약 (Achievements)
                    </div>
                    <ul className="text-xs space-y-1.5 text-slate-300 list-disc list-inside">
                      {node.achievements.map((ach, idx) => (
                        <li key={idx}>{ach}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {node.policyId && (
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40 flex justify-between items-center">
                    <span className="text-xs text-slate-400">모체 방침서 연계</span>
                    <button
                      onClick={() => onSelectNode?.(node.policyId)}
                      className="text-xs text-blue-400 hover:underline font-mono"
                    >
                      {node.policyId} →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. Audit Details */}
            {isAuditEntity(node) && (
              <div className="space-y-3">
                <div className="bg-rose-950/30 p-3 rounded-lg border border-rose-800/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-rose-300 font-semibold">감사 지적 요지</span>
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {node.severity || 'WARNING'}
                    </span>
                  </div>
                  <p className="text-xs text-rose-200 mt-1 leading-relaxed">
                    {node.critiqueTitle || node.title}
                  </p>
                </div>

                {node.auditFindings && node.auditFindings.length > 0 && (
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                    <div className="text-xs font-semibold text-slate-300 mb-2">
                      지적사항 전문 (Audit Findings)
                    </div>
                    <ul className="text-xs space-y-1 text-slate-300 list-disc list-inside">
                      {node.auditFindings.map((f, idx) => (
                        <li key={idx}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {node.correctiveMandates && node.correctiveMandates.length > 0 && (
                  <div className="bg-amber-950/30 p-3 rounded-lg border border-amber-800/50">
                    <div className="text-xs font-semibold text-amber-300 mb-2">
                      시정·개선 조치 요구 (Corrective Mandates)
                    </div>
                    <ul className="text-xs space-y-1 text-amber-200 list-disc list-inside">
                      {node.correctiveMandates.map((m, idx) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {node.auditedOutcomeId && (
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40 flex justify-between items-center">
                    <span className="text-xs text-slate-400">피지적 결과보고서 연계</span>
                    <button
                      onClick={() => onSelectNode?.(node.auditedOutcomeId)}
                      className="text-xs text-emerald-400 hover:underline font-mono"
                    >
                      {node.auditedOutcomeId} →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 4. BudgetPlan Details */}
            {isBudgetPlanEntity(node) && (
              <div className="space-y-3">
                <div className="bg-purple-950/30 p-3 rounded-lg border border-purple-800/50">
                  <div className="text-xs text-purple-300 mb-1">차년도 총 사업비 편성액</div>
                  <div className="text-xl font-bold text-purple-300">
                    {formatCurrency(node.totalBudget)}
                  </div>
                </div>

                <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                  <div className="text-xs font-semibold text-slate-300 mb-2">소요재원 분담 (기금·시비·구비)</div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-900/50 p-2 rounded">
                      <div className="text-slate-400 text-[10px]">기금</div>
                      <div className="font-semibold text-slate-200">
                        {formatCurrency(node.fundingSources?.fund)}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 p-2 rounded">
                      <div className="text-slate-400 text-[10px]">시비</div>
                      <div className="font-semibold text-slate-200">
                        {formatCurrency(node.fundingSources?.city)}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 p-2 rounded">
                      <div className="text-slate-400 text-[10px]">구비</div>
                      <div className="font-semibold text-purple-300">
                        {formatCurrency(node.fundingSources?.district)}
                      </div>
                    </div>
                  </div>
                </div>

                {node.itemizedBreakdown && node.itemizedBreakdown.length > 0 && (
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                    <div className="text-xs font-semibold text-slate-300 mb-2">
                      산출내역 목·세목 (Itemized Breakdown)
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {node.itemizedBreakdown.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center py-1 border-b border-slate-800/60 last:border-none"
                        >
                          <span className="text-slate-300">{item.item}</span>
                          <span className="font-semibold text-purple-400">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {node.remediatedAuditIds && node.remediatedAuditIds.length > 0 && (
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                    <div className="text-xs font-semibold text-slate-300 mb-2">
                      반영된 감사 지적사항 (Remediated Audits)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {node.remediatedAuditIds.map((aid) => (
                        <button
                          key={aid}
                          onClick={() => onSelectNode?.(aid)}
                          className="px-2 py-0.5 rounded text-xs bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 font-mono"
                        >
                          {aid} →
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. Weekly Work Details */}
            {isWeeklyWorkEntity(node) && (
              <div className="space-y-3">
                <div className="bg-amber-950/30 p-3 rounded-lg border border-amber-800/50">
                  <div className="flex justify-between text-xs text-amber-300 mb-1">
                    <span>주간업무 구분</span>
                    <span className="font-bold uppercase">{node.status}</span>
                  </div>
                  <div className="text-sm font-semibold text-amber-200">
                    {node.category}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    작성일자: {node.date}
                  </div>
                </div>

                {node.relatedPolicyId && (
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40 flex justify-between items-center">
                    <span className="text-xs text-slate-400">관련 정책 방침 연계</span>
                    <button
                      onClick={() => {
                        if (node.relatedPolicyId) onSelectNode?.(node.relatedPolicyId);
                      }}
                      className="text-xs text-blue-400 hover:underline font-mono"
                    >
                      {node.relatedPolicyId} →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: 6-Domain Cross-Join Action Hub */}
        {/* ================================================================= */}
        {activeTab === 'cross-domain' && (
          <div className="space-y-4">
            {isLoadingBundle && (
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/60 text-xs text-slate-400 flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                <span>6대 도메인 자산 집계 중</span>
              </div>
            )}

            {effectiveBundleError && (
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 text-xs text-rose-300">
                연계 지표 로드 실패: {effectiveBundleError} (로컬 캐시 기준 표시)
              </div>
            )}

            {/* Action 1: Original File & Containing Folder Launcher */}
            <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/70 space-y-2.5">
              <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>📁</span>
                  <span>1. 원본 공문서 · 폴더 실행</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {node.sourceDocPath ? node.sourceDocPath.split(/[\\/]/).pop() : '경로 미지정'}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                실무 폴더 · 마스터 아카이브 원본(HWPX · PDF) · 위치 열기
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  data-testid="btn-tab-open-source-file"
                  onClick={() => handleOpenArchive(node.sourceDocPath, 'file')}
                  disabled={!node.sourceDocPath || openingAction === 'file'}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <span>📄</span>
                  <span>{openingAction === 'file' ? '문서 실행 중...' : '원본 공문서 열기'}</span>
                </button>
                <button
                  data-testid="btn-tab-open-source-folder"
                  onClick={() => handleOpenArchive(node.sourceDocPath, 'folder')}
                  disabled={!node.sourceDocPath || openingAction === 'folder'}
                  className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <span>📁</span>
                  <span>{openingAction === 'folder' ? '폴더 탐색 중...' : '폴더 위치 열기'}</span>
                </button>
              </div>
              {node.sourceDocPath && (
                <div className="text-[10px] text-slate-400 font-mono bg-slate-950/60 p-1.5 rounded truncate">
                  {node.sourceDocPath}
                </div>
              )}
            </div>

            {/* Action 2: Working Memory Postits Display & Jump */}
            <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/70 space-y-2.5">
              <div className="text-xs font-bold text-amber-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>📝</span>
                  <span>2. 연관 작업기억 포스트잇 지시사항</span>
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  미반영 {bundle?.workingMemory?.pendingCount ?? 0}건
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                연관 긴급 지시 · 포스트잇 메모 조회
              </p>

              {bundle?.workingMemory?.urgentDirectives && bundle.workingMemory.urgentDirectives.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-rose-300">🚨 긴급 처리 지시</div>
                  {bundle.workingMemory.urgentDirectives.slice(0, 2).map((memo) => (
                    <div key={memo.id} className="text-xs bg-rose-950/30 border border-rose-800/40 p-2 rounded text-rose-200 truncate">
                      • {memo.content}
                    </div>
                  ))}
                </div>
              )}

              {bundle?.workingMemory?.pendingMemos && bundle.workingMemory.pendingMemos.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-300">최근 대기 메모</div>
                  {bundle.workingMemory.pendingMemos.slice(0, 2).map((memo) => (
                    <div key={memo.id} className="text-xs bg-slate-900/60 border border-slate-800 p-2 rounded text-slate-300 truncate">
                      • {memo.content}
                    </div>
                  ))}
                </div>
              )}

              <button
                data-testid="btn-tab-jump-memory"
                onClick={() => onNavigateModule?.('memory')}
                className="w-full px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
              >
                <span>📝</span>
                <span>작업기억 보드 이동 (미반영 {bundle?.workingMemory?.pendingCount ?? 0}건)</span>
              </button>
            </div>

            {/* Action 3: Live e-Hojo Budget Execution Rate & Simulator Jump */}
            <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/70 space-y-2.5">
              <div className="text-xs font-bold text-blue-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>📊</span>
                  <span>3. e-호조 실시간 집행률 · 시뮬레이터</span>
                </span>
                <span className="text-xs font-bold text-blue-400">
                  집행률 {bundle?.budget?.executionRate?.toFixed(1) ?? 0}%
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                일반지출 · 일상경비 실집행 · 불용 위험 대조
              </p>

              <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    (bundle?.budget?.executionRate ?? 0) > 90
                      ? 'bg-rose-500'
                      : (bundle?.budget?.executionRate ?? 0) > 70
                      ? 'bg-emerald-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(bundle?.budget?.executionRate ?? 0, 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">총 편성액</div>
                  <div className="font-bold text-slate-200">
                    {formatCurrency(bundle?.budget?.totalBudget)}
                  </div>
                </div>
                <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">실집행액 (일반+교부)</div>
                  <div className="font-bold text-blue-400">
                    {formatCurrency(bundle?.budget?.spentBudget)}
                  </div>
                </div>
                <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">일상경비 미집행 잔액</div>
                  <div className="font-bold text-emerald-400">
                    {formatCurrency(bundle?.budget?.dailyExpenseRemaining)}
                  </div>
                </div>
                <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">시뮬레이터 예정 잔액</div>
                  <div className={`font-bold ${bundle?.budget?.isDeficit ? 'text-rose-400' : 'text-slate-200'}`}>
                    {formatCurrency(bundle?.budget?.finalExpectedBalance)}
                  </div>
                </div>
              </div>

              {bundle?.budget?.categories && bundle.budget.categories.length > 0 && (
                <div className="bg-slate-900/40 p-2 rounded border border-slate-800/80 space-y-1">
                  <div className="text-[10px] font-semibold text-slate-400">소관 주요 비목</div>
                  <div className="space-y-0.5 text-[11px]">
                    {bundle.budget.categories.slice(0, 3).map((cat) => (
                      <div key={cat.id} className="flex justify-between text-slate-300">
                        <span className="truncate max-w-[180px]">{cat.name}</span>
                        <span className="font-mono text-slate-400">{formatCurrency(cat.totalBudget)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  data-testid="btn-tab-jump-workspace"
                  onClick={() => onNavigateModule?.('workspace')}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <span>📊</span>
                  <span>예산관리 이동</span>
                </button>
                <button
                  data-testid="btn-tab-jump-simulator"
                  onClick={() => onNavigateModule?.('simulator')}
                  className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <span>⚡</span>
                  <span>예산 시뮬레이터 이동</span>
                </button>
              </div>
            </div>

            {/* Action 4: Wednesday Weekly Report Status & Switch Tab */}
            <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/70 space-y-2.5">
              <div className="text-xs font-bold text-emerald-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>📅</span>
                  <span>4. 수요일 주간업무 HWPX 집계</span>
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {bundle?.weeklyWork?.latestHwpxAvailable ? '✓ HWPX 작성완료' : '누적 기록 중'}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                수요일 주간 실적 · 계획 조회 · HWPX 조판
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">누적 보고 건수</div>
                  <div className="font-bold text-slate-200">
                    {bundle?.weeklyWork?.reportsCount ?? 0}건
                  </div>
                </div>
                <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">최신 보고일자</div>
                  <div className="font-bold text-emerald-400 truncate">
                    {bundle?.weeklyWork?.latestReportDate || '최근 내역 없음'}
                  </div>
                </div>
              </div>

              {bundle?.weeklyWork?.recentItems && bundle.weeklyWork.recentItems.length > 0 && (
                <div className="bg-slate-900/40 p-2 rounded border border-slate-800/80 space-y-1">
                  <div className="text-[10px] font-semibold text-slate-400">최근 실적 요약</div>
                  {bundle.weeklyWork.recentItems.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="text-[11px] text-slate-300 truncate">
                      • [{item.status === 'performance' ? '실적' : '계획'}] {item.contents?.[0] || item.projectName}
                    </div>
                  ))}
                </div>
              )}

              <button
                data-testid="btn-tab-jump-weekly"
                onClick={() => onSwitchTab?.('weekly')}
                className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
              >
                <span>📅</span>
                <span>수요일 주간업무 작성 이동</span>
              </button>
            </div>

            {/* Action 5: Yangjae Festival Booth/Duty Status OR Contacts */}
            {isYangjaeFestival ? (
              <div className="bg-teal-950/40 p-3 rounded-lg border border-teal-800/60 space-y-2.5">
                <div className="text-xs font-bold text-teal-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>✨</span>
                    <span>5. 2026 양재천 건강 페스티벌 현장 관제</span>
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40">
                    공정률 {bundle?.festivalAndContacts?.festivalSummary?.progress ?? 85}%
                  </span>
                </div>
                <p className="text-xs text-teal-200/80 leading-relaxed">
                  448px 모바일 관제 · 추진과제 · 부스 · 분장 · 식순
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/60 p-2 rounded border border-teal-900/60">
                    <div className="text-slate-400 text-[10px]">운영 체험 부스</div>
                    <div className="font-bold text-teal-300">
                      {bundle?.festivalAndContacts?.festivalSummary?.boothsCount ?? 20}곳
                    </div>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded border border-teal-900/60">
                    <div className="text-slate-400 text-[10px]">현장 근무 인력</div>
                    <div className="font-bold text-teal-300">
                      {bundle?.festivalAndContacts?.festivalSummary?.dutiesCount ?? 35}명
                    </div>
                  </div>
                </div>

                <button
                  data-testid="btn-tab-jump-festival"
                  onClick={() => onNavigateModule?.('festival')}
                  className="w-full px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <span>✨</span>
                  <span>양재천 페스티벌 관제 이동</span>
                </button>
              </div>
            ) : (
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/70 space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>📞</span>
                    <span>5. 소관 사업 담당자 연락처 (Rule Q 비식별화)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">보건행정과</span>
                </div>
                {bundle?.festivalAndContacts?.assignedContacts && bundle.festivalAndContacts.assignedContacts.length > 0 ? (
                  <div className="space-y-1.5 text-xs">
                    {bundle.festivalAndContacts.assignedContacts.slice(0, 3).map((c, idx) => (
                      <div key={idx} className="flex justify-between items-center text-slate-300 py-0.5 border-b border-slate-800/60 last:border-none">
                        <span className="font-medium">{c.name} {c.role ? `(${c.role})` : ''}</span>
                        <span className="font-mono text-blue-400">{c.phone}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">등록 담당자 없음</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: Causal Trace View */}
        {/* ================================================================= */}
        {activeTab === 'trace' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleTraceUpstream}
                disabled={isTracing}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
              >
                <span>↑</span>
                <span>상향 역추적</span>
              </button>
              <button
                onClick={handleTraceDownstream}
                disabled={isTracing}
                className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
              >
                <span>↓</span>
                <span>하향 순추적</span>
              </button>
            </div>

            {upstreamTrace && (
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 space-y-2">
                <div className="text-xs font-bold text-blue-400 flex items-center justify-between">
                  <span>상향 인과 경로</span>
                  <span className="text-[10px] text-slate-400">
                    {upstreamTrace.path.length}개 노선 경유
                  </span>
                </div>
                <div className="space-y-2">
                  {upstreamTrace.path.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => onSelectNode?.(step.nodeId)}
                          className="text-slate-200 hover:text-blue-400 font-medium text-left break-words block"
                        >
                          {step.title}
                        </button>
                        <div className="text-[10px] text-slate-400 font-mono">
                          [{step.nodeType}] {step.nodeId}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {downstreamTrace && (
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 space-y-2">
                <div className="text-xs font-bold text-emerald-400 flex items-center justify-between">
                  <span>하향 인과 경로</span>
                  <span className="text-[10px] text-slate-400">
                    {downstreamTrace.path.length}개 노선 경유
                  </span>
                </div>
                <div className="space-y-2">
                  {downstreamTrace.path.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => onSelectNode?.(step.nodeId)}
                          className="text-slate-200 hover:text-emerald-400 font-medium text-left break-words block"
                        >
                          {step.title}
                        </button>
                        <div className="text-[10px] text-slate-400 font-mono">
                          [{step.nodeType}] {step.nodeId}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: Forensic Budget Audit View */}
        {/* ================================================================= */}
        {activeTab === 'forensics' && isBudgetPlanEntity(node) && (
          <div className="space-y-3">
            <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 space-y-2">
              <div className="text-xs font-bold text-purple-300">
                Rule R: 0원 오차 수리적 무결성 점검
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                총사업비 = 소요재원 합계 = 산출내역 천원 올림 합산 대조
              </p>

              {(() => {
                const sourcesSum =
                  (node.fundingSources?.fund || 0) +
                  (node.fundingSources?.city || 0) +
                  (node.fundingSources?.district || 0);

                const itemizedCeilSum = (node.itemizedBreakdown || []).reduce(
                  (acc, it) => acc + Math.ceil(it.amount / 1000) * 1000,
                  0
                );

                const disc1 = Math.abs(node.totalBudget - sourcesSum);
                const disc2 = Math.abs(node.totalBudget - itemizedCeilSum);
                const isZeroError = disc1 === 0 && disc2 === 0;

                return (
                  <div
                    className={`p-3 rounded border text-xs space-y-1.5 ${
                      isZeroError
                        ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                    }`}
                  >
                    <div className="flex justify-between items-center font-bold">
                      <span>검산 판정</span>
                      <span>{isZeroError ? '✓ 0원 오차 무결점 통과' : '⚠ 오차 발생'}</span>
                    </div>
                    <div className="text-[11px] space-y-0.5">
                      <div className="flex justify-between">
                        <span>총 편성요구액:</span>
                        <span>{(node.totalBudget ?? 0).toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between">
                        <span>소요재원 합계:</span>
                        <span>{sourcesSum.toLocaleString()}원 (오차 {disc1}원)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>목·세목 천원올림 합계:</span>
                        <span>{itemizedCeilSum.toLocaleString()}원 (오차 {disc2}원)</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <button
                data-testid="btn-forensics-jump-simulator"
                onClick={() => onNavigateModule?.('simulator')}
                className="w-full mt-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
              >
                <span>⚡</span>
                <span>예산 시뮬레이터에서 번다운 시뮬레이션</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer (Rule S: 448px Responsive Compact Action Row) */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 gap-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="truncate max-w-[150px] sm:max-w-[200px]" title={node.sourceDocPath || '로컬 아카이브 연계'}>
            {node.sourceDocPath ? node.sourceDocPath.split(/[\\/]/).pop() : '로컬 아카이브 연계'}
          </span>
          {node.sourceDocPath && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleOpenArchive(node.sourceDocPath, 'file')}
                disabled={openingAction === 'file'}
                title="기본 뷰어로 파일 실행"
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-blue-600 text-slate-200 text-[10px] transition-colors"
              >
                {openingAction === 'file' ? '...' : '문서'}
              </button>
              <button
                onClick={() => handleOpenArchive(node.sourceDocPath, 'folder')}
                disabled={openingAction === 'folder'}
                title="윈도우 탐색기에서 위치 열기"
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] transition-colors"
              >
                {openingAction === 'folder' ? '...' : '폴더'}
              </button>
            </div>
          )}
        </div>
        <button
          onClick={handleCopyJson}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors shrink-0 text-xs"
        >
          {copiedJson ? '✓ 복사됨' : 'JSON 복사'}
        </button>
      </div>
    </div>
  );
};

export default AdminOntologyDrawer;
