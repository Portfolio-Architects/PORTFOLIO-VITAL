'use client';

import React, { useCallback } from 'react';
import { Clock, FileText, Trash2 } from 'lucide-react';
import { ScheduleItemProps, timeToMinutes } from './types';

export const ScheduleItem = React.memo(({ 
  schedule, 
  config, 
  onDelete,
  onEdit
}: ScheduleItemProps) => {
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`'${schedule.title}' 일정을 삭제하시겠습니까?`)) {
      onDelete(schedule.id);
    }
  }, [onDelete, schedule.id, schedule.title]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    const durationMins = Math.max(30, timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime));
    const payload = JSON.stringify({
      id: schedule.id,
      durationMins,
      startTime: schedule.startTime,
      endTime: schedule.endTime
    });
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.effectAllowed = 'move';
  }, [schedule]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(schedule);
  }, [onEdit, schedule]);

  return (
    <div
      draggable={true}
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={`group relative flex flex-col p-2.5 border rounded-xl transition-colors duration-200 hover:shadow-sm cursor-pointer select-none ${config.bg}`}
      title={`[클릭: 상세/수정 | 드래그: 일정 재배치]\n${schedule.title}\n담당: ${schedule.person}${schedule.notes ? `\n메모: ${schedule.notes}` : ''}`}
    >
      {/* Title & Type Icon */}
      <div className="flex items-start justify-between gap-1.5">
        <span 
          className="text-xs font-bold text-slate-800 tracking-tight leading-tight line-clamp-2 pr-4 cursor-pointer"
        >
          {schedule.title}
        </span>
        <div className="shrink-0 text-slate-500">
          {config.icon}
        </div>
      </div>

      {schedule.endDate && schedule.endDate !== schedule.date && (
        <span className="text-[9px] font-bold text-slate-500 bg-white/80 border border-slate-200/50 px-1.5 py-0.5 rounded-md mt-1.5 self-start select-none">
          기간: {schedule.date.slice(5)} ~ {schedule.endDate.slice(5)}
        </span>
      )}

      {/* Time & Person */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5 shrink-0 text-slate-450" />
          {schedule.startTime} ~ {schedule.endTime}
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate max-w-[65px] text-right bg-white/60">
          {schedule.person}
        </span>
      </div>

      {schedule.notes && (
        <p className="text-[10px] font-semibold text-slate-500 flex items-center gap-0.5 mt-1 border-t border-slate-200/40 pt-1">
          <FileText className="w-2.5 h-2.5 shrink-0 text-slate-450" />
          <span className="truncate max-w-[120px]">
            {schedule.notes}
          </span>
        </p>
      )}

      {/* Trash/Delete Action */}
      <button
        onClick={handleDelete}
        className="absolute top-1 right-1 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer border-0 bg-transparent"
        title="삭제"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
});

ScheduleItem.displayName = 'ScheduleItem';
