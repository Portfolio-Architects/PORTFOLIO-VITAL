'use client';

import React, { useCallback } from 'react';
import { TimetableScheduleItem } from './TimetableScheduleItem';
import { TimetableSlotCellProps, getTypeConfig } from './types';

export const TimetableSlotCell = React.memo(({
  dayStr,
  hourStr,
  nextHourStr,
  schedules,
  onOpenCellModal,
  onDropCell,
  onEditSchedule
}: TimetableSlotCellProps) => {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    onDropCell(e, dayStr, `${hourStr}:00`);
  }, [onDropCell, dayStr, hourStr]);

  const handleClick = useCallback(() => {
    onOpenCellModal(dayStr, `${hourStr}:00`, `${nextHourStr}:00`);
  }, [onOpenCellModal, dayStr, hourStr, nextHourStr]);

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      className="p-1 border-r border-slate-100 hover:bg-indigo-50/20 transition-colors cursor-pointer flex flex-col gap-1 min-h-[50px]"
      title={`${dayStr} ${hourStr}:00 일정 등록 (클릭)`}
    >
      {schedules.map((s) => (
        <TimetableScheduleItem
          key={s.id}
          schedule={s}
          config={getTypeConfig(s.type)}
          onEdit={onEditSchedule}
        />
      ))}
    </div>
  );
});

TimetableSlotCell.displayName = 'TimetableSlotCell';
