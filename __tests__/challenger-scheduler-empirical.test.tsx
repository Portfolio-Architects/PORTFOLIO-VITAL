import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  formatDateStr,
  timeToMinutes,
  minutesToTime,
  getTypeConfig,
  TYPE_CONFIG_MAP,
  EMPTY_SCHEDULES,
  ScheduleModal,
  GoogleCalendarSyncModal,
  ScheduleForm,
  WeekDayColumn,
  MonthCell,
  TimetableSlotCell,
  ScheduleItem,
  MonthSchedulePill,
  TimetableScheduleItem,
  WeeklyScheduler,
} from '@/components/dashboard/WeeklyScheduler';
import * as SchedulerExports from '@/components/dashboard/WeeklyScheduler';
import { Schedule } from '@/types';

// Mock useSchedules for orchestrator testing
const mockAddSchedule = jest.fn();
const mockUpdateSchedule = jest.fn();
const mockDeleteSchedule = jest.fn();
const mockImportCalendar = jest.fn();

const sampleSchedules: Schedule[] = [
  {
    id: 'sched-1',
    title: '보안 점검 회의',
    type: 'security',
    person: '김보안',
    date: '2026-11-10',
    startTime: '09:00',
    endTime: '10:00',
    notes: '정기 보안 감사',
    createdAt: '2026-11-10T00:00:00Z',
    updatedAt: '2026-11-10T00:00:00Z',
  },
  {
    id: 'sched-2',
    title: '팀 주간 회의',
    type: 'meeting',
    person: '이팀장',
    date: '2026-11-10',
    startTime: '14:00',
    endTime: '15:30',
    notes: '주간 업무 분장',
    createdAt: '2026-11-10T00:00:00Z',
    updatedAt: '2026-11-10T00:00:00Z',
  },
  {
    id: 'sched-multi',
    title: '3일 연속 워크숍',
    type: 'education',
    person: '박강사',
    date: '2026-11-09',
    endDate: '2026-11-11',
    startTime: '10:00',
    endTime: '12:00',
    notes: '다일 일정 테스트',
    createdAt: '2026-11-09T00:00:00Z',
    updatedAt: '2026-11-09T00:00:00Z',
  },
];

jest.mock('@/hooks/useSchedules', () => ({
  useSchedules: () => ({
    schedules: sampleSchedules,
    loading: false,
    addSchedule: mockAddSchedule,
    updateSchedule: mockUpdateSchedule,
    deleteSchedule: mockDeleteSchedule,
    importCalendar: mockImportCalendar,
  }),
}));

