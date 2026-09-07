'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { BudgetCategory, BudgetEntry } from '@/types';
import { useBudgetFilters } from '@/hooks/useBudgetFilters';
import { Card } from '@/components/ui/card';
import { ShieldAlert, RefreshCw, Search, FilePlus2, CircleDollarSign, Wallet, Receipt, ShieldCheck, ChevronDown } from 'lucide-react';
import { MultiSelectDropdown } from './ui/MultiSelectDropdown';
import { PolicyGroupCard } from './ui/PolicyGroupCard';
import { useVirtualList } from '@/hooks/useVirtualList';
import dynamic from 'next/dynamic';

const CategoryEditModal = dynamic(
  () => import('./ui/CategoryEditModal').then((mod) => mod.CategoryEditModal),
  { ssr: false }
);

const BatchEditModal = dynamic(
  () => import('./ui/BatchEditModal').then((mod) => mod.BatchEditModal),
  { ssr: false }
);

const ExpenseEntryModal = dynamic(
  () => import('./ui/ExpenseEntryModal').then((mod) => mod.ExpenseEntryModal),
  { ssr: false }
);

const LedgerModal = dynamic(
  () => import('./ui/LedgerModal').then((mod) => mod.LedgerModal),
  { ssr: false }
);

const DailyExpenseStatModal = dynamic(
  () => import('./ui/DailyExpenseStatModal').then((mod) => mod.DailyExpenseStatModal),
  { ssr: false }
);

import { CategoryStats } from '@/hooks/useBudget';

interface BudgetDashboardProps {
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => BudgetCategory;
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory: (id: string) => void;
  replaceCategories?: (cats: BudgetCategory[]) => void;
  addEntry: (entry: Omit<BudgetEntry, 'id'>) => void;
  updateEntry: (id: string, updates: Partial<BudgetEntry>) => void;
  deleteEntry: (id: string) => void;
  batchUpdateEntries?: (ids: string[] | Array<{ id: string; [key: string]: any }>, updates?: Partial<BudgetEntry>) => void;
  batchDeleteEntries?: (ids: string[]) => void;
  batchSettleEntries?: (ids: string[], status: 'SETTLED' | 'PENDING' | 'REJECTED') => void;
  getCategoryStats: (id: string) => CategoryStats | null;
  overallStats: { 
    totalBudget: number; totalSpent: number; totalPlanned: number; remaining: number;
    dailyExpenseIssued: number; dailyExpenseSpent: number; dailyExpenseRemaining: number;
  };
}

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

