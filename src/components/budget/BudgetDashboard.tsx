'use client';

import React, { useState, useCallback, useMemo, useRef, useContext } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { BudgetCategory, BudgetEntry, SimulationEntry } from '@/types';
import { useBudgetFilters } from '@/hooks/useBudgetFilters';
import { useBudget, CategoryStats } from '@/hooks/useBudget';
import { useBudgetSimulator, UseBudgetSimulatorReturn } from '@/hooks/useBudgetSimulator';
import { Card } from '@/components/ui/card';
import { SegmentedTabs, SegmentedTabItem } from '@/components/ui/segmented-tabs';
import {
  RefreshCw,
  Search,
  FilePlus2,
  CircleDollarSign,
  Wallet,
  Receipt,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  CalendarPlus,
} from 'lucide-react';
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

const SimulationBurnUpChart = dynamic(
  () => import('./ui/SimulationBurnUpChart').then((mod) => mod.SimulationBurnUpChart),
  {
    ssr: false,
    loading: () => <div className="h-[280px] bg-slate-100/80 rounded-xl animate-pulse border border-slate-200/70" />,
  }
);

const SimulationResultTable = dynamic(
  () => import('./ui/SimulationResultTable').then((mod) => mod.SimulationResultTable),
  {
    ssr: false,
    loading: () => <div className="h-64 bg-slate-100/80 rounded-xl animate-pulse border border-slate-200/70" />,
  }
);

const SimulationInputModal = dynamic(
  () => import('./ui/SimulationInputModal').then((mod) => mod.SimulationInputModal),
  { ssr: false }
);

const SimulationSettleModal = dynamic(
  () => import('./ui/SimulationSettleModal').then((mod) => mod.SimulationSettleModal),
  { ssr: false }
);

export type BudgetSubView = 'categories' | 'plan';

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
    totalBudget: number;
    totalSpent: number;
    totalPlanned: number;
    remaining: number;
    dailyExpenseIssued: number;
    dailyExpenseSpent: number;
    dailyExpenseRemaining: number;
  };
  onNavigateToSimulator?: () => void;
  initialSubView?: BudgetSubView;
  initialShowBurnUp?: boolean;
  focusSeq?: number;
  simHook?: UseBudgetSimulatorReturn;
}

