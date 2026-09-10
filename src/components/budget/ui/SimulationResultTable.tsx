import React, { useState, useMemo, useCallback } from 'react';
import { ProjectSimulationSummary, StatItemSimulationSummary, SimulationEntry, BudgetCategory, BudgetEntry } from '@/types';
import {
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Layers,
  FileSpreadsheet,
  ListOrdered,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CornerDownRight,
  FolderOpen,
  Clock,
  FileText,
  Pencil,
  Trash2,
  Coins,
  Receipt,
  ExternalLink,
} from 'lucide-react';
import { SimulationEntryList } from './SimulationEntryList';
import { StatItemDetailModal } from './StatItemDetailModal';

export interface SimulationResultTableProps {
  categories?: BudgetCategory[];
  budgetEntries?: BudgetEntry[];
  projectSummaries: ProjectSimulationSummary[];
  statItemSummaries: StatItemSimulationSummary[];
  entries: SimulationEntry[];
  onEditEntry?: (entry: SimulationEntry) => void;
  onDeleteEntry: (id: string) => void;
  onSettleEntry?: (simId: string) => void;
  onResetAll?: () => void;
  onLoadTestPreset?: () => void;
}

export type ViewMode = 'project' | 'stat' | 'entry';
export type StatusFilter = 'all' | 'deficit' | 'normal';

