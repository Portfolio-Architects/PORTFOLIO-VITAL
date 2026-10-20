import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Line, ReferenceLine, XAxis, YAxis, Tooltip as RechartsTooltip, Area, CartesianGrid, ComposedChart, ResponsiveContainer } from 'recharts';
import { Task, BudgetCategory, BudgetEntry } from '@/types';
import { usePortfolioAnalytics } from '@/hooks/usePortfolioAnalytics';
import dynamic from 'next/dynamic';


function deferIdle(cb: () => void, timeout: number, fallbackMs: number) {
  if (typeof window === 'undefined') return () => {};
  const isIdle = 'requestIdleCallback' in window, w = window as any;
  const id = isIdle ? w.requestIdleCallback(cb, { timeout }) : setTimeout(cb, fallbackMs);
  return () => {
    if (isIdle) {
      w.cancelIdleCallback(id);
    } else {
      clearTimeout(id);
    }
  };
}

function useIdleMount(fallbackMs = 200) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const cancel = deferIdle(() => setMounted(true), 400, fallbackMs);
    return cancel;
  }, [fallbackMs]);
  return mounted;
}

function useDeferredChartMount() {
  const [shouldRender, setShouldRender] = useState(false);
  useEffect(() => {
    const animFrame = requestAnimationFrame(() => {
      setShouldRender(true);
    });
    return () => cancelAnimationFrame(animFrame);
  }, []);
  return shouldRender;
}

const ContactsBox = dynamic(() => import('./ContactsBox').then(mod => mod.ContactsBox), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-xl p-6 shadow-2xs border border-slate-200/80 h-[250px]">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-slate-800" />
      <p className="text-xs text-slate-500 font-medium">주소록 위젯을 불러오는 중...</p>
    </div>
  )
});



interface DashboardProps {
  tasks: Task[];
  budgetCategories: BudgetCategory[];
  budgetEntries: BudgetEntry[];
  onLogout?: () => void;
  appMode?: 'HCHPS' | 'VITAL';
}

const CustomPieTooltip = React.memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg shadow-md border border-slate-200/90 flex flex-col gap-1 text-xs font-semibold text-slate-900">
        <span className="text-slate-600">{data.name}</span>
        <span className="font-mono tabular-nums text-slate-900 font-bold">
          {Number(data.value).toLocaleString()}원
        </span>
      </div>
    );
  }
  return null;
});
CustomPieTooltip.displayName = 'CustomPieTooltip';

