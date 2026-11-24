'use client';

import { useEffect } from 'react';
import { RefreshCcw, AlertOctagon } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Route Error Boundary caught:', error);
  }, [error]);

  return (
    <div className="flex h-[80vh] w-full flex-col items-center justify-center p-6 text-center">
      <div className="rounded-2xl bg-white p-8 shadow-sm border border-slate-200 max-w-md w-full">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 mx-auto mb-6">
          <AlertOctagon size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">모듈 렌더링 오류</h2>
        <p className="text-slate-500 mb-6 text-sm leading-relaxed">
          해당 페이지 영역을 불러오는 중 오류가 발생했습니다.<br/>일시적인 네트워크 문제일 수 있습니다.
        </p>
        
        <div className="bg-slate-100/50 rounded-lg p-3 mb-6 text-left overflow-hidden border border-slate-100">
          <p className="text-xs font-mono text-slate-600 truncate">{error.message || 'Unknown error'}</p>
        </div>

        <button
          onClick={() => reset()}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-sm"
        >
          <RefreshCcw size={16} />
          <span>다시 시도하기</span>
        </button>
      </div>
    </div>
  );
}