function formatN(n: number) {
  return n.toLocaleString('ko-KR');
}

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
  initialSubView = 'categories',
  initialShowBurnUp = false,
  focusSeq = 0,
  budgetHook: hook,
  simHook,
}: BudgetDashboardInnerProps) {
  const hookCategories = hook?.categories;
  const hookEntries = hook?.entries;
  const categories = useMemo(() => propCategories ?? hookCategories ?? [], [propCategories, hookCategories]);
  const rawBudgetEntries = useMemo(() => propEntries ?? hookEntries ?? [], [propEntries, hookEntries]);
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

  // Unified Sub-View & Burn-Up Toggle State (reacts to prop changes AND repeated explicit navigation via focusSeq)
  const [subView, setSubView] = useState<BudgetSubView>(initialSubView);
  const [showBurnUp, setShowBurnUp] = useState<boolean>(initialShowBurnUp);

  const focusKey = `${initialSubView}:${initialShowBurnUp}:${focusSeq}`;
  const [prevFocusKey, setPrevFocusKey] = useState<string>(focusKey);
  if (focusKey !== prevFocusKey) {
    setPrevFocusKey(focusKey);
    setSubView(initialSubView);
    if (initialShowBurnUp) {
      setShowBurnUp(true);
    }
  }

  // Budget Modals State
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

  // Integrated Simulation Modals State
  const [showSimInputModal, setShowSimInputModal] = useState(false);
  const [editingSimEntry, setEditingSimEntry] = useState<SimulationEntry | null>(null);
  const [settlingSimItem, setSettlingSimItem] = useState<SimulationEntry | null>(null);

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

  // Simulation Derived State (only active when simHook is wired)
  const simEntries = simHook?.entries;
  const projectSummaries = simHook?.projectSummaries;
  const statItemSummaries = simHook?.statItemSummaries;

  const hasActiveFilters =
    filterPolicy.length > 0 ||
    filterUnit.length > 0 ||
    filterDetail.length > 0 ||
    filterStat.length > 0 ||
    (Boolean(filterMonth) && filterMonth !== '전체') ||
    Boolean(deferredSearchTerm);

  const { simMetrics, visibleStatItemSummaries, visibleProjectSummaries, visibleSimEntries } = useMemo(() => {
    if (!simHook || !statItemSummaries || !simEntries) {
      return {
        simMetrics: null,
        visibleStatItemSummaries: [] as typeof statItemSummaries extends Array<infer T> ? T[] : never[],
        visibleProjectSummaries: [] as typeof projectSummaries extends Array<infer T> ? T[] : never[],
        visibleSimEntries: [] as SimulationEntry[],
      };
    }

    const visibleKeys = new Set<string>();
    const visibleCatIds = new Set<string>();
    const visibleProjects = new Set<string>();
    for (let i = 0; i < filteredCategoriesTree.length; i++) {
      const c = filteredCategoriesTree[i];
      visibleCatIds.add(c.id);
      const dp = c.detailedProject || '기타';
      visibleProjects.add(dp);
      visibleKeys.add(`${dp}::${c.statItem || '일반'}`);
    }

    const filteredStatSummaries = hasActiveFilters
      ? statItemSummaries.filter((s) => visibleKeys.has(`${s.detailedProject}::${s.statItem}`))
      : statItemSummaries;

    let actualGeneralRemaining = 0;
    let actualDailyRemaining = 0;
    let simGeneral = 0;
    let simDaily = 0;
    let simTotal = 0;
    let simBidSaving = 0;
    let shortfall = 0;
    let finalExpectedBalance = 0;
    let finalDailyRemaining = 0;

    for (let i = 0; i < filteredStatSummaries.length; i++) {
      const s = filteredStatSummaries[i];
      const locked = s.lockedAmount || 0;
      actualGeneralRemaining += s.currentRemaining - locked;
      actualDailyRemaining += s.dailyExpenseRemaining || 0;
      simGeneral += s.simulatedGeneralExpenditure || 0;
      simDaily += s.simulatedDailyExpenditure || 0;
      simTotal += s.simulatedExpenditure || 0;
      simBidSaving += s.simulatedBidSaving || 0;
      shortfall += s.dailyExpenseShortfall || 0;
      finalExpectedBalance += s.finalExpectedBalance - locked;
      finalDailyRemaining += s.finalDailyExpenseRemaining ?? s.dailyExpenseRemaining ?? 0;
    }

    const filteredEntries: SimulationEntry[] = [];
    let activeSimCount = 0;
    let activeBidSavingCount = 0;
    for (let i = 0; i < simEntries.length; i++) {
      const e = simEntries[i];
      const isMatch = !hasActiveFilters || (
        e.categoryId
          ? visibleCatIds.has(e.categoryId)
          : visibleKeys.has(`${e.detailedProject || '기타'}::${e.statItem || '일반'}`)
      );
      if (!isMatch) continue;
      filteredEntries.push(e);
      if (e.status !== 'SETTLED') {
        if (e.actionType === 'bid_saving') {
          activeBidSavingCount += 1;
        } else {
          activeSimCount += 1;
        }
      }
    }

    // Re-aggregate projectSummaries when filters narrow down stat items within a project; reuse raw summaries when unfiltered
    let filteredProjectSummaries = projectSummaries ?? [];
    if (hasActiveFilters) {
      const projMap = new Map<string, (typeof filteredProjectSummaries)[number]>();
      for (let i = 0; i < filteredStatSummaries.length; i++) {
        const item = filteredStatSummaries[i];
        const dp = item.detailedProject;
        let target = projMap.get(dp);
        if (!target) {
          target = {
            detailedProject: dp,
            totalBudget: 0,
            currentSpent: 0,
            currentRemaining: 0,
            simulatedExpenditure: 0,
            simulatedGeneralExpenditure: 0,
            simulatedDailyExpenditure: 0,
            simulatedBidSaving: 0,
            finalExpectedBalance: 0,
            finalDailyExpenseRemaining: 0,
            executionRate: 0,
            isDeficit: false,
            dailyExpenseIssued: 0,
            dailyExpenseSpent: 0,
            dailyExpenseRemaining: 0,
            dailyExpenseShortfall: 0,
            needsAdditionalIssuance: false,
            lockedAmount: 0,
          };
          projMap.set(dp, target);
        }
        target.totalBudget += item.totalBudget;
        target.currentSpent += item.currentSpent;
        target.currentRemaining += item.currentRemaining;
        target.simulatedExpenditure += item.simulatedExpenditure;
        target.simulatedGeneralExpenditure = (target.simulatedGeneralExpenditure || 0) + (item.simulatedGeneralExpenditure || 0);
        target.simulatedDailyExpenditure = (target.simulatedDailyExpenditure || 0) + (item.simulatedDailyExpenditure || 0);
        target.simulatedBidSaving = (target.simulatedBidSaving || 0) + (item.simulatedBidSaving || 0);
        target.dailyExpenseIssued = (target.dailyExpenseIssued || 0) + (item.dailyExpenseIssued || 0);
        target.dailyExpenseSpent = (target.dailyExpenseSpent || 0) + (item.dailyExpenseSpent || 0);
        target.dailyExpenseRemaining = (target.dailyExpenseRemaining || 0) + (item.dailyExpenseRemaining || 0);
        target.dailyExpenseShortfall = (target.dailyExpenseShortfall || 0) + (item.dailyExpenseShortfall || 0);
        target.finalDailyExpenseRemaining = (target.finalDailyExpenseRemaining || 0) + (item.finalDailyExpenseRemaining || 0);
        target.finalExpectedBalance += item.finalExpectedBalance;
        target.lockedAmount = (target.lockedAmount || 0) + (item.lockedAmount || 0);
      }
      filteredProjectSummaries = Array.from(projMap.values()).map((target) => ({
        ...target,
        executionRate: target.totalBudget > 0
          ? ((target.currentSpent + target.simulatedExpenditure) / target.totalBudget) * 100
          : 0,
        isDeficit: target.finalExpectedBalance < 0,
        needsAdditionalIssuance: (target.dailyExpenseShortfall || 0) > 0,
      })).sort((a, b) => a.detailedProject.localeCompare(b.detailedProject));
    }

    const actualTotalAvailable = actualGeneralRemaining + actualDailyRemaining;
    const finalTotalAvailable = finalExpectedBalance + finalDailyRemaining;

    return {
      simMetrics: {
        actualGeneralRemaining,
        actualDailyRemaining,
        simGeneral,
        simDaily,
        simTotal,
        simBidSaving,
        shortfall,
        finalExpectedBalance,
        finalDailyRemaining,
        actualTotalAvailable,
        finalTotalAvailable,
        activeSimCount,
        activeBidSavingCount,
      },
      visibleStatItemSummaries: filteredStatSummaries,
      visibleProjectSummaries: filteredProjectSummaries,
      visibleSimEntries: filteredEntries,
    };
  }, [simHook, statItemSummaries, projectSummaries, simEntries, filteredCategoriesTree, hasActiveFilters]);

  const deficitProjectsCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < visibleProjectSummaries.length; i++) {
      if (visibleProjectSummaries[i].isDeficit) count++;
    }
    return count;
  }, [visibleProjectSummaries]);

  const riskProjects = useMemo(() => {
    return visibleProjectSummaries.filter((p) => p.executionRate < 70 && p.currentRemaining > 0);
  }, [visibleProjectSummaries]);

  const subViewTabs = useMemo<ReadonlyArray<SegmentedTabItem<BudgetSubView>>>(() => [
    { id: 'categories', label: '과목별 대조', badgeCount: filteredCategoriesTree.length },
    { id: 'plan', label: '예정 · 소진 표', badgeCount: (simMetrics?.activeSimCount ?? 0) + (simMetrics?.activeBidSavingCount ?? 0) },
  ], [filteredCategoriesTree.length, simMetrics?.activeSimCount, simMetrics?.activeBidSavingCount]);

  // Budget CRUD Callbacks
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
    const plannedEntry = rawBudgetEntries.find(e => e.id === plannedEntryId);
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
  }, [rawBudgetEntries, updateEntry, addEntry]);

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

  // Integrated Simulation Callbacks
  const handleOpenAddSim = useCallback(() => {
    setEditingSimEntry(null);
    setShowSimInputModal(true);
  }, []);

  const handleOpenAddSimForCategory = useCallback((cat: BudgetCategory) => {
    setEditingSimEntry({
      id: '',
      name: '',
      detailedProject: cat.detailedProject || '',
      statItem: cat.statItem || cat.name || '',
      categoryId: cat.id,
      actionType: 'general',
      unitPrice: 0,
      quantity: 1,
      amount: 0,
      createdAt: new Date().toISOString(),
    });
    setShowSimInputModal(true);
  }, []);

  const handleOpenEditSim = useCallback((entry: SimulationEntry) => {
    setEditingSimEntry(entry);
    setShowSimInputModal(true);
  }, []);

  const handleOpenSettleSim = useCallback((simId: string) => {
    const item = simEntries?.find((e) => e.id === simId);
    if (!item) return;
    setSettlingSimItem(item);
  }, [simEntries]);

  const handleConfirmSettleSim = useCallback(async (simId: string, actualAmount: number, actualDate: string) => {
    if (!simHook) return false;
    const result = await simHook.settleEntry(simId, actualAmount, actualDate);
    if (result !== false) {
      setSettlingSimItem(null);
    }
    return result;
  }, [simHook]);

  const handleSafeDeleteSim = useCallback((simId: string) => {
    if (!simHook) return;
    const target = simEntries?.find((e) => e.id === simId);
    const label = target ? `'${target.name}' ` : '';
    if (window.confirm(`${label}지출 예정 항목을 삭제할까요? (실집행 원장은 보존됨)`)) {
      simHook.deleteEntry(simId);
    }
  }, [simHook, simEntries]);

  const handleSafeResetSim = useCallback(() => {
    if (!simHook) return;
    if (window.confirm('등록된 지출 예정 항목을 모두 초기화할까요? (실집행 원장은 보존됨)')) {
      simHook.resetEntries();
    }
  }, [simHook]);

  const handleSafeLoadPresetSim = useCallback(() => {
    if (!simHook) return;
    if (window.confirm('현재 지출 예정 목록을 표준 테스트 프리셋으로 교체할까요? (기존 예정 항목은 덮어쓰기됨)')) {
      simHook.loadTestPreset();
    }
  }, [simHook]);

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

  const hasActiveSim = Boolean(simMetrics && (simMetrics.simTotal > 0 || simMetrics.simBidSaving > 0));
  const displayGeneralRem = hasActiveSim && simMetrics ? simMetrics.finalExpectedBalance : filteredStats.remaining;
  const displayDailyRem = hasActiveSim && simMetrics ? simMetrics.finalDailyRemaining : filteredStats.dailyExpenseRemaining;
  const displayTotalAvailable = hasActiveSim && simMetrics
    ? simMetrics.finalTotalAvailable
    : filteredStats.remaining + filteredStats.dailyExpenseRemaining;

  const overallExecRate = filteredStats.totalBudget > 0 ? (filteredStats.totalSpent / filteredStats.totalBudget) * 100 : 0;
  // 낙찰차액(simBidSaving)은 가용 잔액에서 차감하되 예상 최종 집행률에는 미포함
  const projectedGeneralSpent = hasActiveSim && simMetrics
    ? filteredStats.totalBudget - simMetrics.finalExpectedBalance - simMetrics.simBidSaving
    : filteredStats.totalSpent;
  const projectedExecRate = filteredStats.totalBudget > 0 ? (projectedGeneralSpent / filteredStats.totalBudget) * 100 : 0;
  const projectedDeltaRate = Math.max(0, projectedExecRate - overallExecRate);
  const bidSavingRate = hasActiveSim && simMetrics && filteredStats.totalBudget > 0
    ? (simMetrics.simBidSaving / filteredStats.totalBudget) * 100
    : 0;
  const overallRemRate = filteredStats.totalBudget > 0 ? (displayGeneralRem / filteredStats.totalBudget) * 100 : 0;
  const realAvailableRemRate = filteredStats.totalBudget > 0 ? (displayTotalAvailable / filteredStats.totalBudget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Unified Minimalist Top Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <div className="flex items-center flex-wrap gap-2.5">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">예산 현황</h2>
          <span className="text-xs sm:text-sm text-slate-400 font-medium">
            {groupedByPolicy.length}개 정책사업 · {filteredCategoriesTree.length}개 통계목
            {simMetrics ? ` · ${simMetrics.activeSimCount}건 예정` : ''}
            {simMetrics && simMetrics.activeBidSavingCount > 0 ? ` · ${simMetrics.activeBidSavingCount}건 유보` : ''}
          </span>
          {simHook && categories.length > 0 && (
            deficitProjectsCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 border border-rose-200/80 rounded-lg text-rose-700 text-xs font-bold">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                {deficitProjectsCount}개 사업 초과 경고
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50/80 border border-emerald-200/70 rounded-lg text-emerald-700 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                전 사업 잔액 안전
              </span>
            )
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {simHook && (
            <>
              <button
                type="button"
                onClick={() => setShowBurnUp((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors cursor-pointer ${
                  showBurnUp
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90'
                }`}
              >
                <TrendingUp size={15} /> 소진 차트
              </button>
              <button
                type="button"
                onClick={handleOpenAddSim}
                disabled={categories.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
              >
                <CalendarPlus size={15} /> 지출 예정
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => { setEntryModalInitialData(null); setShowEntryModal(true); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
            disabled={categories.length === 0}
          >
            <FilePlus2 size={15} /> 지출 품의
          </button>
        </div>
      </div>

      {/* Overall Summary (4 Unified Minimalist KPI Cards) */}
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
            <div
              className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex mb-2.5"
              title={`실집행: ${overallExecRate.toFixed(1)}%${hasActiveSim && projectedDeltaRate > 0 ? ` | 예정포함: ${projectedExecRate.toFixed(1)}%` : ''}${bidSavingRate > 0 ? ` | 낙찰차액 유보: ${bidSavingRate.toFixed(1)}%` : ''} | 실질 미집행: ${realAvailableRemRate.toFixed(1)}%`}
            >
              <div
                className="bg-slate-900 h-full transition-colors duration-500"
                style={{ width: `${Math.min(100, overallExecRate)}%` }}
              />
              {hasActiveSim && projectedDeltaRate > 0 && (
                <div
                  className="bg-indigo-500 h-full transition-colors duration-500"
                  style={{ width: `${Math.min(Math.max(0, 100 - overallExecRate), projectedDeltaRate)}%` }}
                />
              )}
              {bidSavingRate > 0 && (
                <div
                  className="bg-violet-500 h-full transition-colors duration-500"
                  style={{ width: `${Math.min(Math.max(0, 100 - (hasActiveSim ? projectedExecRate : overallExecRate)), bidSavingRate)}%` }}
                />
              )}
              <div
                className="bg-emerald-500/70 h-full transition-colors duration-500"
                style={{
                  width: `${Math.max(0, Math.min(100 - Math.min(100, (hasActiveSim ? projectedExecRate : overallExecRate) + bidSavingRate), Math.max(0, realAvailableRemRate)))}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums flex-wrap">
              <span className="text-slate-600 font-semibold">
                집행 <strong className="text-slate-900">{overallExecRate.toFixed(1)}%</strong>
                {hasActiveSim && projectedDeltaRate > 0 && (
                  <span className="text-indigo-600 font-bold ml-1.5">· 예정 {projectedExecRate.toFixed(1)}%</span>
                )}
                {bidSavingRate > 0 && (
                  <span className="text-violet-600 font-bold ml-1.5">· 유보 {bidSavingRate.toFixed(1)}%</span>
                )}
              </span>
              <span className="text-slate-500 font-semibold">
                미집행 <strong className={realAvailableRemRate < 0 ? 'text-rose-600' : 'text-emerald-700'}>{realAvailableRemRate.toFixed(1)}%</strong>
              </span>
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
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <div className={`text-2xl sm:text-3xl font-black tracking-tight font-mono tabular-nums ${displayGeneralRem < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatN(displayGeneralRem)}
                <span className="text-sm font-medium text-slate-400 ml-1">원 잔여</span>
              </div>
              <span
                className={`text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded ${
                  displayGeneralRem < 0 ? 'bg-rose-50 text-rose-700 border border-rose-200/70' : 'bg-slate-100 text-slate-700'
                }`}
                title="e-호조 본청 잔여율"
              >
                본청 잔여 {overallRemRate.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-500">
            <div className="flex justify-between items-center">
              <span className="font-medium">본청 직접 지출</span>
              <span className="font-bold text-slate-800 font-mono tabular-nums">
                {formatN(filteredStats.totalSpent - filteredStats.dailyExpenseIssued)}원
              </span>
            </div>
            {hasActiveSim && simMetrics && (simMetrics.simGeneral > 0 || simMetrics.shortfall > 0 || simMetrics.simBidSaving > 0) && (
              <div className="flex justify-between items-center gap-1 flex-wrap font-mono tabular-nums text-[11px] text-slate-500">
                <span>실잔여 {formatN(simMetrics.actualGeneralRemaining)}원</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(simMetrics.simGeneral > 0 || simMetrics.shortfall > 0) && (
                    <span className="font-semibold text-indigo-600">
                      예정 -{formatN(simMetrics.simGeneral + simMetrics.shortfall)}원
                    </span>
                  )}
                  {simMetrics.simBidSaving > 0 && (
                    <span className="font-semibold text-violet-600">
                      유보 -{formatN(simMetrics.simBidSaving)}원
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Daily Expense Issuance */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-slate-600">일상경비 이체내역</span>
            <div className="flex gap-1.5 items-center">
              <button
                type="button"
                onClick={() => setShowDailyStatModal(true)}
                className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md transition-colors font-semibold border border-slate-200/80 cursor-pointer"
              >
                통계목별
              </button>
              <Receipt size={18} className="text-slate-400" />
            </div>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-1.5 flex justify-between items-center">
              <span className="text-slate-500 font-medium">교부액 (원금)</span>
              <span className="font-semibold text-slate-800 font-mono tabular-nums">{formatN(filteredStats.dailyExpenseIssued)}원</span>
            </div>
            <div className="py-1.5 flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">실지출액</span>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  집행 {filteredStats.dailyExpenseIssued > 0 ? ((filteredStats.dailyExpenseSpent / filteredStats.dailyExpenseIssued) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              <span className="font-semibold text-slate-800 font-mono tabular-nums">{formatN(filteredStats.dailyExpenseSpent)}원</span>
            </div>
            <div className="py-1.5 flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-700 font-bold">가용 잔액</span>
                <span className="text-[11px] font-mono tabular-nums text-amber-600 font-semibold">
                  미집행 {filteredStats.dailyExpenseIssued > 0 ? ((filteredStats.dailyExpenseRemaining / filteredStats.dailyExpenseIssued) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              <span className="font-bold text-amber-700 font-mono tabular-nums">{formatN(filteredStats.dailyExpenseRemaining)}원</span>
            </div>
            {hasActiveSim && simMetrics && simMetrics.simDaily > 0 && (
              <div className="pt-1.5 flex justify-between items-center gap-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-indigo-700 font-bold">예정 반영</span>
                  {simMetrics.shortfall > 0 ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200/80 font-mono tabular-nums">
                      추가교부 +{formatN(simMetrics.shortfall)}원
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono tabular-nums text-indigo-600 font-semibold">
                      -{formatN(simMetrics.simDaily)}원
                    </span>
                  )}
                </div>
                <span className="font-bold text-indigo-700 font-mono tabular-nums">
                  {formatN(simMetrics.finalDailyRemaining)}원
                </span>
              </div>
            )}
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
                  type="button"
                  onClick={() => setShowLedgerModal(true)}
                  className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-md transition-colors font-semibold border border-slate-200/80 cursor-pointer"
                >
                  <Search size={12} /> 상세 대조
                </button>
                <ShieldCheck size={18} className="text-emerald-600" />
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <div className={`text-2xl sm:text-3xl font-black tracking-tight font-mono tabular-nums ${displayTotalAvailable < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {formatN(displayTotalAvailable)}
                <span className="text-sm font-medium text-slate-400 ml-1">원</span>
              </div>
              <span
                className={`text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded border ${
                  displayTotalAvailable < 0
                    ? 'bg-rose-50 text-rose-700 border-rose-200/70'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                }`}
                title="전체 예산 대비 실질 총 가용률(미집행률)"
              >
                실질 미집행 {realAvailableRemRate.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-500 font-mono tabular-nums">
            <div className="flex justify-between items-center">
              <span>본청 e-호조: {formatN(displayGeneralRem)}원</span>
              <span>일상 통장: {formatN(displayDailyRem)}원</span>
            </div>
            {hasActiveSim && simMetrics && (
              <div className="flex justify-between items-center gap-1 flex-wrap text-[11px] text-slate-500">
                <span>현재 실가용 {formatN(simMetrics.actualTotalAvailable)}원</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {simMetrics.simTotal > 0 && (
                    <span className="text-indigo-600 font-semibold">
                      예정 {simMetrics.activeSimCount}건 (-{formatN(simMetrics.simTotal)}원)
                    </span>
                  )}
                  {simMetrics.simBidSaving > 0 && (
                    <span className="text-violet-600 font-semibold">
                      유보 {simMetrics.activeBidSavingCount}건 (-{formatN(simMetrics.simBidSaving)}원)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Risk Monitoring Quick Chips */}
      {simHook && riskProjects.length > 0 && (
        <div className="bg-white border border-rose-200/80 rounded-xl p-4 shadow-2xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-slate-900">
                불용 위험 사업 ({riskProjects.length}개)
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              클릭 → 지출 예정 즉시 등록
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {riskProjects.map((p) => (
              <button
                key={p.detailedProject}
                type="button"
                onClick={() => {
                  setEditingSimEntry({
                    id: '',
                    name: `${p.detailedProject} 하반기 물품/용역 소진`,
                    detailedProject: p.detailedProject,
                    statItem: simHook.getStatItemsForProject(p.detailedProject)[0] || '',
                    unitPrice: Math.min(p.currentRemaining, 1000000),
                    quantity: 1,
                    amount: Math.min(p.currentRemaining, 1000000),
                    createdAt: new Date().toISOString(),
                  });
                  setShowSimInputModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-50/80 hover:bg-rose-50/60 text-slate-700 hover:text-rose-700 border border-slate-200/80 hover:border-rose-200 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="font-bold text-slate-800">{p.detailedProject}</span>
                <span className="text-xs text-rose-600 font-mono tabular-nums">
                  ({p.executionRate.toFixed(1)}% | 잔액 {formatN(p.currentRemaining)}원)
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible Commitment Burn-Up Chart */}
      {simHook && showBurnUp && (
        <SimulationBurnUpChart
          categories={hasActiveFilters ? filteredCategoriesTree : categories}
          budgetEntries={rawBudgetEntries}
          entries={visibleSimEntries}
          projectSummaries={visibleProjectSummaries}
          availableDetailedProjects={simHook.availableDetailedProjects}
        />
      )}

      {/* Unified Sub-View Switcher (Categories vs Plan/Burn-down Table) */}
      {simHook && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <SegmentedTabs
            items={subViewTabs}
            activeId={subView}
            onChange={setSubView}
            size="sm"
            className="w-fit"
          />
        </div>
      )}

      {/* Sub-View 1: Hierarchical Categories & Real + Planned Expenditures */}
      {subView === 'categories' ? (
        <>
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
                <button type="button" onClick={handleSaveFilters} className="text-xs sm:text-sm px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-medium border border-slate-200/90 transition-colors cursor-pointer">
                  필터 저장
                </button>
                <button type="button" onClick={handleResetFilters} className="text-xs sm:text-sm px-3 py-2 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-lg font-medium border border-slate-200/90 transition-colors flex items-center gap-1 cursor-pointer">
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
            <Card><div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]">등록 예산 과목 없음</div></Card>
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
                  simulationEntries={simEntries}
                  onEditSimEntry={simHook ? handleOpenEditSim : undefined}
                  onDeleteSimEntry={simHook?.deleteEntry}
                  onSettleSimEntry={simHook ? handleOpenSettleSim : undefined}
                  onAddSimEntryForCategory={simHook ? handleOpenAddSimForCategory : undefined}
                />
              ))}

              {isPolicyVirtualActive && bottomPadding > 0 && (
                <div style={{ height: `${bottomPadding}px` }} aria-hidden="true" />
              )}
            </div>
          )}
        </>
      ) : simHook ? (
        /* Sub-View 2: Planned & Burn-down Analysis Table */
        <div className="space-y-3">
          {hasActiveFilters && (
            <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs">
              <span className="font-semibold text-indigo-900">
                필터 적용 중 · {filteredCategoriesTree.length}개 통계목 · {simMetrics?.activeSimCount ?? 0}건 예정 기준 조회
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-indigo-50 border border-indigo-200/90 text-indigo-700 font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw size={11} /> 필터 해제
              </button>
            </div>
          )}
          <SimulationResultTable
            categories={hasActiveFilters ? filteredCategoriesTree : categories}
            budgetEntries={rawBudgetEntries}
            projectSummaries={visibleProjectSummaries}
            statItemSummaries={visibleStatItemSummaries}
            entries={visibleSimEntries}
            onEditEntry={handleOpenEditSim}
            onDeleteEntry={handleSafeDeleteSim}
            onSettleEntry={handleOpenSettleSim}
            onResetAll={handleSafeResetSim}
            onLoadTestPreset={handleSafeLoadPresetSim}
          />
        </div>
      ) : null}

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

      {/* Integrated Simulation Input Modal */}
      {simHook && showSimInputModal && (
        <SimulationInputModal
          isOpen={showSimInputModal}
          onClose={() => {
            setShowSimInputModal(false);
            setEditingSimEntry(null);
          }}
          detailedProjects={simHook.availableDetailedProjects}
          getStatItemsForProject={simHook.getStatItemsForProject}
          statItemSummaries={simHook.statItemSummaries}
          editingEntry={editingSimEntry}
          onAddEntry={simHook.addEntry}
          onUpdateEntry={simHook.updateEntry}
          onResetAll={simHook.resetEntries}
          onLoadTestPreset={simHook.loadTestPreset}
        />
      )}

      {/* Integrated Simulation Settlement Modal */}
      {simHook && settlingSimItem && (
        <SimulationSettleModal
          item={settlingSimItem}
          onClose={() => setSettlingSimItem(null)}
          onConfirm={handleConfirmSettleSim}
        />
      )}
    </div>
  );
}

function BudgetDashboardWithHook(props: BudgetDashboardProps) {
  const budgetHook = useBudget();
  const simHook = useBudgetSimulator();
  return <BudgetDashboardInner {...props} budgetHook={budgetHook} simHook={props.simHook ?? simHook} />;
}

export function BudgetDashboard(props: BudgetDashboardProps = {}) {
  const queryClient = useContext(QueryClientContext);
  if (queryClient && (!props.categories || !props.entries)) {
    return <BudgetDashboardWithHook {...props} />;
  }
  return <BudgetDashboardInner {...props} />;
}