const CustomComposedTooltip = React.memo(({ active, payload, label, isHchps }: any) => {
  if (active && payload && payload.length) {
    const itemData = payload[0]?.payload;
    const hasData = itemData && itemData.cumulativeRate !== undefined;

    return (
      <div className="bg-white p-3.5 rounded-xl shadow-md border border-slate-200/90 flex flex-col gap-2 text-xs min-w-[200px]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-0.5">
          <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">{label}월 집행 분석</span>
          {hasData ? (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${isHchps ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' : 'bg-blue-50 text-blue-700 border-blue-200/80'}`}>
              실적 반영
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-200/60">
              미집행
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {hasData ? (
            <>
              <div className="flex justify-between items-center gap-3">
                <span className="font-medium text-slate-500">누적 소진율:</span>
                <span className="font-bold font-mono tabular-nums text-slate-900">
                  {itemData.cumulativeRate}%
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="font-medium text-slate-500">당월 집행액:</span>
                <span className="font-bold font-mono tabular-nums text-slate-800">
                  {Number(itemData.monthly || 0).toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="font-medium text-slate-500">누적 집행액:</span>
                <span className="font-bold font-mono tabular-nums text-slate-800">
                  {Number(itemData.cumulative || 0).toLocaleString()}원
                </span>
              </div>
            </>
          ) : null}

          <div className="flex justify-between items-center gap-3 pt-1.5 border-t border-slate-100">
            <span className="font-medium text-slate-400">11월 목표 소진율:</span>
            <span className="font-semibold font-mono tabular-nums text-slate-500">
              {itemData?.targetRate}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
});
CustomComposedTooltip.displayName = 'CustomComposedTooltip';

const HCHPS_THEME_COLORS = ['#0f172a', '#059669', '#334155', '#10b981', '#64748b', '#94a3b8'];
const VITAL_THEME_COLORS = ['#0f172a', '#2563eb', '#334155', '#3b82f6', '#64748b', '#94a3b8'];

function PortfolioDashboardViewComponent({ budgetCategories, budgetEntries, appMode = 'VITAL' }: DashboardProps) {
  const renderContacts = useIdleMount();
  const renderCharts = useDeferredChartMount();

  const {
    selectedProject, setSelectedProject,
    detailedProjects,
    totalBudget,
    executedBudget,
    remainingBudget,
    executionRate,
    pieData,
    breakdownData,
    monthlyExecutionData,
    maxSpendMonth,
    remainingTargetAmount,
    recommendedMonthlySpendForTarget,
  } = usePortfolioAnalytics(budgetCategories, budgetEntries);

  const isHchps = appMode === 'HCHPS';
  const themeColors = isHchps ? HCHPS_THEME_COLORS : VITAL_THEME_COLORS;

  const handleSelectProject = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProject(e.target.value);
  }, [setSelectedProject]);

  const dynamicPieData = useMemo(() => {
    return [
      { ...(pieData[0] || { name: '집행', value: 0 }), color: '#0f172a' },
      { ...(pieData[1] || { name: '잔액', value: 0 }), color: '#e2e8f0' }
    ];
  }, [pieData]);

  return (
    <div className="w-full flex flex-col gap-5 animate-in fade-in duration-200 relative min-h-screen font-sans">
      
      {/* Main Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-2">
        
        {/* Left Column */}
        <div className="xl:col-span-6 flex flex-col gap-5">
          {/* Budget Allocation */}
          <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs flex flex-col h-[380px]">
            <div className="flex justify-between items-center z-10 pb-3.5 mb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Budget Allocation
                </h2>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">세부사업별 예산 편성 및 비목 비중</p>
              </div>
              <select
                value={selectedProject}
                onChange={handleSelectProject}
                className="bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/80 text-slate-800 text-xs font-semibold rounded-lg px-3 py-2 outline-none focus:bg-white focus:border-slate-400 transition-colors cursor-pointer min-w-[170px]"
              >
                <option value="ALL">세부사업명 전체</option>
                {detailedProjects.map(dp => (
                  <option key={dp} value={dp}>{dp}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1 w-full h-[238px] flex flex-col sm:flex-row items-stretch justify-center mb-1 gap-6 sm:gap-8 md:gap-10">
              <div className="w-full sm:w-[230px] h-[238px] flex-shrink-0 flex justify-center items-center">
                <div className="w-[208px] h-[208px] relative flex-shrink-0">
                  {renderCharts && (
                    <PieChart width={208} height={208}>
                      <Pie
                        data={dynamicPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={74}
                        outerRadius={98}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                        cornerRadius={0}
                        style={{ outline: 'none' }}
                      >
                        {dynamicPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  )}
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">TOTAL BUDGET</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base sm:text-[17px] font-bold font-mono tabular-nums text-slate-900 leading-none tracking-tight">{totalBudget.toLocaleString()}</span>
                      <span className="text-[10px] font-semibold font-mono text-slate-400 leading-none">KRW</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex justify-center sm:justify-start h-full items-center min-w-0">
                <div className="w-full flex flex-col divide-y divide-slate-100 justify-start min-w-0 max-h-[245px] overflow-y-auto pr-1.5" style={{ scrollbarWidth: 'thin' }}>
                  {breakdownData.map((item, idx) => (
                    <div 
                      key={item.formationItem ? `${item.formationItem}-${item.name}` : item.name} 
                      className="group flex items-center justify-between gap-3 w-full py-2.5 px-2 hover:bg-slate-50/80 transition-colors cursor-default min-w-0"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: themeColors[idx % themeColors.length] || '#cbd5e1' }} />
                        <div className="flex flex-col min-w-0" title={item.formationItem ? `${item.formationItem} - ${item.name}` : item.name}>
                          {item.formationItem && (
                            <span className="text-[10px] font-medium text-slate-400 truncate tracking-wide leading-none mb-1">
                              {item.formationItem}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-slate-800 truncate leading-none">
                            {item.name}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right ml-auto">
                        <span className="text-xs sm:text-[13px] font-bold font-mono tabular-nums text-slate-900 leading-none whitespace-nowrap block">{item.total.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                  {breakdownData.length === 0 && (
                    <span className="text-xs font-medium text-slate-400 text-center py-8">세부 항목이 없습니다.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KPI Mini Cards Grid */}
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4 content-start">
            {/* 1. Execution Rate */}
            <div className="bg-white shadow-2xs border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">BUDGET EXECUTION</span>
                <span className="w-2 h-2 rounded-full bg-slate-900 shrink-0" />
              </div>
              <div className="flex items-end justify-between gap-2">
                <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 leading-none">{executionRate.toFixed(1)}%</span>
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0 mb-1">
                  <div className="h-full bg-slate-900 rounded-full" style={{ width: `${Math.min(100, Math.max(0, executionRate))}%` }} />
                </div>
              </div>
            </div>

            {/* 2. Remaining Budget */}
            <div className="bg-white shadow-2xs border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">REMAINING BUDGET</span>
                <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
              </div>
              <div className="flex items-end justify-between gap-2">
                <span className="text-2xl font-bold font-mono tabular-nums text-slate-700 leading-none">{(100 - executionRate).toFixed(1)}%</span>
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0 mb-1">
                  <div className="h-full bg-slate-400 rounded-full" style={{ width: `${Math.min(100, Math.max(0, 100 - executionRate))}%` }} />
                </div>
              </div>
            </div>

            {/* 3. Executed Amount */}
            <div className="bg-white shadow-2xs border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">EXECUTED AMOUNT</span>
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 leading-none truncate" title={`${executedBudget.toLocaleString()} KRW`}>
                {executedBudget.toLocaleString()}<span className="text-[11px] font-normal text-slate-400 ml-1">KRW</span>
              </span>
            </div>

            {/* 4. Remaining Amount */}
            <div className="bg-white shadow-2xs border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">REMAINING AMOUNT</span>
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 truncate block leading-none" title={`${remainingBudget.toLocaleString()} KRW`}>
                {remainingBudget.toLocaleString()}<span className="text-[11px] font-normal text-slate-400 ml-1">KRW</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel: Predictive Budget Modeling */}
        <div className="xl:col-span-6 flex flex-col gap-5">
          <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs h-full flex flex-col relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Monthly Budget Execution
                </h2>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">Cumulative budget execution rate (0–100% Target Burn-up)</p>
              </div>

              {/* Cumulative Burn-up Status Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200/80 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                <span className="text-[11px] font-medium text-slate-600">
                  현재 누적 소진율: <span className="font-mono tabular-nums text-xs font-bold text-slate-900">{executionRate.toFixed(1)}%</span>
                </span>
              </div>
            </div>

            {/* KPIs for 11-Month Total Execution Target */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70">
              <div className="flex flex-col">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 truncate">PEAK SPENDING</span>
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-1.5">
                  <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 leading-none">{maxSpendMonth.month}</span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 truncate">({maxSpendMonth.amount.toLocaleString()}원)</span>
                </div>
              </div>
              <div className="flex flex-col items-start border-l border-slate-200/80 pl-3">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 truncate">REQ. SPEND / MO (11월)</span>
                <div className="flex items-baseline gap-0.5 flex-wrap">
                  <span className="text-sm sm:text-lg font-bold font-mono tabular-nums text-slate-900 leading-none tracking-tight">{Math.round(recommendedMonthlySpendForTarget).toLocaleString()}</span>
                  <span className="text-[10px] font-medium text-slate-400">원</span>
                </div>
              </div>
              <div className="flex flex-col items-start border-l border-slate-200/80 pl-3">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 truncate">REMAINING TARGET</span>
                <div className="flex items-baseline gap-0.5 flex-wrap">
                  <span className="text-sm sm:text-lg font-bold font-mono tabular-nums text-slate-900 leading-none tracking-tight">{remainingTargetAmount.toLocaleString()}</span>
                  <span className="text-[10px] font-medium text-slate-400">원</span>
                </div>
              </div>
            </div>

            {/* Monthly Trend Chart (0-100% Rate) */}
            <div className="flex-1 mt-4 relative w-full min-h-[365px] h-[365px]">
              {renderCharts && (
                <ResponsiveContainer width="100%" height={365}>
                  <ComposedChart data={monthlyExecutionData} margin={{ top: 25, right: 15, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCumulativeRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f172a" stopOpacity={0.14}/>
                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} dy={10} />
                    <YAxis 
                      domain={[0, 100]}
                      ticks={[0, 20, 40, 60, 80, 100]}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} 
                      tickFormatter={(val) => `${val}%`} 
                    />
                    <RechartsTooltip content={<CustomComposedTooltip isHchps={isHchps} />} />
                    
                    {/* 100% 목표 상한 가이드 기준선 */}
                    <ReferenceLine y={100} stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth={1} />

                    {/* 11월 100% 소진 마감일 세로 가이드라인 - insideTop과 offset 조정으로 텍스트 잘림 방지 */}
                    <ReferenceLine x="Nov" stroke="#e11d48" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "11월 예산 마감 (100%)", fill: "#e11d48", fontSize: 9, fontWeight: 700, position: 'insideTop', offset: 15 }} />
                    
                    {/* 선형 100% 소진 가이드 점선 */}
                    <Line type="monotone" dataKey="targetRate" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} name="11월 소진 목표" />
                    
                    {/* 실제 누적 소진율 곡선 및 영역 */}
                    <Area type="monotone" dataKey="cumulativeRate" stroke="#0f172a" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCumulativeRate)" activeDot={{ r: 4, fill: '#0f172a', stroke: '#fff', strokeWidth: 2 }} name="누적 소진율" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 mb-6 flex flex-col gap-6">
        {renderContacts ? (
          <ContactsBox />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-xl p-6 shadow-2xs border border-slate-200/80 h-[250px] animate-pulse">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-slate-800" />
            <p className="text-xs text-slate-500 font-medium">주소록 위젯을 순차 로딩하는 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const PortfolioDashboardView = React.memo(PortfolioDashboardViewComponent);
PortfolioDashboardView.displayName = 'PortfolioDashboardView';

