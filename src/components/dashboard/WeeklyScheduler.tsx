'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useSchedules } from '@/hooks/useSchedules';
import { Schedule } from '@/types';
import { Calendar, ChevronLeft, ChevronRight, Clock, Grid, LayoutGrid } from 'lucide-react';
import {
  formatDateStr,
  timeToMinutes,
  minutesToTime,
  EMPTY_SCHEDULES,
  ScheduleModal,
  GoogleCalendarSyncModal,
  ScheduleForm,
  WeekDayColumn,
  MonthCell,
  TimetableSlotCell
} from './scheduler';

// Re-export all scheduler subcomponents, types, and helpers for 100% backward compatibility
export * from './scheduler';

// ============ Main Weekly Scheduler Component (Orchestrator) ============
const WeeklySchedulerComponent: React.FC = () => {
  const { schedules, loading, addSchedule, updateSchedule, deleteSchedule, importCalendar } = useSchedules();

  // View Mode: 'week' | 'month' | 'timetable'
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'timetable'>('week');

  // Date navigation state
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const todayDateString = useMemo(() => new Date().toDateString(), []);

  // Sidebar schedule form state
  const [date, setDate] = useState(() => formatDateStr(new Date()));
  const [isRange, setIsRange] = useState(false);
  const [endDate, setEndDate] = useState(() => formatDateStr(new Date()));

  // Modal direct creation/edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGCalModalOpen, setIsGCalModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>('');
  const [modalInitialStartTime, setModalInitialStartTime] = useState<string>('10:00');
  const [modalInitialEndTime, setModalInitialEndTime] = useState<string>('11:00');

  // 7-day week days (Mon~Sun) calculation
  const weekDays = useMemo(() => {
    const tempDate = new Date(currentDate);
    const day = tempDate.getDay(); 
    const diff = tempDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(tempDate.setDate(diff));

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      days.push(nextDay);
    }
    return days;
  }, [currentDate]);

  // 42-day Month Calendar Grid calculation
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstOfMonth.getDay();
    const offset = (dayOfWeek + 6) % 7; // Monday start
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - offset);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Range texts
  const weekRangeText = useMemo(() => {
    const first = weekDays[0];
    const last = weekDays[6];
    return `${first.getFullYear()}년 ${first.getMonth() + 1}월 ${first.getDate()}일 ~ ${last.getMonth() + 1}월 ${last.getDate()}일`;
  }, [weekDays]);

  const monthText = useMemo(() => {
    return `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`;
  }, [currentDate]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setCurrentDate(prev => {
      const next = new Date(prev);
      if (viewMode === 'month') {
        next.setMonth(prev.getMonth() - 1);
      } else {
        next.setDate(prev.getDate() - 7);
      }
      return next;
    });
  }, [viewMode]);

  const handleNext = useCallback(() => {
    setCurrentDate(prev => {
      const next = new Date(prev);
      if (viewMode === 'month') {
        next.setMonth(prev.getMonth() + 1);
      } else {
        next.setDate(prev.getDate() + 7);
      }
      return next;
    });
  }, [viewMode]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Pre-calculate / map schedules by day string & day+hour composite key
  const { schedulesByDayMap, timetableSchedulesMap } = useMemo(() => {
    const dayMap = new Map<string, Schedule[]>();
    const timetableMap = new Map<string, Schedule[]>();

    for (let i = 0; i < schedules.length; i++) {
      const s = schedules[i];
      const startDate = s.date;
      const endDateVal = s.endDate || s.date;
      const hourPrefix = s.startTime ? s.startTime.split(':')[0] : '00';
      
      // Fast path for single-day schedules (avoids Date object allocations)
      if (startDate === endDateVal || !s.endDate) {
        const dStr = startDate.includes('T') ? startDate.split('T')[0] : startDate;
        
        let dayList = dayMap.get(dStr);
        if (!dayList) {
          dayList = [];
          dayMap.set(dStr, dayList);
        }
        dayList.push(s);

        const slotKey = `${dStr}:${hourPrefix}`;
        let slotList = timetableMap.get(slotKey);
        if (!slotList) {
          slotList = [];
          timetableMap.set(slotKey, slotList);
        }
        slotList.push(s);
        continue;
      }

      let cur = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00`);
      const end = new Date(endDateVal.includes('T') ? endDateVal : `${endDateVal}T00:00:00`);
      while (cur <= end) {
        const dStr = formatDateStr(cur);
        
        // Day list mapping
        let dayList = dayMap.get(dStr);
        if (!dayList) {
          dayList = [];
          dayMap.set(dStr, dayList);
        }
        dayList.push(s);

        // Day + Hour composite slot mapping
        const slotKey = `${dStr}:${hourPrefix}`;
        let slotList = timetableMap.get(slotKey);
        if (!slotList) {
          slotList = [];
          timetableMap.set(slotKey, slotList);
        }
        slotList.push(s);

        cur.setDate(cur.getDate() + 1);
      }
    }

    const fastTimeSort = (a: Schedule, b: Schedule) => (a.startTime > b.startTime ? 1 : a.startTime < b.startTime ? -1 : 0);
    for (const list of dayMap.values()) {
      list.sort(fastTimeSort);
    }
    for (const list of timetableMap.values()) {
      list.sort(fastTimeSort);
    }

    return { schedulesByDayMap: dayMap, timetableSchedulesMap: timetableMap };
  }, [schedules]);

  const getSchedulesForDay = useCallback((dayStr: string) => {
    return schedulesByDayMap.get(dayStr) || EMPTY_SCHEDULES;
  }, [schedulesByDayMap]);

  const getSchedulesForSlot = useCallback((dayStr: string, hourStr: string) => {
    return timetableSchedulesMap.get(`${dayStr}:${hourStr}`) || EMPTY_SCHEDULES;
  }, [timetableSchedulesMap]);

  // Drag and drop handler for target cell
  const handleDropCell = useCallback((e: React.DragEvent, targetDate: string, targetStartTime?: string) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const data = JSON.parse(raw);
      const { id, durationMins, startTime: origStartTime } = data;
      if (!id) return;

      const startTimeVal = targetStartTime || origStartTime || '10:00';
      const startMins = timeToMinutes(startTimeVal);
      const endMins = startMins + (durationMins || 60);
      const endTimeVal = minutesToTime(endMins);

      updateSchedule(id, {
        date: targetDate,
        startTime: startTimeVal,
        endTime: endTimeVal
      });
    } catch {
      // Silent error boundary for drag-and-drop reschedule
    }
  }, [updateSchedule]);

  // Open modal helper
  const handleOpenCellModal = useCallback((targetDate: string, startTimeVal?: string, endTimeVal?: string) => {
    setEditingSchedule(null);
    setModalInitialDate(targetDate);
    setModalInitialStartTime(startTimeVal || '10:00');
    setModalInitialEndTime(endTimeVal || '11:00');
    setIsModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((sched: Schedule) => {
    setEditingSchedule(sched);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleSetWeekView = useCallback(() => setViewMode('week'), []);
  const handleSetMonthView = useCallback(() => setViewMode('month'), []);
  const handleSetTimetableView = useCallback(() => setViewMode('timetable'), []);
  const handleOpenGCalModal = useCallback(() => setIsGCalModalOpen(true), []);
  const handleCloseGCalModal = useCallback(() => setIsGCalModalOpen(false), []);

  const dayNames = useMemo(() => ['월', '화', '수', '목', '금', '토', '일'], []);
  const timetableHours = useMemo(() => Array.from({ length: 13 }, (_, i) => String(i + 8).padStart(2, '0')), []);

  return (
    <div className="glass-panel rounded-[2rem] p-6 sm:p-8 shadow-2xs border border-white/20 transition-colors duration-300 hover:shadow-md">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/50 pb-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-2xl border border-indigo-500/15">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-800 tracking-tight">통합 일정 플래너</h4>
            <p className="vlds-subtitle text-xs font-semibold text-slate-400 mt-0.5">보안 · 회의 · 교육 일정 주간 · 월간 · 타임테이블 관리</p>
          </div>
        </div>

        {/* Header Actions: View Mode Switcher + Navigation */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
            <button
              onClick={handleSetWeekView}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer border-0 ${
                viewMode === 'week'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>주간</span>
            </button>
            <button
              onClick={handleSetMonthView}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer border-0 ${
                viewMode === 'month'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>월간</span>
            </button>
            <button
              onClick={handleSetTimetableView}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer border-0 ${
                viewMode === 'timetable'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>타임테이블</span>
            </button>
          </div>

          {/* Navigation Controls & Google Calendar Sync */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenGCalModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer hover:shadow-2xs active:scale-[0.97]"
              title="구글 캘린더 연동 · iCal 구독"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>구글 캘린더 연동</span>
            </button>

            <button
              onClick={handleToday}
              className="px-3.5 py-1.5 bg-slate-100/60 hover:bg-slate-200/60 border border-slate-200/40 text-xs font-bold text-slate-600 rounded-xl transition-colors duration-150 cursor-pointer hover:shadow-2xs active:scale-[0.97]"
            >
              오늘
            </button>
            <div className="flex items-center bg-slate-100/50 border border-slate-200/30 rounded-xl p-1 shrink-0">
              <button
                onClick={handlePrev}
                className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <span className="text-xs font-bold text-slate-700 px-3 min-w-[180px] text-center">
                {viewMode === 'month' ? monthText : weekRangeText}
              </span>
              <button
                onClick={handleNext}
                className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Form Container */}
        <ScheduleForm 
          date={date}
          setDate={setDate}
          isRange={isRange}
          setIsRange={setIsRange}
          endDate={endDate}
          setEndDate={setEndDate}
          addSchedule={addSchedule}
        />

        {/* Views Container (Right side / col-span-9) */}
        <div className="xl:col-span-9 flex flex-col min-w-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
              <p className="text-xs font-bold">일정 로딩 중</p>
            </div>
          ) : viewMode === 'week' ? (
            /* ================= 1. WEEK VIEW ================= */
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 h-full min-h-[500px]">
              {weekDays.map((day, idx) => {
                const dayStr = formatDateStr(day);
                const daySchedules = getSchedulesForDay(dayStr);
                return (
                  <WeekDayColumn
                    key={dayStr + idx}
                    day={day}
                    dayIdx={idx}
                    schedules={daySchedules}
                    dayNames={dayNames}
                    isToday={day.toDateString() === todayDateString}
                    onOpenCellModal={handleOpenCellModal}
                    onDropCell={handleDropCell}
                    onDeleteSchedule={deleteSchedule}
                    onEditSchedule={handleOpenEditModal}
                  />
                );
              })}
            </div>
          ) : viewMode === 'month' ? (
            /* ================= 2. MONTH VIEW (42-Cell Grid) ================= */
            <div className="flex flex-col gap-2 w-full">
              {/* Day Name Header Row */}
              <div className="grid grid-cols-7 gap-1 bg-slate-100/60 p-2 rounded-xl text-center text-xs font-bold text-slate-600">
                {dayNames.map((d, i) => (
                  <div key={d} className={i === 5 ? 'text-blue-500' : i === 6 ? 'text-red-500' : ''}>
                    {d}
                  </div>
                ))}
              </div>

              {/* 42-day Month Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {monthDays.map((day, idx) => {
                  const dayStr = formatDateStr(day);
                  const daySchedules = getSchedulesForDay(dayStr);
                  return (
                    <MonthCell
                      key={dayStr + idx}
                      day={day}
                      currentMonth={currentDate.getMonth()}
                      schedules={daySchedules}
                      isToday={day.toDateString() === todayDateString}
                      onOpenModal={handleOpenCellModal}
                      onDropCell={handleDropCell}
                      onEditSchedule={handleOpenEditModal}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            /* ================= 3. TIMETABLE VIEW (08:00 to 20:00 Matrix) ================= */
            <div className="flex flex-col border border-slate-200/60 rounded-2xl overflow-hidden bg-white/40">
              {/* Header Row: Days */}
              <div className="grid grid-cols-8 border-b border-slate-200/60 bg-slate-100/60 text-center text-xs font-bold text-slate-700 py-2.5">
                <div className="text-slate-400">시간</div>
                {weekDays.map((d, i) => {
                  const dayStr = formatDateStr(d);
                  const isToday = todayDateString === d.toDateString();
                  return (
                    <div key={dayStr} className={`flex items-center justify-center gap-1 ${isToday ? 'text-indigo-600 font-extrabold' : ''}`}>
                      <span>{dayNames[i]}</span>
                      <span className="text-[11px]">({d.getDate()}일)</span>
                    </div>
                  );
                })}
              </div>

              {/* Hourly Slot Rows */}
              <div className="flex flex-col overflow-y-auto max-h-[550px] custom-scrollbar divide-y divide-slate-100">
                {timetableHours.map((hourStr) => {
                  const nextHourStr = String(Number(hourStr) + 1).padStart(2, '0');
                  return (
                    <div key={hourStr} className="grid grid-cols-8 min-h-[54px] items-stretch">
                      {/* Hour Label */}
                      <div className="p-2 border-r border-slate-200/40 text-[11px] font-bold text-slate-400 flex items-center justify-center bg-slate-50/40">
                        {hourStr}:00
                      </div>

                      {/* 7 Day Slot Cells */}
                      {weekDays.map((day) => {
                        const dayStr = formatDateStr(day);
                        const slotSchedules = getSchedulesForSlot(dayStr, hourStr);
                        return (
                          <TimetableSlotCell
                            key={dayStr + hourStr}
                            dayStr={dayStr}
                            hourStr={hourStr}
                            nextHourStr={nextHourStr}
                            schedules={slotSchedules}
                            onOpenCellModal={handleOpenCellModal}
                            onDropCell={handleDropCell}
                            onEditSchedule={handleOpenEditModal}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Direct Click Modal */}
      <ScheduleModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        schedule={editingSchedule}
        initialDate={modalInitialDate}
        initialStartTime={modalInitialStartTime}
        initialEndTime={modalInitialEndTime}
        onSaveAdd={addSchedule}
        onSaveUpdate={updateSchedule}
        onDeleteSchedule={deleteSchedule}
      />

      {/* Google Calendar & iCal Sync Modal */}
      <GoogleCalendarSyncModal
        isOpen={isGCalModalOpen}
        onClose={handleCloseGCalModal}
        onImportCalendar={importCalendar}
      />
    </div>
  );
};

export const WeeklyScheduler = React.memo(WeeklySchedulerComponent);
WeeklyScheduler.displayName = 'WeeklyScheduler';

export default WeeklyScheduler;