export function BudgetDashboard(props: BudgetDashboardProps) {
  const {
    categories,
    entries,
    addCategory,
    updateCategory,
    deleteCategory,
    addEntry,
    updateEntry,
    deleteEntry,
    batchUpdateEntries,
    batchDeleteEntries,
    batchSettleEntries,
    getCategoryStats
  } = props;

  const [showCatModal, setShowCatModal] = useState(false);
  const [catModalInitialData, setCatModalInitialData] = useState<Partial<BudgetCategory> | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryModalInitialData, setEntryModalInitialData] = useState<Partial<BudgetEntry> | null>(null);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchCats, setBatchCats] = useState<BudgetCategory[]>([]);
  const [batchTitle, setBatchTitle] = useState('');
  
  const [returnToEntryModal, setReturnToEntryModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showDailyStatModal, setShowDailyStatModal] = useState(false);
  const [isRiskExpanded, setIsRiskExpanded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const {
    filterPolicy, setFilterPolicy,
    filterUnit, setFilterUnit,
    filterDetail, setFilterDetail,
    filterStat, setFilterStat,
    filterMonth, setFilterMonth,
    filterStatus, setFilterStatus,
    searchTerm, setSearchTerm,
    deferredSearchTerm,
    handleSaveFilters,
    handleResetFilters,
    uniquePolicies,
    unitOptions,
    detailOptions,
    statOptions,
    filteredCategoriesTree,
    groupedByPolicy,
    filteredStats
  } = useBudgetFilters(categories, entries, getCategoryStats);

  const handleSaveCategory = useCallback((isEdit: boolean, editCatId: string | null, updates: Partial<BudgetCategory>) => {
    if (isEdit && editCatId) {
      updateCategory(editCatId, updates);
    } else {
      addCategory(updates as Omit<BudgetCategory, 'id'>);
    }
  }, [updateCategory, addCategory]);

  const handleSaveEntry = useCallback((isEdit: boolean, editEntryId: string | null, entryData: Partial<BudgetEntry>) => {
    if (isEdit && editEntryId) {
      updateEntry(editEntryId, entryData);
    } else {
      addEntry(entryData as BudgetEntry);
    }
    if (returnToEntryModal) {
      setShowEntryModal(true);
      setReturnToEntryModal(false);
    }
  }, [updateEntry, addEntry, returnToEntryModal]);

  const handleSettleEntry = useCallback((plannedEntryId: string, actualAmount: number) => {
    const plannedEntry = entries.find(e => e.id === plannedEntryId);
    if (!plannedEntry) return;

    updateEntry(plannedEntryId, { isSettled: true });

    addEntry({
      categoryId: plannedEntry.categoryId,
      amount: actualAmount,
      date: new Date().toISOString().split('T')[0],
      purpose: `${plannedEntry.purpose} (정산)`,
      memo: plannedEntry.memo,
      isPlanned: false,
      isSettled: false,
      relatedPlanId: plannedEntryId,
      actionType: plannedEntry.actionType || 'general',
      linkedSubItemId: plannedEntry.linkedSubItemId,
      docRegNum: plannedEntry.docRegNum,
      fundingSource: plannedEntry.fundingSource
    });
  }, [entries, updateEntry, addEntry]);

  const handleAddCategory = useCallback((template?: Partial<BudgetCategory>) => {
    setCatModalInitialData(template || null);
    setShowCatModal(true);
  }, []);

  const handleEditCategory = useCallback((cat: BudgetCategory) => {
    setCatModalInitialData(cat);
    setShowCatModal(true);
  }, []);
  
  const openEditEntry = useCallback((entry: BudgetEntry) => {
    setEntryModalInitialData(entry);
    setShowEntryModal(true);
  }, []);

  const openBatchEdit = useCallback((title: string, cats: BudgetCategory[]) => {
    setBatchCats(cats);
    setBatchTitle(title);
    setShowBatchModal(true);
  }, []);

  const handleApplyBatchEdit = useCallback((updates: Partial<BudgetCategory>, fundingSplits?: { source: string; ratio: string }[]) => {
    batchCats.forEach(c => {
      const finalUpdates = { ...updates };
      
      if (fundingSplits) {
        const newSplitsArray = fundingSplits.map(br => ({
          source: br.source || '기타',
          amount: Math.floor(c.totalBudget * (Number(br.ratio || 0) / 100))
        }));
        
        const sumNewSplits = newSplitsArray.reduce((s, a) => s + a.amount, 0);
        if (newSplitsArray.length > 0 && sumNewSplits !== c.totalBudget) {
          newSplitsArray[0].amount += (c.totalBudget - sumNewSplits);
        }
        finalUpdates.fundingSplits = newSplitsArray;
      }
      
      updateCategory(c.id, finalUpdates);
    });
    setShowBatchModal(false);
  }, [batchCats, updateCategory]);

  const currentMonth = new Date().getMonth() + 1;
  const isEndOfYearApproaching = currentMonth >= 11;
  
  const riskCategories = useMemo(() => {
    return categories.map(cat => {
      const st = getCategoryStats(cat.id);
      if (!st) return null;
      if (currentMonth >= 9 && st.usageRate < 70) return { cat, st, reason: '3분기 집행률 70% 미만' };
      if (isEndOfYearApproaching && (st.remaining / st.totalBudget) >= 0.1) return { cat, st, reason: '회계연도 마감 임박 (가용 잔액 10% 초과)' };
      return null;
    }).filter(Boolean);
  }, [categories, getCategoryStats, currentMonth, isEndOfYearApproaching]);

  const totalRiskRemaining = useMemo(() => {
    return riskCategories.reduce((acc, curr) => acc + (curr?.st.remaining ?? 0), 0);
  }, [riskCategories]);

  // Policy groups virtualization
  const isPolicyVirtualActive = groupedByPolicy.length > 4;
  const { startIndex, endIndex, topPadding, bottomPadding } = useVirtualList({
    totalItems: groupedByPolicy.length,
    itemHeight: 220,
    overscan: 2,
    containerRef
  });

  const visibleGroupedByPolicy = useMemo(() => {
    if (!isPolicyVirtualActive) return groupedByPolicy;
    return groupedByPolicy.slice(startIndex, endIndex);
  }, [groupedByPolicy, isPolicyVirtualActive, startIndex, endIndex]);

  return (
    <div className="space-y-6">
      
      {/* Risk Alert Compact Card */}
      {riskCategories.length > 0 && (
        <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/30 rounded-2xl p-3 shadow-2xs transition-all">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <ShieldAlert size={17} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-rose-900 dark:text-rose-200">불용 위험 모니터링</span>
                <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-200/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 rounded-full">
                  {riskCategories.length}개 사업
                </span>
                <span className="text-xs text-rose-700/80 dark:text-rose-300">
                  위험 사업 미집행 잔액: <strong className="text-rose-800 dark:text-rose-200 font-mono font-bold">{formatN(totalRiskRemaining)}원</strong>
                  <span className="text-[11px] text-rose-500/80 dark:text-rose-400/80 ml-1 font-normal">(정상 집행 4개 사업 잔액 70,000원 제외)</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsRiskExpanded(!isRiskExpanded)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-slate-800 hover:bg-white text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <span>{isRiskExpanded ? '접기' : '사업 목록'}</span>
              <ChevronDown size={14} className={`transform transition-transform duration-200 ${isRiskExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Collapsible details: 2-column compact scroll grid */}
          {isRiskExpanded && (
            <div className="mt-2.5 pt-2.5 border-t border-rose-200/60 dark:border-rose-900/40">
              <div className="flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400 mb-2 px-1">
                <span>조기 집행 및 연말 잔액 소진 조치(추경 등) 권고 사업 목록</span>
                <span>총 {riskCategories.length}건</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                {riskCategories.map((item, id) => (
                  <div key={id} className="flex items-center justify-between text-xs bg-white/80 dark:bg-slate-900/60 px-2.5 py-2 rounded-xl border border-rose-100 dark:border-rose-900/30 gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={item?.cat.name}>
                      {item?.cat.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
                        {item?.reason}
                      </span>
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-300 font-mono">
                        {formatN(item?.st.remaining ?? 0)}원
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold">예산 관리</h2>
        <div className="flex gap-2">
          <button onClick={() => { setEntryModalInitialData(null); setShowEntryModal(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer" disabled={categories.length === 0}>
            <FilePlus2 size={16} /> 지출 품의
          </button>
        </div>
      </div>

      {/* Hierarchical & Multi-Criteria Filters */}
      <div className="glass-panel rounded-[2rem] p-5 shadow-2xs border border-white/20">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3 min-h-[32px]">
          <div className="text-sm font-bold text-slate-800 tracking-wide flex items-center gap-2">
            <span>다중 필터링 & 실시간 대조 시스템</span>
            {deferredSearchTerm && (
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full border border-indigo-100 font-normal shrink-0">
                검색어: "{deferredSearchTerm}"
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleSaveFilters} className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold border border-blue-200 transition-all cursor-pointer shadow-3xs">
              구성 저장하기
            </button>
            <button onClick={handleResetFilters} className="text-xs px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg font-semibold border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs">
              <RefreshCw size={12} /> 초기화 및 해제
            </button>
          </div>
        </div>

        {/* Keyword Search Input */}
        <div className="relative mb-3 z-10">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 z-20">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="사업명(정책/단위/세부), 통계목, 산출기초, 문서번호, 지출목적 실시간 검색..."
            className="w-full pl-10 pr-10 py-2 bg-white/80 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-text relative z-10"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer z-20"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap gap-2 items-center">
          <MultiSelectDropdown label="정책사업명" options={uniquePolicies} selected={filterPolicy} onChange={val => { setFilterPolicy(val); setFilterUnit([]); setFilterDetail([]); setFilterStat([]); }} />
          <MultiSelectDropdown label="단위사업명" options={unitOptions} selected={filterUnit} onChange={val => { setFilterUnit(val); setFilterDetail([]); setFilterStat([]); }} disabled={unitOptions.length === 0} />
          <MultiSelectDropdown label="세부사업명" options={detailOptions} selected={filterDetail} onChange={val => { setFilterDetail(val); setFilterStat([]); }} disabled={detailOptions.length === 0} />
          <MultiSelectDropdown label="통계목" options={statOptions} selected={filterStat} onChange={val => setFilterStat(val)} disabled={statOptions.length === 0} />

          {/* Month Filter Selector */}
          <div className="flex items-center gap-1.5 bg-white/80 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-3xs">
            <span className="text-slate-500 font-medium">월별:</span>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="전체">전체 (1~12월)</option>
              {Array.from({ length: 12 }, (_, i) => `${i + 1}월`).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Status Filter Selector */}
          <div className="flex items-center gap-1.5 bg-white/80 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-3xs">
            <span className="text-slate-500 font-medium">상태별:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="전체">전체 상태</option>
              <option value="초과">🚨 초과/위험 (95%↑)</option>
              <option value="주의">⚠️ 주의 (80%↑)</option>
              <option value="정상">✅ 정상 (&lt;80%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Overall Summary (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* Card 1: Total Budget */}
        <div className="glass-panel-dark rounded-[2rem] p-6 flex flex-col h-full justify-between shadow-2xs hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-semibold text-slate-400 tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50"></span> 전체 예산 현황
            </span>
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-indigo-400 group-hover:scale-110 transition-transform duration-300">
              <CircleDollarSign size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3 font-mono">
              {formatN(filteredStats.totalBudget)}
              <span className="text-sm font-medium text-slate-400 ml-1">원</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs text-slate-300 font-medium">
              총 집행액 <span className="font-semibold text-white ml-1">{formatN(filteredStats.totalSpent)}</span>원
            </div>
          </div>
        </div>
        
        {/* Card 2: General Account */}
        <div className="glass-panel rounded-[2rem] p-6 flex flex-col h-full justify-between shadow-2xs hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-semibold text-blue-600 tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></span> 일반 계좌 (e-호조 본청)
            </span>
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-500 group-hover:scale-110 transition-transform duration-300">
              <Wallet size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight mb-3 font-mono">
              {formatN(filteredStats.remaining)}
              <span className="text-sm font-bold text-gray-500 ml-1">원 잔여</span>
            </div>
            <div className="flex justify-between items-center text-xs bg-gray-50/80 px-3 py-2 rounded-xl border border-gray-100 text-gray-500 font-medium">
              <span>본청 직접 지출</span>
              <span className="font-semibold text-gray-700">{formatN(filteredStats.totalSpent - filteredStats.dailyExpenseIssued)}원</span>
            </div>
          </div>
        </div>

        {/* Card 3: Daily Expense Issuance */}
        <div className="glass-panel rounded-[2rem] p-5 flex flex-col h-full justify-between shadow-2xs hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-3">
            <span className="text-sm font-semibold text-amber-600 tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span> 일상경비 이체내역
            </span>
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => setShowDailyStatModal(true)} 
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 rounded-lg transition-colors font-bold border border-amber-200 flex items-center gap-1 cursor-pointer shadow-3xs"
              >
                통계목별
              </button>
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-100 text-amber-500 group-hover:scale-110 transition-transform duration-300">
                <Receipt size={18} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="bg-gray-50/80 rounded-xl p-2 border border-gray-100 flex justify-between items-center text-xs">
              <span className="text-gray-500 font-bold">교부액 (원금)</span>
              <span className="font-semibold text-gray-700 font-mono">{formatN(filteredStats.dailyExpenseIssued)}원</span>
            </div>
            <div className="bg-gray-50/80 rounded-xl p-2 border border-gray-100 flex justify-between items-center text-xs">
              <span className="text-gray-500 font-bold">실지출액</span>
              <span className="font-semibold text-gray-700 font-mono">{formatN(filteredStats.dailyExpenseSpent)}원</span>
            </div>
            <div className="bg-amber-50/80 rounded-xl p-2 border border-amber-100 flex justify-between items-center text-xs shadow-3xs">
              <span className="text-amber-800 font-bold">가용 잔액</span>
              <span className="font-bold text-amber-700 font-mono">{formatN(filteredStats.dailyExpenseRemaining)}원</span>
            </div>
          </div>
        </div>

        {/* Card 4: Total Available Remaining */}
        <div className="bg-gradient-to-br from-teal-700 to-emerald-800 rounded-[2rem] p-6 flex flex-col h-full justify-between shadow-2xs hover:shadow-lg hover:shadow-teal-600/25 hover:-translate-y-1 transition-all duration-300 group border border-teal-600/50">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-semibold text-teal-100 tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-300 shadow-sm shadow-teal-300/50"></span> 보건소 실질 총 가용
            </span>
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => setShowLedgerModal(true)} 
                className="flex items-center gap-1 bg-teal-800 hover:bg-teal-900 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors font-bold border border-teal-600 shadow-3xs cursor-pointer"
              >
                <Search size={12} /> 상세 대조
              </button>
              <div className="p-2 rounded-xl bg-teal-800/80 border border-teal-600 text-teal-300 group-hover:scale-110 transition-transform duration-300">
                <ShieldCheck size={18} />
              </div>
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-sm mb-3 font-mono">
              {formatN(filteredStats.remaining + filteredStats.dailyExpenseRemaining)}
              <span className="text-sm font-semibold text-teal-200 ml-1">원</span>
            </div>
            <div className="text-[11px] text-teal-100 font-medium bg-teal-900/40 p-2 rounded-xl border border-teal-600/30 flex justify-between items-center">
              <span>본청 e-호조: {formatN(filteredStats.remaining)}원</span>
              <span>일상 통장: {formatN(filteredStats.dailyExpenseRemaining)}원</span>
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <Card><div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]">예산 과목을 추가해 보세요</div></Card>
      ) : (
        <div ref={containerRef} className="space-y-3">
          {groupedByPolicy.length === 0 && <div className="text-center text-sm text-gray-500 py-8">선택된 필터에 해당하는 예산 과목이 없습니다.</div>}
          
          {isPolicyVirtualActive && topPadding > 0 && (
            <div style={{ height: `${topPadding}px` }} aria-hidden="true" />
          )}

          {visibleGroupedByPolicy.map(group => (
            <PolicyGroupCard
              key={group.policyName}
              group={group}
              entries={entries}
              getCategoryStats={getCategoryStats}
              deleteCategory={deleteCategory}
              deleteEntry={deleteEntry}
              openEditCat={handleEditCategory}
              openAddCat={handleAddCategory}
              openEditEntry={openEditEntry}
              openBatchEdit={openBatchEdit}
              updateCategory={updateCategory}
              updateEntry={updateEntry}
              hidePolicyHeader={filterDetail.length > 0}
            />
          ))}

          {isPolicyVirtualActive && bottomPadding > 0 && (
            <div style={{ height: `${bottomPadding}px` }} aria-hidden="true" />
          )}
        </div>
      )}

      {/* Law & Ordinance Search API Integration */}

      {/* Category Modal */}
      {showCatModal && (
        <CategoryEditModal
          isOpen={showCatModal}
          onClose={() => {
            setShowCatModal(false);
            if (returnToEntryModal) { setShowEntryModal(true); setReturnToEntryModal(false); }
          }}
          categoriesLength={categories.length}
          initialData={catModalInitialData}
          onSave={handleSaveCategory}
        />
      )}

      {/* Batch Edit Modal */}
      {showBatchModal && (
        <BatchEditModal
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          title={batchTitle}
          categories={batchCats}
          onApply={handleApplyBatchEdit}
        />
      )}

      {/* Expense Entry Modal */}
      {showEntryModal && (
        <ExpenseEntryModal
          isOpen={showEntryModal}
          onClose={() => setShowEntryModal(false)}
          categories={categories}
          entries={entries}
          getCategoryStats={getCategoryStats}
          initialData={entryModalInitialData}
          onSave={handleSaveEntry}
          onOpenCategoryModal={() => {
            setShowEntryModal(false);
            setReturnToEntryModal(true);
            setCatModalInitialData(null);
            setShowCatModal(true);
          }}
        />
      )}

      {/* Ledger Modal */}
      {showLedgerModal && (
        <LedgerModal
          isOpen={showLedgerModal}
          onClose={() => setShowLedgerModal(false)}
          categories={categories}
          entries={entries}
          getCategoryStats={getCategoryStats}
          onSettle={handleSettleEntry}
          batchUpdateEntries={batchUpdateEntries}
          batchDeleteEntries={batchDeleteEntries}
          batchSettleEntries={batchSettleEntries}
          onOpenExpenseEntry={(entry) => openEditEntry(entry)}
        />
      )}

      {/* Daily Expense Stat Modal */}
      {showDailyStatModal && (
        <DailyExpenseStatModal
          isOpen={showDailyStatModal}
          onClose={() => setShowDailyStatModal(false)}
          categories={filteredCategoriesTree}
          getCategoryStats={getCategoryStats}
        />
      )}
    </div>
  );
}
