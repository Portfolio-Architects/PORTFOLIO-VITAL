'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
 StickyNote,
 FolderOpen,
 Columns3,
 Search,
 X,
 Plus,
 Pin,
 CheckCircle2,
 RotateCcw,
 Trash2,
 ExternalLink,
 FileText,
 FileSpreadsheet,
 Image as ImageIcon,
 Calendar,
 ArrowRight,
 TrendingUp,
 Tag,
 Smartphone,
 Monitor,
} from 'lucide-react';
import type { ModuleType, WorkingMemoryCategory, WorkingMemoryMemo } from '@/types';
import type { ArchiveItem } from '@/types/archive';
import { useWorkingMemory } from '@/hooks/useWorkingMemory';
import { useArchiveExplorer } from '@/hooks/useArchiveExplorer';
import { SectionHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SegmentedTabs, SegmentedTabItem } from '@/components/ui/segmented-tabs';
import { WORKING_MEMORY_CATEGORIES } from '@/lib/working-memory-parser';

export interface IntegratedShowcaseSectionProps {
 onNavigateModule?: (module: ModuleType) => void;
 className?: string;
 defaultView?: 'split' | 'memory' | 'archive';
}

type ShowcaseTab = 'memory' | 'archive' | 'split';

const QUICK_SNIPPETS: Array<{ label: string; text: string; category?: WorkingMemoryCategory }> = [
  { label: '+ 팀장님 지시', text: '팀장님 지시: ', category: 'directive' },
  { label: '+ 2027 예산 가내시', text: '가내시 메모보고: 2027 본예산 ', category: 'budget' },
  { label: '+ 행정감사 자료', text: '행정감사 요구자료: ', category: 'audit' },
  { label: '+ 양재천 행사', text: '양재천 페스티벌: ', category: 'festival' },
  { label: '+ 이슈로그', text: '[이슈로그] RP: | 근접: | 근본: | 개선: ', category: 'issue_log' },
  { label: '+ 수치변동 (→)', text: ' → ' },
];

const ARCHIVE_QUICK_QUERIES = [
  '양재천 페스티벌',
  '수의계약',
  '방침서',
  '사업설명서',
  '주간업무보고',
];

const CATEGORY_TARGET_MODULE: Partial<Record<WorkingMemoryCategory, ModuleType>> = {
 budget: 'workspace',
 directive: 'project',
 audit: 'workspace',
 festival: 'festival',
};

