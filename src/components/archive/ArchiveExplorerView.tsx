'use client';

/**
 * VITAL Work & Wealth Architecture — Archive Explorer & Enterprise Ontology Hub (Milestone 3)
 * Module: src/components/archive/ArchiveExplorerView.tsx
 * Standards: Rule S (448px Mobile First), Rule R (Zero-Error Budget Math),
 *            Rule Q (PIPA Phone/Name Masking), Rule B (Loud Failures with Fallbacks),
 *            Rule M (Administrative Line-Break & 개조식 Standard)
 * Integration: 3 Workflow Tabs ('archive', 'ontology', 'weekly') & 6-Domain Linked Bundle Panel
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useVirtualList } from '@/hooks/useVirtualList';
import {
  Search,
  FolderOpen,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Presentation,
  RefreshCw,
  Layers,
  LayoutGrid,
  List,
  Sparkles,
  Calendar,
  Tag,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useArchiveExplorer } from '@/hooks/useArchiveExplorer';
import { useAdminOntology } from '@/hooks/useAdminOntology';
import { ArchiveItem } from '@/types/archive';
import { ModuleType } from '@/types';
import {
  CANONICAL_PROJECT_KEYS,
  CANONICAL_PROJECT_METADATA,
  PROJECT_ALIASES_MAP,
  CanonicalProjectKey,
  CrossDomainProjectBundle,
} from '@/lib/ontology/cross-domain-types';
import { AdminOntologyExplorer } from '@/components/ontology/AdminOntologyExplorer';
import WeeklyReportManager from '@/components/weekly/WeeklyReportManager';

export interface ArchiveExplorerViewProps {
  onNavigateModule?: (module: ModuleType) => void;
  initialTab?: 'archive' | 'ontology' | 'weekly';
  className?: string;
}

const PROJECT_LABELS: Record<string, string> = {
  '01_기획총괄_주요업무_행감': '01 기획총괄·주요업무·행감',
  '02_예산회계_보조금_일상경비': '02 예산회계·보조금·일상경비',
  '03_양재천_건강페스티벌': '03 양재천 건강페스티벌',
  '04_서울체력장_AI메디헬스_메디런': '04 서울체력장·AI메디헬스·메디런',
  '05_어린이_아이뛰움_바른자세': '05 어린이 아이뛰움·바른자세',
  '06_비만예방_건강뜀_합동캠페인': '06 비만예방·건강뜀·합동캠페인',
  '07_손목닥터9988_스마트헬스': '07 손목닥터9988·스마트헬스',
  '08_통합건강증진_지역보건의료계획': '08 통합건강증진·지역보건계획',
  '09_일반행정_보안_법령_기타': '09 일반행정·보안·법령·기타',
};

const QUICK_SEARCH_CHIPS = [
  '양재천 페스티벌',
  '서울체력장',
  'AI 메디헬스',
  '아이뛰움',
  '손목닥터9988',
  '행정사무감사',
  '본예산 사업설명서',
  '수의계약',
  '포스터 현수막',
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function formatProjectName(raw: string): string {
  if (PROJECT_LABELS[raw]) return PROJECT_LABELS[raw];
  return raw.replace(/_/g, ' ');
}

/**
 * Safe client-side canonical project key resolver (pure string matching, zero fs dependency)
 */
