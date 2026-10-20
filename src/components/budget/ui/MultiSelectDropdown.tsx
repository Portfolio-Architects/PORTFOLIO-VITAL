import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

export type DropdownOption = string | { value: string; suffix?: string };

function getOptValue(opt: DropdownOption): string {
  return typeof opt === 'string' ? opt : opt.value;
}

function getOptSuffix(opt: DropdownOption): string {
  return typeof opt === 'string' ? '' : opt.suffix || '';
}

interface MultiSelectDropdownProps {
  label: string; 
  options: DropdownOption[]; 
  selected: string[]; 
  onChange: (val: string[]) => void;
  disabled?: boolean;
}

function MultiSelectDropdownComponent({ 
  label, 
  options, 
  selected, 
  onChange,
  disabled
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isAll = selected.length === 0;

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (optStr: string) => {
    if (selectedSet.has(optStr)) {
      const next: string[] = [];
      for (let i = 0; i < selected.length; i++) {
        if (selected[i] !== optStr) next.push(selected[i]);
      }
      onChange(next);
    } else {
      onChange([...selected, optStr]);
    }
  };

  return (
    <div className="relative inline-block w-full sm:w-auto sm:min-w-[160px] sm:max-w-[210px]">
      <button 
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)} 
        className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
          disabled 
            ? 'opacity-45 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400' 
            : isAll 
              ? 'bg-slate-50/70 border-slate-200/90 text-slate-600 hover:bg-slate-100/80 hover:border-slate-300' 
              : 'bg-slate-900 border-slate-900 text-white'
        }`}
      >
        <span className="truncate">{isAll ? `${label} 전체` : `${selected.length}개 선택됨${selected.length === 1 ? ` (${selected[0]})` : ''}`}</span>
        <ChevronDown size={13} className={`shrink-0 ml-1.5 transition-transform ${isOpen ? 'rotate-180' : ''} ${isAll ? 'text-slate-400' : 'text-slate-300'}`} />
      </button>
      
      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto min-w-[200px] py-1">
            <div 
              className="flex items-center px-3 py-2 cursor-pointer hover:bg-slate-50 border-b border-slate-100"
              onClick={() => { onChange([]); setIsOpen(false); }}
            >
              <input type="checkbox" checked={isAll} readOnly className="mr-2 accent-slate-900 rounded" />
              <span className="text-xs font-semibold text-slate-800">{label} 전체</span>
            </div>
            {options.map((opt, i) => {
              const val = getOptValue(opt);
              const suffix = getOptSuffix(opt);
              return (
                <div 
                  key={`${val}-${i}`}
                  className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-slate-50 group"
                  onClick={() => toggle(val)}
                >
                  <div className="flex items-center min-w-[120px] max-w-[200px] pr-3">
                    <input type="checkbox" checked={selectedSet.has(val)} readOnly className="mr-2 flex-shrink-0 accent-slate-900 rounded" />
                    <span className="text-xs text-slate-700 truncate" title={val}>{val}</span>
                  </div>
                  {suffix && <span className="text-[11px] font-mono text-slate-400 group-hover:text-slate-600 whitespace-nowrap">{suffix}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

MultiSelectDropdownComponent.displayName = 'MultiSelectDropdown';
export const MultiSelectDropdown = React.memo(MultiSelectDropdownComponent);
