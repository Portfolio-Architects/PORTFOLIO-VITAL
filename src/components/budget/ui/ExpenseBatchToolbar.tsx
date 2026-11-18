'use client';

import React from 'react';
import { CheckCircle2, Clock, AlertCircle, Trash2, X } from 'lucide-react';

export interface ExpenseBatchToolbarProps {
  selectedCount: number;
  onSettleApprove?: () => void;
  onStatusChange: (status: 'SETTLED' | 'PENDING' | 'REJECTED') => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

function ExpenseBatchToolbarComponent({
  selectedCount,
  onSettleApprove,
  onStatusChange,
  onDelete,
  onClearSelection
}: ExpenseBatchToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-slate-900/95 text-slate-100 border border-slate-700/80 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-3 sm:gap-4 text-xs font-semibold select-none">
        
        {/* Selected Count Indicator */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700/80">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
          <span className="font-extrabold text-white text-sm tracking-tight">
            {selectedCount}<span className="text-xs text-slate-300 font-normal ml-1">개 선택됨</span>
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* 일괄 승인 */}
          <button
            onClick={() => onSettleApprove ? onSettleApprove() : onStatusChange('SETTLED')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors duration-150 shadow-md active:scale-95 cursor-pointer"
            title="선택한 항목을 모두 정산(결제) 완료 처리"
          >
            <CheckCircle2 size={15} />
            <span>일괄 승인</span>
          </button>

          {/* 대기 */}
          <button
            onClick={() => onStatusChange('PENDING')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors duration-150 shadow-md active:scale-95 cursor-pointer"
            title="선택한 항목을 품의 진행중(대기) 상태로 변경"
          >
            <Clock size={15} />
            <span>대기</span>
          </button>

          {/* 반려 */}
          <button
            onClick={() => onStatusChange('REJECTED')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors duration-150 shadow-md active:scale-95 cursor-pointer"
            title="선택한 항목을 지출 반려 처리"
          >
            <AlertCircle size={15} />
            <span>반려</span>
          </button>

          {/* 선택 삭제 */}
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold transition-colors duration-150 shadow-md active:scale-95 cursor-pointer"
            title="선택한 항목 일괄 삭제"
          >
            <Trash2 size={15} />
            <span>선택 삭제</span>
          </button>
        </div>

        {/* 선택 해제 */}
        <button
          onClick={onClearSelection}
          className="ml-1 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors duration-150 cursor-pointer flex items-center gap-1 px-2.5"
          title="선택 해제"
        >
          <X size={15} />
          <span className="text-[11px] font-medium hidden sm:inline">선택 해제</span>
        </button>
      </div>
    </div>
  );
}

ExpenseBatchToolbarComponent.displayName = 'ExpenseBatchToolbar';
export const ExpenseBatchToolbar = React.memo(ExpenseBatchToolbarComponent);

