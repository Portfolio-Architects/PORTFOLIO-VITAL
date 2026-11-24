'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useBudgetSimulator } from '@/hooks/useBudgetSimulator';
import { SimulationSummaryCards } from './ui/SimulationSummaryCards';
import { SimulationBurnUpChart } from './ui/SimulationBurnUpChart';
import { SimulationInputForm } from './ui/SimulationInputForm';
import { SimulationResultTable } from './ui/SimulationResultTable';
import { SimulationSettleModal } from './ui/SimulationSettleModal';
import { SimulationEntry } from '@/types';
import { SectionHeader } from '@/components/ui';
import { Sparkles, RotateCcw, ShieldAlert, CheckCircle2 } from 'lucide-react';
export const BudgetSimulator: React.FC = React.memo(() => {
  const {
    categories,
    budgetEntries,
    entries,
    availableDetailedProjects,
    getStatItemsForProject,
    addEntry,
    updateEntry,
    deleteEntry,
    resetEntries,
    loadTestPreset,
    settleEntry,
    projectSummaries,
    statItemSummaries,
  } = useBudgetSimulator();

  // Currently Editing Entry State
  const [editingEntry, setEditingEntry] = useState<SimulationEntry | null>(null);

  // Settlement Dialog State
  const [settlingItem, setSettlingItem] = useState<SimulationEntry | null>(null);

  const handleEditEntry = useCallback((entry: SimulationEntry) => {
    setEditingEntry(entry);
    try {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      // Ignore JSDOM scrollTo unimplemented warning
    }
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingEntry(null);
  }, []);

  const handleUpdateEntryAndClear = useCallback((id: string, partial: Partial<SimulationEntry>) => {
    updateEntry(id, partial);
    setEditingEntry(null);
  }, [updateEntry]);

  const handleOpenSettle = useCallback((id: string) => {
    const item = entries.find(e => e.id === id);
    if (!item) return;
    setSettlingItem(item);
  }, [entries]);

  const handleConfirmSettle = useCallback(async (simId: string, actualAmount: number, actualDate: string) => {
    const result = await settleEntry(simId, actualAmount, actualDate);
    if (result !== false) {
      setSettlingItem(null);
    }
    return result;
  }, [settleEntry]);

  // Count Deficit Projects (Single-pass memoized count)
  const deficitProjectsCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < projectSummaries.length; i++) {
      if (projectSummaries[i].isDeficit) count++;
    }
    return count;
  }, [projectSummaries]);

  // Extract Risk Projects (< 70% execution rate)
  const riskProjects = useMemo(() => {
    return projectSummaries.filter(p => p.executionRate < 70 && p.currentRemaining > 0);
  }, [projectSummaries]);

  return (
    <div className="w-full space-y-6 text-slate-800">
      {/* 1. Minimalist Top Header Bar (VLDS SectionHeader) */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 md:p-6 shadow-2xs">
        <SectionHeader
          title="예산 시뮬레이터"
          subtitle="집행 잔액 - 예정액 · 과목별 예상 잔액"
          noBorder
          titleClassName="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight"
          badge={
            <span className="text-xs sm:text-sm text-slate-400 font-medium hidden sm:inline">
              {projectSummaries.length}개 세부사업 · {statItemSummaries.length}개 통계목 · {entries.length}건 예정
            </span>
          }
          actions={
            <>
              {deficitProjectsCount > 0 ? (
                <div className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 border border-rose-200/80 rounded-lg text-rose-700 text-xs font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deficitProjectsCount}개 사업 초과 경고</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50/80 border border-emerald-200/70 rounded-lg text-emerald-700 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>전 사업 잔액 안전</span>
                </div>
              )}

              <button
                type="button"
                onClick={loadTestPreset}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="표준 테스트 항목 로드"
              >
                <Sparkles className="w-4 h-4" />
                프리셋 로드
              </button>
              <button
                type="button"
                onClick={resetEntries}
                className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-600 hover:text-slate-900 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="시뮬레이션 항목 초기화"
              >
                <RotateCcw className="w-4 h-4" />
                초기화
              </button>
            </>
          }
        />
      </div>

      {/* 1-1. Risk Monitoring Quick Filter Chips (Minimalist Bar) */}
      {riskProjects.length > 0 && (
        <div className="bg-white border border-rose-200/80 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-slate-900">
                불용 위험 사업 ({riskProjects.length}개)
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              클릭 시 입력폼 자동 선택
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {riskProjects.map(p => (
              <button
                key={p.detailedProject}
                type="button"
                onClick={() => {
                  setEditingEntry({
                    id: '',
                    name: `${p.detailedProject} 하반기 물품/용역 소진`,
                    detailedProject: p.detailedProject,
                    statItem: getStatItemsForProject(p.detailedProject)[0] || '',
                    unitPrice: Math.min(p.currentRemaining, 1000000),
                    quantity: 1,
                    amount: Math.min(p.currentRemaining, 1000000),
                    createdAt: new Date().toISOString(),
                  });
                  try {
                    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  } catch {
                    // Ignore JSDOM scrollTo unimplemented warning
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-50/80 hover:bg-rose-50/60 text-slate-700 hover:text-rose-700 border border-slate-200/80 hover:border-rose-200 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="font-bold text-slate-800">{p.detailedProject}</span>
                <span className="text-xs text-rose-600 font-mono tabular-nums">({p.executionRate.toFixed(1)}% | 잔액 {p.currentRemaining.toLocaleString('ko-KR')}원)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Top Metric Cards (Summary Cards) */}
      <SimulationSummaryCards
        projectSummaries={projectSummaries}
        statItemSummaries={statItemSummaries}
      />

      {/* 2-1. Commitment Burn-Up Chart (지출 예정액 반영 선그래프) */}
      <SimulationBurnUpChart
        categories={categories}
        budgetEntries={budgetEntries}
        entries={entries}
        projectSummaries={projectSummaries}
        availableDetailedProjects={availableDetailedProjects}
      />

      {/* 3. Simulation Input Form */}
      <SimulationInputForm
        detailedProjects={availableDetailedProjects}
        getStatItemsForProject={getStatItemsForProject}
        statItemSummaries={statItemSummaries}
        editingEntry={editingEntry}
        onAddEntry={addEntry}
        onUpdateEntry={handleUpdateEntryAndClear}
        onCancelEdit={handleCancelEdit}
        onResetAll={resetEntries}
        onLoadTestPreset={loadTestPreset}
      />

      {/* 4. Aggregated Simulation Result Table & Active Entry List */}
      <SimulationResultTable
        categories={categories}
        budgetEntries={budgetEntries}
        projectSummaries={projectSummaries}
        statItemSummaries={statItemSummaries}
        entries={entries}
        onEditEntry={handleEditEntry}
        onDeleteEntry={deleteEntry}
        onSettleEntry={handleOpenSettle}
        onResetAll={resetEntries}
        onLoadTestPreset={loadTestPreset}
      />

      {/* 5. Settlement Confirmation Dialog */}
      <SimulationSettleModal
        item={settlingItem}
        onClose={() => setSettlingItem(null)}
        onConfirm={handleConfirmSettle}
        backdropClassName="bg-slate-900/60"
      />
    </div>
  );
});

BudgetSimulator.displayName = 'BudgetSimulator';

export default BudgetSimulator;
