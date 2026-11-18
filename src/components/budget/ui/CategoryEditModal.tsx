/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { BudgetCategory, BudgetFundingSplit, BudgetCalculation } from '@/types';
import { Modal } from '@/components/ui/modal';
import { ShieldAlert, X, FileCheck } from 'lucide-react';

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoriesLength: number;
  initialData: BudgetCategory | Partial<BudgetCategory> | null;
  onSave: (isEdit: boolean, id: string | null, data: Partial<BudgetCategory>) => void;
}

interface UIFundingSplit {
  source: string;
  amount: string;
}

interface UICalculation {
  id?: string;
  name?: string;
  calculation: string;
  amount: string;
  isCustomFunding?: boolean;
  fundingSplits?: UIFundingSplit[];
  isLocked?: boolean;
  virtualAdjustment?: number;
  note?: string;
}

interface UISubItem {
  id?: string;
  prefix?: string;
  name: string;
  calculation?: string;
  amount: string;
  isCustomFunding?: boolean;
  fundingSplits?: UIFundingSplit[];
  isLocked?: boolean;
  virtualAdjustment?: number;
  calculations?: UICalculation[];
  note?: string;
}

const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow";

const COLORS = [
  '#4F46E5', '#059669', '#EAB308', '#DC2626', '#7C3AED', '#0891B2', '#EA580C', '#BE185D', '#16A34A', '#2563EB', '#9333EA', '#B45309', '#0284C7', '#86198F', '#4D7C0F'
];

