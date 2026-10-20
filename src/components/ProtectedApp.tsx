"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { ModuleType } from '@/types';
import { useTasks } from '@/hooks/useTasks';
import { useBudget } from '@/hooks/useBudget';
import { useInventory } from '@/hooks/useInventory';
import { useMeetings } from '@/hooks/useMeetings';
import { useProjects } from '@/hooks/useProjects';
import { useContacts } from '@/hooks/useContacts';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/Sidebar';
import { syncTombstones } from '@/lib/sheets-api';
import BudgetSimulatorSkeleton from '@/components/budget/ui/BudgetSimulatorSkeleton';
import MindMap3DSkeleton from '@/components/skeletons/MindMap3DSkeleton';
import YangjaeFestivalSkeleton from '@/components/skeletons/YangjaeFestivalSkeleton';

function PortfolioDashboardViewSkeleton() {
  return (
    <div className="w-full flex flex-col gap-5 animate-pulse">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-2">
        <div className="xl:col-span-6 flex flex-col gap-5">
          <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs h-[380px] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div className="w-44 h-5 bg-slate-200/80 rounded-md" />
              <div className="w-36 h-9 bg-slate-100 border border-slate-200/80 rounded-lg" />
            </div>
            <div className="flex-grow flex flex-col sm:flex-row gap-8 items-center justify-center">
              <div className="w-[170px] h-[170px] rounded-full border-[14px] border-slate-100 flex items-center justify-center flex-shrink-0" />
              <div className="flex-grow flex flex-col gap-3 w-full">
                <div className="w-full h-3.5 bg-slate-100 rounded" />
                <div className="w-5/6 h-3.5 bg-slate-100 rounded" />
                <div className="w-2/3 h-3.5 bg-slate-100 rounded" />
                <div className="w-3/4 h-3.5 bg-slate-100 rounded" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs h-[96px] flex flex-col justify-between">
              <div className="w-24 h-2.5 bg-slate-200/80 rounded" />
              <div className="w-16 h-6 bg-slate-200/80 rounded-md" />
            </div>
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs h-[96px] flex flex-col justify-between">
              <div className="w-24 h-2.5 bg-slate-200/80 rounded" />
              <div className="w-16 h-6 bg-slate-200/80 rounded-md" />
            </div>
          </div>
        </div>
        <div className="xl:col-span-6 flex flex-col gap-5">
          <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs h-full min-h-[500px] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div className="flex flex-col gap-1.5">
                <div className="w-52 h-5 bg-slate-200/80 rounded-md" />
                <div className="w-36 h-3 bg-slate-100 rounded" />
              </div>
              <div className="w-28 h-8 bg-slate-100 border border-slate-200/80 rounded-lg" />
            </div>
            <div className="flex-grow w-full bg-slate-50/70 border border-slate-100 rounded-xl flex items-end gap-3 p-4 h-[365px]">
              <div className="flex-grow bg-slate-200/70 rounded-t h-[50%]" />
              <div className="flex-grow bg-slate-200/70 rounded-t h-[70%]" />
              <div className="flex-grow bg-slate-200/70 rounded-t h-[90%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceViewSkeleton() {
  return (
    <div className="w-full flex flex-col gap-5 animate-pulse">
      <div className="flex border-b border-slate-200/80 gap-1 pb-px">
        <div className="w-32 h-10 bg-slate-200/80 rounded-t-lg" />
        <div className="w-32 h-10 bg-slate-100 rounded-t-lg" />
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
        <div className="w-36 h-6 bg-slate-200/80 rounded-md" />
        <div className="w-24 h-8 bg-slate-100 border border-slate-200/80 rounded-lg" />
      </div>
    </div>
  );
}

const PortfolioDashboardView = dynamic(() => import('@/components/dashboard/PortfolioDashboardView').then(mod => mod.PortfolioDashboardView), {
  ssr: false,
  loading: () => <PortfolioDashboardViewSkeleton />
});

const WorkspaceView = dynamic(() => import('@/components/WorkspaceView').then(mod => mod.WorkspaceView), {
  ssr: false,
  loading: () => <WorkspaceViewSkeleton />
});

const BudgetSimulator = dynamic(() => import('@/components/budget/BudgetSimulator').then(mod => mod.BudgetSimulator), {
  ssr: false,
  loading: () => <BudgetSimulatorSkeleton />
});

const YangjaeFestivalDashboard = dynamic(() => import('@/components/festival/YangjaeFestivalDashboard'), {
  ssr: false,
  loading: () => <YangjaeFestivalSkeleton />
});

const MindMap3D = dynamic(() => import('@/components/MindMap3D').then(mod => mod.MindMap3D), {
  ssr: false,
  loading: () => <MindMap3DSkeleton />
});

const ProjectManagementPage = dynamic(() => import('@/components/project/ProjectManagementPage'), {
  ssr: false,
  loading: () => null
});

const AppLogModal = dynamic(() => import('@/components/AppLogModal').then(mod => mod.AppLogModal), {
  ssr: false,
  loading: () => null
});

const AIAssistantModal = dynamic(() => import('@/components/ai/AIAssistantModal').then(mod => mod.AIAssistantModal), {
  ssr: false,
  loading: () => null
});

const CommandPalette = dynamic(() => import('@/components/modals/CommandPalette').then(mod => mod.CommandPalette), {
  ssr: false,
  loading: () => null
});

const EMPTY_AI_CONTEXT = {
  signals: [],
  budgetEntries: [],
  budgetCategories: [],
  customNodes: [],
  customEdges: [],
  deletedEdges: [],
  overrides: {},
  keywordMap: {}
};

function scheduleStaggeredPreloads(): () => void {
  if (typeof window === 'undefined') return () => {};

  const idleCallbacks: number[] = [];
  const timeouts: NodeJS.Timeout[] = [];

  const scheduleIdle = (fn: () => void, delayMs: number) => {
    const timeoutId = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        const handle = window.requestIdleCallback(() => fn(), { timeout: 2000 });
        idleCallbacks.push(handle);
      } else {
        fn();
      }
    }, delayMs);
    timeouts.push(timeoutId);
  };

  // Stage 1 (+3.5s): Primary heavy sub-views (WorkspaceView, BudgetDashboard)
  scheduleIdle(() => {
    import('@/components/WorkspaceView');
    import('@/components/budget/BudgetDashboard');
  }, 3500);

  // Stage 2 (+5.5s): Secondary modules (YangjaeFestivalDashboard, InventoryList)
  scheduleIdle(() => {
    import('@/components/festival/YangjaeFestivalDashboard');
    import('@/components/inventory/InventoryList');
  }, 5500);

  // Stage 3 (+7.5s): Simulator & Modals (BudgetSimulator, AppLogModal, CommandPalette)
  scheduleIdle(() => {
    import('@/components/budget/BudgetSimulator');
    import('@/components/AppLogModal');
    import('@/components/modals/CommandPalette');
  }, 7500);

  return () => {
    timeouts.forEach(clearTimeout);
    if ('cancelIdleCallback' in window) {
      idleCallbacks.forEach(h => window.cancelIdleCallback(h));
    }
  };
}

