'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { BudgetCategory, BudgetEntry, InventoryItem, StockChange } from '@/types';
function BudgetDashboardSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="h-8 bg-slate-200/60 rounded-lg w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-slate-200/60 rounded-xl" />
        ))}
      </div>
      <div className="h-24 bg-slate-200/60 rounded-xl" />
      <div className="h-48 bg-slate-200/60 rounded-xl" />
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
import BudgetSimulatorSkeleton from '@/components/budget/ui/BudgetSimulatorSkeleton';
import { WorkingMemoryContextBanner } from '@/components/dashboard/WorkingMemoryContextBanner';
import { SegmentedTabs, SegmentedTabItem } from '@/components/ui/segmented-tabs';

const WORKSPACE_TABS: ReadonlyArray<SegmentedTabItem<'budget' | 'simulator'>> = [
  { id: 'budget', label: '예산 대조보드', dotIndicator: true },
  { id: 'simulator', label: '예산 시뮬레이터', dotIndicator: true },
];

const BudgetSimulator = dynamic(
  () => import('@/components/budget/BudgetSimulator').then((mod) => mod.BudgetSimulator),
  {
    ssr: false,
    loading: () => <BudgetSimulatorSkeleton />,
  }
);

export interface WorkspaceViewProps {
  // Budget (optional, forwarded to BudgetDashboard if passed)
  budgetCategories?: BudgetCategory[];
  budgetEntries?: BudgetEntry[];
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
  getCategoryStats?: (id: string) => CategoryStats | null;
  overallStats?: { 
    totalBudget: number; totalSpent: number; totalPlanned: number; remaining: number;
    dailyExpenseIssued: number; dailyExpenseSpent: number; dailyExpenseRemaining: number;
  };
  // Inventory (상위 컴포넌트 호환용)
  inventoryItems?: InventoryItem[];
  addItem?: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateItem?: (id: string, updates: Partial<InventoryItem>) => void;
  deleteItem?: (id: string) => void;
  adjustStock?: (itemId: string, change: number, reason: string) => void;
  getItemHistory?: (itemId: string) => StockChange[];
  // Signal (상위 컴포넌트 호환용)
  addSignal?: (text: string) => void;
  initialTab?: 'budget' | 'inventory' | 'simulator';
}

function WorkspaceViewComponent(props: WorkspaceViewProps = {}) {
  const [activeTab, setActiveTab] = useState<'budget' | 'simulator'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hchps-workspace-active-tab');
        if (saved === 'budget' || saved === 'simulator') {
          return saved;
        }
      } catch {}
    }
    return props.initialTab === 'simulator' ? 'simulator' : 'budget';
  });
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>(() => ({
    budget: activeTab === 'budget',
    simulator: activeTab === 'simulator',
  }));
  const [, startTransition] = useTransition();
  const [zodError, setZodError] = useState<{ sheetName: string; rowId: string; errors: any } | null>(null);

  const handleTabChange = useCallback((tab: 'budget' | 'simulator') => {
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
    const normalizedTab = props.initialTab === 'simulator' ? 'simulator' : 'budget';
    setPrevInitialTab(props.initialTab);
    setVisitedTabs((prev) => (prev[normalizedTab] ? prev : { ...prev, [normalizedTab]: true }));
    setActiveTab(normalizedTab);
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
    <div className="w-full flex flex-col gap-5">
      {/* Tab Switcher (VLDS SegmentedTabs) */}
      <SegmentedTabs
        items={WORKSPACE_TABS}
        activeId={activeTab}
        onChange={handleTabChange}
        size="md"
        className="w-fit"
      />

      {zodError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <div className="text-left">
              <p className="font-bold text-sm text-amber-950">[데이터 경고] 안전 기본값 자동 격리 적용</p>
              <p className="text-xs text-amber-800 mt-0.5">
                시트 <span className="font-mono font-bold">{zodError.sheetName}</span> · ID {zodError.rowId}
              </p>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer shrink-0"
          >
            새로고침 복구
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
        {visitedTabs.simulator && (
          <div className={activeTab === 'simulator' ? 'block' : 'hidden'}>
            <BudgetSimulator />
          </div>
        )}
      </div>

      <WorkingMemoryContextBanner
        contextModule={activeTab === 'simulator' ? 'simulator' : 'workspace'}
      />
    </div>
  );
}

export const WorkspaceView = React.memo(WorkspaceViewComponent);
WorkspaceView.displayName = 'WorkspaceView';

