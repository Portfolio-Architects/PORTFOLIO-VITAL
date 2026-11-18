import React from 'react';
import { Lock } from 'lucide-react';
import type { SecurityPinModalProps } from './types';

export const SecurityPinModal: React.FC<SecurityPinModalProps> = React.memo(({
  isOpen,
  pinInput,
  pinError,
  onPinChange,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200/90 max-w-sm w-full p-5 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/90 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">비상연락망 보안 인증</h3>
            <p className="text-xs text-slate-500 font-medium">행사 관계자 및 근무자 확인 비밀번호 입력</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">인증 비밀번호</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={10}
              value={pinInput}
              onChange={(e) => onPinChange(e.target.value)}
              placeholder="비밀번호 4자리 입력"
              className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums font-bold tracking-widest text-center border border-slate-200/90 rounded-xl bg-slate-50/80 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 text-slate-900"
              autoFocus
            />
            {pinError && (
              <div className="text-xs font-bold text-red-600 text-center">
                ✕ {pinError}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-2xs transition-colors cursor-pointer active:scale-95"
            >
              인증 및 ON
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

SecurityPinModal.displayName = 'SecurityPinModal';