export const SimulationResultTable: React.FC<SimulationResultTableProps> = React.memo(({
  categories,
  budgetEntries,
  projectSummaries,
  statItemSummaries,
  entries,
  onEditEntry,
  onDeleteEntry,
  onSettleEntry,
  onResetAll,
  onLoadTestPreset,
}) => {
  // Set 'stat' (통계목별 잔액) as default main view mode
  const [viewMode, setViewMode] = useState<ViewMode>('stat');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [onlyWithEntries, setOnlyWithEntries] = useState<boolean>(false);
  const [onlyWithDailyExpenses, setOnlyWithDailyExpenses] = useState<boolean>(false);

  // Selected Stat Item for Expenditure Detail Modal
  const [selectedStatForModal, setSelectedStatForModal] = useState<{ detailedProject: string; statItem: string } | null>(null);

  // Collapse State for Detailed Project Groups in Stat View
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  // Expand State for Individual Stat Items to show Level 3 Registered Entries
  const [expandedStatItems, setExpandedStatItems] = useState<Record<string, boolean>>({});

  // Pre-indexed Map for Simulation Entries by `${detailedProject}|||${statItem}`
  const entriesByProjectAndStat = useMemo(() => {
    const map = new Map<string, SimulationEntry[]>();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const key = `${e.detailedProject}|||${e.statItem}`;
      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
      }
      list.push(e);
    }
    return map;
  }, [entries]);

  // Count of stat items that currently have simulation entries
  const statItemsWithEntriesCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < statItemSummaries.length; i++) {
      const s = statItemSummaries[i];
      const key = `${s.detailedProject}|||${s.statItem}`;
      if ((entriesByProjectAndStat.get(key)?.length || 0) > 0) {
        count++;
      }
    }
    return count;
  }, [statItemSummaries, entriesByProjectAndStat]);

  // Count of stat items that have daily expense issuance
  const statItemsWithDailyExpenseCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < statItemSummaries.length; i++) {
      if ((statItemSummaries[i].dailyExpenseIssued || 0) > 0) {
        count++;
      }
    }
    return count;
  }, [statItemSummaries]);

  const toggleProjectCollapse = useCallback((projectName: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectName]: !prev[projectName],
    }));
  }, []);

  const toggleStatItemExpand = useCallback((statKey: string) => {
    setExpandedStatItems((prev) => ({
      ...prev,
      [statKey]: !prev[statKey],
    }));
  }, []);

  // Filtered Project Summaries (Single-pass index loop)
  const filteredProjects = useMemo(() => {
    const trimmedKw = searchKeyword.trim().toLowerCase();
    const list: ProjectSimulationSummary[] = [];
    for (let i = 0; i < projectSummaries.length; i++) {
      const p = projectSummaries[i];
      if (trimmedKw && !p.detailedProject.toLowerCase().includes(trimmedKw)) {
        continue;
      }
      if (statusFilter === 'deficit' && !p.isDeficit) continue;
      if (statusFilter === 'normal' && p.isDeficit) continue;
      list.push(p);
    }
    return list;
  }, [projectSummaries, searchKeyword, statusFilter]);

  // Filtered Stat Item Summaries with Registered Entry Keyword Matching & Entry Presence Filter
  const filteredStatItems = useMemo(() => {
    const trimmedKw = searchKeyword.trim().toLowerCase();
    const list: StatItemSimulationSummary[] = [];
    for (let i = 0; i < statItemSummaries.length; i++) {
      const s = statItemSummaries[i];
      const key = `${s.detailedProject}|||${s.statItem}`;
      const matchingEntries = entriesByProjectAndStat.get(key);
      const entryCount = matchingEntries?.length || 0;

      // Quick filter: only show stat items that have registered simulation entries
      if (onlyWithEntries && entryCount === 0) continue;

      // Quick filter: only show stat items that have daily expense issuance
      if (onlyWithDailyExpenses && (s.dailyExpenseIssued || 0) === 0) continue;

      if (trimmedKw) {
        const combined = `${s.detailedProject} ${s.statItem}`.toLowerCase();
        let matchesSubEntry = false;
        if (matchingEntries) {
          for (let j = 0; j < matchingEntries.length; j++) {
            const me = matchingEntries[j];
            if (
              me.name.toLowerCase().includes(trimmedKw) ||
              (me.memo && me.memo.toLowerCase().includes(trimmedKw))
            ) {
              matchesSubEntry = true;
              break;
            }
          }
        }
        if (!combined.includes(trimmedKw) && !matchesSubEntry) continue;
      }

      if (statusFilter === 'deficit' && !s.isDeficit) continue;
      if (statusFilter === 'normal' && s.isDeficit) continue;
      list.push(s);
    }
    return list;
  }, [statItemSummaries, searchKeyword, statusFilter, onlyWithEntries, onlyWithDailyExpenses, entriesByProjectAndStat]);

  // Check whether all registered stat items are currently expanded
  const areAllStatEntriesExpanded = useMemo(() => {
    const keysWithEntries: string[] = [];
    for (let i = 0; i < filteredStatItems.length; i++) {
      const s = filteredStatItems[i];
      const key = `${s.detailedProject}|||${s.statItem}`;
      if ((entriesByProjectAndStat.get(key)?.length || 0) > 0) {
        keysWithEntries.push(key);
      }
    }
    if (keysWithEntries.length === 0) return false;
    return keysWithEntries.every((k) => expandedStatItems[k]);
  }, [filteredStatItems, entriesByProjectAndStat, expandedStatItems]);

  const toggleAllStatEntries = useCallback(() => {
    const keysWithEntries: string[] = [];
    const projectsWithEntries = new Set<string>();
    for (let i = 0; i < filteredStatItems.length; i++) {
      const s = filteredStatItems[i];
      const key = `${s.detailedProject}|||${s.statItem}`;
      if ((entriesByProjectAndStat.get(key)?.length || 0) > 0) {
        keysWithEntries.push(key);
        projectsWithEntries.add(s.detailedProject);
      }
    }

    if (areAllStatEntriesExpanded) {
      setExpandedStatItems({});
    } else {
      const nextExpanded: Record<string, boolean> = {};
      keysWithEntries.forEach((k) => {
        nextExpanded[k] = true;
      });
      setExpandedStatItems(nextExpanded);
      setCollapsedProjects((prev) => {
        const nextProjects = { ...prev };
        projectsWithEntries.forEach((dp) => {
          nextProjects[dp] = false;
        });
        return nextProjects;
      });
    }
  }, [filteredStatItems, entriesByProjectAndStat, areAllStatEntriesExpanded]);

  // Grouped Stat Items by Detailed Project with single-pass aggregation & statTotals calculation
  const { groupedStatItems, statTotals } = useMemo(() => {
    const map = new Map<
      string,
      {
        detailedProject: string;
        items: StatItemSimulationSummary[];
        totalBudget: number;
        currentSpent: number;
        currentRemaining: number;
        simulatedExpenditure: number;
        finalExpectedBalance: number;
        isDeficit: boolean;
        entriesCountInProject: number;
        dailyExpenseIssued: number;
        dailyExpenseSpent: number;
        dailyExpenseRemaining: number;
      }
    >();

    let totalBudget = 0;
    let currentSpent = 0;
    let currentRemaining = 0;
    let simulatedExpenditure = 0;
    let finalExpectedBalance = 0;
    let dailyExpenseIssued = 0;
    let dailyExpenseSpent = 0;
    let dailyExpenseRemaining = 0;

    for (let i = 0; i < filteredStatItems.length; i++) {
      const s = filteredStatItems[i];
      const statKey = `${s.detailedProject}|||${s.statItem}`;
      const entryCount = entriesByProjectAndStat.get(statKey)?.length || 0;

      let group = map.get(s.detailedProject);
      if (!group) {
        group = {
          detailedProject: s.detailedProject,
          items: [],
          totalBudget: 0,
          currentSpent: 0,
          currentRemaining: 0,
          simulatedExpenditure: 0,
          finalExpectedBalance: 0,
          isDeficit: false,
          entriesCountInProject: 0,
          dailyExpenseIssued: 0,
          dailyExpenseSpent: 0,
          dailyExpenseRemaining: 0,
        };
        map.set(s.detailedProject, group);
      }

      group.items.push(s);
      group.totalBudget += s.totalBudget;
      group.currentSpent += s.currentSpent;
      group.currentRemaining += s.currentRemaining;
      group.simulatedExpenditure += s.simulatedExpenditure;
      group.finalExpectedBalance += s.finalExpectedBalance;
      group.entriesCountInProject += entryCount;
      group.dailyExpenseIssued += (s.dailyExpenseIssued || 0);
      group.dailyExpenseSpent += (s.dailyExpenseSpent || 0);
      group.dailyExpenseRemaining += (s.dailyExpenseRemaining || 0);
      if (s.finalExpectedBalance < 0) {
        group.isDeficit = true;
      }

      totalBudget += s.totalBudget;
      currentSpent += s.currentSpent;
      currentRemaining += s.currentRemaining;
      simulatedExpenditure += s.simulatedExpenditure;
      finalExpectedBalance += s.finalExpectedBalance;
      dailyExpenseIssued += (s.dailyExpenseIssued || 0);
      dailyExpenseSpent += (s.dailyExpenseSpent || 0);
      dailyExpenseRemaining += (s.dailyExpenseRemaining || 0);
    }

    return {
      groupedStatItems: Array.from(map.values()),
      statTotals: {
        totalBudget,
        currentSpent,
        currentRemaining,
        simulatedExpenditure,
        finalExpectedBalance,
        dailyExpenseIssued,
        dailyExpenseSpent,
        dailyExpenseRemaining,
      },
    };
  }, [filteredStatItems, entriesByProjectAndStat]);

  const toggleAllCollapse = useCallback(() => {
    setCollapsedProjects((prev) => {
      const allCollapsed = groupedStatItems.every((g) => prev[g.detailedProject]);
      const next: Record<string, boolean> = {};
      if (!allCollapsed) {
        groupedStatItems.forEach((g) => {
          next[g.detailedProject] = true;
        });
      }
      return next;
    });
  }, [groupedStatItems]);

  // Calculate Table Totals for Current View Mode
  const tableTotals = useMemo(() => {
    if (viewMode === 'project') {
      let totalBudget = 0;
      let currentSpent = 0;
      let currentRemaining = 0;
      let simulatedExpenditure = 0;
      let finalExpectedBalance = 0;
      let dailyExpenseIssued = 0;
      let dailyExpenseSpent = 0;
      let dailyExpenseRemaining = 0;

      for (let i = 0; i < filteredProjects.length; i++) {
        const p = filteredProjects[i];
        totalBudget += p.totalBudget;
        currentSpent += p.currentSpent;
        currentRemaining += p.currentRemaining;
        simulatedExpenditure += p.simulatedExpenditure;
        finalExpectedBalance += p.finalExpectedBalance;
        dailyExpenseIssued += (p.dailyExpenseIssued || 0);
        dailyExpenseSpent += (p.dailyExpenseSpent || 0);
        dailyExpenseRemaining += (p.dailyExpenseRemaining || 0);
      }

      return {
        totalBudget,
        currentSpent,
        currentRemaining,
        simulatedExpenditure,
        finalExpectedBalance,
        dailyExpenseIssued,
        dailyExpenseSpent,
        dailyExpenseRemaining,
      };
    } else if (viewMode === 'stat') {
      return statTotals;
    }
    return null;
  }, [viewMode, filteredProjects, statTotals]);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-xs space-y-5 text-slate-800">
      {/* Table Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        {/* Left: View Mode Toggle Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100/70 p-1.5 rounded-xl border border-slate-200/70">
          <button
            type="button"
            onClick={() => setViewMode('stat')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'stat'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>통계목별 잔액 ({statItemSummaries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('project')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'project'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>세부사업별 요약 ({projectSummaries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('entry')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'entry'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>등록 항목 리스트 ({entries.length})</span>
          </button>
        </div>

        {/* Right: Search Input, Filters & Drill-down Expand Controls */}
        {viewMode !== 'entry' && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Stat View Controls */}
            {viewMode === 'stat' && (
              <>
                {/* Quick Toggle: Only with entries */}
                <button
                  type="button"
                  onClick={() => setOnlyWithEntries(!onlyWithEntries)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-3xs ${
                    onlyWithEntries
                      ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                      : 'bg-purple-50 hover:bg-purple-100/80 text-purple-700 border-purple-200/90'
                  }`}
                  title="시뮬레이션 등록 항목이 있는 통계목만 압축 표시합니다."
                >
                  <span>📌 등록 통계목만</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      onlyWithEntries ? 'bg-purple-800 text-white' : 'bg-purple-200/80 text-purple-800'
                    }`}
                  >
                    {statItemsWithEntriesCount}
                  </span>
                </button>

                {/* Quick Toggle: Only with daily expenses */}
                <button
                  type="button"
                  onClick={() => setOnlyWithDailyExpenses(!onlyWithDailyExpenses)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-3xs ${
                    onlyWithDailyExpenses
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-amber-50 hover:bg-amber-100/80 text-amber-800 border-amber-200/90'
                  }`}
                  title="일상경비가 교부된 통계목만 압축 표시합니다."
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>일상경비 교부목만</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      onlyWithDailyExpenses ? 'bg-amber-800 text-white' : 'bg-amber-200/80 text-amber-900'
                    }`}
                  >
                    {statItemsWithDailyExpenseCount}
                  </span>
                </button>

                {/* Global Projects Expand/Collapse Button */}
                <button
                  type="button"
                  onClick={toggleAllCollapse}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  title="모든 세부사업 하위 통계목 펼치기 / 접기"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-600" />
                  <span>사업 펼침/접힘</span>
                </button>

                {/* Drill-down All Registered Entries Expand/Collapse Button */}
                {entries.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllStatEntries}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      areAllStatEntriesExpanded
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-3xs'
                        : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700'
                    }`}
                    title="모든 등록 지출 항목 세부 내역 펼치기 / 접기"
                  >
                    <ListOrdered className="w-3.5 h-3.5 text-purple-600" />
                    <span>등록 세부항목 {areAllStatEntriesExpanded ? '접기' : '펼침'} ({entries.length})</span>
                  </button>
                )}
              </>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={viewMode === 'stat' ? '사업 / 통계목 / 등록항목 검색...' : '세부사업 검색...'}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/80 transition-all w-44 sm:w-56 font-medium"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-transparent text-slate-800 text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">전체 잔액</option>
                <option value="deficit" className="text-rose-600 font-bold">적자/초과예정</option>
                <option value="normal" className="text-emerald-600 font-bold">정상 잔액</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {viewMode === 'entry' ? (
        <SimulationEntryList
          entries={entries}
          onEditEntry={onEditEntry}
          onDeleteEntry={onDeleteEntry}
          onSettleEntry={onSettleEntry}
          onResetAll={onResetAll}
          onLoadTestPreset={onLoadTestPreset}
        />
      ) : (
        <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold tracking-wider text-xs">
                <th className="py-3 px-4 min-w-[250px]">
                  {viewMode === 'project' ? '세부사업명' : '세부사업 / 통계목 / 등록 세부 항목'}
                </th>
                <th className="py-3 px-4 text-right min-w-[130px]">총 예산액</th>
                <th className="py-3 px-4 text-right min-w-[130px]">현재 집행액</th>
                <th className="py-3 px-4 text-right min-w-[130px]">현재 집행 잔액</th>
                <th className="py-3 px-4 text-right min-w-[140px] text-purple-700">
                  시뮬레이션 예정액
                </th>
                <th className="py-3 px-4 text-right min-w-[150px] font-extrabold text-slate-900">최종 예상 잔액</th>
                <th className="py-3 px-4 text-center min-w-[110px]">상태 경고 / 관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-sm">
              {/* 1. Render Stat Item Summaries Grouped by Detailed Project View */}
              {viewMode === 'stat' &&
                groupedStatItems.map((group, groupIdx) => {
                  const isCollapsed = !!collapsedProjects[group.detailedProject];

                  return (
                    <React.Fragment key={`group-${group.detailedProject}-${groupIdx}`}>
                      {/* Category Header Row (Expandable / Collapsible) */}
                      <tr
                        onClick={() => toggleProjectCollapse(group.detailedProject)}
                        className="bg-slate-100/90 border-t border-b border-slate-200/90 hover:bg-indigo-50/70 transition-colors cursor-pointer select-none font-sans"
                      >
                        <td colSpan={1} className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="p-1 rounded-md bg-white border border-slate-200 text-indigo-600 shadow-2xs">
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </span>
                            <FolderOpen className="w-4 h-4 text-indigo-500" />
                            <span className="text-base font-extrabold tracking-tight">{group.detailedProject}</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100/70 border border-indigo-200 text-indigo-700 font-mono">
                              {group.items.length}개 통계목
                            </span>
                            {group.entriesCountInProject > 0 && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200 text-purple-700 font-sans">
                                등록 항목 {group.entriesCountInProject}건
                              </span>
                            )}
                            {group.dailyExpenseIssued > 0 && (
                              <span
                                className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-sans flex items-center gap-1"
                                title={`일상경비 교부액: ₩${group.dailyExpenseIssued.toLocaleString('ko-KR')} / 실집행액: ₩${group.dailyExpenseSpent.toLocaleString('ko-KR')}`}
                              >
                                <Coins className="w-3 h-3 text-amber-600" />
                                <span>일상 미집행 ₩{group.dailyExpenseRemaining.toLocaleString('ko-KR')}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-800 font-bold text-base">
                          ₩{group.totalBudget.toLocaleString('ko-KR')}
                        </td>
                        <td className="py-3 px-4 text-right text-indigo-700 font-bold text-base">
                          <div>₩{group.currentSpent.toLocaleString('ko-KR')}</div>
                          {group.dailyExpenseIssued > 0 && (
                            <div className="text-[10px] text-amber-700 font-normal font-sans tracking-tight">
                              (교부 ₩{group.dailyExpenseIssued.toLocaleString('ko-KR')})
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-700 font-bold text-base">
                          <div>₩{group.currentRemaining.toLocaleString('ko-KR')}</div>
                          {group.dailyExpenseRemaining > 0 && (
                            <div className="text-[10px] text-amber-700 font-medium font-sans tracking-tight" title="교부 잔액 포함 실질 가용액">
                              + 일상 미집행 ₩{group.dailyExpenseRemaining.toLocaleString('ko-KR')}
                              <span className="text-emerald-700 font-bold ml-1">
                                (실가용 ₩{(group.currentRemaining + group.dailyExpenseRemaining).toLocaleString('ko-KR')})
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-purple-700 font-extrabold text-base">
                          ₩{group.simulatedExpenditure.toLocaleString('ko-KR')}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-extrabold text-base ${
                            group.isDeficit ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          <div>₩{group.finalExpectedBalance.toLocaleString('ko-KR')}</div>
                          {group.dailyExpenseRemaining > 0 && (
                            <div className="text-[10px] text-slate-500 font-normal font-sans tracking-tight">
                              (일상 포함 ₩{(group.finalExpectedBalance + group.dailyExpenseRemaining).toLocaleString('ko-KR')})
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          {group.isDeficit ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-700 text-xs font-bold animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              초과 경고
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              안전
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Child Stat Item Rows & Level 3 Registered Simulation Entries */}
                      {!isCollapsed &&
                        group.items.map((s, sIdx) => {
                          const isNegative = s.finalExpectedBalance < 0;
                          const statKey = `${s.detailedProject}|||${s.statItem}`;
                          const itemEntries = entriesByProjectAndStat.get(statKey) || [];
                          const hasEntries = itemEntries.length > 0;
                          const isStatExpanded = !!expandedStatItems[statKey];

                          return (
                            <React.Fragment key={`stat-${statKey}-${sIdx}`}>
                              {/* Level 2: Stat Item Row */}
                              <tr
                                className={`transition-colors ${
                                  isNegative
                                    ? 'bg-rose-50/60 border-rose-200 hover:bg-rose-100/70 text-rose-950'
                                    : hasEntries
                                    ? 'bg-purple-50/20 hover:bg-purple-50/40 text-slate-900'
                                    : 'hover:bg-slate-50/80 text-slate-800'
                                }`}
                              >
                                <td className="py-3 px-4 pl-10 font-sans text-slate-900">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {hasEntries ? (
                                        <button
                                          type="button"
                                          onClick={() => toggleStatItemExpand(statKey)}
                                          className="p-1 rounded-md bg-white hover:bg-purple-100 border border-purple-200 text-purple-700 transition-all cursor-pointer shadow-3xs"
                                          title="등록된 세부 지출 항목 펼치기/접기"
                                        >
                                          {isStatExpanded ? (
                                            <ChevronDown className="w-3.5 h-3.5" />
                                          ) : (
                                            <ChevronRight className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      ) : (
                                        <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setSelectedStatForModal({ detailedProject: s.detailedProject, statItem: s.statItem })}
                                        className="font-bold text-slate-900 text-sm hover:text-indigo-600 hover:underline flex items-center gap-1.5 transition-colors cursor-pointer group text-left"
                                        title="클릭하여 세부 지출내역(e-호조 원장 및 산출기초) 조회"
                                      >
                                        <span className="group-hover:text-indigo-600 transition-colors">{s.statItem}</span>
                                        <Receipt className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors opacity-70 group-hover:opacity-100 shrink-0" />
                                      </button>
                                      {(s.dailyExpenseIssued || 0) > 0 && (
                                        <span
                                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-mono inline-flex items-center gap-1 shadow-3xs"
                                          title={`일상경비 교부: ₩${(s.dailyExpenseIssued || 0).toLocaleString('ko-KR')}, 실집행: ₩${(s.dailyExpenseSpent || 0).toLocaleString('ko-KR')}, 미집행 잔액: ₩${(s.dailyExpenseRemaining || 0).toLocaleString('ko-KR')}`}
                                        >
                                          <Coins className="w-2.5 h-2.5 text-amber-600" />
                                          <span>일상 미집행 ₩{(s.dailyExpenseRemaining || 0).toLocaleString('ko-KR')}</span>
                                          <span className="text-amber-600 font-normal">(교부 ₩{(s.dailyExpenseIssued || 0).toLocaleString('ko-KR')})</span>
                                        </span>
                                      )}
                                    </div>

                                    {/* Interactive Badge to Toggle Level 3 Registered Items */}
                                    {hasEntries && (
                                      <button
                                        type="button"
                                        onClick={() => toggleStatItemExpand(statKey)}
                                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 shadow-3xs active:scale-95 ${
                                          isStatExpanded
                                            ? 'bg-purple-600 text-white border-purple-600'
                                            : 'bg-purple-100/90 hover:bg-purple-200/90 text-purple-800 border-purple-300'
                                        }`}
                                        title="등록된 세부 지출 항목 펼치기/접기"
                                      >
                                        <span>📌 {itemEntries.length}건 등록</span>
                                        {isStatExpanded ? (
                                          <ChevronDown className="w-3 h-3" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right text-slate-700 font-semibold text-sm">
                                  ₩{s.totalBudget.toLocaleString('ko-KR')}
                                </td>
                                <td className="py-3 px-4 text-right text-indigo-700 font-semibold text-sm">
                                  <div>₩{s.currentSpent.toLocaleString('ko-KR')}</div>
                                  {(s.dailyExpenseIssued || 0) > 0 && (
                                    <div className="text-[10px] text-amber-700 font-normal font-sans tracking-tight">
                                      교부 ₩{(s.dailyExpenseIssued || 0).toLocaleString('ko-KR')}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right text-emerald-700 font-semibold text-sm">
                                  <div>₩{s.currentRemaining.toLocaleString('ko-KR')}</div>
                                  {(s.dailyExpenseRemaining || 0) > 0 && (
                                    <div className="text-[10px] text-amber-700 font-medium font-sans tracking-tight" title="교부 잔액 포함 실가용액">
                                      + 일상 미집행 ₩{(s.dailyExpenseRemaining || 0).toLocaleString('ko-KR')}
                                      <span className="text-emerald-700 font-bold ml-1">
                                        (실가용 ₩{(s.currentRemaining + (s.dailyExpenseRemaining || 0)).toLocaleString('ko-KR')})
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right text-purple-700 font-extrabold text-sm">
                                  ₩{s.simulatedExpenditure.toLocaleString('ko-KR')}
                                </td>
                                <td
                                  className={`py-3 px-4 text-right font-extrabold text-base ${
                                    isNegative ? 'text-rose-600' : 'text-emerald-600'
                                  }`}
                                >
                                  <div>₩{s.finalExpectedBalance.toLocaleString('ko-KR')}</div>
                                  {(s.dailyExpenseRemaining || 0) > 0 && (
                                    <div className="text-[10px] text-slate-500 font-normal font-sans tracking-tight">
                                      (일상 포함 ₩{(s.finalExpectedBalance + (s.dailyExpenseRemaining || 0)).toLocaleString('ko-KR')})
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center font-sans">
                                  {isNegative ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-700 text-xs font-bold">
                                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                                      초과 예정
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      정상
                                    </span>
                                  )}
                                </td>
                              </tr>

                              {/* Level 3: Nested Registered Simulation Entries */}
                              {hasEntries && isStatExpanded &&
                                itemEntries.map((entry, entryIdx) => {
                                  const isSettled = entry.status === 'SETTLED';
                                  return (
                                    <tr
                                      key={`sim-row-${entry.id}-${entryIdx}`}
                                      className="bg-indigo-50/30 hover:bg-indigo-50/60 border-t border-slate-200/50 transition-colors text-xs"
                                    >
                                      <td className="py-2.5 px-4 pl-16 font-sans text-slate-900">
                                        <div className="flex items-start gap-2">
                                          <CornerDownRight className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                                          <div className="space-y-0.5 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {isSettled ? (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-0.5">
                                                  <CheckCircle2 className="w-2.5 h-2.5" /> 집행 완료
                                                </span>
                                              ) : (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-0.5">
                                                  <Clock className="w-2.5 h-2.5" /> 집행 대기
                                                </span>
                                              )}
                                              <span
                                                className={`font-bold ${
                                                  isSettled ? 'text-slate-400 line-through' : 'text-slate-900'
                                                }`}
                                              >
                                                {entry.name}
                                              </span>
                                              {entry.createdAt && (
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                  {entry.createdAt.split('T')[0]}
                                                </span>
                                              )}
                                            </div>
                                            {entry.memo && (
                                              <p className="text-[11px] text-slate-500 flex items-center gap-1 line-clamp-1">
                                                <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span>{entry.memo}</span>
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-mono text-slate-600 text-xs">
                                        <span className="text-[11px] text-slate-500 font-sans">
                                          ₩{entry.unitPrice.toLocaleString('ko-KR')} × {entry.quantity}개
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-400">
                                        {isSettled ? (
                                          <span className="text-emerald-700 font-semibold text-[11px]">
                                            e-호조 반영됨
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-300">
                                        -
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-mono">
                                        <span
                                          className={`font-extrabold text-xs px-2 py-0.5 rounded-md inline-block ${
                                            isSettled
                                              ? 'text-slate-400 bg-slate-100'
                                              : 'text-purple-700 bg-purple-100/80 border border-purple-200/80'
                                          }`}
                                        >
                                          ₩{(entry.amount || 0).toLocaleString('ko-KR')}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold">
                                        {isSettled ? (
                                          <span className="text-slate-400">0</span>
                                        ) : (
                                          <span className="text-purple-700">
                                            -₩{(entry.amount || 0).toLocaleString('ko-KR')}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-4 text-center font-sans">
                                        <div className="flex items-center justify-center gap-1">
                                          {!isSettled && onSettleEntry && (
                                            <button
                                              type="button"
                                              onClick={() => onSettleEntry(entry.id)}
                                              className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer shadow-3xs transition-all active:scale-95"
                                              title="실제 지출로 집행 (정산)"
                                            >
                                              <CheckCircle2 className="w-3 h-3" />
                                              <span>정산</span>
                                            </button>
                                          )}
                                          {!isSettled && onEditEntry && (
                                            <button
                                              type="button"
                                              onClick={() => onEditEntry(entry)}
                                              className="p-1 rounded-md bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 text-[10px] cursor-pointer transition-all shadow-3xs"
                                              title="항목 수정"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => onDeleteEntry(entry.id)}
                                            className="p-1 rounded-md bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 text-[10px] cursor-pointer transition-all shadow-3xs"
                                            title="항목 삭제"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </React.Fragment>
                          );
                        })}
                    </React.Fragment>
                  );
                })}

              {/* 2. Render Project Summaries View */}
              {viewMode === 'project' &&
                filteredProjects.map((p, pIdx) => {
                  const isNegative = p.finalExpectedBalance < 0;
                  const isHighExecution = !isNegative && p.executionRate > 90;

                  return (
                    <tr
                      key={`proj-${p.detailedProject}-${pIdx}`}
                      className={`transition-colors ${
                        isNegative
                          ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/80 text-rose-950'
                          : isHighExecution
                          ? 'bg-amber-50/60 hover:bg-amber-100/70 text-amber-950'
                          : 'hover:bg-slate-50/80 text-slate-800'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-sans font-bold text-slate-900 text-base">
                        <div className="flex items-center gap-2">
                          <span>{p.detailedProject}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-700 font-semibold text-base">
                        ₩{p.totalBudget.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-3.5 px-4 text-right text-indigo-700 font-semibold text-base">
                        <div>₩{p.currentSpent.toLocaleString('ko-KR')}</div>
                        {(p.dailyExpenseIssued || 0) > 0 && (
                          <div className="text-[10px] text-amber-700 font-normal font-sans tracking-tight">
                            (교부 ₩{(p.dailyExpenseIssued || 0).toLocaleString('ko-KR')})
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-700 font-semibold text-base">
                        <div>₩{p.currentRemaining.toLocaleString('ko-KR')}</div>
                        {(p.dailyExpenseRemaining || 0) > 0 && (
                          <div className="text-[10px] text-amber-700 font-medium font-sans tracking-tight" title="교부 잔액 포함 실질 가용액">
                            + 일상 미집행 ₩{(p.dailyExpenseRemaining || 0).toLocaleString('ko-KR')}
                            <span className="text-emerald-700 font-bold ml-1">
                              (실가용 ₩{(p.currentRemaining + (p.dailyExpenseRemaining || 0)).toLocaleString('ko-KR')})
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right text-purple-700 font-extrabold text-base">
                        ₩{p.simulatedExpenditure.toLocaleString('ko-KR')}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-extrabold text-lg ${
                          isNegative ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        <div>₩{p.finalExpectedBalance.toLocaleString('ko-KR')}</div>
                        {(p.dailyExpenseRemaining || 0) > 0 && (
                          <div className="text-[10px] text-slate-500 font-normal font-sans tracking-tight">
                            (일상 포함 ₩{(p.finalExpectedBalance + (p.dailyExpenseRemaining || 0)).toLocaleString('ko-KR')})
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-sans">
                        {isNegative ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 border border-rose-300 text-rose-700 text-xs font-bold animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            적자 경고
                          </span>
                        ) : isHighExecution ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            소진 임박
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            정상
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

              {/* Empty Data Row */}
              {((viewMode === 'project' && filteredProjects.length === 0) ||
                (viewMode === 'stat' && filteredStatItems.length === 0)) && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-6 h-6 text-slate-400" />
                      <p className="text-base font-bold">
                        {onlyWithDailyExpenses
                          ? '일상경비 교부 내역이 있는 통계목이 없습니다.'
                          : onlyWithEntries
                          ? '등록된 시뮬레이션 지출 항목이 있는 통계목이 없습니다.'
                          : '검색 조건에 일치하는 결과가 없습니다.'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {onlyWithDailyExpenses ? (
                          <button
                            type="button"
                            onClick={() => setOnlyWithDailyExpenses(false)}
                            className="text-amber-700 underline hover:text-amber-900 font-bold cursor-pointer"
                          >
                            전체 통계목 보기로 전환하기
                          </button>
                        ) : onlyWithEntries ? (
                          <button
                            type="button"
                            onClick={() => setOnlyWithEntries(false)}
                            className="text-indigo-600 underline hover:text-indigo-800 font-bold cursor-pointer"
                          >
                            전체 통계목 보기로 전환하기
                          </button>
                        ) : (
                          '검색어나 상태 필터 조건을 변경해 주세요.'
                        )}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            {/* Table Footer Totals */}
            {tableTotals && (
              <tfoot>
                <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900 font-mono text-sm">
                  <td className="py-3.5 px-4 font-sans text-base font-extrabold">합계 ({viewMode === 'project' ? filteredProjects.length : filteredStatItems.length}개 항목)</td>
                  <td className="py-3.5 px-4 text-right text-base">₩{tableTotals.totalBudget.toLocaleString('ko-KR')}</td>
                  <td className="py-3.5 px-4 text-right text-indigo-700 text-base">
                    <div>₩{tableTotals.currentSpent.toLocaleString('ko-KR')}</div>
                    {(tableTotals.dailyExpenseIssued || 0) > 0 && (
                      <div className="text-[10px] text-amber-700 font-normal font-sans tracking-tight">
                        (교부 ₩{(tableTotals.dailyExpenseIssued || 0).toLocaleString('ko-KR')})
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-700 text-base">
                    <div>₩{tableTotals.currentRemaining.toLocaleString('ko-KR')}</div>
                    {(tableTotals.dailyExpenseRemaining || 0) > 0 && (
                      <div className="text-[10px] text-amber-700 font-medium font-sans tracking-tight" title="교부 잔액 포함 실질 가용액">
                        + 일상 미집행 ₩{(tableTotals.dailyExpenseRemaining || 0).toLocaleString('ko-KR')}
                        <span className="text-emerald-700 font-bold ml-1">
                          (실가용 ₩{(tableTotals.currentRemaining + (tableTotals.dailyExpenseRemaining || 0)).toLocaleString('ko-KR')})
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right text-purple-700 font-extrabold text-base">₩{tableTotals.simulatedExpenditure.toLocaleString('ko-KR')}</td>
                  <td className={`py-3.5 px-4 text-right text-lg font-extrabold ${tableTotals.finalExpectedBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    <div>₩{tableTotals.finalExpectedBalance.toLocaleString('ko-KR')}</div>
                    {(tableTotals.dailyExpenseRemaining || 0) > 0 && (
                      <div className="text-[10px] text-slate-500 font-normal font-sans tracking-tight">
                        (일상 포함 ₩{(tableTotals.finalExpectedBalance + (tableTotals.dailyExpenseRemaining || 0)).toLocaleString('ko-KR')})
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center font-sans">
                    {tableTotals.finalExpectedBalance < 0 ? (
                      <span className="text-rose-600 text-xs font-extrabold">전체 적자</span>
                    ) : (
                      <span className="text-emerald-600 text-xs font-bold">전체 양호</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* 5. Stat Item Expenditure Detail Modal */}
      {selectedStatForModal && (
        <StatItemDetailModal
          isOpen={!!selectedStatForModal}
          onClose={() => setSelectedStatForModal(null)}
          detailedProject={selectedStatForModal.detailedProject}
          statItem={selectedStatForModal.statItem}
          summary={statItemSummaries.find(
            s => s.detailedProject === selectedStatForModal.detailedProject && s.statItem === selectedStatForModal.statItem
          )}
          categories={categories || []}
          actualEntries={budgetEntries || []}
          simulationEntries={entriesByProjectAndStat.get(`${selectedStatForModal.detailedProject}|||${selectedStatForModal.statItem}`) || []}
          onEditSimEntry={onEditEntry}
          onDeleteSimEntry={onDeleteEntry}
          onSettleSimEntry={onSettleEntry}
        />
      )}
    </div>
  );
});

SimulationResultTable.displayName = 'SimulationResultTable';

export default SimulationResultTable;
