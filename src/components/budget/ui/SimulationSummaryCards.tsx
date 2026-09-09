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
    const projectedExecutionRate =
      totalBudget > 0 ? ((totalSpent + simulatedExpenditure) / totalBudget) * 100 : 0;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      currentExecutionRate,
      simulatedExpenditure,
      finalExpectedBalance,
      projectedExecutionRate,
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
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 tracking-wider">총 예산액</span>
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
            ₩{metrics.totalBudget.toLocaleString('ko-KR')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">전체 세부사업 총 편성 예산</p>
        </div>
      </div>

      {/* Card 2: 현재 집행액 & 집행률 (Current Spent) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 tracking-wider">현재 집행액</span>
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-xl sm:text-2xl font-extrabold text-indigo-700 font-mono tracking-tight">
              ₩{metrics.totalSpent.toLocaleString('ko-KR')}
            </span>
          </div>
          {metrics.totalDailyIssued > 0 && (
            <div className="text-[10px] text-amber-700 font-normal font-sans tracking-tight mt-0.5">
              (교부 ₩{metrics.totalDailyIssued.toLocaleString('ko-KR')})
            </div>
          )}
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-slate-400 font-medium">현재 집행률</span>
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${
                metrics.currentExecutionRate > 90
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700'
              }`}
            >
              {metrics.currentExecutionRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Card 3: 현재 집행 잔액 (Current Remaining) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 tracking-wider">현재 집행 잔액</span>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <PiggyBank className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 font-mono tracking-tight">
            ₩{metrics.totalRemaining.toLocaleString('ko-KR')}
          </div>
          {metrics.totalDailyRemaining > 0 ? (
            <div className="mt-1 text-[11px] font-sans font-medium text-amber-700 flex items-center justify-between flex-wrap gap-1">
              <span>+ 일상 미집행 ₩{metrics.totalDailyRemaining.toLocaleString('ko-KR')}</span>
              <span className="text-emerald-700 font-bold" title="교부 잔액 포함 실질 가용 총액">
                (실가용 ₩{(metrics.totalRemaining + metrics.totalDailyRemaining).toLocaleString('ko-KR')})
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 mt-1 font-medium">지출 예정액 차감 전 순잔액</p>
          )}
        </div>
      </div>

      {/* Card 4: 시뮬레이션 지출 예정액 (Simulated Expenditure) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 tracking-wider">지출 예정액</span>
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
            <Calculator className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-2xl font-extrabold text-purple-700 font-mono tracking-tight">
            ₩{metrics.simulatedExpenditure.toLocaleString('ko-KR')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">확정 지출 예정 항목 합계</p>
        </div>
      </div>

      {/* Card 5: 최종 예상 잔액 (Final Expected Balance) */}
      <div
        className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-all relative overflow-hidden border ${
          metrics.finalExpectedBalance < 0
            ? 'bg-rose-50/90 border-rose-300 text-rose-900 animate-pulse'
            : 'bg-white border-slate-200/90 text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 tracking-wider">최종 예상 잔액</span>
          <div
            className={`p-2 rounded-xl border ${
              metrics.finalExpectedBalance < 0
                ? 'bg-rose-100 text-rose-700 border-rose-200'
                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
            }`}
          >
            {metrics.finalExpectedBalance < 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            )}
          </div>
        </div>
        <div className="mt-3">
          <div
            className={`text-xl sm:text-2xl font-extrabold font-mono tracking-tight ${
              metrics.finalExpectedBalance < 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            ₩{metrics.finalExpectedBalance.toLocaleString('ko-KR')}
          </div>
          {metrics.totalDailyRemaining > 0 && (
            <div className="text-[10px] text-slate-500 font-normal font-sans tracking-tight mt-0.5">
              (일상 포함 ₩{(metrics.finalExpectedBalance + metrics.totalDailyRemaining).toLocaleString('ko-KR')})
            </div>
          )}
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-slate-400 font-medium">예상 최종 집행률</span>
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${
                metrics.projectedExecutionRate > 100
                  ? 'bg-rose-100 border-rose-300 text-rose-700'
                  : metrics.projectedExecutionRate > 90
                  ? 'bg-amber-100 border-amber-300 text-amber-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              {metrics.projectedExecutionRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Card 6: 적자 세부사업 수 & 추가 필요 예납액 (Deficit Count & Required Balance) */}
      <div
        className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-all relative overflow-hidden border ${
          metrics.deficitCount > 0
            ? 'bg-rose-50/90 border-rose-300 text-rose-900'
            : 'bg-white border-slate-200/90 text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 tracking-wider">적자 발생 세부사업</span>
          <div
            className={`p-2 rounded-xl border ${
              metrics.deficitCount > 0
                ? 'bg-rose-100 text-rose-700 border-rose-200'
                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {metrics.deficitCount > 0 ? (
            <>
              <div className="text-xl sm:text-2xl font-extrabold text-rose-600 font-mono tracking-tight flex items-baseline gap-1">
                <span>{metrics.deficitCount}개</span>
                <span className="text-xs font-semibold text-rose-700">사업 초과</span>
              </div>
              <p className="text-xs text-rose-700/90 mt-1 font-mono font-bold">
                추가 필요: ₩{metrics.requiredBalance.toLocaleString('ko-KR')}
              </p>
            </>
          ) : (
            <>
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 font-mono tracking-tight">
                0개 (정상)
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">전체 세부사업 예산 잔액 양호</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

SimulationSummaryCards.displayName = 'SimulationSummaryCards';
