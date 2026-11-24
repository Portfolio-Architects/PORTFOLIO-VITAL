'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Calculator, Sparkles, RotateCcw, Plus, Check, X, AlertCircle, Coins, Building2, Lock } from 'lucide-react';
import { SimulationEntry, BudgetActionType, StatItemSimulationSummary } from '@/types';

export interface SimulationInputFormProps {
  detailedProjects: string[];
  getStatItemsForProject: (dp: string) => string[];
  statItemSummaries?: StatItemSimulationSummary[];
  editingEntry?: SimulationEntry | null;
  onAddEntry: (entry: Omit<SimulationEntry, 'id' | 'createdAt' | 'amount'> & { amount?: number }) => void;
  onUpdateEntry: (id: string, partial: Partial<SimulationEntry>) => void;
  onCancelEdit?: () => void;
  onResetAll?: () => void;
  onLoadTestPreset?: () => void;
  embedded?: boolean;
}

export const SimulationInputForm: React.FC<SimulationInputFormProps> = React.memo(({
  detailedProjects,
  getStatItemsForProject,
  statItemSummaries,
  editingEntry,
  onAddEntry,
  onUpdateEntry,
  onCancelEdit,
  onResetAll,
  onLoadTestPreset,
  embedded = false,
}) => {
  // Internal Form State
  const [name, setName] = useState(() => editingEntry?.name || '');
  const [detailedProject, setDetailedProject] = useState(() => editingEntry?.detailedProject || '');
  const [statItem, setStatItem] = useState(() => editingEntry?.statItem || '');
  const [actionType, setActionType] = useState<BudgetActionType>(() => editingEntry?.actionType || 'general');
  const [unitPriceStr, setUnitPriceStr] = useState(() =>
    editingEntry
      ? (editingEntry.unitPrice ? editingEntry.unitPrice.toLocaleString('ko-KR') : (editingEntry.id ? '0' : ''))
      : ''
  );
  const [quantity, setQuantity] = useState<number>(() => editingEntry?.quantity || 1);
  const [memo, setMemo] = useState(() => editingEntry?.memo || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync form state during render when editingEntry changes
  const [prevEditingEntry, setPrevEditingEntry] = useState<SimulationEntry | null | undefined>(editingEntry);
  if (editingEntry !== prevEditingEntry) {
    setPrevEditingEntry(editingEntry);
    if (editingEntry) {
      setName(editingEntry.name || '');
      setDetailedProject(editingEntry.detailedProject || '');
      setStatItem(editingEntry.statItem || '');
      setActionType(editingEntry.actionType || 'general');
      setUnitPriceStr(
        editingEntry.unitPrice ? editingEntry.unitPrice.toLocaleString('ko-KR') : (editingEntry.id ? '0' : '')
      );
      setQuantity(editingEntry.quantity || 1);
      setMemo(editingEntry.memo || '');
      setValidationError(null);
    } else {
      setName('');
      setDetailedProject('');
      setStatItem('');
      setActionType('general');
      setUnitPriceStr('');
      setQuantity(1);
      setMemo('');
      setValidationError(null);
    }
  }

  // Derived numeric unit price & auto-calculated amount (Consolidated memoization)
  const { unitPrice, calculatedAmount } = useMemo(() => {
    const raw = unitPriceStr.replace(/,/g, '');
    const num = parseInt(raw, 10);
    const parsedUnitPrice = isNaN(num) ? 0 : num;
    const amount = Math.max(0, parsedUnitPrice) * Math.max(1, quantity);
    return { unitPrice: parsedUnitPrice, calculatedAmount: amount };
  }, [unitPriceStr, quantity]);

  // Current Stat Item Summary for Balance & Daily Expense Info
  const currentStatSummary = useMemo(() => {
    if (!detailedProject || !statItem || !statItemSummaries) return null;
    return statItemSummaries.find(
      s => s.detailedProject === detailedProject && s.statItem === statItem
    ) || null;
  }, [detailedProject, statItem, statItemSummaries]);

  const dailyExpenseIssued = currentStatSummary?.dailyExpenseIssued || 0;
  const dailyExpenseSpent = currentStatSummary?.dailyExpenseSpent || 0;
  const dailyExpenseRemaining = currentStatSummary?.dailyExpenseRemaining || 0;
  const generalRemaining = currentStatSummary?.currentRemaining || 0;
  const currentBidSaving = currentStatSummary?.simulatedBidSaving || 0;
  const hasDailyExpense = dailyExpenseIssued > 0;
  const effectiveActionType: BudgetActionType = actionType;
  const isBidSaving = effectiveActionType === 'bid_saving';
  const isEditMode = Boolean(editingEntry && editingEntry.id);

  // When editing an existing PLANNED daily_expense entry on the same project/statItem,
  // its own existing amount is already subtracted in dailyExpenseRemaining, so add it back up to (dailyExpenseIssued - dailyExpenseSpent).
  const effectiveDailyExpenseLimit = useMemo(() => {
    const isEditingSameDailyEntry =
      isEditMode &&
      editingEntry &&
      editingEntry.status !== 'SETTLED' &&
      editingEntry.actionType === 'daily_expense' &&
      editingEntry.detailedProject === detailedProject &&
      editingEntry.statItem === statItem;

    if (!isEditingSameDailyEntry) return dailyExpenseRemaining;
    const maxUnspentDaily = Math.max(0, dailyExpenseIssued - dailyExpenseSpent);
    return Math.min(maxUnspentDaily, dailyExpenseRemaining + (editingEntry.amount || 0));
  }, [isEditMode, editingEntry, detailedProject, statItem, dailyExpenseRemaining, dailyExpenseIssued, dailyExpenseSpent]);

  // Cascading Stat Item Options
  const statItemOptions = useMemo(() => {
    if (!detailedProject) return [];
    return getStatItemsForProject(detailedProject);
  }, [detailedProject, getStatItemsForProject]);

  // Handle detailedProject change
  const handleDetailedProjectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDp = e.target.value;
    setDetailedProject(newDp);
    if (!newDp) {
      setStatItem('');
      return;
    }
    const validStatItems = getStatItemsForProject(newDp);
    if (statItem && !validStatItems.includes(statItem)) {
      setStatItem(validStatItems[0] || '');
    }
  }, [statItem, getStatItemsForProject]);

  // Format unit price input with thousand separators
  const handleUnitPriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    if (!rawVal) {
      setUnitPriceStr('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setUnitPriceStr(num.toLocaleString('ko-KR'));
  }, []);

  // Form Submit Handler
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('항목명 입력 필요');
      return;
    }
    if (!detailedProject) {
      setValidationError('세부사업 선택 필요');
      return;
    }
    if (!statItem) {
      setValidationError('통계목 선택 필요');
      return;
    }
    if (unitPrice <= 0) {
      setValidationError('단가 0원 초과 입력 필요');
      return;
    }

    // Daily expense limit check (non-blocking: allows simulation with shortfall warning)
    if (effectiveActionType === 'daily_expense') {
      // Entry is permitted even if exceeding current balance to allow planned additional issuance simulation
    }

    if (isEditMode && editingEntry) {
      onUpdateEntry(editingEntry.id, {
        name: name.trim(),
        detailedProject,
        statItem,
        actionType: effectiveActionType,
        unitPrice,
        quantity,
        amount: calculatedAmount,
        memo: memo.trim(),
      });
      if (onCancelEdit) onCancelEdit();
    } else {
      const preservedCategoryId =
        editingEntry?.categoryId &&
        editingEntry.detailedProject === detailedProject &&
        editingEntry.statItem === statItem
          ? editingEntry.categoryId
          : undefined;
      onAddEntry({
        name: name.trim(),
        detailedProject,
        statItem,
        categoryId: preservedCategoryId,
        actionType: effectiveActionType,
        unitPrice,
        quantity,
        amount: calculatedAmount,
        memo: memo.trim(),
      });
      // Reset input fields
      setName('');
      setUnitPriceStr('');
      setQuantity(1);
      setMemo('');
      if (editingEntry && onCancelEdit) onCancelEdit();
    }
  }, [name, detailedProject, statItem, effectiveActionType, unitPrice, quantity, calculatedAmount, memo, isEditMode, editingEntry, onAddEntry, onUpdateEntry, onCancelEdit]);

  return (
    <div className={embedded ? 'space-y-4 text-slate-800' : 'bg-white border border-slate-200/80 rounded-xl p-5 md:p-6 shadow-2xs space-y-5 text-slate-800'}>
      {/* Panel Header (hidden when embedded inside SimulationInputModal) */}
      {!embedded && (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-200/80 flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              {isEditMode ? '지출 예정 항목 수정' : '확정 지출 예정 내역 입력'}
            </h3>
            <p className="vlds-subtitle text-xs text-slate-400">
              세부사업 · 통계목 · 단가 · 수량 등록
            </p>
          </div>
        </div>

        {/* Global Preset & Reset Actions */}
        <div className="flex items-center gap-2">
          {onLoadTestPreset && (
            <button
              type="button"
              onClick={onLoadTestPreset}
              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="표준 테스트 항목 로드"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              프리셋 로드
            </button>
          )}
          {onResetAll && (
            <button
              type="button"
              onClick={onResetAll}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50/60 border border-slate-200/80 hover:border-rose-200 text-slate-500 hover:text-rose-600 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="예정 항목 전체 초기화"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              전체 초기화
            </button>
          )}
        </div>
      </div>
      )}

      {/* Validation Error Banner */}
      {validationError && (
        <div className="flex items-center gap-2 p-3 bg-rose-50/80 border border-rose-200/80 rounded-lg text-rose-700 text-xs sm:text-sm font-semibold">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Input Form Grid */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
          {/* 1. Item Name */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>{isBidSaving ? '낙찰차액 항목명' : '지출 예정 항목명'}</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder={isBidSaving ? '예: 양재천 페스티벌 용역 낙찰차액' : '예: AI 헬스체크업 키오스크 구매'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200/90 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>

          {/* 2. Detailed Project Dropdown */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>세부사업 선택</span>
              <span className="text-rose-500">*</span>
            </label>
            <select
              value={detailedProject}
              onChange={handleDetailedProjectChange}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200/90 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-slate-400 transition-colors"
            >
              <option value="">-- 세부사업 선택 --</option>
              {detailedProjects.map((dp) => (
                <option key={dp} value={dp}>{dp}</option>
              ))}
            </select>
          </div>

          {/* 3. Budget Stat Item Dropdown */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>통계목 선택</span>
              <span className="text-rose-500">*</span>
            </label>
            <select
              value={statItem}
              onChange={(e) => setStatItem(e.target.value)}
              disabled={!detailedProject}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200/90 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-slate-400 disabled:opacity-50 transition-colors"
            >
              <option value="">{detailedProject ? '-- 통계목 선택 --' : '-- 세부사업 선선택 --'}</option>
              {statItemOptions.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* 3-1. Expense Source & Type Segmented Selector (일반 지출 vs 일상경비 지출 vs 낙찰차액) */}
          <div className="lg:col-span-12 p-3.5 bg-slate-50/60 border border-slate-200/80 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>지출 재원 · 경비 구분</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-slate-400 font-medium">
                {!detailedProject || !statItem ? (
                  '세부사업 · 통계목 선선택'
                ) : hasDailyExpense ? (
                  '🪙 일상경비 교부 통계목 · 지출 재원 선택'
                ) : (
                  '🪙 일상경비 미교부 · 선택 시 추가 교부 반영'
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: General Expenditure */}
              <button
                type="button"
                onClick={() => {
                  setActionType('general');
                  setValidationError(null);
                }}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer flex items-start gap-2.5 ${
                  effectiveActionType === 'general'
                    ? 'bg-white border-slate-900 shadow-2xs'
                    : 'bg-white/70 border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
                  effectiveActionType === 'general' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className={`text-xs sm:text-[13px] font-bold ${effectiveActionType === 'general' ? 'text-slate-900' : 'text-slate-600'}`}>
                      일반 지출
                    </span>
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded font-mono tabular-nums ${
                      effectiveActionType === 'general' ? 'bg-slate-100 text-slate-900' : 'bg-slate-100 text-slate-500'
                    }`}>
                      가용 {generalRemaining.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                    본청 직접 집행 · 가용 잔액 차감
                  </p>
                </div>
              </button>

              {/* Option 2: Daily Expense */}
              <button
                type="button"
                onClick={() => {
                  setActionType('daily_expense');
                  setValidationError(null);
                }}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer flex items-start gap-2.5 ${
                  effectiveActionType === 'daily_expense'
                    ? 'bg-amber-50/40 border-amber-500 shadow-2xs'
                    : 'bg-white/70 border-slate-200/80 hover:border-amber-300'
                }`}
              >
                <div className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
                  effectiveActionType === 'daily_expense' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Coins className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className={`text-xs sm:text-[13px] font-bold ${effectiveActionType === 'daily_expense' ? 'text-amber-950' : 'text-slate-600'}`}>
                      일상경비 지출
                    </span>
                    {hasDailyExpense ? (
                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded font-mono tabular-nums ${
                        effectiveActionType === 'daily_expense' ? 'bg-amber-100 text-amber-900' : 'bg-amber-50 text-amber-700'
                      }`}>
                        미집행 {effectiveDailyExpenseLimit.toLocaleString('ko-KR')}원
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-mono">
                        미교부 (추가 교부 필요)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                    {hasDailyExpense
                      ? `교부 ₩${dailyExpenseIssued.toLocaleString('ko-KR')} · 미집행 차감`
                      : '교부 0원 · 추가 교부 반영'}
                  </p>
                </div>
              </button>

              {/* Option 3: Bid Saving (낙찰차액 · 집행유보 · 불용 확정) */}
              <button
                type="button"
                onClick={() => {
                  setActionType('bid_saving');
                  setValidationError(null);
                }}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer flex items-start gap-2.5 ${
                  isBidSaving
                    ? 'bg-violet-50/50 border-violet-500 shadow-2xs'
                    : 'bg-white/70 border-slate-200/80 hover:border-violet-300'
                }`}
              >
                <div className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
                  isBidSaving ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Lock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className={`text-xs sm:text-[13px] font-bold ${isBidSaving ? 'text-violet-950' : 'text-slate-600'}`}>
                      낙찰차액
                    </span>
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded font-mono tabular-nums ${
                      isBidSaving ? 'bg-violet-100 text-violet-900' : 'bg-violet-50 text-violet-700'
                    }`}>
                      {currentBidSaving > 0 ? `유보 ${currentBidSaving.toLocaleString('ko-KR')}원` : '집행유보 · 불용'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                    가용 잔액 차감 · 집행률 미포함
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 4. Unit Price Input */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>단가 (원)</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="0"
              value={unitPriceStr}
              onChange={handleUnitPriceChange}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200/90 rounded-lg text-slate-900 text-sm text-right focus:outline-none focus:border-slate-400 transition-colors font-mono tabular-nums font-bold"
            />
          </div>

          {/* 5. Quantity Input */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>수량</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200/90 rounded-lg text-slate-900 text-sm text-center focus:outline-none focus:border-slate-400 transition-colors font-mono tabular-nums font-bold"
            />
          </div>

          {/* 6. Total Amount Auto-Calculation */}
          <div className="lg:col-span-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                {isBidSaving ? '낙찰차액 유보액 (자동 계산)' : '총 예정 집행액 (자동 계산)'}
              </label>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                effectiveActionType === 'daily_expense'
                  ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                  : isBidSaving
                    ? 'bg-violet-50 text-violet-800 border-violet-200/80'
                    : 'bg-slate-100 text-slate-700 border-slate-200/80'
              }`}>
                {effectiveActionType === 'daily_expense'
                  ? '🪙 일상경비 잔액 차감'
                  : isBidSaving
                    ? '🔒 가용 차감 · 집행률 제외'
                    : '🏢 본청 예산 차감'}
              </span>
            </div>
            <div className={`w-full px-3.5 py-2.5 rounded-lg font-bold text-base text-right flex items-center justify-between border ${
              effectiveActionType === 'daily_expense'
                ? 'bg-amber-50/40 border-amber-200/80 text-amber-900'
                : isBidSaving
                  ? 'bg-violet-50/40 border-violet-200/80 text-violet-900'
                  : 'bg-slate-50/80 border-slate-200/90 text-slate-900'
            }`}>
              <span className="text-xs font-medium text-slate-400">₩</span>
              <span className="font-mono tabular-nums text-base">{calculatedAmount.toLocaleString('ko-KR')} 원</span>
            </div>
            {effectiveActionType === 'daily_expense' && calculatedAmount > effectiveDailyExpenseLimit && (
              <p className="text-xs font-semibold text-rose-600 mt-0.5">
                ⚠️ 일상경비 잔액 초과 (+{(calculatedAmount - effectiveDailyExpenseLimit).toLocaleString('ko-KR')}원 / 한도 ₩{effectiveDailyExpenseLimit.toLocaleString('ko-KR')}원)
              </p>
            )}
          </div>

          {/* 7. Action Buttons */}
          <div className="lg:col-span-3 flex items-end gap-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isEditMode ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isEditMode ? '수정 완료' : '항목 추가'}
            </button>
            {editingEntry && onCancelEdit && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-lg border border-slate-200/90 transition-colors flex items-center justify-center cursor-pointer"
                title="수정 취소"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 8. Memo Input */}
          <div className="lg:col-span-12 space-y-1.5">
            <label className="text-xs font-bold text-slate-500">산출근거 · 비고 (선택)</label>
            <input
              type="text"
              placeholder="예: AI 메디헬스 결과지 출력 · 분석 키오스크 2대"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200/90 rounded-lg text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>
        </div>
      </form>
    </div>
  );
});

SimulationInputForm.displayName = 'SimulationInputForm';
