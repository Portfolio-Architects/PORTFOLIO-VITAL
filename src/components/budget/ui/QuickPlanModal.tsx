'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { BudgetCategory } from '@/types';
import { Sparkles, Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface QuickPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: BudgetCategory | null;
  currentRemaining: number;
  onSavePlan: (plan: {
    categoryId: string;
    detailedProject: string;
    statItem: string;
    name: string;
    unitPrice: number;
    quantity: number;
    amount: number;
    memo?: string;
    date: string;
  }) => void;
}

function formatN(n: number) {
  return (n || 0).toLocaleString('ko-KR');
}

export const QuickPlanModal: React.FC<QuickPlanModalProps> = ({
  isOpen,
  onClose,
  category,
  currentRemaining,
  onSavePlan,
}) => {
  const [name, setName] = useState('');
  const [unitPriceStr, setUnitPriceStr] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [memo, setMemo] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);

  const unitPrice = useMemo(() => {
    const clean = unitPriceStr.replace(/[^0-9]/g, '');
    return clean ? parseInt(clean, 10) : 0;
  }, [unitPriceStr]);

  const totalAmount = useMemo(() => {
    return unitPrice * Math.max(1, quantity);
  }, [unitPrice, quantity]);

  const expectedBalanceAfterPlan = useMemo(() => {
    return currentRemaining - totalAmount;
  }, [currentRemaining, totalAmount]);

  const handleUnitPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (!raw) {
      setUnitPriceStr('');
      return;
    }
    const num = parseInt(raw, 10);
    setUnitPriceStr(num.toLocaleString('ko-KR'));
  };

  const handleFillAllRemaining = useCallback(() => {
    if (currentRemaining > 0) {
      setUnitPriceStr(currentRemaining.toLocaleString('ko-KR'));
      setQuantity(1);
    }
  }, [currentRemaining]);

  const handleClose = useCallback(() => {
    setName('');
    setUnitPriceStr('');
    setQuantity(1);
    setMemo('');
    setError(null);
    onClose();
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;

    if (!name.trim()) {
      setError('소진 계획(품목/내역명)을 입력해 주세요.');
      return;
    }
    if (totalAmount <= 0) {
      setError('금액을 1원 이상 입력해 주세요.');
      return;
    }

    onSavePlan({
      categoryId: category.id,
      detailedProject: category.detailedProject || '기타사업',
      statItem: category.statItem || category.name,
      name: name.trim(),
      unitPrice,
      quantity: Math.max(1, quantity),
      amount: totalAmount,
      memo: memo.trim() || undefined,
      date,
    });

    handleClose();
  };

  if (!isOpen || !category) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="불용 방지 소진 계획(지출 예정) 등록"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category Header Card */}
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>대상 세부사업 / 과목</span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
              {category.formationItem || category.statItem || '일반'}
            </span>
          </div>
          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {category.name}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-xs">
            <span className="text-slate-600 dark:text-slate-400">현재 미집행 잔액</span>
            <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400 text-sm">
              {formatN(currentRemaining)}원
            </span>
          </div>
        </div>

        {/* Input: Plan Item Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>지출 계획명 (품목 / 집행 사유)</span>
            <span className="text-[11px] font-normal text-slate-400">예: 피복비 구매, 하반기 강사수당 등</span>
          </label>
          <input
            type="text"
            required
            placeholder="지출 예정 품목명 또는 계획 내용을 입력하세요"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Inputs: Unit Price & Quantity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                단가 (원)
              </label>
              <button
                type="button"
                onClick={handleFillAllRemaining}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                title="남은 잔액 전액을 단가로 입력"
              >
                잔액 전액 채우기
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="0"
                value={unitPriceStr}
                onChange={handleUnitPriceChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono text-right pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">원</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              수량
            </label>
            <input
              type="number"
              min="1"
              max="99999"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Expected Amount & Burn-down Simulation Preview */}
        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-indigo-800 dark:text-indigo-300 font-bold flex items-center gap-1.5">
              <Calculator size={14} /> 총 계획 예정액
            </span>
            <span className="font-mono font-black text-indigo-700 dark:text-indigo-200 text-base">
              {formatN(totalAmount)}원
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-indigo-200/50 dark:border-indigo-900/60 text-xs">
            <span className="text-slate-600 dark:text-slate-400">계획 반영 후 예상 잔액</span>
            <div className="flex items-center gap-1.5 font-mono font-bold">
              {expectedBalanceAfterPlan < 0 ? (
                <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle size={13} /> {formatN(expectedBalanceAfterPlan)}원 (예산 초과)
                </span>
              ) : expectedBalanceAfterPlan === 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} /> 0원 (100% 완전 소진)
                </span>
              ) : (
                <span className="text-slate-700 dark:text-slate-300">
                  {formatN(expectedBalanceAfterPlan)}원
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Execution Date & Memo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              예정 집행 일자
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              비고 / 메모 (선택)
            </label>
            <input
              type="text"
              placeholder="예: 4분기 집행 예정"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            취소
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Sparkles size={14} />
            소진 계획 등록
          </button>
        </div>
      </form>
    </Modal>
  );
};
