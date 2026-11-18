'use client';

import React, { useCallback } from 'react';
import { MonthSchedulePillProps, timeToMinutes } from './types';

export const MonthSchedulePill = React.memo(({
  schedule,
  config,
  onEdit
}: MonthSchedulePillProps) => {
  const handleDragStart = useCallback((e: React.DragEvent) => {
    const durationMins = Math.max(30, timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime));
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: schedule.id,
      durationMins,
      startTime: schedule.startTime,
      endTime: schedule.endTime
    }));
  }, [schedule]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(schedule);
  }, [onEdit, schedule]);

  return (
    <div
      draggable={true}
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate flex items-center justify-between gap-1 shadow-2xs ${config.bg}`}
      title={`${schedule.startTime} ${schedule.title}`}
    >
      <span className="truncate">{schedule.title}</span>
      <span className="text-[8px] opacity-70 shrink-0">{schedule.startTime}</span>
    </div>
  );
});

MonthSchedulePill.displayName = 'MonthSchedulePill';
