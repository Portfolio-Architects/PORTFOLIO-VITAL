'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  StickyNote,
  X,
} from 'lucide-react';
import { StickyNoteColor } from '@/types';
import { useWorkingMemory } from '@/hooks/useWorkingMemory';
import {
  STICKY_NOTE_COLORS,
  STICKY_NOTE_COLOR_MAP,
  StickyNoteCard,
  StickyNoteDoneItem,
} from './StickyNoteCard';

export interface StickyNotesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const RECOMMENDED_LENGTH = 50;

export function StickyNotesPanel({ isOpen, onClose }: StickyNotesPanelProps) {
  const {
    pendingMemos,
    reflectedMemos,
    isSyncingInbox,
    addMemo,
    markReflected,
    reopenMemo,
    togglePin,
    changeMemoColor,
    updateMemoContent,
    deleteMemo,
    syncMemoInbox,
  } = useWorkingMemory({ autoFetch: true });

  const [inputText, setInputText] = useState('');
  const [selectedColor, setSelectedColor] = useState<StickyNoteColor>('yellow');
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const trimmedLength = inputText.trim().length;
  const activeColorMeta =
    STICKY_NOTE_COLOR_MAP[selectedColor] || STICKY_NOTE_COLOR_MAP.yellow;

  const handleAttach = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    await addMemo(trimmed, undefined, 'pc', selectedColor);
    setInputText('');
    inputRef.current?.focus();
  }, [addMemo, inputText, selectedColor]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        void handleAttach();
      }
    },
    [handleAttach]
  );

  if (!isOpen) return null;

  return (
    <div
      data-testid="sticky-notes-backdrop"
      className="fixed inset-0 z-[100] flex justify-end modal-backdrop"
      onClick={onClose}
    >
      <aside
        id="sticky-notes-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="포스트잇"
        data-testid="sticky-notes-panel"
        className="w-full sm:w-[360px] md:w-[380px] max-w-full h-full bg-[#fafaf8] border-l border-slate-200/90 shadow-xl flex flex-col text-slate-900 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-200/90 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <StickyNote className="w-4 h-4 text-amber-500 shrink-0" />
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight truncate">
              포스트잇
            </h2>
            <span
              data-testid="sticky-notes-count"
              className="px-1.5 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-900 font-mono tabular-nums"
            >
              {pendingMemos.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="sticky-notes-sync"
              onClick={() => void syncMemoInbox()}
              disabled={isSyncingInbox}
              title="모바일 /memo 동기화"
              aria-label="모바일 메모 동기화"
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingInbox ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              data-testid="sticky-notes-close"
              onClick={onClose}
              title="숨기기 (Esc · Alt+N)"
              aria-label="포스트잇 숨기기"
              className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
            >
              <span>숨기기</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3-Second Quick Attach Box */}
        <div className="p-3.5 border-b border-slate-200/80 bg-white/70 shrink-0">
          <div
            className={`rounded-lg border p-2.5 transition-colors shadow-[0_1px_3px_rgba(15,23,42,0.05)] ${activeColorMeta.inputClass}`}
          >
            <textarea
              ref={inputRef}
              data-testid="sticky-notes-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="20~50자 메모 · Enter 부착"
              className="w-full bg-transparent text-[13.5px] font-semibold text-slate-900 placeholder:text-slate-500/80 placeholder:font-normal leading-snug focus:outline-none resize-none select-text"
            />
            <div className="mt-2 pt-1.5 border-t border-slate-900/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5" role="group" aria-label="새 포스트잇 색상">
                {STICKY_NOTE_COLORS.map((c) => {
                  const isSelected = c.id === selectedColor;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      data-testid={`sticky-notes-new-color-${c.id}`}
                      onClick={() => setSelectedColor(c.id)}
                      title={c.label}
                      aria-label={c.label}
                      className={`w-4 h-4 rounded-full border cursor-pointer transition-transform ${c.dotClass} ${
                        isSelected ? 'ring-2 ring-slate-900/75 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <span
                  data-testid="sticky-notes-char-count"
                  className={`text-[11px] font-mono tabular-nums ${
                    trimmedLength > RECOMMENDED_LENGTH
                      ? 'text-amber-700 font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  {trimmedLength}/{RECOMMENDED_LENGTH}
                </span>
                <button
                  type="button"
                  data-testid="sticky-notes-submit"
                  onClick={() => void handleAttach()}
                  disabled={trimmedLength === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>붙이기</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Notes Stack */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-2.5 select-text">
          {pendingMemos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center">
              <p className="text-xs font-semibold text-slate-500">부착된 포스트잇 없음</p>
              <p className="text-[11px] text-slate-400 mt-1">상단 입력칸 작성 후 Enter</p>
            </div>
          ) : (
            pendingMemos.map((memo) => (
              <StickyNoteCard
                key={memo.id}
                memo={memo}
                onChangeColor={(id, color) => void changeMemoColor(id, color)}
                onTogglePin={(id) => void togglePin(id)}
                onUpdateContent={(id, content) => void updateMemoContent(id, content)}
                onDone={(id) => void markReflected(id)}
                onDelete={(id) => void deleteMemo(id)}
              />
            ))
          )}
        </div>

        {/* Collapsible Done (Torn-off) Drawer */}
        {reflectedMemos.length > 0 && (
          <div className="border-t border-slate-200/90 bg-white/80 shrink-0">
            <button
              type="button"
              data-testid="sticky-notes-done-toggle"
              onClick={() => setShowDone((prev) => !prev)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <span>떼어낸 메모 ({reflectedMemos.length})</span>
              {showDone ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
            {showDone && (
              <div className="px-3.5 pb-3.5 max-h-48 overflow-y-auto custom-scrollbar space-y-1.5">
                {reflectedMemos.map((memo) => (
                  <StickyNoteDoneItem
                    key={memo.id}
                    memo={memo}
                    onRestore={(id) => void reopenMemo(id)}
                    onDelete={(id) => void deleteMemo(id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

export default StickyNotesPanel;
