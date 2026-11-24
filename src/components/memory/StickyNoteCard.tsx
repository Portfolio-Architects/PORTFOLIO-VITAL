'use client';

import React, { useState, useCallback } from 'react';
import { Check, Pencil, Pin, Trash2, X } from 'lucide-react';
import { StickyNoteColor, WorkingMemoryMemo } from '@/types';
import { resolveStickyNoteColor } from '@/lib/working-memory-parser';

export const STICKY_NOTE_COLORS: ReadonlyArray<{
  id: StickyNoteColor;
  label: string;
  cardClass: string;
  topBarClass: string;
  dotClass: string;
  inputClass: string;
}> = [
  {
    id: 'yellow',
    label: '노랑 (메모)',
    cardClass: 'bg-[#FEF9C3] border-[#FDE047] hover:border-[#EAB308]',
    topBarClass: 'bg-[#FACC15]/75',
    dotClass: 'bg-[#FACC15] border-[#CA8A04]',
    inputClass: 'bg-[#FEF9C3]/85 border-[#FDE047] focus-within:border-[#CA8A04]',
  },
  {
    id: 'pink',
    label: '분홍 (긴급)',
    cardClass: 'bg-[#FFE4E6] border-[#FDA4AF] hover:border-[#F43F5E]',
    topBarClass: 'bg-[#FB7185]/75',
    dotClass: 'bg-[#FB7185] border-[#E11D48]',
    inputClass: 'bg-[#FFE4E6]/85 border-[#FDA4AF] focus-within:border-[#E11D48]',
  },
  {
    id: 'mint',
    label: '민트 (확인)',
    cardClass: 'bg-[#DCFCE7] border-[#86EFAC] hover:border-[#22C55E]',
    topBarClass: 'bg-[#4ADE80]/75',
    dotClass: 'bg-[#4ADE80] border-[#16A34A]',
    inputClass: 'bg-[#DCFCE7]/85 border-[#86EFAC] focus-within:border-[#16A34A]',
  },
  {
    id: 'sky',
    label: '하늘 (예산)',
    cardClass: 'bg-[#E0F2FE] border-[#7DD3FC] hover:border-[#0EA5E9]',
    topBarClass: 'bg-[#38BDF8]/75',
    dotClass: 'bg-[#38BDF8] border-[#0284C7]',
    inputClass: 'bg-[#E0F2FE]/85 border-[#7DD3FC] focus-within:border-[#0284C7]',
  },
];

export const STICKY_NOTE_COLOR_MAP: Record<
  StickyNoteColor,
  (typeof STICKY_NOTE_COLORS)[number]
> = {
  yellow: STICKY_NOTE_COLORS[0],
  pink: STICKY_NOTE_COLORS[1],
  mint: STICKY_NOTE_COLORS[2],
  sky: STICKY_NOTE_COLORS[3],
};

export interface StickyNoteCardProps {
  memo: WorkingMemoryMemo;
  onChangeColor: (id: string, color: StickyNoteColor) => void;
  onTogglePin: (id: string) => void;
  onUpdateContent: (id: string, content: string) => void;
  onDone: (id: string) => void;
  onDelete: (id: string) => void;
}

const LONG_MEMO_THRESHOLD = 68;

