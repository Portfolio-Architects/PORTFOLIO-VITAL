'use client';

import React from 'react';
import { ModuleType } from '@/types';
import { Archive, LayoutDashboard, Sparkles } from 'lucide-react';

import { LocalhostStatusHUD } from '@/components/layout/LocalhostStatusHUD';

interface TopNavProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  taskStats: { total: number; done: number; overdue: number };
  appMode: 'HCHPS' | 'VITAL';
  onModeChange: (mode: 'HCHPS' | 'VITAL') => void;
  onPreloadModule?: (module: ModuleType) => void;
  onOpenLogs?: () => void;
}

const navItems: { id: ModuleType; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'workspace', label: '예산관리', icon: Archive },
  { id: 'festival', label: '양재천 페스티벌', icon: Sparkles },
];

const NAV_ITEM_LABEL_MAP = new Map<ModuleType, string>(navItems.map(i => [i.id, i.label]));

function SidebarComponent({ activeModule, onModuleChange, onPreloadModule, onOpenLogs }: TopNavProps) {
  const activeLabel = NAV_ITEM_LABEL_MAP.get(activeModule) || '';

  return (
    <>
      <header className="sticky top-0 left-0 right-0 z-50 pointer-events-auto bg-white/95 backdrop-blur-xs border-b border-slate-200/80 transition-colors">
        <div className="max-w-[1800px] mx-auto px-2 sm:px-3 lg:px-4">
          <div className="flex items-center justify-between h-14 gap-3">
            
            {/* Left side: Navigation Items */}
            <div className="flex items-center gap-3">
              {/* Mobile Header Title */}
              <div className="flex sm:hidden items-center px-1">
                <h1 className="text-base font-bold tracking-tight text-slate-900">
                  {activeLabel}
                </h1>
              </div>

              {/* Desktop Navigation Items */}
              <nav className="hidden sm:inline-flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 shrink-0 gap-1">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onModuleChange(item.id)}
                      onMouseEnter={() => onPreloadModule?.(item.id)}
                      onFocus={() => onPreloadModule?.(item.id)}
                      className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all relative ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                      }`}
                      title={item.label}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-900' : 'text-slate-500'}`} strokeWidth={isActive ? 2.0 : 1.75} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Right side: Localhost Health & Daemon Status HUD */}
            <div className="flex items-center gap-2 pr-1">
              <LocalhostStatusHUD onOpenLogs={onOpenLogs} />
            </div>

          </div>
        </div>
      </header>

      {/* Mobile Floating Dock */}
      <div className="sm:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[300px] transition-all duration-200">
        <nav className="flex items-center justify-around p-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-lg rounded-2xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onModuleChange(item.id)}
                onTouchStart={() => onPreloadModule?.(item.id)}
                className={`relative flex flex-col items-center justify-center w-12 h-11 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
                aria-label={item.label}
              >
                <Icon 
                  className="w-4.5 h-4.5" 
                  strokeWidth={isActive ? 2.0 : 1.75} 
                />
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

export const Sidebar = React.memo(SidebarComponent);
Sidebar.displayName = 'Sidebar';

