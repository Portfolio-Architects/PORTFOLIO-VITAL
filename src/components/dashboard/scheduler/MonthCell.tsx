'use client';

import React, { useCallback } from 'react';
import { MonthSchedulePill } from './MonthSchedulePill';
import { MonthCellProps, formatDateStr, getTypeConfig } from './types';

export const MonthCell = React.memo(({
  day,
  currentMonth,
  schedules,
  isToday = false,
  onOpenModal,
  onDropCell,
  onEditSchedule
}: MonthCellProps) => {
  const dayStr = formatDateStr(day);
  const isCurrentMonth = day.getMonth() === currentMonth;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    onDropCell(e, dayStr);
  }, [onDropCell, dayStr]);

  const handleClick = useCallback(() => {
    onOpenModal(dayStr);
  }, [onOpenModal, dayStr]);

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`min-h-[90px] max-h-[110px] p-1.5 rounded-xl border flex flex-col justify-start transition-colors duration-150 cursor-pointer ${
        isCurrentMonth 
          ? 'bg-white/40 border-slate-200/50 hover:bg-white' 
          : 'bg-slate-100/20 border-transparent text-slate-300'
      } ${isToday ? 'ring-2 ring-indigo-500/60 bg-indigo-50/10' : ''}`}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <span className={`text-[11px] font-bold ${
          isToday 
            ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center' 
            : isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
        }`}>
          {day.getDate()}
        </span>
        {schedules.length > 0 && (
          <span className="text-[9px] font-bold text-slate-400">
            {schedules.length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 overflow-y-auto max-h-[70px] custom-scrollbar">
        {schedules.map((s) => (
          <MonthSchedulePill
            key={s.id}
            schedule={s}
            config={getTypeConfig(s.type)}
            onEdit={onEditSchedule}
          />
        ))}
      </div>
    </div>
  );
});

MonthCell.displayName = 'MonthCell';
