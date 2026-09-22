'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts';
import { BudgetCategory, BudgetEntry, SimulationEntry, ProjectSimulationSummary } from '@/types';
import { TrendingUp, AlertTriangle, CheckCircle2, Filter } from 'lucide-react';

export interface SimulationBurnUpChartProps {
  categories: BudgetCategory[];
  budgetEntries: BudgetEntry[];
  entries: SimulationEntry[];
  projectSummaries: ProjectSimulationSummary[];
  availableDetailedProjects: string[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CustomSimulationTooltip = React.memo(({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const itemData = payload[0]?.payload;
    if (!itemData) return null;

    const hasActual = itemData.actualRate !== undefined;

    return (
      <div className="glass-panel dark:glass-panel-dark p-3.5 rounded-xl shadow-xl border border-white/20 dark:border-slate-800 flex flex-col gap-2 text-[11px] min-w-[210px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800 pb-1.5 mb-0.5">
          <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px] uppercase tracking-wider">
            {label}월 소진 시뮬레이션
          </span>
          {hasActual ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200/60">
              실집행 구간
            </span>
          ) : (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-200/60">
              예정 시뮬레이션
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {hasActual && (
            <div className="flex justify-between items-center gap-3">
              <span className="font-semibold text-slate-500 dark:text-slate-400">실제 누적 소진율:</span>
              <span className="font-bold font-mono text-xs text-blue-600 dark:text-blue-400">
                {itemData.actualRate}%
              </span>
            </div>
          )}

          <div className="flex justify-between items-center gap-3">
            <span className="font-semibold text-purple-600 dark:text-purple-400">예정 반영 예상율:</span>
            <span className="font-bold font-mono text-xs text-purple-700 dark:text-purple-300">
              {itemData.projectedRate !== undefined ? `${itemData.projectedRate}%` : '-'}
            </span>
          </div>

          <div className="flex justify-between items-center gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-400 dark:text-slate-500">11월 목표 가이드:</span>
            <span className="font-bold font-mono text-slate-500 dark:text-slate-400">
              {itemData.targetRate}%
            </span>
          </div>

          {itemData.projectedRate !== undefined && itemData.projectedRate > 100 && (
            <div className="mt-1 pt-1 border-t border-rose-100 flex items-center gap-1 text-[10px] font-bold text-rose-600">
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              <span>예산 한도 {Math.round(itemData.projectedRate - 100)}%p 초과 위험</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
});

CustomSimulationTooltip.displayName = 'CustomSimulationTooltip';

export const SimulationBurnUpChart: React.FC<SimulationBurnUpChartProps> = React.memo(({
  categories,
  budgetEntries,
  entries,
  availableDetailedProjects,
}) => {
  const [selectedProject, setSelectedProject] = useState<string>('ALL');

  // Filter Categories by Detailed Project
  const filteredCategories = useMemo(() => {
    return selectedProject === 'ALL'
      ? categories
      : categories.filter(c => c.detailedProject === selectedProject);
  }, [categories, selectedProject]);

  // Total Budget
  const totalBudget = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < filteredCategories.length; i++) {
      sum += filteredCategories[i].totalBudget;
    }
    return sum;
  }, [filteredCategories]);

  // Valid Category IDs
  const validCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < filteredCategories.length; i++) {
      ids.add(filteredCategories[i].id);
    }
    return ids;
  }, [filteredCategories]);

  // Filtered Simulated Entries Amount
  const totalSimulatedExpenditure = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (selectedProject === 'ALL' || e.detailedProject === selectedProject) {
        sum += e.amount;
      }
    }
    return sum;
  }, [entries, selectedProject]);

  // Monthly Execution & Projected Burn-Up Trend
  const { chartData, currentRate, finalProjectedRate, isOverBudget } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12 (현재 9)
    const monthlySpent = new Array<number>(12).fill(0);

    for (let i = 0; i < budgetEntries.length; i++) {
      const e = budgetEntries[i];
      if (!validCategoryIds.has(e.categoryId)) continue;

      let monthIdx = -1;
      if (e.date && e.date.length >= 7 && e.date.charCodeAt(4) === 45) {
        monthIdx = (e.date.charCodeAt(5) - 48) * 10 + (e.date.charCodeAt(6) - 48) - 1;
      }

      if (!e.isPlanned && e.actionType !== 'settle' && e.actionType !== 'daily_expense') {
        if (monthIdx >= 0 && monthIdx < 12) {
          const amt = e.actionType === 'transfer' ? -e.amount : e.amount;
          monthlySpent[monthIdx] += amt;
        }
      }
    }

    // Cumulative spent up to current month
    let cumulative = 0;
    for (let i = 0; i < currentMonth; i++) {
      cumulative += monthlySpent[i];
    }
    const currentTotalSpent = cumulative;
    const finalSimulatedTotal = currentTotalSpent + totalSimulatedExpenditure;

    const currentRateVal = totalBudget > 0 ? Number(((currentTotalSpent / totalBudget) * 100).toFixed(1)) : 0;
    const finalProjectedRateVal = totalBudget > 0 ? Number(((finalSimulatedTotal / totalBudget) * 100).toFixed(1)) : 0;

    let rollingSpent = 0;
    const data = MONTHS.map((m, i) => {
      const targetRateVal = i < 11 ? Number((((i + 1) / 11) * 100).toFixed(1)) : 100;

      if (i <= currentMonth - 1) {
        rollingSpent += monthlySpent[i];
        const actRate = totalBudget > 0 ? Number(((rollingSpent / totalBudget) * 100).toFixed(1)) : 0;

        return {
          name: m,
          actualRate: actRate,
          projectedRate: actRate,
          targetRate: targetRateVal,
        };
      } else {
        // Future Months (after currentMonth): smooth progression to November target
        // Index: currentMonth ~ 10(Nov), 11(Dec)
        const futureSteps = Math.max(1, 10 - (currentMonth - 1)); // steps from currentMonth to Nov
        const currentStep = i - (currentMonth - 1);
        const progressFactor = i >= 10 ? 1 : Math.min(1, currentStep / futureSteps);

        const interpAmount = currentTotalSpent + totalSimulatedExpenditure * progressFactor;
        const projRate = totalBudget > 0 ? Number(((interpAmount / totalBudget) * 100).toFixed(1)) : 0;

        return {
          name: m,
          actualRate: undefined,
          projectedRate: projRate,
          targetRate: targetRateVal,
        };
      }
    });

    return {
      chartData: data,
      currentRate: currentRateVal,
      finalProjectedRate: finalProjectedRateVal,
      isOverBudget: finalProjectedRateVal > 100,
    };
  }, [budgetEntries, validCategoryIds, totalBudget, totalSimulatedExpenditure]);

  // Dynamic YAxis Max (Expand if projectedRate > 100)
  const yAxisMax = useMemo(() => {
    if (finalProjectedRate > 100) {
      return Math.ceil((finalProjectedRate + 5) / 10) * 10;
    }
    return 100;
  }, [finalProjectedRate]);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-3 relative overflow-hidden">
      {/* 1. Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 shadow-2xs">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                지출 예정액 반영 예산 소진 추세
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-mono">
                Commitment Burn-up
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              현재 실집행선에 시뮬레이터 등록 예정액(₩{totalSimulatedExpenditure.toLocaleString('ko-KR')})을 합산한 0–100% 예상 소진선
            </p>
          </div>
        </div>

        {/* Project Selector & Status Indicators */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">전체 세부사업 총괄</option>
              {availableDetailedProjects.map((dp) => (
                <option key={dp} value={dp}>
                  {dp}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200/80 rounded-xl text-xs font-bold text-blue-700 shadow-3xs">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>현재 실집행 {currentRate.toFixed(1)}%</span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border shadow-3xs ${
                isOverBudget
                  ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                  : 'bg-purple-50 border-purple-200/80 text-purple-700'
              }`}
            >
              {isOverBudget ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
              )}
              <span>예정 반영 {finalProjectedRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Burn-up Line Chart */}
      <div className="w-full h-[240px] sm:h-[260px] mt-1 relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 15, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSimulationActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
              dy={8}
            />
            <YAxis
              domain={[0, yAxisMax]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
              tickFormatter={(val) => `${val}%`}
            />
            <RechartsTooltip content={<CustomSimulationTooltip />} />

            {/* 100% 예산 한도선 */}
            <ReferenceLine
              y={100}
              stroke={isOverBudget ? '#ef4444' : '#cbd5e1'}
              strokeDasharray="3 3"
              strokeWidth={isOverBudget ? 1.5 : 1}
              label={isOverBudget ? { value: '예산 한도 (100%)', fill: '#ef4444', fontSize: 9, fontWeight: 'bold', position: 'insideTopRight' } : undefined}
            />

            {/* 11월 예산 마감 가이드라인 */}
            <ReferenceLine
              x="Nov"
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: '11월 마감 (100%)',
                fill: '#ef4444',
                fontSize: 9,
                fontWeight: 'bold',
                position: 'insideTop',
                offset: 12,
              }}
            />

            {/* 선형 100% 소진 가이드 점선 (1월 ~ 11월 100%) */}
            <Line
              type="monotone"
              dataKey="targetRate"
              stroke="#cbd5e1"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              activeDot={false}
              name="11월 소진 목표"
            />

            {/* 현재 실제 누적 소진율 곡선 및 영역 (1월 ~ 현재월) */}
            <Area
              type="monotone"
              dataKey="actualRate"
              stroke="#3B82F6"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorSimulationActual)"
              activeDot={{ r: 5, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
              name="현재 실집행"
            />

            {/* 지출 예정액 반영 예상선 (현재월 진입 ~ 11월 마감) */}
            <Line
              type="monotone"
              dataKey="projectedRate"
              stroke="#9333ea"
              strokeWidth={2.5}
              strokeDasharray="4 4"
              dot={{ r: 3.5, fill: '#9333ea', stroke: '#fff', strokeWidth: 1.5 }}
              activeDot={{ r: 6, fill: '#9333ea', stroke: '#fff', strokeWidth: 2 }}
              name="예정액 반영 예상"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 3. Bottom Legend Indicators */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 pt-1 text-[11px] text-slate-500 font-semibold border-t border-slate-100 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 bg-blue-500 rounded-full" />
          <span>실제 누적 소진율 (1~9월 실적)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t-2 border-dashed border-purple-600" />
          <span className="text-purple-700 font-bold">지출 예정액 반영 예상선 (9~11월 시뮬레이션)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t border-dashed border-slate-400" />
          <span className="text-slate-400">11월 100% 목표 가이드선</span>
        </div>
      </div>
    </div>
  );
});

SimulationBurnUpChart.displayName = 'SimulationBurnUpChart';
