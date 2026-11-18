'use client';

import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Terminal, RefreshCw, X, Play, Cpu, Activity, Copy, Trash2, History } from 'lucide-react';
import { useAppLogs } from '@/hooks/useAppLogs';

interface AppLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  appMode: 'HCHPS' | 'VITAL';
}

interface IndexedAppLog {
  timestamp: string;
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

function AppLogModalComponent({ isOpen, onClose, appMode }: AppLogModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [clearedAt, setClearedAt] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('logs_cleared_at');
      return stored ? parseInt(stored, 10) : null;
    }
    return null;
  });
  const [copied, setCopied] = useState(false);
  
  const queryResult = useAppLogs(isOpen);
  const data = queryResult.data;
  const isLoading = queryResult.isLoading;

  const handleReload = useCallback(() => {
    queryResult.refetch();
  }, [queryResult]);

  const rawLogs = data?.data;
  const daemonActive = data?.daemonActive ?? true;
  const watchDir = data?.watchDir ?? 'd:/Desktop';

  // Filter and merge client freeze logs with O(1) integer timestamp sorting and filtering
  const logs = useMemo<IndexedAppLog[]>(() => {
    if (!isOpen) return [];

    const rawList: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> = rawLogs || [];
    const combined: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> = [...rawList];
    
    // Read client freeze logs from sessionStorage
    if (typeof window !== 'undefined') {
      try {
        const freezeLogsRaw = sessionStorage.getItem('vital-freeze-logs');
        if (freezeLogsRaw) {
          const freezeLogs = JSON.parse(freezeLogsRaw);
          for (let i = 0; i < freezeLogs.length; i++) {
            combined.push(freezeLogs[i]);
          }
        }
      } catch {}
    }

    const indexedList: IndexedAppLog[] = new Array(combined.length);
    for (let i = 0; i < combined.length; i++) {
      const item = combined[i];
      indexedList[i] = {
        timestamp: item.timestamp,
        ts: Date.parse(item.timestamp) || 0,
        level: item.level,
        message: item.message,
      };
    }

    // Sort chronologically ascending with O(1) integer comparison
    indexedList.sort((a, b) => a.ts - b.ts);

    if (!clearedAt) return indexedList;
    const filtered: IndexedAppLog[] = [];
    for (let i = 0; i < indexedList.length; i++) {
      if (indexedList[i].ts > clearedAt) {
        filtered.push(indexedList[i]);
      }
    }
    return filtered;
  }, [isOpen, rawLogs, clearedAt]);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [logs]);

  // Copy Logs to Clipboard
  const handleCopyLogs = useCallback(() => {
    if (logs.length === 0) return;
    const text = logs
      .map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour12: false });
        return `[${time}] [${log.level.toUpperCase()}] ${log.message}`;
      })
      .join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [logs]);

  // Clear Logs (Local Session-based)
  const handleClearLogs = useCallback(() => {
    const now = Date.now();
    localStorage.setItem('logs_cleared_at', now.toString());
    setClearedAt(now);
  }, []);

  // Restore Cleared Logs
  const handleRestoreLogs = useCallback(() => {
    localStorage.removeItem('logs_cleared_at');
    setClearedAt(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      
      {/* Console Modal (White/Light Premium Theme - Wide View) */}
      <div className="relative w-full max-w-6xl bg-white border border-slate-200/80 rounded-2xl shadow-2xl flex flex-col h-[640px] overflow-hidden text-slate-800">
        
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-400 hover:bg-rose-500 cursor-pointer transition-colors" onClick={onClose} />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div className="h-4 w-px bg-slate-200 mx-2" />
            <Terminal size={14} className="text-slate-500" />
            <span className="text-xs font-bold tracking-wider font-mono uppercase text-slate-500">
              {appMode} Engine Execution Console
            </span>
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* Copy Button */}
            <button
              onClick={handleCopyLogs}
              disabled={logs.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 select-none cursor-pointer"
              title="로그 전체 복사"
            >
              <Copy size={11} />
              <span>{copied ? '복사 완료' : '전체 복사'}</span>
            </button>

            {/* Clear Button */}
            <button
              onClick={handleClearLogs}
              disabled={logs.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 select-none cursor-pointer"
              title="화면 로그 삭제"
            >
              <Trash2 size={11} />
              <span>로그 지우기</span>
            </button>

            {/* Restore Logs Button if cleared */}
            {clearedAt !== null && (
              <button
                onClick={handleRestoreLogs}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors select-none cursor-pointer"
                title="지워진 로그 복원"
              >
                <History size={11} />
                <span>복원</span>
              </button>
            )}

            <div className="h-4 w-px bg-slate-200 mx-1" />

            {/* Reload Button */}
            <button
              onClick={handleReload}
              disabled={isLoading}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50 select-none cursor-pointer"
              title="로그 새로고침"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            </button>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors select-none cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* HUD Stats Dashboard */}
        <div className="grid grid-cols-4 border-b border-slate-100 bg-slate-50/40 px-4 py-2 text-[11px] font-mono text-slate-500 shrink-0 select-none">
          <div className="flex items-center gap-1.5 border-r border-slate-200/60">
            <Activity size={12} className={daemonActive ? 'text-emerald-500' : 'text-slate-400'} />
            <span>DAEMON:</span>
            <span className={daemonActive ? 'text-emerald-600 font-bold' : 'text-slate-500 font-bold'}>
              {daemonActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 border-r border-slate-200/60 pl-3">
            <Cpu size={12} className="text-blue-500" />
            <span>PORT:</span>
            <span className="text-blue-600 font-bold">3001</span>
          </div>
          <div className="flex items-center gap-1.5 border-r border-slate-200/60 pl-3 col-span-2 truncate">
            <span>TARGET:</span>
            <span className="text-amber-600 font-semibold truncate" title={watchDir}>
              {watchDir}
            </span>
          </div>
        </div>

        {/* Console Log Area (Light Theme) */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-[11.5px] leading-relaxed custom-scrollbar bg-slate-50/20"
        >
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 select-none">
              <Play size={20} className="animate-pulse" />
              <span>수집 로그 없음 · 데몬 대기 중</span>
              {clearedAt !== null && (
                <button
                  onClick={handleRestoreLogs}
                  className="mt-2 text-[11px] text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer font-sans"
                >
                  <History size={11} /> 이전 로그 복원
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {logs.map((log, index) => {
                const isWarn = log.level === 'warn';
                const isError = log.level === 'error';
                
                const levelColor = isError 
                  ? 'text-rose-600 bg-rose-50 border border-rose-100' 
                  : isWarn 
                  ? 'text-amber-600 bg-amber-50 border border-amber-100' 
                  : 'text-emerald-600 bg-emerald-50 border border-emerald-100/50';
                
                const timeString = new Date(log.timestamp).toLocaleTimeString('ko-KR', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                return (
                  <div key={`${log.timestamp}-${log.level}-${index}`} className="flex items-start gap-3 hover:bg-slate-100/50 py-0.5 px-1 rounded transition-colors group">
                    <span className="text-slate-400 select-none group-hover:text-slate-500">
                      [{timeString}]
                    </span>
                    <span className={`px-1.5 py-px text-[9px] rounded font-bold uppercase select-none ${levelColor}`}>
                      {log.level}
                    </span>
                    <span className="flex-1 text-slate-700 break-all select-text selection:bg-slate-200">
                      {log.message}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Terminal Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-mono shrink-0 select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            <span>0-Interactive Evolution Loop Running...</span>
          </div>
          <span>E2EE BYPASS (Plain-Text JSON Mode)</span>
        </div>
      </div>
    </div>
  );
}

AppLogModalComponent.displayName = 'AppLogModal';
export const AppLogModal = React.memo(AppLogModalComponent);
