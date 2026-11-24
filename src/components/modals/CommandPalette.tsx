'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  LayoutDashboard,
  Network,
  Wallet,
  Briefcase,
  FolderSearch,
  CheckSquare,
  Receipt,
  Package,
  User,
  Calendar,
  StickyNote,
  X,
  ArrowRight
} from 'lucide-react';
import { ModuleType, Task, BudgetEntry, BudgetCategory, InventoryItem, Contact, Project, Meeting } from '@/types';

export interface CommandItem {
  id: string;
  category: 'Navigation' | 'Tasks' | 'Budget' | 'Inventory' | 'Contacts' | 'Projects' | 'Meetings';
  categoryLabel: string;
  title: string;
  subtitle?: string;
  badge?: string;
  searchTerms: string;
  searchTermsLower?: string;
  onSelect: () => void;
  icon: React.ReactNode;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (module: ModuleType) => void;
  tasks?: Task[];
  budgetEntries?: BudgetEntry[];
  budgetCategories?: BudgetCategory[];
  inventoryItems?: InventoryItem[];
  contacts?: Contact[];
  projects?: Project[];
  meetings?: Meeting[];
}

const STATIC_NAV_ITEMS: { module: ModuleType; title: string; subtitle: string; icon: React.ReactNode }[] = [
  {
    module: 'dashboard',
    title: '대시보드',
    subtitle: '집행 현황 · 월별 추이',
    icon: <LayoutDashboard className="w-4 h-4 text-emerald-400" />
  },
  {
    module: 'memory',
    title: '포스트잇',
    subtitle: '빠른 업무 메모',
    icon: <StickyNote className="w-4 h-4 text-amber-500" />
  },
  {
    module: 'workspace',
    title: '예산관리',
    subtitle: '실집행 · 일상경비 · 예정',
    icon: <Wallet className="w-4 h-4 text-blue-400" />
  },
  {
    module: 'project',
    title: '사업 · 일정 관리',
    subtitle: '사업 개요 · 체크리스트 · 일정',
    icon: <Calendar className="w-4 h-4 text-teal-600" />
  },
  {
    module: 'festival',
    title: '양재천 페스티벌',
    subtitle: '체크리스트 · 부스 · 분장 · 식순',
    icon: <Briefcase className="w-4 h-4 text-purple-600" />
  },
  {
    module: 'archive',
    title: '문서 보관함',
    subtitle: '공문서 · 사진 · 주간업무',
    icon: <FolderSearch className="w-4 h-4 text-sky-600" />
  },
  {
    module: 'simulator',
    title: '예산 시뮬레이터',
    subtitle: '집행 잔액 - 예정액 · 과목별 예상 잔액',
    icon: <Network className="w-4 h-4 text-indigo-600" />
  }
];

