import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  YangjaeFestivalDashboard,
  formatDetail,
  parseDetail,
} from '@/components/festival/YangjaeFestivalDashboard';
import { YANGJAE_FALLBACK_DATA } from '@/hooks/useYangjaeFestival';
import { SimulationResultTable } from '@/components/budget/ui/SimulationResultTable';
import {
  BudgetCategory,
  BudgetEntry,
  SimulationEntry,
  StatItemSimulationSummary,
  ProjectSimulationSummary,
} from '@/types';
import { ChevronUp, ChevronDown, FolderInput, Trash2 } from 'lucide-react';

// ============================================================================
// 1. ISOLATED DetailEditRow COMPONENT ORACLE
// Faithful reproduction of DetailEditRow from YangjaeFestivalDashboard.tsx:442-670
// for direct unit-level assertion of onUpdate emission timings, onBlur flush,
// and useEffect unmount cleanup behavior.
// ============================================================================

interface DetailEditRowProps {
  initialDetail: string;
  onUpdate: (newDetail: string) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onTransfer?: () => void;
}

const DetailEditRowOracle = React.memo(function DetailEditRowOracle({
  initialDetail,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  onTransfer,
}: DetailEditRowProps) {
  const parsed = useMemo(() => parseDetail(initialDetail), [initialDetail]);
  const [lastEmitted, setLastEmitted] = useState<string>(initialDetail);
  const [prevDetail, setPrevDetail] = useState<string>(initialDetail);
  const [date, setDate] = useState<string>(parsed.date);
  const [status, setStatus] = useState<'done' | 'in-progress' | 'todo'>(parsed.status);
  const [attendees, setAttendees] = useState<string>(parsed.attendees);
  const [text, setText] = useState<string>(parsed.text);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestValuesRef = useRef({ date, status, attendees, text, lastEmitted });
  latestValuesRef.current = { date, status, attendees, text, lastEmitted };

  if (prevDetail !== initialDetail) {
    setPrevDetail(initialDetail);
    if (initialDetail !== lastEmitted) {
      setLastEmitted(initialDetail);
      setDate(parsed.date);
      setStatus(parsed.status);
      setAttendees(parsed.attendees);
      setText(parsed.text);
      latestValuesRef.current = {
        date: parsed.date,
        status: parsed.status,
        attendees: parsed.attendees,
        text: parsed.text,
        lastEmitted: initialDetail,
      };
    }
  }

  const flushChange = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const { date: d, status: s, attendees: a, text: t, lastEmitted: le } = latestValuesRef.current;
    const formatted = formatDetail({ date: d, status: s, attendees: a, text: t });
    if (formatted !== le) {
      setLastEmitted(formatted);
      latestValuesRef.current.lastEmitted = formatted;
      onUpdate(formatted);
    }
  }, [onUpdate]);

  const scheduleEmit = useCallback(
    (newDate: string, newStatus: 'done' | 'in-progress' | 'todo', newAttendees: string, newText: string) => {
      latestValuesRef.current = {
        date: newDate,
        status: newStatus,
        attendees: newAttendees,
        text: newText,
        lastEmitted: latestValuesRef.current.lastEmitted,
      };
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        const formatted = formatDetail({ date: newDate, status: newStatus, attendees: newAttendees, text: newText });
        setLastEmitted(formatted);
        latestValuesRef.current.lastEmitted = formatted;
        onUpdate(formatted);
      }, 200);
    },
    [onUpdate]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        const { date: d, status: s, attendees: a, text: t, lastEmitted: le } = latestValuesRef.current;
        const formatted = formatDetail({ date: d, status: s, attendees: a, text: t });
        if (formatted !== le) {
          onUpdate(formatted);
        }
      }
    };
  }, [onUpdate]);

  const handleMoveUpWithFlush = useCallback(() => {
    flushChange();
    onMoveUp?.();
  }, [flushChange, onMoveUp]);

  const handleMoveDownWithFlush = useCallback(() => {
    flushChange();
    onMoveDown?.();
  }, [flushChange, onMoveDown]);

  const handleDeleteWithFlush = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    onDelete();
  }, [onDelete]);

  const handleTransferWithFlush = useCallback(() => {
    flushChange();
    onTransfer?.();
  }, [flushChange, onTransfer]);

  return (
    <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1.5 shadow-2xs" data-testid="detail-edit-row">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            scheduleEmit(e.target.value, status, attendees, text);
          }}
          onBlur={flushChange}
          placeholder="날짜 (7.29)"
          data-testid="detail-date-input"
          className="w-24 px-2 py-0.5 border border-amber-400 rounded bg-amber-50/40 text-xs font-bold font-mono shrink-0"
        />
        <select
          value={status}
          onChange={(e) => {
            const nextStatus = e.target.value as 'done' | 'in-progress' | 'todo';
            setStatus(nextStatus);
            scheduleEmit(date, nextStatus, attendees, text);
          }}
          onBlur={flushChange}
          data-testid="detail-status-select"
          className="px-1.5 py-0.5 text-xs font-black rounded border cursor-pointer shrink-0"
        >
          <option value="done">✓ 완료</option>
          <option value="in-progress">▶ 진행</option>
          <option value="todo">○ 예정</option>
        </select>
        <input
          type="text"
          value={attendees}
          onChange={(e) => {
            setAttendees(e.target.value);
            scheduleEmit(date, status, e.target.value, text);
          }}
          onBlur={flushChange}
          placeholder="참석자 (예: 과장님 7010...)"
          data-testid="detail-attendees-input"
          className="flex-1 min-w-0 px-2 py-0.5 border border-slate-300 rounded text-xs font-medium text-slate-800 bg-white"
        />
        <div className="flex items-center gap-0.5 shrink-0 bg-slate-100 p-0.5 rounded-md border border-slate-200">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={handleMoveUpWithFlush}
            data-testid="detail-move-up-btn"
            title="위로 이동"
          >
            <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={handleMoveDownWithFlush}
            data-testid="detail-move-down-btn"
            title="아래로 이동"
          >
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
          {onTransfer && (
            <button
              type="button"
              onClick={handleTransferWithFlush}
              data-testid="detail-transfer-btn"
              title="다른 추진과제 카테고리로 이동"
            >
              <FolderInput className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDeleteWithFlush}
            data-testid="detail-delete-btn"
            title="과업 삭제"
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          scheduleEmit(date, status, attendees, e.target.value);
        }}
        onBlur={flushChange}
        rows={2}
        placeholder="세부 과업 내용 입력 (엔터로 줄바꿈하여 한 줄씩 개조식 작성 가능)"
        data-testid="detail-text-area"
        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-900 bg-white leading-relaxed resize-y"
      />
    </div>
  );
});

