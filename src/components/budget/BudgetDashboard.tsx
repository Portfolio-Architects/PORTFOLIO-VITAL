'use client';

import React, { useState, useCallback, useMemo, useRef, useContext } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { BudgetCategory, BudgetEntry } from '@/types';
import { useBudgetFilters } from '@/hooks/useBudgetFilters';
import { useBudget, CategoryStats } from '@/hooks/useBudget';
import { Card } from '@/components/ui/card';
import { RefreshCw, Search, FilePlus2, CircleDollarSign, Wallet, Receipt, ShieldCheck } from 'lucide-react';
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

export interface BudgetDashboardProps {
  categories?: BudgetCategory[];
  entries?: BudgetEntry[];
  addCategory?: (cat: Omit<BudgetCategory, 'id'>) => BudgetCategory;
  updateCategory?: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory?: (id: string) => void;
  replaceCategories?: (cats: BudgetCategory[]) => void;
  addEntry?: (entry: Omit<BudgetEntry, 'id'>) => void;
  updateEntry?: (id: string, updates: Partial<BudgetEntry>) => void;
  deleteEntry?: (id: string) => void;
  batchUpdateEntries?: (ids: string[] | Array<{ id: string; [key: string]: any }>, updates?: Partial<BudgetEntry>) => void;
  batchDeleteEntries?: (ids: string[]) => void;
  batchSettleEntries?: (ids: string[], status: 'SETTLED' | 'PENDING' | 'REJECTED') => void;
  getCategoryStats?: (id: string, excludePlanned?: boolean) => CategoryStats | null;
  overallStats?: { 
    totalBudget: number; totalSpent: number; totalPlanned: number; remaining: number;
    dailyExpenseIssued: number; dailyExpenseSpent: number; dailyExpenseRemaining: number;
  };
  onNavigateToSimulator?: () => void;
}

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

interface BudgetDashboardInnerProps extends BudgetDashboardProps {
  budgetHook?: ReturnType<typeof useBudget>;
}

