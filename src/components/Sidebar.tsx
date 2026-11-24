'use client';

import React from 'react';
import { ModuleType } from '@/types';
import { Archive, BookOpen, LayoutDashboard, Sparkles, FolderSearch, StickyNote } from 'lucide-react';
import { SegmentedTabs, SegmentedTabItem } from '@/components/ui/segmented-tabs';

interface TopNavProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  taskStats: { total: number; done: number; overdue: number };
  appMode: 'HCHPS' | 'VITAL';
  onModeChange: (mode: 'HCHPS' | 'VITAL') => void;
  onPreloadModule?: (module: ModuleType) => void;
  onOpenLogs?: () => void;
  isContactsOpen?: boolean;
  onToggleContacts?: () => void;
  onPreloadContacts?: () => void;
  isStickyNotesOpen?: boolean;
  stickyNotesCount?: number;
  onToggleStickyNotes?: () => void;
  onPreloadStickyNotes?: () => void;
}

const navItems: ReadonlyArray<SegmentedTabItem<ModuleType>> = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'workspace', label: '예산관리', icon: Archive },
  { id: 'festival', label: '양재천 페스티벌', icon: Sparkles },
  { id: 'archive', label: '문서 보관함', icon: FolderSearch },
];

const desktopNavItems: ReadonlyArray<SegmentedTabItem<ModuleType>> = navItems.map(({ id, label }) => ({
  id,
  label,
}));

const NAV_ITEM_LABEL_MAP = new Map<ModuleType, string>(navItems.map((i) => [i.id, i.label]));

function SidebarComponent({
  activeModule,
  onModuleChange,
  onPreloadModule,
  isContactsOpen = false,
  onToggleContacts,
  onPreloadContacts,
  isStickyNotesOpen = false,
  stickyNotesCount = 0,
  onToggleStickyNotes,
  onPreloadStickyNotes,
}: TopNavProps) {
  const activeLabel = NAV_ITEM_LABEL_MAP.get(activeModule) || '';

  return (
    <>
      <header className="sticky top-0 left-0 right-0 z-50 pointer-events-auto bg-white/[0.98] border-b border-slate-200/85">
        <div className="w-full max-w-[2400px] mx-auto px-4 sm:px-8 xl:px-12 2xl:px-16">
          <div className="flex items-center justify-between h-[56px] gap-3">
            {/* Left side: Navigation Items */}
            <div className="flex items-center gap-3">
              {/* Mobile Header Title */}
              <div className="flex sm:hidden items-center pt-0.5 px-1">
                <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                  {activeLabel}
                </h1>
              </div>

              {/* Desktop Navigation Items (VLDS SegmentedTabs Primitive — Text-Only) */}
              <div className="hidden sm:block shrink-0">
                <SegmentedTabs
                  items={desktopNavItems}
                  activeId={activeModule}
                  onChange={onModuleChange}
                  onPreload={onPreloadModule}
                  size="md"
                />
              </div>
            </div>

            {/* Right side: Sticky Notes Toggle & Business Contacts Side Sheet */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="header-sticky-notes-toggle"
                onClick={() => onToggleStickyNotes?.()}
                onMouseEnter={() => onPreloadStickyNotes?.()}
                onFocus={() => onPreloadStickyNotes?.()}
                aria-expanded={isStickyNotesOpen}
                aria-controls="sticky-notes-sheet"
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold border whitespace-nowrap transition-colors cursor-pointer ${
                  isStickyNotesOpen
                    ? 'bg-amber-100 text-amber-950 border-amber-300 shadow-2xs'
                    : 'bg-amber-50/80 hover:bg-amber-100/80 text-amber-900 border-amber-200/80'
                }`}
                title="포스트잇 (Alt+N)"
              >
                <StickyNote
                  className={`w-4 h-4 shrink-0 ${isStickyNotesOpen ? 'text-amber-700' : 'text-amber-600'}`}
                  strokeWidth={isStickyNotesOpen ? 2.1 : 1.8}
                />
                <span>포스트잇</span>
                {stickyNotesCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-md text-[11px] font-extrabold font-mono tabular-nums bg-amber-200/80 text-amber-950">
                    {stickyNotesCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onToggleContacts?.()}
                onMouseEnter={() => onPreloadContacts?.()}
                onFocus={() => onPreloadContacts?.()}
                aria-expanded={isContactsOpen}
                aria-controls="contacts-side-sheet"
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold border whitespace-nowrap transition-colors cursor-pointer ${
                  isContactsOpen
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 hover:text-slate-900 border-slate-200/80'
                }`}
                title="업무 연락처"
              >
                <BookOpen
                  className={`w-4 h-4 shrink-0 ${isContactsOpen ? 'text-white' : 'text-slate-500'}`}
                  strokeWidth={isContactsOpen ? 2.0 : 1.75}
                />
                <span>업무 연락처</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Floating Dock (Zero-Blur High-Contrast Surface) */}
      <div className="sm:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[320px]">
        <nav className="flex items-center justify-around p-1.5 bg-white/[0.98] border border-slate-200/95 shadow-lg rounded-2xl">
          {navItems.map((item) => {
            const Icon = item.icon!;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onModuleChange(item.id)}
                onTouchStart={() => onPreloadModule?.(item.id)}
                className={`relative flex flex-col items-center justify-center w-13 h-13 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/90'
                }`}
                aria-label={item.label}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.0 : 1.75} />
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
