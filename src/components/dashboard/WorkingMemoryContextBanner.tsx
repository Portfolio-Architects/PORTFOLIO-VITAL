'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Plus,
  ChevronDown,
  ChevronUp,
  Smartphone,
  ArrowUpRight,
} from 'lucide-react';
import { useWorkingMemory } from '@/hooks/useWorkingMemory';
import {
  WORKING_MEMORY_CATEGORIES,
  WorkingMemoryContextModule,
} from '@/lib/working-memory-parser';
import { WorkingMemoryCategory } from '@/types';

interface WorkingMemoryContextBannerProps {
  contextModule: WorkingMemoryContextModule;
  contextTitle?: string;
}

const DEFAULT_CONTEXT_CATEGORY: Record<WorkingMemoryContextModule, WorkingMemoryCategory> = {
  workspace: 'budget',
  simulator: 'budget',
  festival: 'festival',
  project: 'audit',
  dashboard: 'general',
};

const CONTEXT_MODULE_LABELS: Record<WorkingMemoryContextModule, string> = {
  workspace: '예산·회계 편성 필수 반영 메모',
  simulator: '예산 편성·증감 반영 대기 메모',
  festival: '양재천 행사 현장 반영 대기 메모',
  project: '사업·행정감사 반영 대기 메모',
  dashboard: '작업기억 미반영 메모',
};

export function WorkingMemoryContextBanner({
  contextModule,
  contextTitle,
}: WorkingMemoryContextBannerProps) {
  const { contextMemos, markReflected, addMemo } = useWorkingMemory({
    contextModule,
  });

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickInput, setQuickInput] = useState('');

  if (contextMemos.length === 0 && !showQuickAdd) {
    return null;
  }

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    await addMemo(quickInput, DEFAULT_CONTEXT_CATEGORY[contextModule], 'pc');
    setQuickInput('');
    setShowQuickAdd(false);
  };

  const headerTitle = contextTitle || CONTEXT_MODULE_LABELS[contextModule];

  return (
    <aside
      aria-label={headerTitle}
      data-testid={`working-memory-context-banner-${contextModule}`}
      className="rounded-xl border border-amber-300/90 dark:border-amber-700/80 bg-amber-50/90 dark:bg-amber-950/35 px-4 py-3 shadow-xs space-y-2.5"
    >
      {/* Banner Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-500 text-white shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
          </span>
          <span className="text-xs font-black text-amber-950 dark:text-amber-100 tracking-tight">
            📌 {headerTitle}
          </span>
          <span
            data-testid={`working-memory-banner-count-${contextModule}`}
            className="px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-200/90 dark:bg-amber-900 text-amber-950 dark:text-amber-200 border border-amber-400/70 dark:border-amber-700 tabular-nums"
          >
            미반영 {contextMemos.length}건
          </span>
          <span className="text-[11px] font-semibold text-amber-800/90 dark:text-amber-300/90 hidden sm:inline">
            반영 완료 버튼을 누르기 전까지 하단에 고정 노출됩니다.
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/memory"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-white/90 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-amber-300/80 dark:border-amber-700 hover:bg-white transition-colors"
          >
            <span>전체 보드</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
          <button
            type="button"
            onClick={() => setShowQuickAdd((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-white/90 dark:bg-slate-900 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700 hover:bg-white transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>즉시 메모 추가</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-200/50 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
          >
            {isCollapsed ? (
              <>
                <span>펼치기</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>접기</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Inline Quick Add Form */}
      {showQuickAdd && (
        <form onSubmit={handleQuickAdd} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="현재 화면 관련 기억할 사항 한 줄 입력 후 Enter..."
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-amber-300 dark:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
          <button
            type="submit"
            disabled={!quickInput.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-black bg-amber-700 hover:bg-amber-800 text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            기록
          </button>
        </form>
      )}

      {/* Pinned Alert Cards */}
      {!isCollapsed && (
        <div className="space-y-1.5">
          {contextMemos.map((memo) => {
            const catMeta =
              WORKING_MEMORY_CATEGORIES[memo.category] || WORKING_MEMORY_CATEGORIES.general;
            return (
              <div
                key={memo.id}
                data-testid={`context-banner-item-${memo.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-amber-200/90 dark:border-amber-800/70"
              >
                <div className="flex items-start sm:items-center gap-2 flex-wrap min-w-0">
                  {(memo.tags && memo.tags.length > 0 ? memo.tags : [catMeta.label]).map(
                    (tag) => (
                      <span
                        key={tag}
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold border shrink-0 ${catMeta.badgeClass}`}
                      >
                        {tag}
                      </span>
                    )
                  )}

                  {memo.dateHighlight && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono tabular-nums shrink-0">
                      <Calendar className="w-2.5 h-2.5" />
                      {memo.dateHighlight}
                    </span>
                  )}

                  {memo.numericHighlight && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-amber-100 text-amber-950 dark:bg-amber-900/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-mono tabular-nums shrink-0">
                      ⚡ {memo.numericHighlight}
                    </span>
                  )}

                  {memo.source === 'mobile' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 shrink-0">
                      <Smartphone className="w-2.5 h-2.5" />
                      모바일
                    </span>
                  )}

                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug break-keep">
                    {memo.content}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void markReflected(memo.id)}
                  data-testid={`banner-reflect-${memo.id}`}
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>✓ 반영 완료</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
