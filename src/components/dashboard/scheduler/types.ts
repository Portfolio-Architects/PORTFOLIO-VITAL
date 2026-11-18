'use client';

import React from 'react';
import { ScheduleType, Schedule } from '@/types';
import { Shield, Users, BookOpen, Calendar } from 'lucide-react';

// ============ Time Helper Utilities ============
export const formatDateStr = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// Schedule type style helper (Pre-cached static map for GC-Free O(1) lookup)
export const TYPE_CONFIG_MAP: Record<ScheduleType, { bg: string; badge: string; icon: React.ReactNode }> = {
  security: {
    bg: 'bg-indigo-50/70 border-indigo-100 hover:border-indigo-200 text-indigo-700',
    badge: 'bg-indigo-100/80 text-indigo-800',
    icon: React.createElement(Shield, { className: 'w-3.5 h-3.5' })
  },
  meeting: {
    bg: 'bg-emerald-50/70 border-emerald-100 hover:border-emerald-200 text-emerald-700',
    badge: 'bg-emerald-100/80 text-emerald-800',
    icon: React.createElement(Users, { className: 'w-3.5 h-3.5' })
  },
  education: {
    bg: 'bg-amber-50/70 border-amber-100 hover:border-amber-200 text-amber-700',
    badge: 'bg-amber-100/85 text-amber-800',
    icon: React.createElement(BookOpen, { className: 'w-3.5 h-3.5' })
  },
  other: {
    bg: 'bg-slate-50/70 border-slate-100 hover:border-slate-200 text-slate-700',
    badge: 'bg-slate-100 text-slate-800',
    icon: React.createElement(Calendar, { className: 'w-3.5 h-3.5' })
  }
};

export function getTypeConfig(schedType: ScheduleType) {
  return TYPE_CONFIG_MAP[schedType] || TYPE_CONFIG_MAP.other;
}

export const SCHEDULE_TYPE_MODAL_OPTIONS: Array<{ type: ScheduleType; label: string }> = [
  { type: 'security', label: '보안' },
  { type: 'meeting', label: '회의' },
  { type: 'education', label: '교육' },
  { type: 'other', label: '기타' }
];

export const SCHEDULE_TYPE_FORM_OPTIONS: Array<{ type: ScheduleType; label: string }> = [
  { type: 'security', label: '보안' },
  { type: 'meeting', label: '업무 회의' },
  { type: 'education', label: '직원 교육' },
  { type: 'other', label: '기타 일정' }
];

export const EMPTY_SCHEDULES: Schedule[] = [];

// ============ Subcomponent Prop Interfaces ============

export interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule?: Schedule | null;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  onSaveAdd: (data: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onSaveUpdate: (id: string, updates: Partial<Schedule>) => void;
  onDeleteSchedule: (id: string) => void;
}

export interface GoogleCalendarSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onImportCalendar: (payload: { icsUrl: string }) => Promise<{ success: boolean; count?: number; error?: string }>;
}

export interface ScheduleFormProps {
  date: string;
  setDate: (date: string) => void;
  isRange: boolean;
  setIsRange: (val: boolean) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  addSchedule: (sched: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export interface ScheduleItemProps {
  schedule: Schedule;
  config: { bg: string; badge: string; icon: React.ReactNode };
  onDelete: (id: string) => void;
  onEdit?: (schedule: Schedule) => void;
}

export interface WeekDayColumnProps {
  day: Date;
  dayIdx: number;
  schedules: Schedule[];
  dayNames: string[];
  isToday?: boolean;
  onOpenCellModal: (dayStr: string) => void;
  onDropCell: (e: React.DragEvent, dayStr: string) => void;
  onDeleteSchedule: (id: string) => void;
  onEditSchedule: (sched: Schedule) => void;
}

export interface MonthSchedulePillProps {
  schedule: Schedule;
  config: { bg: string; badge: string; icon: React.ReactNode };
  onEdit: (sched: Schedule) => void;
}

export interface MonthCellProps {
  day: Date;
  currentMonth: number;
  schedules: Schedule[];
  isToday?: boolean;
  onOpenModal: (dayStr: string) => void;
  onDropCell: (e: React.DragEvent, dayStr: string) => void;
  onEditSchedule: (sched: Schedule) => void;
}

export interface TimetableScheduleItemProps {
  schedule: Schedule;
  config: { bg: string; badge: string; icon: React.ReactNode };
  onEdit: (sched: Schedule) => void;
}

export interface TimetableSlotCellProps {
  dayStr: string;
  hourStr: string;
  nextHourStr: string;
  schedules: Schedule[];
  onOpenCellModal: (dayStr: string, startTime?: string, endTime?: string) => void;
  onDropCell: (e: React.DragEvent, dayStr: string, targetTime?: string) => void;
  onEditSchedule: (sched: Schedule) => void;
}