function BudgetDashboardInner({
  categories: propCategories,
  entries: propEntries,
  addCategory: propAddCategory,
  updateCategory: propUpdateCategory,
  deleteCategory: propDeleteCategory,
  addEntry: propAddEntry,
  updateEntry: propUpdateEntry,
  deleteEntry: propDeleteEntry,
  batchUpdateEntries: propBatchUpdateEntries,
  batchDeleteEntries: propBatchDeleteEntries,
  batchSettleEntries: propBatchSettleEntries,
  getCategoryStats: propGetCategoryStats,
  budgetHook: hook,
}: BudgetDashboardInnerProps) {
  const hookCategories = hook?.categories;
  const hookEntries = hook?.entries;
  const categories = useMemo(() => propCategories ?? hookCategories ?? [], [propCategories, hookCategories]);
  const entries = useMemo(() => {
    if (propEntries) return propEntries;
    const raw = hookEntries ?? [];
    return raw.filter((e) => !e.isPlanned);
  }, [propEntries, hookEntries]);

  const hookAddCategory = hook?.addCategory;
  const addCategory = useCallback(
    (cat: Omit<BudgetCategory, 'id'>) => {
      if (propAddCategory) return propAddCategory(cat);
      if (hookAddCategory) return hookAddCategory(cat);
      return { ...cat, id: 'temp' } as BudgetCategory;
    },
    [propAddCategory, hookAddCategory]
  );

  const hookUpdateCategory = hook?.updateCategory;
  const updateCategory = useCallback(
    (id: string, updates: Partial<BudgetCategory>) => {
      if (propUpdateCategory) return propUpdateCategory(id, updates);
      if (hookUpdateCategory) return hookUpdateCategory(id, updates);
    },
    [propUpdateCategory, hookUpdateCategory]
  );

  const hookDeleteCategory = hook?.deleteCategory;
  const deleteCategory = useCallback(
    (id: string) => {
      if (propDeleteCategory) return propDeleteCategory(id);
      if (hookDeleteCategory) return hookDeleteCategory(id);
    },
    [propDeleteCategory, hookDeleteCategory]
  );

  const hookAddEntry = hook?.addEntry;
  const addEntry = useCallback(
    (entry: Omit<BudgetEntry, 'id'>) => {
      if (propAddEntry) return propAddEntry(entry);
      if (hookAddEntry) return hookAddEntry(entry);
    },
    [propAddEntry, hookAddEntry]
  );

  const hookUpdateEntry = hook?.updateEntry;
  const updateEntry = useCallback(
    (id: string, updates: Partial<BudgetEntry>) => {
      if (propUpdateEntry) return propUpdateEntry(id, updates);
      if (hookUpdateEntry) return hookUpdateEntry(id, updates);
    },
    [propUpdateEntry, hookUpdateEntry]
  );

  const hookDeleteEntry = hook?.deleteEntry;
  const deleteEntry = useCallback(
    (id: string) => {
      if (propDeleteEntry) return propDeleteEntry(id);
      if (hookDeleteEntry) return hookDeleteEntry(id);
    },
    [propDeleteEntry, hookDeleteEntry]
  );

  const batchUpdateEntries = propBatchUpdateEntries ?? hook?.batchUpdateEntries;
  const batchDeleteEntries = propBatchDeleteEntries ?? hook?.batchDeleteEntries;
  const batchSettleEntries = propBatchSettleEntries ?? hook?.batchSettleEntries;

  const hookGetCategoryStats = hook?.getCategoryStats;
  const getCategoryStats = useCallback(
    (id: string, excludePlanned?: boolean) => {
      if (propGetCategoryStats) return propGetCategoryStats(id, excludePlanned);
      if (hookGetCategoryStats) return hookGetCategoryStats(id, excludePlanned);
      return null;
    },
    [propGetCategoryStats, hookGetCategoryStats]
  );

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

  const containerRef = useRef<HTMLDivElement>(null);

  const {
    filterPolicy, setFilterPolicy,
    filterUnit, setFilterUnit,
    filterDetail, setFilterDetail,
    filterStat, setFilterStat,
    filterMonth, setFilterMonth,
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
      {/* Minimalist Top Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">예산 관리</h2>
          <span className="text-xs sm:text-sm text-slate-400 font-medium">
            {groupedByPolicy.length}개 정책사업 · {filteredCategoriesTree.length}개 통계목
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEntryModalInitialData(null); setShowEntryModal(true); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
            disabled={categories.length === 0}
          >
            <FilePlus2 size={16} /> 지출 품의
          </button>
        </div>
      </div>

      {/* Overall Summary (4 Unified Minimalist KPI Cards) */}
      {(() => {
        const overallExecRate = filteredStats.totalBudget > 0 ? (filteredStats.totalSpent / filteredStats.totalBudget) * 100 : 0;
        const overallRemRate = filteredStats.totalBudget > 0 ? (filteredStats.remaining / filteredStats.totalBudget) * 100 : 0;
        const realAvailableRemRate = filteredStats.totalBudget > 0 ? ((filteredStats.remaining + filteredStats.dailyExpenseRemaining) / filteredStats.totalBudget) * 100 : 0;

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Budget */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-slate-600">전체 예산 현황</span>
                  <CircleDollarSign size={18} className="text-slate-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono tabular-nums">
                  {formatN(filteredStats.totalBudget)}
                  <span className="text-sm font-medium text-slate-400 ml-1">원</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex mb-2.5" title={`집행률: ${overallExecRate.toFixed(1)}% | 실질 미집행률: ${realAvailableRemRate.toFixed(1)}%`}>
                  <div 
                    className="bg-slate-900 h-full transition-colors duration-500" 
                    style={{ width: `${Math.min(100, overallExecRate)}%` }} 
                  />
                  <div 
                    className="bg-emerald-500/70 h-full transition-colors duration-500" 
                    style={{ width: `${Math.min(100 - Math.min(100, overallExecRate), realAvailableRemRate)}%` }} 
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-slate-600 font-semibold">집행 <strong className="text-slate-900">{overallExecRate.toFixed(1)}%</strong></span>
                  <span className="text-slate-500 font-semibold">미집행 <strong className="text-emerald-700">{realAvailableRemRate.toFixed(1)}%</strong></span>
                </div>
              </div>
            </div>
            
            {/* Card 2: General Account */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-slate-600">일반 계좌 (e-호조 본청)</span>
                  <Wallet size={18} className="text-slate-400" />
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono tabular-nums">
                    {formatN(filteredStats.remaining)}
                    <span className="text-sm font-medium text-slate-400 ml-1">원 잔여</span>
                  </div>
                  <span className="text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded bg-slate-100 text-slate-700" title="e-호조 본청 잔여율">
                    본청 잔여 {overallRemRate.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                <span className="font-medium">본청 직접 지출</span>
                <span className="font-bold text-slate-800 font-mono tabular-nums">{formatN(filteredStats.totalSpent - filteredStats.dailyExpenseIssued)}원</span>
              </div>
            </div>

            {/* Card 3: Daily Expense Issuance */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold text-slate-600">일상경비 이체내역</span>
                <div className="flex gap-1.5 items-center">
                  <button 
                    onClick={() => setShowDailyStatModal(true)} 
                    className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md transition-colors font-semibold border border-slate-200/80 cursor-pointer"
                  >
                    통계목별
                  </button>
                  <Receipt size={18} className="text-slate-400" />
                </div>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">교부액 (원금)</span>
                  <span className="font-semibold text-slate-800 font-mono tabular-nums">{formatN(filteredStats.dailyExpenseIssued)}원</span>
                </div>
                <div className="py-2 flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">실지출액</span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">
                      집행 {filteredStats.dailyExpenseIssued > 0 ? ((filteredStats.dailyExpenseSpent / filteredStats.dailyExpenseIssued) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </div>
                  <span className="font-semibold text-slate-800 font-mono tabular-nums">{formatN(filteredStats.dailyExpenseSpent)}원</span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-700 font-bold">가용 잔액</span>
                    <span className="text-[11px] font-mono tabular-nums text-amber-600 font-semibold">
                      미집행 {filteredStats.dailyExpenseIssued > 0 ? ((filteredStats.dailyExpenseRemaining / filteredStats.dailyExpenseIssued) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </div>
                  <span className="font-bold text-amber-700 font-mono tabular-nums">{formatN(filteredStats.dailyExpenseRemaining)}원</span>
                </div>
              </div>
            </div>

            {/* Card 4: Total Available Remaining */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    보건소 실질 총 가용
                  </span>
                  <div className="flex gap-1.5 items-center">
                    <button 
                      onClick={() => setShowLedgerModal(true)} 
                      className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-md transition-colors font-semibold border border-slate-200/80 cursor-pointer"
                    >
                      <Search size={12} /> 상세 대조
                    </button>
                    <ShieldCheck size={18} className="text-emerald-600" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight font-mono tabular-nums">
                    {formatN(filteredStats.remaining + filteredStats.dailyExpenseRemaining)}
                    <span className="text-sm font-medium text-slate-400 ml-1">원</span>
                  </div>
                  <span className="text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60" title="전체 예산 대비 실질 총 가용률(미집행률)">
                    실질 미집행 {realAvailableRemRate.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center font-mono tabular-nums">
                <span>본청 e-호조: {formatN(filteredStats.remaining)}원</span>
                <span>일상 통장: {formatN(filteredStats.dailyExpenseRemaining)}원</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Minimalist Filter & Search Bar */}
      <div className="bg-white rounded-xl p-5 shadow-2xs border border-slate-200/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          {/* Keyword Search Input */}
          <div className="relative flex-1 z-10">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 z-20">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="사업명 · 통계목 · 산출기초 · 문서번호 검색"
              className="w-full pl-10 pr-9 py-2 bg-slate-50/70 focus:bg-white border border-slate-200/90 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-colors cursor-text relative z-10"
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

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            {deferredSearchTerm && (
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-medium shrink-0">
                검색어: &quot;{deferredSearchTerm}&quot;
              </span>
            )}
            <button onClick={handleSaveFilters} className="text-xs sm:text-sm px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-medium border border-slate-200/90 transition-colors cursor-pointer">
              필터 저장
            </button>
            <button onClick={handleResetFilters} className="text-xs sm:text-sm px-3 py-2 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-lg font-medium border border-slate-200/90 transition-colors flex items-center gap-1 cursor-pointer">
              <RefreshCw size={12} /> 초기화
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap gap-2 items-center">
          <MultiSelectDropdown label="정책사업명" options={uniquePolicies} selected={filterPolicy} onChange={val => { setFilterPolicy(val); setFilterUnit([]); setFilterDetail([]); setFilterStat([]); }} />
          <MultiSelectDropdown label="단위사업명" options={unitOptions} selected={filterUnit} onChange={val => { setFilterUnit(val); setFilterDetail([]); setFilterStat([]); }} disabled={unitOptions.length === 0} />
          <MultiSelectDropdown label="세부사업명" options={detailOptions} selected={filterDetail} onChange={val => { setFilterDetail(val); setFilterStat([]); }} disabled={detailOptions.length === 0} />
          <MultiSelectDropdown label="통계목" options={statOptions} selected={filterStat} onChange={val => setFilterStat(val)} disabled={statOptions.length === 0} />

          {/* Month Filter Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50/70 border border-slate-200/90 rounded-lg px-3 py-2 text-xs sm:text-sm">
            <span className="text-slate-400 font-medium">월별</span>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="전체">전체 (1~12월)</option>
              {Array.from({ length: 12 }, (_, i) => `${i + 1}월`).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <Card><div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]">예산 과목을 추가해 보세요</div></Card>
      ) : (
        <div ref={containerRef} className="space-y-4">
          {groupedByPolicy.length === 0 && <div className="text-center text-sm text-gray-500 py-8">조건 일치 예산 과목 없음</div>}
          
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

function BudgetDashboardWithHook(props: BudgetDashboardProps) {
  const budgetHook = useBudget();
  return <BudgetDashboardInner {...props} budgetHook={budgetHook} />;
}

export function BudgetDashboard(props: BudgetDashboardProps = {}) {
  const queryClient = useContext(QueryClientContext);
  if (queryClient && (!props.categories || !props.entries)) {
    return <BudgetDashboardWithHook {...props} />;
  }
  return <BudgetDashboardInner {...props} />;
}