describe('Empirical Challenger: Scheduler Modularization Verification Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. Time Boundary Conversions & Edge Cases (Mathematical Oracle)
  // =========================================================================
  describe('1. Time Helper Functions & Boundary Clamping Oracle', () => {
    test('timeToMinutes: standard and boundary times', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('01:00')).toBe(60);
      expect(timeToMinutes('10:30')).toBe(630);
      expect(timeToMinutes('12:00')).toBe(720);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    test('timeToMinutes: edge cases, malformed or empty inputs', () => {
      expect(timeToMinutes('')).toBe(0);
      expect(timeToMinutes(null as any)).toBe(0);
      expect(timeToMinutes(undefined as any)).toBe(0);
      expect(timeToMinutes('14')).toBe(840);
      expect(timeToMinutes(':30')).toBe(30);
      expect(timeToMinutes('invalid:time')).toBe(0);
    });

    test('minutesToTime: standard and boundary conversions', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(60)).toBe('01:00');
      expect(minutesToTime(630)).toBe('10:30');
      expect(minutesToTime(1439)).toBe('23:59');
    });

    test('minutesToTime: boundary clamping (<0 and >1439)', () => {
      expect(minutesToTime(-1)).toBe('00:00');
      expect(minutesToTime(-9999)).toBe('00:00');
      expect(minutesToTime(1440)).toBe('23:59');
      expect(minutesToTime(5000)).toBe('23:59');
    });

    test('timeToMinutes <-> minutesToTime roundtrip identity for all 1440 minutes of day', () => {
      for (let m = 0; m < 1440; m++) {
        const timeStr = minutesToTime(m);
        const backToMins = timeToMinutes(timeStr);
        expect(backToMins).toBe(m);
      }
    });

    test('formatDateStr: padding and leap year formatting', () => {
      expect(formatDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(formatDateStr(new Date(2026, 10, 10))).toBe('2026-11-10');
      expect(formatDateStr(new Date(2024, 1, 29))).toBe('2024-02-29');
      expect(formatDateStr(new Date(2026, 11, 31))).toBe('2026-12-31');
    });

    test('getTypeConfig: valid types and fallback behavior', () => {
      expect(getTypeConfig('security').bg).toContain('indigo');
      expect(getTypeConfig('meeting').bg).toContain('emerald');
      expect(getTypeConfig('education').bg).toContain('amber');
      expect(getTypeConfig('other').bg).toContain('slate');
      expect(getTypeConfig('nonexistent' as any)).toBe(TYPE_CONFIG_MAP.other);
    });
  });

  // =========================================================================
  // 2. Drag & Drop Reschedule Math Oracle
  // =========================================================================
  describe('2. Drag & Drop Time Rescheduling Formula Oracle', () => {
    test('preserves exact event duration across drag-and-drop slots', () => {
      const origStartTime = '10:00';
      const durationMins = 90;
      const targetStartTime = '14:00';

      const startMins = timeToMinutes(targetStartTime);
      const endMins = startMins + durationMins;
      const endTimeVal = minutesToTime(endMins);

      expect(startMins).toBe(840);
      expect(endMins).toBe(930);
      expect(endTimeVal).toBe('15:30');
    });

    test('handles late night drop with clamping without overflow crash', () => {
      const targetStartTime = '23:30';
      const durationMins = 60;

      const startMins = timeToMinutes(targetStartTime);
      const endMins = startMins + durationMins;
      const endTimeVal = minutesToTime(endMins);

      expect(endTimeVal).toBe('23:59');
    });
  });

  // =========================================================================
  // 3. Subcomponents Isolated Rendering & Callback Verification
  // =========================================================================
  describe('3. Extracted Subcomponents Isolated Rendering & Callbacks', () => {
    const mockOnOpenCellModal = jest.fn();
    const mockOnDropCell = jest.fn();
    const mockOnDeleteSchedule = jest.fn();
    const mockOnEditSchedule = jest.fn();

    test('WeekDayColumn: renders empty day with add prompt, clicking triggers callback', () => {
      const testDay = new Date(2026, 10, 10);
      render(
        <WeekDayColumn
          day={testDay}
          dayIdx={1}
          schedules={[]}
          dayNames={['월', '화', '수', '목', '금', '토', '일']}
          isToday={false}
          onOpenCellModal={mockOnOpenCellModal}
          onDropCell={mockOnDropCell}
          onDeleteSchedule={mockOnDeleteSchedule}
          onEditSchedule={mockOnEditSchedule}
        />
      );

      expect(screen.getByText('화')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('0건')).toBeInTheDocument();
      expect(screen.getByText('+ 클릭하여 추가')).toBeInTheDocument();

      fireEvent.click(screen.getByText('+ 클릭하여 추가'));
      expect(mockOnOpenCellModal).toHaveBeenCalledWith('2026-11-10');
    });

    test('WeekDayColumn: renders schedules and handles edit/delete triggers', () => {
      const testDay = new Date(2026, 10, 10);
      render(
        <WeekDayColumn
          day={testDay}
          dayIdx={1}
          schedules={[sampleSchedules[0]]}
          dayNames={['월', '화', '수', '목', '금', '토', '일']}
          isToday={true}
          onOpenCellModal={mockOnOpenCellModal}
          onDropCell={mockOnDropCell}
          onDeleteSchedule={mockOnDeleteSchedule}
          onEditSchedule={mockOnEditSchedule}
        />
      );

      expect(screen.getByText('보안 점검 회의')).toBeInTheDocument();
      expect(screen.getByText('1건')).toBeInTheDocument();

      fireEvent.click(screen.getByText('보안 점검 회의'));
      expect(mockOnEditSchedule).toHaveBeenCalledWith(sampleSchedules[0]);
    });

    test('MonthCell: renders day and schedule pills, triggers open modal and edit', () => {
      const testDay = new Date(2026, 10, 10);
      render(
        <MonthCell
          day={testDay}
          currentMonth={10}
          schedules={[sampleSchedules[0]]}
          isToday={true}
          onOpenModal={mockOnOpenCellModal}
          onDropCell={mockOnDropCell}
          onEditSchedule={mockOnEditSchedule}
        />
      );

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('보안 점검 회의')).toBeInTheDocument();

      fireEvent.click(screen.getByText('보안 점검 회의'));
      expect(mockOnEditSchedule).toHaveBeenCalledWith(sampleSchedules[0]);
    });

    test('TimetableSlotCell: renders schedule item and triggers click modal callback', () => {
      render(
        <TimetableSlotCell
          dayStr="2026-11-10"
          hourStr="09"
          nextHourStr="10"
          schedules={[sampleSchedules[0]]}
          onOpenCellModal={mockOnOpenCellModal}
          onDropCell={mockOnDropCell}
          onEditSchedule={mockOnEditSchedule}
        />
      );

      expect(screen.getByText('보안 점검 회의')).toBeInTheDocument();

      const cell = screen.getByTitle('2026-11-10 09:00 일정 등록 (클릭)');
      fireEvent.click(cell);
      expect(mockOnOpenCellModal).toHaveBeenCalledWith('2026-11-10', '09:00', '10:00');
    });
  });

  // =========================================================================
  // 4. ScheduleModal Validation & Submission
  // =========================================================================
  describe('4. ScheduleModal Form Validation & Submission', () => {
    const mockOnClose = jest.fn();
    const mockOnSaveAdd = jest.fn();
    const mockOnSaveUpdate = jest.fn();
    const mockOnDelete = jest.fn();

    test('renders nothing when isOpen is false', () => {
      const { container } = render(
        <ScheduleModal
          isOpen={false}
          onClose={mockOnClose}
          onSaveAdd={mockOnSaveAdd}
          onSaveUpdate={mockOnSaveUpdate}
          onDeleteSchedule={mockOnDelete}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    test('shows validation error when title is empty', () => {
      render(
        <ScheduleModal
          isOpen={true}
          onClose={mockOnClose}
          initialDate="2026-11-10"
          onSaveAdd={mockOnSaveAdd}
          onSaveUpdate={mockOnSaveUpdate}
          onDeleteSchedule={mockOnDelete}
        />
      );

      const titleInput = screen.getByDisplayValue('신규 일정');
      fireEvent.change(titleInput, { target: { value: '' } });

      const form = titleInput.closest('form')!;
      fireEvent.submit(form);

      expect(screen.getByText('일정 제목 입력 필요')).toBeInTheDocument();
      expect(mockOnSaveAdd).not.toHaveBeenCalled();
    });

    test('shows validation error when startTime >= endTime', () => {
      render(
        <ScheduleModal
          isOpen={true}
          onClose={mockOnClose}
          initialDate="2026-11-10"
          initialStartTime="14:00"
          initialEndTime="10:00"
          onSaveAdd={mockOnSaveAdd}
          onSaveUpdate={mockOnSaveUpdate}
          onDeleteSchedule={mockOnDelete}
        />
      );

      const submitButton = screen.getByText('일정 등록');
      fireEvent.click(submitButton);

      expect(screen.getByText('종료 시각 > 시작 시각 필수')).toBeInTheDocument();
      expect(mockOnSaveAdd).not.toHaveBeenCalled();
    });

    test('successfully submits valid new schedule', () => {
      render(
        <ScheduleModal
          isOpen={true}
          onClose={mockOnClose}
          initialDate="2026-11-10"
          initialStartTime="10:00"
          initialEndTime="11:00"
          onSaveAdd={mockOnSaveAdd}
          onSaveUpdate={mockOnSaveUpdate}
          onDeleteSchedule={mockOnDelete}
        />
      );

      const submitButton = screen.getByText('일정 등록');
      fireEvent.click(submitButton);

      expect(mockOnSaveAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '신규 일정',
          date: '2026-11-10',
          startTime: '10:00',
          endTime: '11:00',
          person: '담당자',
        })
      );
      expect(mockOnClose).toHaveBeenCalled();
    });

    test('edit mode fills existing schedule and calls onSaveUpdate', () => {
      render(
        <ScheduleModal
          isOpen={true}
          schedule={sampleSchedules[0]}
          onClose={mockOnClose}
          onSaveAdd={mockOnSaveAdd}
          onSaveUpdate={mockOnSaveUpdate}
          onDeleteSchedule={mockOnDelete}
        />
      );

      expect(screen.getByText('일정 수정 및 상세')).toBeInTheDocument();
      expect(screen.getByDisplayValue('보안 점검 회의')).toBeInTheDocument();

      const saveButton = screen.getByText('수정 저장');
      fireEvent.click(saveButton);

      expect(mockOnSaveUpdate).toHaveBeenCalledWith(
        'sched-1',
        expect.objectContaining({
          title: '보안 점검 회의',
          type: 'security',
        })
      );
    });

    test('edit mode allows deletion with window.confirm', () => {
      window.confirm = jest.fn().mockReturnValue(true);

      render(
        <ScheduleModal
          isOpen={true}
          schedule={sampleSchedules[0]}
          onClose={mockOnClose}
          onSaveAdd={mockOnSaveAdd}
          onSaveUpdate={mockOnSaveUpdate}
          onDeleteSchedule={mockOnDelete}
        />
      );

      const deleteButton = screen.getByText('삭제');
      fireEvent.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('보안 점검 회의'));
      expect(mockOnDelete).toHaveBeenCalledWith('sched-1');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. Google Calendar Sync Modal
  // =========================================================================
  describe('5. Google Calendar Sync Modal', () => {
    test('renders iCal feed URL and handles copy action', () => {
      const mockClipboard = jest.fn();
      Object.assign(navigator, {
        clipboard: {
          writeText: mockClipboard,
        },
      });

      render(
        <GoogleCalendarSyncModal
          isOpen={true}
          onClose={jest.fn()}
          onImportCalendar={mockImportCalendar}
        />
      );

      expect(screen.getByText(/feed\.ics/)).toBeInTheDocument();
      const copyBtn = screen.getByText('URL 복사');
      fireEvent.click(copyBtn);

      expect(mockClipboard).toHaveBeenCalledWith(expect.stringContaining('/api/calendar/feed.ics'));
    });

    test('handles calendar import submission with success message', async () => {
      mockImportCalendar.mockResolvedValueOnce({ success: true, count: 5 });

      render(
        <GoogleCalendarSyncModal
          isOpen={true}
          onClose={jest.fn()}
          onImportCalendar={mockImportCalendar}
        />
      );

      const urlInput = screen.getByPlaceholderText(/https:\/\/calendar\.google\.com/);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/test.ics' } });

      const importBtn = screen.getByText('가져오기');
      fireEvent.click(importBtn);

      await waitFor(() => {
        expect(mockImportCalendar).toHaveBeenCalledWith({ icsUrl: 'https://example.com/test.ics' });
        expect(screen.getByText(/총 5건의 신규 일정을 성공적으로 동기화했습니다/)).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 6. Orchestrator Integration & View Mode Switching
  // =========================================================================
  describe('6. WeeklyScheduler Orchestrator & View Mode Switching', () => {
    test('renders WeeklyScheduler with default week view and switches view modes', () => {
      render(<WeeklyScheduler />);

      expect(screen.getByText('통합 일정 플래너')).toBeInTheDocument();
      expect(screen.getByText('주간')).toBeInTheDocument();
      expect(screen.getByText('월간')).toBeInTheDocument();
      expect(screen.getByText('타임테이블')).toBeInTheDocument();

      // Check week view elements
      expect(screen.getByText('오늘')).toBeInTheDocument();

      // Switch to Month view
      fireEvent.click(screen.getByText('월간'));
      expect(screen.getByText('일')).toBeInTheDocument();

      // Switch to Timetable view
      fireEvent.click(screen.getByText('타임테이블'));
      expect(screen.getByText('시간')).toBeInTheDocument();
      expect(screen.getByText('08:00')).toBeInTheDocument();
      expect(screen.getByText('20:00')).toBeInTheDocument();
    });

    test('opens and closes Google Calendar sync modal from orchestrator button', () => {
      render(<WeeklyScheduler />);

      const syncBtn = screen.getByText('구글 캘린더 연동');
      fireEvent.click(syncBtn);

      expect(screen.getByText('iCal 실시간 구독 · 외부 일정 가져오기')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 7. Backward Compatibility of Re-exports
  // =========================================================================
  describe('7. Re-exports & Backward Compatibility Verification', () => {
    test('WeeklyScheduler re-exports all extracted subcomponents and functions', () => {
      expect(typeof SchedulerExports.formatDateStr).toBe('function');
      expect(typeof SchedulerExports.timeToMinutes).toBe('function');
      expect(typeof SchedulerExports.minutesToTime).toBe('function');
      expect(typeof SchedulerExports.getTypeConfig).toBe('function');
      expect(typeof SchedulerExports.ScheduleModal).toBe('object');
      expect(typeof SchedulerExports.GoogleCalendarSyncModal).toBe('object');
      expect(typeof SchedulerExports.ScheduleForm).toBe('object');
      expect(typeof SchedulerExports.WeekDayColumn).toBe('object');
      expect(typeof SchedulerExports.MonthCell).toBe('object');
      expect(typeof SchedulerExports.TimetableSlotCell).toBe('object');
      expect(typeof SchedulerExports.ScheduleItem).toBe('object');
      expect(typeof SchedulerExports.MonthSchedulePill).toBe('object');
      expect(typeof SchedulerExports.TimetableScheduleItem).toBe('object');
      expect(typeof SchedulerExports.WeeklyScheduler).toBe('object');
      expect(typeof SchedulerExports.default).toBe('object');
    });
  });
});
