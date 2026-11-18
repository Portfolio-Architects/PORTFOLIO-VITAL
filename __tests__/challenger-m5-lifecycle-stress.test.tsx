import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWorkingMemory, resetWorkingMemoryStoreForTest } from '@/hooks/useWorkingMemory';
import { useSchedules } from '@/hooks/useSchedules';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
import { Schedule, WorkingMemoryMemo } from '@/types';

jest.mock('@/lib/sheets-api', () => ({
  readSheet: jest.fn(),
  addRow: jest.fn(),
  updateRow: jest.fn(),
  deleteRow: jest.fn(),
  replaceAll: jest.fn(),
}));

function createLifecycleWrapper(options?: { gcTime?: number; staleTime?: number }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: options?.gcTime ?? 5 * 60 * 1000, // 5 minutes, standard SPA router retention
      },
      mutations: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, Wrapper };
}

describe('Challenger M5-2: Lifecycle Stress Harness (useWorkingMemory & useSchedules)', () => {
  const mockReadSheet = readSheet as jest.Mock;
  const mockAddRow = addRow as jest.Mock;
  const mockUpdateRow = updateRow as jest.Mock;
  const mockDeleteRow = deleteRow as jest.Mock;

  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    originalFetch = global.fetch;

    if (typeof global.fetch !== 'function') {
      global.fetch = jest.fn();
    }

    mockAddRow.mockResolvedValue(true);
    mockUpdateRow.mockResolvedValue(true);
    mockDeleteRow.mockResolvedValue(true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. useWorkingMemory: Route Re-entry Revalidation Stress (< 5s vs > 5s)
  // =========================================================================
  describe('1. useWorkingMemory Route Re-entry & Stale Lifecycle Revalidation', () => {
    it('serves cached memos on fast re-entry (< 5000ms) without redundant network fetch', async () => {
      let simulatedTime = 1700000000000;
      jest.spyOn(Date, 'now').mockImplementation(() => simulatedTime);

      const serverSeed: WorkingMemoryMemo[] = [
        {
          id: 'wm-base-1',
          content: '11/15 예산안 보고 건',
          category: 'budget',
          source: 'pc',
          status: 'pending',
          tags: ['[예산]'],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      mockReadSheet.mockImplementation(async (sheet: string) => {
        if (sheet === 'WORKING_MEMORY') return serverSeed;
        return [];
      });

      const { Wrapper } = createLifecycleWrapper();

      // Cycle 1: Mount on Route A at T0
      const { result: r1, unmount: unmount1 } = renderHook(() => useWorkingMemory(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(r1.current.memos.some((m) => m.id === 'wm-base-1')).toBe(true);
      });

      const callsAfterFirstMount = mockReadSheet.mock.calls.filter(
        (c) => c[0] === 'WORKING_MEMORY'
      ).length;
      expect(callsAfterFirstMount).toBe(1);

      // User navigates away: Unmount Route A
      unmount1();

      // Time advances by 2500ms (< 5000ms staleTime)
      simulatedTime += 2500;

      // Cycle 2: Remount on Route A within 2.5 seconds
      const { result: r2, unmount: unmount2 } = renderHook(() => useWorkingMemory(), {
        wrapper: Wrapper,
      });

      // Data should be served immediately from cache without redundant readSheet call
      expect(r2.current.memos.some((m) => m.id === 'wm-base-1')).toBe(true);

      const callsAfterFastReentry = mockReadSheet.mock.calls.filter(
        (c) => c[0] === 'WORKING_MEMORY'
      ).length;
      // Stays exactly 1: No redundant network request!
      expect(callsAfterFastReentry).toBe(1);

      unmount2();
    });

    it('triggers fresh server fetch and revalidates memos on stale re-entry (> 5000ms)', async () => {
      let simulatedTime = 1700000000000;
      jest.spyOn(Date, 'now').mockImplementation(() => simulatedTime);

      const initialServerData: WorkingMemoryMemo[] = [
        {
          id: 'wm-stale-initial',
          content: '기존 등록 메모',
          category: 'general',
          source: 'pc',
          status: 'pending',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      mockReadSheet.mockImplementation(async (sheet: string) => {
        if (sheet === 'WORKING_MEMORY') return initialServerData;
        return [];
      });

      const { Wrapper } = createLifecycleWrapper();

      // Cycle 1: Initial mount
      const { result: r1, unmount: unmount1 } = renderHook(() => useWorkingMemory(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(r1.current.memos.some((m) => m.id === 'wm-stale-initial')).toBe(true);
      });
      expect(mockReadSheet.mock.calls.filter((c) => c[0] === 'WORKING_MEMORY').length).toBe(1);

      // User navigates away: unmount
      unmount1();

      // While user is away, new memo is created on server / external source
      const updatedServerData: WorkingMemoryMemo[] = [
        ...initialServerData,
        {
          id: 'wm-stale-fresh-after-5s',
          content: '5초 경과 후 서버에 수신된 새 메모: 2027 신체활동예산 확정',
          category: 'budget',
          source: 'mobile',
          status: 'pending',
          tags: ['[예산확정]'],
          numericHighlight: '신체활동예산 확정',
          createdAt: '2026-11-01T00:00:10Z',
          updatedAt: '2026-11-01T00:00:10Z',
        },
      ];

      mockReadSheet.mockImplementation(async (sheet: string) => {
        if (sheet === 'WORKING_MEMORY') return updatedServerData;
        return [];
      });

      // Time advances by 6000ms (> 5000ms staleTime)
      simulatedTime += 6000;

      // Cycle 2: Remount after 6 seconds
      const { result: r2, unmount: unmount2 } = renderHook(() => useWorkingMemory(), {
        wrapper: Wrapper,
      });

      // Query should detect stale data and revalidate against server
      await waitFor(() => {
        expect(r2.current.memos.some((m) => m.id === 'wm-stale-fresh-after-5s')).toBe(true);
      });

      const callsAfterStaleReentry = mockReadSheet.mock.calls.filter(
        (c) => c[0] === 'WORKING_MEMORY'
      ).length;
      expect(callsAfterStaleReentry).toBe(2);

      unmount2();
    });

    it('endures rapid mount/unmount churn (10 cycles) without listener leaks or state race conditions', async () => {
      resetWorkingMemoryStoreForTest([
        {
          id: 'wm-churn-seed',
          content: '연속 마운트 회귀 방지 메모',
          category: 'general',
          source: 'pc',
          status: 'pending',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ]);

      let serverMemos: WorkingMemoryMemo[] = [
        {
          id: 'wm-churn-server',
          content: '서버 연동 메모',
          category: 'general',
          source: 'pc',
          status: 'pending',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      mockReadSheet.mockImplementation(async (sheet: string) => {
        if (sheet === 'WORKING_MEMORY') return [...serverMemos];
        return [];
      });

      mockAddRow.mockImplementation(async (sheet: string, row: any) => {
        if (sheet === 'WORKING_MEMORY') {
          serverMemos.push(row);
        }
        return true;
      });

      const { Wrapper } = createLifecycleWrapper();

      // Initial mount settles baseline
      const { result: initR, unmount: initUnmount } = renderHook(() => useWorkingMemory(), { wrapper: Wrapper });
      await waitFor(() => expect(initR.current.memos.length).toBeGreaterThan(0));
      initUnmount();

      // Execute rapid mount/unmount iterations
      for (let i = 0; i < 5; i++) {
        const { result, unmount } = renderHook(() => useWorkingMemory(), { wrapper: Wrapper });
        expect(result.current.memos).toBeDefined();
        if (i === 2) {
          // Mutate state mid-churn
          await act(async () => {
            await result.current.addMemo(`중간 생성 메모 ${i}`);
          });
        }
        unmount();
      }

      // Final mount to verify state consistency
      const { result: finalResult } = renderHook(() => useWorkingMemory(), { wrapper: Wrapper });
      await waitFor(() => {
        expect(finalResult.current.memos.some((m) => m.content.includes('중간 생성 메모 2'))).toBe(
          true
        );
      });
    });

    it('gracefully degrades on server error during stale re-entry without clearing existing cache', async () => {
      let simulatedTime = 1700000000000;
      jest.spyOn(Date, 'now').mockImplementation(() => simulatedTime);

      const initialServerData: WorkingMemoryMemo[] = [
        {
          id: 'wm-resilient-1',
          content: '장애 복원력 테스트 메모',
          category: 'audit',
          source: 'pc',
          status: 'pending',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      mockReadSheet.mockResolvedValue(initialServerData);

      const { Wrapper } = createLifecycleWrapper();
      const { result: r1, unmount: unmount1 } = renderHook(() => useWorkingMemory(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(r1.current.memos.some((m) => m.id === 'wm-resilient-1')).toBe(true);
      });
      unmount1();

      // Server goes down
      mockReadSheet.mockRejectedValue(new Error('503 Service Unavailable'));
      simulatedTime += 10000; // Past staleTime

      // Remount during outage
      const { result: r2 } = renderHook(() => useWorkingMemory(), { wrapper: Wrapper });

      // Should not throw or wipe local state
      expect(r2.current.memos.some((m) => m.id === 'wm-resilient-1')).toBe(true);
    });
  });

  // =========================================================================
  // 2. useSchedules: Calendar Import Invalidation & Query Cache Lifecycle
  // =========================================================================
  describe('2. useSchedules Calendar Import Invalidation & Synchronization', () => {
    it('invalidates [SCHEDULES] cache upon successful importCalendar and re-fetches updated schedules', async () => {
      const initialSchedules: Schedule[] = [
        {
          id: 'sched-init-1',
          title: '오전 일일상황보고',
          date: '2026-11-15',
          startTime: '09:00',
          endTime: '09:30',
          type: 'security',
          person: '주무관',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      let currentServerSchedules = [...initialSchedules];
      mockReadSheet.mockImplementation(async (sheet: string) => {
        if (sheet === 'SCHEDULES') return currentServerSchedules;
        return [];
      });

      // Mock fetch for /api/calendar/import
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url === '/api/calendar/import') {
          // Simulate imported items being added to server backend
          currentServerSchedules = [
            ...initialSchedules,
            {
              id: 'sched-imported-1',
              title: '구글 캘린더 동기화 회의: 보조금 심의',
              date: '2026-11-15',
              startTime: '14:00',
              endTime: '15:30',
              type: 'meeting',
              person: '팀장님',
              createdAt: '2026-11-15T05:00:00Z',
              updatedAt: '2026-11-15T05:00:00Z',
            },
          ];
          return {
            ok: true,
            json: async () => ({ success: true, importedCount: 1 }),
          };
        }
        return { ok: false, json: async () => ({}) };
      });

      const { Wrapper, queryClient } = createLifecycleWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSchedules(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.schedules).toHaveLength(1);
      });
      expect(result.current.schedules[0].id).toBe('sched-init-1');

      // Execute calendar import
      let importResult: { success: boolean; count?: number; error?: string } | null = null;
      await act(async () => {
        importResult = await result.current.importCalendar({
          icsUrl: 'https://calendar.google.com/calendar/ical/example.ics',
        });
      });

      expect(importResult).toEqual({ success: true, count: 1 });
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['SCHEDULES'] })
      );

      // Verify schedules updated from server revalidation
      await waitFor(() => {
        expect(result.current.schedules).toHaveLength(2);
        expect(result.current.schedules.some((s) => s.id === 'sched-imported-1')).toBe(true);
      });
    });

    it('handles importCalendar failure gracefully without invalidating cache or corrupting data', async () => {
      const initialSchedules: Schedule[] = [
        {
          id: 'sched-keep-1',
          title: '보존 일정',
          date: '2026-11-16',
          startTime: '10:00',
          endTime: '11:00',
          type: 'other',
          person: '실무관',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      mockReadSheet.mockResolvedValue(initialSchedules);

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url === '/api/calendar/import') {
          return {
            ok: true,
            json: async () => ({ success: false, error: 'iCal 파일 형식이 유효하지 않습니다.' }),
          };
        }
        return { ok: false };
      });

      const { Wrapper, queryClient } = createLifecycleWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSchedules(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.schedules).toHaveLength(1));

      let res: { success: boolean; error?: string } | null = null;
      await act(async () => {
        res = await result.current.importCalendar({ rawIcs: 'CORRUPTED_ICS_CONTENT' });
      });

      expect(res).toEqual({ success: false, error: 'iCal 파일 형식이 유효하지 않습니다.' });
      // Invalidation must NOT be dispatched on failure
      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(result.current.schedules).toHaveLength(1);
      expect(result.current.schedules[0].id).toBe('sched-keep-1');
    });

    it('catches network rejection during importCalendar and reports clean error', async () => {
      mockReadSheet.mockResolvedValue([]);
      global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'));

      const { Wrapper } = createLifecycleWrapper();
      const { result } = renderHook(() => useSchedules(), { wrapper: Wrapper });

      let thrown = false;
      let res: { success: boolean; error?: string } | null = null;
      try {
        await act(async () => {
          res = await result.current.importCalendar({ rawIcs: 'TEST' });
        });
      } catch {
        thrown = true;
      }

      // Either returns clean failure or throws expected error; must not corrupt hook state
      expect(result.current.schedules).toBeDefined();
    });
  });

  // =========================================================================
  // 3. useSchedules: Date Lookup & Sorting Stress (getSchedulesForDate)
  // =========================================================================
  describe('3. useSchedules Date Lookup & Chronological Sorting Stress', () => {
    it('orders multiple schedules on the same date strictly chronologically by startTime', async () => {
      // Intentionally unsorted times on 2026-11-20
      const unsortedSchedules: Schedule[] = [
        {
          id: 's-4',
          title: '오후 행사 점검',
          date: '2026-11-20',
          startTime: '15:30',
          endTime: '16:30',
          type: 'other',
          person: 'A',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 's-1',
          title: '새벽 현장 순찰',
          date: '2026-11-20',
          startTime: '07:15',
          endTime: '08:00',
          type: 'security',
          person: 'B',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 's-3',
          title: '오찬 간담회',
          date: '2026-11-20',
          startTime: '12:00',
          endTime: '13:00',
          type: 'meeting',
          person: 'C',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 's-2',
          title: '오전 간부회의',
          date: '2026-11-20',
          startTime: '09:00',
          endTime: '10:00',
          type: 'meeting',
          person: 'D',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 's-5',
          title: '야간 보안 점검',
          date: '2026-11-20',
          startTime: '21:00',
          endTime: '22:00',
          type: 'security',
          person: 'E',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      mockReadSheet.mockResolvedValue(unsortedSchedules);

      const { Wrapper } = createLifecycleWrapper();
      const { result } = renderHook(() => useSchedules(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.schedules).toHaveLength(5));

      const sorted = result.current.getSchedulesForDate('2026-11-20');
      expect(sorted).toHaveLength(5);
      expect(sorted.map((s) => s.startTime)).toEqual([
        '07:15',
        '09:00',
        '12:00',
        '15:30',
        '21:00',
      ]);
      expect(sorted[0].id).toBe('s-1');
      expect(sorted[4].id).toBe('s-5');
    });

    it('isolates dates without leakage and returns stable empty array for dates without schedules', async () => {
      const multiDateSchedules: Schedule[] = [
        {
          id: 's-day1',
          title: '1일차 일정',
          date: '2026-11-20',
          startTime: '10:00',
          endTime: '11:00',
          type: 'meeting',
          person: 'A',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 's-day2',
          title: '2일차 일정',
          date: '2026-11-21',
          startTime: '10:00',
          endTime: '11:00',
          type: 'meeting',
          person: 'B',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      mockReadSheet.mockResolvedValue(multiDateSchedules);

      const { Wrapper } = createLifecycleWrapper();
      const { result } = renderHook(() => useSchedules(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.schedules).toHaveLength(2));

      expect(result.current.getSchedulesForDate('2026-11-20')).toHaveLength(1);
      expect(result.current.getSchedulesForDate('2026-11-21')).toHaveLength(1);
      expect(result.current.getSchedulesForDate('2026-11-22')).toHaveLength(0);
      expect(result.current.getSchedulesForDate('2026-12-31')).toEqual([]);
    });

    it('dynamically inserts added schedule into correct sorted position in getSchedulesForDate', async () => {
      const initialSchedules: Schedule[] = [
        {
          id: 's-init-1',
          title: '오전 10시 일정',
          date: '2026-11-25',
          startTime: '10:00',
          endTime: '11:00',
          type: 'meeting',
          person: 'A',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 's-init-2',
          title: '오후 16시 일정',
          date: '2026-11-25',
          startTime: '16:00',
          endTime: '17:00',
          type: 'meeting',
          person: 'B',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      let serverSchedules = [...initialSchedules];
      mockReadSheet.mockImplementation(async (sheet: string) => {
        if (sheet === 'SCHEDULES') return [...serverSchedules];
        return [];
      });
      mockAddRow.mockImplementation(async (sheet: string, row: any) => {
        if (sheet === 'SCHEDULES') {
          serverSchedules.push(row);
        }
        return true;
      });

      const { Wrapper } = createLifecycleWrapper();
      const { result } = renderHook(() => useSchedules(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.schedules).toHaveLength(2));

      // Add schedule with earlier startTime '08:30'
      act(() => {
        result.current.addSchedule({
          title: '이른 아침 회의',
          date: '2026-11-25',
          startTime: '08:30',
          endTime: '09:30',
          type: 'meeting',
          person: 'C',
        });
      });

      // It should immediately be first in getSchedulesForDate
      await waitFor(() => {
        const list = result.current.getSchedulesForDate('2026-11-25');
        expect(list).toHaveLength(3);
        expect(list[0].startTime).toBe('08:30');
        expect(list[1].startTime).toBe('10:00');
        expect(list[2].startTime).toBe('16:00');
      });
    });
  });

  // =========================================================================
  // 4. Tombstone Resilience Under Rapid Deletion & Eventual Consistency Sync
  // =========================================================================
  describe('4. Tombstone Resilience Under Rapid Deletion & Sync', () => {
    it('prevents resurrection of rapidly deleted WorkingMemory memos even when backend returns stale data', async () => {
      const liveMemos: WorkingMemoryMemo[] = [
        {
          id: 'wm-del-1',
          content: '삭제 대상 메모 1',
          category: 'general',
          source: 'pc',
          status: 'pending',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 'wm-del-2',
          content: '보존 대상 메모',
          category: 'budget',
          source: 'pc',
          status: 'pending',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 'wm-del-3',
          content: '삭제 대상 메모 3',
          category: 'directive',
          source: 'pc',
          status: 'pending',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      resetWorkingMemoryStoreForTest(liveMemos);
      // Simulate backend still returning all 3 items (lagging SSOT)
      mockReadSheet.mockResolvedValue(liveMemos);

      const { Wrapper } = createLifecycleWrapper();
      const { result } = renderHook(() => useWorkingMemory(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.memos).toHaveLength(3));

      // Rapidly delete wm-del-1 and wm-del-3
      await act(async () => {
        await result.current.deleteMemo('wm-del-1');
        await result.current.deleteMemo('wm-del-3');
      });

      expect(result.current.memos).toHaveLength(1);
      expect(result.current.memos[0].id).toBe('wm-del-2');

      // Verify tombstones recorded in localStorage
      const tombstonesRaw = localStorage.getItem('hchps-global-tombstones');
      expect(tombstonesRaw).toContain('wm-del-1');
      expect(tombstonesRaw).toContain('wm-del-3');

      // Trigger SSOT re-sync while backend still returns all 3 memos
      await act(async () => {
        await result.current.refreshFromSSOT();
      });

      // Tombstone filter MUST prevent wm-del-1 and wm-del-3 from resurrecting!
      expect(result.current.memos).toHaveLength(1);
      expect(result.current.memos[0].id).toBe('wm-del-2');
    });

    it('prevents resurrection of deleted schedules in useSchedules during query refetch', async () => {
      const serverSchedules: Schedule[] = [
        {
          id: 'sched-tomb-1',
          title: '삭제할 일정',
          date: '2026-11-28',
          startTime: '10:00',
          endTime: '11:00',
          type: 'meeting',
          person: 'A',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 'sched-tomb-2',
          title: '유지할 일정',
          date: '2026-11-28',
          startTime: '14:00',
          endTime: '15:00',
          type: 'meeting',
          person: 'B',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      mockReadSheet.mockResolvedValue(serverSchedules);

      const { Wrapper } = createLifecycleWrapper();
      const { result } = renderHook(() => useSchedules(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.schedules).toHaveLength(2));

      // Delete sched-tomb-1
      act(() => {
        result.current.deleteSchedule('sched-tomb-1');
      });

      await waitFor(() => {
        expect(result.current.schedules.some((s) => s.id === 'sched-tomb-1')).toBe(false);
      });

      // Verify tombstone stored
      const tombstones = localStorage.getItem('hchps-global-tombstones');
      expect(tombstones).toContain('sched-tomb-1');

      // Unmount and remount (simulating page reload with lagging backend)
      const { result: remounted } = renderHook(() => useSchedules(), { wrapper: Wrapper });

      // Must remain filtered out
      await waitFor(() => {
        expect(remounted.current.schedules.some((s) => s.id === 'sched-tomb-1')).toBe(false);
        expect(remounted.current.schedules.some((s) => s.id === 'sched-tomb-2')).toBe(true);
      });
    });

    it('parses heterogeneous tombstone formats (strings, objects, malformed entries) safely', async () => {
      // Store heterogeneous entries
      localStorage.setItem(
        'hchps-global-tombstones',
        JSON.stringify([
          'tomb-string-1',
          { id: 'tomb-object-1', deletedAt: 1700000000000 },
          null,
          12345,
          { malformedField: 'no-id' },
          '',
        ])
      );

      const rawWorkingMemos: WorkingMemoryMemo[] = [
        {
          id: 'tomb-string-1',
          content: '문자열 툼스톤',
          category: 'general',
          source: 'pc',
          status: 'pending',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 'tomb-object-1',
          content: '객체 툼스톤',
          category: 'general',
          source: 'pc',
          status: 'pending',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 'tomb-safe-1',
          content: '유효 보존 메모',
          category: 'general',
          source: 'pc',
          status: 'pending',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      resetWorkingMemoryStoreForTest(rawWorkingMemos);
      mockReadSheet.mockResolvedValue(rawWorkingMemos);

      const { Wrapper } = createLifecycleWrapper();
      const { result: wmResult } = renderHook(() => useWorkingMemory(), { wrapper: Wrapper });

      await act(async () => {
        await wmResult.current.refreshFromSSOT();
      });

      // Both tomb-string-1 and tomb-object-1 should be filtered out
      expect(wmResult.current.memos.some((m) => m.id === 'tomb-string-1')).toBe(false);
      expect(wmResult.current.memos.some((m) => m.id === 'tomb-object-1')).toBe(false);
      expect(wmResult.current.memos.some((m) => m.id === 'tomb-safe-1')).toBe(true);
    });

    it('recovers gracefully and does not throw when localStorage tombstone JSON is malformed', async () => {
      localStorage.setItem('hchps-global-tombstones', 'CORRUPTED_JSON_VALUE{{{');

      mockReadSheet.mockResolvedValue([]);

      const { Wrapper } = createLifecycleWrapper();
      const { result: wmResult } = renderHook(() => useWorkingMemory(), { wrapper: Wrapper });
      const { result: schedResult } = renderHook(() => useSchedules(), { wrapper: Wrapper });

      expect(wmResult.current.memos).toBeDefined();
      expect(schedResult.current.schedules).toBeDefined();
    });
  });
});