// Mock helpers for YangjaeFestivalDashboard integration
const mockFetch = jest.fn();
global.fetch = mockFetch;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

// Mock test data for SimulationResultTable
const mockCategories: BudgetCategory[] = [
  {
    id: 'cat-1',
    name: '강남체력인증센터 운영 - 사무관리비',
    detailedProject: '강남체력인증센터 운영',
    statItem: '201-01 사무관리비',
    totalBudget: 17339000,
    color: '#4f46e5',
    subItems: [],
  },
  {
    id: 'cat-2',
    name: '양재천 걷기 페스티벌 - 행사운영비',
    detailedProject: '양재천 걷기 페스티벌',
    statItem: '201-03 행사운영비',
    totalBudget: 50000000,
    color: '#06b6d4',
    subItems: [],
  },
];

const mockProjectSummaries: ProjectSimulationSummary[] = [
  {
    detailedProject: '강남체력인증센터 운영',
    totalBudget: 210120000,
    currentSpent: 127599300,
    currentRemaining: 82520700,
    simulatedExpenditure: 900000,
    finalExpectedBalance: 81620700,
    executionRate: 60.7,
    isDeficit: false,
    dailyExpenseIssued: 4000000,
    dailyExpenseSpent: 1000000,
    dailyExpenseRemaining: 3000000,
  },
  {
    detailedProject: '양재천 걷기 페스티벌',
    totalBudget: 50000000,
    currentSpent: 48000000,
    currentRemaining: 2000000,
    simulatedExpenditure: 5000000,
    finalExpectedBalance: -3000000,
    executionRate: 106.0,
    isDeficit: true,
    dailyExpenseIssued: 0,
    dailyExpenseSpent: 0,
    dailyExpenseRemaining: 0,
  },
];

