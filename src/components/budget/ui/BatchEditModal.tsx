/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { BudgetCategory } from '@/types';
import { Modal } from '@/components/ui/modal';
import { Plus, X } from 'lucide-react';

interface BatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  categories: BudgetCategory[];
  onApply: (updates: Partial<BudgetCategory>, fundingSplits?: { source: string; ratio: string }[]) => void;
}

function BatchEditModalComponent({ isOpen, onClose, title, categories, onApply }: BatchEditModalProps) {
  const [batchBudgetType, setBatchBudgetType] = useState<'본예산' | '간주예산' | '추경' | ''>('');
  const [batchFundingSplits, setBatchFundingSplits] = useState<{source: string, ratio: string}[]>([{source: '', ratio: ''}]);

  const totalBudgetsSum = React.useMemo(() => {
    let sum = 0;
    for (let i = 0; i < categories.length; i++) {
      sum += (categories[i].totalBudget || 0);
    }
    return sum;
  }, [categories]);

  useEffect(() => {
    if (isOpen) {
      setBatchBudgetType('');
      setBatchFundingSplits([{source: '', ratio: ''}]);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(`선택된 [${title}] 내 ${categories.length}개 과목을 일괄 수정하시겠습니까?`)) return;

    const hasBatchRatios = batchFundingSplits.some(s => s.ratio);
    const totalRatio = batchFundingSplits.reduce((sum, s) => sum + Number(s.ratio || 0), 0);
    
    if (hasBatchRatios && Math.abs(totalRatio - 100) > 0.01) {
      alert(`배분 비율의 합이 100%가 되어야 합니다. 현재: ${totalRatio}%`);
      return;
    }

    const updates: Partial<BudgetCategory> = {};
    if (batchBudgetType !== '') {
      updates.budgetType = batchBudgetType;
    }

    onApply(updates, hasBatchRatios ? batchFundingSplits : undefined);
  };

  const inputClass = "w-full border-slate-200 border rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition-all bg-white";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`[${title}] 일괄 수정`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-50 border border-slate-200/80 text-slate-600 p-3 rounded-lg text-xs leading-relaxed">
          해당 그룹에 속한 <b className="text-slate-900 font-semibold">{categories.length}개</b>의 모든 하위 과목 예산/재원 구분을 일괄 변경합니다.<br/>
          (빈칸으로 둔 항목은 기존 값을 유지합니다.)
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 block">예산 구분 변경 (선택)</label>
          <select value={batchBudgetType} onChange={e => setBatchBudgetType(e.target.value as "" | "본예산" | "간주예산" | "추경")} className={inputClass}>
            <option value="">변경 안함 (기존 유지)</option>
            <option value="본예산">본예산</option>
            <option value="간주예산">간주예산</option>
            <option value="추경">추경</option>
          </select>
        </div>

        <div className="space-y-2 pt-3 border-t border-slate-100">
          <label className="text-xs font-semibold text-slate-700 block">하위 항목 재원 일괄 재분배 (선택사항)</label>
          <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">{totalBudgetsSum.toLocaleString('ko-KR')} <span className="text-xs font-medium text-slate-500">원</span></div>
          <div className="text-[11px] text-slate-500 mt-1 text-left bg-slate-50 border border-slate-200/60 p-2.5 rounded-lg leading-relaxed">일괄 적용 기능은 총 예산액을 몰라도 쉽게 입력할 수 있도록 <b className="text-slate-700">퍼센트(%)</b>로 입력받습니다. 여기서 입력하신 비율이 하위 {categories.length}개 단위/통계목들의 각 예산액 규모에 비례해 정확한 금액으로 자동 하향 분배 지정됩니다. 변경을 원하지 않으면 비워두세요.</div>
          
          <div className="bg-slate-50/70 border border-slate-200/80 p-3 rounded-xl space-y-2 mt-2">
            <div className="flex gap-2 mb-1.5 px-1">
              <div className="flex-1 text-[11px] font-semibold text-slate-500">재원명</div>
              <div className="w-24 text-[11px] font-semibold text-slate-500 text-right">분배 비율 (%)</div>
              <div className="w-8"></div>
            </div>
            {batchFundingSplits.map((split, i) => (
              <div key={`batch-split-${split.source}-${i}`} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="구비, 시비 등"
                  value={split.source}
                  onChange={e => {
                    const newSplits = [...batchFundingSplits];
                    newSplits[i].source = e.target.value;
                    setBatchFundingSplits(newSplits);
                  }}
                  className="flex-1 bg-white border-slate-200 border rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-slate-400"
                />
                <input
                  type="number"
                  placeholder="%"
                  value={split.ratio}
                  onChange={e => {
                    const newSplits = [...batchFundingSplits];
                    newSplits[i].ratio = e.target.value;
                    setBatchFundingSplits(newSplits);
                  }}
                  className="w-24 bg-white border-slate-200 border rounded-lg px-2.5 py-1.5 text-xs text-right outline-none focus:border-slate-400 font-semibold text-slate-800 tabular-nums"
                />
                <div className="w-8 flex justify-center">
                  {i === batchFundingSplits.length - 1 ? (
                    <button type="button" onClick={() => setBatchFundingSplits([...batchFundingSplits, {source: '시비', ratio: ''}])} className="text-slate-600 p-1 hover:bg-slate-200/60 rounded transition-colors"><Plus size={15}/></button>
                  ) : (
                    <button type="button" onClick={() => setBatchFundingSplits(batchFundingSplits.filter((_, idx) => idx !== i))} className="text-rose-500 p-1 hover:bg-rose-50 rounded transition-colors"><X size={15}/></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-xs">취소</button>
          <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium text-xs">일괄 적용하기</button>
        </div>
      </form>
    </Modal>
  );
}

BatchEditModalComponent.displayName = 'BatchEditModal';
export const BatchEditModal = React.memo(BatchEditModalComponent);