function StickyNoteCardComponent({
  memo,
  onChangeColor,
  onTogglePin,
  onUpdateContent,
  onDone,
  onDelete,
}: StickyNoteCardProps) {
  const colorKey = resolveStickyNoteColor(memo);
  const theme = STICKY_NOTE_COLOR_MAP[colorKey] || STICKY_NOTE_COLOR_MAP.yellow;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(memo.content);

  const isLong =
    memo.content.length > LONG_MEMO_THRESHOLD || memo.content.includes('\n');

  const handleStartEdit = useCallback(() => {
    setDraft(memo.content);
    setIsEditing(true);
  }, [memo.content]);

  const handleCancelEdit = useCallback(() => {
    setDraft(memo.content);
    setIsEditing(false);
  }, [memo.content]);

  const handleSaveEdit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== memo.content) {
      onUpdateContent(memo.id, trimmed);
    }
    setIsEditing(false);
  }, [draft, memo.content, memo.id, onUpdateContent]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelEdit();
      } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSaveEdit();
      }
    },
    [handleCancelEdit, handleSaveEdit]
  );

  return (
    <article
      data-testid={`sticky-note-${memo.id}`}
      data-color={colorKey}
      className={`group relative rounded-lg border overflow-hidden shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition-colors ${theme.cardClass}`}
    >
      {/* Top sticky tape strip */}
      <div className={`h-1 w-full ${theme.topBarClass}`} />

      <div className="px-3 pt-2.5 pb-2">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              data-testid={`sticky-note-edit-input-${memo.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={Math.min(5, Math.max(2, Math.ceil(draft.length / 26)))}
              autoFocus
              className="w-full rounded-md bg-white/90 border border-slate-300 px-2 py-1.5 text-[13px] font-medium text-slate-900 leading-snug focus:outline-none focus:border-slate-600 resize-none"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono tabular-nums text-slate-500">
                {draft.trim().length}/50
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-2 py-0.5 rounded bg-white/80 hover:bg-white border border-slate-300 text-[11px] font-semibold text-slate-600 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  data-testid={`sticky-note-save-${memo.id}`}
                  onClick={handleSaveEdit}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Top row: Pinned indicator + instant Done button */}
            <div className="flex items-start justify-between gap-2">
              <p
                data-testid={`sticky-note-content-${memo.id}`}
                onDoubleClick={handleStartEdit}
                onClick={isLong ? () => setIsExpanded((prev) => !prev) : undefined}
                title={isLong ? '클릭 펼침 · 더블클릭 수정' : '더블클릭 수정'}
                className={`flex-1 text-[13.5px] leading-[1.45] font-semibold text-slate-900 whitespace-pre-wrap break-words ${
                  isLong ? 'cursor-pointer' : 'cursor-text'
                } ${isLong && !isExpanded ? 'line-clamp-3' : ''}`}
              >
                {memo.content}
              </p>

              <button
                type="button"
                data-testid={`sticky-note-done-${memo.id}`}
                onClick={() => onDone(memo.id)}
                title="떼어내기 (완료)"
                aria-label="포스트잇 떼어내기"
                className="shrink-0 w-6 h-6 rounded-md bg-white/70 hover:bg-emerald-600 hover:text-white text-slate-600 border border-slate-900/10 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
              </button>
            </div>

            {isLong && (
              <button
                type="button"
                data-testid={`sticky-note-expand-${memo.id}`}
                onClick={() => setIsExpanded((prev) => !prev)}
                className="mt-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                {isExpanded ? '접기' : '전문 보기'}
              </button>
            )}

            {/* Bottom minimal action bar */}
            <div className="mt-2 pt-1.5 border-t border-slate-900/10 flex items-center justify-between gap-2">
              {/* 4 Color Dots */}
              <div className="flex items-center gap-1.5" role="group" aria-label="포스트잇 색상">
                {STICKY_NOTE_COLORS.map((c) => {
                  const isActive = c.id === colorKey;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      data-testid={`sticky-note-color-${memo.id}-${c.id}`}
                      onClick={() => onChangeColor(memo.id, c.id)}
                      title={c.label}
                      aria-label={c.label}
                      className={`w-3.5 h-3.5 rounded-full border cursor-pointer transition-transform ${c.dotClass} ${
                        isActive ? 'ring-2 ring-slate-800/70 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Pin · Edit · Delete */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  data-testid={`sticky-note-pin-${memo.id}`}
                  onClick={() => onTogglePin(memo.id)}
                  title={memo.pinned ? '상단 고정 해제' : '상단 고정'}
                  aria-label={memo.pinned ? '상단 고정 해제' : '상단 고정'}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    memo.pinned
                      ? 'text-slate-900 bg-white/80'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Pin className="w-3 h-3" strokeWidth={memo.pinned ? 2.4 : 1.8} />
                </button>
                <button
                  type="button"
                  data-testid={`sticky-note-edit-${memo.id}`}
                  onClick={handleStartEdit}
                  title="수정"
                  aria-label="포스트잇 수정"
                  className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-white/60 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  data-testid={`sticky-note-delete-${memo.id}`}
                  onClick={() => onDelete(memo.id)}
                  title="삭제"
                  aria-label="포스트잇 삭제"
                  className="p-1 rounded text-slate-500 hover:text-rose-700 hover:bg-white/60 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

export const StickyNoteCard = React.memo(StickyNoteCardComponent);
StickyNoteCard.displayName = 'StickyNoteCard';

export function StickyNoteDoneItem({
  memo,
  onRestore,
  onDelete,
}: {
  memo: WorkingMemoryMemo;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      data-testid={`sticky-note-done-item-${memo.id}`}
      className="rounded-lg bg-white border border-slate-200/80 px-2.5 py-2 flex items-start justify-between gap-2"
    >
      <p className="text-xs text-slate-400 line-through line-clamp-2 flex-1 leading-snug">
        {memo.content}
      </p>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          data-testid={`sticky-note-restore-${memo.id}`}
          onClick={() => onRestore(memo.id)}
          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer"
        >
          복구
        </button>
        <button
          type="button"
          data-testid={`sticky-note-purge-${memo.id}`}
          onClick={() => onDelete(memo.id)}
          aria-label="영구 삭제"
          className="p-0.5 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