function CommandPaletteComponent({
  isOpen,
  onClose,
  onSelectModule,
  tasks = [],
  budgetEntries = [],
  budgetCategories = [],
  inventoryItems = [],
  contacts = [],
  projects = [],
  meetings = [],
}: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Handle focus, reset state, and body scroll lock when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => {
        setSearchQuery('');
        setSelectedIndex(0);
        inputRef.current?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  // Aggregate all searchable items (short-circuit when modal is closed)
  const allItems = useMemo<CommandItem[]>(() => {
    if (!isOpen) return [];
    const items: CommandItem[] = [];

    // 1. Navigation items
    for (let i = 0; i < STATIC_NAV_ITEMS.length; i++) {
      const nav = STATIC_NAV_ITEMS[i];
      const searchTerms = `${nav.title} ${nav.subtitle} ${nav.module} module dashboard memory workspace project festival archive simulator working memory 대시보드 예산 관리 사업 일정 페스티벌 시뮬레이터 아카이브 작업기억`;
      items.push({
        id: `nav-${nav.module}`,
        category: 'Navigation',
        categoryLabel: '모듈 바로가기',
        title: nav.title,
        subtitle: nav.subtitle,
        badge: '모듈',
        searchTerms,
        searchTermsLower: searchTerms.toLowerCase(),
        icon: nav.icon,
        onSelect: () => onSelectModule(nav.module)
      });
    }

    // 2. Tasks
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const searchTerms = `${task.title} ${task.category || ''} ${task.description || ''} ${(task.tags || []).join(' ')} ${task.status} tasks`;
      items.push({
        id: `task-${task.id}`,
        category: 'Tasks',
        categoryLabel: '업무',
        title: task.title,
        subtitle: `${task.category}${task.dueDate ? ` · 마감: ${task.dueDate}` : ''}${task.description ? ` · ${task.description}` : ''}`,
        badge: task.status === 'done' ? '완료' : task.status === 'in-progress' ? '진행중' : '대기',
        searchTerms,
        searchTermsLower: searchTerms.toLowerCase(),
        icon: <CheckSquare className="w-4 h-4 text-amber-400" />,
        onSelect: () => onSelectModule('dashboard')
      });
    }

    // 3. Budget Items
    const catMap = new Map<string, string>();
    for (let i = 0; i < budgetCategories.length; i++) {
      catMap.set(budgetCategories[i].id, budgetCategories[i].name);
    }
    for (let i = 0; i < budgetEntries.length; i++) {
      const entry = budgetEntries[i];
      const catName = catMap.get(entry.categoryId) || '기타예산';
      const searchTerms = `${entry.purpose} ${catName} ${entry.amount} ${entry.docRegNum || ''} ${entry.memo || ''} budget`;
      items.push({
        id: `budget-${entry.id}`,
        category: 'Budget',
        categoryLabel: '예산',
        title: entry.purpose,
        subtitle: `${catName} · ${entry.amount.toLocaleString()}원${entry.docRegNum ? ` · ${entry.docRegNum}` : ''}`,
        badge: entry.isPlanned ? '품의 예정' : '지출 완료',
        searchTerms,
        searchTermsLower: searchTerms.toLowerCase(),
        icon: <Receipt className="w-4 h-4 text-emerald-400" />,
        onSelect: () => onSelectModule('workspace')
      });
    }

    // 4. Inventory Items
    for (let i = 0; i < inventoryItems.length; i++) {
      const inv = inventoryItems[i];
      const searchTerms = `${inv.name} ${inv.category} inventory`;
      items.push({
        id: `inv-${inv.id}`,
        category: 'Inventory',
        categoryLabel: '재고',
        title: inv.name,
        subtitle: `분류: ${inv.category}`,
        badge: `${inv.currentStock} ${inv.unit}`,
        searchTerms,
        searchTermsLower: searchTerms.toLowerCase(),
        icon: <Package className="w-4 h-4 text-cyan-400" />,
        onSelect: () => onSelectModule('workspace')
      });
    }

    // 5. Contacts
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const searchTerms = `${contact.name} ${contact.phone} ${contact.email || ''} ${contact.notes || ''} contacts`;
      items.push({
        id: `contact-${contact.id}`,
        category: 'Contacts',
        categoryLabel: '연락처',
        title: contact.name,
        subtitle: `${contact.phone}${contact.email ? ` · ${contact.email}` : ''}${contact.notes ? ` · ${contact.notes}` : ''}`,
        badge: '연락처',
        searchTerms,
        searchTermsLower: searchTerms.toLowerCase(),
        icon: <User className="w-4 h-4 text-pink-400" />,
        onSelect: () => onSelectModule('dashboard')
      });
    }

    // 6. Projects
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const searchTerms = `${project.name} ${project.description || ''} ${project.target || ''} ${project.location || ''} projects`;
      items.push({
        id: `project-${project.id}`,
        category: 'Projects',
        categoryLabel: '사업',
        title: project.name,
        subtitle: project.description || project.target || '단위사업',
        badge: '사업',
        searchTerms,
        searchTermsLower: searchTerms.toLowerCase(),
        icon: <Briefcase className="w-4 h-4 text-violet-400" />,
        onSelect: () => onSelectModule('project')
      });
    }

    // 7. Meetings
    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];
      const searchTerms = `${meeting.title} ${meeting.location || ''} ${meeting.agenda || ''} ${(meeting.attendees || []).join(' ')} meetings`;
      items.push({
        id: `meeting-${meeting.id}`,
        category: 'Meetings',
        categoryLabel: '회의 · 일정',
        title: meeting.title,
        subtitle: `${meeting.datetime}${meeting.location ? ` · ${meeting.location}` : ''}`,
        badge: '일정',
        searchTerms,
        searchTermsLower: searchTerms.toLowerCase(),
        icon: <Calendar className="w-4 h-4 text-rose-400" />,
        onSelect: () => onSelectModule('project')
      });
    }

    return items;
  }, [isOpen, onSelectModule, tasks, budgetEntries, budgetCategories, inventoryItems, contacts, projects, meetings]);

  // Instant multi-token search filtering (Single-pass index loop with early-break)
  const filteredItems = useMemo(() => {
    if (allItems.length === 0) return allItems;
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return allItems;
    }
    const tokens = query.split(/\s+/).filter(Boolean);
    const list: CommandItem[] = [];

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const text = item.searchTermsLower || item.searchTerms.toLowerCase();
      let match = true;
      for (let j = 0; j < tokens.length; j++) {
        if (!text.includes(tokens[j])) {
          match = false;
          break;
        }
      }
      if (match) {
        list.push(item);
      }
    }

    return list;
  }, [searchQuery, allItems]);

  // Handle selected item activation
  const handleActivateItem = useCallback((item: CommandItem) => {
    item.onSelect();
    onClose();
  }, [onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  // Keyboard navigation inside input / dialog
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleActivateItem(filteredItems[selectedIndex]);
      }
    }
  }, [filteredItems, selectedIndex, handleActivateItem, onClose]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setSelectedIndex(0);
  }, []);

  if (!isOpen) return null;

  // Group filtered items by category label for rendering
  let currentGroup = '';

  return (
    <div
      className="fixed inset-0 z-[200] modal-backdrop flex items-start justify-center pt-12 sm:pt-20 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="명령어 팔레트 (Ctrl+K)"
    >
      <div
        className="w-full max-w-2xl bg-white border border-slate-200/95 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] text-slate-900"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200/85 bg-slate-50/60">
          <Search className="w-5 h-5 text-slate-400 shrink-0 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-autocomplete="list"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="모듈 · 업무 · 예산 · 연락처 검색"
            className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none pl-3"
          />
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-500 bg-white border border-slate-200 rounded-md shadow-2xs">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Command Results List */}
        <div
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          className="overflow-y-auto custom-scrollbar p-2 flex-1 divide-y divide-slate-100"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm font-medium">
              일치 항목 없음
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const showCategoryHeader = item.categoryLabel !== currentGroup;
              if (showCategoryHeader) {
                currentGroup = item.categoryLabel;
              }

              return (
                <React.Fragment key={item.id}>
                  {showCategoryHeader && (
                    <div className="px-3 pt-3 pb-1.5 text-[11px] font-bold tracking-wider uppercase text-indigo-600 select-none">
                      {item.categoryLabel}
                    </div>
                  )}
                  <div
                    ref={el => {
                      itemRefs.current[index] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleActivateItem(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`group px-3.5 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/90 text-slate-900 border border-indigo-200'
                        : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div
                        className={`p-2 rounded-lg shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-white text-indigo-600 border border-indigo-200 shadow-2xs'
                            : 'bg-slate-100/90 text-slate-500 border border-slate-200/80'
                        }`}
                      >
                        {item.icon}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate leading-tight">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span
                            className={`text-xs truncate leading-tight mt-0.5 ${
                              isSelected ? 'text-indigo-700/80' : 'text-slate-500'
                            }`}
                          >
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors ${
                            isSelected
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200/80'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      <ArrowRight
                        className={`w-3.5 h-3.5 transition-transform duration-100 ${
                          isSelected
                            ? 'text-indigo-600 translate-x-0.5 opacity-100'
                            : 'text-slate-400 opacity-0 group-hover:opacity-100'
                        }`}
                      />
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/90 border-t border-slate-200/85 text-[11px] text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-white border border-slate-200 rounded text-slate-700">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-white border border-slate-200 rounded text-slate-700">
                ↓
              </kbd>
              <span>이동</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-white border border-slate-200 rounded text-slate-700">
                ↵
              </kbd>
              <span>선택</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-white border border-slate-200 rounded text-slate-700">
                ESC
              </kbd>
              <span>닫기</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            <span>VITAL Command Palette</span>
          </div>
        </div>
      </div>
    </div>
  );
}

CommandPaletteComponent.displayName = 'CommandPalette';
export const CommandPalette = React.memo(CommandPaletteComponent);
