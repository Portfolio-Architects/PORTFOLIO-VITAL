'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useBudgetSimulator } from '@/hooks/useBudgetSimulator';
import { SimulationSummaryCards } from './ui/SimulationSummaryCards';
import { SimulationBurnUpChart } from './ui/SimulationBurnUpChart';
import { SimulationInputForm } from './ui/SimulationInputForm';
import { SimulationResultTable } from './ui/SimulationResultTable';
import { SimulationEntry } from '@/types';
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
    <div className="w-full space-y-4 text-slate-800">
      {/* 1. Minimalist Top Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">예산 시뮬레이터</h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-slate-600 font-mono">
              Commitment Balance Engine
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              {projectSummaries.length}개 세부사업 · {statItemSummaries.length}개 통계목 · {entries.length}건 예정
            </span>
          </div>
          <p className="text-xs text-slate-500">
            현재 집행 잔액을 기준으로 미집행 확정 지출 예정액을 차감하여 세부사업 및 통계목별 예상 잔액과 추가 필요 예산을 실시간 시뮬레이션합니다.
          </p>
        </div>

        {/* Global Preset & Status Summary Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {deficitProjectsCount > 0 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200/80 rounded-lg text-rose-700 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>{deficitProjectsCount}개 세부사업 예산 초과 경고</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50/80 border border-emerald-200/70 rounded-lg text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>전체 세부사업 안전 잔액 수지</span>
            </div>
          )}

          <button
            type="button"
            onClick={loadTestPreset}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="표준 보건소 & AI 메디헬스 테스트 지출 항목을 로드합니다."
          >
            <Sparkles className="w-3.5 h-3.5" />
            테스트 프리셋 로드
          </button>
          <button
            type="button"
            onClick={resetEntries}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="등록된 시뮬레이션 지출 내역을 모두 초기화합니다."
          >
            <RotateCcw className="w-3.5 h-3.5" />
            초기화
          </button>
        </div>
      </div>

      {/* 1-1. Risk Monitoring Quick Filter Chips (Minimalist Bar) */}
      {riskProjects.length > 0 && (
        <div className="bg-white border border-rose-200/80 rounded-xl px-4 py-3 shadow-2xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-900">
                3분기 불용 위험 사업 ({riskProjects.length}개) — 집중 소진 계획 수립 권고
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              클릭 시 해당 사업으로 폼 자동 매핑
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
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
                className="px-2.5 py-1 rounded-lg bg-slate-50/80 hover:bg-rose-50/60 text-slate-700 hover:text-rose-700 border border-slate-200/80 hover:border-rose-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="font-semibold text-slate-800">{p.detailedProject}</span>
                <span className="text-[11px] text-rose-600 font-mono tabular-nums">({p.executionRate.toFixed(1)}% | 잔액 {p.currentRemaining.toLocaleString('ko-KR')}원)</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl p-5 max-w-md w-full shadow-xl border border-slate-200/90 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">실제 지출 집행 (정산) 전환</h3>
                <p className="text-[11px] text-slate-500">지출 계획을 실제 e-호조 집행 내역으로 영속 등록합니다.</p>
              </div>
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-lg border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>계획 항목명</span>
                <span className="font-semibold text-slate-900">{settlingItem.name}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>경비 구분</span>
                <span className={`font-semibold ${settlingItem.actionType === 'daily_expense' ? 'text-amber-700' : 'text-slate-800'}`}>
                  {settlingItem.actionType === 'daily_expense' ? '🪙 일상경비 실지출' : '🏢 일반 지출 (본청)'}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>세부사업 / 통계목</span>
                <span className="font-mono text-slate-700 font-medium">{settlingItem.detailedProject} · {settlingItem.statItem}</span>
              </div>
              <div className="flex justify-between text-slate-500 pt-1.5 border-t border-slate-200/80">
                <span>기존 계획 예정액</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">₩{settlingItem.amount.toLocaleString('ko-KR')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">최종 실제 집행액 (원)</label>
                <input
                  type="text"
                  value={actualAmountInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    const n = parseInt(raw, 10);
                    setActualAmountInput(n ? n.toLocaleString('ko-KR') : '');
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200/90 bg-slate-50/60 focus:bg-white text-sm font-mono tabular-nums text-right focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">실제 집행 일자</label>
                <input
                  type="date"
                  value={actualDateInput}
                  onChange={(e) => setActualDateInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200/90 bg-slate-50/60 focus:bg-white text-xs font-mono focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSettlingItem(null)}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600 text-xs font-medium transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmSettle}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
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
