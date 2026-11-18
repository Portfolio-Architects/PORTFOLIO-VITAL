import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProjects } from '@/hooks/useProjects';
import { useMeetings } from '@/hooks/useMeetings';
import { useSchedules } from '@/hooks/useSchedules';
import { useWorkingMemory, resetWorkingMemoryStoreForTest } from '@/hooks/useWorkingMemory';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
import { Project, Meeting, Schedule, Task, WorkingMemoryMemo } from '@/types';

jest.mock('@/lib/sheets-api', () => ({
  readSheet: jest.fn(),
  addRow: jest.fn(),
  updateRow: jest.fn(),
  deleteRow: jest.fn(),
  replaceAll: jest.fn(),
}));

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
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

describe('Milestone 5: State Management Unification Suite (P3-C & P3-D)', () => {
  const mockReadSheet = readSheet as jest.Mock;
  const mockAddRow = addRow as jest.Mock;
  const mockUpdateRow = updateRow as jest.Mock;
  const mockDeleteRow = deleteRow as jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();

    mockReadSheet.mockImplementation(async (sheet: string) => {
      if (sheet === 'PROJECTS') {
        return [
          {
            id: 'proj-1',
            name: '건강도시 프로젝트',
            description: '도시 건강 인프라 구축',
            color: '#3b82f6',
            checklistItems: [
              { id: 'c-1', text: '기초 조사', completed: true },
              { id: 'c-2', text: '주민 공청회', completed: false },
            ],
            createdAt: '2026-11-01T00:00:00Z',
            updatedAt: '2026-11-01T00:00:00Z',
          },
        ];
      }
      if (sheet === 'TASKS') {
        return [
          {
            id: 'task-1',
            projectId: 'proj-1',
            title: '주민 공청회 자료 준비',
            status: 'todo',
            priority: 'high',
            category: '사업관리',
            tags: [],
            createdAt: '2026-11-01T00:00:00Z',
            updatedAt: '2026-11-01T00:00:00Z',
          },
          {
            id: 'task-2',
            projectId: 'proj-other',
            title: '독립 업무',
            status: 'todo',
            priority: 'medium',
            category: '일반',
            tags: [],
            createdAt: '2026-11-01T00:00:00Z',
            updatedAt: '2026-11-01T00:00:00Z',
          },
        ];
      }
      if (sheet === 'MEETINGS') {
        return [
          {
            id: 'meet-1',
            title: '주간 전략회의',
            datetime: '2026-12-01T10:00:00Z',
            agenda: '예산 심의',
            notes: '특이사항 없음',
            attendees: ['팀장님', '실무관'],
            createdAt: '2026-11-01T00:00:00Z',
            updatedAt: '2026-11-01T00:00:00Z',
          },
        ];
      }
      if (sheet === 'SCHEDULES') {
        return [
          {
            id: 'sched-1',
            title: '구청장 주재 현안보고',
            date: '2026-11-15',
            startTime: '10:00',
            endTime: '11:30',
            notes: '기획상황실',
            type: 'meeting',
            person: '기획관',
            createdAt: '2026-11-01T00:00:00Z',
            updatedAt: '2026-11-01T00:00:00Z',
          },
        ];
      }
      if (sheet === 'WORKING_MEMORY') {
        return [
          {
            id: 'wm-server-1',
            content: '11/15 현안보고: 건강생활실천 예산 1,000만 원 증액안 보고',
            category: 'budget',
            source: 'pc',
            status: 'pending',
            tags: ['[예산보고]'],
            numericHighlight: '1,000만 원 증액',
            dateHighlight: '11. 15.',
            createdAt: '2026-11-01T00:00:00Z',
            updatedAt: '2026-11-01T00:00:00Z',
          },
        ];
      }
      return [];
    });

    mockAddRow.mockResolvedValue(true);
    mockUpdateRow.mockResolvedValue(true);
    mockDeleteRow.mockResolvedValue(true);
  });

  describe('1. P3-C: useProjects React Query Integration & Cascade Deletion', () => {
    it('populates cache under [PROJECTS] and provides O(1) lookups and progress calculation', async () => {
      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.projects.length).toBeGreaterThan(0);
      });

      expect(result.current.projects[0].id).toBe('proj-1');
      expect(result.current.getProjectById('proj-1')?.name).toBe('건강도시 프로젝트');
      // 1 out of 2 completed => 50%
      expect(result.current.getProjectProgress('proj-1')).toBe(50);
    });

    it('performs optimistic mutations for addProject, updateProject, and checklist items', async () => {
      const { Wrapper, queryClient } = createTestWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.projects.length).toBe(1));

      // 1. Add Project
      let added: Project | null = null;
      act(() => {
        added = result.current.addProject({
          name: '신규 걷기 코스 조성',
          description: '양재천 5대 코스 정비',
          color: '#10b981',
        });
      });

      expect(added).not.toBeNull();
      await waitFor(() => {
        expect(result.current.projects.some((p) => p.name === '신규 걷기 코스 조성')).toBe(true);
      });

      // Verify React Query cache has it
      const cached = queryClient.getQueryData<Project[]>(['PROJECTS']);
      expect(cached?.some((p) => p.name === '신규 걷기 코스 조성')).toBe(true);

      // 2. Add Checklist Item
      act(() => {
        result.current.addChecklistItem('proj-1', '현장 안내판 점검');
      });

      await waitFor(() => {
        expect(
          result.current
            .getProjectById('proj-1')
            ?.checklistItems?.some((item) => item.text === '현장 안내판 점검')
        ).toBe(true);
      });

      // 3. Toggle Checklist Item
      act(() => {
        result.current.toggleChecklistItem('proj-1', 'c-2');
      });
      // Now c-1 (true), c-2 (true), and new item (false) => 2/3 = 67%
      await waitFor(() => {
        expect(result.current.getProjectProgress('proj-1')).toBe(67);
      });

      // 4. Delete Checklist Item
      act(() => {
        result.current.deleteChecklistItem('proj-1', 'c-1');
      });
      await waitFor(() => {
        expect(
          result.current
            .getProjectById('proj-1')
            ?.checklistItems?.some((item) => item.id === 'c-1')
        ).toBe(false);
      });
    });

    it('deletes project, cascades task deletion for matching projectId, and invalidates [TASKS]', async () => {
      const { Wrapper, queryClient } = createTestWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.projects.length).toBe(1));

      act(() => {
        result.current.deleteProject('proj-1');
      });

      // Project removed optimistically
      await waitFor(() => {
        expect(result.current.projects.some((p) => p.id === 'proj-1')).toBe(false);
      });

      // Wait for cascade deletion to process matching tasks
      await waitFor(() => {
        expect(mockDeleteRow).toHaveBeenCalledWith('TASKS', 'task-1');
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['TASKS'] })
        );
      });

      // Task-2 should NOT have been deleted
      expect(mockDeleteRow).not.toHaveBeenCalledWith('TASKS', 'task-2');
    });

    it('safely falls back without QueryClientProvider and does not throw', () => {
      localStorage.setItem(
        'hchps-projects',
        JSON.stringify([
          {
            id: 'proj-offline',
            name: '오프라인 보존 프로젝트',
            description: '',
            color: '#6b7280',
            checklistItems: [],
          },
        ])
      );

      // Render WITHOUT QueryClientProvider
      const { result } = renderHook(() => useProjects());

      expect(result.current.projects).toBeDefined();
      expect(result.current.projects[0]?.name).toBe('오프라인 보존 프로젝트');
      expect(typeof result.current.addProject).toBe('function');
      expect(typeof result.current.getProjectById).toBe('function');
    });
  });

  describe('2. P3-C: useMeetings React Query Integration', () => {
    it('populates cache under [MEETINGS] and provides upcoming and today filters', async () => {
      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useMeetings(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.meetings.length).toBe(1);
      });

      expect(result.current.meetings[0].title).toBe('주간 전략회의');
      expect(result.current.getMeetingById('meet-1')?.agenda).toBe('예산 심의');
      expect(result.current.getUpcomingMeetings().length).toBeGreaterThan(0);
    });

    it('performs optimistic mutations for addMeeting, updateMeeting, and deleteMeeting', async () => {
      const { Wrapper, queryClient } = createTestWrapper();
      const { result } = renderHook(() => useMeetings(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.meetings.length).toBe(1));

      let newMeet: Meeting | null = null;
      act(() => {
        newMeet = result.current.addMeeting({
          title: '긴급 현안 점검',
          datetime: '2026-11-20T14:00:00Z',
          agenda: '보조금 교부 확인',
          notes: '',
          attendees: ['실무관'],
        });
      });

      expect(newMeet).not.toBeNull();
      await waitFor(() => {
        expect(result.current.meetings.some((m) => m.title === '긴급 현안 점검')).toBe(true);
      });

      const cached = queryClient.getQueryData<Meeting[]>(['MEETINGS']);
      expect(cached?.some((m) => m.title === '긴급 현안 점검')).toBe(true);

      // Update
      act(() => {
        result.current.updateMeeting('meet-1', { notes: '의결 완료' });
      });
      await waitFor(() => {
        expect(result.current.getMeetingById('meet-1')?.notes).toBe('의결 완료');
      });

      // Delete
      act(() => {
        result.current.deleteMeeting('meet-1');
      });
      await waitFor(() => {
        expect(result.current.meetings.some((m) => m.id === 'meet-1')).toBe(false);
      });
    });

    it('safely falls back without QueryClientProvider and does not throw', () => {
      localStorage.setItem(
        'hchps-meetings',
        JSON.stringify([
          {
            id: 'meet-offline',
            title: '오프라인 회의',
            datetime: '2026-11-12T09:00:00Z',
            agenda: '',
            notes: '',
            attendees: [],
          },
        ])
      );

      const { result } = renderHook(() => useMeetings());
      expect(result.current.meetings).toBeDefined();
      expect(result.current.meetings[0]?.title).toBe('오프라인 회의');
      expect(typeof result.current.addMeeting).toBe('function');
    });
  });

  describe('3. P3-C: useSchedules React Query Integration & importCalendar Invalidation', () => {
    it('populates cache under [SCHEDULES] and provides sorted date lookups', async () => {
      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useSchedules(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.schedules.length).toBe(1);
      });

      expect(result.current.schedules[0].title).toBe('구청장 주재 현안보고');
      const dateSchedules = result.current.getSchedulesForDate('2026-11-15');
      expect(dateSchedules.length).toBe(1);
      expect(dateSchedules[0].startTime).toBe('10:00');
    });

    it('performs optimistic mutations for addSchedule, updateSchedule, and deleteSchedule', async () => {
      const { Wrapper, queryClient } = createTestWrapper();
      const { result } = renderHook(() => useSchedules(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.schedules.length).toBe(1));

      let addedSched: Schedule | null = null;
      act(() => {
        addedSched = result.current.addSchedule({
          title: '오후 의전 점검',
          date: '2026-11-15',
          startTime: '14:00',
          endTime: '15:00',
          notes: '양재천 야외공연장',
          type: 'other',
          person: '실무관',
        });
      });

      expect(addedSched).not.toBeNull();
      await waitFor(() => {
        expect(result.current.schedules.some((s) => s.title === '오후 의전 점검')).toBe(true);
      });

      const cached = queryClient.getQueryData<Schedule[]>(['SCHEDULES']);
      expect(cached?.some((s) => s.title === '오후 의전 점검')).toBe(true);

      // Verify date map has both sorted by startTime
      await waitFor(() => {
        const forDate = result.current.getSchedulesForDate('2026-11-15');
        expect(forDate).toHaveLength(2);
        expect(forDate[0].startTime).toBe('10:00');
        expect(forDate[1].startTime).toBe('14:00');
      });

      // Delete
      act(() => {
        result.current.deleteSchedule('sched-1');
      });
      await waitFor(() => {
        expect(result.current.schedules.some((s) => s.id === 'sched-1')).toBe(false);
      });
    });

    it('invalidates [SCHEDULES] cache upon successful importCalendar', async () => {
      const { Wrapper, queryClient } = createTestWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, importedCount: 3 }),
      });

      const { result } = renderHook(() => useSchedules(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.schedules.length).toBe(1));

      let res: { success: boolean; count?: number } | null = null;
      await act(async () => {
        res = await result.current.importCalendar({ rawIcs: 'BEGIN:VCALENDAR...' });
      });

      expect(res).toEqual({ success: true, count: 3 });
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['SCHEDULES'] })
      );
    });

    it('safely falls back without QueryClientProvider and does not throw', () => {
      localStorage.setItem(
        'hchps-schedules',
        JSON.stringify([
          {
            id: 'sched-offline',
            title: '오프라인 일정',
            date: '2026-11-20',
            startTime: '09:00',
            endTime: '10:00',
            location: '',
            type: 'meeting',
            attendees: [],
          },
        ])
      );

      const { result } = renderHook(() => useSchedules());
      expect(result.current.schedules).toBeDefined();
      expect(result.current.schedules[0]?.title).toBe('오프라인 일정');
      expect(typeof result.current.addSchedule).toBe('function');
    });
  });

  describe('4. P3-D: useWorkingMemory Re-entry Bug Fix & React Query Unification', () => {
    it('eliminates module-scoped latch: multiple mount/unmount cycles revalidate SSOT without latch lockup', async () => {
      const { Wrapper } = createTestWrapper();
      resetWorkingMemoryStoreForTest([
        {
          id: 'seed-memo-1',
          content: '초기 메모',
          category: 'general',
          source: 'pc',
          status: 'pending',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ]);

      // 1. First mount (Route A)
      const { result: r1, unmount: unmount1 } = renderHook(() => useWorkingMemory(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(r1.current.memos.some((m) => m.id === 'wm-server-1')).toBe(true);
      });
      const initialCalls = mockReadSheet.mock.calls.filter((c) => c[0] === 'WORKING_MEMORY').length;
      expect(initialCalls).toBeGreaterThanOrEqual(1);

      // Unmount simulating navigating away from route
      unmount1();

      // 2. Mock new server memo arriving while user was on another route
      mockReadSheet.mockImplementation(async (sheet: string) => {
        if (sheet === 'WORKING_MEMORY') {
          return [
            {
              id: 'wm-server-2',
              content: '새로 수신된 11/20 구정업무보고 메모',
              category: 'directive',
              source: 'mobile',
              status: 'pending',
              tags: ['[구정보고]'],
              numericHighlight: undefined,
              dateHighlight: '11. 20.',
              createdAt: '2026-11-10T00:00:00Z',
              updatedAt: '2026-11-10T00:00:00Z',
            },
          ];
        }
        return [];
      });

      // 3. Re-enter route (Route A remount)
      const { Wrapper: FreshWrapper, queryClient: freshClient } = createTestWrapper();
      const { result: r2 } = renderHook(() => useWorkingMemory(), {
        wrapper: FreshWrapper,
      });

      // Because the module-scoped `hasFetchedFromServer` latch is ELIMINATED,
      // route re-entry automatically fetches fresh data from SSOT!
      await waitFor(() => {
        expect(r2.current.memos.some((m) => m.id === 'wm-server-2')).toBe(true);
      });
      expect(r2.current.memos.find((m) => m.id === 'wm-server-2')?.content).toContain(
        '새로 수신된 11/20 구정업무보고 메모'
      );
    });

    it('invalidating [WORKING_MEMORY] cache immediately triggers SSOT refetch', async () => {
      const { Wrapper, queryClient } = createTestWrapper();
      resetWorkingMemoryStoreForTest();

      const { result } = renderHook(() => useWorkingMemory(), { wrapper: Wrapper });
      await waitFor(() => {
        expect(result.current.memos.some((m) => m.id === 'wm-server-1')).toBe(true);
      });

      // Update backend data
      mockReadSheet.mockImplementation(async (sheet: string) => {
        if (sheet === 'WORKING_MEMORY') {
          return [
            {
              id: 'wm-server-fresh',
              content: '즉시 갱신된 캐시 메모',
              category: 'budget',
              source: 'pc',
              status: 'pending',
              tags: ['[즉시갱신]'],
              createdAt: '2026-11-11T00:00:00Z',
              updatedAt: '2026-11-11T00:00:00Z',
            },
          ];
        }
        return [];
      });

      // Invalidate queries
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['WORKING_MEMORY'] });
      });

      await waitFor(() => {
        expect(result.current.memos.some((m) => m.id === 'wm-server-fresh')).toBe(true);
      });
    });

    it('safely operates without QueryClientProvider and preserves optimistic storage', () => {
      resetWorkingMemoryStoreForTest([
        {
          id: 'wm-offline-test',
          content: '오프라인 메모 테스트',
          category: 'general',
          source: 'pc',
          status: 'pending',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ]);

      const { result } = renderHook(() => useWorkingMemory({ autoFetch: false }));
      expect(result.current.memos).toBeDefined();
      expect(result.current.memos.some((m) => m.id === 'wm-offline-test')).toBe(true);
      expect(typeof result.current.addMemo).toBe('function');
      expect(typeof result.current.markReflected).toBe('function');
    });
  });
});
