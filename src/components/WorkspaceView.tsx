'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { BudgetCategory, BudgetEntry, InventoryItem, StockChange } from '@/types';
function BudgetDashboardSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="h-10 bg-slate-200/60 dark:bg-slate-800/40 rounded-xl w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 bg-slate-200/60 dark:bg-slate-800/40 rounded-[2rem]" />
        ))}
      </div>
      <div className="h-64 bg-slate-200/60 dark:bg-slate-800/40 rounded-[2rem]" />
    </div>
  );
}

const BudgetDashboard = dynamic(
  () => import('@/components/budget/BudgetDashboard').then((mod) => mod.BudgetDashboard),
  {
    ssr: false,
    loading: () => <BudgetDashboardSkeleton />,
  }
);
import { CategoryStats } from '@/hooks/useBudget';

function InventoryListSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="h-7 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg w-32" />
        <div className="h-10 bg-slate-200/60 dark:bg-slate-800/40 rounded-xl w-28" />
      </div>
      <div className="glass-panel rounded-[2rem] p-5 border border-slate-200/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="h-10 bg-slate-200/60 dark:bg-slate-800/40 rounded-xl flex-1" />
        <div className="flex gap-1.5 items-center">
          <div className="h-8 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg w-12" />
          <div className="h-8 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg w-16" />
          <div className="h-8 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg w-16" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-panel rounded-[2rem] border border-slate-200/60 p-5 h-[245px] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-2">
                  <div className="h-5 bg-slate-200/60 dark:bg-slate-800/40 rounded w-28" />
                  <div className="h-4 bg-slate-200/60 dark:bg-slate-800/40 rounded w-16" />
                </div>
                <div className="flex gap-1">
                  <div className="h-6 w-6 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg" />
                  <div className="h-6 w-6 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg" />
                </div>
              </div>
              <div className="h-16 bg-slate-100/70 dark:bg-slate-800/30 rounded-2xl p-4 mb-4 border border-slate-100/50 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-3 bg-slate-200/60 dark:bg-slate-800/40 rounded w-14" />
                  <div className="h-6 bg-slate-200/60 dark:bg-slate-800/40 rounded w-20" />
                </div>
                <div className="h-6 bg-slate-200/60 dark:bg-slate-800/40 rounded-xl w-16" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 bg-slate-200/60 dark:bg-slate-800/40 rounded-xl flex-1" />
              <div className="h-8 bg-slate-200/60 dark:bg-slate-800/40 rounded-xl flex-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const InventoryList = dynamic(
  () => import('@/components/inventory/InventoryList').then((mod) => mod.InventoryList),
  {
    ssr: false,
    loading: () => <InventoryListSkeleton />,
  }
);

import BudgetSimulatorSkeleton from '@/components/budget/ui/BudgetSimulatorSkeleton';

const BudgetSimulator = dynamic(
  () => import('@/components/budget/BudgetSimulator').then((mod) => mod.BudgetSimulator),
  {
    ssr: false,
    loading: () => <BudgetSimulatorSkeleton />,
  }
);

interface WorkspaceViewProps {
  // Budget
  budgetCategories: BudgetCategory[];
  budgetEntries: BudgetEntry[];
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => BudgetCategory;
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory: (id: string) => void;
  replaceCategories: (cats: BudgetCategory[]) => void;
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
  // Inventory (상위 컴포넌트 호환용)
  inventoryItems: InventoryItem[];
  addItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  adjustStock: (itemId: string, change: number, reason: string) => void;
  getItemHistory: (itemId: string) => StockChange[];
  // Signal (상위 컴포넌트 호환용)
  addSignal?: (text: string) => void;
  initialTab?: 'budget' | 'inventory' | 'simulator';
}

