import React, { useState, useMemo, useCallback } from 'react';
import { ProjectSimulationSummary, StatItemSimulationSummary, SimulationEntry } from '@/types';
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
} from 'lucide-react';
import { SimulationEntryList } from './SimulationEntryList';

export interface SimulationResultTableProps {
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

  // Collapse State for Detailed Project Groups in Stat View
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  const toggleProjectCollapse = useCallback((projectName: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectName]: !prev[projectName],
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

  // Filtered Stat Item Summaries (Single-pass index loop)
  const filteredStatItems = useMemo(() => {
    const trimmedKw = searchKeyword.trim().toLowerCase();
    const list: StatItemSimulationSummary[] = [];
    for (let i = 0; i < statItemSummaries.length; i++) {
      const s = statItemSummaries[i];
      if (trimmedKw) {
        const combined = `${s.detailedProject} ${s.statItem}`.toLowerCase();
        if (!combined.includes(trimmedKw)) continue;
      }
      if (statusFilter === 'deficit' && !s.isDeficit) continue;
      if (statusFilter === 'normal' && s.isDeficit) continue;
      list.push(s);
    }
    return list;
  }, [statItemSummaries, searchKeyword, statusFilter]);

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
      }
    >();

    let totalBudget = 0;
    let currentSpent = 0;
    let currentRemaining = 0;
    let simulatedExpenditure = 0;
    let finalExpectedBalance = 0;

