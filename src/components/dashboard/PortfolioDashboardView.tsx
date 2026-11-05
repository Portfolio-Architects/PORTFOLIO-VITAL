import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Line, ReferenceLine, XAxis, YAxis, Tooltip as RechartsTooltip, Area, CartesianGrid, ComposedChart, ResponsiveContainer } from 'recharts';
import { Task, BudgetCategory, BudgetEntry } from '@/types';
import { usePortfolioAnalytics } from '@/hooks/usePortfolioAnalytics';
import { ContactsBox } from './ContactsBox';


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



interface DashboardProps {
  tasks?: Task[];
  budgetCategories: BudgetCategory[];
  budgetEntries: BudgetEntry[];
  onLogout?: () => void;
  appMode?: 'HCHPS' | 'VITAL';
}

const MONTH_KO_MAP: Record<string, string> = {
  Jan: '1월',
  Feb: '2월',
  Mar: '3월',
  Apr: '4월',
  May: '5월',
  Jun: '6월',
  Jul: '7월',
  Aug: '8월',
  Sep: '9월',
  Oct: '10월',
  Nov: '11월',
  Dec: '12월',
  None: '집행 없음',
};

const CustomPieTooltip = React.memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data.isEmpty) return null;
    const formattedShare =
      typeof data.shareLabel === 'string'
        ? data.shareLabel
        : typeof data.share === 'number'
          ? `${data.share.toFixed(1)}%`
          : null;
    return (
      <div className="bg-white p-3 rounded-lg shadow-md border border-slate-200/90 flex flex-col gap-1 text-xs font-semibold text-slate-900">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: data.color }} />
          <span className="text-slate-700 font-bold">{data.name}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 pt-0.5">
          <span className="font-mono tabular-nums text-slate-900 font-bold">
            {Number(data.value).toLocaleString()}원
          </span>
          {formattedShare && (
            <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-500">
              ({formattedShare})
            </span>
          )}
        </div>
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
    const displayMonth = MONTH_KO_MAP[String(label)] || `${label}월`;

    return (
      <div className="bg-white p-3.5 rounded-xl shadow-md border border-slate-200/90 flex flex-col gap-2 text-xs min-w-[200px]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-0.5">
          <span className="font-bold text-slate-700 text-[11px]">{displayMonth} 집행 분석</span>
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

  const breakdownWithShare = useMemo(() => {
    const len = themeColors.length;
    return breakdownData.map((item, idx) => {
      const rawShare = totalBudget > 0 ? (item.total / totalBudget) * 100 : 0;
      const share = Number(rawShare.toFixed(1));
      const shareLabel =
        item.total > 0 && rawShare > 0 && rawShare < 0.1
          ? '<0.1%'
          : `${share.toFixed(1)}%`;
      const isCircularWrapCollision =
        breakdownData.length > 1 &&
        idx === breakdownData.length - 1 &&
        idx % len === 0;
      const colorIdx = isCircularWrapCollision ? 1 : idx % len;
      const color = themeColors[colorIdx] || '#cbd5e1';
      return {
        ...item,
        share,
        shareLabel,
        color,
      };
    });
  }, [breakdownData, totalBudget, themeColors]);

  const dynamicPieData = useMemo(() => {
    const positiveSlices = breakdownWithShare.filter((item) => item.total > 0);
    if (positiveSlices.length > 0 && totalBudget > 0) {
      return positiveSlices.map((item) => ({
        name: item.formationItem ? `${item.formationItem} · ${item.name}` : item.name,
        value: item.total,
        share: item.share,
        shareLabel: item.shareLabel,
        color: item.color,
        isEmpty: false,
      }));
    }
    return [
      {
        name: '편성 예산 없음',
        value: 1,
        share: 0,
        shareLabel: '0.0%',
        color: '#e2e8f0',
        isEmpty: true,
      },
    ];
  }, [breakdownWithShare, totalBudget]);

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-200 relative min-h-screen font-sans">
      {/* Main Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-2">
        
        {/* Left Column */}
        <div className="xl:col-span-6 flex flex-col gap-6">
          {/* 세부사업별 예산 편성 현황 */}
          <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs flex flex-col h-[420px]">
            <div className="flex justify-between items-center z-10 pb-4 mb-5 border-b border-slate-100">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  세부사업별 예산 편성 현황
                </h2>
                <p className="text-xs font-medium text-slate-400 mt-1">세부사업 및 통계목(비목)별 편성 예산 비중</p>
              </div>
              <select
                value={selectedProject}
                onChange={handleSelectProject}
                className="bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/80 text-slate-800 text-xs sm:text-sm font-bold rounded-lg px-4 py-2.5 outline-none focus:bg-white focus:border-slate-400 transition-colors cursor-pointer min-w-[180px]"
              >
                <option value="ALL">세부사업명 전체</option>
                {detailedProjects.map(dp => (
                  <option key={dp} value={dp}>{dp}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1 w-full h-[250px] flex flex-col sm:flex-row items-stretch justify-between mb-1 gap-4">
              <div className="w-full sm:w-[60%] h-[250px] flex-shrink-0 flex justify-center items-center">
                <div className="w-[220px] h-[220px] relative flex-shrink-0">
                  {renderCharts && (
                    <PieChart width={220} height={220}>
                      <Pie
                        data={dynamicPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={78}
                        outerRadius={104}
                        paddingAngle={dynamicPieData.length > 1 ? 1.5 : 0}
                        minAngle={dynamicPieData.length > 1 ? 2 : 0}
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
                    <span className="text-xs font-semibold text-slate-400 mb-1">총 편성 예산</span>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-lg sm:text-[19px] font-black font-mono tabular-nums text-slate-900 leading-none tracking-tight">{totalBudget.toLocaleString()}</span>
                      <span className="text-xs font-bold text-slate-400 leading-none">원</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full sm:w-[40%] flex justify-center sm:justify-start h-full items-center min-w-0">
                <div className="w-full flex flex-col divide-y divide-slate-100 justify-start min-w-0 max-h-[250px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                  {breakdownWithShare.map((item, idx) => (
                    <div 
                      key={item.id || (item.formationItem ? `${item.formationItem}-${item.name}-${idx}` : `${item.name}-${idx}`)} 
                      className="group flex items-center justify-between gap-2.5 w-full py-2.5 px-2 hover:bg-slate-50/80 transition-colors cursor-default min-w-0"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          data-testid="breakdown-color-swatch"
                          className="w-3.5 h-3.5 rounded-xs shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="flex flex-col min-w-0" title={item.formationItem ? `${item.formationItem} - ${item.name}` : item.name}>
                          {item.formationItem && (
                            <span className="text-[10px] font-bold text-slate-400 truncate tracking-wide leading-none mb-1">
                              {item.formationItem}
                            </span>
                          )}
                          <span className="text-[13px] sm:text-[14px] font-bold text-slate-800 truncate leading-none">
                            {item.name}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right ml-auto flex flex-col items-end gap-0.5">
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-sm sm:text-[16px] font-bold font-mono tabular-nums text-slate-900 leading-none whitespace-nowrap">{item.total.toLocaleString()}</span>
                          <span className="text-[11px] font-semibold text-slate-400 leading-none">원</span>
                        </div>
                        <span className="text-[11px] font-semibold font-mono tabular-nums text-slate-400 leading-none">
                          {item.shareLabel}
                        </span>
                      </div>
                    </div>
                  ))}
                  {breakdownWithShare.length === 0 && (
                    <span className="text-xs font-medium text-slate-400 text-center py-8">세부 항목이 없습니다.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KPI Mini Cards Grid */}
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4 content-start">
            {/* 1. 예산 집행률 */}
            <div className="bg-white shadow-2xs border border-slate-200/80 rounded-xl px-5 py-3.5 sm:px-6 sm:py-4 min-h-[78px] flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-600">예산 집행률</span>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shrink-0" />
              </div>
              <div className="flex items-end justify-between gap-2">
                <span className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-slate-900 leading-none">{executionRate.toFixed(1)}%</span>
                <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0 mb-1">
                  <div className="h-full bg-slate-900 rounded-full" style={{ width: `${Math.min(100, Math.max(0, executionRate))}%` }} />
                </div>
              </div>
            </div>

            {/* 2. 예산 잔여율 */}
            <div className="bg-white shadow-2xs border border-slate-200/80 rounded-xl px-5 py-3.5 sm:px-6 sm:py-4 min-h-[78px] flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-600">예산 잔여율</span>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
              </div>
              <div className="flex items-end justify-between gap-2">
                <span className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-slate-700 leading-none">{(100 - executionRate).toFixed(1)}%</span>
                <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0 mb-1">
                  <div className="h-full bg-slate-400 rounded-full" style={{ width: `${Math.min(100, Math.max(0, 100 - executionRate))}%` }} />
                </div>
              </div>
            </div>

            {/* 3. 누적 집행액 */}
            <div className="bg-white shadow-2xs border border-slate-200/80 rounded-xl px-5 py-3.5 sm:px-6 sm:py-4 min-h-[78px] flex flex-col justify-between relative overflow-hidden">
              <span className="text-xs font-bold text-slate-600 mb-1.5">누적 집행액</span>
              <div className="flex items-baseline gap-1 min-w-0" title={`${executedBudget.toLocaleString()}원`}>
                <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 leading-none truncate">
                  {executedBudget.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-400 shrink-0">원</span>
              </div>
            </div>

            {/* 4. 가용 잔액 */}
            <div className="bg-white shadow-2xs border border-slate-200/80 rounded-xl px-5 py-3.5 sm:px-6 sm:py-4 min-h-[78px] flex flex-col justify-between relative overflow-hidden">
              <span className="text-xs font-bold text-slate-600 mb-1.5">가용 잔액</span>
              <div className="flex items-baseline gap-1 min-w-0" title={`${remainingBudget.toLocaleString()}원`}>
                <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 truncate block leading-none">
                  {remainingBudget.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-400 shrink-0">원</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: 월별 예산 집행 추이 */}
        <div className="xl:col-span-6 flex flex-col gap-6">
          <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs h-full flex flex-col relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  월별 예산 집행 추이
                </h2>
                <p className="text-xs sm:text-[13px] font-medium text-slate-400 mt-1">11월 말 전액 집행 목표 대비 누적 소진율 (0~100%)</p>
              </div>

              {/* Cumulative Burn-up Status Badge */}
              <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 rounded-lg border border-slate-200/80 shrink-0">
                <span className="w-2 h-2 rounded-full bg-slate-900" />
                <span className="text-xs font-medium text-slate-600">
                  현재 누적 소진율: <span className="font-mono tabular-nums text-xs sm:text-sm font-bold text-slate-900">{executionRate.toFixed(1)}%</span>
                </span>
              </div>
            </div>

            {/* KPIs for 11-Month Total Execution Target */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-5 p-4 bg-slate-50/70 rounded-xl border border-slate-200/70">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-600 mb-1.5 truncate">최대 집행월</span>
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-1.5">
                  <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 leading-none">{MONTH_KO_MAP[maxSpendMonth.month] || maxSpendMonth.month}</span>
                  <span className="text-xs font-mono tabular-nums text-slate-500 truncate">({maxSpendMonth.amount.toLocaleString()}원)</span>
                </div>
              </div>
              <div className="flex flex-col items-start border-l border-slate-200/80 pl-3">
                <span className="text-xs font-bold text-slate-600 mb-1.5 truncate">월 권장 집행액 (11월 기준)</span>
                <div className="flex items-baseline gap-0.5 sm:gap-1 flex-wrap">
                  <span className="text-[15px] sm:text-xl font-bold font-mono tabular-nums text-slate-900 leading-none tracking-tight">{Math.round(recommendedMonthlySpendForTarget).toLocaleString()}</span>
                  <span className="text-xs font-medium text-slate-400">원</span>
                </div>
              </div>
              <div className="flex flex-col items-start border-l border-slate-200/80 pl-3">
                <span className="text-xs font-bold text-slate-600 mb-1.5 truncate">목표 대비 잔여액</span>
                <div className="flex items-baseline gap-0.5 sm:gap-1 flex-wrap">
                  <span className="text-[15px] sm:text-xl font-bold font-mono tabular-nums text-slate-900 leading-none tracking-tight">{remainingTargetAmount.toLocaleString()}</span>
                  <span className="text-xs font-medium text-slate-400">원</span>
                </div>
              </div>
            </div>

            {/* Monthly Trend Chart (0-100% Rate) */}
            <div className="flex-1 mt-5 relative w-full min-h-[325px] h-[325px]">
              {renderCharts && (
                <ResponsiveContainer width="100%" height={325}>
                  <ComposedChart data={monthlyExecutionData} margin={{ top: 25, right: 15, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCumulativeRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f172a" stopOpacity={0.14}/>
                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                      tickFormatter={(val) => MONTH_KO_MAP[String(val)] || String(val)}
                      dy={10}
                    />
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

      <div className="mt-8 mb-8 flex flex-col gap-8">
        {renderContacts ? (
          <ContactsBox />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-xl p-8 shadow-2xs border border-slate-200/80 h-[250px] animate-pulse">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-slate-800" />
            <p className="text-sm text-slate-500 font-bold">주소록 위젯을 순차 로딩하는 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const PortfolioDashboardView = React.memo(PortfolioDashboardViewComponent);
PortfolioDashboardView.displayName = 'PortfolioDashboardView';