function WorkspaceViewComponent(props: WorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<'budget' | 'inventory' | 'simulator'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hchps-workspace-active-tab');
        if (saved === 'budget' || saved === 'inventory' || saved === 'simulator') {
          return saved;
        }
      } catch {}
    }
    return props.initialTab || 'budget';
  });
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>(() => ({
    budget: activeTab === 'budget',
    inventory: activeTab === 'inventory',
    simulator: activeTab === 'simulator',
  }));
  const [, startTransition] = useTransition();
  const [zodError, setZodError] = useState<{ sheetName: string; rowId: string; errors: any } | null>(null);

  const handleTabChange = useCallback((tab: 'budget' | 'inventory' | 'simulator') => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('hchps-workspace-active-tab', tab);
      } catch {}
    }
    setVisitedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
    startTransition(() => {
      setActiveTab(tab);
    });
  }, []);

  const [prevInitialTab, setPrevInitialTab] = useState(props.initialTab);
  if (props.initialTab && props.initialTab !== prevInitialTab) {
    setPrevInitialTab(props.initialTab);
    setVisitedTabs((prev) => (prev[props.initialTab!] ? prev : { ...prev, [props.initialTab!]: true }));
    setActiveTab(props.initialTab);
  }

  const handleZodError = useCallback((e: Event) => {
    const customEvent = e as CustomEvent;
    setZodError(customEvent.detail);
  }, []);

  useEffect(() => {
    window.addEventListener('hchps-zod-error', handleZodError);

    return () => {
      window.removeEventListener('hchps-zod-error', handleZodError);
    };
  }, [handleZodError]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200/80 gap-2 overflow-x-auto pb-px bg-slate-50/50 p-1.5 rounded-2xl border border-slate-200/60 shadow-xs mb-2">
        <button
          onClick={() => handleTabChange('budget')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm tracking-tight transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'budget'
              ? 'bg-white text-indigo-600 shadow-md border border-slate-200/60'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          예산 대조보드
        </button>
        <button
          onClick={() => handleTabChange('inventory')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm tracking-tight transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'bg-white text-indigo-600 shadow-md border border-slate-200/60'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          홍보물 관리
        </button>
        <button
          onClick={() => handleTabChange('simulator')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm tracking-tight transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'simulator'
              ? 'bg-white text-indigo-600 shadow-md border border-slate-200/60'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          예산 시뮬레이터
        </button>
      </div>

      {zodError && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-4 rounded-[1.5rem] flex items-center justify-between gap-4 backdrop-blur-md animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-[20px]">⚠️</span>
            <div className="text-left">
              <p className="font-bold text-[14px] text-amber-200">[데이터 구조 경고] 일부 데이터 무결성이 손상되었습니다.</p>
              <p className="text-[12px] text-amber-300/80 mt-0.5">
                시트: <span className="font-mono font-bold">{zodError.sheetName}</span> (ID: {zodError.rowId}) | 
                안전 디폴트값으로 자동 격리 보정(Sandboxing)되었습니다.
              </p>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-[1rem] text-[12px] font-bold transition-all shadow-md hover:shadow-lg cursor-pointer shrink-0"
          >
            F5 안전 새로고침 (백업 복구)
          </button>
        </div>
      )}

      <div className="w-full">
        {visitedTabs.budget && (
          <div className={activeTab === 'budget' ? 'block' : 'hidden'}>
            <BudgetDashboard
              categories={props.budgetCategories}
              entries={props.budgetEntries}
              addCategory={props.addCategory}
              updateCategory={props.updateCategory}
              deleteCategory={props.deleteCategory}
              replaceCategories={props.replaceCategories}
              addEntry={props.addEntry}
              updateEntry={props.updateEntry}
              deleteEntry={props.deleteEntry}
              batchUpdateEntries={props.batchUpdateEntries}
              batchDeleteEntries={props.batchDeleteEntries}
              batchSettleEntries={props.batchSettleEntries}
              getCategoryStats={props.getCategoryStats}
              overallStats={props.overallStats}
              onNavigateToSimulator={() => handleTabChange('simulator')}
            />
          </div>
        )}
        {visitedTabs.inventory && (
          <div className={activeTab === 'inventory' ? 'block' : 'hidden'}>
            <InventoryList
              items={props.inventoryItems}
              addItem={props.addItem}
              updateItem={props.updateItem}
              deleteItem={props.deleteItem}
              adjustStock={props.adjustStock}
              getItemHistory={props.getItemHistory}
            />
          </div>
        )}
        {visitedTabs.simulator && (
          <div className={activeTab === 'simulator' ? 'block' : 'hidden'}>
            <BudgetSimulator />
          </div>
        )}
      </div>
    </div>
  );
}

export const WorkspaceView = React.memo(WorkspaceViewComponent);
WorkspaceView.displayName = 'WorkspaceView';

