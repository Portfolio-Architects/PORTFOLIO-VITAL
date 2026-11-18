/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useMemo } from 'react';
import { BudgetCategory, BudgetEntry, BudgetActionType, BudgetSubItem, BudgetCalculation } from '@/types';
import { Modal } from '@/components/ui/modal';
import { CategoryStats } from '@/hooks/useBudget';

interface ExpenseEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  getCategoryStats: (id: string) => CategoryStats | null;
  initialData: Partial<BudgetEntry> | null;
  preselectedCategoryId?: string;
  onSave: (isEdit: boolean, id: string | null, data: Partial<BudgetEntry>) => void;
  onOpenCategoryModal?: () => void;
}

const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow";

function ExpenseEntryModalComponent({
  isOpen,
  onClose,
  categories,
  entries,
  getCategoryStats,
  initialData,
  preselectedCategoryId,
  onSave,
  onOpenCategoryModal
}: ExpenseEntryModalProps) {
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryPurpose, setEntryPurpose] = useState('');
  const [entryDocNum, setEntryDocNum] = useState('');
  const [entryMemo, setEntryMemo] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [actionType, setActionType] = useState<BudgetActionType>('general');
  const [entryLinkedSubItemId, setEntryLinkedSubItemId] = useState('');
  const [fundingSource, setFundingSource] = useState<string>('');
  const [transferDirection, setTransferDirection] = useState<'in' | 'out'>('in');
  const [isPlanned, setIsPlanned] = useState<boolean>(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const isEdit = initialData && 'id' in initialData && !!initialData.id;
  const editEntryId = isEdit ? (initialData as BudgetEntry).id : null;

  useEffect(() => {
    if (!isOpen) {
      setEntryError(null);
      return;
    }

    if (initialData) {
      setSelectedCatId(initialData.categoryId || preselectedCategoryId || '');
      setEntryAmount(initialData.amount ? initialData.amount.toLocaleString('ko-KR') : '');
      setEntryPurpose(initialData.purpose || '');
      setEntryMemo(initialData.memo || '');
      setEntryDocNum(initialData.docRegNum || '');
      setEntryLinkedSubItemId(initialData.linkedSubItemId || '');
      setActionType(initialData.actionType || 'general');
      setFundingSource(initialData.fundingSource || '');
      setTransferDirection(initialData.transferDirection || 'in');
      setIsPlanned(initialData.isPlanned || false);
      if (initialData.date) setEntryDate(initialData.date);
    } else {
      setSelectedCatId(preselectedCategoryId || '');
      setEntryAmount('');
      setEntryPurpose('');
      setEntryMemo('');
      setEntryDocNum('');
      setEntryLinkedSubItemId('');
      setActionType('general');
      setFundingSource('');
      setTransferDirection('in');
      setIsPlanned(false);
      setEntryDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, initialData, preselectedCategoryId]);

  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const entriesMap = useMemo(() => new Map(entries.map(e => [e.id, e])), [entries]);

  const selectedCategory = useMemo(() => {
    return (selectedCatId ? categoriesMap.get(selectedCatId) : undefined) || null;
  }, [categoriesMap, selectedCatId]);

  const { subItemMap, parentSubItemMap } = useMemo(() => {
    const subMap = new Map<string, BudgetSubItem | BudgetCalculation>();
    const parentMap = new Map<string, BudgetSubItem>();
    if (selectedCategory?.subItems) {
      for (const sub of selectedCategory.subItems) {
        if (sub.id) subMap.set(sub.id, sub);
        if (sub.calculations) {
          for (const calc of sub.calculations) {
            if (calc.id) {
              subMap.set(calc.id, calc);
              parentMap.set(calc.id, sub);
            }
          }
        }
      }
    }
    return { subItemMap: subMap, parentSubItemMap: parentMap };
  }, [selectedCategory]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId || !entryAmount || !entryDate || !entryPurpose) {
      setEntryError('모든 필수 항목을 입력해주세요.');
      return;
    }
    const cat = categoriesMap.get(selectedCatId);
    if (!cat) {
      setEntryError('유효하지 않은 예산 과목입니다.');
      return;
    }

    if (actionType === 'transfer' || actionType === 'correction') {
      if (!entryLinkedSubItemId) {
         setEntryError(`${actionType === 'transfer' ? '이용/전용' : '정정'} 대상 산출내역을 반드시 지정해야 합니다.`);
         return;
      }
    }

    if (actionType === 'settle') {
      if (!entryLinkedSubItemId) {
        setEntryError('정산(결산) 대상 산출내역을 선택해야 합니다.');
        return;
      }
      let hasExistingSettlement = false;
      for (let i = 0; i < entries.length; i++) {
        const en = entries[i];
        if (en.categoryId === selectedCatId && en.linkedSubItemId === entryLinkedSubItemId && en.actionType === 'settle' && en.id !== editEntryId) {
          hasExistingSettlement = true;
          break;
        }
      }
      if (hasExistingSettlement) {
        setEntryError('해당 산출내역에 이미 정산(결산) 항목이 존재합니다. 하나의 산출내역당 하나의 정산만 가능합니다.');
        return;
      }
    }

    const amt = Number(entryAmount.replace(/,/g, ''));
    if (isNaN(amt)) {
      setEntryError('올바른 금액 형식이 아닙니다.');
      return;
    }
    if (amt <= 0) {
      setEntryError('[입력 금액 오류] 지출 금액은 0원보다 커야 합니다.');
      return;
    }

    // -- VALIDATION START --
    if (entryLinkedSubItemId && actionType !== 'settle') {
      const targetSubItem: BudgetSubItem | BudgetCalculation | undefined = subItemMap.get(entryLinkedSubItemId);
      
      if (targetSubItem) {
        const linkedEntries = entries.filter(en => en.categoryId === selectedCatId && en.linkedSubItemId === entryLinkedSubItemId && en.id !== editEntryId && en.actionType !== 'settle');
        
        const currentUsage = linkedEntries.reduce((sum, en) => {
          if (en.actionType === 'correction') return sum + en.amount;
          if (en.actionType === 'transfer') {
            if (en.transferDirection === 'out') return sum + en.amount;
            return sum - en.amount;
          }
          return sum + en.amount;
        }, 0);

        const isTransferIn = actionType === 'transfer' && transferDirection === 'in';
        const newUsage = isTransferIn ? currentUsage - amt : currentUsage + amt;
        const subLimit = targetSubItem.amount;

        if (subLimit > 0 && newUsage > subLimit) {
          setEntryError(`[산출내역 한도 초과] 선택한 산출내역('${targetSubItem.name || targetSubItem.calculation}')의 한도(${subLimit.toLocaleString()}원)를 초과하여 등록을 차단합니다. (현재 누적: ${currentUsage.toLocaleString()}원 / 신규: ${amt.toLocaleString()}원)`);
          return;
        }

        const isSelfLocked = targetSubItem.isLocked;
        let isParentLocked = false;
        const parentSub = parentSubItemMap.get(entryLinkedSubItemId);
        if (parentSub && parentSub.isLocked) isParentLocked = true;

        if (isSelfLocked || isParentLocked) {
          setEntryError(`[잠금 상태] 선택한 산출내역('${targetSubItem.name || targetSubItem.calculation}')은 예산 지출이 방지(잠금)되어 있습니다.`);
          return;
        }
      }
    }

    if (actionType === 'daily_expense') {
      const stats = getCategoryStats(selectedCatId);
      const dailyRemaining = stats ? stats.dailyExpenseRemaining : 0;
      let adjustment = amt;
      if (editEntryId) {
        const oldEntry = entriesMap.get(editEntryId);
        if (oldEntry && oldEntry.actionType === 'daily_expense') {
          adjustment = amt - oldEntry.amount;
        }
      }
      if (adjustment > dailyRemaining) {
        setEntryError(`[일상경비 한도 초과] 일상경비 교부 잔액(${dailyRemaining.toLocaleString()}원)을 초과하여 등록을 차단합니다. (초과 금액: ${(adjustment - dailyRemaining).toLocaleString()}원)`);
        return;
      }
    }

    if (actionType !== 'settle' && actionType !== 'daily_expense') {
      const stats = getCategoryStats(selectedCatId);
      const spent = stats ? stats.spent : 0;
      const planned = stats ? stats.planned : 0;
      const locked = stats ? stats.locked : 0;
      
      let adjustment = amt;
      if (actionType === 'transfer' && transferDirection === 'in') {
        adjustment = -amt;
      }
      
      if (editEntryId) {
        const oldEntry = entriesMap.get(editEntryId);
        if (oldEntry) {
          let oldAmountEffect = oldEntry.amount;
          if (oldEntry.actionType === 'transfer' && oldEntry.transferDirection !== 'out') {
            oldAmountEffect = -oldEntry.amount;
          } else if (oldEntry.actionType === 'settle' || oldEntry.actionType === 'daily_expense') {
            oldAmountEffect = 0;
          }
          adjustment = adjustment - oldAmountEffect;
        }
      }
      
      const totalUsage = isPlanned
        ? spent + planned + locked + adjustment
        : spent + locked + adjustment;
      
      if (cat.totalBudget > 0 && totalUsage > cat.totalBudget) {
        const availableBudget = isPlanned
          ? cat.totalBudget - spent - planned - locked
          : cat.totalBudget - spent - locked;
        setEntryError(`[예산 한도 초과] 등록하려는 금액이 해당 예산 과목의 잔액(가용 예산: ${availableBudget.toLocaleString()}원)을 초과하여 등록을 차단합니다. (누적 예정액: ${totalUsage.toLocaleString()}원 / 총예산: ${cat.totalBudget.toLocaleString()}원)`);
        return;
      }
    }
    // -- VALIDATION END --

    onSave(isEdit || false, editEntryId, {
      categoryId: selectedCatId,
      amount: amt,
      date: entryDate,
      purpose: entryPurpose,
      memo: entryMemo,
      docRegNum: entryDocNum,
      linkedSubItemId: entryLinkedSubItemId || undefined,
      actionType,
      isPlanned,
      fundingSource: fundingSource || undefined,
      transferDirection: actionType === 'transfer' ? transferDirection : undefined
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '지출/집행 내역 수정' : '새 지출/집행 내역 등록'}>
      <form onSubmit={handleSave} className="space-y-4">
        {entryError && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 font-bold">{entryError}</div>}
        
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">항목 유형 (필수)</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'general', label: '일반 지출', desc: '일반적인 예산 집행' },
              { id: 'settle', label: '정산(결산)', desc: '지출 확정 및 결산' },
              { id: 'correction', label: '정정', desc: '기존 지출내역 금액 정정' },
              { id: 'transfer', label: '이용/전용', desc: '다른 산출항목으로 예산 이동' },
              { id: 'issuance', label: '일상경비 교부', desc: '일상경비 재원 배정(교부)' },
              { id: 'daily_expense', label: '일상경비 지출', desc: '교부된 일상경비 범위 내 지출' },
            ].map(type => (
              <label key={type.id} className={`flex flex-col p-2.5 rounded-lg border-2 cursor-pointer transition-colors duration-150 ${actionType === type.id ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50'}`}>
                <div className="flex items-center gap-2">
                  <input type="radio" name="actionType" value={type.id} checked={actionType === type.id} onChange={() => {
                     setActionType(type.id as BudgetActionType);
                     setEntryError(null);
                  }} className="text-blue-600 focus:ring-blue-500 border-gray-300" />
                  <span className={`font-bold text-[13px] ${actionType === type.id ? 'text-blue-700' : 'text-gray-700'}`}>{type.label}</span>
                </div>
                <span className="text-[10px] text-gray-500 mt-1 pl-5">{type.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {actionType === 'transfer' && (
          <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 mb-4 animate-in fade-in duration-200">
            <label className="block text-xs font-bold text-purple-700 mb-2.5 uppercase tracking-wider">이용/전용 방향 (선택)</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                <input type="radio" name="transferDirection" value="in" checked={transferDirection === 'in'} onChange={() => setTransferDirection('in')} className="text-purple-600 focus:ring-purple-500" />
                <span>전입 (예산 증액)</span>
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                <input type="radio" name="transferDirection" value="out" checked={transferDirection === 'out'} onChange={() => setTransferDirection('out')} className="text-purple-600 focus:ring-purple-500" />
                <span>전출 (예산 감액)</span>
              </label>
            </div>
          </div>
        )}

        {/* 지출 성격 구분 (실지출 vs 품의) */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 mb-4">
          <label className="block text-xs font-semibold text-slate-700 mb-2">지출 성격 구분</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
              <input 
                type="radio" 
                name="isPlanned" 
                checked={!isPlanned} 
                onChange={() => setIsPlanned(false)} 
                className="text-blue-600 focus:ring-blue-500 border-gray-300 w-4 h-4" 
              />
              <span className="flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 실제 지출 (결제 완료)
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
              <input 
                type="radio" 
                name="isPlanned" 
                checked={isPlanned} 
                onChange={() => setIsPlanned(true)} 
                className="text-amber-600 focus:ring-amber-500 border-gray-300 w-4 h-4" 
              />
              <span className="flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> 지출 품의 (가배정/계획)
              </span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">대상 예산 과목</label>
          <div className="flex gap-2">
            <select value={selectedCatId} onChange={e => {
              setSelectedCatId(e.target.value);
              setEntryLinkedSubItemId('');
            }} className={inputClass} style={{ flex: 1 }} required>
              <option value="">과목을 선택하세요</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>[{cat.detailedProject || '미지정 사업'}] {cat.name} ({cat.totalBudget.toLocaleString()}원)</option>
              ))}
            </select>
            {onOpenCategoryModal && (
              <button type="button" onClick={onOpenCategoryModal} className="px-3 py-2 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors whitespace-nowrap">
                + 새 과목
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">재원 출처</label>
          <select value={fundingSource} onChange={e => setFundingSource(e.target.value)} className={inputClass}>
            <option value="">선택 안함</option>
            <option value="국비">국비</option>
            <option value="시비">시비</option>
            <option value="구비">구비</option>
            <option value="기타">기타</option>
          </select>
        </div>

        {selectedCategory?.subItems && selectedCategory.subItems.length > 0 && (
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
             <label className="block text-xs font-bold text-gray-700 mb-1.5 flex justify-between items-center">
                <span>연결 대상 산출내역 {(actionType === 'transfer' || actionType === 'correction' || actionType === 'settle') && <span className="text-red-500">* (이 유형은 선택 필수)</span>}</span>
             </label>
             <select value={entryLinkedSubItemId} onChange={e => setEntryLinkedSubItemId(e.target.value)} className={inputClass}>
               <option value="">-- 산출내역 연결 안함 (과목 전체 포괄지출) --</option>
               {selectedCategory.subItems.flatMap((sub, sIdx) => {
                  const opts = [];
                  const subKey = sub.id || `sub-${sIdx}`;
                  const subVal = sub.id || sub.name || `sub-${sIdx}`;
                  if (!sub.calculations || sub.calculations.length === 0) {
                     opts.push(<option key={subKey} value={subVal}>[상위] {sub.name || sub.calculation} ({sub.amount.toLocaleString()}원) {sub.isLocked ? '🔒잠금' : ''}</option>);
                  } else {
                     opts.push(<option key={subKey} value={subVal} disabled className="font-bold bg-gray-100 text-gray-400">📁 {sub.name} (하위항목 선택바람) {sub.isLocked ? '🔒잠금' : ''}</option>);
                     sub.calculations.forEach((calc, cIdx) => {
                        const calcKey = calc.id || `calc-${sIdx}-${cIdx}`;
                        const calcVal = calc.id || calc.name || `calc-${sIdx}-${cIdx}`;
                        opts.push(<option key={calcKey} value={calcVal}>&nbsp;&nbsp;&nbsp;↳ {calc.name || calc.calculation} ({(calc.amount || 0).toLocaleString()}원) {calc.isLocked ? '🔒잠금' : ''}</option>);
                     });
                  }
                  return opts;
               })}
             </select>
             {entryLinkedSubItemId && (
               <div className="mt-2 text-[11px] text-gray-600 font-medium">
                 💡 선택한 산출내역에 지출 내역이 매핑되어 개별 잔액이 관리됩니다.
               </div>
             )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">금액 (원)</label><input type="text" value={entryAmount} onChange={e => { const val = e.target.value.replace(/[^0-9]/g, ''); setEntryAmount(val ? Number(val).toLocaleString() : ''); }} className={`${inputClass} text-lg font-bold text-gray-900`} required placeholder="0" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">결제/집행일</label><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputClass} required /></div>
        </div>

        <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">품의/문서 번호 (옵션)</label><input type="text" value={entryDocNum} onChange={e => setEntryDocNum(e.target.value)} className={inputClass} placeholder="예: 보건행정과-1234" /></div>
        <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">지출 목적/내용</label><input type="text" value={entryPurpose} onChange={e => setEntryPurpose(e.target.value)} className={inputClass} required placeholder="예: 3월 찾아가는 보건소 물품 구입" /></div>
        <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">상세 메모/비고 (옵션)</label><textarea value={entryMemo} onChange={e => setEntryMemo(e.target.value)} className={inputClass} rows={2} placeholder="추가 설명이나 특이사항을 입력하세요" /></div>
        
        <button type="submit" className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-opacity-90 transition-colors font-bold w-full mt-2">
          {editEntryId ? '지출 내역 저장' : '새 지출내역 등록'}
        </button>
      </form>
    </Modal>
  );
}

ExpenseEntryModalComponent.displayName = 'ExpenseEntryModal';
export const ExpenseEntryModal = React.memo(ExpenseEntryModalComponent);
