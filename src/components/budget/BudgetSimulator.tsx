'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useBudgetSimulator } from '@/hooks/useBudgetSimulator';
import { SimulationSummaryCards } from './ui/SimulationSummaryCards';
import { SimulationInputForm } from './ui/SimulationInputForm';
import { SimulationResultTable } from './ui/SimulationResultTable';
import { SimulationEntry } from '@/types';
import { Calculator, Sparkles, RotateCcw, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="w-full flex flex-col gap-6 text-slate-800 p-1 sm:p-2">
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-xs">
            <Calculator className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
              <span>예산 시뮬레이터</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200/70 text-indigo-700 font-mono">
                Commitment Balance Engine
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              현재 집행 잔액을 기준으로 미집행 확정 지출 예정액을 차감하여 세부사업 및 통계목별 예상 잔액과 추가 필요 예산을 실시간 시뮬레이션합니다.
            </p>
          </div>
        </div>

        {/* Global Preset & Status Summary Header Badge */}
        <div className="flex items-center gap-3">
          {deficitProjectsCount > 0 ? (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold animate-pulse">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>{deficitProjectsCount}개 세부사업 예산 초과 경고</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-700 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>전체 세부사업 안전 잔액 수지</span>
            </div>
          )}

          <button
            type="button"
            onClick={loadTestPreset}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            title="표준 보건소 & AI 메디헬스 테스트 지출 항목을 로드합니다."
          >
            <Sparkles className="w-4 h-4" />
            테스트 프리셋 로드
          </button>
          <button
            type="button"
            onClick={resetEntries}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="등록된 시뮬레이션 지출 내역을 모두 초기화합니다."
          >
            <RotateCcw className="w-3.5 h-3.5" />
            초기화
          </button>
        </div>
      </div>

      {/* 1-1. Risk Monitoring Quick Filter Chips */}
      {riskProjects.length > 0 && (
        <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 shadow-2xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span className="text-xs font-bold text-rose-900">
                3분기 불용 위험 사업 ({riskProjects.length}개) — 집중 소진 계획 수립 권고
              </span>
            </div>
            <span className="text-[11px] text-rose-600 font-medium">
              클릭 시 해당 사업으로 폼 자동 매핑
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
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-rose-700 hover:text-rose-900 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer active:scale-95"
              >
                <span>{p.detailedProject}</span>
                <span className="text-[11px] text-rose-500 font-mono">({p.executionRate.toFixed(1)}% | 잔액 {p.currentRemaining.toLocaleString('ko-KR')}원)</span>
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

      {/* 3. Simulation Input Form */}
      <SimulationInputForm
        detailedProjects={availableDetailedProjects}
        getStatItemsForProject={getStatItemsForProject}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">실제 지출 집행 (정산) 전환</h3>
                <p className="text-xs text-slate-500">지출 계획을 실제 e-호조 집행 내역으로 영속 등록합니다.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>계획 항목명</span>
                <span className="font-bold text-slate-800">{settlingItem.name}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>세부사업 / 통계목</span>
                <span className="font-mono text-indigo-600 font-semibold">{settlingItem.detailedProject} · {settlingItem.statItem}</span>
              </div>
              <div className="flex justify-between text-slate-500 pt-1.5 border-t border-slate-200">
                <span>기존 계획 예정액</span>
                <span className="font-mono font-bold text-slate-700">₩{settlingItem.amount.toLocaleString('ko-KR')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">최종 실제 집행액 (원)</label>
                <input
                  type="text"
                  value={actualAmountInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    const n = parseInt(raw, 10);
                    setActualAmountInput(n ? n.toLocaleString('ko-KR') : '');
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">실제 집행 일자</label>
                <input
                  type="date"
                  value={actualDateInput}
                  onChange={(e) => setActualDateInput(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSettlingItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmSettle}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
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
