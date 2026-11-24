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
import { useWorkingMemory } from '@/hooks/useWorkingMemory';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/Sidebar';
import { VitalLogo } from '@/components/ui/VitalLogo';
import { syncTombstones } from '@/lib/sheets-api';
import YangjaeFestivalSkeleton from '@/components/skeletons/YangjaeFestivalSkeleton';
import { PortfolioDashboardViewSkeleton } from '@/components/skeletons/PortfolioDashboardViewSkeleton';
import { PortfolioDashboardView as DirectPortfolioDashboardView } from '@/components/dashboard/PortfolioDashboardView';

export { PortfolioDashboardViewSkeleton };

function WorkspaceViewSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6 animate-pulse">
      <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
        <div className="w-40 h-7 bg-slate-200/80 rounded-md" />
        <div className="w-28 h-9 bg-slate-100 border border-slate-200/80 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-slate-200/60 rounded-xl" />
        ))}
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

const StickyNotesPanel = dynamic(() => import('@/components/memory/StickyNotesPanel').then(mod => mod.StickyNotesPanel).catch(() => () => null), {
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
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState<'budget' | 'simulator'>('budget');
  const [workspaceFocusSeq, setWorkspaceFocusSeq] = useState(0);
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
  const [isStickyNotesOpen, setIsStickyNotesOpen] = useState(false);

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
  const { pendingMemos } = useWorkingMemory({ autoFetch: true });

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

  const handleToggleStickyNotes = useCallback(() => {
    setIsStickyNotesOpen(prev => !prev);
  }, []);
  const handleCloseStickyNotes = useCallback(() => setIsStickyNotesOpen(false), []);
  const handlePreloadStickyNotes = useCallback(() => {
    import('@/components/memory/StickyNotesPanel').catch(() => {});
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
      } else if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsStickyNotesOpen(prev => !prev);
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
    if (module === 'memory') {
      setIsStickyNotesOpen(true);
      return;
    }
    startTabTransition(() => {
      if (module === 'simulator') {
        setWorkspaceInitialTab('simulator');
        setWorkspaceFocusSeq(prev => prev + 1);
        setActiveModule('workspace');
        setVisitedModules(prev => prev.workspace ? prev : { ...prev, workspace: true });
        localStorage.setItem('hchps_active_module', 'workspace');
        return;
      }
      if (module === 'workspace') {
        setWorkspaceInitialTab('budget');
        setWorkspaceFocusSeq(prev => prev + 1);
      }
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
      const order: ModuleType[] = ['dashboard', 'workspace', 'festival', 'archive'];
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
        isStickyNotesOpen={isStickyNotesOpen}
        stickyNotesCount={pendingMemos.length}
        onToggleStickyNotes={handleToggleStickyNotes}
        onPreloadStickyNotes={handlePreloadStickyNotes}
      />

      <main id="main-scroll-container" className="flex-1 pb-28 sm:pb-12 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-[2400px] mx-auto px-4 sm:px-8 xl:px-12 2xl:px-16 flex flex-col gap-4 sm:gap-5">
          
          {/* VLDS Compact Page Title Header (Aligned with Portfolio Asset Rhythm) */}
          <div className="flex flex-col gap-2 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b border-slate-200/75 shrink-0">
            <div className="flex items-center gap-3 sm:min-h-[36px] min-w-0">
              <VitalLogo
                className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900 shrink-0"
                title={appMode === 'VITAL' ? 'WORK VITAL 로고' : `${appMode} 로고`}
              />
              <h1 className="text-xl sm:text-2xl lg:text-[26px] leading-none font-extrabold tracking-[-0.02em] text-slate-900 shrink-0">
                {appMode === 'VITAL'
                  ? 'WORK VITAL'
                  : activeModule === 'dashboard'
                  ? `${appMode} 대시보드`
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
                        ? '문서 보관함'
                        : activeModule === 'memory'
                        ? '포스트잇'
                        : ''
                    }`}
              </h1>
              {appMode === 'VITAL' && activeModule !== 'dashboard' && (
                <>
                  <span className="h-4 sm:h-5 w-px bg-slate-200 shrink-0" aria-hidden="true" />
                  <span className="text-sm sm:text-base font-bold text-slate-500 tracking-tight truncate">
                    {activeModule === 'workspace'
                      ? '예산관리'
                      : activeModule === 'festival'
                      ? '양재천 페스티벌'
                      : activeModule === 'simulator'
                      ? '예산 시뮬레이터'
                      : activeModule === 'project'
                      ? '사업 관리'
                      : activeModule === 'archive'
                      ? '문서 보관함'
                      : activeModule === 'memory'
                      ? '포스트잇'
                      : ''}
                  </span>
                </>
              )}
            </div>
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

            {/* Workspace (Unified Budget Control Board) */}
            {visitedModules.workspace && (
              <div className={activeModule === 'workspace' ? 'block' : 'hidden'}>
                <WorkspaceView initialTab={workspaceInitialTab} focusSeq={workspaceFocusSeq} />
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

            {/* Archive Explorer */}
            {visitedModules.archive && (
              <div className={activeModule === 'archive' ? 'block' : 'hidden'}>
                <ArchiveExplorerView onNavigateModule={handleModuleChange} />
              </div>
            )}
          </div>

          {/* Common Footer */}
          <div id="dashboard-footer" className="mt-8 pt-8 pb-4 border-t border-slate-200/80 shrink-0">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-400">
              <span className="font-mono tabular-nums">© 2026 {appMode === 'VITAL' ? 'WORK VITAL' : appMode}</span>
              <span className="flex items-center gap-3">
                <span>실시간 동기화</span>
                <span className="text-slate-300">·</span> 
                <button onClick={handleLogout} className="text-slate-600 hover:text-slate-900 font-semibold transition-colors cursor-pointer">로그아웃</button>
              </span>
            </div>
          </div>
        </div>
      </main>

      {isStickyNotesOpen && (
        <StickyNotesPanel
          isOpen={isStickyNotesOpen}
          onClose={handleCloseStickyNotes}
        />
      )}

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
