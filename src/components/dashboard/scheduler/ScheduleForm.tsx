'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ScheduleType } from '@/types';
import { Plus, AlertCircle } from 'lucide-react';
import { SchedulePresetChips, SchedulePresetManageModal } from '../SchedulePresetSelector';
import { SchedulePreset } from '@/lib/schedule-presets';
import { ScheduleFormProps, SCHEDULE_TYPE_FORM_OPTIONS } from './types';

export const ScheduleForm = React.memo(({ 
  date, 
  setDate, 
  isRange, 
  setIsRange, 
  endDate, 
  setEndDate, 
  addSchedule 
}: ScheduleFormProps) => {
  const [title, setTitle] = useState('보안');
  const [type, setType] = useState<ScheduleType>('security');
  const [person, setPerson] = useState('오창선');
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('13:00');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  const handleSelectPreset = useCallback((preset: SchedulePreset) => {
    setTitle(preset.title);
    setType(preset.type);
    setPerson(preset.person);
    if (preset.startTime) setStartTime(preset.startTime);
    if (preset.endTime) setEndTime(preset.endTime);
    if (preset.notes) setNotes(preset.notes);
  }, []);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);

  const handlePersonChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPerson(e.target.value);
  }, []);

  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  }, []);

  const handleDateChange = useCallback((newVal: string) => {
    setDate(newVal);
    if (endDate < newVal) {
      setEndDate(newVal);
    }
  }, [setDate, endDate, setEndDate]);

  const handleEndDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  }, [setEndDate]);

  const handleRangeToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setIsRange(e.target.checked);
    if (e.target.checked) {
      setEndDate(date);
    }
  }, [setIsRange, setEndDate, date]);

  const handleStartHourChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setStartTime(prev => `${e.target.value}:${prev.split(':')[1] || '30'}`);
  }, []);

  const handleStartMinChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setStartTime(prev => `${prev.split(':')[0] || '11'}:${e.target.value}`);
  }, []);

  const handleEndHourChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setEndTime(prev => `${e.target.value}:${prev.split(':')[1] || '00'}`);
  }, []);

  const handleEndMinChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setEndTime(prev => `${prev.split(':')[0] || '13'}:${e.target.value}`);
  }, []);

  const handleOpenPresetModal = useCallback(() => {
    setIsPresetModalOpen(true);
  }, []);

  const handleClosePresetModal = useCallback(() => {
    setIsPresetModalOpen(false);
  }, []);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), []);
  const minutes = useMemo(() => ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'], []);

  const applyPreset = useCallback((start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('일정 제목 입력 필요');
      return;
    }
    if (!person.trim()) {
      setError('담당자 · 참석자 입력 필요');
      return;
    }
    if (startTime >= endTime) {
      setError('종료 시각 > 시작 시각 필수');
      return;
    }
    if (isRange && endDate && date > endDate) {
      setError('종료일 ≥ 시작일 필수');
      return;
    }

    addSchedule({
      title: title.trim(),
      type,
      person: person.trim(),
      date,
      endDate: isRange ? endDate : undefined,
      startTime,
      endTime,
      notes: notes.trim()
    });

    setTitle('보안');
    setPerson('오창선');
    setNotes('');
    setIsRange(false);
    setEndDate(date);
  }, [title, person, startTime, endTime, isRange, endDate, date, addSchedule, type, notes, setIsRange, setEndDate]);

  return (
    <form onSubmit={handleSubmit} className="xl:col-span-3 flex flex-col gap-4 bg-slate-50/20 p-6 rounded-2xl border border-slate-200/40 max-h-[580px] overflow-y-auto">
      <span className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
        <Plus className="w-4 h-4 text-indigo-500" /> 새 일정 등록
      </span>

      {error && (
        <div className="flex items-center gap-2 text-xs font-bold bg-rose-500/10 text-rose-600 p-3 rounded-xl border border-rose-500/20">
          <AlertCircle className="w-4.5 h-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">일정 분류</label>
        <div className="grid grid-cols-2 gap-1.5">
          {SCHEDULE_TYPE_FORM_OPTIONS.map(({ type: t, label }) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold text-center transition-colors duration-150 cursor-pointer ${
                type === t
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-655 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 자주 쓰는 상용구 칩 바 */}
      <SchedulePresetChips
        currentType={type}
        onSelectPreset={handleSelectPreset}
        onOpenManageModal={handleOpenPresetModal}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">일정명 (제목)</label>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="예: 4층 보안"
          className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors duration-150 placeholder:text-slate-300 placeholder:font-semibold"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">담당자 / 참석자</label>
        <input
          type="text"
          value={person}
          onChange={handlePersonChange}
          placeholder="담당 당번 혹은 회의 주최자"
          className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors duration-150 placeholder:text-slate-300 placeholder:font-semibold"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">시작 날짜</label>
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors duration-150"
          required
        />
      </div>

      <div className="flex items-center gap-2 mb-1 select-none">
        <input
          type="checkbox"
          id="isRangeCheck"
          checked={isRange}
          onChange={handleRangeToggle}
          className="w-4 h-4 rounded text-indigo-650 border-slate-300 focus:ring-indigo-500 cursor-pointer"
        />
        <label htmlFor="isRangeCheck" className="text-xs font-bold text-slate-600 cursor-pointer">
          연속 일정으로 등록
        </label>
      </div>

      {isRange && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-500">종료 날짜</label>
          <input
            type="date"
            value={endDate}
            onChange={handleEndDateChange}
            min={date}
            className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors duration-150"
            required
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">퀵 시간 설정</label>
        <div className="flex flex-wrap gap-1.5 mb-1">
          <button
            type="button"
            onClick={() => applyPreset('11:30', '13:00')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-colors duration-150 cursor-pointer ${
              startTime === '11:30' && endTime === '13:00'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            보안 (11:30~13:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('10:00', '11:00')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-colors duration-150 cursor-pointer ${
              startTime === '10:00' && endTime === '11:00'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            회의 (10:00~11:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('14:00', '15:00')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-colors duration-150 cursor-pointer ${
              startTime === '14:00' && endTime === '15:00'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            회의 (14:00~15:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('09:00', '18:00')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-colors duration-150 cursor-pointer ${
              startTime === '09:00' && endTime === '18:00'
                ? 'bg-slate-600 border-slate-600 text-white shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            종일 (09:00~18:00)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-500">시작 시간</label>
          <div className="flex gap-1.5">
            <select
              value={startTime.split(':')[0] || '11'}
              onChange={handleStartHourChange}
              className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {hours.map(h => <option key={h} value={h}>{h}시</option>)}
            </select>
            <select
              value={startTime.split(':')[1] || '30'}
              onChange={handleStartMinChange}
              className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {minutes.map(m => <option key={m} value={m}>{m}분</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-500">종료 시간</label>
          <div className="flex gap-1.5">
            <select
              value={endTime.split(':')[0] || '13'}
              onChange={handleEndHourChange}
              className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {hours.map(h => <option key={h} value={h}>{h}시</option>)}
            </select>
            <select
              value={endTime.split(':')[1] || '00'}
              onChange={handleEndMinChange}
              className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {minutes.map(m => <option key={m} value={m}>{m}분</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">메모 / 특이사항</label>
        <textarea
          value={notes}
          onChange={handleNotesChange}
          placeholder="상세 위치, 안건 및 기타 중요 특이사항을 적어주세요."
          className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200/60 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors duration-150 placeholder:text-slate-300 placeholder:font-semibold resize-none h-20"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-3 px-4 rounded-xl transition-colors duration-300 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98] cursor-pointer"
      >
        스케줄 등록
      </button>

      {/* 자주 쓰는 상용구 관리 모달 */}
      <SchedulePresetManageModal
        isOpen={isPresetModalOpen}
        onClose={handleClosePresetModal}
        onSelectPreset={handleSelectPreset}
        currentFormValues={{
          title,
          type,
          person,
          startTime,
          endTime,
          notes
        }}
      />
    </form>
  );
});

ScheduleForm.displayName = 'ScheduleForm';
