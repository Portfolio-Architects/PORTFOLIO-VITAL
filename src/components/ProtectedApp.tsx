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
import YangjaeFestivalSkeleton from '@/components/skeletons/YangjaeFestivalSkeleton';
import { PortfolioDashboardViewSkeleton } from '@/components/skeletons/PortfolioDashboardViewSkeleton';
import { WorkingMemoryContextBanner } from '@/components/dashboard/WorkingMemoryContextBanner';
import { PortfolioDashboardView as DirectPortfolioDashboardView } from '@/components/dashboard/PortfolioDashboardView';

export { PortfolioDashboardViewSkeleton };

function WorkspaceViewSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6 animate-pulse">
      <div className="flex border-b border-slate-200/80 gap-1.5 pb-px">
        <div className="w-36 h-11 bg-slate-200/80 rounded-t-lg" />
        <div className="w-36 h-11 bg-slate-100 rounded-t-lg" />
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
        <div className="w-40 h-7 bg-slate-200/80 rounded-md" />
        <div className="w-28 h-9 bg-slate-100 border border-slate-200/80 rounded-lg" />
      </div>
    </div>
  );
}

const PortfolioDashboardView = dynamic(() => import('@/components/dashboard/PortfolioDashboardView').then(mod => mod.PortfolioDashboardView).catch(() => DirectPortfolioDashboardView), {
  ssr: false,
  loading: () => <PortfolioDashboardViewSkeleton />
});

const WorkspaceView = dynamic(() => import('@/components/WorkspaceView').then(mod => mod.WorkspaceView).catch(() => WorkspaceViewSkeleton), {
  ssr: false,
  loading: () => <WorkspaceViewSkeleton />
});

const BudgetSimulator = dynamic(() => import('@/components/budget/BudgetSimulator').then(mod => mod.BudgetSimulator).catch(() => BudgetSimulatorSkeleton), {
  ssr: false,
  loading: () => <BudgetSimulatorSkeleton />
});

const YangjaeFestivalDashboard = dynamic(() => import('@/components/festival/YangjaeFestivalDashboard').catch(() => ({ default: YangjaeFestivalSkeleton })), {
  ssr: false,
  loading: () => <YangjaeFestivalSkeleton />
});

const ProjectManagementPage = dynamic(() => import('@/components/project/ProjectManagementPage').catch(() => ({ default: () => null })), {
  ssr: false,
  loading: () => null
});

const AppLogModal = dynamic(() => import('@/components/AppLogModal').then(mod => mod.AppLogModal).catch(() => () => null), {
  ssr: false,
  loading: () => null
});

const AIAssistantModal = dynamic(() => import('@/components/ai/AIAssistantModal').then(mod => mod.AIAssistantModal).catch(() => () => null), {
  ssr: false,
  loading: () => null
});

const CommandPalette = dynamic(() => import('@/components/modals/CommandPalette').then(mod => mod.CommandPalette).catch(() => () => null), {
  ssr: false,
  loading: () => null
});

const ArchiveExplorerView = dynamic(() => import('@/components/archive/ArchiveExplorerView').then(mod => mod.ArchiveExplorerView).catch(() => () => null), {
  ssr: false,
  loading: () => null
});

const WorkingMemoryPage = dynamic(() => import('@/components/memory/WorkingMemoryPage').then(mod => mod.WorkingMemoryPage).catch(() => () => null), {
  ssr: false,
  loading: () => null
});

