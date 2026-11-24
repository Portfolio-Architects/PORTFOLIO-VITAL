'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, X, Share2, Copy, Check, Download, AlertCircle } from 'lucide-react';
import { GoogleCalendarSyncModalProps } from './types';

export const GoogleCalendarSyncModal = React.memo(({
 isOpen,
 onClose,
 onRefresh,
 onImportCalendar
}: GoogleCalendarSyncModalProps) => {
 const [copied, setCopied] = useState(false);
 const [importUrl, setImportUrl] = useState('');
 const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
 const [importMessage, setImportMessage] = useState('');

 const feedUrl = useMemo(() => {
 const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
 return `${origin}/api/calendar/feed.ics`;
  }, []);

 const handleImportUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 setImportUrl(e.target.value);
  }, []);

 const handleCopyFeedUrl = useCallback(() => {
 navigator.clipboard.writeText(feedUrl);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
  }, [feedUrl]);

 const handleImport = useCallback(async (e: React.FormEvent) => {
 e.preventDefault();
 if (!importUrl.trim()) return;

 setImportStatus('loading');
 setImportMessage('');

 try {
 const data = await onImportCalendar({ icsUrl: importUrl.trim() });
 if (data.success) {
 setImportStatus('success');
 setImportMessage(`총 ${data.count || 0}건의 신규 일정을 성공적으로 동기화했습니다.`);
 if (onRefresh) onRefresh();
      } else {
 setImportStatus('error');
 setImportMessage(data.error || '일정 가져오기에 실패했습니다.');
      }
    } catch (err: any) {
 setImportStatus('error');
 setImportMessage(err?.message || '네트워크 오류가 발생했습니다.');
    }
  }, [importUrl, onImportCalendar, onRefresh]);

 if (!isOpen) return null;

 return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 w-full max-w-[560px] overflow-hidden flex flex-col p-6">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-200/50">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                구글 캘린더 연동
              </h3>
              <p className="text-[11px] font-semibold text-slate-400">
 iCal 실시간 구독 · 외부 일정 가져오기
              </p>
            </div>
          </div>
          <button
 type="button"
 onClick={onClose}
 className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto max-h-[70vh] pr-1 custom-scrollbar">
          
          {/* 섹션 1: 실시간 iCal 구독 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">
 1. 구글 캘린더 실시간 구독 (추천)
              </span>
            </div>
            <p className="text-[11.5px] text-slate-500 leading-relaxed">
 iCal URL 등록 시 웹 · 모바일 구글 캘린더 자동 동기화
            </p>

            <div className="flex items-center gap-2 bg-white p-1.5 pl-3 rounded-lg border border-slate-200">
              <span className="text-xs font-mono text-slate-600 truncate flex-1 select-all">
                {feedUrl}
              </span>
              <button
 type="button"
 onClick={handleCopyFeedUrl}
 className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold transition-colors duration-150 flex items-center gap-1 shrink-0 border-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '복사됨' : 'URL 복사'}</span>
              </button>
            </div>

            <div className="text-[10.5px] text-slate-400 bg-white/50 p-2.5 rounded-lg border border-slate-100 space-y-1">
              <div className="font-bold text-slate-600">📌 구글 캘린더 등록 순서:</div>
              <div>1. <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Google Calendar 웹</a> 접속</div>
              <div>2. 좌측 <strong>다른 캘린더 (+)</strong> → <strong>&quot;URL로 추가&quot;</strong> 선택</div>
              <div>3. 복사 주소 붙여넣기 → <strong>&quot;캘린더 추가&quot;</strong></div>
            </div>
          </div>

          {/* 섹션 2: 외부 구글 캘린더 iCal 가져오기 */}
          <form onSubmit={handleImport} className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">
 2. 외부 구글 캘린더 일정 가져오기
              </span>
            </div>
            <p className="text-[11.5px] text-slate-500 leading-relaxed">
              구글 캘린더 설정 → <strong>&quot;iCal 비공개 주소&quot;</strong> 입력
            </p>

            <div className="flex items-center gap-2">
              <input
 type="url"
 required
 placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
 value={importUrl}
 onChange={handleImportUrlChange}
 className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
 type="submit"
 disabled={importStatus === 'loading'}
 className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors duration-150 border-0 cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                {importStatus === 'loading' ? '가져오는 중...' : '가져오기'}
              </button>
            </div>

            {importMessage && (
              <div className={`p-2.5 rounded-lg text-xs font-bold flex items-center gap-2 ${
 importStatus === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {importStatus === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{importMessage}</span>
              </div>
            )}
          </form>

        </div>

        <div className="flex justify-end mt-4 border-t border-slate-100 pt-4">
          <button
 type="button"
 onClick={onClose}
 className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors border-0 cursor-pointer"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
});

GoogleCalendarSyncModal.displayName = 'GoogleCalendarSyncModal';
