'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface InlineEditCellProps {
  value: string | number;
  onSave: (newValue: string) => void;
  onCancel?: () => void;
  onNavigate?: (direction: 'next' | 'prev') => void;
  type?: 'text' | 'number' | 'date';
  className?: string;
  placeholder?: string;
  cellId?: string;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  inputClassName?: string;
  displayFormatter?: (val: string | number) => React.ReactNode;
}

interface EditingInputProps {
  initialValue: string | number;
  type: 'text' | 'number' | 'date';
  cellId?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  onCommit: (newVal: string) => void;
  onCancel: () => void;
  onNavigate?: (direction: 'next' | 'prev') => void;
}

const EditingInput: React.FC<EditingInputProps> = ({
  initialValue,
  type,
  cellId,
  placeholder,
  className = '',
  inputClassName = '',
  onCommit,
  onCancel,
  onNavigate,
}) => {
  const [tempValue, setTempValue] = useState<string>(
    initialValue !== undefined && initialValue !== null ? String(initialValue) : ''
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const isCommittedRef = useRef(false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (typeof inputRef.current.select === 'function') {
        inputRef.current.select();
      }
    }
  }, []);

  const handleCommit = () => {
    if (isCommittedRef.current) return;
    isCommittedRef.current = true;
    onCommit(tempValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleCommit();
      if (onNavigate) {
        onNavigate(e.shiftKey ? 'prev' : 'next');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isCommittedRef.current = true;
      const value = initialValue;
      setTempValue(value !== undefined && value !== null ? String(value) : '');
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      data-cell-id={cellId}
      type={type === 'date' ? 'date' : 'text'}
      value={tempValue}
      onChange={(e) => setTempValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={handleCommit}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={`w-full min-w-0 px-1.5 py-0.5 text-xs border border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded outline-none bg-white font-mono text-slate-900 transition-all ${inputClassName || className}`}
    />
  );
};

export const InlineEditCell = React.memo<InlineEditCellProps>(({
  value,
  onSave,
  onCancel,
  onNavigate,
  type = 'text',
  className = '',
  placeholder = '',
  cellId,
  isEditing,
  onStartEdit,
  onCancelEdit,
  inputClassName = '',
  displayFormatter
}) => {
  const [isInternalEditing, setIsInternalEditing] = useState(false);
  const editing = isEditing !== undefined ? isEditing : isInternalEditing;

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStartEdit) {
      onStartEdit();
    }
    setIsInternalEditing(true);
  };

  const handleExitEdit = () => {
    if (onCancelEdit) {
      onCancelEdit();
    }
    if (onCancel) {
      onCancel();
    }
    setIsInternalEditing(false);
  };

  const handleCommit = (newVal: string) => {
    const cleanStr = type === 'number' ? newVal.replace(/,/g, '').trim() : newVal;
    if (cleanStr !== String(value !== undefined && value !== null ? value : '')) {
      onSave(newVal);
    }
    handleExitEdit();
  };

  if (editing) {
    return (
      <EditingInput
        initialValue={value}
        type={type}
        cellId={cellId}
        placeholder={placeholder}
        className={className}
        inputClassName={inputClassName}
        onCommit={handleCommit}
        onCancel={handleExitEdit}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div
      data-cell-id={cellId}
      onDoubleClick={handleStartEdit}
      onClick={(e) => {
        e.stopPropagation();
      }}
      className={`cursor-pointer hover:bg-slate-100/80 hover:outline hover:outline-1 hover:outline-slate-300 rounded px-1.5 py-0.5 transition-colors select-none ${className}`}
      title="더블클릭하여 빠르게 수정"
    >
      {displayFormatter
        ? displayFormatter(value)
        : (value !== undefined && value !== null && value !== ''
            ? value
            : placeholder || '-')}
    </div>
  );
});

InlineEditCell.displayName = 'InlineEditCell';