const ContactsSideSheet = dynamic(() => import('@/components/dashboard/ContactsSideSheet').then(mod => mod.ContactsSideSheet).catch(() => () => null), {
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
    import('@/components/WorkspaceView').catch(() => {});
    import('@/components/budget/BudgetDashboard').catch(() => {});
  }, 3500);

  // Stage 2 (+5.5s): Secondary modules (YangjaeFestivalDashboard, InventoryList)
  scheduleIdle(() => {
    import('@/components/festival/YangjaeFestivalDashboard').catch(() => {});
    import('@/components/inventory/InventoryList').catch(() => {});
  }, 5500);

  // Stage 3 (+7.5s): Simulator & Modals (BudgetSimulator, AppLogModal, CommandPalette, ContactsSideSheet)
  scheduleIdle(() => {
    import('@/components/budget/BudgetSimulator').catch(() => {});
    import('@/components/AppLogModal').catch(() => {});
    import('@/components/modals/CommandPalette').catch(() => {});
    import('@/components/dashboard/ContactsSideSheet').catch(() => {});
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
    project: false,
    festival: false,
    simulator: false,
    archive: false,
    memory: false,
  });
  const [isQuickInputOpen, setIsQuickInputOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [hasOpenedCommandPalette, setHasOpenedCommandPalette] = useState(false);
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [hasOpenedContacts, setHasOpenedContacts] = useState(false);

  // Defer TASKS, MEETINGS, PROJECTS, INVENTORY fetching on initial Dashboard load until tab switch or Ctrl+K open (latched once triggered)
  const isDeferredDataEnabled =
    activeModule !== 'dashboard' ||
    visitedModules.workspace ||
    visitedModules.festival ||
    visitedModules.simulator ||
    visitedModules.project ||
    visitedModules.archive ||
    visitedModules.memory ||
    isCommandPaletteOpen ||
    hasOpenedCommandPalette;

  // Domain Hooks
  const { tasks, stats: taskStats } = useTasks({ enabled: isDeferredDataEnabled });
  const { categories: budgetCategories, entries: budgetEntries } = useBudget();
  const { items: inventoryItems } = useInventory({ enabled: isDeferredDataEnabled });
  const { meetings } = useMeetings({ enabled: isDeferredDataEnabled });
  const { projects } = useProjects({ enabled: isDeferredDataEnabled });
  const { contacts } = useContacts({
    enabled: isCommandPaletteOpen || hasOpenedCommandPalette || isContactsOpen || hasOpenedContacts
  });

  const handleCloseCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  const handleToggleContacts = useCallback(() => {
    setHasOpenedContacts(true);
    setIsContactsOpen(prev => !prev);
  }, []);
  const handleCloseContacts = useCallback(() => setIsContactsOpen(false), []);
  const handlePreloadContacts = useCallback(() => {
    setHasOpenedContacts(true);
    import('@/components/dashboard/ContactsSideSheet').catch(() => {});
  }, []);

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
      const order: ModuleType[] = ['dashboard', 'memory', 'workspace', 'festival', 'archive'];
      const currentIndex = order.indexOf(activeModule);
      
      if (currentIndex !== -1) {
        if (distance > 0 && currentIndex < order.length - 1) {
          handleModuleChange(order[currentIndex + 1]);
        } else if (distance < 0 && currentIndex > 0) {
          handleModuleChange(order[currentIndex - 1]);
        }
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
        isContactsOpen={isContactsOpen}
        onToggleContacts={handleToggleContacts}
        onPreloadContacts={handlePreloadContacts}
      />

      <main id="main-scroll-container" className="flex-1 pb-28 sm:pb-10 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1800px] mx-auto px-2 sm:px-3 lg:px-4 flex flex-col gap-5 sm:gap-6">
          
          {/* VLDS Spacious 2-Tier Page Title Header (Aligned with PORTFOLIO ASSET spacing) */}
          <div className="flex flex-col gap-3 sm:gap-3.5 pt-7 sm:pt-9 lg:pt-11 pb-6 sm:pb-7 lg:pb-8 border-b border-slate-200/75 shrink-0">
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-tight text-slate-900 flex items-center gap-3.5">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white rounded-xl shadow-2xs border border-slate-200/85 flex items-center justify-center overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon-192x192.png" alt={`${appMode} 로고`} className="w-full h-full object-cover" />
              </div>
              <span>
                {activeModule === 'dashboard'
                  ? `${appMode} 통합 대시보드`
                  : `${appMode} ${
                      activeModule === 'workspace'
                        ? '예산관리'
                        : activeModule === 'festival'
                        ? '양재천 페스티벌'
                        : activeModule === 'simulator'
                        ? '예산 시뮬레이터'
                        : activeModule === 'project'
                        ? '사업 관리'
                        : activeModule === 'archive'
                        ? '아카이브 탐색기'
                        : activeModule === 'memory'
                        ? '작업기억 보조 보드'
                        : ''
                    }`}
              </span>
            </h1>
            <p className="vlds-subtitle text-xs sm:text-[13px] font-medium text-slate-500 leading-relaxed">
              {activeModule === 'memory'
                ? '지시 · 예산 변동 · 행감 메모 즉시 기록'
                : activeModule === 'workspace'
                  ? 'e-호조 일반지출 · 일상경비 대조 · 시뮬레이션'
                  : activeModule === 'simulator'
                    ? '집행 잔액 - 예정액 · 과목별 예상 잔액'
                    : activeModule === 'festival'
                      ? '추진과제 · 부스 현황 · 업무분장 · 행사식순'
                      : activeModule === 'archive'
                        ? '공문서 · 현장 사진 · 6대 도메인 · 주간업무'
                        : activeModule === 'project'
                          ? '단위사업 개요 · 체크리스트 · 일정 플래너'
                          : '집행 · 불용 진단 · 월별 소진 추이 · 업무 연락처'}
            </p>
          </div>

          {/* Module Content */}
          <div className="flex-1 min-h-0">
            {/* Dashboard */}
            {visitedModules.dashboard && (
              <div className={activeModule === 'dashboard' ? 'block' : 'hidden'}>
                <PortfolioDashboardView
                  tasks={tasks}
                  budgetCategories={budgetCategories}
                  budgetEntries={budgetEntries}
                  onLogout={handleLogout}
                  appMode={appMode}
                  onNavigateModule={handleModuleChange}
                />
              </div>
            )}

            {/* Workspace (Budget Management) */}
            {visitedModules.workspace && (
              <div className={activeModule === 'workspace' ? 'block' : 'hidden'}>
                <WorkspaceView />
              </div>
            )}

            {/* Project Management */}
            {visitedModules.project && (
              <div className={activeModule === 'project' ? 'block' : 'hidden'}>
                <div className="space-y-6">
                  <ProjectManagementPage />
                  <WorkingMemoryContextBanner contextModule="project" />
                </div>
              </div>
            )}

            {/* 2026 Yangjae Festival Dashboard */}
            {visitedModules.festival && (
              <div className={activeModule === 'festival' ? 'block' : 'hidden'}>
                <div className="space-y-6">
                  <YangjaeFestivalDashboard isActive={activeModule === 'festival'} />
                  <WorkingMemoryContextBanner contextModule="festival" />
                </div>
              </div>
            )}

            {/* Budget Simulator */}
            {visitedModules.simulator && (
              <div className={activeModule === 'simulator' ? 'block' : 'hidden'}>
                <div className="space-y-6">
                  <BudgetSimulator />
                  <WorkingMemoryContextBanner contextModule="simulator" />
                </div>
              </div>
            )}

            {/* Archive Explorer */}
            {visitedModules.archive && (
              <div className={activeModule === 'archive' ? 'block' : 'hidden'}>
                <ArchiveExplorerView onNavigateModule={handleModuleChange} />
              </div>
            )}

            {/* Working Memory Assistant Board Page */}
            {visitedModules.memory && (
              <div className={activeModule === 'memory' ? 'block' : 'hidden'}>
                <WorkingMemoryPage onNavigateModule={handleModuleChange} />
              </div>
            )}
          </div>

          {/* Common Footer */}
          <div id="dashboard-footer" className="mt-8 pt-8 pb-4 border-t border-slate-200/80 shrink-0">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 text-xs font-medium text-slate-400">
              <span className="font-mono tabular-nums">© 2026 {appMode} 공공행정 예산·업무 통합 관제</span>
              <span className="flex items-center gap-3">
                <span>예산·현장 실시간 동기화</span>
                <span className="text-slate-300">·</span> 
                <button onClick={handleLogout} className="text-slate-600 hover:text-slate-900 font-semibold transition-colors cursor-pointer">로그아웃</button>
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

      {isContactsOpen && (
        <ContactsSideSheet
          isOpen={isContactsOpen}
          onClose={handleCloseContacts}
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
