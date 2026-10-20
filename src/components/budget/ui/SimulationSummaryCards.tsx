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
    let totalFinalDailyRemaining = 0;

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
      totalFinalDailyRemaining += (p.finalDailyExpenseRemaining ?? p.dailyExpenseRemaining ?? 0);

      if (p.finalExpectedBalance < 0) {
        deficitCount += 1;
        requiredBalance += -p.finalExpectedBalance;
      }
    }

    const currentExecutionRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const currentRemainingRate = totalBudget > 0 ? (totalRemaining / totalBudget) * 100 : 0;
    const projectedGeneralSpent = totalBudget - finalExpectedBalance;
    const projectedExecutionRate =
      totalBudget > 0 ? (projectedGeneralSpent / totalBudget) * 100 : 0;
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
      totalFinalDailyRemaining,
    };
  }, [projectSummaries]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {/* Card 1: 총 예산액 (Total Budget) */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">총 예산액</span>
            <Wallet size={15} className="text-slate-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-1" title={`${metrics.totalBudget.toLocaleString('ko-KR')}원`}>
            <span className="text-lg sm:text-xl font-bold font-mono tabular-nums tracking-tight text-slate-900 truncate">
              {metrics.totalBudget.toLocaleString('ko-KR')}
            </span>
            <span className="text-xs font-normal text-slate-400 shrink-0">원</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400 leading-snug">
            <div>2026 회계연도 배정 예산</div>
            <div>본예산 및 추경 합계</div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono tabular-nums">
          <span className="text-slate-600 font-medium">
            집행 <strong className="text-slate-900">{metrics.currentExecutionRate.toFixed(1)}%</strong>
          </span>
          <span className="text-slate-500">
            미집행 <strong className="text-slate-700">{metrics.currentRemainingRate.toFixed(1)}%</strong>
          </span>
        </div>
      </div>

      {/* Card 2: 현재 집행액 & 집행률 (Current Spent) */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">현재 집행액</span>
            <CreditCard size={15} className="text-slate-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-1" title={`${metrics.totalSpent.toLocaleString('ko-KR')}원`}>
            <span className="text-lg sm:text-xl font-bold font-mono tabular-nums tracking-tight text-slate-900 truncate">
              {metrics.totalSpent.toLocaleString('ko-KR')}
            </span>
            <span className="text-xs font-normal text-slate-400 shrink-0">원</span>
          </div>
          <div className="mt-1.5 text-[11px] leading-snug">
            {metrics.totalDailyIssued > 0 ? (
              <>
                <div className="text-amber-700 font-medium font-mono tabular-nums truncate">
                  교부 {metrics.totalDailyIssued.toLocaleString('ko-KR')}원 포함
                </div>
                <div className="text-slate-400">본청 원인행위 및 지출원인</div>
              </>
            ) : (
              <>
                <div className="text-slate-500">지출결의 원인행위 완료 누적</div>
                <div className="text-slate-400">e-호조 본청 지출 확정액</div>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">현재 집행률</span>
          <span
            className={`font-semibold font-mono tabular-nums px-1.5 py-0.5 rounded ${
              metrics.currentExecutionRate > 90
                ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {metrics.currentExecutionRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Card 3: 현재 집행 잔액 (Current Remaining) */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">현재 집행 잔액</span>
            <PiggyBank size={15} className="text-slate-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-1" title={`${metrics.totalRemaining.toLocaleString('ko-KR')}원`}>
            <span className="text-lg sm:text-xl font-bold font-mono tabular-nums tracking-tight text-slate-900 truncate">
              {metrics.totalRemaining.toLocaleString('ko-KR')}
            </span>
            <span className="text-xs font-normal text-slate-400 shrink-0">원</span>
          </div>
          <div className="mt-1.5 text-[11px] leading-snug">
            {metrics.totalDailyRemaining > 0 ? (
              <>
                <div className="text-amber-700 font-medium font-mono tabular-nums truncate">
                  + 일상 미집행 {metrics.totalDailyRemaining.toLocaleString('ko-KR')}원
                </div>
                <div className="text-emerald-700 font-semibold font-mono tabular-nums truncate">
                  실가용: {(metrics.totalRemaining + metrics.totalDailyRemaining).toLocaleString('ko-KR')}원
                </div>
              </>
            ) : (
              <>
                <div className="text-slate-500">지출 예정액 차감 전 순잔액</div>
                <div className="text-slate-400">실질 가용 자금 기준</div>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">현재 미집행률</span>
          <span className="font-semibold font-mono tabular-nums px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            {metrics.currentRemainingRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Card 4: 시뮬레이션 지출 예정액 (Simulated Expenditure) */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">지출 예정액</span>
            <Calculator size={15} className="text-slate-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-1" title={`${metrics.simulatedExpenditure.toLocaleString('ko-KR')}원`}>
            <span className="text-lg sm:text-xl font-bold font-mono tabular-nums tracking-tight text-indigo-600 truncate">
              {metrics.simulatedExpenditure.toLocaleString('ko-KR')}
            </span>
            <span className="text-xs font-normal text-slate-400 shrink-0">원</span>
          </div>
          <div className="mt-1.5 text-[11px] leading-snug">
            <div className="text-slate-600 font-medium">확정 지출 예정 항목 합계</div>
            <div className="text-slate-400">품의·소진 계획 등록액</div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">소진 예정률</span>
          <span className="font-semibold font-mono tabular-nums px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            {((metrics.simulatedExpenditure / (metrics.totalBudget || 1)) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Card 5: 최종 예상 잔액 (Final Expected Balance) */}
      <div
        className={`bg-white rounded-xl p-4 flex flex-col justify-between shadow-2xs transition-colors border ${
          metrics.finalExpectedBalance < 0
            ? 'border-rose-200/90 hover:border-rose-300'
            : 'border-slate-200/80 hover:border-slate-300'
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">최종 예상 잔액</span>
            {metrics.finalExpectedBalance < 0 ? (
              <AlertTriangle size={15} className="text-rose-500 shrink-0" />
            ) : (
              <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
            )}
          </div>
          <div className="flex items-baseline gap-1" title={`${metrics.finalExpectedBalance.toLocaleString('ko-KR')}원`}>
            <span
              className={`text-lg sm:text-xl font-bold font-mono tabular-nums tracking-tight truncate ${
                metrics.finalExpectedBalance < 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              {metrics.finalExpectedBalance.toLocaleString('ko-KR')}
            </span>
            <span className="text-xs font-normal text-slate-400 shrink-0">원</span>
          </div>
          <div className="mt-1.5 text-[11px] leading-snug">
            {metrics.totalFinalDailyRemaining > 0 ? (
              <>
                <div className="text-slate-500">일상경비 포함 실질 수지</div>
                <div className="text-slate-700 font-semibold font-mono tabular-nums truncate">
                  {(metrics.finalExpectedBalance + metrics.totalFinalDailyRemaining).toLocaleString('ko-KR')}원 예상
                </div>
              </>
            ) : (
              <>
                <div className="text-slate-500">예정액 집행 후 최종 수지</div>
                <div className="text-slate-400">순수 잔여 불용 예상액</div>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">예상 최종 집행률</span>
          <span
            className={`font-semibold font-mono tabular-nums px-1.5 py-0.5 rounded border ${
              metrics.projectedExecutionRate > 100
                ? 'bg-rose-50 border-rose-200/70 text-rose-700'
                : metrics.projectedExecutionRate > 90
                ? 'bg-amber-50 border-amber-200/70 text-amber-700'
                : 'bg-emerald-50 border-emerald-200/60 text-emerald-700'
            }`}
          >
            {metrics.projectedExecutionRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Card 6: 적자 세부사업 수 & 추가 필요 예납액 (Deficit Count & Required Balance) */}
      <div
        className={`bg-white rounded-xl p-4 flex flex-col justify-between shadow-2xs transition-colors border ${
          metrics.deficitCount > 0
            ? 'border-rose-200/90 hover:border-rose-300'
            : 'border-slate-200/80 hover:border-slate-300'
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">적자 발생 세부사업</span>
            <AlertOctagon size={15} className={metrics.deficitCount > 0 ? 'text-rose-500 shrink-0' : 'text-slate-400 shrink-0'} />
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-lg sm:text-xl font-bold font-mono tabular-nums tracking-tight ${
                metrics.deficitCount > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {metrics.deficitCount}개
            </span>
            <span
              className={`text-xs font-medium shrink-0 ${
                metrics.deficitCount > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              {metrics.deficitCount > 0 ? '(예산 초과)' : '(정상)'}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] leading-snug">
            {metrics.deficitCount > 0 ? (
              <>
                <div className="text-rose-600 font-medium">추가 소요 예산액</div>
                <div className="text-rose-700 font-mono font-bold tabular-nums truncate">
                  {metrics.requiredBalance.toLocaleString('ko-KR')}원
                </div>
              </>
            ) : (
              <>
                <div className="text-slate-500">전체 세부사업 잔액 양호</div>
                <div className="text-slate-400">예산 초과·결손 사업 없음</div>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">수지 건전성</span>
          <span
            className={`font-semibold px-1.5 py-0.5 rounded border ${
              metrics.deficitCount > 0
                ? 'bg-rose-50 border-rose-200/70 text-rose-700'
                : 'bg-emerald-50 border-emerald-200/60 text-emerald-700'
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