export interface ProtectedAppProps {
  appMode: 'HCHPS' | 'VITAL';
  onModeChange: (mode: 'HCHPS' | 'VITAL') => void;
}

export function ProtectedApp({ appMode, onModeChange }: ProtectedAppProps) {
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
  const [visitedModules, setVisitedModules] = useState<Record<ModuleType, boolean>>({
    dashboard: true,
    workspace: false,
    mindmap: false,
    project: false,
    festival: false,
    simulator: false,
  });
  const [isQuickInputOpen, setIsQuickInputOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [hasOpenedCommandPalette, setHasOpenedCommandPalette] = useState(false);

  // Defer TASKS, MEETINGS, PROJECTS, INVENTORY fetching on initial Dashboard load until tab switch or Ctrl+K open (latched once triggered)
  const isDeferredDataEnabled =
    activeModule !== 'dashboard' ||
    visitedModules.workspace ||
    visitedModules.festival ||
    visitedModules.simulator ||
    visitedModules.mindmap ||
    visitedModules.project ||
    isCommandPaletteOpen ||
    hasOpenedCommandPalette;

  // Domain Hooks
  const { tasks, stats: taskStats } = useTasks({ enabled: isDeferredDataEnabled });
  const { categories: budgetCategories, entries: budgetEntries, addCategory, updateCategory, deleteCategory, replaceCategories, addEntry, updateEntry, deleteEntry, batchUpdateEntries, batchDeleteEntries, batchSettleEntries, getCategoryStats, overallStatsActual } = useBudget();
  const { items: inventoryItems, addItem, updateItem, deleteItem, adjustStock, getItemHistory } = useInventory({ enabled: isDeferredDataEnabled });
  const { meetings } = useMeetings({ enabled: isDeferredDataEnabled });
  const { projects } = useProjects({ enabled: isDeferredDataEnabled });
  const { contacts } = useContacts({ enabled: isCommandPaletteOpen || hasOpenedCommandPalette });

  const handleCloseCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => {
          const next = !prev;
          if (next) setHasOpenedCommandPalette(true);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const actualBudgetEntries = useMemo(() => budgetEntries.filter(e => !e.isPlanned), [budgetEntries]);
  const handleGetCategoryStats = useCallback((id: string) => getCategoryStats(id, true), [getCategoryStats]);
  const handleCloseQuickInput = useCallback(() => setIsQuickInputOpen(false), []);

  const aiContextData = useMemo(() => {
    if (!isQuickInputOpen) return EMPTY_AI_CONTEXT;
    return {
      signals: [],
      budgetEntries: budgetEntries,
      budgetCategories: budgetCategories,
      customNodes: [],
      customEdges: [],
      deletedEdges: [],
      overrides: {},
      keywordMap: {}
    };
  }, [isQuickInputOpen, budgetEntries, budgetCategories]);

  const preloadModule = useCallback((module: ModuleType) => {
    setVisitedModules(prev => {
      if (prev[module]) return prev;
      return { ...prev, [module]: true };
    });
  }, []);

  const handleAddSignalNoop = useCallback(() => {}, []);

  useEffect(() => {
    syncTombstones().catch(() => {});
  }, []);

  // Centralized Staggered Idle Chunk Preloading (+3.5s, +5.5s, +7.5s)
  useEffect(() => {
    return scheduleStaggeredPreloads();
  }, []);

  const { logout: handleLogout } = useAuth();

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const [, startTabTransition] = useTransition();

  const handleModuleChange = useCallback((module: ModuleType) => {
    startTabTransition(() => {
      setActiveModule(module);
      setVisitedModules(prev => prev[module] ? prev : { ...prev, [module]: true });
      localStorage.setItem('hchps_active_module', module);
    });
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    
    const distance = touchStartX.current - touchEndX.current;
    
    if (Math.abs(distance) > 60) {
      const order: ModuleType[] = ['dashboard', 'workspace', 'festival', 'simulator', 'mindmap', 'project'];
      const currentIndex = order.indexOf(activeModule);
      
      if (distance > 0 && currentIndex < order.length - 1) {
        handleModuleChange(order[currentIndex + 1]);
      } else if (distance < 0 && currentIndex > 0) {
        handleModuleChange(order[currentIndex - 1]);
      }
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <div 
      className="flex flex-col min-h-screen bg-[#f8fafc]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Sidebar
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        taskStats={taskStats}
        appMode={appMode}
        onModeChange={onModeChange}
        onPreloadModule={preloadModule}
        onOpenLogs={() => setIsLogsOpen(true)}
      />

      <main id="main-scroll-container" className="flex-1 pb-32 sm:pb-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1800px] mx-auto px-2 sm:px-3 lg:px-4 pt-4 sm:pt-6 lg:pt-8 flex flex-col gap-3">
          
          {/* Global Module Header & Divider Container */}
          <div className="flex flex-col gap-5 pt-2 sm:pt-3 lg:pt-4 shrink-0">
            <div className="flex flex-col gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3.5">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white rounded-xl shadow-2xs border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon-192x192.png" alt={`${appMode} Logo`} className="w-full h-full object-cover" />
                </div>
                <span>
                  {activeModule === 'dashboard' 
                    ? `PORTFOLIO ${appMode}` 
                    : `${appMode} ${
                        activeModule === 'workspace' 
                          ? '예산관리' 
                          : activeModule === 'festival'
                          ? '양재천 페스티벌'
                          : activeModule === 'simulator'
                          ? '예산 시뮬레이터' 
                          : ''
                      }`
                  }
                </span>
              </h1>
              <div className="flex items-center gap-2.5 ml-1">
                <div className="w-1 h-4 bg-slate-900 rounded-full shrink-0" />
                <p className="text-xs sm:text-[13px] font-medium text-slate-500 tracking-tight">
                  {appMode === 'HCHPS' 
                    ? '사내 업무 편성, 지식 자산화, 그리고 실시간 관제를 위한 초개인화 인텔리전스 워크스페이스' 
                    : 'Vital Information & Task Architecture Ledger — converging public health resources, tasks, and budget execution into a unified management topology'}
                </p>
              </div>
            </div>
            <div className="h-px w-full bg-slate-200/80" />
          </div>

          {/* Module Content */}
          <div className="flex-1 min-h-0">
            {/* Dashboard */}
            {visitedModules.dashboard && (
              <div className={activeModule === 'dashboard' ? 'block' : 'hidden'}>
                <PortfolioDashboardView tasks={tasks} budgetCategories={budgetCategories} budgetEntries={budgetEntries} onLogout={handleLogout} appMode={appMode} />
              </div>
            )}

            {/* Workspace (Budget Management) */}
            {visitedModules.workspace && (
              <div className={activeModule === 'workspace' ? 'block' : 'hidden'}>
                <WorkspaceView
                  budgetCategories={budgetCategories}
                  budgetEntries={actualBudgetEntries}
                  addCategory={addCategory}
                  updateCategory={updateCategory}
                  deleteCategory={deleteCategory}
                  replaceCategories={replaceCategories}
                  addEntry={addEntry}
                  updateEntry={updateEntry}
                  deleteEntry={deleteEntry}
                  batchUpdateEntries={batchUpdateEntries}
                  batchDeleteEntries={batchDeleteEntries}
                  batchSettleEntries={batchSettleEntries}
                  getCategoryStats={handleGetCategoryStats}
                  overallStats={overallStatsActual}
                  inventoryItems={inventoryItems}
                  addItem={addItem}
                  updateItem={updateItem}
                  deleteItem={deleteItem}
                  adjustStock={adjustStock}
                  getItemHistory={getItemHistory}
                  addSignal={handleAddSignalNoop}
                />
              </div>
            )}

            {/* MindMap3D */}
            {visitedModules.mindmap && (
              <div className={activeModule === 'mindmap' ? 'block h-[820px] min-h-[650px] w-full' : 'hidden'}>
                <MindMap3D isActive={activeModule === 'mindmap'} />
              </div>
            )}

            {/* Project Management */}
            {visitedModules.project && (
              <div className={activeModule === 'project' ? 'block' : 'hidden'}>
                <ProjectManagementPage />
              </div>
            )}

            {/* 2026 Yangjae Festival Dashboard */}
            {visitedModules.festival && (
              <div className={activeModule === 'festival' ? 'block' : 'hidden'}>
                <YangjaeFestivalDashboard isActive={activeModule === 'festival'} />
              </div>
            )}

            {/* Budget Simulator */}
            {visitedModules.simulator && (
              <div className={activeModule === 'simulator' ? 'block' : 'hidden'}>
                <BudgetSimulator />
              </div>
            )}
          </div>

          {/* Common Footer */}
          <div id="dashboard-footer" className="mt-8 pt-6 pb-4 border-t border-slate-200/80 shrink-0">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 text-[11px] font-medium text-slate-400 tracking-wider uppercase">
              <span className="font-mono tabular-nums">© 2026 PORTFOLIO {appMode}. All rights reserved.</span>
              <span className="flex items-center gap-2.5">
                <span>Precision Operations Intelligence</span>
                <span className="text-slate-300">·</span> 
                <button onClick={handleLogout} className="text-slate-600 hover:text-slate-900 font-semibold transition-colors cursor-pointer">SECURE</button>
              </span>
            </div>
          </div>
        </div>
      </main>

      {isLogsOpen && (
        <AppLogModal 
          isOpen={isLogsOpen}
          onClose={() => setIsLogsOpen(false)}
          appMode={appMode}
        />
      )}

      {isCommandPaletteOpen && (
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={handleCloseCommandPalette}
          onSelectModule={handleModuleChange}
          tasks={tasks}
          budgetEntries={budgetEntries}
          budgetCategories={budgetCategories}
          inventoryItems={inventoryItems}
          contacts={contacts}
          projects={projects}
          meetings={meetings}
        />
      )}

      <div className="fixed bottom-24 sm:bottom-8 right-4 sm:right-8 z-50 flex flex-col items-end gap-3">
        {isQuickInputOpen && (
          <AIAssistantModal 
            isOpen={isQuickInputOpen} 
            onClose={handleCloseQuickInput}
            appMode={appMode}
            contextData={aiContextData}
          />
        )}
      </div>
    </div>
  );
}
