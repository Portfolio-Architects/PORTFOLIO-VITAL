'use client';

import { useEffect } from 'react';
import { RefreshCcw, AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error('Global Error Boundary caught:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-slate-200 max-w-md w-full">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mx-auto mb-6 text-red-500">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">시스템 오류 발생</h2>
            <p className="text-slate-500 mb-6 text-sm leading-relaxed">
              예상치 못한 문제가 발생하여 화면을 불러오지 못했습니다. 앱을 다시 로드하면 정상적으로 이용할 수 있습니다.
            </p>
            
            <div className="bg-slate-100 rounded-lg p-3 mb-6 text-left overflow-hidden">
              <p className="text-xs font-mono text-slate-600 truncate">{error.message || 'Unknown error'}</p>
            </div>

            <button
              onClick={() => reset()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
            >
              <RefreshCcw size={18} />
              <span>화면 다시 불러오기</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
