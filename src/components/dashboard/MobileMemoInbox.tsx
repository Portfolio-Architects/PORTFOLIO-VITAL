'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Smartphone,
  Lock,
  Send,
  CheckCircle2,
  Calendar,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { WorkingMemoryCategory } from '@/types';
import { useWorkingMemory } from '@/hooks/useWorkingMemory';
import {
  WORKING_MEMORY_CATEGORIES,
  WORKING_MEMORY_CATEGORY_LIST,
  parseWorkingMemoryInput,
  splitWorkingMemoryLines,
} from '@/lib/working-memory-parser';

const PIN_STORAGE_KEY = 'hchps-memo-pin';

export function MobileMemoInbox() {
  const {
    pendingMemos,
    reflectedMemos,
    isSyncingInbox,
    syncError,
    verifyPinAndLoadInbox,
    submitMobileMemo,
    markReflected,
    deleteMemo,
  } = useWorkingMemory({ contextModule: 'dashboard', autoFetch: false });

  const [pin, setPin] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return window.localStorage.getItem(PIN_STORAGE_KEY) || '';
      } catch {
        return '';
      }
    }
    return '';
  });
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [memoText, setMemoText] = useState('');
  const [explicitCategory, setExplicitCategory] = useState<WorkingMemoryCategory | undefined>(
    undefined
  );
  const [justSentBanner, setJustSentBanner] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPin = window.localStorage.getItem(PIN_STORAGE_KEY);
      if (savedPin) {
        void verifyPinAndLoadInbox(savedPin).then((ok) => {
          if (ok) setIsUnlocked(true);
        });
      }
    }
  }, [verifyPinAndLoadInbox]);

  const memoLines = useMemo(() => splitWorkingMemoryLines(memoText), [memoText]);

  const livePreview = useMemo(() => {
    if (!memoText.trim()) return null;
    return parseWorkingMemoryInput(memoText, explicitCategory);
  }, [memoText, explicitCategory]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    const ok = await verifyPinAndLoadInbox(pin.trim());
    if (ok) {
      setIsUnlocked(true);
    }
  };

  const handleSendMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoText.trim()) return;
    const lineCount = memoLines.length;
    const created = await submitMobileMemo(memoText, pin || '7116', explicitCategory);
    if (created) {
      setMemoText('');
      setExplicitCategory(undefined);
      setJustSentBanner(
        lineCount > 1
          ? `전송 완료 (${lineCount}건 일괄 등록): ${created.tags.join(' ')} ${created.numericHighlight ? `(${created.numericHighlight})` : ''}`
          : `전송 완료: ${created.tags.join(' ')} ${created.numericHighlight ? `(${created.numericHighlight})` : ''}`
      );
      setTimeout(() => setJustSentBanner(null), 3500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-4 px-3">
      <div
        data-testid="mobile-memo-inbox-container"
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col"
      >
        {/* Top Mobile Bar */}
        <header className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight truncate">
                모바일 메모함
              </h1>
              <p className="text-[11px] text-slate-300 font-medium truncate">
                24/7 클라우드 KV ↔ 행정 PC 작업기억 보드 연동
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isUnlocked && (
              <button
                type="button"
                onClick={() => void verifyPinAndLoadInbox(pin || '7116')}
                disabled={isSyncingInbox}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                title="새로고침"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingInbox ? 'animate-spin' : ''}`} />
              </button>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>대시보드</span>
            </Link>
          </div>
        </header>

        {!isUnlocked ? (
          /* PIN Lock View */
          <form
            onSubmit={handleUnlock}
            data-testid="mobile-memo-pin-form"
            className="p-6 space-y-4 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mx-auto text-indigo-600">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-black text-slate-900">
                PIN 잠금 해제
              </h2>
              <p className="text-xs font-medium text-slate-500 break-keep">
                PIN 4자리 인증 · PC 작업기억 보드 즉시 전송
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="보안 PIN 입력 (예: 7116)"
                aria-label="모바일 우체통 보안 PIN"
                data-testid="mobile-memo-pin-input"
                className="w-full px-4 py-3 text-center text-base font-black tracking-widest rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {syncError && (
                <p
                  data-testid="mobile-memo-pin-error"
                  className="text-xs font-bold text-rose-600"
                >
                  {syncError}
                </p>
              )}
            </div>

            <button
              type="submit"
              data-testid="mobile-memo-pin-submit"
              disabled={!pin.trim() || isSyncingInbox}
              className="w-full py-3 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer disabled:opacity-40"
            >
              {isSyncingInbox ? '인증 확인 중...' : '우체통 열기'}
            </button>
          </form>
        ) : (
          /* Unlocked Mobile Capture & Memo Feed */
          <div className="p-4 space-y-4">
            {/* Security Status Strip */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-[11px] font-bold text-emerald-800">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                PIN 인증 완료 · PC 보드 실시간 동기화 활성
              </span>
              <span className="font-mono tabular-nums">미반영 {pendingMemos.length}건</span>
            </div>

            {/* 1-Second Mobile Capture Form */}
            <form onSubmit={handleSendMemo} className="space-y-2.5">
              <textarea
                rows={3}
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                placeholder="지시 · 예산 변경 메모 입력 (다중 줄 가능)"
                aria-label="모바일 메모 입력"
                data-testid="mobile-memo-textarea"
                className="w-full p-3 text-xs font-semibold rounded-xl bg-amber-50/50 text-slate-900 border border-amber-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />

              {/* Category Quick Chips */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setExplicitCategory(undefined)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                    !explicitCategory
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  자동 분류
                </button>
                {WORKING_MEMORY_CATEGORY_LIST.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setExplicitCategory(cat.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                      explicitCategory === cat.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.shortLabel}
                  </button>
                ))}
              </div>

              {/* Live Auto-Tag & Numeric Preview */}
              {livePreview && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-1.5 flex-wrap text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  {memoLines.length > 1 && (
                    <span className="px-2 py-0.5 rounded font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      📋 {memoLines.length}건 일괄
                    </span>
                  )}
                  {livePreview.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200"
                    >
                      {tag}
                    </span>
                  ))}
                  {livePreview.dateHighlight && (
                    <span className="px-1.5 py-0.5 rounded font-bold bg-slate-200/80 text-slate-800 font-mono">
                      📅 {livePreview.dateHighlight}
                    </span>
                  )}
                  {livePreview.numericHighlight && (
                    <span className="px-2 py-0.5 rounded font-black bg-amber-100 text-amber-900 border border-amber-300 font-mono">
                      💰 {livePreview.numericHighlight}
                    </span>
                  )}
                </div>
              )}

              <button
                type="submit"
                data-testid="mobile-memo-send-btn"
                disabled={!memoText.trim()}
                className="w-full py-3 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                <span>⚡ PC 보드 즉시 전송</span>
              </button>
            </form>

            {justSentBanner && (
              <div
                data-testid="mobile-memo-sent-toast"
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-extrabold text-center"
              >
                ✓ {justSentBanner}
              </div>
            )}

            {/* Pending Memos List */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black text-slate-800">
                  현재 미반영 작업기억 ({pendingMemos.length}건)
                </h2>
                {reflectedMemos.length > 0 && (
                  <span className="text-[11px] font-semibold text-slate-400">
                    반영완료 {reflectedMemos.length}건
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {pendingMemos.map((memo) => {
                  const catMeta =
                    WORKING_MEMORY_CATEGORIES[memo.category] || WORKING_MEMORY_CATEGORIES.general;
                  return (
                    <div
                      key={memo.id}
                      data-testid={`mobile-memo-card-${memo.id}`}
                      className={`p-3 rounded-xl border space-y-2 ${catMeta.postItClass}`}
                    >
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1 flex-wrap">
                          {(memo.tags && memo.tags.length > 0 ? memo.tags : [catMeta.label]).map(
                            (tag) => (
                              <span
                                key={tag}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${catMeta.badgeClass}`}
                              >
                                {tag}
                              </span>
                            )
                          )}
                          {memo.dateHighlight && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/80 text-slate-700 border border-slate-200 font-mono">
                              <Calendar className="w-2.5 h-2.5" />
                              {memo.dateHighlight}
                            </span>
                          )}
                        </div>
                        {memo.numericHighlight && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-200/80 text-amber-950 border border-amber-400/70 font-mono">
                            💰 {memo.numericHighlight}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-bold text-slate-900 leading-snug break-keep">
                        {memo.content}
                      </p>

                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60">
                        <button
                          type="button"
                          data-testid={`mobile-delete-${memo.id}`}
                          onClick={() => void deleteMemo(memo.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>삭제</span>
                        </button>
                        <button
                          type="button"
                          data-testid={`mobile-reflect-${memo.id}`}
                          onClick={() => void markReflected(memo.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>✓ 반영 완료</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
