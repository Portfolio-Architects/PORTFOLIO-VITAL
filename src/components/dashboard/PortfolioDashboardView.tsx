import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Line, Bar, ReferenceLine, XAxis, YAxis, Tooltip as RechartsTooltip, Area, CartesianGrid, ComposedChart, ResponsiveContainer } from 'recharts';
import { Task, BudgetCategory, BudgetEntry } from '@/types';
import { usePortfolioAnalytics } from '@/hooks/usePortfolioAnalytics';
import { useContacts } from '@/hooks/useContacts';
import { BookOpen, Layers, PieChart as PieChartIcon, Sparkles } from 'lucide-react';
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
    <div className="flex flex-col items-center justify-center py-20 gap-4 glass-panel rounded-[2rem] p-8 shadow-2xs border border-white/20 h-[250px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      <p className="text-sm text-slate-500 font-bold">주소록 위젯을 불러오는 중...</p>
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
      <div className="glass-panel dark:glass-panel-dark p-3 rounded-xl shadow-lg border border-white/20 dark:border-slate-800 flex flex-col gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200">
        <span>{data.name}</span>
        <span className="font-mono text-indigo-600 dark:text-indigo-400 text-xs">
          {Number(data.value).toLocaleString()}원
        </span>
      </div>
    );
  }
  return null;
});
CustomPieTooltip.displayName = 'CustomPieTooltip';

