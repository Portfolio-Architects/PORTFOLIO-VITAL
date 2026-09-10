'use client';

import React, { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/modal';
import { BudgetCategory, BudgetEntry, SimulationEntry, StatItemSimulationSummary } from '@/types';
import {
  Receipt,
  Sparkles,
  Calculator,
  Search,
  Coins,
  ArrowUpDown,
  Filter,
  Pencil,
  Trash2,
  CheckCircle2,
  Building2,
} from 'lucide-react';

export interface StatItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  detailedProject: string;
  statItem: string;
  summary?: StatItemSimulationSummary | null;
  categories: BudgetCategory[];
  actualEntries: BudgetEntry[];
  simulationEntries: SimulationEntry[];
  onEditSimEntry?: (entry: SimulationEntry) => void;
  onDeleteSimEntry?: (id: string) => void;
  onSettleSimEntry?: (simId: string) => void;
}

type TabType = 'actual' | 'simulation' | 'subItems';
type SortOrder = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

function formatN(n: number) {
  return (n || 0).toLocaleString('ko-KR');
}

export const StatItemDetailModal: React.FC<StatItemDetailModalProps> = React.memo(({
  isOpen,
  onClose,
  detailedProject,
  statItem,
  summary,
  categories,
  actualEntries,
  simulationEntries,
  onEditSimEntry,
  onDeleteSimEntry,
  onSettleSimEntry,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('actual');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-desc');

  // Filter actual expenditures for this detailedProject & statItem
  const targetCategoryIds = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      if (
        (c.detailedProject || '기타') === detailedProject &&
        (c.statItem || '일반') === statItem
      ) {
        set.add(c.id);
      }
    }
    return set;
  }, [categories, detailedProject, statItem]);

  // Actual expenditures strictly belonging to these categories
  const rawActualList = useMemo(() => {
    return actualEntries.filter((entry) => {
      if (!targetCategoryIds.has(entry.categoryId)) return false;
      return !entry.isPlanned;
    });
  }, [actualEntries, targetCategoryIds]);

  // Filtered & Sorted Actual Entries
  const filteredActualEntries = useMemo(() => {
    const kw = searchTerm.trim().toLowerCase();
    const result = rawActualList.filter((e) => {
      if (actionTypeFilter !== 'all') {
        const type = e.actionType || 'general';
        if (actionTypeFilter === 'issuance' && type !== 'issuance') return false;
        if (actionTypeFilter === 'daily_expense' && type !== 'daily_expense') return false;
        if (actionTypeFilter === 'general' && type !== 'general') return false;
      }
      if (kw) {
        const matchPurpose = (e.purpose || '').toLowerCase().includes(kw);
        const matchDoc = (e.docRegNum || '').toLowerCase().includes(kw);
        const matchMemo = (e.memo || '').toLowerCase().includes(kw);
        return matchPurpose || matchDoc || matchMemo;
      }
      return true;
    });

    return result.sort((a, b) => {
      if (sortOrder === 'date-desc') {
        return (b.date || '').localeCompare(a.date || '');
      }
      if (sortOrder === 'date-asc') {
        return (a.date || '').localeCompare(b.date || '');
      }
      if (sortOrder === 'amount-desc') {
        return (b.amount || 0) - (a.amount || 0);
      }
      if (sortOrder === 'amount-asc') {
        return (a.amount || 0) - (b.amount || 0);
      }
      return 0;
    });
  }, [rawActualList, searchTerm, actionTypeFilter, sortOrder]);

  // Total amount of filtered actual entries
  const actualFilteredTotalAmount = useMemo(() => {
    return filteredActualEntries.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [filteredActualEntries]);

  // SubItems (budget calculation foundation) across matching categories
  const targetSubItems = useMemo(() => {
    const items = [];
    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      if (targetCategoryIds.has(c.id) && c.subItems && c.subItems.length > 0) {
        items.push(...c.subItems);
      }
    }
    return items;
  }, [categories, targetCategoryIds]);

  // KPI Calculations
  const totalBudget = summary?.totalBudget || 0;
  const currentSpent = summary?.currentSpent || 0;
  const currentRemaining = summary?.currentRemaining || (totalBudget - currentSpent);
  const simulatedExpenditure = summary?.simulatedExpenditure || 0;
  const finalExpectedBalance = summary?.finalExpectedBalance || (currentRemaining - simulatedExpenditure);
  const isDeficit = finalExpectedBalance < 0;
  const executionRate = totalBudget > 0 ? ((currentSpent / totalBudget) * 100) : 0;
  const dailyExpenseIssued = summary?.dailyExpenseIssued || 0;
  const dailyExpenseSpent = summary?.dailyExpenseSpent || 0;
  const dailyExpenseRemaining = summary?.dailyExpenseRemaining || (dailyExpenseIssued - dailyExpenseSpent);

  const getActionTypeBadge = (actionType?: string) => {
    switch (actionType) {
      case 'issuance':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
            <Coins size={11} className="text-amber-600" /> 일상교부
          </span>
        );
      case 'daily_expense':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
            <Coins size={11} className="text-amber-700" /> 일상지출
          </span>
        );
      case 'transfer':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            이용/전용
          </span>
        );
      case 'settle':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            정산결산
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            일반지출
          </span>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="4xl"
    >
      <div className="space-y-5 -mt-2">
        {/* Custom Header Section */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-indigo-50 border border-indigo-200/80 text-indigo-700 flex items-center gap-1.5">
                <Building2 size={13} className="text-indigo-600" />
                {detailedProject}
              </span>
              <span className="text-xs font-bold text-slate-400">/</span>
              <span className="text-xs font-bold text-slate-600 font-mono">
                통계목 상세
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="text-indigo-600 w-6 h-6 shrink-0" />
              <span>{statItem}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-sans">
                세부 지출원장 및 시뮬레이션
              </span>
            </h2>
          </div>
        </div>

        {/* Top KPI Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col">
            <span className="text-[11px] font-bold text-slate-500">총 예산액</span>
            <span className="text-sm sm:text-base font-extrabold font-mono text-slate-900 mt-1">
              ₩{formatN(totalBudget)}
            </span>
          </div>

          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex flex-col">
            <span className="text-[11px] font-bold text-indigo-700 flex items-center justify-between">
              <span>현재 실집행액</span>
              <span className="font-mono text-[10px] font-bold text-indigo-600">{executionRate.toFixed(1)}%</span>
            </span>
            <span className="text-sm sm:text-base font-extrabold font-mono text-indigo-800 mt-1">
              ₩{formatN(currentSpent)}
            </span>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 flex flex-col">
            <span className="text-[11px] font-bold text-emerald-800">현재 집행 잔액</span>
            <span className="text-sm sm:text-base font-extrabold font-mono text-emerald-800 mt-1">
              ₩{formatN(currentRemaining)}
            </span>
          </div>

          <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3 flex flex-col">
            <span className="text-[11px] font-bold text-purple-700">시뮬레이션 예정액</span>
            <span className="text-sm sm:text-base font-extrabold font-mono text-purple-800 mt-1">
              ₩{formatN(simulatedExpenditure)}
            </span>
          </div>

          <div className={`rounded-xl p-3 flex flex-col border ${
            isDeficit ? 'bg-rose-50 border-rose-200' : 'bg-slate-900 text-white border-slate-800'
          }`}>
            <span className={`text-[11px] font-bold ${isDeficit ? 'text-rose-700' : 'text-slate-300'}`}>
              최종 예상 잔액
            </span>
            <span className={`text-sm sm:text-base font-black font-mono mt-1 ${
              isDeficit ? 'text-rose-700' : 'text-emerald-400'
            }`}>
              ₩{formatN(finalExpectedBalance)}
            </span>
          </div>

          <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 flex flex-col">
            <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
              <Coins size={12} className="text-amber-600" />
              <span>일상 미집행 잔액</span>
            </span>
            <span className="text-sm sm:text-base font-extrabold font-mono text-amber-900 mt-1">
              ₩{formatN(dailyExpenseRemaining)}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('actual')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer relative ${
              activeTab === 'actual'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt size={16} />
            <span>실제 지출 집행 내역</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-700">
              {rawActualList.length}건
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulation')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer relative ${
              activeTab === 'simulation'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles size={16} />
            <span>시뮬레이션 예정 내역</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-purple-100 text-purple-800">
              {simulationEntries.length}건
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('subItems')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer relative ${
              activeTab === 'subItems'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calculator size={16} />
            <span>본예산 산출 기초 (산출근거)</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-700">
              {targetSubItems.length}개 산출목
            </span>
          </button>
        </div>

        {/* Tab 1: Actual Expenditures List */}
        {activeTab === 'actual' && (
          <div className="space-y-3">
            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="품의 목적, 문서번호, 비고 검색..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 w-52 sm:w-64 font-medium"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                  <Filter size={13} className="text-slate-400" />
                  <select
                    value={actionTypeFilter}
                    onChange={(e) => setActionTypeFilter(e.target.value)}
                    className="bg-transparent text-slate-700 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all">전체 구분</option>
                    <option value="general">일반지출</option>
                    <option value="issuance">일상경비 교부</option>
                    <option value="daily_expense">일상경비 지출</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                  <ArrowUpDown size={12} className="text-slate-400" />
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="date-desc">최신 일자순</option>
                    <option value="date-asc">과거 일자순</option>
                    <option value="amount-desc">높은 금액순</option>
                    <option value="amount-asc">낮은 금액순</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table Area */}
            {filteredActualEntries.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-500 text-xs sm:text-sm">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">해당 통계목의 실제 지출 집행 내역이 없습니다.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  검색 필터를 초기화하거나 예산 관리 메뉴에서 지출 품의를 등록하세요.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 z-10 text-slate-700 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 min-w-[90px]">집행일자</th>
                        <th className="py-2.5 px-3 min-w-[200px]">지출 목적 / 품의 내용</th>
                        <th className="py-2.5 px-3 min-w-[85px]">구분</th>
                        <th className="py-2.5 px-3 min-w-[120px]">시행문서번호</th>
                        <th className="py-2.5 px-3 text-right min-w-[110px]">집행금액</th>
                        <th className="py-2.5 px-3 min-w-[120px]">비고 / 채주</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {filteredActualEntries.map((item, idx) => (
                        <tr key={item.id || `actual-${idx}`} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="py-2.5 px-3 text-slate-600 font-medium whitespace-nowrap font-sans">
                            {item.date || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 font-semibold font-sans">
                            <div>{item.purpose || '(목적 미기재)'}</div>
                            {item.relatedPlanId && (
                              <span className="text-[10px] text-indigo-600 font-medium font-sans">
                                (시뮬레이션 계획 정산 완료건)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            {getActionTypeBadge(item.actionType)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-sans">
                            {item.docRegNum ? (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                                {item.docRegNum}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 text-[13px]">
                            ₩{formatN(item.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-sans truncate max-w-[180px]" title={item.memo}>
                            {item.memo || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Total Summary Bar */}
                <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="text-slate-600 font-sans">
                    조회된 지출 건수: <strong className="font-mono text-indigo-600">{filteredActualEntries.length}</strong>건
                  </span>
                  <div className="flex items-center gap-2 font-sans">
                    <span className="text-slate-500">지출 집행 합계:</span>
                    <span className="font-mono text-sm text-indigo-700 font-extrabold">
                      ₩{formatN(actualFilteredTotalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Simulation Planned Entries List */}
        {activeTab === 'simulation' && (
          <div className="space-y-3">
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-center justify-between">
              <span>
                현재 예산 시뮬레이터에 등록되어 미집행 차감 예정된 항목들입니다.
              </span>
              <span className="font-bold font-mono">
                총 {simulationEntries.length}건 등록
              </span>
            </div>

            {simulationEntries.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-500 text-xs sm:text-sm">
                <Sparkles className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">등록된 시뮬레이션 예정 항목이 없습니다.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  상단 시뮬레이션 등록 폼에서 신규 물품/용역 계획을 추가하여 잔액을 검토해 보세요.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 z-10 text-slate-700 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 min-w-[160px]">예정 지출 항목명</th>
                        <th className="py-2.5 px-3 text-right min-w-[110px]">단가</th>
                        <th className="py-2.5 px-3 text-center min-w-[60px]">수량</th>
                        <th className="py-2.5 px-3 text-right min-w-[120px]">차감 예정액</th>
                        <th className="py-2.5 px-3 text-center min-w-[80px]">상태</th>
                        <th className="py-2.5 px-3 min-w-[120px]">비고 / 산출내역</th>
                        <th className="py-2.5 px-3 text-center min-w-[90px]">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {simulationEntries.map((sim, idx) => {
                        const isSettled = sim.status === 'SETTLED';

                        return (
                          <tr key={sim.id || `sim-${idx}`} className="hover:bg-purple-50/40 transition-colors">
                            <td className="py-2.5 px-3 text-slate-900 font-bold font-sans">
                              {sim.name}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">
                              ₩{formatN(sim.unitPrice || 0)}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-700 font-bold">
                              {sim.quantity || 1}
                            </td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-purple-700 text-[13px]">
                              ₩{formatN(sim.amount)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-sans">
                              {isSettled ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  정산완료
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  예정
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 font-sans truncate max-w-[180px]" title={sim.memo}>
                              {sim.memo || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-sans">
                              <div className="flex items-center justify-center gap-1.5">
                                {!isSettled && onSettleSimEntry && (
                                  <button
                                    type="button"
                                    onClick={() => onSettleSimEntry(sim.id)}
                                    className="p-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all cursor-pointer"
                                    title="실제 지출로 정산 전환"
                                  >
                                    <CheckCircle2 size={13} />
                                  </button>
                                )}
                                {onEditSimEntry && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onEditSimEntry(sim);
                                      onClose();
                                    }}
                                    className="p-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-all cursor-pointer"
                                    title="수정"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                )}
                                {onDeleteSimEntry && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteSimEntry(sim.id)}
                                    className="p-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer"
                                    title="삭제"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="text-slate-600 font-sans">
                    시뮬레이션 건수: <strong className="font-mono text-purple-600">{simulationEntries.length}</strong>건
                  </span>
                  <div className="flex items-center gap-2 font-sans">
                    <span className="text-slate-500">예정 차감 합계:</span>
                    <span className="font-mono text-sm text-purple-700 font-extrabold">
                      ₩{formatN(simulatedExpenditure)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Budget SubItems Foundation */}
        {activeTab === 'subItems' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              본예산 편성 시 확정된 산출기초 및 세부 산출내역입니다. 실무 집행 시 기준 단가와 대상 인원수를 대조할 수 있습니다.
            </div>

            {targetSubItems.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-500 text-xs sm:text-sm">
                <Calculator className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">등록된 세부 산출내역(subItems)이 없습니다.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  예산 관리 카테고리 설정에서 산출 기초를 등록하면 실시간으로 연동됩니다.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                {targetSubItems.map((sub, idx) => (
                  <div key={sub.id || `sub-${idx}`} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-3xs space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {sub.prefix && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                            {sub.prefix}
                          </span>
                        )}
                        <span className="text-sm font-bold text-slate-900">{sub.name}</span>
                      </div>
                      <span className="text-sm font-extrabold font-mono text-indigo-700">
                        ₩{formatN(sub.amount)}
                      </span>
                    </div>

                    {sub.calculation && (
                      <div className="text-xs font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {sub.calculation}
                      </div>
                    )}

                    {sub.calculations && sub.calculations.length > 0 && (
                      <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-indigo-100">
                        {sub.calculations.map((calc, cIdx) => (
                          <div key={calc.id || `calc-${cIdx}`} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50/70 border border-slate-100">
                            <span className="font-medium text-slate-700">{calc.name}</span>
                            <div className="flex items-center gap-3">
                              {calc.calculation && (
                                <span className="font-mono text-slate-500 text-[11px]">{calc.calculation}</span>
                              )}
                              <span className="font-mono font-bold text-slate-800">₩{formatN(calc.amount)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
          <div className="text-slate-500 text-[11px] flex items-center gap-1.5">
            <Building2 size={13} className="text-slate-400" />
            <span>단일 진실 공급원(SSOT): data/BUDGET_ENTRIES.json & BUDGET_CATEGORIES.json</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer active:scale-95 shadow-3xs"
          >
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
});

StatItemDetailModal.displayName = 'StatItemDetailModal';
