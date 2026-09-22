'use client';

import React, { useMemo } from 'react';
import { ProjectSimulationSummary, StatItemSimulationSummary } from '@/types';
import {
  Wallet,
  CreditCard,
  PiggyBank,
  Calculator,
  AlertTriangle,
  ShieldCheck,
  AlertOctagon,
} from 'lucide-react';

export interface SimulationSummaryCardsProps {
  projectSummaries: ProjectSimulationSummary[];
  statItemSummaries?: StatItemSimulationSummary[];
}

export const SimulationSummaryCards: React.FC<SimulationSummaryCardsProps> = React.memo(({
  projectSummaries,
}) => {
  // Aggregate Metrics from Project Summaries
  const metrics = useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;
    let totalRemaining = 0;
    let simulatedExpenditure = 0;
    let finalExpectedBalance = 0;
    let deficitCount = 0;
    let requiredBalance = 0;
    let totalDailyIssued = 0;
    let totalDailySpent = 0;
    let totalDailyRemaining = 0;

    for (let i = 0; i < projectSummaries.length; i++) {
      const p = projectSummaries[i];
      totalBudget += p.totalBudget;
      totalSpent += p.currentSpent;
      totalRemaining += p.currentRemaining;
      simulatedExpenditure += p.simulatedExpenditure;
      finalExpectedBalance += p.finalExpectedBalance;
      totalDailyIssued += (p.dailyExpenseIssued || 0);
      totalDailySpent += (p.dailyExpenseSpent || 0);
      totalDailyRemaining += (p.dailyExpenseRemaining || 0);

      if (p.finalExpectedBalance < 0) {
        deficitCount += 1;
        requiredBalance += -p.finalExpectedBalance;
      }
    }

    const currentExecutionRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const currentRemainingRate = totalBudget > 0 ? (totalRemaining / totalBudget) * 100 : 0;
    const projectedExecutionRate =
      totalBudget > 0 ? ((totalSpent + simulatedExpenditure) / totalBudget) * 100 : 0;
    const projectedRemainingRate =
      totalBudget > 0 ? (finalExpectedBalance / totalBudget) * 100 : 0;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      currentExecutionRate,
      currentRemainingRate,
      simulatedExpenditure,
      finalExpectedBalance,
      projectedExecutionRate,
      projectedRemainingRate,
      deficitCount,
      requiredBalance,
      totalDailyIssued,
      totalDailySpent,
      totalDailyRemaining,
    };
  }, [projectSummaries]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      {/* Card 1: 총 예산액 (Total Budget) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 flex flex-col h-full shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all group">
        {/* Slot 1: Header */}
        <div className="flex items-center justify-between h-8 mb-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">총 예산액</span>
          <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
            <Wallet className="w-4 h-4" />
          </div>
        </div>

        {/* Slot 2: Hero Primary Value (모든 카드의 수평 높이 일치) */}
        <div className="h-9 flex items-baseline gap-1" title={`${metrics.totalBudget.toLocaleString('ko-KR')}원`}>
          <span className="text-lg sm:text-xl xl:text-[21px] 2xl:text-2xl font-black font-mono tabular-nums tracking-tight text-slate-900 dark:text-white truncate">
            {metrics.totalBudget.toLocaleString('ko-KR')}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-slate-400 shrink-0">원</span>
        </div>

        {/* Slot 3: Sub-Context (고정 높이 슬롯으로 수평선 일치 보장) */}
        <div className="min-h-[44px] flex flex-col justify-center text-[11px] font-sans leading-tight text-slate-400 dark:text-slate-500">
          <span>2026 회계연도 배정 예산</span>
          <span className="mt-0.5 text-slate-400/80">본예산 및 추경 합계</span>
        </div>

        {/* Slot 4: Footer (하단 바닥선 정렬 및 뱃지) */}
        <div className="mt-auto pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            집행 <strong className="font-mono text-slate-700 dark:text-slate-200">{metrics.currentExecutionRate.toFixed(1)}%</strong>
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            미집행 <strong className="font-mono">{metrics.currentRemainingRate.toFixed(1)}%</strong>
          </span>
        </div>
      </div>

      {/* Card 2: 현재 집행액 & 집행률 (Current Spent) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 flex flex-col h-full shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all group">
        {/* Slot 1: Header */}
        <div className="flex items-center justify-between h-8 mb-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">현재 집행액</span>
          <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>

        {/* Slot 2: Hero Primary Value (모든 카드의 수평 높이 일치) */}
        <div className="h-9 flex items-baseline gap-1" title={`${metrics.totalSpent.toLocaleString('ko-KR')}원`}>
          <span className="text-lg sm:text-xl xl:text-[21px] 2xl:text-2xl font-black font-mono tabular-nums tracking-tight text-indigo-700 dark:text-indigo-400 truncate">
            {metrics.totalSpent.toLocaleString('ko-KR')}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-indigo-400 shrink-0">원</span>
        </div>

        {/* Slot 3: Sub-Context (고정 높이 슬롯) */}
        <div className="min-h-[44px] flex flex-col justify-center text-[11px] font-sans leading-tight">
          {metrics.totalDailyIssued > 0 ? (
            <>
              <span className="text-amber-700 dark:text-amber-400 font-medium truncate">
                교부 {metrics.totalDailyIssued.toLocaleString('ko-KR')}원 포함
              </span>
              <span className="mt-0.5 text-slate-400 dark:text-slate-500">본청 원인행위 및 지출원인</span>
            </>
          ) : (
            <>
              <span className="text-slate-500 dark:text-slate-400 font-medium">지출결의 원인행위 완료 누적</span>
              <span className="mt-0.5 text-slate-400/80">e-호조 본청 지출 확정액</span>
            </>
          )}
        </div>

        {/* Slot 4: Footer */}
        <div className="mt-auto pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">현재 집행률</span>
          <span
            className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${
              metrics.currentExecutionRate > 90
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300'
                : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300'
            }`}
          >
            {metrics.currentExecutionRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Card 3: 현재 집행 잔액 (Current Remaining) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 flex flex-col h-full shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all group">
        {/* Slot 1: Header */}
        <div className="flex items-center justify-between h-8 mb-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">현재 집행 잔액</span>
          <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <PiggyBank className="w-4 h-4" />
          </div>
        </div>

        {/* Slot 2: Hero Primary Value (모든 카드의 수평 높이 일치) */}
        <div className="h-9 flex items-baseline gap-1" title={`${metrics.totalRemaining.toLocaleString('ko-KR')}원`}>
          <span className="text-lg sm:text-xl xl:text-[21px] 2xl:text-2xl font-black font-mono tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
            {metrics.totalRemaining.toLocaleString('ko-KR')}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-emerald-400 shrink-0">원</span>
        </div>

        {/* Slot 3: Sub-Context (고정 높이 슬롯) */}
        <div className="min-h-[44px] flex flex-col justify-center text-[11px] font-sans leading-tight">
          {metrics.totalDailyRemaining > 0 ? (
            <>
              <div className="text-amber-700 dark:text-amber-400 font-medium truncate">
                + 일상 미집행 {metrics.totalDailyRemaining.toLocaleString('ko-KR')}원
              </div>
              <div className="mt-0.5 text-emerald-700 dark:text-emerald-300 font-bold truncate">
                실가용: {(metrics.totalRemaining + metrics.totalDailyRemaining).toLocaleString('ko-KR')}원
              </div>
            </>
          ) : (
            <>
              <span className="text-slate-500 dark:text-slate-400 font-medium">지출 예정액 차감 전 순잔액</span>
              <span className="mt-0.5 text-slate-400/80">실질 가용 자금 기준</span>
            </>
          )}
        </div>

        {/* Slot 4: Footer */}
        <div className="mt-auto pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">현재 미집행률</span>
          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 shadow-3xs">
            {metrics.currentRemainingRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Card 4: 시뮬레이션 지출 예정액 (Simulated Expenditure) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 flex flex-col h-full shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all group">
        {/* Slot 1: Header */}
        <div className="flex items-center justify-between h-8 mb-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">지출 예정액</span>
          <div className="p-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50">
            <Calculator className="w-4 h-4" />
          </div>
        </div>

        {/* Slot 2: Hero Primary Value (모든 카드의 수평 높이 일치) */}
        <div className="h-9 flex items-baseline gap-1" title={`${metrics.simulatedExpenditure.toLocaleString('ko-KR')}원`}>
          <span className="text-lg sm:text-xl xl:text-[21px] 2xl:text-2xl font-black font-mono tabular-nums tracking-tight text-purple-700 dark:text-purple-400 truncate">
            {metrics.simulatedExpenditure.toLocaleString('ko-KR')}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-purple-400 shrink-0">원</span>
        </div>

        {/* Slot 3: Sub-Context (고정 높이 슬롯) */}
        <div className="min-h-[44px] flex flex-col justify-center text-[11px] font-sans leading-tight text-purple-700/80 dark:text-purple-300/80">
          <span className="font-medium">확정 지출 예정 항목 합계</span>
          <span className="mt-0.5 text-slate-400 dark:text-slate-500">품의·소진 계획 등록액</span>
        </div>

        {/* Slot 4: Footer */}
        <div className="mt-auto pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">소진 예정률</span>
          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full border bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/50 text-purple-700 dark:text-purple-300">
            {((metrics.simulatedExpenditure / (metrics.totalBudget || 1)) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Card 5: 최종 예상 잔액 (Final Expected Balance) */}
      <div
        className={`rounded-2xl p-4 sm:p-4.5 flex flex-col h-full shadow-xs transition-all relative overflow-hidden border ${
          metrics.finalExpectedBalance < 0
            ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/60 text-rose-900 dark:text-rose-100'
            : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        {/* Slot 1: Header */}
        <div className="flex items-center justify-between h-8 mb-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">최종 예상 잔액</span>
          <div
            className={`p-1.5 rounded-xl border ${
              metrics.finalExpectedBalance < 0
                ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50'
            }`}
          >
            {metrics.finalExpectedBalance < 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
        </div>

        {/* Slot 2: Hero Primary Value (모든 카드의 수평 높이 일치) */}
        <div className="h-9 flex items-baseline gap-1" title={`${metrics.finalExpectedBalance.toLocaleString('ko-KR')}원`}>
          <span
            className={`text-lg sm:text-xl xl:text-[21px] 2xl:text-2xl font-black font-mono tabular-nums tracking-tight truncate ${
              metrics.finalExpectedBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {metrics.finalExpectedBalance.toLocaleString('ko-KR')}
          </span>
          <span
            className={`text-xs sm:text-sm font-semibold shrink-0 ${
              metrics.finalExpectedBalance < 0 ? 'text-rose-400 dark:text-rose-500' : 'text-emerald-400 dark:text-emerald-500'
            }`}
          >
            원
          </span>
        </div>

        {/* Slot 3: Sub-Context (고정 높이 슬롯) */}
        <div className="min-h-[44px] flex flex-col justify-center text-[11px] font-sans leading-tight">
          {metrics.totalDailyRemaining > 0 ? (
            <>
              <span className="text-slate-500 dark:text-slate-400 font-medium">일상경비 포함 실질 수지</span>
              <span className="mt-0.5 text-slate-700 dark:text-slate-200 font-bold font-mono truncate">
                {(metrics.finalExpectedBalance + metrics.totalDailyRemaining).toLocaleString('ko-KR')}원 예상
              </span>
            </>
          ) : (
            <>
              <span className="text-slate-500 dark:text-slate-400 font-medium">예정액 집행 후 최종 수지</span>
              <span className="mt-0.5 text-slate-400/80">순수 잔여 불용 예상액</span>
            </>
          )}
        </div>

        {/* Slot 4: Footer */}
        <div className="mt-auto pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">예상 최종 집행률</span>
          <span
            className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${
              metrics.projectedExecutionRate > 100
                ? 'bg-rose-100 dark:bg-rose-900/50 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                : metrics.projectedExecutionRate > 90
                ? 'bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {metrics.projectedExecutionRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Card 6: 적자 세부사업 수 & 추가 필요 예납액 (Deficit Count & Required Balance) */}
      <div
        className={`rounded-2xl p-4 sm:p-4.5 flex flex-col h-full shadow-xs transition-all relative overflow-hidden border ${
          metrics.deficitCount > 0
            ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/60 text-rose-900 dark:text-rose-100'
            : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        {/* Slot 1: Header */}
        <div className="flex items-center justify-between h-8 mb-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">적자 발생 세부사업</span>
          <div
            className={`p-1.5 rounded-xl border ${
              metrics.deficitCount > 0
                ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>

        {/* Slot 2: Hero Primary Value (모든 카드의 수평 높이 일치) */}
        <div className="h-9 flex items-baseline gap-1">
          <span
            className={`text-lg sm:text-xl xl:text-[21px] 2xl:text-2xl font-black font-mono tabular-nums tracking-tight ${
              metrics.deficitCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {metrics.deficitCount}개
          </span>
          <span
            className={`text-xs sm:text-sm font-bold shrink-0 ${
              metrics.deficitCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {metrics.deficitCount > 0 ? '(예산 초과)' : '(정상)'}
          </span>
        </div>

        {/* Slot 3: Sub-Context (고정 높이 슬롯) */}
        <div className="min-h-[44px] flex flex-col justify-center text-[11px] font-sans leading-tight">
          {metrics.deficitCount > 0 ? (
            <>
              <span className="text-rose-700 dark:text-rose-300 font-medium">추가 소요 예산액</span>
              <span className="mt-0.5 text-rose-700 dark:text-rose-300 font-mono font-black truncate">
                {metrics.requiredBalance.toLocaleString('ko-KR')}원
              </span>
            </>
          ) : (
            <>
              <span className="text-slate-500 dark:text-slate-400 font-medium">전체 세부사업 잔액 양호</span>
              <span className="mt-0.5 text-slate-400/80">예산 초과·결손 사업 없음</span>
            </>
          )}
        </div>

        {/* Slot 4: Footer */}
        <div className="mt-auto pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">수지 건전성</span>
          <span
            className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${
              metrics.deficitCount > 0
                ? 'bg-rose-100 dark:bg-rose-900/50 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {metrics.deficitCount > 0 ? '초과 경고' : '건전'}
          </span>
        </div>
      </div>
    </div>
  );
});

SimulationSummaryCards.displayName = 'SimulationSummaryCards';
