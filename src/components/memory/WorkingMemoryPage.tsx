'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Pin,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Plus,
  Smartphone,
  Monitor,
  RefreshCw,
  Sparkles,
  Calendar,
  ArrowUpRight,
  StickyNote,
  Search,
  X,
  LayoutGrid,
  Columns3,
  Table2,
  Pencil,
  Check,
  ArrowRight,
  AlertCircle,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import { ModuleType, WorkingMemoryCategory, WorkingMemoryMemo } from '@/types';
import { useWorkingMemory } from '@/hooks/useWorkingMemory';
import {
  WORKING_MEMORY_CATEGORIES,
  WORKING_MEMORY_CATEGORY_LIST,
  WORKING_MEMORY_ISSUE_SEVERITY_META,
  extractIssueMeta,
  parseWorkingMemoryInput,
  splitWorkingMemoryLines,
} from '@/lib/working-memory-parser';

export type WorkingMemoryLayoutMode = 'grid' | 'kanban' | 'ledger';

export interface WorkingMemoryPageProps {
  onNavigateModule?: (module: ModuleType) => void;
}

const QUICK_INSERT_SNIPPETS: Array<{ label: string; text: string; category?: WorkingMemoryCategory }> = [
  { label: '+ 팀장님 지시', text: '팀장님 지시: ', category: 'directive' },
  { label: '+ 2027 예산 가내시', text: '가내시 메모보고: 2027 본예산 ', category: 'budget' },
  { label: '+ 행정감사 자료', text: '행정감사 요구자료: ', category: 'audit' },
  { label: '+ 양재천 행사', text: '양재천 페스티벌: ', category: 'festival' },
  {
    label: '+ 이슈로그 (근접→근본)',
    text: '[이슈로그] RP: | 근접: | 근본: | 개선: | 위험:상',
    category: 'issue_log',
  },
  { label: '+ 수치변동 (→)', text: ' → ' },
];

const CATEGORY_TARGET_MODULE: Partial<
  Record<WorkingMemoryCategory, { module: ModuleType; label: string }>
> = {
  budget: { module: 'workspace', label: '예산관리 이동' },
  audit: { module: 'project', label: '사업관리 이동' },
  festival: { module: 'festival', label: '양재천 페스티벌 이동' },
  directive: { module: 'workspace', label: '예산관리 이동' },
};

