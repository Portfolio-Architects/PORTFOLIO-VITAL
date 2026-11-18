'use client';

import React, { useCallback } from 'react';
import { TimetableScheduleItemProps, timeToMinutes } from './types';

export const TimetableScheduleItem = React.memo(({
  schedule,
  config,
  onEdit
}: TimetableScheduleItemProps) => {
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
      className={`p-1.5 rounded-lg border text-[10px] font-bold flex flex-col gap-0.5 shadow-2xs ${config.bg}`}
    >
      <div className="flex items-center justify-between">
        <span className="truncate">{schedule.title}</span>
        <span className="text-[9px] opacity-75">{schedule.startTime}~{schedule.endTime}</span>
      </div>
      <span className="text-[8.5px] opacity-80">{schedule.person}</span>
    </div>
  );
});

TimetableScheduleItem.displayName = 'TimetableScheduleItem';