function formatFileSize(bytes?: number): string {
 if (!bytes || bytes <= 0) return '0 B';
 const units = ['B', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(1024));
 return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatProjectName(project?: string): string {
 if (!project || project === 'ALL') return '전체 사업';
 const map: Record<string, string> = {
 YANGJAE_FESTIVAL: '양재천 페스티벌',
 HEALTH_CHECKUP: '서울체력장',
 DONG_SPORTS: '동대항 생활체육대회',
 PARK_GOLF: '파크골프장 조성',
 FITNESS_CENTER: '체력인증센터 운영',
  };
 return map[project] || project;
}

function getArchiveIcon(item: ArchiveItem) {
 if (item.category === 'sheet' || item.ext === 'xlsx' || item.ext === 'xls' || item.ext === 'csv') {
 return FileSpreadsheet;
  }
 if (item.category === 'image' || item.ext === 'png' || item.ext === 'jpg' || item.ext === 'jpeg') {
 return ImageIcon;
  }
 return FileText;
}

export function IntegratedShowcaseSection({
 onNavigateModule,
 className = '',
 defaultView = 'split',
}: IntegratedShowcaseSectionProps) {
 const [activeTab, setActiveTab] = useState<ShowcaseTab>(defaultView);

  // ============ Working Memory State & SSOT ============
 const {
 memos,
 pendingMemos,
 reflectedMemos,
 addMemo,
 markReflected,
 reopenMemo,
 togglePin,
 deleteMemo,
  } = useWorkingMemory({ contextModule: 'dashboard' });

 const [memoryInput, setMemoryInput] = useState('');
 const [memoryCategory, setMemoryCategory] = useState<'all' | WorkingMemoryCategory>('all');
 const [memoryFilterCategory, setMemoryFilterCategory] = useState<'all' | WorkingMemoryCategory>('all');
 const [memoryStatusTab, setMemoryStatusTab] = useState<'pending' | 'reflected'>('pending');

 const handleAddMemoSubmit = useCallback(
 async (e: React.FormEvent) => {
 e.preventDefault();
 const trimmed = memoryInput.trim();
 if (!trimmed) return;
 await addMemo(
 trimmed,
 memoryCategory !== 'all' ? memoryCategory : undefined
      );
 setMemoryInput('');
    },
 [memoryInput, memoryCategory, addMemo]
  );

 const handleInsertSnippet = useCallback(
    (snippet: typeof QUICK_SNIPPETS[number]) => {
 setMemoryInput((prev) => (prev ? `${prev} ${snippet.text}` : snippet.text));
 if (snippet.category) {
 setMemoryCategory(snippet.category);
      }
    },
 []
  );

 const displayedMemos = useMemo(() => {
 const list = memoryStatusTab === 'pending' ? pendingMemos : reflectedMemos;
 if (memoryFilterCategory === 'all') return list;
 return list.filter((m) => m.category === memoryFilterCategory);
  }, [memoryStatusTab, pendingMemos, reflectedMemos, memoryFilterCategory]);

  // ============ Archive Explorer State & SSOT ============
 const {
 query,
 setQuery,
 year,
 setYear,
 category,
 setCategory,
 data,
 loading: archiveLoading,
 actionToast,
 openArchiveTarget,
  } = useArchiveExplorer({ initialYear: '2026년' });

 const totalIndexedCount = data?.totalIndexed ?? 422;
 const totalMatchedCount = data?.totalMatched ?? 0;

  // ============ SegmentedTabs Configuration ============
 const tabItems: ReadonlyArray<SegmentedTabItem<ShowcaseTab>> = useMemo(
    () => [
      {
 id: 'memory',
 label: '업무 메모',
 icon: StickyNote,
 badgeCount: pendingMemos.length,
      },
      {
 id: 'archive',
 label: '문서 보관함',
 icon: FolderOpen,
 badgeCount: totalMatchedCount || totalIndexedCount,
      },
      {
 id: 'split',
 label: '분할 뷰',
 icon: Columns3,
      },
 ],
 [pendingMemos.length, totalMatchedCount, totalIndexedCount]
  );

 return (
    <section
 data-testid="integrated-showcase-section"
 aria-label="행정 게시판"
 className={`w-full max-w-full overflow-hidden bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 mt-6 text-slate-900 ${className}`}
    >
      {/* Action Toast Feedback */}
      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-md border border-slate-700 text-xs sm:text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* Showcase Section Header */}
      <SectionHeader
 title="행정 게시판"
 badge={
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="warning">미반영 {pendingMemos.length}건</Badge>
            <Badge variant="default">색인 {totalIndexedCount}건</Badge>
          </div>
        }
 actions={
          <SegmentedTabs<ShowcaseTab>
 items={tabItems}
 activeId={activeTab}
 onChange={setActiveTab}
 size="sm"
          />
        }
 className="mb-5"
      />

      {/* ========================================================================= */}
      {/* TAB 1: 작업기억 보드 전체 패널 */}
      {/* ========================================================================= */}
      {activeTab === 'memory' && (
        <div className="space-y-5">
          {/* Quick Memo Input Bar */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 mr-1">빠른 삽입:</span>
              {QUICK_SNIPPETS.map((snippet) => (
                <button
 key={snippet.label}
 type="button"
 onClick={() => handleInsertSnippet(snippet)}
 className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  {snippet.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddMemoSubmit} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <input
 type="text"
 value={memoryInput}
 onChange={(e) => setMemoryInput(e.target.value)}
 placeholder="작업기억 메모 입력 (예: 팀장님 지시: 2027 본예산 인건비 산출내역 검토)"
 className="w-full px-3.5 py-2 text-xs sm:text-sm font-semibold bg-white text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
 value={memoryCategory}
 onChange={(e) => setMemoryCategory(e.target.value as 'all' | WorkingMemoryCategory)}
 aria-label="메모 카테고리 선택"
 className="px-3 py-2 text-xs font-semibold bg-white text-slate-700 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15 cursor-pointer"
                >
                  <option value="all">카테고리 자동</option>
                  <option value="budget">2027 예산편성</option>
                  <option value="directive">팀장님 지시</option>
                  <option value="audit">행정감사</option>
                  <option value="festival">양재천 행사</option>
                  <option value="issue_log">이슈로그</option>
                  <option value="general">일반 메모</option>
                </select>
                <Button type="submit" variant="primary" size="sm" className="gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>메모 등록</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Category Filter & Status Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Category Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {(
 [
                  { id: 'all', label: `전체 (${memoryStatusTab === 'pending' ? pendingMemos.length : reflectedMemos.length})` },
                  { id: 'budget', label: '2027 예산' },
                  { id: 'directive', label: '지시' },
                  { id: 'audit', label: '감사' },
                  { id: 'festival', label: '축제' },
                  { id: 'issue_log', label: '이슈로그' },
                  { id: 'general', label: '일반' },
 ] as const
              ).map((tab) => {
 const isSelected = memoryFilterCategory === tab.id;
 return (
                  <button
 key={tab.id}
 type="button"
 onClick={() => setMemoryFilterCategory(tab.id as 'all' | WorkingMemoryCategory)}
 className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
 isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 border-slate-200/70'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Status Switcher (Pending / Reflected) */}
            <div className="flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200/80 shrink-0">
              <button
 type="button"
 onClick={() => setMemoryStatusTab('pending')}
 className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
 memoryStatusTab === 'pending'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                미반영 ({pendingMemos.length})
              </button>
              <button
 type="button"
 onClick={() => setMemoryStatusTab('reflected')}
 className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
 memoryStatusTab === 'reflected'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                반영 완료 ({reflectedMemos.length})
              </button>
            </div>
          </div>

          {/* Memo Cards Grid */}
          {displayedMemos.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <StickyNote className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold">등록 메모 없음</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {displayedMemos.map((memo) => {
 const catMeta =
 WORKING_MEMORY_CATEGORIES[memo.category] || WORKING_MEMORY_CATEGORIES.general;
 const targetModule = CATEGORY_TARGET_MODULE[memo.category];

 return (
                  <article
 key={memo.id}
 data-testid={`showcase-memory-card-${memo.id}`}
 className={`rounded-xl p-4 border transition-colors flex flex-col justify-between gap-3 ${catMeta.postItClass}`}
                  >
                    <div className="space-y-2">
                      {/* Card Meta Badges */}
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${catMeta.badgeClass}`}>
                            {catMeta.label}
                          </span>
                          {memo.dateHighlight && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-white/90 text-slate-700 border border-slate-200/80 font-mono tabular-nums">
                              <Calendar className="w-3 h-3" />
                              {memo.dateHighlight}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {memo.pinned && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500 text-white shadow-2xs">
                              고정
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/80 text-slate-500 border border-slate-200/60">
                            {memo.source === 'mobile' ? (
                              <Smartphone className="w-2.5 h-2.5 text-slate-700" />
                            ) : (
                              <Monitor className="w-2.5 h-2.5 text-slate-400" />
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Numeric Highlight */}
                      {memo.numericHighlight && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-200/80 border border-amber-400/80 text-amber-950 text-xs font-black font-mono tabular-nums">
                          <span>변동 수치:</span>
                          <span>{memo.numericHighlight}</span>
                        </div>
                      )}

                      {/* Memo Content */}
                      <p className="text-xs font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                        {memo.content}
                      </p>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-2 border-t border-slate-900/10 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <button
 type="button"
 onClick={() => togglePin(memo.id)}
 className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
 memo.pinned
                              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-white/60'
                          }`}
 title={memo.pinned ? '고정 해제' : '상단 고정'}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
 type="button"
 onClick={() => deleteMemo(memo.id)}
 className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-white/60 transition-colors cursor-pointer"
 title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {targetModule && onNavigateModule && (
                          <button
 type="button"
 onClick={() => onNavigateModule(targetModule)}
 className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-semibold bg-white/90 hover:bg-white text-slate-700 border border-slate-200/90 shadow-2xs transition-colors cursor-pointer"
                          >
                            <span>연계 이동</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                        {memo.status === 'pending' ? (
                          <button
 type="button"
 onClick={() => markReflected(memo.id)}
 className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>반영 완료</span>
                          </button>
                        ) : (
                          <button
 type="button"
 onClick={() => reopenMemo(memo.id)}
 className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3 text-slate-500" />
                            <span>보관 복원</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Bottom Module Jump CTA */}
          <div className="pt-2 flex justify-end">
            <Button
 variant="secondary"
 size="sm"
 onClick={() => onNavigateModule?.('memory')}
 className="gap-1.5"
            >
              <span>작업기억 전체 관리 이동</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 아카이브 탐색기 전체 패널 */}
      {/* ========================================================================= */}
      {activeTab === 'archive' && (
        <div className="space-y-4">
          {/* Search Bar & Quick Query Chips */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
 type="text"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 placeholder="마스터 아카이브 전문 검색 (공문서·시트·방침서·사진)..."
 className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm font-semibold bg-slate-50 text-slate-900 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:bg-white"
              />
              {query && (
                <button
 type="button"
 onClick={() => setQuery('')}
 aria-label="검색어 초기화"
 className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 mr-1">빠른 검색:</span>
              {ARCHIVE_QUICK_QUERIES.map((q) => (
                <button
 key={q}
 type="button"
 onClick={() => setQuery(q)}
 className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border ${
 query === q
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Toolbar (Year & Category) */}
          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {(
 [
                  { id: '2026년', label: '2026년' },
                  { id: '2025년', label: '2025년' },
                  { id: 'ALL', label: '전체 연도' },
 ] as const
              ).map((y) => (
                <button
 key={y.id}
 type="button"
 onClick={() => setYear(y.id)}
 className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
 year === y.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 border-slate-200/70'
                  }`}
                >
                  {y.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {(
 [
                  { id: 'ALL', label: '전체' },
                  { id: 'doc', label: '공문서' },
                  { id: 'sheet', label: '시트' },
                  { id: 'image', label: '사진' },
 ] as const
              ).map((cat) => (
                <button
 key={cat.id}
 type="button"
 onClick={() => setCategory(cat.id)}
 className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer border ${
 category === cat.id
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Document Search Results List */}
          {archiveLoading ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold animate-pulse">아카이브 색인 검색 중...</p>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <FolderOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold">일치 문서 없음</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
              {data.items.slice(0, 25).map((item) => {
 const IconComponent = getArchiveIcon(item);

 return (
                  <article
 key={item.id}
 data-testid={`showcase-archive-card-${item.id}`}
 className="bg-white rounded-xl p-3.5 border border-slate-200/85 hover:border-slate-300 shadow-2xs transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 break-all leading-snug">
                              {item.name}
                            </span>
                            {item.matchReason === 'content' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 shrink-0">
                                본문 일치
                              </span>
                            )}
                            {(item.matchReason === 'filename' || (item.matchReason as string) === 'name') && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                                파일명 일치
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 flex-wrap">
                            <span className="font-semibold text-slate-700">{item.year}</span>
                            <span>›</span>
                            <span className="text-slate-700 font-medium">{formatProjectName(item.project)}</span>
                            {item.subFolder && (
                              <>
                                <span>›</span>
                                <span className="text-slate-500">{item.subFolder}</span>
                              </>
                            )}
                            <span>·</span>
                            <span>{item.date}</span>
                            <span>·</span>
                            <span>{formatFileSize(item.size)}</span>
                          </div>
                        </div>
                      </div>

                      {/* File Open / Folder Location Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
 type="button"
 onClick={() => openArchiveTarget(item.relPath, 'file')}
 className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer shadow-2xs"
 title="연결 프로그램 실행"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>파일 열기</span>
                        </button>
                        <button
 type="button"
 onClick={() => openArchiveTarget(item.relPath, 'folder')}
 className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
 title="탐색기 폴더 열기"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>폴더</span>
                        </button>
                      </div>
                    </div>

                    {/* Content Snippet */}
                    {item.snippet && (
                      <div className="text-xs text-slate-600 line-clamp-2 bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-100 break-words">
                        {item.snippet}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {/* Bottom Module Jump CTA */}
          <div className="pt-2 flex justify-end">
            <Button
 variant="secondary"
 size="sm"
 onClick={() => onNavigateModule?.('archive')}
 className="gap-1.5"
            >
              <span>문서 보관함 이동</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: 분할 뷰 (Split View: 데스크톱 2열, 모바일 448px 1열 스택) */}
      {/* ========================================================================= */}
      {activeTab === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {/* Left Column: 업무 메모 & 신속 입력 */}
          <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between gap-4">
            <div className="space-y-3.5">
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-slate-700" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900">업무 메모</span>
                </div>
                <Badge variant="warning">미반영 {pendingMemos.length}건</Badge>
              </div>

              {/* Compact Quick Memo Input */}
              <form onSubmit={handleAddMemoSubmit} className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {QUICK_SNIPPETS.slice(0, 3).map((snippet) => (
                    <button
 key={snippet.label}
 type="button"
 onClick={() => handleInsertSnippet(snippet)}
 className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                    >
                      {snippet.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
 type="text"
 value={memoryInput}
 onChange={(e) => setMemoryInput(e.target.value)}
 placeholder="지시·가내시 신속 메모 입력..."
 className="flex-1 min-w-0 px-3 py-1.5 text-xs font-semibold bg-white text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                  />
                  <Button type="submit" variant="primary" size="xs" className="shrink-0 px-2.5">
                    <Plus className="w-3 h-3" />
                    <span>등록</span>
                  </Button>
                </div>
              </form>

              {/* Top Pending Memos List */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-0.5">
                {pendingMemos.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                    미반영 메모 없음
                  </div>
                ) : (
 pendingMemos.slice(0, 5).map((memo) => {
 const catMeta =
 WORKING_MEMORY_CATEGORIES[memo.category] || WORKING_MEMORY_CATEGORIES.general;

 return (
                      <div
 key={memo.id}
 className={`rounded-lg p-3 border transition-colors flex flex-col gap-2 ${catMeta.postItClass}`}
                      >
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${catMeta.badgeClass}`}>
                            {catMeta.shortLabel}
                          </span>
                          {memo.pinned && (
                            <span className="px-1 py-0.2 rounded text-[9.5px] font-extrabold bg-amber-500 text-white">
                              고정
                            </span>
                          )}
                        </div>

                        {memo.numericHighlight && (
                          <div className="text-[11px] font-black font-mono tabular-nums text-amber-950 bg-amber-200/90 px-1.5 py-0.5 rounded w-fit">
                            {memo.numericHighlight}
                          </div>
                        )}

                        <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">
                          {memo.content}
                        </p>

                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-900/10">
                          <button
 type="button"
 onClick={() => markReflected(memo.id)}
 className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer shadow-2xs"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>반영 완료</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Left Column Bottom Jump */}
            <div className="pt-2 border-t border-slate-200/70 flex justify-end">
              <Button
 variant="ghost"
 size="xs"
 onClick={() => onNavigateModule?.('memory')}
 className="gap-1 text-slate-700"
              >
                <span>메모 전체 보기</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Right Column: 문서 검색 */}
          <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between gap-4">
            <div className="space-y-3.5">
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-slate-700" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900">문서 검색</span>
                </div>
                <Badge variant="default">색인 {totalIndexedCount}건</Badge>
              </div>

              {/* Compact Search Bar & Chips */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ARCHIVE_QUICK_QUERIES.slice(0, 3).map((q) => (
                    <button
 key={q}
 type="button"
 onClick={() => setQuery(q)}
 className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-colors cursor-pointer border ${
 query === q
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
 type="text"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 placeholder="문서명·키워드 빠른 검색..."
 className="w-full pl-8 pr-8 py-1.5 text-xs font-semibold bg-white text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                  />
                  {query && (
                    <button
 type="button"
 onClick={() => setQuery('')}
 aria-label="검색어 초기화"
 className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Top Document Matches List */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-0.5">
                {archiveLoading ? (
                  <div className="py-8 text-center text-slate-400 text-xs font-semibold animate-pulse">
                    검색 중...
                  </div>
                ) : !data || data.items.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                    일치 문서 없음
                  </div>
                ) : (
 data.items.slice(0, 5).map((item) => {
 const IconComponent = getArchiveIcon(item);

 return (
                      <div
 key={item.id}
 className="bg-white rounded-lg p-2.5 border border-slate-200/80 shadow-2xs flex flex-col gap-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <IconComponent className="w-3.5 h-3.5 text-slate-600 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {item.name}
                              </p>
                              <p className="text-[10.5px] text-slate-500 truncate">
                                {item.year} · {formatProjectName(item.project)} · {formatFileSize(item.size)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
 type="button"
 onClick={() => openArchiveTarget(item.relPath, 'file')}
 className="px-2 py-1 rounded text-[10.5px] font-bold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer shadow-2xs"
 title="파일 열기"
                            >
                              열기
                            </button>
                            <button
 type="button"
 onClick={() => openArchiveTarget(item.relPath, 'folder')}
 className="px-1.5 py-1 rounded text-[10.5px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
 title="폴더"
                            >
                              위치
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column Bottom Jump */}
            <div className="pt-2 border-t border-slate-200/70 flex justify-end">
              <Button
 variant="ghost"
 size="xs"
 onClick={() => onNavigateModule?.('archive')}
 className="gap-1 text-slate-700"
              >
                <span>아카이브 전체 탐색기 이동</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
