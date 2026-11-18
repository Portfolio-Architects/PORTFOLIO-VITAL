'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useBudgetSimulator } from '@/hooks/useBudgetSimulator';
import { SimulationSummaryCards } from './ui/SimulationSummaryCards';
import { SimulationBurnUpChart } from './ui/SimulationBurnUpChart';
import { SimulationInputForm } from './ui/SimulationInputForm';
import { SimulationResultTable } from './ui/SimulationResultTable';
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
  const [actualAmountInput, setActualAmountInput] = useState<string>('');
  const [actualDateInput, setActualDateInput] = useState<string>('');

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
    setActualAmountInput(item.amount.toLocaleString('ko-KR'));
    setActualDateInput(new Date().toISOString().split('T')[0]);
  }, [entries]);

  const handleConfirmSettle = useCallback(async () => {
    if (!settlingItem) return;
    const cleanAmount = parseInt(actualAmountInput.replace(/[^0-9]/g, ''), 10) || settlingItem.amount;
    await settleEntry(settlingItem.id, cleanAmount, actualDateInput);
    setSettlingItem(null);
  }, [settlingItem, actualAmountInput, actualDateInput, settleEntry]);

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
      {settlingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl border border-slate-200/90 space-y-4">
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">실제 지출 집행 (정산) 전환</h3>
                <p className="text-xs text-slate-500">선택 항목 → e-호조 실집행 전환</p>
              </div>
            </div>

            <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80 space-y-2 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>계획 항목명</span>
                <span className="font-bold text-slate-900">{settlingItem.name}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>경비 구분</span>
                <span className={`font-bold ${settlingItem.actionType === 'daily_expense' ? 'text-amber-700' : 'text-slate-800'}`}>
                  {settlingItem.actionType === 'daily_expense' ? '🪙 일상경비 실지출' : '🏢 일반 지출 (본청)'}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>세부사업 / 통계목</span>
                <span className="font-mono text-slate-700 font-semibold">{settlingItem.detailedProject} · {settlingItem.statItem}</span>
              </div>
              <div className="flex justify-between text-slate-500 pt-2 border-t border-slate-200/80">
                <span>기존 계획 예정액</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">₩{settlingItem.amount.toLocaleString('ko-KR')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700">최종 실제 집행액 (원)</label>
                <input
                  type="text"
                  value={actualAmountInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    const n = parseInt(raw, 10);
                    setActualAmountInput(n ? n.toLocaleString('ko-KR') : '');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200/90 bg-slate-50/60 focus:bg-white text-sm font-mono tabular-nums text-right focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700">실제 집행 일자</label>
                <input
                  type="date"
                  value={actualDateInput}
                  onChange={(e) => setActualDateInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200/90 bg-slate-50/60 focus:bg-white text-sm font-mono focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSettlingItem(null)}
                className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmSettle}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                실지출 집행 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

BudgetSimulator.displayName = 'BudgetSimulator';

export default BudgetSimulator;
