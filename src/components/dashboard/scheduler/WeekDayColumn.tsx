'use client';

import React, { useCallback } from 'react';
import { ScheduleItem } from './ScheduleItem';
import { WeekDayColumnProps, formatDateStr, getTypeConfig } from './types';

export const WeekDayColumn = React.memo(({
  day,
  dayIdx,
  schedules,
  dayNames,
  isToday = false,
  onOpenCellModal,
  onDropCell,
  onDeleteSchedule,
  onEditSchedule
}: WeekDayColumnProps) => {
  const dayStr = formatDateStr(day);
  const dayNum = day.getDate();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    onDropCell(e, dayStr);
  }, [onDropCell, dayStr]);

  const handleHeaderClick = useCallback(() => {
    onOpenCellModal(dayStr);
  }, [onOpenCellModal, dayStr]);

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`flex flex-col bg-white/30 border border-slate-200/40 rounded-2xl p-3 h-full min-h-[200px] md:min-h-[480px] transition-colors duration-150 hover:bg-white/60 hover:shadow-2xs ${
        isToday ? 'bg-indigo-50/10 border-indigo-300/50 shadow-xs ring-1 ring-indigo-500/5' : ''
      }`}
    >
      {/* Header */}
      <div 
        onClick={handleHeaderClick}
        className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/40 cursor-pointer hover:bg-slate-100/50 p-1 rounded-lg transition-colors duration-150 select-none"
        title={`${dayNum}일 직관적 일정 추가 (클릭)`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`text-[12px] font-bold ${
            dayIdx === 5 ? 'text-blue-500' : dayIdx === 6 ? 'text-red-500' : 'text-slate-500'
          }`}>
            {dayNames[dayIdx]}
          </span>
          <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${
            isToday ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-800'
          }`}>
            {dayNum}
          </span>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 bg-slate-200/40 px-1.5 py-0.5 rounded-full shrink-0">
          {schedules.length}건
        </span>
      </div>

      {/* Column Body */}
      <div 
        onClick={handleHeaderClick}
        className="flex flex-col gap-2 overflow-y-auto flex-1 max-h-[360px] md:max-h-none custom-scrollbar min-h-[140px]"
      >
        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-8 text-slate-400 italic text-[11px] font-semibold cursor-pointer">
            + 클릭하여 추가
          </div>
        ) : (
          schedules.map((schedule) => (
            <ScheduleItem
              key={schedule.id}
              schedule={schedule}
              config={getTypeConfig(schedule.type)}
              onDelete={onDeleteSchedule}
              onEdit={onEditSchedule}
            />
          ))
        )}
      </div>
    </div>
  );
});

WeekDayColumn.displayName = 'WeekDayColumn';