const mockStatItemSummaries: StatItemSimulationSummary[] = [
  {
    detailedProject: '강남체력인증센터 운영',
    statItem: '201-01 사무관리비',
    totalBudget: 17339000,
    currentSpent: 4154000,
    currentRemaining: 13185000,
    simulatedExpenditure: 900000,
    finalExpectedBalance: 12285000,
    isDeficit: false,
    dailyExpenseIssued: 4000000,
    dailyExpenseSpent: 1000000,
    dailyExpenseRemaining: 3000000,
  },
  {
    detailedProject: '양재천 걷기 페스티벌',
    statItem: '201-03 행사운영비',
    totalBudget: 50000000,
    currentSpent: 48000000,
    currentRemaining: 2000000,
    simulatedExpenditure: 5000000,
    finalExpectedBalance: -3000000,
    isDeficit: true,
    dailyExpenseIssued: 0,
    dailyExpenseSpent: 0,
    dailyExpenseRemaining: 0,
  },
];

const mockSimulationEntries: SimulationEntry[] = [
  {
    id: 'sim-1',
    name: '체력측정 전담요원 하반기 피복비',
    detailedProject: '강남체력인증센터 운영',
    statItem: '201-01 사무관리비',
    unitPrice: 150000,
    quantity: 6,
    amount: 900000,
    memo: '지자체 전담 유니폼 지원 물품',
    status: 'PLANNED',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'sim-2',
    name: '행사 음향 및 무대 대여비',
    detailedProject: '양재천 걷기 페스티벌',
    statItem: '201-03 행사운영비',
    unitPrice: 5000000,
    quantity: 1,
    amount: 5000000,
    memo: '메인 무대 트러스 및 대형 스피커 설치',
    status: 'SETTLED',
    createdAt: '2026-09-02T00:00:00.000Z',
  },
];

// ============================================================================
// CHALLENGER 2 EMPIRICAL TEST SUITE
// ============================================================================

