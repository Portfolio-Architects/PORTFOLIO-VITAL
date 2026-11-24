'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { BudgetCategory, BudgetEntry, InventoryItem, StockChange } from '@/types';
import { CategoryStats } from '@/hooks/useBudget';

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
    totalBudget: number;
    totalSpent: number;
    totalPlanned: number;
    remaining: number;
    dailyExpenseIssued: number;
    dailyExpenseSpent: number;
    dailyExpenseRemaining: number;
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
  focusSeq?: number;
}

function WorkspaceViewComponent(props: WorkspaceViewProps = {}) {
  const [zodError, setZodError] = useState<{ sheetName: string; rowId: string; errors: any } | null>(null);

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

  const isSimulatorFocus = props.initialTab === 'simulator';

  return (
    <div className="w-full flex flex-col gap-5">
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
            type="button"
            onClick={() => window.location.reload()}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer shrink-0"
          >
            새로고침 복구
          </button>
        </div>
      )}

      <div className="w-full">
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
          initialSubView={isSimulatorFocus ? 'plan' : 'categories'}
          initialShowBurnUp={isSimulatorFocus}
          focusSeq={props.focusSeq}
        />
      </div>
    </div>
  );
}

export const WorkspaceView = React.memo(WorkspaceViewComponent);
WorkspaceView.displayName = 'WorkspaceView';
