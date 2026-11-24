'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ScheduleType } from '@/types';
import { Plus, X, Edit3, Trash2, Calendar, ExternalLink, AlertCircle } from 'lucide-react';
import { generateGoogleCalendarUrl } from '@/lib/calendar-utils';
import { SchedulePresetChips, SchedulePresetManageModal } from '../SchedulePresetSelector';
import { SchedulePreset } from '@/lib/schedule-presets';
import { ScheduleModalProps, SCHEDULE_TYPE_MODAL_OPTIONS, formatDateStr } from './types';

const ScheduleModalContent = React.memo(({
 onClose,
 schedule,
 initialDate,
 initialStartTime,
 initialEndTime,
 onSaveAdd,
 onSaveUpdate,
 onDeleteSchedule
}: Omit<ScheduleModalProps, 'isOpen'>) => {
 const isEditing = Boolean(schedule);
 const today = useMemo(() => formatDateStr(new Date()), []);

 const [title, setTitle] = useState(schedule ? schedule.title : '신규 일정');
 const [type, setType] = useState<ScheduleType>(schedule ? schedule.type : 'meeting');
 const [person, setPerson] = useState(schedule ? schedule.person : '담당자');
 const [date, setDate] = useState(schedule ? schedule.date : (initialDate || today));
 const [isRange, setIsRange] = useState(Boolean(schedule?.endDate && schedule.endDate !== schedule.date));
 const [endDate, setEndDate] = useState(schedule?.endDate || schedule?.date || initialDate || today);
 const [startTime, setStartTime] = useState(schedule ? schedule.startTime : (initialStartTime || '10:00'));
 const [endTime, setEndTime] = useState(schedule ? schedule.endTime : (initialEndTime || '11:00'));
 const [notes, setNotes] = useState(schedule?.notes || '');
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

 const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 setDate(e.target.value);
  }, []);

 const handleEndDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 setEndDate(e.target.value);
  }, []);

 const handleRangeToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 setIsRange(e.target.checked);
 if (e.target.checked) {
 setEndDate(prev => prev || date);
    }
  }, [date]);

 const handleStartTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 setStartTime(e.target.value);
  }, []);

 const handleEndTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 setEndTime(e.target.value);
  }, []);

 const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
 setNotes(e.target.value);
  }, []);

 const handleOpenPresetModal = useCallback(() => {
 setIsPresetModalOpen(true);
  }, []);

 const handleClosePresetModal = useCallback(() => {
 setIsPresetModalOpen(false);
  }, []);

 const handleSubmit = useCallback((e: React.FormEvent) => {
 e.preventDefault();
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

 if (isEditing && schedule) {
 onSaveUpdate(schedule.id, {
 title: title.trim(),
 type,
 person: person.trim(),
 date,
 endDate: isRange ? endDate : undefined,
 startTime,
 endTime,
 notes: notes.trim()
      });
    } else {
 onSaveAdd({
 title: title.trim(),
 type,
 person: person.trim(),
 date,
 endDate: isRange ? endDate : undefined,
 startTime,
 endTime,
 notes: notes.trim()
      });
    }
 onClose();
  }, [title, person, startTime, endTime, isEditing, schedule, onSaveUpdate, onSaveAdd, onClose, type, date, isRange, endDate, notes]);

 const handleDelete = useCallback(() => {
 if (schedule && confirm(`'${schedule.title}' 일정을 삭제하시겠습니까?`)) {
 onDeleteSchedule(schedule.id);
 onClose();
    }
  }, [schedule, onDeleteSchedule, onClose]);

 return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 w-full max-w-[500px] overflow-hidden flex flex-col p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2">
            {isEditing ? <Edit3 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
            <h3 className="text-base font-extrabold text-slate-800">
              {isEditing ? '일정 수정 및 상세' : '새 일정 직접 등록'}
            </h3>
          </div>
          <button
 type="button"
 onClick={onClose}
 className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] pr-1 custom-scrollbar">
          {/* 분류 선택 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500">일정 분류</label>
            <div className="grid grid-cols-4 gap-1.5">
              {SCHEDULE_TYPE_MODAL_OPTIONS.map(({ type: t, label }) => (
                <button
 key={t}
 type="button"
 onClick={() => setType(t)}
 className={`py-2 px-1 rounded-xl border text-xs font-bold text-center transition-colors duration-150 cursor-pointer ${
 type === t
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
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
            <label className="text-[11px] font-bold text-slate-500">일정 제목 *</label>
            <input
 type="text"
 required
 value={title}
 onChange={handleTitleChange}
 className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500">담당자 / 참석자 *</label>
            <input
 type="text"
 required
 value={person}
 onChange={handlePersonChange}
 className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500">시작 날짜</label>
              <input
 type="date"
 required
 value={date}
 onChange={handleDateChange}
 className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500">종료 날짜</label>
              <input
 type="date"
 value={isRange ? endDate : date}
 disabled={!isRange}
 onChange={handleEndDateChange}
 className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
 type="checkbox"
 id="modalRangeCheck"
 checked={isRange}
 onChange={handleRangeToggle}
 className="w-4 h-4 rounded text-indigo-600"
            />
            <label htmlFor="modalRangeCheck" className="text-xs font-bold text-slate-600 cursor-pointer">
              연속 일정 등록
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500">시작 시간</label>
              <input
 type="time"
 value={startTime}
 onChange={handleStartTimeChange}
 className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500">종료 시간</label>
              <input
 type="time"
 value={endTime}
 onChange={handleEndTimeChange}
 className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500">메모 / 특이사항</label>
            <textarea
 rows={3}
 value={notes}
 onChange={handleNotesChange}
 placeholder="상세 내용 입력"
 className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
            />
          </div>

          <div className="flex items-center justify-between mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              {isEditing && schedule && (
                <>
                  <button
 type="button"
 onClick={handleDelete}
 className="px-3.5 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors border-0 cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 삭제
                  </button>
                  <a
 href={generateGoogleCalendarUrl(schedule)}
 target="_blank"
 rel="noopener noreferrer"
 className="px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-200/60 flex items-center gap-1.5 no-underline"
 title="구글 캘린더에 이 일정 추가"
                  >
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>구글 캘린더 등록</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
 type="button"
 onClick={onClose}
 className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors border-0 cursor-pointer"
              >
                취소
              </button>
              <button
 type="submit"
 className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors border-0 cursor-pointer"
              >
                {isEditing ? '수정 저장' : '일정 등록'}
              </button>
            </div>
          </div>
        </form>
      </div>

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
    </div>
  );
});
ScheduleModalContent.displayName = 'ScheduleModalContent';

export const ScheduleModal = React.memo(({
 isOpen,
  ...props
}: ScheduleModalProps) => {
 if (!isOpen) return null;
 const contentKey = props.schedule
    ? `edit-${props.schedule.id}`
    : `new-${props.initialDate || ''}-${props.initialStartTime || ''}`;
 return <ScheduleModalContent key={contentKey} {...props} />;
});
ScheduleModal.displayName = 'ScheduleModal';