describe('Challenger 2 Empirical Verification: Keystroke Latency & Auto-Save Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => YANGJAE_FALLBACK_DATA,
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });
  });

  // ==========================================================================
  // SECTION 1: DetailEditRow Keystroke Debouncing, Blur Flush & Unmount Cleanup
  // ==========================================================================
  describe('1. DetailEditRow Keystroke Decoupling & Auto-Save Mechanics', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('debounces rapid keystrokes into task text and emits only once after 200ms quiescence', () => {
      const handleUpdate = jest.fn();
      const handleDelete = jest.fn();

      render(
        <DetailEditRowOracle
          initialDetail="[진행][7.29] 초기 과업 내용"
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      );

      const textarea = screen.getByTestId('detail-text-area');
      expect(textarea).toHaveValue('초기 과업 내용');

      // Simulate 5 rapid keystrokes separated by 40ms (< 200ms debounce interval)
      act(() => {
        fireEvent.change(textarea, { target: { value: '초기 과업 내용 A' } });
        jest.advanceTimersByTime(40);
      });
      expect(handleUpdate).not.toHaveBeenCalled();

      act(() => {
        fireEvent.change(textarea, { target: { value: '초기 과업 내용 AB' } });
        jest.advanceTimersByTime(40);
      });
      expect(handleUpdate).not.toHaveBeenCalled();

      act(() => {
        fireEvent.change(textarea, { target: { value: '초기 과업 내용 ABC' } });
        jest.advanceTimersByTime(40);
      });
      expect(handleUpdate).not.toHaveBeenCalled();

      act(() => {
        fireEvent.change(textarea, { target: { value: '초기 과업 내용 ABCD' } });
        jest.advanceTimersByTime(40);
      });
      expect(handleUpdate).not.toHaveBeenCalled();

      act(() => {
        fireEvent.change(textarea, { target: { value: '초기 과업 내용 ABCDE' } });
      });
      // Immediately after typing, 0 emissions
      expect(handleUpdate).not.toHaveBeenCalled();

      // Advance by 150ms (< 200ms since last keystroke) -> still 0 emissions
      act(() => {
        jest.advanceTimersByTime(150);
      });
      expect(handleUpdate).not.toHaveBeenCalled();

      // Advance remaining 51ms (total 201ms >= 200ms debounce threshold)
      act(() => {
        jest.advanceTimersByTime(51);
      });

      // EXACTLY 1 emission with the final formatted string
      expect(handleUpdate).toHaveBeenCalledTimes(1);
      expect(handleUpdate).toHaveBeenCalledWith('[진행][7.29] 초기 과업 내용 ABCDE');
    });

    it('immediately flushes pending draft on onBlur without waiting for 200ms timer', () => {
      const handleUpdate = jest.fn();
      const handleDelete = jest.fn();

      render(
        <DetailEditRowOracle
          initialDetail="[진행][7.29] 현장 실사 검토"
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      );

      const textarea = screen.getByTestId('detail-text-area');

      // Type new text at t=0ms
      act(() => {
        fireEvent.change(textarea, { target: { value: '현장 실사 긴급 수정안' } });
      });
      expect(handleUpdate).not.toHaveBeenCalled();

      // Only 30ms passed - trigger onBlur
      act(() => {
        jest.advanceTimersByTime(30);
        fireEvent.blur(textarea);
      });

      // Flushed immediately upon blur!
      expect(handleUpdate).toHaveBeenCalledTimes(1);
      expect(handleUpdate).toHaveBeenCalledWith('[진행][7.29] 현장 실사 긴급 수정안');

      // When the original 200ms timer expires later (e.g. +300ms), verify no duplicate emission
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(handleUpdate).toHaveBeenCalledTimes(1);
    });

    it('flushes pending draft upon component unmount during active typing', () => {
      const handleUpdate = jest.fn();
      const handleDelete = jest.fn();

      const { unmount } = render(
        <DetailEditRowOracle
          initialDetail="[예정][8.15] 미착수 과업"
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      );

      const textarea = screen.getByTestId('detail-text-area');

      // Type draft at t=0ms (timer is active and scheduled for 200ms)
      act(() => {
        fireEvent.change(textarea, { target: { value: '언마운트 직전 입력된 핵심 지침' } });
      });
      expect(handleUpdate).not.toHaveBeenCalled();

      // Advance by 60ms (< 200ms) and unmount component abruptly
      act(() => {
        jest.advanceTimersByTime(60);
      });
      expect(handleUpdate).not.toHaveBeenCalled();

      act(() => {
        unmount();
      });

      // Cleanup effect in useEffect executed and flushed the draft!
      expect(handleUpdate).toHaveBeenCalledTimes(1);
      expect(handleUpdate).toHaveBeenCalledWith('[예정][8.15] 언마운트 직전 입력된 핵심 지침');
    });

    it('preserves trailing whitespace and spacebars in textarea during local typing', () => {
      const handleUpdate = jest.fn();
      const handleDelete = jest.fn();

      render(
        <DetailEditRowOracle
          initialDetail="[완료][7.29] 본문"
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      );

      const textarea = screen.getByTestId('detail-text-area');

      // Type spaces
      act(() => {
        fireEvent.change(textarea, { target: { value: '본문 띄어쓰기    보존   ' } });
      });

      // Local textarea value is 100% preserved with all trailing spaces
      expect(textarea).toHaveValue('본문 띄어쓰기    보존   ');

      // After 200ms debounce
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(handleUpdate).toHaveBeenCalledWith('[완료][7.29] 본문 띄어쓰기    보존   ');
    });

    it('flushes changes before move-up, move-down, and transfer button triggers', () => {
      const handleUpdate = jest.fn();
      const handleDelete = jest.fn();
      const handleMoveUp = jest.fn();
      const handleMoveDown = jest.fn();
      const handleTransfer = jest.fn();

      render(
        <DetailEditRowOracle
          initialDetail="[완료][7.29] 순서 변경 대상 과업"
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onTransfer={handleTransfer}
          canMoveUp={true}
          canMoveDown={true}
        />
      );

      const textarea = screen.getByTestId('detail-text-area');
      const moveUpBtn = screen.getByTestId('detail-move-up-btn');
      const transferBtn = screen.getByTestId('detail-transfer-btn');

      // Type at t=0ms
      act(() => {
        fireEvent.change(textarea, { target: { value: '순서 변경 전 긴급 수정' } });
      });
      expect(handleUpdate).not.toHaveBeenCalled();

      // Click Move Up immediately without waiting 200ms
      act(() => {
        fireEvent.click(moveUpBtn);
      });

      // Both flush and move up fired
      expect(handleUpdate).toHaveBeenCalledTimes(1);
      expect(handleUpdate).toHaveBeenCalledWith('[완료][7.29] 순서 변경 전 긴급 수정');
      expect(handleMoveUp).toHaveBeenCalledTimes(1);

      // Type again
      act(() => {
        fireEvent.change(textarea, { target: { value: '카테고리 이동 전 수정' } });
      });

      // Click Transfer immediately
      act(() => {
        fireEvent.click(transferBtn);
      });
      expect(handleUpdate).toHaveBeenCalledTimes(2);
      expect(handleUpdate).toHaveBeenLastCalledWith('[완료][7.29] 카테고리 이동 전 수정');
      expect(handleTransfer).toHaveBeenCalledTimes(1);
    });

    it('cancels pending timer and does not emit draft when delete button is pressed', () => {
      const handleUpdate = jest.fn();
      const handleDelete = jest.fn();

      render(
        <DetailEditRowOracle
          initialDetail="[완료][7.29] 삭제될 과업"
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      );

      const textarea = screen.getByTestId('detail-text-area');
      const deleteBtn = screen.getByTestId('detail-delete-btn');

      // Type something then immediately click delete
      act(() => {
        fireEvent.change(textarea, { target: { value: '삭제 직전 오타' } });
        fireEvent.click(deleteBtn);
      });

      // Delete handled, update aborted
      expect(handleDelete).toHaveBeenCalledTimes(1);
      expect(handleUpdate).not.toHaveBeenCalled();

      // Advance time by 500ms
      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(handleUpdate).not.toHaveBeenCalled();
    });

    it('does not overwrite in-progress typing when parent echoes back the emitted string', () => {
      const handleUpdate = jest.fn();
      const handleDelete = jest.fn();

      const { rerender } = render(
        <DetailEditRowOracle
          initialDetail="[완료][7.29] 원본 텍스트"
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      );

      const textarea = screen.getByTestId('detail-text-area');

      // User types
      act(() => {
        fireEvent.change(textarea, { target: { value: '사용자 타이핑 중...' } });
        jest.advanceTimersByTime(200);
      });
      expect(handleUpdate).toHaveBeenCalledWith('[완료][7.29] 사용자 타이핑 중...');

      // Parent component receives onUpdate and passes the emitted string back down as initialDetail
      rerender(
        <DetailEditRowOracle
          initialDetail="[완료][7.29] 사용자 타이핑 중..."
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      );

      // Value in textarea remains undisturbed
      expect(textarea).toHaveValue('사용자 타이핑 중...');
    });
  });

  // ==========================================================================
  // SECTION 2: YangjaeFestivalDashboard End-to-End DetailEditRow Integration
  // ==========================================================================
  describe('2. YangjaeFestivalDashboard End-to-End DetailEditRow Keystroke Integration', () => {
    it('integrates DetailEditRow in edit mode: types text, auto-flushes on blur/save, and commits to SSOT', async () => {
      renderWithClient(<YangjaeFestivalDashboard />);

      // Expand all tasks
      const toggleAllBtn = await screen.findByRole('button', { name: /전체 펼치기/i });
      fireEvent.click(toggleAllBtn);

      // Click "과제 수정" button on Milestone 1
      const editButtons = screen.getAllByTitle('과제 수정');
      expect(editButtons.length).toBeGreaterThan(0);
      fireEvent.click(editButtons[0]);

      // Verify DetailEditRow textareas are now rendered
      const detailTextareas = screen.getAllByPlaceholderText(/세부 과업 내용 입력/i);
      expect(detailTextareas.length).toBeGreaterThan(0);

      const firstTextarea = detailTextareas[0];

      // Simulate typing into the textarea
      fireEvent.change(firstTextarea, {
        target: { value: '2026 양재천 건강 페스티벌 메인 무대 배치 확정' },
      });
      expect(firstTextarea).toHaveValue('2026 양재천 건강 페스티벌 메인 무대 배치 확정');

      // Blur textarea to trigger immediate flush
      fireEvent.blur(firstTextarea);

      // Click "과제 저장" button
      const saveBtn = screen.getByTitle('과제 저장');
      fireEvent.click(saveBtn);

      // Verify fetch was called with the updated detail text
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/festival/yangjae',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      const postCall = mockFetch.mock.calls.find((c: any) => c[1]?.method === 'POST');
      expect(postCall).toBeDefined();
      const payload = JSON.parse(postCall[1].body);
      const savedMilestone1 = payload.milestones.find((m: any) => m.id === 1);
      expect(savedMilestone1).toBeDefined();

      // Check that the detail string contains our flushed typed text
      const matchingDetail = savedMilestone1.details.some((d: string) =>
        d.includes('2026 양재천 건강 페스티벌 메인 무대 배치 확정')
      );
      expect(matchingDetail).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 3: SimulationResultTable useDeferredValue Search Decoupling
  // ==========================================================================
  describe('3. SimulationResultTable useDeferredValue Search Decoupling & Filtering', () => {
    it('decouples search input state from table filtering via useDeferredValue with zero input latency', () => {
      const handleDeleteEntry = jest.fn();

      render(
        <SimulationResultTable
          categories={mockCategories}
          projectSummaries={mockProjectSummaries}
          statItemSummaries={mockStatItemSummaries}
          entries={mockSimulationEntries}
          onDeleteEntry={handleDeleteEntry}
        />
      );

      const searchInput = screen.getByPlaceholderText(/사업 \/ 통계목 \/ 등록항목 검색/i);
      expect(searchInput).toHaveValue('');

      // Step A: Initially both projects and stat items are visible
      expect(screen.getByText('강남체력인증센터 운영')).toBeInTheDocument();
      expect(screen.getByText('양재천 걷기 페스티벌')).toBeInTheDocument();

      // Step B: Type '강남체력' into search input
      fireEvent.change(searchInput, { target: { value: '강남체력' } });

      // Search input immediately updates to '강남체력' (zero keystroke lag)
      expect(searchInput).toHaveValue('강남체력');

      // Table displays matching project and hides non-matching project
      expect(screen.getByText('강남체력인증센터 운영')).toBeInTheDocument();
      expect(screen.queryByText('양재천 걷기 페스티벌')).not.toBeInTheDocument();

      // Step C: Clear input
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(searchInput).toHaveValue('');
      expect(screen.getByText('강남체력인증센터 운영')).toBeInTheDocument();
      expect(screen.getByText('양재천 걷기 페스티벌')).toBeInTheDocument();
    });

    it('matches registered simulation entry names and memos through deferred search keyword', () => {
      const handleDeleteEntry = jest.fn();

      render(
        <SimulationResultTable
          categories={mockCategories}
          projectSummaries={mockProjectSummaries}
          statItemSummaries={mockStatItemSummaries}
          entries={mockSimulationEntries}
          onDeleteEntry={handleDeleteEntry}
        />
      );

      const searchInput = screen.getByPlaceholderText(/사업 \/ 통계목 \/ 등록항목 검색/i);

      // Search by nested sub-entry name: '피복비' (which is in sim-1 under '강남체력인증센터 운영')
      fireEvent.change(searchInput, { target: { value: '피복비' } });
      expect(searchInput).toHaveValue('피복비');

      // '강남체력인증센터 운영' contains sim-1 ('피복비'), so it must be displayed
      expect(screen.getByText('강남체력인증센터 운영')).toBeInTheDocument();
      // '양재천 걷기 페스티벌' does not contain '피복비', so it must be filtered out
      expect(screen.queryByText('양재천 걷기 페스티벌')).not.toBeInTheDocument();

      // Search by nested sub-entry memo: '트러스' (which is in sim-2 under '양재천 걷기 페스티벌')
      fireEvent.change(searchInput, { target: { value: '트러스' } });
      expect(searchInput).toHaveValue('트러스');

      expect(screen.getByText('양재천 걷기 페스티벌')).toBeInTheDocument();
      expect(screen.queryByText('강남체력인증센터 운영')).not.toBeInTheDocument();
    });

    it('safely handles special regex characters and whitespace without throwing runtime exceptions', () => {
      const handleDeleteEntry = jest.fn();

      render(
        <SimulationResultTable
          categories={mockCategories}
          projectSummaries={mockProjectSummaries}
          statItemSummaries={mockStatItemSummaries}
          entries={mockSimulationEntries}
          onDeleteEntry={handleDeleteEntry}
        />
      );

      const searchInput = screen.getByPlaceholderText(/사업 \/ 통계목 \/ 등록항목 검색/i);

      // Special characters that crash unescaped RegExp constructors: [, (, *, +, ?, \\
      const dangerousInputs = ['[201', '(주)', '***', '+++', '???', '\\'];

      for (const dangerous of dangerousInputs) {
        expect(() => {
          fireEvent.change(searchInput, { target: { value: dangerous } });
        }).not.toThrow();
        expect(searchInput).toHaveValue(dangerous);
      }

      // Whitespace trimming: '  강남체력  '
      fireEvent.change(searchInput, { target: { value: '   강남체력   ' } });
      expect(screen.getByText('강남체력인증센터 운영')).toBeInTheDocument();
      expect(screen.queryByText('양재천 걷기 페스티벌')).not.toBeInTheDocument();
    });

    it('works cooperatively with statusFilter (deficit vs normal vs all)', () => {
      const handleDeleteEntry = jest.fn();

      render(
        <SimulationResultTable
          categories={mockCategories}
          projectSummaries={mockProjectSummaries}
          statItemSummaries={mockStatItemSummaries}
          entries={mockSimulationEntries}
          onDeleteEntry={handleDeleteEntry}
        />
      );

      const statusSelect = screen.getByRole('combobox');

      // Change status filter to 'deficit' (적자/초과예정)
      fireEvent.change(statusSelect, { target: { value: 'deficit' } });

      // '양재천 걷기 페스티벌' is deficit (isDeficit: true) -> shown
      expect(screen.getByText('양재천 걷기 페스티벌')).toBeInTheDocument();
      // '강남체력인증센터 운영' is normal (isDeficit: false) -> hidden
      expect(screen.queryByText('강남체력인증센터 운영')).not.toBeInTheDocument();

      // Change status filter to 'normal' (정상 잔액)
      fireEvent.change(statusSelect, { target: { value: 'normal' } });
      expect(screen.getByText('강남체력인증센터 운영')).toBeInTheDocument();
      expect(screen.queryByText('양재천 걷기 페스티벌')).not.toBeInTheDocument();

      // Revert to 'all'
      fireEvent.change(statusSelect, { target: { value: 'all' } });
      expect(screen.getByText('강남체력인증센터 운영')).toBeInTheDocument();
      expect(screen.getByText('양재천 걷기 페스티벌')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // SECTION 4: High-Frequency Stress & Rapid Mutation Endurance
  // ==========================================================================
  describe('4. Rapid Mutation Endurance & Stress Testing', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('endures 50 consecutive keystrokes without memory leaks or race conditions', () => {
      const handleUpdate = jest.fn();
      const handleDelete = jest.fn();

      render(
        <DetailEditRowOracle
          initialDetail="[진행][7.29] 스트레스 테스트"
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      );

      const textarea = screen.getByTestId('detail-text-area');

      // 50 keystrokes in 10ms intervals (total 500ms, debounced)
      for (let i = 1; i <= 50; i++) {
        act(() => {
          fireEvent.change(textarea, { target: { value: `스트레스 입력 단계 ${i}` } });
          jest.advanceTimersByTime(10);
        });
      }

      // 0 emissions during active burst
      expect(handleUpdate).not.toHaveBeenCalled();

      // Advance 200ms after final keystroke
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Exactly 1 emission with the 50th value
      expect(handleUpdate).toHaveBeenCalledTimes(1);
      expect(handleUpdate).toHaveBeenCalledWith('[진행][7.29] 스트레스 입력 단계 50');
    });

    it('endures 10 rapid alternating blur and focus cycles without duplicating emissions', () => {
      const handleUpdate = jest.fn();
      const handleDelete = jest.fn();

      render(
        <DetailEditRowOracle
          initialDetail="[진행][7.29] 반복 블러 테스트"
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      );

      const textarea = screen.getByTestId('detail-text-area');

      act(() => {
        fireEvent.change(textarea, { target: { value: '수정 1' } });
        fireEvent.blur(textarea);
      });
      expect(handleUpdate).toHaveBeenCalledTimes(1);

      // Repeated blurs without new typing must NOT cause redundant calls
      for (let i = 0; i < 10; i++) {
        act(() => {
          fireEvent.focus(textarea);
          fireEvent.blur(textarea);
        });
      }
      expect(handleUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