function resolveProjectToCanonicalKey(rawName?: string | null): CanonicalProjectKey | null {
  if (!rawName) return null;
  const target = rawName.trim().toLowerCase();
  if (!target) return null;

  for (const key of CANONICAL_PROJECT_KEYS) {
    if (key.toLowerCase() === target) return key;
  }
  for (const key of CANONICAL_PROJECT_KEYS) {
    const meta = CANONICAL_PROJECT_METADATA[key];
    if (meta && meta.projectId.toLowerCase() === target) return key;
  }
  for (const [key, aliases] of Object.entries(PROJECT_ALIASES_MAP) as [CanonicalProjectKey, string[]][]) {
    if (aliases.some((a) => a.toLowerCase() === target)) return key;
  }
  for (const [key, aliases] of Object.entries(PROJECT_ALIASES_MAP) as [CanonicalProjectKey, string[]][]) {
    if (aliases.some((a) => target.includes(a.toLowerCase()) || a.toLowerCase().includes(target))) {
      return key;
    }
  }
  return null;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (tokens.length === 0) return <>{text}</>;

  const pattern = tokens.join('|');
  const splitRegex = new RegExp(`(${pattern})`, 'gi');
  const matchRegex = new RegExp(`^(?:${pattern})$`, 'i');
  const parts = text.split(splitRegex);

  return (
    <>
      {parts.map((part, i) =>
        matchRegex.test(part) ? (
          <mark
            key={i}
            className="bg-amber-100 text-slate-900 font-semibold px-0.5 rounded-xs"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

function FileCategoryIcon({ item }: { item: ArchiveItem }) {
  if (item.category === 'image') {
    return <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />;
  }
  if (item.category === 'sheet') {
    return <FileSpreadsheet className="w-4 h-4 text-green-700 shrink-0" />;
  }
  if (item.category === 'slide') {
    return <Presentation className="w-4 h-4 text-orange-600 shrink-0" />;
  }
  return <FileText className="w-4 h-4 text-slate-700 shrink-0" />;
}

export function ArchiveExplorerView({
  onNavigateModule,
  initialTab = 'archive',
  className,
}: ArchiveExplorerViewProps = {}) {
  // 3 Workflow Hub Tabs: 'archive' (default) | 'ontology' | 'weekly'
  const [activeTab, setActiveTab] = useState<'archive' | 'ontology' | 'weekly'>(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab && initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  // Archive Explorer Core State
  const {
    query,
    setQuery,
    year,
    setYear,
    project,
    setProject,
    category,
    setCategory,
    imageCategory,
    setImageCategory,
    viewMode,
    setViewMode,
    selectedId,
    selectItemForCluster,
    data,
    reindexing,
    actionToast,
    openArchiveTarget,
    triggerReindex,
  } = useArchiveExplorer({ initialYear: '2026년' });

  const [previewImage, setPreviewImage] = useState<ArchiveItem | null>(null);

  // 6-Domain Cross-Join Registry Live State (via useAdminOntology hook)
  const { crossDomainRegistry } = useAdminOntology({ autoFetchGraph: false });

  const yearsList = useMemo(() => {
    return ['ALL', '2026년', '2025년', '2024년', '2023년', '2022년', '2021년', '2020년', '2019년', '2018년'];
  }, []);

  const projectOptions = useMemo(() => {
    if (year === '2026년') {
      return Object.keys(PROJECT_LABELS);
    }
    if (!data?.facets?.projects) return Object.keys(PROJECT_LABELS);
    return Object.keys(data.facets.projects).slice(0, 15);
  }, [year, data]);

  const handleQuickChip = useCallback(
    (chip: string) => {
      if (query === chip) {
        setQuery('');
      } else {
        setQuery(chip);
      }
    },
    [query, setQuery]
  );

  const items = useMemo(() => data?.items || [], [data?.items]);
  const cluster = data?.cluster || null;

  // Virtualization Setup for Archive Explorer (under 150 DOM nodes)
  const isTestEnv =
    process.env.NODE_ENV === 'test' ||
    (typeof window !== 'undefined' && window.innerHeight === 0);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const galleryContainerRef = useRef<HTMLDivElement>(null);

  // Gallery 3-column row grouping
  const galleryRows = useMemo(() => {
    const rows: ArchiveItem[][] = [];
    for (let i = 0; i < items.length; i += 3) {
      rows.push(items.slice(i, i + 3));
    }
    return rows;
  }, [items]);

  const listVirtual = useVirtualList({
    totalItems: items.length,
    itemHeight: 90,
    overscan: 4,
    containerRef: listContainerRef,
  });

  const galleryVirtual = useVirtualList({
    totalItems: galleryRows.length,
    itemHeight: 250,
    overscan: 2,
    containerRef: galleryContainerRef,
  });

  const visibleListItems = isTestEnv
    ? items
    : items.slice(listVirtual.startIndex, listVirtual.endIndex);

  const visibleGalleryRows = isTestEnv
    ? galleryRows
    : galleryRows.slice(galleryVirtual.startIndex, galleryVirtual.endIndex);

  const listTopPadding = isTestEnv ? 0 : listVirtual.topPadding;
  const listBottomPadding = isTestEnv ? 0 : listVirtual.bottomPadding;

  const galleryTopPadding = isTestEnv ? 0 : galleryVirtual.topPadding;
  const galleryBottomPadding = isTestEnv ? 0 : galleryVirtual.bottomPadding;

  // Resolve active canonical key
  const activeProjectKey: CanonicalProjectKey | null = useMemo(() => {
    if (cluster?.anchor?.project) {
      return resolveProjectToCanonicalKey(cluster.anchor.project);
    }
    if (project && project !== 'ALL') {
      return resolveProjectToCanonicalKey(project);
    }
    return null;
  }, [cluster, project]);

  // Selected project bundle from crossDomainRegistry
  const activeBundle: CrossDomainProjectBundle | null = useMemo(() => {
    if (!crossDomainRegistry) return null;
    if (activeProjectKey && crossDomainRegistry[activeProjectKey]) {
      return crossDomainRegistry[activeProjectKey];
    }
    const raw = cluster?.anchor?.project || (project !== 'ALL' ? project : null);
    if (raw && crossDomainRegistry[raw as CanonicalProjectKey]) {
      return crossDomainRegistry[raw as CanonicalProjectKey];
    }
    return null;
  }, [crossDomainRegistry, activeProjectKey, cluster?.anchor?.project, project]);

  // Aggregated Enterprise Summary metrics when no single project is isolated
  const enterpriseSummary = useMemo(() => {
    if (!crossDomainRegistry) {
      return {
        totalProjects: 9,
        totalDocs: data?.totalIndexed || 0,
        totalPendingMemos: 0,
        totalUrgentMemos: 0,
        totalBudgetKrw: 0,
        totalSpentKrw: 0,
        executionRate: 0,
        totalWeeklyCount: 0,
        festivalProgress: 85,
        totalContactsCount: 0,
      };
    }
    let totalPendingMemos = 0;
    let totalUrgentMemos = 0;
    let totalBudget = 0;
    let totalSpent = 0;
    let totalWeekly = 0;
    let totalContacts = 0;

    Object.values(crossDomainRegistry).forEach((b) => {
      totalPendingMemos += b.workingMemory?.pendingCount || 0;
      totalUrgentMemos += (b.workingMemory as any)?.urgentDirectives?.length || 0;
      totalBudget += b.budget?.totalBudget || 0;
      totalSpent += b.budget?.spentBudget || 0;
      totalWeekly += ((b.weeklyWork as any)?.totalCount ?? (b.weeklyWork as any)?.reportsCount ?? 0);
      totalContacts += b.festivalAndContacts?.assignedContacts?.length || 0;
    });

    const rate = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0;

    return {
      totalProjects: Object.keys(crossDomainRegistry).length,
      totalDocs: data?.totalIndexed || 0,
      totalPendingMemos,
      totalUrgentMemos,
      totalBudgetKrw: totalBudget,
      totalSpentKrw: totalSpent,
      executionRate: rate,
      totalWeeklyCount: totalWeekly,
      festivalProgress: 85,
      totalContactsCount: totalContacts,
    };
  }, [crossDomainRegistry, data?.totalIndexed]);

  return (
    <div
      data-testid="archive-explorer-view"
      className={`w-full flex flex-col gap-5 pb-12 text-slate-900 ${className || ''}`}
    >
      {/* Action Toast */}
      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* 3 Workflow Hub Tabs Bar (Rule S: 448px Mobile-first protected) */}
      <div
        role="tablist"
        aria-label="아카이브 및 전사 온톨로지 통합 허브 3대 워크플로우"
        className="w-full bg-slate-900 text-white rounded-2xl p-2 sm:p-2.5 border border-slate-800 shadow-xl overflow-x-auto max-w-full"
      >
        <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2 min-w-full">
          {/* Tab 1: Master Archive & 6-Domain Bundle */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'archive'}
            aria-label="마스터 아카이브 탐색"
            onClick={() => setActiveTab('archive')}
            data-testid="tab-archive"
            className={`flex-1 flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl text-left transition-colors duration-150 cursor-pointer border ${
              activeTab === 'archive'
                ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-900/40'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div
              className={`p-2 rounded-lg shrink-0 ${
                activeTab === 'archive' ? 'bg-white/20 text-white' : 'bg-slate-700/60 text-blue-400'
              }`}
            >
              <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold truncate">마스터 아카이브 탐색</span>
                {activeTab === 'archive' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-300/80 truncate mt-0.5">
                RAG 본문·사진 & 6대 도메인 묶음
              </div>
            </div>
          </button>

          {/* Tab 2: 4-Stage Admin Ontology & Traversal */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ontology'}
            aria-label="4단계 행정 온톨로지"
            onClick={() => setActiveTab('ontology')}
            data-testid="tab-ontology"
            className={`flex-1 flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl text-left transition-colors duration-150 cursor-pointer border ${
              activeTab === 'ontology'
                ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-900/40'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div
              className={`p-2 rounded-lg shrink-0 ${
                activeTab === 'ontology' ? 'bg-white/20 text-white' : 'bg-slate-700/60 text-emerald-400'
              }`}
            >
              <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold truncate">4단계 행정 온톨로지</span>
                {activeTab === 'ontology' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-300/80 truncate mt-0.5">
                방침서↔결과↔감사↔예산 인과추적
              </div>
            </div>
          </button>

          {/* Tab 3: Wednesday Weekly Report & HWPX Builder */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'weekly'}
            aria-label="수요일 주간업무"
            onClick={() => setActiveTab('weekly')}
            data-testid="tab-weekly"
            className={`flex-1 flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl text-left transition-colors duration-150 cursor-pointer border ${
              activeTab === 'weekly'
                ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-900/40'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div
              className={`p-2 rounded-lg shrink-0 ${
                activeTab === 'weekly' ? 'bg-white/20 text-white' : 'bg-slate-700/60 text-cyan-400'
              }`}
            >
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold truncate">수요일 주간업무</span>
                {activeTab === 'weekly' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-300/80 truncate mt-0.5">
                2단 대조 실적·계획 HWPX 자동 빌더
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Workflow Tab 2: 4-Stage Admin Ontology Explorer Embedded */}
      {activeTab === 'ontology' && (
        <div data-testid="ontology-workflow-pane" className="w-full">
          <AdminOntologyExplorer
            projectKey={project !== 'ALL' ? project : undefined}
            onNavigateModule={onNavigateModule}
            onSwitchTab={setActiveTab}
          />
        </div>
      )}

      {/* Workflow Tab 3: Wednesday Weekly Report Manager Embedded */}
      {activeTab === 'weekly' && (
        <div data-testid="weekly-workflow-pane" className="w-full">
          <div className="mb-2 p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-cyan-950 font-semibold flex items-center justify-between">
            <span>수요일 주간업무 · 2단 대조 실적·계획 HWPX 빌더</span>
            <span className="text-[11px] text-cyan-700">매주 수요일 마감</span>
          </div>
          <WeeklyReportManager />
        </div>
      )}

      {/* Workflow Tab 1: Master Archive Explorer Main View */}
      {activeTab === 'archive' && (
        <>
          {/* Top Header & Full-Text Search Bar */}
          <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                    마스터 아카이브 통합 탐색기
                  </h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                    총 {data?.totalIndexed?.toLocaleString() || 0}건 색인됨
                  </span>
                </div>
                <p className="vlds-subtitle text-xs sm:text-sm text-slate-500 mt-0.5">
                  본문(HWPX · PDF · XLSX) · 사진 맥락 통합 검색
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {/* View Mode Toggle */}
                <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>문서·통합 목록</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('gallery')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                      viewMode === 'gallery'
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>사진·시안 갤러리</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={triggerReindex}
                  disabled={reindexing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 transition-colors cursor-pointer disabled:opacity-50"
                  title="F:\_Organized_Archive 본문 · 사진 색인 갱신"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">{reindexing ? '색인 중...' : '색인 갱신'}</span>
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="찾으실 키워드를 입력하세요 (예: 양재천 과업내용서, 수의계약)"
                className="w-full pl-11 pr-10 py-3 bg-slate-50/70 focus:bg-white border border-slate-200/90 focus:border-slate-400 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors duration-150"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="검색어 지우기"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Search Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>빠른 탐색:</span>
              </span>
              {QUICK_SEARCH_CHIPS.map((chip) => {
                const isSelected = query === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleQuickChip(chip)}
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    <span>{chip}</span>
                  </button>
                );
              })}
            </div>

            {/* Facet Filters Toolbar (Flex layout preserving main layout grid selector) */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2 pt-2 border-t border-slate-100">
              {/* Year Filter */}
              <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  연도 필터
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 font-medium focus:border-slate-400 outline-none"
                >
                  {yearsList.map((y) => (
                    <option key={y} value={y}>
                      {y === 'ALL' ? '전체 연도' : y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Filter */}
              <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  단위사업 (9대 사업)
                </label>
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 font-medium focus:border-slate-400 outline-none truncate"
                >
                  <option value="ALL">전체 단위사업</option>
                  {projectOptions.map((p) => (
                    <option key={p} value={p}>
                      {formatProjectName(p)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  문서 구분
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 font-medium focus:border-slate-400 outline-none"
                >
                  <option value="ALL">전체 문서·사진</option>
                  <option value="doc">공문서 (HWPX/PDF)</option>
                  <option value="sheet">엑셀/시트 (XLSX)</option>
                  <option value="image">사진/시안 (JPG/PNG)</option>
                  <option value="slide">발표자료 (PPTX)</option>
                  <option value="design">디자인 원본 (PSD/AI)</option>
                  <option value="media">영상/미디어 (MP4)</option>
                </select>
              </div>

              {/* Image Sub-Category Filter */}
              <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  사진 촬영 맥락
                </label>
                <select
                  value={imageCategory}
                  onChange={(e) => setImageCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 font-medium focus:border-slate-400 outline-none"
                >
                  <option value="ALL">전체 사진</option>
                  <option value="photo">현장·행사 사진</option>
                  <option value="poster">포스터·현수막·시안</option>
                  <option value="logo">CI·로고·슬로건</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main 2-Column Responsive Layout: Left Search Results / Right Cluster (Rule S: 448px Stack) */}
          <div
            id="archive-search-results"
            className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start"
          >
            {/* Left Column: Search Results List or Gallery */}
            <div className="xl:col-span-7 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-600">
                  {viewMode === 'gallery' ? '사진·시안 썸네일 갤러리' : `검색 결과 ${items.length.toLocaleString()}건`}
                  {query && (
                    <span className="text-slate-400 font-normal ml-1">
                      (&quot;{query}&quot; 관련)
                    </span>
                  )}
                </span>
                {items.length > 0 && (
                  <span className="text-[11px] text-slate-400">
                    항목 선택 → 우측 연계 묶음 표시
                  </span>
                )}
              </div>

              {items.length === 0 ? (
                <div className="bg-white rounded-xl p-12 border border-slate-200/80 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    조건에 일치하는 아카이브 자료가 없습니다
                  </div>
                  <p className="text-xs text-slate-400 max-w-sm">
                    검색어 초기화 · 연도 · 사업 필터 변경
                  </p>
                </div>
              ) : viewMode === 'gallery' ? (
                /* Gallery Grid View */
                <div ref={galleryContainerRef} className="flex flex-col gap-3">
                  {galleryTopPadding > 0 && (
                    <div style={{ height: `${galleryTopPadding}px` }} aria-hidden="true" />
                  )}
                  {visibleGalleryRows.map((row, rIdx) => (
                    <div key={`row-${rIdx}`} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {row.map((item) => {
                        const isSelected = selectedId === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => selectItemForCluster(item)}
                            className={`vlds-cv-card group bg-white rounded-xl border overflow-hidden transition-colors cursor-pointer flex flex-col ${
                              isSelected
                                ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-md'
                                : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
                            }`}
                          >
                            {/* Thumbnail or Fallback */}
                            <div
                              className="w-full aspect-4/3 bg-slate-100 relative overflow-hidden flex items-center justify-center"
                              onClick={(e) => {
                                if (item.category === 'image') {
                                  e.stopPropagation();
                                  setPreviewImage(item);
                                }
                              }}
                            >
                              {item.category === 'image' ? (
                                <img
                                  src={`/api/archive/image?path=${encodeURIComponent(item.relPath)}`}
                                  alt={item.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                    if (e.currentTarget.parentElement) {
                                      e.currentTarget.parentElement.classList.add('flex', 'items-center', 'justify-center');
                                    }
                                  }}
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-1 text-slate-400 p-2 text-center">
                                  <FileCategoryIcon item={item} />
                                  <span className="text-[10px] font-bold uppercase">{item.ext}</span>
                                </div>
                              )}
                              <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-900/80 text-white font-mono tabular-nums">
                                {item.year}
                              </span>
                            </div>

                            {/* Metadata Box */}
                            <div className="p-2.5 flex flex-col gap-1 min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate" title={item.name}>
                                {item.name}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {formatProjectName(item.project)}
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                                <span>{item.date}</span>
                                <span>{formatFileSize(item.size)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {galleryBottomPadding > 0 && (
                    <div style={{ height: `${galleryBottomPadding}px` }} aria-hidden="true" />
                  )}
                </div>
              ) : (
                /* List View Mode */
                <div ref={listContainerRef} className="flex flex-col gap-2">
                  {listTopPadding > 0 && (
                    <div style={{ height: `${listTopPadding}px` }} aria-hidden="true" />
                  )}
                  {visibleListItems.map((item) => {
                    const isSelected = selectedId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => selectItemForCluster(item)}
                        className={`vlds-cv-card bg-white rounded-xl p-3.5 sm:p-4 border transition-colors cursor-pointer flex flex-col gap-2 ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-md bg-blue-50/10'
                            : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                              <FileCategoryIcon item={item} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-slate-900 break-all leading-snug">
                                  <HighlightedText text={item.name} query={query} />
                                </span>
                                {item.matchReason === 'content' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 shrink-0">
                                    본문 내용 일치
                                  </span>
                                )}
                                {(item.matchReason === 'filename' || (item.matchReason as any) === 'name') && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                                    파일명 일치
                                  </span>
                                )}
                                {item.matchReason === 'context' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60 shrink-0">
                                    사업 맥락 추론
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                                <span className="font-semibold text-slate-700">{item.year}</span>
                                <span>›</span>
                                <span className="text-slate-700 font-medium">
                                  {formatProjectName(item.project)}
                                </span>
                                {item.subFolder && (
                                  <>
                                    <span>›</span>
                                    <span className="text-slate-500">{item.subFolder}</span>
                                  </>
                                )}
                                <span>·</span>
                                <span>{item.date}</span>
                                <span>·</span>
                                <span>{formatFileSize(item.size)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Open Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openArchiveTarget(item.relPath, 'file');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                              title="연결 프로그램 실행"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>파일 열기</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openArchiveTarget(item.relPath, 'folder');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="탐색기 폴더 열기"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              <span>폴더</span>
                            </button>
                          </div>
                        </div>

                        {/* Extracted Content Snippet or Photo Context */}
                        {item.snippet && (
                          <div className="pl-6 text-xs text-slate-600 line-clamp-2 bg-slate-50/80 px-3 py-2 rounded-lg border border-slate-100">
                            <HighlightedText text={item.snippet} query={query} />
                          </div>
                        )}

                        {/* Inherited / Extracted Keywords */}
                        {item.keywords && item.keywords.length > 0 && (
                          <div className="pl-6 flex items-center gap-1.5 flex-wrap">
                            {item.keywords.slice(0, 6).map((kw) => (
                              <button
                                key={kw}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQuery(kw);
                                }}
                                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-600 transition-colors cursor-pointer"
                              >
                                <Tag className="w-2.5 h-2.5 text-slate-400" />
                                <span>{kw}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {listBottomPadding > 0 && (
                    <div style={{ height: `${listBottomPadding}px` }} aria-hidden="true" />
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Expanded 6-Domain Linked Bundle Panel (연계 업무 자료 묶음) */}
            <div className="xl:col-span-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden sticky top-20">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-800" />
                  <span className="text-sm font-bold text-slate-900">
                    연계 업무 묶음 (Project Cluster)
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-600 truncate max-w-[200px]">
                  {activeBundle
                    ? activeBundle.projectName || (activeBundle as any).name || activeBundle.projectKey
                    : cluster?.anchor
                    ? formatProjectName(cluster.anchor.project)
                    : '전사 6대 도메인 연계'}
                </span>
              </div>

              <div className="p-4 flex flex-col gap-4 max-h-[760px] overflow-y-auto">
                {/* 1. Selected Anchor Item Summary (if clicked) */}
                {cluster?.anchor && (
                  <div className="p-3.5 rounded-xl bg-slate-900 text-white flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-300">
                        현재 선택된 기준 자료 ({cluster.anchor.year} · {formatProjectName(cluster.anchor.project)})
                      </span>
                      <span className="text-[11px] text-slate-300 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {cluster.anchor.date}
                      </span>
                    </div>
                    <div className="text-sm font-bold break-all">{cluster.anchor.name}</div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openArchiveTarget(cluster.anchor.relPath, 'file')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 cursor-pointer"
                      >
                        기준 파일 열기
                      </button>
                      <button
                        type="button"
                        onClick={() => openArchiveTarget(cluster.anchor.relPath, 'folder')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700 cursor-pointer"
                      >
                        탐색기 폴더 열기
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. 6-Domain Cross-Join Summary Section */}
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>6대 도메인 라이브 연계 현황</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {activeBundle ? '단위사업 묶음' : '전사 9대 사업 종합'}
                    </span>
                  </div>

                  {/* 6-Domain Summary Grid (Rule S: 448px Responsive) */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Domain 1: Admin Ontology */}
                    <div className="p-2.5 rounded-xl border border-blue-100 bg-blue-50/40 flex flex-col justify-between min-h-[92px]">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-blue-600 font-bold">
                          <span>1. 행정 온톨로지</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        </div>
                        <div className="text-xs font-bold text-slate-900 mt-1 truncate">
                          방침·결과·감사·설명서
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {activeBundle
                            ? (((activeBundle.ontology as any)?.activeGapsCount || activeBundle.ontology?.auditGaps?.length || 0) > 0
                                ? `${(activeBundle.ontology as any)?.activeGapsCount || activeBundle.ontology?.auditGaps?.length}건 감사 지적`
                                : '4단계 완결')
                            : `${enterpriseSummary.totalProjects}개 사업 완결`}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid="btn-jump-ontology"
                        onClick={() => setActiveTab('ontology')}
                        className="w-full mt-2 py-1 px-2 rounded text-[10px] font-semibold bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 border border-blue-200 transition-colors cursor-pointer flex items-center justify-between truncate"
                      >
                        <span>온톨로지 탐색기 이동</span>
                        <span>→</span>
                      </button>
                    </div>

                    {/* Domain 2: Master Archive */}
                    <div className="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/40 flex flex-col justify-between min-h-[92px]">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-emerald-600 font-bold">
                          <span>2. 마스터 아카이브</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        </div>
                        <div className="text-xs font-bold text-slate-900 mt-1 truncate">
                          {activeBundle
                            ? `${(activeBundle.archive as any)?.totalFiles ?? (((activeBundle.archive?.totalDocuments || 0) + (activeBundle.archive?.totalSheets || 0) + (activeBundle.archive?.totalPhotos || 0)))}건 색인`
                            : `${data?.totalIndexed?.toLocaleString() || 0}건`}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {cluster?.docs.length ? `연계 문서 ${cluster.docs.length}건` : '공문서·사진·시트'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('archive-search-results');
                          el?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full mt-2 py-1 px-2 rounded text-[10px] font-semibold bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer flex items-center justify-between truncate"
                      >
                        <span>검색 목록 이동</span>
                        <span>↓</span>
                      </button>
                    </div>

                    {/* Domain 3: Working Memory */}
                    <div className="p-2.5 rounded-xl border border-amber-100 bg-amber-50/40 flex flex-col justify-between min-h-[92px]">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-amber-700 font-bold">
                          <span>3. 작업기억 메모</span>
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              (activeBundle ? (activeBundle.workingMemory?.pendingCount || 0) : enterpriseSummary.totalPendingMemos) > 0
                                ? 'bg-amber-500 animate-pulse'
                                : 'bg-slate-400'
                            }`}
                          />
                        </div>
                        <div className="text-xs font-bold text-slate-900 mt-1 truncate">
                          미반영 메모 {activeBundle ? (activeBundle.workingMemory?.pendingCount || 0) : enterpriseSummary.totalPendingMemos}건
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {(activeBundle?.workingMemory as any)?.latestMemos?.[0] || activeBundle?.workingMemory?.pendingMemos?.[0]?.content || '지시사항 포스트잇 연계'}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid="btn-jump-memory"
                        onClick={() => onNavigateModule?.('memory')}
                        className="w-full mt-2 py-1 px-2 rounded text-[10px] font-semibold bg-amber-600/10 hover:bg-amber-600/20 text-amber-700 border border-amber-200 transition-colors cursor-pointer flex items-center justify-between truncate"
                      >
                        <span>작업기억 보드 이동</span>
                        <span>→</span>
                      </button>
                    </div>

                    {/* Domain 4: e-Hojo Budget */}
                    <div className="p-2.5 rounded-xl border border-purple-100 bg-purple-50/40 flex flex-col justify-between min-h-[92px]">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-purple-700 font-bold">
                          <span>4. e-호조 예산</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        </div>
                        <div className="text-xs font-bold text-slate-900 mt-1 truncate">
                          집행률 {activeBundle ? (activeBundle.budget?.executionRate || 0) : enterpriseSummary.executionRate}%
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {(((activeBundle ? (activeBundle.budget?.totalBudget || 0) : enterpriseSummary.totalBudgetKrw) || 0) / 100000000).toFixed(1)}억원
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 mt-2">
                        <button
                          type="button"
                          data-testid="btn-jump-workspace"
                          onClick={() => onNavigateModule?.('workspace')}
                          className="w-full py-1 px-1 rounded text-[10px] font-semibold bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 border border-purple-200 transition-colors cursor-pointer text-center truncate"
                        >
                          <span>예산관리 이동</span>
                        </button>
                        <button
                          type="button"
                          data-testid="btn-jump-simulator"
                          onClick={() => onNavigateModule?.('simulator')}
                          className="w-full py-1 px-1 rounded text-[10px] font-semibold bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 border border-purple-200 transition-colors cursor-pointer text-center truncate"
                        >
                          <span>예산 시뮬레이터 이동</span>
                        </button>
                      </div>
                    </div>

                    {/* Domain 5: Weekly Work HWPX */}
                    <div className="p-2.5 rounded-xl border border-cyan-100 bg-cyan-50/40 flex flex-col justify-between min-h-[92px]">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-cyan-700 font-bold">
                          <span>5. 주간업무 HWPX</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                        </div>
                        <div className="text-xs font-bold text-slate-900 mt-1 truncate">
                          누적 {activeBundle ? ((activeBundle.weeklyWork as any)?.totalCount ?? activeBundle.weeklyWork?.reportsCount ?? 0) : enterpriseSummary.totalWeeklyCount}건
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          수요일 2단 대조 실적·계획
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid="btn-jump-weekly"
                        onClick={() => setActiveTab('weekly')}
                        className="w-full mt-2 py-1 px-2 rounded text-[10px] font-semibold bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-700 border border-cyan-200 transition-colors cursor-pointer flex items-center justify-between truncate"
                      >
                        <span>주간업무 작성 이동</span>
                        <span>→</span>
                      </button>
                    </div>

                    {/* Domain 6: Festival & Contacts */}
                    <div className="p-2.5 rounded-xl border border-rose-100 bg-rose-50/40 flex flex-col justify-between min-h-[92px]">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-rose-700 font-bold">
                          <span>6. 행사·연락망</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        </div>
                        <div className="text-xs font-bold text-slate-900 mt-1 truncate">
                          {activeBundle?.festivalAndContacts?.festivalSummary
                            ? `${activeBundle.festivalAndContacts.festivalSummary.boothsCount}개 부스 · ${activeBundle.festivalAndContacts.festivalSummary.dutiesCount}명 분장`
                            : activeBundle?.festivalAndContacts?.isFestivalProject
                            ? '20개 부스 · 41명 분장'
                            : `${enterpriseSummary.totalContactsCount}명 배정`}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {activeBundle?.festivalAndContacts?.assignedContacts?.[0]
                            ? `${activeBundle.festivalAndContacts.assignedContacts[0].name} (${activeBundle.festivalAndContacts.assignedContacts[0].role})`
                            : '양재천 페스티벌 관제'}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid="btn-jump-festival"
                        onClick={() => onNavigateModule?.('festival')}
                        className="w-full mt-2 py-1 px-2 rounded text-[10px] font-semibold bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 border border-rose-200 transition-colors cursor-pointer flex items-center justify-between truncate"
                      >
                        <span>양재천 페스티벌 이동</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Related Official Documents (.hwpx / .pdf) */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>연관 기안문·계획서·보고서 ({cluster?.docs.length || 0})</span>
                  </h3>
                  {!cluster?.docs || cluster.docs.length === 0 ? (
                    <p className="text-xs text-slate-400 py-1">
                      {cluster?.anchor
                        ? '연관 문서 없음'
                        : '좌측 항목 선택 시 표시'}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {cluster.docs.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-2.5 rounded-lg border border-slate-200/80 hover:border-slate-300 bg-slate-50/50 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-900 truncate" title={doc.name}>
                              {doc.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {doc.date} · {formatFileSize(doc.size)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openArchiveTarget(doc.relPath, 'file')}
                              className="px-2 py-1 rounded text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/80 cursor-pointer"
                            >
                              열기
                            </button>
                            <button
                              type="button"
                              onClick={() => openArchiveTarget(doc.relPath, 'folder')}
                              className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                            >
                              폴더
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Related Spreadsheets & Budget (.xlsx) */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    연관 예산·산출내역·집행표 ({cluster?.sheets.length || 0})
                  </h3>
                  {!cluster?.sheets || cluster.sheets.length === 0 ? (
                    <p className="text-xs text-slate-400 py-1">
                      {cluster?.anchor
                        ? '연관 시트 없음'
                        : '좌측 항목 선택 시 표시'}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {cluster.sheets.map((sh) => (
                        <div
                          key={sh.id}
                          className="p-2.5 rounded-lg border border-slate-200/80 hover:border-slate-300 bg-slate-50/50 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-900 truncate" title={sh.name}>
                              {sh.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {sh.date} · {formatFileSize(sh.size)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openArchiveTarget(sh.relPath, 'file')}
                              className="px-2 py-1 rounded text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/80 cursor-pointer"
                            >
                              열기
                            </button>
                            <button
                              type="button"
                              onClick={() => openArchiveTarget(sh.relPath, 'folder')}
                              className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                            >
                              폴더
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Related Images & Postures (.jpg / .png) */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    연관 현장사진·시안 ({cluster?.images.length || 0})
                  </h3>
                  {!cluster?.images || cluster.images.length === 0 ? (
                    <p className="text-xs text-slate-400 py-1">
                      {cluster?.anchor
                        ? '연관 사진 없음'
                        : '좌측 항목 선택 시 표시'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {cluster.images.slice(0, 9).map((img) => (
                        <div
                          key={img.id}
                          onClick={() => setPreviewImage(img)}
                          className="aspect-square rounded-lg overflow-hidden bg-slate-100 relative group cursor-pointer border border-slate-200/80 hover:border-slate-400"
                        >
                          <img
                            src={`/api/archive/image?path=${encodeURIComponent(img.relPath)}`}
                            alt={img.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                          <span className="absolute bottom-0 inset-x-0 p-1 text-[9px] bg-black/60 text-white truncate text-center">
                            {img.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Image Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-slate-900 text-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm font-bold truncate">{previewImage.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-black flex items-center justify-center max-h-[70vh] overflow-hidden">
              <img
                src={`/api/archive/image?path=${encodeURIComponent(previewImage.relPath)}`}
                alt={previewImage.name}
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>

            <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span>{previewImage.year}</span>
                <span>·</span>
                <span>{formatProjectName(previewImage.project)}</span>
                <span>·</span>
                <span>{formatFileSize(previewImage.size)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openArchiveTarget(previewImage.relPath, 'file')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  원본 파일 열기
                </button>
                <button
                  type="button"
                  onClick={() => openArchiveTarget(previewImage.relPath, 'folder')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 cursor-pointer"
                >
                  폴더 위치
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
