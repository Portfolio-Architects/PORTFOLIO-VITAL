'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { classifyAndParse, ParsedResult } from '@/lib/korean-nlp';
import { Calendar, Clock, MapPin, Users, DollarSign, AlertTriangle, Send, Repeat } from 'lucide-react';

interface QuickInputProps {
  onCreateTask: (data: { title: string; dueDate?: string; priority: 'low' | 'medium' | 'high'; tags: string[]; category: string; recurrence?: string; recurrenceEndDate?: string }) => void;
  onAddSignal?: (text: string) => void;
  onSearch?: (query: string) => void;
  onNavigate: (module: string) => void;
}

function formatAmount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

function QuickInputComponent({ onCreateTask, onAddSignal, onSearch, onNavigate }: QuickInputProps) {
  const [text, setText] = useState('');
  const [justCreated, setJustCreated] = useState(false);
  const [createdLabel, setCreatedLabel] = useState('업무 생성 완료!');

  const parsed = useMemo<ParsedResult | null>(() => {
    if (text.trim().length < 2) return null;
    return classifyAndParse(text);
  }, [text]);

  const handleSubmit = useCallback(() => {
    if (!parsed || text.trim().length < 2) return;

    const tags: string[] = [...parsed.tags];
    if (parsed.people.length > 0) {
      for (let i = 0; i < parsed.people.length; i++) {
        tags.push(parsed.people[i]);
      }
    }
    if (parsed.location) tags.push(parsed.location);
    if (parsed.amount) tags.push(formatAmount(parsed.amount));

    // Merge date + time into dueDate (e.g. "2026-03-19T14:00")
    let dueDate = parsed.date;
    if (dueDate && parsed.time) {
      dueDate = `${dueDate}T${parsed.time}`;
    }

    if (parsed.type === 'query' && onSearch) {
      onSearch(parsed.rawText);
      setCreatedLabel('🔍 데이터를 검색중입니다...');
    } else if (parsed.type === 'signal' && onAddSignal) {
      onAddSignal(parsed.rawText);
      setCreatedLabel('📡 시그널 기록 완료!');
      onNavigate('archive');
    } else {
      onCreateTask({
        title: parsed.title,
        dueDate,
        priority: parsed.priority,
        tags,
        category: parsed.category || '',
        recurrence: parsed.recurrence,
        recurrenceEndDate: parsed.recurrenceEndDate
      });
      setCreatedLabel('업무 생성 완료!');
      onNavigate('workspace');
    }

    setText('');
    setJustCreated(true);
    setTimeout(() => setJustCreated(false), 2500);
  }, [parsed, text, onCreateTask, onAddSignal, onSearch, onNavigate]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="relative overflow-visible">
      <div className="flex items-center gap-2 glass-panel rounded-2xl shadow-sm px-3.5 sm:px-4 py-2.5 transition-colors duration-200 focus-within:border-[var(--color-primary)]/80 min-w-0">
        <input
          type="text"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)] font-medium text-[var(--color-text-primary)]"
          placeholder="Ask anything..."
        />

        {parsed && (
          <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10.5px] font-bold tracking-wide uppercase shadow-2xs border ${
            parsed.type === 'query'
              ? 'bg-violet-500/10 text-violet-700 border-violet-500/20'
              : parsed.type === 'signal'
                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                : 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20'
          }`}>
            {parsed.type === 'query' ? '🔍 정보 검색' : parsed.type === 'signal' ? '📡 시그널' : '📋 업무'}
          </span>
        )}

        <button
          onClick={handleSubmit}
          disabled={!parsed}
          className={`p-2 rounded-xl transition-colors duration-150 cursor-pointer ${parsed ? 'bg-[var(--color-primary)] text-white hover:opacity-90 shadow-sm' : 'bg-slate-100 text-[var(--color-text-tertiary)] opacity-60'}`}
        >
          <Send size={13} />
        </button>
      </div>

      {parsed && (
        <div className="flex items-center gap-2 mt-2.5 flex-wrap px-1.5 overflow-x-auto no-scrollbar">
          {parsed.date && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-indigo-500/10 text-indigo-700 border border-indigo-500/15 shadow-2xs">
              <Calendar size={11} /> {parsed.date}
            </span>
          )}
          {parsed.time && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-violet-500/10 text-violet-700 border border-violet-500/15 shadow-2xs">
              <Clock size={11} /> {parsed.time}
            </span>
          )}
          {parsed.people.map(p => (
            <span key={p} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/15 shadow-2xs">
              <Users size={11} /> {p}
            </span>
          ))}
          {parsed.location && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-orange-500/10 text-orange-700 border border-orange-500/15 shadow-2xs">
              <MapPin size={11} /> {parsed.location}
            </span>
          )}
          {parsed.amount && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/15 shadow-2xs font-mono">
              <DollarSign size={11} /> {formatAmount(parsed.amount)}
            </span>
          )}
          {parsed.priority === 'high' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-rose-500/10 text-rose-700 border border-rose-500/15 shadow-2xs">
              <AlertTriangle size={11} /> 긴급
            </span>
          )}
          {parsed.recurrence && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-teal-500/10 text-teal-700 border border-teal-500/15 shadow-2xs">
              <Repeat size={11} /> {parsed.recurrence}
            </span>
          )}
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] ml-auto hidden sm:inline truncate max-w-[150px]" title={parsed.title}>
            → &quot;{parsed.title}&quot;
          </span>
        </div>
      )}

      {justCreated && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-5 py-3 rounded-full bg-slate-900/95 border border-slate-700/50 shadow-md text-[12px] font-semibold text-white">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {createdLabel}
        </div>
      )}
    </div>
  );
}

QuickInputComponent.displayName = 'QuickInput';
export const QuickInput = React.memo(QuickInputComponent);