function CategoryEditModalComponent({ isOpen, onClose, categoriesLength, initialData, onSave }: CategoryEditModalProps) {
  const [catBudget, setCatBudget] = useState('');
  const [catPolicy, setCatPolicy] = useState('');
  const [catUnit, setCatUnit] = useState('');
  const [catDetail, setCatDetail] = useState('');
  const [catManagement, setCatManagement] = useState('');
  const [catFormationCode, setCatFormationCode] = useState('');
  const [catFormationName, setCatFormationName] = useState('');
  const [catStatCode, setCatStatCode] = useState('');
  const [catStatName, setCatStatName] = useState('');
  const [catBudgetType, setCatBudgetType] = useState<'본예산' | '간주예산' | '추경'>('본예산');
  const [catFundingSplits, setCatFundingSplits] = useState<UIFundingSplit[]>([{source: '구비', amount: ''}]);
  const [catSubItems, setCatSubItems] = useState<UISubItem[]>([{prefix: '', name: '', calculation: '', amount: '', isCustomFunding: false, fundingSplits: [{source: '구비', amount: ''}], calculations: []}]);

  const isEdit = initialData && 'id' in initialData && !!initialData.id;
  const editCatId = isEdit ? (initialData as BudgetCategory).id : null;

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setCatBudget(initialData.totalBudget ? initialData.totalBudget.toLocaleString() : '');
      setCatPolicy(initialData.policyProject || ''); 
      setCatUnit(initialData.unitProject || '');
      setCatDetail(initialData.detailedProject || ''); 
      setCatManagement(initialData.managementProject || '');
      
      const formationStr = initialData.formationItem || '';
      const codeMatch = formationStr.match(/^(\d{3})\s*(.+)$/);
      if (codeMatch) {
        setCatFormationCode(codeMatch[1]);
        setCatFormationName(codeMatch[2]);
      } else {
        setCatFormationCode(formationStr.slice(0,3).replace(/\D/g, ''));
        setCatFormationName(formationStr.replace(/^\d+\s*/, '').trim() || formationStr);
      }
      
      const statStr = initialData.statItem || '';
      const statMatch = statStr.match(/^([\d-]+)\s*(.+)$/);
      if (statMatch) {
        setCatStatCode(statMatch[1]);
        setCatStatName(statMatch[2]);
      } else {
        setCatStatCode(statStr.replace(/[^\d-]/g, ''));
        setCatStatName(statStr.replace(/^[\d-]+\s*/, '').trim() || statStr);
      }
      
      setCatBudgetType(initialData.budgetType || '본예산');
      
      if (initialData.fundingSplits && initialData.fundingSplits.length > 0) {
        setCatFundingSplits(initialData.fundingSplits.map((s: BudgetFundingSplit) => ({ source: s.source, amount: s.amount ? s.amount.toLocaleString() : '' })));
      } else {
        const rawFunding = initialData.fundingSource || '구비';
        const parsedSplits = [];
        const parts = rawFunding.split(',');
        for (const p of parts) {
          const match = p.trim().match(/(.+) \((.+)%\)/);
          if (match) {
            const ratioObj = Number(match[2]);
            const computedAmount = initialData.totalBudget && initialData.totalBudget > 0 ? (initialData.totalBudget * ratioObj) / 100 : 0;
            parsedSplits.push({ source: match[1].trim(), amount: computedAmount > 0 ? Math.round(computedAmount).toLocaleString() : '' });
          } else if (p.trim()) {
            parsedSplits.push({ source: p.trim(), amount: initialData.totalBudget ? initialData.totalBudget.toLocaleString() : '' });
          }
        }
        if (parsedSplits.length === 0) parsedSplits.push({ source: '구비', amount: '' });
        setCatFundingSplits(parsedSplits);
      }
      
      if (initialData.subItems && initialData.subItems.length > 0) {
        setCatSubItems(initialData.subItems.map((s) => ({ 
          id: s.id,
          prefix: s.prefix || '', 
          name: s.name, 
          calculation: s.calculation || '', 
          amount: s.amount ? s.amount.toLocaleString() : '', 
          isCustomFunding: s.isCustomFunding || false,
          isLocked: s.isLocked || false,
          virtualAdjustment: s.virtualAdjustment || 0,
          note: s.note || '',
          fundingSplits: s.fundingSplits && s.fundingSplits.length > 0 ? s.fundingSplits.map((fs) => ({ source: fs.source, amount: fs.amount ? fs.amount.toLocaleString() : '' })) : [{source: '구비', amount: ''}],
          calculations: s.calculations ? s.calculations.map((c) => ({ id: c.id, name: c.name || undefined, calculation: c.calculation || "", amount: c.amount ? c.amount.toLocaleString() : "", isCustomFunding: c.isCustomFunding || false, isLocked: c.isLocked || false, virtualAdjustment: c.virtualAdjustment || 0, note: c.note || '', fundingSplits: c.fundingSplits && c.fundingSplits.length > 0 ? c.fundingSplits.map((fs) => ({source: fs.source, amount: fs.amount ? fs.amount.toLocaleString() : ""})) : [{source: "구비", amount: ""}] })) : []
        })));
      } else {
        setCatSubItems([{prefix: '', name: '', calculation: '', amount: '', isCustomFunding: false, fundingSplits: [{source: '구비', amount: ''}], calculations: []}]);
      }
    } else {
      setCatBudget(''); setCatPolicy(''); setCatUnit(''); setCatDetail(''); setCatManagement(''); 
      setCatFormationCode(''); setCatFormationName(''); setCatStatCode(''); setCatStatName(''); 
      setCatBudgetType('본예산'); 
      setCatFundingSplits([{source: '구비', amount: ''}]); 
      setCatSubItems([{prefix: '', name: '', calculation: '', amount: '', isCustomFunding: false, isLocked: false, fundingSplits: [{source: '구비', amount: ''}], calculations: []}]);
    }
  }, [isOpen, initialData]);

  // 하단 세부 산출내역의 개별재원을 종합하여 상단 재원 분할에 자동 반영
  useEffect(() => {
    const totals: Record<string, number> = {};
    let hasCustomFunding = false;
    let customFundingTotal = 0;

    catSubItems.forEach((sub: UISubItem) => {
      if (sub.isCustomFunding && sub.fundingSplits) {
        hasCustomFunding = true;
        sub.fundingSplits.forEach((fs: UIFundingSplit) => {
          const amt = Number((fs.amount || '0').replace(/,/g, ''));
          if (amt > 0) {
            totals[fs.source] = (totals[fs.source] || 0) + amt;
            customFundingTotal += amt;
          }
        });
      } else {
        const subHasCalc = sub.calculations && sub.calculations.length > 0;
        if (subHasCalc && sub.calculations) {
          sub.calculations.forEach((calc: UICalculation) => {
            if (calc.isCustomFunding && calc.fundingSplits) {
              hasCustomFunding = true;
              calc.fundingSplits.forEach((fs: UIFundingSplit) => {
                const amt = Number((fs.amount || '0').replace(/,/g, ''));
                if (amt > 0) {
                  totals[fs.source] = (totals[fs.source] || 0) + amt;
                  customFundingTotal += amt;
                }
              });
            }
          });
        }
      }
    });

    if (hasCustomFunding) {
      const targetBudget = Number(catBudget.replace(/,/g, ''));
      const remaining = targetBudget - customFundingTotal;
      if (remaining > 0) {
        totals['구비'] = (totals['구비'] || 0) + remaining;
      }

      const newSplits = Object.entries(totals).map(([source, amt]) => ({
        source,
        amount: amt.toLocaleString()
      }));

      const currentClean = catFundingSplits.map(s => ({ source: s.source, amount: (s.amount || '0').replace(/,/g, '') })).sort((a,b) => a.source.localeCompare(b.source));
      const newClean = newSplits.map(s => ({ source: s.source, amount: s.amount.replace(/,/g, '') })).sort((a,b) => a.source.localeCompare(b.source));
      
      if (JSON.stringify(currentClean) !== JSON.stringify(newClean) && newSplits.length > 0) {
        setCatFundingSplits(newSplits);
      }
    }
  }, [catSubItems, catBudget, catFundingSplits]);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const targetBudget = Number(catBudget.replace(/,/g, ''));
    if (!targetBudget) return;

    const combinedFormation = catFormationCode ? `${catFormationCode} ${catFormationName}`.trim() : catFormationName;
    const combinedStat = catStatCode ? `${catStatCode} ${catStatName}`.trim() : catStatName;
    const finalName = combinedStat || combinedFormation || '무명 예산과목';
    
    const hasAmounts = catFundingSplits.some((s: UIFundingSplit) => s.amount);
    const totalAmount = catFundingSplits.reduce((sum: number, s: UIFundingSplit) => sum + Number((s.amount || '0').replace(/,/g, '')), 0);
    
    if (hasAmounts && totalAmount > 0 && Math.abs(totalAmount - targetBudget) > 10) {
      alert(`입력하신 재원 금액 합계(${totalAmount.toLocaleString()}원)가 총 예산액(${targetBudget.toLocaleString()}원)과 일치하지 않습니다.`);
      return;
    }

    const fundingParts: string[] = [];
    const finalSplitsArray: BudgetFundingSplit[] = [];
    for (let i = 0; i < catFundingSplits.length; i++) {
      const s = catFundingSplits[i];
      const amt = Number((s.amount || '0').replace(/,/g, ''));
      if (amt > 0) {
        finalSplitsArray.push({ source: s.source, amount: amt });
        const r = targetBudget > 0 ? (amt / targetBudget) * 100 : 0;
        fundingParts.push(`${s.source} (${r.toFixed(2)}%)`);
      }
    }
    const finalFunding = fundingParts.length > 0 ? fundingParts.join(', ') : '구비';

    const finalSubItemsArray = catSubItems.map((s: UISubItem) => {
      const calcArray = (s.calculations || []).map((calc: UICalculation) => {
        const res: BudgetCalculation = {
          id: calc.id || crypto.randomUUID(),
          calculation: calc.calculation,
          amount: Number((calc.amount || '0').replace(/,/g, ''))
        };
        if (calc.name) res.name = calc.name;
        if (calc.isLocked !== undefined) res.isLocked = calc.isLocked;
        if (calc.virtualAdjustment !== undefined) res.virtualAdjustment = calc.virtualAdjustment;
        if (calc.note !== undefined) res.note = calc.note;
        if (calc.isCustomFunding) {
          res.isCustomFunding = true;
          res.fundingSplits = calc.fundingSplits && calc.fundingSplits.length > 0 ? calc.fundingSplits.map((fs: UIFundingSplit) => ({source: fs.source, amount: Number((fs.amount || '0').replace(/,/g, ''))})).filter((fs: {amount: number}) => fs.amount > 0) : undefined;
        }
        return res;
      }).filter((c: BudgetCalculation) => c.calculation.trim() !== '' || c.amount > 0);
      
      const isParent = calcArray.length > 0;
      const computedAmount = isParent ? calcArray.reduce((sum: number, c: BudgetCalculation) => sum + c.amount, 0) : Number((s.amount || '0').replace(/,/g, ''));
 
      return {
        id: s.id || crypto.randomUUID(),
        prefix: s.prefix || undefined,
        name: s.name,
        calculation: isParent ? undefined : s.calculation,
        amount: computedAmount,
        isCustomFunding: s.isCustomFunding,
        isLocked: s.isLocked,
        virtualAdjustment: s.virtualAdjustment || 0,
        note: s.note || '',
        calculations: isParent ? calcArray : undefined,
        fundingSplits: s.isCustomFunding && s.fundingSplits && s.fundingSplits.length > 0 ? s.fundingSplits.map((fs: UIFundingSplit) => ({
          source: fs.source,
          amount: Number((fs.amount || '0').replace(/,/g, ''))
        })).filter((fs: {amount: number}) => fs.amount > 0) : undefined
      };
    }).filter((s) => s.name.trim() !== '' || (s.prefix && s.prefix.trim() !== '') || s.amount > 0 || (s.calculations && s.calculations.length > 0) || (s.calculation && s.calculation.trim() !== ''));

    const updates: Partial<BudgetCategory> = {
      name: finalName, 
      totalBudget: targetBudget, 
      policyProject: catPolicy, 
      unitProject: catUnit, 
      detailedProject: catDetail, 
      managementProject: catManagement || undefined, 
      subItems: finalSubItemsArray, 
      formationItem: combinedFormation, 
      statItem: combinedStat, 
      budgetType: catBudgetType, 
      fundingSource: finalFunding, 
      fundingSplits: finalSplitsArray
    };
    
    if (!isEdit) {
      updates.color = COLORS[categoriesLength % COLORS.length];
    }

    onSave(isEdit || false, editCatId, updates);
    alert('저장되었습니다.');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '예산 과목 수정' : '새 예산 과목'} size="xl">
        <form onSubmit={handleAddCategory} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">정책사업명</label><input type="text" value={catPolicy} onChange={e => setCatPolicy(e.target.value)} className={inputClass} placeholder="예: 건강도시조성" /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">단위사업명</label><input type="text" value={catUnit} onChange={e => setCatUnit(e.target.value)} className={inputClass} placeholder="예: 찾아가는 보건소" /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">세부사업명</label><input type="text" value={catDetail} onChange={e => setCatDetail(e.target.value)} className={inputClass} placeholder="예: 방문간호운영" /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">관리사업명 (선택)</label><input type="text" value={catManagement} onChange={e => setCatManagement(e.target.value)} className={inputClass} placeholder="예: 구강보건 (재원분리용)" /></div>

            <div className="col-span-2 mb-2">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">예산 구분</label>
              <div className="flex gap-4">
                {['본예산', '간주예산', '추경'].map(type => (
                  <label key={type} className="flex items-center gap-1.5 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded-md transition-colors">
                    <input type="radio" name="catBudgetType" value={type} checked={catBudgetType === type} onChange={() => setCatBudgetType(type as '본예산' | '간주예산' | '추경')} className="text-[var(--color-primary)] border-gray-300 focus:ring-[var(--color-primary)]" />
                    {type}
                  </label>
                ))}
              </div>
            </div>
            
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 flex justify-between">
                <span>총 예산액 (원) *</span>
                <span className="text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 px-2 rounded-full">수동 입력 필수</span>
              </label>
              <input type="text" value={catBudget} onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setCatBudget(val ? Number(val).toLocaleString() : '');
              }} className={`${inputClass} text-lg font-bold text-gray-900 pr-10`} required placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">편성목 *</label>
              <div className="flex gap-2">
                <input type="text" value={catFormationCode} onChange={e => setCatFormationCode(e.target.value.replace(/\D/g, '').slice(0, 3))} className={`${inputClass} text-center font-mono`} style={{ width: '80px', flex: '0 0 80px' }} required placeholder="예: 201" maxLength={3} />
                <input type="text" value={catFormationName} onChange={e => setCatFormationName(e.target.value)} className={inputClass} style={{ flex: 1 }} required placeholder="예: 일반운영비" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">통계목 *</label>
              <div className="flex gap-2">
                <input type="text" value={catStatCode} onChange={e => setCatStatCode(e.target.value.replace(/[^0-9-]/g, '').slice(0, 6))} className={`${inputClass} text-center font-mono`} style={{ width: '80px', flex: '0 0 80px' }} required placeholder="예: 01" maxLength={6} />
                <input type="text" value={catStatName} onChange={e => setCatStatName(e.target.value)} className={inputClass} style={{ flex: 1 }} required placeholder="예: 사무관리비" />
              </div>
            </div>
            
            <div className="col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2.5 flex justify-between items-center">
                <span className="font-bold flex items-center gap-1.5"><ShieldAlert size={14} className="text-gray-400"/> 재원 구분 및 금액 분할 *</span>
                {(() => {
                  const tb = Number(catBudget.replace(/,/g, ''));
                  const totalAmt = catFundingSplits.reduce((sum: number, s: UIFundingSplit) => sum + Number((s.amount || '0').replace(/,/g, '')), 0);
                  const isMatch = tb > 0 && totalAmt === tb;
                  return (
                    <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${isMatch ? 'text-green-700 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                      {isMatch ? '금액 일치 정상' : `확인중 (${totalAmt.toLocaleString()}원)`}
                    </span>
                  );
                })()}
              </label>
              <div className="space-y-2.5">
                {catFundingSplits.map((split, idx) => (
                  <div key={`split-${split.source}-${idx}`} className="flex gap-2 items-center">
                    <select value={split.source} onChange={e => {
                      const newSplits = [...catFundingSplits];
                      newSplits[idx].source = e.target.value;
                      setCatFundingSplits(newSplits);
                    }} className={`${inputClass} font-medium`} style={{ width: '140px', flex: '0 0 140px' }}>
                      <option value="국비">국비</option>
<option value="기금">기금</option>
<option value="시비">시비</option>
<option value="구비">구비</option>
<option value="특별교부세">특별교부세</option>
                    </select>
                    
                    <div className="relative flex-1">
                      <input type="text" value={split.amount} onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        const newSplits = [...catFundingSplits];
                        newSplits[idx].amount = val ? Number(val).toLocaleString() : '';
                        setCatFundingSplits(newSplits);
                      }} className={`${inputClass} pr-8 text-right font-bold text-gray-800`} placeholder="금액 입력" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">원</span>
                    </div>

                    <div className="w-16 shrink-0 flex items-center justify-center">
                      <span className="text-[13px] font-black text-[var(--color-primary)]">
                        {(() => {
                           const a = Number((split.amount || '0').replace(/,/g, ''));
                           const b = Number(catBudget.replace(/,/g, ''));
                           if (b === 0) return '0%';
                           const r = (a / b) * 100;
                           return r.toFixed(2) + '%';
                        })()}
                      </span>
                    </div>
                    {catFundingSplits.length > 1 ? (
                      <button type="button" onClick={() => {
                        const newSplits = catFundingSplits.filter((_, i) => i !== idx);
                        setCatFundingSplits(newSplits);
                      }} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" title="이 재원 삭제"><X size={16}/></button>
                    ) : (
                      <div className="w-8 shrink-0"></div>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setCatFundingSplits([...catFundingSplits, {source: '구비', amount: ''}])} className="text-[13px] text-blue-600 font-bold hover:underline flex items-center gap-1 mt-1.5 px-1 py-1 rounded hover:bg-blue-50 transition-colors">+ 재원 추가</button>
              </div>
            </div>
<div className="col-span-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100 mt-2">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2.5 flex justify-between items-center">
                <span className="font-bold flex items-center gap-1.5 text-indigo-800"><FileCheck size={14} className="text-indigo-400"/> 세부 산출 내역 (옵션)</span>
                {(() => {
                  const tb = Number(catBudget.replace(/,/g, ''));
                  const totalSub = catSubItems.reduce((sum: number, s: UISubItem) => {
                    if (s.calculations && s.calculations.length > 0) {
                      return sum + s.calculations.reduce((subSum: number, c: UICalculation) => subSum + Number((c.amount || '0').replace(/,/g, '')), 0);
                    }
                    return sum + Number((s.amount || '0').replace(/,/g, ''));
                  }, 0);
                  const isMatch = tb > 0 && totalSub === tb;
                  if (totalSub === 0 && catSubItems.length <= 1 && (!catSubItems[0] || !catSubItems[0].amount)) return null;
                  return (
                    <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${isMatch ? 'text-green-700 bg-green-100' : 'text-amber-600 bg-amber-100'}`}>
                      {isMatch ? '총액 일치 정상' : `부분 합산중 (${totalSub.toLocaleString()}원)`}
                    </span>
                  );
                })()}
              </label>
              <div className="space-y-2.5">
{catSubItems.map((sub, idx) => {
                  const hasCalculations = sub.calculations && sub.calculations.length > 0;
                  const autoComputedAmount = hasCalculations && sub.calculations ? sub.calculations.reduce((s: number, c: UICalculation) => s + Number((c.amount || '0').replace(/,/g, '')), 0) : null;
                  const displayAmount = hasCalculations ? autoComputedAmount?.toLocaleString() : sub.amount;

                  return (
                  <div key={sub.id || `subitem-${sub.prefix || ''}-${sub.name || ''}-${idx}`} className="flex flex-col gap-2 transition-colors duration-200 bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm relative mb-2">
                    <div className="flex gap-2 items-center">
                      <input type="text" value={sub.prefix} onChange={e => {
                          const newSubs = [...catSubItems];
                          newSubs[idx].prefix = e.target.value;
                          setCatSubItems(newSubs);
                      }} onBlur={e => {
                          const val = e.target.value.trim();
                          if (/^\d+$/.test(val)) {
                              const newSubs = [...catSubItems];
                              newSubs[idx].prefix = val + ')';
                              setCatSubItems(newSubs);
                          }
                      }} className={`${inputClass} text-center font-bold text-[12px] px-1 shadow-inner`} style={{ flex: '0 0 45px' }} placeholder="1)" />
                      
                      <input type="text" value={sub.name} onChange={e => {
                          const newSubs = [...catSubItems];
                          newSubs[idx].name = e.target.value;
                          setCatSubItems(newSubs);
                      }} className={`${inputClass} text-[13px] font-bold outline-none ring-0 shadow-inner`} style={{ flex: 1 }} placeholder="항목 본명칭 (예: 어린이신체활동증진)" />
                      
                      {!hasCalculations && (
                        <input type="text" value={sub.calculation || ''} onChange={e => {
                            const newSubs = [...catSubItems];
                            newSubs[idx].calculation = e.target.value;
                            setCatSubItems(newSubs);
                        }} onBlur={e => {
                            const calcStr = e.target.value;
                            if (!calcStr || !calcStr.includes('*')) return;
                            const parts = calcStr.split('*');
                            let total = 1; let valid = false;
                            for (const p of parts) {
                               const isPct = p.includes('%');
                               const numStr = p.replace(/[^0-9.]/g, '');
                               if (numStr) {
                                  const num = parseFloat(numStr);
                                  total *= isPct ? (num / 100) : num;
                                  valid = true;
                               }
                            }
                            if (valid) {
                               const newSubs = [...catSubItems];
                               newSubs[idx].amount = Math.round(total).toLocaleString();
                               setCatSubItems(newSubs);
                            }
                        }} className={`${inputClass} text-[12px] font-mono shadow-inner`} style={{ flex: '0 0 160px' }} placeholder="단일 산출식 (선택)" />
                      )}

                      <div className="relative shrink-0" style={{ flex: '0 0 110px' }}>
                        <input type="text" value={displayAmount || ''} onChange={e => {
                          if (hasCalculations) return; // ReadOnly
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          const newSubs = [...catSubItems];
                          newSubs[idx].amount = val ? Number(val).toLocaleString() : '';
                          setCatSubItems(newSubs);
                        }} className={`${inputClass} pr-7 text-right font-bold transition-colors ${hasCalculations ? 'bg-indigo-50/50 text-indigo-700 pointer-events-none cursor-default shadow-none border-indigo-100' : 'text-gray-900 bg-white shadow-inner'}`} placeholder={hasCalculations ? "자동 합산" : "금액"} readOnly={hasCalculations || false} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-bold pointer-events-none">원</span>
                      </div>

                      <label className="flex items-center gap-1 cursor-pointer shrink-0 ml-1 bg-gray-50 px-2 py-1.5 rounded border border-gray-100 hover:bg-gray-100 transition-colors">
                         <input type="checkbox" checked={sub.isCustomFunding || false} onChange={e => {
                             const newSubs = [...catSubItems];
                             newSubs[idx].isCustomFunding = e.target.checked;
                             if (e.target.checked && (!newSubs[idx].fundingSplits || newSubs[idx].fundingSplits.length === 0)) {
                               newSubs[idx].fundingSplits = [{source: '구비', amount: ''}];
                             }
                             setCatSubItems(newSubs);
                         }} className="w-3.5 h-3.5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer" title="이 항목 전체를 개별재원으로 지정" />
                         <span className={`text-[11px] font-extrabold tracking-tight ${sub.isCustomFunding ? 'text-teal-600' : 'text-gray-400'}`}>개별재원</span>
                      </label>

                      <label className={`flex items-center gap-1 cursor-pointer shrink-0 ml-1 px-2 py-1.5 rounded transition-colors border ${sub.isLocked ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                         <input type="checkbox" checked={sub.isLocked || false} onChange={e => {
                             const newSubs = [...catSubItems];
                             newSubs[idx].isLocked = e.target.checked;
                             if (e.target.checked && newSubs[idx].calculations) {
                               newSubs[idx].calculations.forEach((c: UICalculation) => c.isLocked = false);
                             }
                             setCatSubItems(newSubs);
                         }} className="w-3.5 h-3.5 rounded border-red-300 focus:ring-red-500 cursor-pointer text-red-500" title="이 항목 예산 지출 방지(잠금) 설정" />
                         <span className={`text-[11px] font-extrabold tracking-tight ${sub.isLocked ? 'text-red-600' : 'text-gray-400'}`}>🔒 잠금</span>
                      </label>

                      {catSubItems.length > 1 ? (
                        <button type="button" onClick={() => {
                          const newSubs = catSubItems.filter((_, i) => i !== idx);
                          setCatSubItems(newSubs);
                        }} className="p-1 px-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors ml-1 border border-transparent hover:border-red-100" title="이 최상위 항목 완전 삭제"><X size={16}/></button>
                      ) : (
                        <div className="w-[30px] shrink-0 ml-1"></div>
                      )}
                    </div>

                    {/* Sub-calculations Area */}
                    <div className="ml-[53px] pl-2.5 border-l-[3px] border-indigo-100 py-1 flex flex-col gap-1.5 min-h-[30px]">
                       {sub.calculations && sub.calculations.map((calc, cIdx) => (
                         <div key={calc.id || `calc-${calc.name || ''}-${cIdx}`} className="flex flex-col gap-1 w-full border-b border-indigo-50 border-dashed pb-2 mb-1 last:border-0 last:pb-0 last:mb-0">
                           <div className="flex gap-2 items-center group relative w-full">
                             <span className="text-indigo-200 text-[11px] shrink-0 font-bold ml-1 select-none pr-1">↳</span>
                             
                             <input type="text" value={calc.name || ''} onChange={e => {
                                const newSubs = [...catSubItems];
                                newSubs[idx].calculations![cIdx].name = e.target.value;
                                setCatSubItems(newSubs);
                             }} className={`${inputClass} text-[12px] bg-white border-transparent focus:border-indigo-300 shadow-sm`} style={{ flex: '1 0 auto', maxWidth: '200px' }} placeholder="세부 산출명 (예: 식비)" />
                             
                             <input type="text" value={calc.calculation || ''} onChange={e => {
                                const newSubs = [...catSubItems];
                                newSubs[idx].calculations![cIdx].calculation = e.target.value;
                                setCatSubItems(newSubs);
                             }} onBlur={e => {
                                const calcStr = e.target.value;
                                if (!calcStr || !calcStr.includes('*')) return;
                                const parts = calcStr.split('*');
                                let total = 1; let valid = false;
                                for (const p of parts) {
                                   const isPct = p.includes('%');
                                   const numStr = p.replace(/[^0-9.]/g, '');
                                   if (numStr) {
                                      const num = parseFloat(numStr);
                                      total *= isPct ? (num / 100) : num;
                                      valid = true;
                                   }
                                }
                                if (valid) {
                                   const newSubs = [...catSubItems];
                                   newSubs[idx].calculations![cIdx].amount = Math.round(total).toLocaleString();
                                   setCatSubItems(newSubs);
                                }
                             }} className={`${inputClass} text-[12px] font-mono bg-white border-transparent focus:border-indigo-300 shadow-sm`} style={{ flex: '1' }} placeholder="상세식 (예: 8,000*30)" />
                             
                             <div className="relative shrink-0" style={{ flex: '0 0 130px' }}>
                               <input type="text" value={calc.amount || ''} onChange={e => {
                                 const val = e.target.value.replace(/[^0-9]/g, '');
                                 const newSubs = [...catSubItems];
                                 newSubs[idx].calculations![cIdx].amount = val ? Number(val).toLocaleString() : '';
                                 setCatSubItems(newSubs);
                               }} className={`${inputClass} pr-7 text-[15px] text-right font-extrabold text-slate-700 bg-white border-transparent focus:border-indigo-300 shadow-sm tracking-tight`} placeholder="금액" />
                               <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-bold pointer-events-none">원</span>
                             </div>

                             <label className="flex items-center gap-1 cursor-pointer shrink-0 ml-1 whitespace-nowrap">
                                <input type="checkbox" checked={calc.isCustomFunding || false} onChange={e => {
                                    const newSubs = [...catSubItems];
                                    newSubs[idx].calculations![cIdx].isCustomFunding = e.target.checked;
                                    if (e.target.checked && (!newSubs[idx].calculations![cIdx].fundingSplits || newSubs[idx].calculations![cIdx].fundingSplits!.length === 0)) {
                                      newSubs[idx].calculations![cIdx].fundingSplits = [{source: '구비', amount: ''}];
                                    }
                                    setCatSubItems(newSubs);
                                }} className="w-3.5 h-3.5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer" title="이 세부 항목을 개별재원으로 지정" />
                                <span className={`text-[11px] font-extrabold tracking-tight ${calc.isCustomFunding ? 'text-teal-600' : 'text-gray-400'}`}>재원구분</span>
                             </label>
                             
                             <label className={`flex items-center gap-1 cursor-pointer shrink-0 ml-1 px-1.5 py-1 rounded transition-colors border ${calc.isLocked ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-transparent border-transparent hover:bg-gray-100'}`}>
                                <input type="checkbox" checked={calc.isLocked || false} onChange={e => {
                                    const newSubs = [...catSubItems];
                                    newSubs[idx].calculations![cIdx].isLocked = e.target.checked;
                                    setCatSubItems(newSubs);
                                }} disabled={sub.isLocked} className="w-3.5 h-3.5 text-red-500 rounded border-red-300 focus:ring-red-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" title={sub.isLocked ? "상위 그룹이 이미 잠겨 있습니다" : "이 상세 내역 지출 방지(잠금) 설정"} />
                                <span className={`text-[11px] font-extrabold tracking-tight ${calc.isLocked ? 'text-red-600' : 'text-gray-400'} ${sub.isLocked ? 'opacity-50' : ''}`}>🔒 잠금</span>
                             </label>
                             
                             <button type="button" onClick={() => {
                                const newSubs = [...catSubItems];
                                newSubs[idx].calculations = newSubs[idx].calculations!.filter((_, i) => i !== cIdx);
                                setCatSubItems(newSubs);
                             }} className="p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded transition-colors ml-1" title="상세 산출내역 삭제"><X size={14}/></button>
                           </div>

                           {calc.isCustomFunding && (
                             <div className="ml-[25px] flex flex-col gap-1.5 mt-0.5 pb-1">
                               {calc.fundingSplits && calc.fundingSplits.map((split, fIdx) => (
                                 <div key={`calc-split-${split.source}-${fIdx}`} className="flex items-center gap-1.5 bg-teal-50/50 p-1.5 rounded-md border border-teal-100 w-max shrink-0">
                                   <select value={split.source} onChange={e => {
                                     const newSubs = [...catSubItems];
                                     newSubs[idx].calculations![cIdx].fundingSplits![fIdx].source = e.target.value;
                                     setCatSubItems(newSubs);
                                   }} className="px-2 py-1 text-[12px] bg-white border border-teal-200 rounded font-medium text-teal-800 w-[80px] outline-none">
                                     <option value="국비">국비</option>
                                     <option value="기금">기금</option>
                                     <option value="시비">시비</option>
                                     <option value="구비">구비</option>
                                     <option value="특별교부세">특별교부세</option>
                                   </select>
                                   <div className="relative w-[130px]">
                                     <input type="text" value={split.amount} onChange={e => {
                                       const val = e.target.value.replace(/[^0-9]/g, '');
                                       const newSubs = [...catSubItems];
                                       newSubs[idx].calculations![cIdx].fundingSplits![fIdx].amount = val ? Number(val).toLocaleString() : '';
                                       setCatSubItems(newSubs);
                                     }} className="w-full px-2 py-1.5 text-[12px] text-right bg-white border border-teal-200 rounded font-bold text-teal-900 pr-5 outline-none shadow-sm" placeholder="금액" />
                                     <span className="absolute right-2 top-1/2 -translate-y-1/2 text-teal-500 text-[10px] pointer-events-none">원</span>
                                   </div>
                                   <span className="text-[11px] font-bold text-teal-600 ml-1 w-[40px] inline-block text-right pr-1">
                                     {(() => {
                                        const itemAmt = Number((String(calc.amount) || '0').replace(/,/g, ''));
                                        const fAmt = Number((split.amount || '0').replace(/,/g, ''));
                                        if (itemAmt === 0) return '0%';
                                        return ((fAmt / itemAmt) * 100).toFixed(0) + '%';
                                     })()}
                                   </span>
                                   {(calc.fundingSplits && calc.fundingSplits.length > 1) ? (
                                     <button type="button" onClick={() => {
                                       const newSubs = [...catSubItems];
                                       newSubs[idx].calculations![cIdx].fundingSplits = newSubs[idx].calculations![cIdx].fundingSplits!.filter((_, i) => i !== fIdx);
                                       setCatSubItems(newSubs);
                                     }} className="text-red-400 hover:text-red-600 rounded transition-colors ml-1 p-0.5" title="재원 삭제"><X size={14}/></button>
                                   ) : (
                                     <div className="w-[18px] ml-1"></div>
                                   )}
                                 </div>
                               ))}
                               <div className="flex items-center w-full max-w-[215px] mt-0.5">
                                 <button type="button" onClick={() => {
                                    const newSubs = [...catSubItems];
                                    if (!newSubs[idx].calculations![cIdx].fundingSplits) newSubs[idx].calculations![cIdx].fundingSplits = [];
                                    newSubs[idx].calculations![cIdx].fundingSplits!.push({source: '구비', amount: ''});
                                    setCatSubItems(newSubs);
                                 }} className="text-[10px] text-teal-600 font-bold hover:bg-teal-50 px-1.5 py-1 rounded transition-colors flex-shrink-0">+ 비율 추가</button>

                                 <div className="ml-auto text-[10px] font-bold text-right pl-2">
                                    {(() => {
                                      const itemAmt = Number((String(calc.amount) || '0').replace(/,/g, ''));
                                      const fTotal = (calc.fundingSplits || []).reduce((sum: number, f: UIFundingSplit) => sum + Number((f.amount || '0').replace(/,/g, '')), 0);
                                      if (itemAmt > 0 && fTotal === itemAmt) return <span className="text-teal-600">금액 일치 정상</span>;
                                      return <span className="text-red-500">진행중 ({fTotal.toLocaleString()}원)</span>;
                                    })()}
                                 </div>
                               </div>
                             </div>
                           )}
                         </div>
                       ))}
                       <div className="flex">
                         <button type="button" onClick={() => {
                            const newSubs = [...catSubItems];
                            if (!newSubs[idx].calculations) newSubs[idx].calculations = [];
                            newSubs[idx].calculations.push({ name: '', calculation: '', amount: '' });
                            setCatSubItems(newSubs);
                         }} className="text-[11px] text-indigo-500 font-bold hover:bg-indigo-50 px-2 py-1 rounded transition-colors flex items-center gap-1">+ 종속 산출내역 한 줄 추가</button>
                       </div>
                    </div>

                    {/* Custom Funding Block */}
                    {sub.isCustomFunding && (
                      <div className="mt-1 pt-2 border-t border-gray-100 flex flex-col pl-[53px]">
                        <div className="text-[11px] text-teal-700 font-bold mb-1.5 flex items-center gap-1">
                          ↳ 이 항목(총 {displayAmount || '0'}원)에 대한 개별 재원 매칭
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {sub.fundingSplits && sub.fundingSplits.map((split, fIdx) => (
                            <div key={`sub-split-${split.source}-${fIdx}`} className="flex flex-col gap-0.5 relative group bg-teal-50/50 p-1 rounded border border-teal-100">
                              <div className="flex items-center gap-1">
                                <select value={split.source} onChange={e => {
                                  const newSubs = [...catSubItems];
                                  newSubs[idx].fundingSplits![fIdx].source = e.target.value;
                                  setCatSubItems(newSubs);
                                }} className="px-1.5 py-1 text-[11px] bg-white border border-teal-200 rounded font-medium text-teal-800 w-[70px] outline-none">
                                  <option value="국비">국비</option>
                                  <option value="기금">기금</option>
                                  <option value="시비">시비</option>
                                  <option value="구비">구비</option>
                                  <option value="특별교부세">특교</option>
                                </select>
                                <div className="relative w-[100px]">
                                  <input type="text" value={split.amount} onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    const newSubs = [...catSubItems];
                                    newSubs[idx].fundingSplits![fIdx].amount = val ? Number(val).toLocaleString() : '';
                                    setCatSubItems(newSubs);
                                  }} className="w-full px-2 py-1 text-[11px] text-right bg-white border border-teal-200 rounded font-bold text-teal-900 pr-5 outline-none shadow-sm" placeholder="분할 금액" />
                                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-teal-500 text-[9px] pointer-events-none">원</span>
                                </div>
                                <span className="text-[10px] font-bold text-teal-600 ml-0.5 w-[30px] inline-block text-right pr-1">
                                  {(() => {
                                     const itemAmt = Number((String(displayAmount) || '0').replace(/,/g, ''));
                                     const fAmt = Number((split.amount || '0').replace(/,/g, ''));
                                     if (itemAmt === 0) return '0%';
                                     return ((fAmt / itemAmt) * 100).toFixed(1) + '%';
                                  })()}
                                </span>
                                {(sub.fundingSplits && sub.fundingSplits.length > 1) ? (
                                  <button type="button" onClick={() => {
                                    const newSubs = [...catSubItems];
                                    newSubs[idx].fundingSplits = newSubs[idx].fundingSplits!.filter((_, i) => i !== fIdx);
                                    setCatSubItems(newSubs);
                                  }} className="p-1 text-red-400 hover:bg-white rounded transition-colors" title="재원 삭제"><X size={12}/></button>
                                ) : (
                                  <div className="w-[20px]"></div>
                                )}
                              </div>
                            </div>
                          ))}
                          
                          <button type="button" onClick={() => {
                             const newSubs = [...catSubItems];
                             if (!newSubs[idx].fundingSplits) newSubs[idx].fundingSplits = [];
                             newSubs[idx].fundingSplits!.push({source: '구비', amount: ''});
                             setCatSubItems(newSubs);
                          }} className="text-[10px] text-teal-600 font-bold hover:bg-teal-50 px-2 py-1.5 rounded transition-colors h-[28px]">+ 비율 추가</button>

                          <div className="ml-auto text-[10px] font-bold">
                             {(() => {
                               const itemAmt = Number((String(displayAmount) || '0').replace(/,/g, ''));
                               const fTotal = (sub.fundingSplits || []).reduce((sum: number, f: UIFundingSplit) => sum + Number((f.amount || '0').replace(/,/g, '')), 0);
                               if (itemAmt > 0 && fTotal === itemAmt) return <span className="text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">결과 정상 일치</span>;
                               return <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">합산 진행중 ({fTotal.toLocaleString()}원)</span>;
                             })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
                <button type="button" onClick={() => setCatSubItems([...catSubItems, {prefix: '', name: '', calculation: '', amount: '', isCustomFunding: false, isLocked: false, fundingSplits: [{source: '구비', amount: ''}], calculations: []}])} className="text-[13px] text-indigo-600 font-bold hover:underline flex items-center gap-1 mt-1.5 px-1 py-1 rounded hover:bg-indigo-100 transition-colors">+ 산출내역 한 줄 추가</button>
              </div>
            </div>
          </div>
          <button type="submit" className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-opacity-90 transition-colors font-bold w-full shadow-md shadow-blue-500/20 cursor-pointer text-sm">
            {editCatId ? '예산 과목 저장' : '예산 과목 등록'}
          </button>
        </form>
    </Modal>
  );
}

CategoryEditModalComponent.displayName = 'CategoryEditModal';
export const CategoryEditModal = React.memo(CategoryEditModalComponent);
