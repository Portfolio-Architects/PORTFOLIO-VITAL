'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { SimulationEntry } from '@/types';

export interface SimulationSettleModalProps {
 item: SimulationEntry | null;
 onClose: () => void;
 onConfirm: (simId: string, actualAmount: number, actualDate: string) => Promise<boolean | void> | boolean | void;
 backdropClassName?: string;
}

export const SimulationSettleModal: React.FC<SimulationSettleModalProps> = React.memo(({
 item,
 onClose,
 onConfirm,
 backdropClassName = 'bg-slate-900/60',
}) => {
 const [actualAmountInput, setActualAmountInput] = useState<string>('');
 const [actualDateInput, setActualDateInput] = useState<string>('');
 const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

 const [prevItemId, setPrevItemId] = useState<string | null>(null);
 const currentItemId = item?.id ?? null;
 if (currentItemId !== prevItemId) {
 setPrevItemId(currentItemId);
 if (item) {
 setActualAmountInput(item.amount.toLocaleString('ko-KR'));
 setActualDateInput(new Date().toISOString().split('T')[0]);
 setIsSubmitting(false);
    }
  }

 useEffect(() => {
 if (!item) return;
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === 'Escape' && !isSubmitting) {
 onClose();
      }
    };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, isSubmitting, onClose]);

 const handleConfirm = useCallback(async () => {
 if (!item || isSubmitting) return;
 setIsSubmitting(true);
 try {
 const cleanAmount = parseInt(actualAmountInput.replace(/[^0-9]/g, ''), 10) || item.amount;
 const result = await onConfirm(item.id, cleanAmount, actualDateInput);
 if (result !== false) {
 onClose();
      }
    } finally {
 setIsSubmitting(false);
    }
  }, [item, isSubmitting, actualAmountInput, actualDateInput, onConfirm, onClose]);

 if (!item) return null;

 return (
    <div
 className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${backdropClassName}`}
 onClick={() => {
 if (!isSubmitting) onClose();
      }}
    >
      <div
 role="dialog"
 aria-modal="true"
 aria-label="실제 지출 집행 정산 전환"
 className="bg-white rounded-xl p-6 max-w-md w-full shadow-md border border-slate-200/90 space-y-4"
 onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 pb-3.5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">실제 지출 정산</h3>
            <p className="text-xs text-slate-500">선택 항목 → e-호조 실집행 전환</p>
          </div>
        </div>

        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80 space-y-2 text-sm">
          <div className="flex justify-between gap-2 text-slate-500">
            <span className="shrink-0">계획 항목명</span>
            <span className="font-bold text-slate-900 text-right">{item.name}</span>
          </div>
          <div className="flex justify-between gap-2 text-slate-500">
            <span className="shrink-0">경비 구분</span>
            <span className={`font-bold ${item.actionType === 'daily_expense' ? 'text-amber-700' : 'text-slate-800'}`}>
              {item.actionType === 'daily_expense' ? '🪙 일상경비 실지출' : '🏢 일반 지출 (본청)'}
            </span>
          </div>
          <div className="flex justify-between gap-2 text-slate-500">
            <span className="shrink-0">세부사업 / 통계목</span>
            <span className="font-mono text-slate-700 font-semibold text-right">{item.detailedProject} · {item.statItem}</span>
          </div>
          <div className="flex justify-between gap-2 text-slate-500 pt-2 border-t border-slate-200/80">
            <span className="shrink-0">기존 계획 예정액</span>
            <span className="font-mono font-bold text-slate-900 tabular-nums">₩{item.amount.toLocaleString('ko-KR')}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="settle-actual-amount" className="text-xs sm:text-sm font-bold text-slate-700">
              최종 실제 집행액 (원)
            </label>
            <input
 id="settle-actual-amount"
 type="text"
 value={actualAmountInput}
 onChange={(e) => {
 const raw = e.target.value.replace(/[^0-9]/g, '');
 const n = parseInt(raw, 10);
 setActualAmountInput(n ? n.toLocaleString('ko-KR') : '');
              }}
 className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200/90 bg-slate-50/60 focus:bg-white text-sm font-mono tabular-nums text-right focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settle-actual-date" className="text-xs sm:text-sm font-bold text-slate-700">
              실제 집행 일자
            </label>
            <input
 id="settle-actual-date"
 type="date"
 value={actualDateInput}
 onChange={(e) => setActualDateInput(e.target.value)}
 className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200/90 bg-slate-50/60 focus:bg-white text-sm font-mono focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2.5 border-t border-slate-100">
          <button
 type="button"
 disabled={isSubmitting}
 onClick={onClose}
 className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600 text-xs sm:text-sm font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            취소
          </button>
          <button
 type="button"
 disabled={isSubmitting}
 onClick={handleConfirm}
 className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {isSubmitting ? '전환 처리 중' : '실지출 집행 완료'}
          </button>
        </div>
      </div>
    </div>
  );
});

SimulationSettleModal.displayName = 'SimulationSettleModal';
