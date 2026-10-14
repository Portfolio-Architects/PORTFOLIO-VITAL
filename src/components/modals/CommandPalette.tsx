'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  LayoutDashboard,
  Network,
  Wallet,
  Briefcase,
  CheckSquare,
  Receipt,
  Package,
  User,
  Calendar,
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
    title: '대시보드 (Dashboard)',
    subtitle: '메인 업무 인사이트, 주간 일정 및 시그널 피드',
    icon: <LayoutDashboard className="w-4 h-4 text-emerald-400" />
  },
  {
    module: 'workspace',
    title: '예산 & 재고 관리 (Workspace)',
    subtitle: '품의 결재, 정산 내역 및 물품 수량 관리',
    icon: <Wallet className="w-4 h-4 text-blue-400" />
  },
  {
    module: 'festival',
    title: '양재천 페스티벌 (Festival)',
    subtitle: '2026 양재천 건강 페스티벌 추진 로드맵 및 부스 현황',
    icon: <Briefcase className="w-4 h-4 text-purple-400" />
  },
  {
    module: 'simulator',
    title: '예산 시뮬레이터 (Simulator)',
    subtitle: '실시간 예산 변동 시뮬레이션 및 재원 배분 분석',
    icon: <Network className="w-4 h-4 text-indigo-400" />
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
      const searchTerms = `${nav.title} ${nav.subtitle} navigation module 대시보드 예산 관리 페스티벌 시뮬레이터`;
      items.push({
        id: `nav-${nav.module}`,
        category: 'Navigation',
        categoryLabel: '모듈 바로가기',
        title: nav.title,
        subtitle: nav.subtitle,
        badge: 'Module',
        searchTerms,
        searchTermsLower: searchTerms.toLowerCase(),
        icon: nav.icon,
        onSelect: () => onSelectModule(nav.module)
      });
    }

    // 2. Tasks
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const searchTerms = `${task.title} ${task.category || ''} ${task.description || ''} ${(task.tags || []).join(' ')} ${task.status}`;
      items.push({
        id: `task-${task.id}`,
        category: 'Tasks',
        categoryLabel: '업무 (Tasks)',
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
      const searchTerms = `${entry.purpose} ${catName} ${entry.amount} ${entry.docRegNum || ''} ${entry.memo || ''}`;
      items.push({
        id: `budget-${entry.id}`,
        category: 'Budget',
        categoryLabel: '예산 (Budget)',
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
      const searchTerms = `${inv.name} ${inv.category}`;
      items.push({
        id: `inv-${inv.id}`,
        category: 'Inventory',
        categoryLabel: '재고 (Inventory)',
        title: inv.name,
        subtitle: `카테고리: ${inv.category}`,
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
      const searchTerms = `${contact.name} ${contact.phone} ${contact.email || ''} ${contact.notes || ''}`;
      items.push({
        id: `contact-${contact.id}`,
        category: 'Contacts',
        categoryLabel: '주소록 (Contacts)',
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
      const searchTerms = `${project.name} ${project.description || ''} ${project.target || ''} ${project.location || ''}`;
      items.push({
        id: `project-${project.id}`,
        category: 'Projects',
        categoryLabel: '사업 (Projects)',
        title: project.name,
        subtitle: project.description || project.target || '등록된 사업 과제',
        badge: '사업',
        searchTerms,
        searchTermsLower: searchTerms.toLowerCase(),
        icon: <Briefcase className="w-4 h-4 text-violet-400" />,
        onSelect: () => onSelectModule('dashboard')
      });
    }

    // 7. Meetings
    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];
      const searchTerms = `${meeting.title} ${meeting.location || ''} ${meeting.agenda || ''} ${(meeting.attendees || []).join(' ')}`;
      items.push({
        id: `meeting-${meeting.id}`,
        category: 'Meetings',
        categoryLabel: '회의 & 일정 (Meetings)',
        title: meeting.title,
        subtitle: `${meeting.datetime}${meeting.location ? ` · ${meeting.location}` : ''}`,
        badge: '일정',
        searchTerms,
        searchTermsLower: searchTerms.toLowerCase(),
        icon: <Calendar className="w-4 h-4 text-rose-400" />,
        onSelect: () => onSelectModule('dashboard')
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
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
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
      className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-xl flex items-start justify-center pt-12 sm:pt-20 px-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="명령어 팔레트 (Ctrl+K)"
    >
      <div
        className="w-full max-w-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-100"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-900/50">
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
            placeholder="모듈 이동, 업무, 예산, 주소록 검색... (Multi-Token Search)"
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm font-medium focus:outline-none pl-3"
          />
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded-md shadow-sm">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
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
          className="overflow-y-auto custom-scrollbar p-2 flex-1 divide-y divide-slate-800/40"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm font-medium">
              검색어와 일치하는 명령어 또는 항목이 없습니다.
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
                    <div className="px-3 pt-3 pb-1.5 text-[11px] font-bold tracking-wider uppercase text-indigo-400/90 select-none">
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
                    className={`group px-3.5 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-indigo-600/30 text-white border border-indigo-500/40 shadow-lg shadow-indigo-950/40'
                        : 'text-slate-300 hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div
                        className={`p-2 rounded-lg shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-slate-800/80 text-slate-400 border border-slate-700/50'
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
                              isSelected ? 'text-indigo-200/80' : 'text-slate-400'
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
                              ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      <ArrowRight
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${
                          isSelected
                            ? 'text-indigo-300 translate-x-0.5 opacity-100'
                            : 'text-slate-600 opacity-0 group-hover:opacity-100'
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
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-slate-800 border border-slate-700 rounded text-slate-300">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-slate-800 border border-slate-700 rounded text-slate-300">
                ↓
              </kbd>
              <span>이동</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-slate-800 border border-slate-700 rounded text-slate-300">
                ↵
              </kbd>
              <span>선택</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-slate-800 border border-slate-700 rounded text-slate-300">
                ESC
              </kbd>
              <span>닫기</span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-indigo-400/80 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span>PORTFOLIO Command Palette</span>
          </div>
        </div>
      </div>
    </div>
  );
}

CommandPaletteComponent.displayName = 'CommandPalette';
export const CommandPalette = React.memo(CommandPaletteComponent);