const CustomComposedTooltip = React.memo(({ active, payload, label, chartType, isHchps }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel dark:glass-panel-dark p-3.5 rounded-xl shadow-xl border border-white/20 dark:border-slate-800 flex flex-col gap-1.5 text-[11px] min-w-[180px]">
        <div className="font-bold text-slate-400 dark:text-slate-300 border-b border-slate-200/40 dark:border-slate-800 pb-1.5 mb-1 text-[10px] uppercase tracking-wider">{label}월 집행 정보</div>
        <div className="flex flex-col gap-1">
          {payload.map((p: any, idx: number) => {
            const isTarget = p.dataKey === 'targetCumulative';
            const nameText = isTarget ? '11월 소진 목표' : chartType === 'cumulative' ? '누적 집행액' : '월별 집행액';
            const colorClass = isTarget ? 'text-slate-400 dark:text-slate-500' : isHchps ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400';
            return (
              <div key={idx} className="flex justify-between items-center gap-3">
                <span className="font-semibold text-slate-500 dark:text-slate-400">{nameText}:</span>
                <span className={`font-bold font-mono ${colorClass}`}>
                  {Number(p.value).toLocaleString()}원
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
});
CustomComposedTooltip.displayName = 'CustomComposedTooltip';

const HCHPS_THEME_COLORS = ['#059669', '#064e3b', '#34d399', '#047857', '#6ee7b7', '#d1fae5'];
const VITAL_THEME_COLORS = ['#3B82F6', '#1E3A8A', '#93C5FD', '#1D4ED8', '#60A5FA', '#DBEAFE'];

export type DashboardTab = 'budget' | 'contacts' | 'all';

function PortfolioDashboardViewComponent({ budgetCategories, budgetEntries, appMode = 'VITAL' }: DashboardProps) {
  const [chartType, setChartType] = useState<'monthly' | 'cumulative'>('monthly');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vital-dashboard-active-tab-v2');
        if (saved === 'budget' || saved === 'contacts' || saved === 'all') {
          return saved;
        }
      } catch {}
    }
    return 'all';
  });

  const { contacts } = useContacts();
  const renderContacts = useIdleMount();
  const renderCharts = useDeferredChartMount();

  const handleTabChange = useCallback((tab: DashboardTab) => {
    setDashboardTab(tab);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vital-dashboard-active-tab-v2', tab);
      } catch {}
    }
  }, []);

  const shouldRenderContacts = renderContacts || dashboardTab === 'contacts' || dashboardTab === 'all';

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

  const handleSetMonthly = useCallback(() => setChartType('monthly'), []);
  const handleSetCumulative = useCallback(() => setChartType('cumulative'), []);
  const handleSelectProject = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProject(e.target.value);
  }, [setSelectedProject]);

  const dynamicPieData = useMemo(() => {
    return [
      { ...(pieData[0] || { name: '집행', value: 0 }), color: isHchps ? '#059669' : '#3B82F6' },
      { ...(pieData[1] || { name: '잔액', value: 0 }) }
    ];
  }, [pieData, isHchps]);

  const activeTabAccentColor = isHchps 
    ? 'text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-700 shadow-sm border-slate-200/60 dark:border-slate-650' 
    : 'text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-700 shadow-sm border-slate-200/60 dark:border-slate-650';

  const activeBadgeColor = isHchps
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';

  return (
    <div className="w-full flex flex-col gap-5 animate-in fade-in duration-300 relative min-h-screen font-sans">
      
      {/* Dashboard Sub-navigation Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-1 border-b border-slate-200/60 dark:border-slate-800">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
          <button
            type="button"
            onClick={() => handleTabChange('budget')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              dashboardTab === 'budget'
                ? activeTabAccentColor
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/40'
            }`}
          >
            <PieChartIcon className="w-4 h-4" />
            <span>예산 종합 분석</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('contacts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              dashboardTab === 'contacts'
                ? activeTabAccentColor
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/40'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>연락처 관리</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold transition-colors ${
              dashboardTab === 'contacts'
                ? activeBadgeColor
                : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {contacts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('all')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              dashboardTab === 'all'
                ? activeTabAccentColor
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>전체 보기</span>
          </button>
        </div>

        {/* Status indicator badge */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-450">
          {dashboardTab === 'contacts' ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 text-[11px]">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              실무 협업자 및 마인드맵 공약제안 노드별 연락처 통합 주소록
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200/50 dark:border-slate-800 text-[11px]">
              <span>연락처 <strong className="text-slate-700 dark:text-slate-200">{contacts.length}</strong>건</span>
              <span>·</span>
              <span>예산 집행률 <strong className="text-slate-700 dark:text-slate-200">{executionRate.toFixed(1)}%</strong></span>
            </span>
          )}
        </div>
      </div>

      {/* Main Budget Panels (Visible when tab is 'budget' or 'all') */}
      {(dashboardTab === 'budget' || dashboardTab === 'all') && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-1">
        
        {/* Left Column */}
        <div className="xl:col-span-6 flex flex-col gap-6">
          {/* Budget Allocation */}
          <div className="glass-panel dark:glass-panel-dark rounded-[2rem] p-6 sm:p-7 shadow-2xs hover:shadow-md hover:scale-[1.002] transition-all duration-150 flex flex-col h-[380px]">
          <div className="flex justify-between items-center z-10 mb-4 sm:mb-5">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              Budget Allocation
            </h2>
            <select
              value={selectedProject}
              onChange={handleSelectProject}
              className={`bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:border-${isHchps ? 'emerald' : 'blue'}-500 focus:ring-2 focus:ring-${isHchps ? 'emerald' : 'blue'}-500/20 transition-all cursor-pointer shadow-sm min-w-[180px]`}
            >
              <option value="ALL">세부사업명 전체</option>
              {detailedProjects.map(dp => (
                <option key={dp} value={dp}>{dp}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 w-full h-[238px] flex flex-col sm:flex-row items-stretch justify-center mb-3 gap-6 sm:gap-8 md:gap-12 lg:gap-16">
            <div className="w-full sm:w-[250px] h-[238px] flex-shrink-0 flex justify-center items-center">
              <div className="w-[218px] h-[218px] relative flex-shrink-0">
                {renderCharts && (
                  <PieChart width={218} height={218}>
                    <Pie
                      data={dynamicPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={76}
                      outerRadius={104}
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
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                  <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-1">TOTAL BUDGET</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[18px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">{totalBudget.toLocaleString()}</span>
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 leading-none">KRW</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex justify-center sm:justify-start w-full sm:w-[300px] md:w-[340px] lg:w-[360px] h-full items-center min-w-0">
              <div className="w-full max-w-[380px] flex flex-col gap-3 justify-start min-w-0 max-h-[245px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                {breakdownData.map((item, idx) => (
                <div 
                  key={item.formationItem ? `${item.formationItem}-${item.name}` : item.name} 
                  className="group flex items-center w-full p-2 -ml-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-default min-w-0"
                >
                  <div className="w-4 h-4 rounded-full shrink-0 mr-3 shadow-sm" style={{ backgroundColor: themeColors[idx % themeColors.length] || '#cbd5e1' }} />
                  <div className="flex flex-col min-w-0 shrink" title={item.formationItem ? `${item.formationItem} - ${item.name}` : item.name}>
                    {item.formationItem && (
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate tracking-wider leading-none mb-1">
                        {item.formationItem}
                      </span>
                    )}
                    <span className="text-[14px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate leading-none">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex-1 min-w-[12px] border-b-[2px] border-dotted border-slate-200 dark:border-slate-800 mx-3 mt-1.5 opacity-80"></div>
                  <div className="w-[96px] shrink-0 text-right transition-transform group-hover:-translate-x-1 duration-300 ml-auto">
                    <span className="text-[16px] font-bold text-slate-800 dark:text-slate-200 leading-none tabular-nums whitespace-nowrap block">{item.total.toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {breakdownData.length === 0 && (
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 text-center">세부 항목이 없습니다.</span>
              )}
              </div>
            </div>
          </div>
        </div>

          {/* KPI Mini Cards Grid */}
          <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2 content-start">
            {/* 1. Execution Rate */}
            <div className="glass-panel dark:glass-panel-dark shadow-2xs border border-white/20 dark:border-slate-800/40 rounded-[1.5rem] py-3 px-4 sm:py-3.5 sm:px-4 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.01] hover:shadow-md transition-all duration-150">
              <span className={`text-[10px] font-bold ${isHchps ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'} uppercase tracking-widest relative z-10 mb-2 sm:mb-2.5`}>BUDGET EXECUTION</span>
              <span className={`text-2xl font-bold ${isHchps ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'} leading-none relative z-10`}>{executionRate.toFixed(1)}%</span>
              <div 
                className="absolute right-4 bottom-3 sm:bottom-3.5 w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm opacity-80 group-hover:scale-110 transition-transform"
                style={{ background: `conic-gradient(${isHchps ? '#10b981' : '#3b82f6'} ${executionRate}%, #e2e8f0 0)` }}
              >
                <div className="w-[20px] h-[20px] bg-white dark:bg-slate-900 rounded-full" />
              </div>
            </div>

            {/* 2. Remaining Budget */}
            <div className="glass-panel dark:glass-panel-dark shadow-2xs border border-white/20 dark:border-slate-800/40 rounded-[1.5rem] py-3 px-4 sm:py-3.5 sm:px-4 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.01] hover:shadow-md transition-all duration-150">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest relative z-10 mb-2 sm:mb-2.5">REMAINING BUDGET</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none relative z-10">{(100 - executionRate).toFixed(1)}%</span>
              <div 
                className="absolute right-4 bottom-3 sm:bottom-3.5 w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm opacity-80 group-hover:scale-110 transition-transform"
                style={{ background: `conic-gradient(#94a3b8 ${100 - executionRate}%, #e2e8f0 0)` }}
              >
                <div className="w-[20px] h-[20px] bg-white dark:bg-slate-900 rounded-full" />
              </div>
            </div>

            {/* 3. Executed Amount */}
            <div className="glass-panel dark:glass-panel-dark shadow-2xs border border-white/20 dark:border-slate-800/40 rounded-[1.5rem] py-3 px-4 sm:py-3.5 sm:px-4 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.01] hover:shadow-md transition-all duration-150">
              <span className={`text-[10px] font-bold ${isHchps ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'} uppercase tracking-widest relative z-10 mb-2 sm:mb-2.5`}>EXECUTED AMOUNT</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white leading-none relative z-10 truncate" title={`${executedBudget.toLocaleString()} KRW`}>
                {executedBudget.toLocaleString()}<span className="text-xs text-slate-400 dark:text-slate-500 ml-1">KRW</span>
              </span>
            </div>

            {/* 4. Remaining Amount */}
            <div className="glass-panel dark:glass-panel-dark shadow-2xs border border-white/20 dark:border-slate-800/40 rounded-[1.5rem] py-3 px-4 sm:py-3.5 sm:px-4 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.01] hover:shadow-md transition-all duration-150">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest relative z-10 mb-2 sm:mb-2.5">REMAINING AMOUNT</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white truncate block leading-none relative z-10" title={`${remainingBudget.toLocaleString()} KRW`}>
                {remainingBudget.toLocaleString()}<span className="text-xs text-slate-400 dark:text-slate-500 ml-1">KRW</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel: Predictive Budget Modeling */}
        <div className="xl:col-span-6 flex flex-col gap-6">
          <div className="glass-panel dark:glass-panel-dark rounded-[2rem] p-6 sm:p-7 shadow-2xs h-full flex flex-col relative overflow-hidden hover:scale-[1.002] hover:shadow-md transition-all duration-150">
            {/* Background Decor */}
            <div className={`absolute -top-24 -right-24 w-64 h-64 ${isHchps ? 'bg-emerald-500/5 dark:bg-emerald-950/20' : 'bg-blue-500/5 dark:bg-blue-950/20'} rounded-full blur-3xl pointer-events-none`} />

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  Monthly Budget Execution
                </h2>
                <p className="text-[13px] font-bold text-slate-400 dark:text-slate-500 mt-1">Monthly breakdown and cumulative execution trend</p>
              </div>

              {/* Chart Type Toggle Switch */}
              <div className="flex p-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-inner shrink-0">
                <button 
                  onClick={handleSetMonthly} 
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${chartType === 'monthly' ? `bg-white dark:bg-slate-700 ${isHchps ? 'text-emerald-600 dark:text-emerald-300' : 'text-blue-600 dark:text-blue-300'} shadow-sm border border-slate-200/50 dark:border-slate-850/40` : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 border border-transparent'}`}
                >
                  월별 집행액
                </button>
                <button 
                  onClick={handleSetCumulative} 
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${chartType === 'cumulative' ? `bg-white dark:bg-slate-700 ${isHchps ? 'text-emerald-600 dark:text-emerald-300' : 'text-blue-600 dark:text-blue-300'} shadow-sm border border-slate-200/50 dark:border-slate-850/40` : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 border border-transparent'}`}
                >
                  누적 집행액
                </button>
              </div>
            </div>

            {/* KPIs for 11-Month Total Execution Target */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-5 relative z-10">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 truncate">PEAK SPENDING</span>
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-1">
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-200 leading-none">{maxSpendMonth.month}</span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">({maxSpendMonth.amount.toLocaleString()}원)</span>
                </div>
              </div>
              <div className="flex flex-col items-center sm:items-start border-l border-slate-100 dark:border-slate-800 pl-2">
                <span className={`text-[10px] font-bold ${isHchps ? 'text-emerald-600 dark:text-emerald-450' : 'text-blue-600 dark:text-blue-450'} uppercase tracking-widest mb-1 truncate`}>REQ. SPEND / MO (11월)</span>
                <div className="flex items-baseline gap-0.5 sm:gap-1 flex-wrap">
                  <span className={`text-[15px] sm:text-xl font-bold ${isHchps ? 'text-emerald-600 dark:text-emerald-450' : 'text-blue-600 dark:text-blue-450'} leading-none tracking-tight`}>{Math.round(recommendedMonthlySpendForTarget).toLocaleString()}</span>
                  <span className={`text-[10px] font-bold ${isHchps ? 'text-emerald-400' : 'text-blue-400'}`}>원</span>
                </div>
              </div>
              <div className="flex flex-col items-end sm:items-start border-l border-slate-100 dark:border-slate-800 pl-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 truncate">REMAINING TARGET</span>
                <div className="flex items-baseline gap-0.5 sm:gap-1 flex-wrap">
                  <span className="text-[15px] sm:text-xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">{remainingTargetAmount.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">원</span>
                </div>
              </div>
            </div>

            {/* Monthly Trend Chart */}
            <div className="flex-1 mt-4 sm:mt-5 relative w-full min-h-[365px] h-[365px]">
              {renderCharts && (
                <ResponsiveContainer width="100%" height={365}>
                  <ComposedChart data={monthlyExecutionData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isHchps ? '#10B981' : '#3B82F6'} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={isHchps ? '#10B981' : '#3B82F6'} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isHchps ? '#34D399' : '#60A5FA'} stopOpacity={1}/>
                        <stop offset="100%" stopColor={isHchps ? '#059669' : '#3B82F6'} stopOpacity={0.85}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                      tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} 
                    />
                    <RechartsTooltip content={<CustomComposedTooltip chartType={chartType} isHchps={isHchps} />} />
                    
                    {/* 11월 100% 소진 마감일 세로 가이드라인 - insideTop과 offset 조정으로 텍스트 잘림 방지 */}
                    <ReferenceLine x="Nov" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} label={{ value: "11월 예산 마감", fill: "#ef4444", fontSize: 9, fontWeight: 'bold', position: 'insideTop', offset: 15 }} />
                    
                    {chartType === 'monthly' ? (
                      <Bar dataKey="monthly" fill="url(#colorBar)" radius={[4, 4, 0, 0]} barSize={16} />
                    ) : (
                      <>
                        {/* 선형 100% 소진 가이드 점선 */}
                        <Line type="monotone" dataKey="targetCumulative" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={false} />
                        <Area type="monotone" dataKey="cumulative" stroke={isHchps ? '#10B981' : '#3B82F6'} strokeWidth={3} fillOpacity={1} fill="url(#colorCumulative)" activeDot={{ r: 5, fill: isHchps ? '#10B981' : '#3B82F6', stroke: '#fff', strokeWidth: 2 }} />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Contacts Management Panel (Visible when tab is 'contacts' or 'all') */}
      {(dashboardTab === 'contacts' || dashboardTab === 'all') && (
        <div className="mt-2 mb-8 flex flex-col gap-8 animate-in fade-in duration-200">
          {shouldRenderContacts ? (
            <ContactsBox />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-4 glass-panel rounded-[2rem] p-8 shadow-2xs border border-white/20 h-[250px] animate-pulse">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              <p className="text-sm text-slate-500 font-bold">연락처 관리 위젯을 불러오는 중...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const PortfolioDashboardView = React.memo(PortfolioDashboardViewComponent);
PortfolioDashboardView.displayName = 'PortfolioDashboardView';