    for (let i = 0; i < filteredStatItems.length; i++) {
      const s = filteredStatItems[i];
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
        };
        map.set(s.detailedProject, group);
      }

      group.items.push(s);
      group.totalBudget += s.totalBudget;
      group.currentSpent += s.currentSpent;
      group.currentRemaining += s.currentRemaining;
      group.simulatedExpenditure += s.simulatedExpenditure;
      group.finalExpectedBalance += s.finalExpectedBalance;
      if (s.finalExpectedBalance < 0) {
        group.isDeficit = true;
      }

      totalBudget += s.totalBudget;
      currentSpent += s.currentSpent;
      currentRemaining += s.currentRemaining;
      simulatedExpenditure += s.simulatedExpenditure;
      finalExpectedBalance += s.finalExpectedBalance;
    }

    return {
      groupedStatItems: Array.from(map.values()),
      statTotals: { totalBudget, currentSpent, currentRemaining, simulatedExpenditure, finalExpectedBalance }
    };
  }, [filteredStatItems]);

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

      for (let i = 0; i < filteredProjects.length; i++) {
        const p = filteredProjects[i];
        totalBudget += p.totalBudget;
        currentSpent += p.currentSpent;
        currentRemaining += p.currentRemaining;
        simulatedExpenditure += p.simulatedExpenditure;
        finalExpectedBalance += p.finalExpectedBalance;
      }

      return { totalBudget, currentSpent, currentRemaining, simulatedExpenditure, finalExpectedBalance };
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

        {/* Right: Search Input & Status Filter (only for project & stat views) */}
        {viewMode !== 'entry' && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Global Expand/Collapse Button for Stat View */}
            {viewMode === 'stat' && (
              <button
                type="button"
                onClick={toggleAllCollapse}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold transition-all cursor-pointer"
                title="모든 세부사업 하위 통계목 펼치기 / 접기"
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-600" />
                <span>모두 펼침/접힘</span>
              </button>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="사업 / 통계목 검색..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/80 transition-all w-48 sm:w-56 font-medium"
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
                <th className="py-3 px-4 min-w-[240px]">
                  {viewMode === 'project' ? '세부사업명' : '세부사업 / 통계목'}
                </th>
                <th className="py-3 px-4 text-right min-w-[130px]">총 예산액</th>
                <th className="py-3 px-4 text-right min-w-[130px]">현재 집행액</th>
                <th className="py-3 px-4 text-right min-w-[130px]">현재 집행 잔액</th>
                <th className="py-3 px-4 text-right min-w-[140px] text-purple-700">
                  시뮬레이션 예정액
                </th>
                <th className="py-3 px-4 text-right min-w-[150px] font-extrabold text-slate-900">최종 예상 잔액</th>
                <th className="py-3 px-4 text-center min-w-[110px]">상태 경고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-sm">
              {/* 1. Render Stat Item Summaries Grouped by Detailed Project View */}
              {viewMode === 'stat' &&
                groupedStatItems.map((group) => {
                  const isCollapsed = !!collapsedProjects[group.detailedProject];

                  return (
                    <React.Fragment key={group.detailedProject}>
                      {/* Category Header Row (Expandable / Collapsible) */}
                      <tr
                        onClick={() => toggleProjectCollapse(group.detailedProject)}
                        className="bg-slate-100/90 border-t border-b border-slate-200/90 hover:bg-indigo-50/70 transition-colors cursor-pointer select-none font-sans"
                      >
                        <td colSpan={1} className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
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
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-800 font-bold text-base">
                          ₩{group.totalBudget.toLocaleString('ko-KR')}
                        </td>
                        <td className="py-3 px-4 text-right text-indigo-700 font-bold text-base">
                          ₩{group.currentSpent.toLocaleString('ko-KR')}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-700 font-bold text-base">
                          ₩{group.currentRemaining.toLocaleString('ko-KR')}
                        </td>
                        <td className="py-3 px-4 text-right text-purple-700 font-extrabold text-base">
                          ₩{group.simulatedExpenditure.toLocaleString('ko-KR')}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-extrabold text-base ${
                            group.isDeficit ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          ₩{group.finalExpectedBalance.toLocaleString('ko-KR')}
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

                      {/* Child Stat Item Rows */}
                      {!isCollapsed &&
                        group.items.map((s) => {
                          const isNegative = s.finalExpectedBalance < 0;

                          return (
                            <tr
                              key={`${s.detailedProject}-${s.statItem}`}
                              className={`transition-colors ${
                                isNegative
                                  ? 'bg-rose-50/60 border-rose-200 hover:bg-rose-100/70 text-rose-950'
                                  : 'hover:bg-slate-50/80 text-slate-800'
                              }`}
                            >
                              <td className="py-3 px-4 pl-10 font-sans text-slate-900">
                                <div className="flex items-center gap-2">
                                  <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="font-bold text-slate-900 text-sm">{s.statItem}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right text-slate-700 font-semibold text-sm">
                                ₩{s.totalBudget.toLocaleString('ko-KR')}
                              </td>
                              <td className="py-3 px-4 text-right text-indigo-700 font-semibold text-sm">
                                ₩{s.currentSpent.toLocaleString('ko-KR')}
                              </td>
                              <td className="py-3 px-4 text-right text-emerald-700 font-semibold text-sm">
                                ₩{s.currentRemaining.toLocaleString('ko-KR')}
                              </td>
                              <td className="py-3 px-4 text-right text-purple-700 font-extrabold text-sm">
                                ₩{s.simulatedExpenditure.toLocaleString('ko-KR')}
                              </td>
                              <td
                                className={`py-3 px-4 text-right font-extrabold text-base ${
                                  isNegative ? 'text-rose-600' : 'text-emerald-600'
                                }`}
                              >
                                ₩{s.finalExpectedBalance.toLocaleString('ko-KR')}
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
                          );
                        })}
                    </React.Fragment>
                  );
                })}

              {/* 2. Render Project Summaries View */}
              {viewMode === 'project' &&
                filteredProjects.map((p) => {
                  const isNegative = p.finalExpectedBalance < 0;
                  const isHighExecution = !isNegative && p.executionRate > 90;

                  return (
                    <tr
                      key={p.detailedProject}
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
                        ₩{p.currentSpent.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-700 font-semibold text-base">
                        ₩{p.currentRemaining.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-3.5 px-4 text-right text-purple-700 font-extrabold text-base">
                        ₩{p.simulatedExpenditure.toLocaleString('ko-KR')}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-extrabold text-lg ${
                          isNegative ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        ₩{p.finalExpectedBalance.toLocaleString('ko-KR')}
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
                      <p className="text-base font-bold">검색 조건에 일치하는 결과가 없습니다.</p>
                      <p className="text-xs text-slate-400">검색어나 상태 필터 조건을 변경해 주세요.</p>
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
                  <td className="py-3.5 px-4 text-right text-indigo-700 text-base">₩{tableTotals.currentSpent.toLocaleString('ko-KR')}</td>
                  <td className="py-3.5 px-4 text-right text-emerald-700 text-base">₩{tableTotals.currentRemaining.toLocaleString('ko-KR')}</td>
                  <td className="py-3.5 px-4 text-right text-purple-700 font-extrabold text-base">₩{tableTotals.simulatedExpenditure.toLocaleString('ko-KR')}</td>
                  <td className={`py-3.5 px-4 text-right text-lg font-extrabold ${tableTotals.finalExpectedBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ₩{tableTotals.finalExpectedBalance.toLocaleString('ko-KR')}
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
    </div>
  );
});

SimulationResultTable.displayName = 'SimulationResultTable';

export default SimulationResultTable;