const KANBAN_LANES: Array<{
  id: string;
  title: string;
  subtitle: string;
  categories: WorkingMemoryCategory[];
  tagMatch: string;
  headerAccentClass: string;
  badgeClass: string;
  targetModule?: { module: ModuleType; label: string };
}> = [
  {
    id: 'lane-directive',
    title: '팀장님 지시 · 긴급 현안',
    subtitle: '구두 지시 · 즉시 피드백',
    categories: ['directive'],
    tagMatch: '[팀장님 지시]',
    headerAccentClass: 'border-t-4 border-t-rose-500',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  {
    id: 'lane-budget',
    title: '2027 예산편성 · 수치 변동',
    subtitle: '가내시 증감 · 세목 단가 · 일상경비',
    categories: ['budget'],
    tagMatch: '[2027 예산편성]',
    headerAccentClass: 'border-t-4 border-t-amber-500',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
    targetModule: { module: 'workspace', label: '예산관리 열기' },
  },
  {
    id: 'lane-audit',
    title: '행정사무감사 · 요구자료',
    subtitle: '행감 질의답변서 · 제출 마감',
    categories: ['audit'],
    tagMatch: '[행정감사]',
    headerAccentClass: 'border-t-4 border-t-sky-500',
    badgeClass: 'bg-sky-50 text-sky-900 border-sky-200',
    targetModule: { module: 'project', label: '사업관리 열기' },
  },
  {
    id: 'lane-festival',
    title: '양재천 페스티벌 · 일반 행정',
    subtitle: '현장 부스 · 식순 · 공용 메모',
    categories: ['festival', 'general'],
    tagMatch: '[양재천 행사]',
    headerAccentClass: 'border-t-4 border-t-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    targetModule: { module: 'festival', label: '페스티벌 열기' },
  },
  {
    id: 'lane-issue-log',
    title: '이슈로그 · 근본원인',
    subtitle: '근접(동사) → 근본(형용사) → 기계개선',
    categories: ['issue_log'],
    tagMatch: '[이슈로그]',
    headerAccentClass: 'border-t-4 border-t-violet-500',
    badgeClass: 'bg-violet-50 text-violet-900 border-violet-200',
  },
];

interface PostItCardProps {
  memo: WorkingMemoryMemo;
  editingId: string | null;
  editingText: string;
  onStartEdit: (memo: WorkingMemoryMemo) => void;
  onChangeEditText: (text: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onReflect: (id: string) => void;
  onReopen: (id: string) => void;
  onNavigateModule?: (module: ModuleType) => void;
}

function WorkingMemoryPostItCard({
  memo,
  editingId,
  editingText,
  onStartEdit,
  onChangeEditText,
  onSaveEdit,
  onCancelEdit,
  onTogglePin,
  onDelete,
  onReflect,
  onReopen,
  onNavigateModule,
}: PostItCardProps) {
  const catMeta =
    WORKING_MEMORY_CATEGORIES[memo.category] || WORKING_MEMORY_CATEGORIES.general;
  const isEditing = editingId === memo.id;
  const targetNav = CATEGORY_TARGET_MODULE[memo.category];
  const resolvedIssueMeta =
    memo.issueMeta || (memo.category === 'issue_log' ? extractIssueMeta(memo.content) : undefined);
  const severityMeta = resolvedIssueMeta?.severity
    ? WORKING_MEMORY_ISSUE_SEVERITY_META[resolvedIssueMeta.severity]
    : undefined;

  return (
    <article
      data-testid={`working-memory-card-${memo.id}`}
      className={`vlds-cv-card relative rounded-xl p-4 border transition-colors flex flex-col justify-between gap-3 ${catMeta.postItClass}`}
    >
      <div className="space-y-2.5">
        {/* Card Meta Badges */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {(memo.tags && memo.tags.length > 0 ? memo.tags : [catMeta.label]).map((tag) => (
              <span
                key={tag}
                className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${catMeta.badgeClass}`}
              >
                {tag}
              </span>
            ))}
            {memo.dateHighlight && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-white/90 text-slate-700 border border-slate-200/80 font-mono tabular-nums">
                <Calendar className="w-3 h-3" />
                {memo.dateHighlight}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/80 text-slate-500 border border-slate-200/60"
              title={
                memo.source === 'mobile'
                  ? '스마트폰 모바일 우체통에서 전송됨'
                  : '데스크톱 보드에서 기록됨'
              }
            >
              {memo.source === 'mobile' ? (
                <>
                  <Smartphone className="w-2.5 h-2.5 text-slate-700" />
                  <span>모바일</span>
                </>
              ) : (
                <>
                  <Monitor className="w-2.5 h-2.5 text-slate-400" />
                  <span>PC</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Numeric / Budget Change Highlight Callout */}
        {memo.numericHighlight && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-200/80 border border-amber-400/80 text-amber-950 text-xs font-black font-mono tabular-nums">
            <span>핵심 수치:</span>
            <span>{memo.numericHighlight}</span>
          </div>
        )}

        {/* Dalio Principles Structured Issue Log Block */}
        {resolvedIssueMeta && !isEditing && (
          <div
            data-testid={`issue-log-structured-${memo.id}`}
            className="rounded-lg bg-white/95 border border-violet-200/90 p-2.5 space-y-1.5"
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-violet-800">
                <ShieldAlert className="w-3 h-3" />
                원인진단
              </span>
              {severityMeta && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${severityMeta.badgeClass}`}
                >
                  위험 {severityMeta.label}
                </span>
              )}
              {resolvedIssueMeta.responsibleParty && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-200">
                  RP {resolvedIssueMeta.responsibleParty}
                </span>
              )}
              {resolvedIssueMeta.doubleDoRequired && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200">
                  이중실행
                </span>
              )}
            </div>
            <div className="space-y-1 text-[11px]">
              {resolvedIssueMeta.proximateCause && (
                <div className="flex items-baseline gap-1.5">
                  <span className="shrink-0 font-extrabold text-slate-500">근접(동사)</span>
                  <span className="font-semibold text-slate-800 break-keep">
                    {resolvedIssueMeta.proximateCause}
                  </span>
                </div>
              )}
              {resolvedIssueMeta.rootCause && (
                <div className="flex items-baseline gap-1.5">
                  <span className="shrink-0 font-extrabold text-violet-700">근본(형용사)</span>
                  <span className="font-bold text-slate-900 break-keep">
                    {resolvedIssueMeta.rootCause}
                  </span>
                </div>
              )}
              {resolvedIssueMeta.machineFix && (
                <div className="flex items-baseline gap-1.5">
                  <span className="shrink-0 font-extrabold text-emerald-700">기계개선</span>
                  <span className="font-bold text-emerald-900 break-keep">
                    {resolvedIssueMeta.machineFix}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Memo Main Text or Inline Editor */}
        {isEditing ? (
          <div className="space-y-2 pt-0.5">
            <textarea
              rows={2}
              value={editingText}
              onChange={(e) => onChangeEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSaveEdit(memo.id);
                } else if (e.key === 'Escape') {
                  onCancelEdit();
                }
              }}
              aria-label="메모 내용 수정"
              data-testid={`edit-memo-textarea-${memo.id}`}
              className="w-full px-3 py-2 text-xs font-semibold bg-white text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-2.5 py-1 rounded text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => onSaveEdit(memo.id)}
                data-testid={`save-edit-memo-${memo.id}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>저장</span>
              </button>
            </div>
          </div>
        ) : (
          <p
            className={`text-[13px] font-bold leading-relaxed break-keep ${
              memo.status === 'reflected'
                ? 'line-through text-slate-400'
                : 'text-slate-900'
            }`}
          >
            {memo.content}
          </p>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-200/60 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => onTogglePin(memo.id)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
              memo.pinned
                ? 'bg-amber-200/80 text-amber-900'
                : 'text-slate-500 hover:bg-white/70'
            }`}
            title="상단 고정 토글"
          >
            <Pin className="w-3 h-3" />
            <span>{memo.pinned ? '고정됨' : '고정'}</span>
          </button>

          {!isEditing && (
            <button
              type="button"
              onClick={() => onStartEdit(memo)}
              data-testid={`edit-memo-btn-${memo.id}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-slate-500 hover:text-slate-900 hover:bg-white/70 transition-colors cursor-pointer"
              title="메모 내용 및 수치 수정"
            >
              <Pencil className="w-3 h-3" />
              <span>수정</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(memo.id)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="메모 삭제"
          >
            <Trash2 className="w-3 h-3" />
            <span>삭제</span>
          </button>

          {onNavigateModule && targetNav && memo.status === 'pending' && (
            <button
              type="button"
              onClick={() => onNavigateModule(targetNav.module)}
              className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white/70 hover:bg-white border border-slate-200/70 transition-colors cursor-pointer"
            >
              <span>{targetNav.label}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {memo.status === 'pending' ? (
          <button
            type="button"
            onClick={() => onReflect(memo.id)}
            data-testid={`reflect-memo-${memo.id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>✓ 반영 완료</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onReopen(memo.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>미반영 복원</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function WorkingMemoryPage({ onNavigateModule }: WorkingMemoryPageProps = {}) {
  const {
    memos,
    pendingMemos,
    reflectedMemos,
    isSyncingInbox,
    lastSyncedAt,
    addMemo,
    markReflected,
    reopenMemo,
    togglePin,
    updateMemoContent,
    deleteMemo,
    syncMemoInbox,
  } = useWorkingMemory({ contextModule: 'dashboard' });

  const [inputText, setInputText] = useState('');
  const [explicitCategory, setExplicitCategory] = useState<WorkingMemoryCategory | undefined>(
    undefined
  );
  const [selectedFilter, setSelectedFilter] = useState<WorkingMemoryCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<'pending' | 'reflected'>('pending');
  const [layoutMode, setLayoutMode] = useState<WorkingMemoryLayoutMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyNumeric, setOnlyNumeric] = useState(false);
  const [onlyPinned, setOnlyPinned] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const inputLines = useMemo(() => splitWorkingMemoryLines(inputText), [inputText]);

  const livePreview = useMemo(() => {
    if (!inputText.trim()) return null;
    return parseWorkingMemoryInput(inputText, explicitCategory);
  }, [inputText, explicitCategory]);

  // Cognitive Load KPI Statistics
  const kpiStats = useMemo(() => {
    const pinnedPendingCount = pendingMemos.filter((m) => m.pinned).length;
    const numericPendingCount = pendingMemos.filter((m) => Boolean(m.numericHighlight)).length;
    const directivePendingCount = pendingMemos.filter(
      (m) => m.category === 'directive' || (m.tags && m.tags.includes('[팀장님 지시]'))
    ).length;
    const issueLogPendingCount = pendingMemos.filter(
      (m) => m.category === 'issue_log' || (m.tags && m.tags.includes('[이슈로그]'))
    ).length;
    const datedPendingCount = pendingMemos.filter((m) => Boolean(m.dateHighlight)).length;
    const mobileCount = memos.filter((m) => m.source === 'mobile').length;
    const totalCount = memos.length;
    const reflectionRate =
      totalCount > 0 ? Math.round((reflectedMemos.length / totalCount) * 100) : 0;

    return {
      pinnedPendingCount,
      numericPendingCount,
      directivePendingCount,
      issueLogPendingCount,
      datedPendingCount,
      mobileCount,
      totalCount,
      reflectionRate,
    };
  }, [memos, pendingMemos, reflectedMemos]);

  const displayedMemos = useMemo(() => {
    const sourceList = viewMode === 'pending' ? pendingMemos : reflectedMemos;
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return sourceList.filter((m) => {
      if (selectedFilter !== 'all') {
        const catMeta = WORKING_MEMORY_CATEGORIES[selectedFilter];
        const matchesCat =
          m.category === selectedFilter ||
          Boolean(
            m.tags &&
              (m.tags.includes(catMeta.label) || m.tags.includes(catMeta.shortLabel))
          );
        if (!matchesCat) return false;
      }

      if (onlyNumeric && !m.numericHighlight) return false;
      if (onlyPinned && !m.pinned) return false;

      if (normalizedQuery) {
        const haystack = [
          m.content,
          ...(m.tags || []),
          m.numericHighlight || '',
          m.dateHighlight || '',
          m.issueMeta?.responsibleParty || '',
          m.issueMeta?.proximateCause || '',
          m.issueMeta?.rootCause || '',
          m.issueMeta?.machineFix || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }

      return true;
    });
  }, [viewMode, pendingMemos, reflectedMemos, selectedFilter, onlyNumeric, onlyPinned, searchQuery]);

  const handleSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    await addMemo(inputText, explicitCategory, 'pc');
    setInputText('');
    setExplicitCategory(undefined);
    setViewMode('pending');
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData?.getData('text');
    if (pasted && splitWorkingMemoryLines(pasted).length > 1) {
      e.preventDefault();
      setInputText((prev) => (prev.trim() ? `${prev}\n${pasted}` : pasted));
    }
  };

  const handleInsertSnippet = useCallback(
    (snippet: { text: string; category?: WorkingMemoryCategory }) => {
      setInputText((prev) => {
        if (!prev.trim()) return snippet.text;
        return `${prev}${snippet.text}`;
      });
      if (snippet.category) {
        setExplicitCategory(snippet.category);
      }
    },
    []
  );

  const handleStartEdit = useCallback((memo: WorkingMemoryMemo) => {
    setEditingId(memo.id);
    setEditingText(memo.content);
  }, []);

  const handleSaveEdit = useCallback(
    async (id: string) => {
      if (!editingText.trim()) return;
      await updateMemoContent(id, editingText);
      setEditingId(null);
      setEditingText('');
    },
    [editingText, updateMemoContent]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingText('');
  }, []);

  const handleResetAllFilters = useCallback(() => {
    setSelectedFilter('all');
    setOnlyNumeric(false);
    setOnlyPinned(false);
    setSearchQuery('');
  }, []);

  return (
    <div
      data-testid="working-memory-page"
      className="w-full flex flex-col gap-5 font-sans"
    >
      {/* 1. Cognitive Offloading KPI Summary Strip */}
      <section
        aria-label="작업기억 현황 요약"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5"
      >
        {/* KPI 1: Pending Action Items */}
        <button
          type="button"
          onClick={() => {
            setViewMode('pending');
            handleResetAllFilters();
          }}
          className={`text-left bg-white rounded-xl p-4 sm:p-5 border transition-colors cursor-pointer flex flex-col justify-between gap-2 shadow-2xs ${
            viewMode === 'pending' && selectedFilter === 'all' && !onlyNumeric && !onlyPinned
              ? 'border-slate-900 ring-1 ring-slate-900/10'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500">미반영 작업기억 현안</span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200/80 font-mono tabular-nums">
              상단 고정 {kpiStats.pinnedPendingCount}건
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums tracking-tight">
                {pendingMemos.length}
              </span>
              <span className="text-xs font-bold text-slate-500">건 대기 중</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">전체 보기</span>
          </div>
        </button>

        {/* KPI 2: Numeric & Budget Transitions */}
        <button
          type="button"
          data-testid="kpi-filter-numeric"
          onClick={() => {
            setViewMode('pending');
            setSelectedFilter('all');
            setOnlyPinned(false);
            setOnlyNumeric((prev) => !prev);
          }}
          className={`text-left bg-white rounded-xl p-4 sm:p-5 border transition-colors cursor-pointer flex flex-col justify-between gap-2 shadow-2xs ${
            onlyNumeric
              ? 'border-amber-500 bg-amber-50/30 ring-1 ring-amber-500/20'
              : 'border-slate-200/80 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500">예산·수치 변동 감지</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-950 border border-amber-300/80">
              <TrendingUp className="w-3 h-3" />
              금액·물량 변경
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-amber-900 font-mono tabular-nums tracking-tight">
                {kpiStats.numericPendingCount}
              </span>
              <span className="text-xs font-bold text-slate-500">건 미반영</span>
            </div>
            <span className="text-[11px] font-bold text-amber-800">
              {onlyNumeric ? '필터 해제' : '수치 필터 →'}
            </span>
          </div>
        </button>

        {/* KPI 3: Directives & Dated Deadlines */}
        <button
          type="button"
          data-testid="kpi-filter-directive"
          onClick={() => {
            setViewMode('pending');
            setOnlyNumeric(false);
            setOnlyPinned(false);
            setSelectedFilter((prev) => (prev === 'directive' ? 'all' : 'directive'));
          }}
          className={`text-left bg-white rounded-xl p-4 sm:p-5 border transition-colors cursor-pointer flex flex-col justify-between gap-2 shadow-2xs ${
            selectedFilter === 'directive'
              ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-500/20'
              : 'border-slate-200/80 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500">팀장님 지시 · 마감 명시</span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200/80 font-mono tabular-nums">
              마감 명시 {kpiStats.datedPendingCount}건
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-rose-700 font-mono tabular-nums tracking-tight">
                {kpiStats.directivePendingCount}
              </span>
              <span className="text-xs font-bold text-slate-500">건 지시사항</span>
            </div>
            <span className="text-[11px] font-bold text-rose-700">
              {selectedFilter === 'directive' ? '필터 해제' : '지시 필터 →'}
            </span>
          </div>
        </button>

        {/* KPI 4: Reflection Rate & Mobile Relay Status */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500">업무 반영률 · 모바일 우체통</span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-mono tabular-nums">
              모바일 수집 {kpiStats.mobileCount}건
            </span>
          </div>
          <div className="flex items-end justify-between gap-2 pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono tabular-nums tracking-tight">
                {kpiStats.reflectionRate}%
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono tabular-nums">
                ({reflectedMemos.length}/{kpiStats.totalCount}건 완료)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void syncMemoInbox()}
                disabled={isSyncingInbox}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                title="모바일 우체통 즉시 동기화"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingInbox ? 'animate-spin text-slate-900' : ''}`} />
                <span>우체통 동기화</span>
                {lastSyncedAt && <span className="text-[10px] text-emerald-600 font-mono">●</span>}
              </button>
              <Link
                href="/memo"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                title="모바일 우체통 열기"
              >
                <Smartphone className="w-3 h-3" />
                <span>/memo</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Working Memory Workspace Container */}
      <section
        aria-label="작업기억 보조 보드"
        data-testid="working-memory-board"
        className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-5"
      >
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
              <StickyNote className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  작업기억 보드
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300/80 font-mono tabular-nums">
                  미반영 {pendingMemos.length}건
                </span>
                {kpiStats.issueLogPendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-violet-50 text-violet-800 border border-violet-200 font-mono tabular-nums">
                    이슈로그 {kpiStats.issueLogPendingCount}건
                  </span>
                )}
                {reflectedMemos.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 font-mono tabular-nums">
                    반영완료 {reflectedMemos.length}건
                  </span>
                )}
              </div>
              <p className="vlds-subtitle text-xs font-medium text-slate-500 mt-0.5">
                지시 · 예산 변동 · 행감 메모 즉시 분류 (다중 줄 붙여넣기)
              </p>
            </div>
          </div>

          {/* Layout Switcher & Status Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 3-Mode Layout Switcher */}
            <div
              role="tablist"
              aria-label="보드 보기 방식"
              className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200/70"
            >
              <button
                type="button"
                role="tab"
                aria-selected={layoutMode === 'grid'}
                data-testid="working-memory-layout-grid"
                onClick={() => setLayoutMode('grid')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  layoutMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>포스트잇 보드</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={layoutMode === 'kanban'}
                data-testid="working-memory-layout-kanban"
                onClick={() => setLayoutMode('kanban')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  layoutMode === 'kanban'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>업무 트랙 칸반</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={layoutMode === 'ledger'}
                data-testid="working-memory-layout-ledger"
                onClick={() => setLayoutMode('ledger')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  layoutMode === 'ledger'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>수치·마감 대조표</span>
              </button>
            </div>

            {/* Pending / Reflected Status Toggle */}
            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200/70">
              <button
                type="button"
                onClick={() => setViewMode('pending')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  viewMode === 'pending'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                미반영 ({pendingMemos.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('reflected')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  viewMode === 'reflected'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                반영완료 ({reflectedMemos.length})
              </button>
            </div>
          </div>
        </div>

        {/* 1-Second Quick Capture Input Form */}
        <form onSubmit={handleSubmit} className="space-y-2.5">
          {/* Quick Snippet Prefix Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 mr-0.5">빠른 삽입:</span>
            {QUICK_INSERT_SNIPPETS.map((snippet) => (
              <button
                key={snippet.label}
                type="button"
                onClick={() => handleInsertSnippet(snippet)}
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 border border-slate-200/70 transition-colors cursor-pointer"
              >
                {snippet.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <textarea
                rows={inputLines.length > 1 ? Math.min(inputLines.length, 5) : 1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && inputLines.length <= 1) {
                    e.preventDefault();
                    void handleSubmit(e);
                  }
                }}
                placeholder="메모 입력 · Enter · 다중 줄 붙여넣기 (예: 9/21 본예산 6,500만 원 → 7,800만 원)"
                aria-label="작업기억 한 줄 메모 입력"
                data-testid="working-memory-input"
                className="w-full px-4 py-3 text-xs sm:text-[13px] font-semibold bg-amber-50/40 text-slate-900 placeholder:text-slate-400 rounded-lg border border-amber-300/80 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 resize-none"
              />
            </div>
            <button
              type="submit"
              data-testid="working-memory-submit"
              disabled={!inputText.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-lg text-xs font-black bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer disabled:opacity-40 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{inputLines.length > 1 ? `${inputLines.length}건 일괄 기록` : '1초 기록'}</span>
            </button>
          </div>

          {/* Live Auto-Tagging & Numeric Highlight Preview Strip */}
          {livePreview && (
            <div
              data-testid="working-memory-live-preview"
              className="flex items-center justify-between gap-2 flex-wrap px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200/70 text-[11px]"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 font-bold text-slate-500">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  자동 분류 미리보기:
                </span>
                {inputLines.length > 1 && (
                  <span
                    data-testid="working-memory-preview-multiline"
                    className="px-2 py-0.5 rounded font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    📋 다중 줄 일괄 캡처 ({inputLines.length}건)
                  </span>
                )}
                {livePreview.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded font-extrabold bg-slate-200/80 text-slate-900 border border-slate-300"
                  >
                    {tag}
                  </span>
                ))}
                {livePreview.dateHighlight && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-white text-slate-800 border border-slate-200 font-mono tabular-nums">
                    <Calendar className="w-3 h-3" />
                    {livePreview.dateHighlight}
                  </span>
                )}
                {livePreview.numericHighlight && (
                  <span
                    data-testid="working-memory-preview-numeric"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-black bg-amber-100 text-amber-900 border border-amber-300 font-mono tabular-nums"
                  >
                    💰 핵심 수치: {livePreview.numericHighlight}
                  </span>
                )}
                {livePreview.issueMeta && (
                  <span
                    data-testid="working-memory-preview-issue"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-black bg-violet-100 text-violet-900 border border-violet-300"
                  >
                    <ShieldAlert className="w-3 h-3" />
                    <span>
                      이슈로그
                      {livePreview.issueMeta.responsibleParty
                        ? ` · RP ${livePreview.issueMeta.responsibleParty}`
                        : ''}
                      {livePreview.issueMeta.rootCause ? ' · 근본원인' : ''}
                      {livePreview.issueMeta.machineFix ? ' · 기계개선' : ''}
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400">수동 태그 지정:</span>
                <button
                  type="button"
                  onClick={() => setExplicitCategory(undefined)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    !explicitCategory
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  자동
                </button>
                {WORKING_MEMORY_CATEGORY_LIST.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setExplicitCategory(cat.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      explicitCategory === cat.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {cat.shortLabel}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Search & Multi-Dimensional Filter Toolbar (All <button>, zero <select>) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 mr-1">
              분류 필터:
            </span>
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              전체 ({viewMode === 'pending' ? pendingMemos.length : reflectedMemos.length})
            </button>
            {WORKING_MEMORY_CATEGORY_LIST.map((cat) => {
              const isSelected = selectedFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedFilter(isSelected ? 'all' : cat.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                    isSelected
                      ? cat.badgeClass
                      : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setOnlyNumeric((prev) => !prev)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                onlyNumeric
                  ? 'bg-amber-100 text-amber-950 border-amber-300'
                  : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              💰 수치 변동만
            </button>

            <button
              type="button"
              onClick={() => setOnlyPinned((prev) => !prev)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                onlyPinned
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              📌 고정됨만
            </button>
          </div>

          {/* Instant Keyword Search Input */}
          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="내용 · 금액(7,800) · 날짜 검색"
              aria-label="작업기억 메모 검색"
              data-testid="working-memory-search"
              className="w-full pl-8 pr-8 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 border border-slate-200/80 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 3. Main Content View: Grid / Kanban / Ledger */}
        {displayedMemos.length === 0 ? (
          <div
            role="status"
            className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2"
          >
            <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-600">
              {searchQuery || selectedFilter !== 'all' || onlyNumeric || onlyPinned
                ? '조건 일치 메모 없음'
                : viewMode === 'pending'
                  ? '대기 메모 없음 · 입력 시 태그·수치 자동 추출'
                  : '반영 완료 메모 없음'}
            </p>
            {(searchQuery || selectedFilter !== 'all' || onlyNumeric || onlyPinned) && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                필터 초기화
              </button>
            )}
          </div>
        ) : layoutMode === 'grid' ? (
          /* Mode A: 3-Column Post-it Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {displayedMemos.map((memo) => (
              <WorkingMemoryPostItCard
                key={memo.id}
                memo={memo}
                editingId={editingId}
                editingText={editingText}
                onStartEdit={handleStartEdit}
                onChangeEditText={setEditingText}
                onSaveEdit={(id) => void handleSaveEdit(id)}
                onCancelEdit={handleCancelEdit}
                onTogglePin={(id) => void togglePin(id)}
                onDelete={(id) => void deleteMemo(id)}
                onReflect={(id) => void markReflected(id)}
                onReopen={(id) => void reopenMemo(id)}
                onNavigateModule={onNavigateModule}
              />
            ))}
          </div>
        ) : layoutMode === 'kanban' ? (
          /* Mode B: 5-Column Concurrent Workstream Kanban Lanes (incl. Issue Log) */
          <div
            data-testid="working-memory-kanban-view"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-start"
          >
            {KANBAN_LANES.map((lane) => {
              const laneMemos = displayedMemos.filter((m) =>
                lane.categories.includes(m.category)
              );
              return (
                <div
                  key={lane.id}
                  data-testid={lane.id}
                  className={`rounded-xl bg-slate-50/80 border border-slate-200/80 p-3.5 flex flex-col gap-3 ${lane.headerAccentClass}`}
                >
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200/70">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-black text-slate-900">{lane.title}</h3>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border font-mono tabular-nums ${lane.badgeClass}`}
                        >
                          {laneMemos.length}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                        {lane.subtitle}
                      </p>
                    </div>
                    {onNavigateModule && lane.targetModule && (
                      <button
                        type="button"
                        onClick={() => onNavigateModule(lane.targetModule!.module)}
                        className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0 cursor-pointer"
                      >
                        <span>{lane.targetModule.label}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>

                  {laneMemos.length === 0 ? (
                    <div className="py-6 text-center rounded-lg border border-dashed border-slate-200/80 bg-white/50">
                      <p className="text-[11px] font-semibold text-slate-400">해당 트랙 메모 없음</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {laneMemos.map((memo) => (
                        <WorkingMemoryPostItCard
                          key={memo.id}
                          memo={memo}
                          editingId={editingId}
                          editingText={editingText}
                          onStartEdit={handleStartEdit}
                          onChangeEditText={setEditingText}
                          onSaveEdit={(id) => void handleSaveEdit(id)}
                          onCancelEdit={handleCancelEdit}
                          onTogglePin={(id) => void togglePin(id)}
                          onDelete={(id) => void deleteMemo(id)}
                          onReflect={(id) => void markReflected(id)}
                          onReopen={(id) => void reopenMemo(id)}
                          onNavigateModule={onNavigateModule}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Mode C: Numeric & Deadline Administrative Ledger Table */
          <div
            data-testid="working-memory-ledger-view"
            className="overflow-x-auto rounded-xl border border-slate-200/80"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-600">
                  <th className="py-2.5 px-3.5 whitespace-nowrap">업무 분류</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">기한 · 일자</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">핵심 수치 · 예산 변동</th>
                  <th className="py-2.5 px-3.5">메모 원문</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">경로</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">반영 조치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs bg-white">
                {displayedMemos.map((memo) => {
                  const catMeta =
                    WORKING_MEMORY_CATEGORIES[memo.category] || WORKING_MEMORY_CATEGORIES.general;
                  return (
                    <tr
                      key={memo.id}
                      data-testid={`working-memory-ledger-row-${memo.id}`}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-3.5 whitespace-nowrap align-top">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${catMeta.badgeClass}`}
                          >
                            {catMeta.label}
                          </span>
                          {memo.pinned && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                              📌
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap align-top font-mono tabular-nums font-bold text-slate-700">
                        {memo.dateHighlight ? `📅 ${memo.dateHighlight}` : '—'}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap align-top font-mono tabular-nums">
                        {memo.numericHighlight ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300/80 font-black text-[11px]">
                            💰 {memo.numericHighlight}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 align-top font-semibold text-slate-900 leading-snug max-w-xl">
                        <div>{memo.content}</div>
                        {memo.issueMeta && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {memo.issueMeta.responsibleParty && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                RP {memo.issueMeta.responsibleParty}
                              </span>
                            )}
                            {memo.issueMeta.rootCause && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-800 border border-violet-200">
                                근본 {memo.issueMeta.rootCause}
                              </span>
                            )}
                            {memo.issueMeta.machineFix && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                개선 {memo.issueMeta.machineFix}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap align-top text-[11px] font-semibold text-slate-500">
                        {memo.source === 'mobile' ? '모바일' : 'PC'}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap align-top text-right">
                        {memo.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => void markReflected(memo.id)}
                            data-testid={`reflect-memo-${memo.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>✓ 반영 완료</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void reopenMemo(memo.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>복원</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
