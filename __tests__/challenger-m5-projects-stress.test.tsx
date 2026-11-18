import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProjects } from '@/hooks/useProjects';
import { useMeetings } from '@/hooks/useMeetings';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
import { Project, Meeting, Task, ChecklistItem } from '@/types';

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

describe('Empirical Challenger M5-1: Projects & Meetings Adversarial Stress Suite', () => {
  const mockReadSheet = readSheet as jest.Mock;
  const mockAddRow = addRow as jest.Mock;
  const mockUpdateRow = updateRow as jest.Mock;
  const mockDeleteRow = deleteRow as jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();

    mockAddRow.mockResolvedValue(true);
    mockUpdateRow.mockResolvedValue(true);
    mockDeleteRow.mockResolvedValue(true);
  });

  describe('DIMENSION 1: Cascade Task Deletion on deleteProject Stress Testing', () => {
    it('accurately identifies and deletes all matching tasks across high-volume mixed dataset', async () => {
      const targetProjectId = 'proj-target-cascade';
      const foreignProjectId = 'proj-other-unrelated';

      const mockProjects: Project[] = [
        {
          id: targetProjectId,
          name: '삭제 대상 대규모 프로젝트',
          description: '',
          color: '#ef4444',
          checklistItems: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: foreignProjectId,
          name: '보존되어야 하는 프로젝트',
          description: '',
          color: '#10b981',
          checklistItems: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      // Generate 25 tasks for targetProjectId, 25 tasks for foreignProjectId, and 10 orphan tasks (no projectId)
      const mockTasks: Task[] = [];
      for (let i = 0; i < 25; i++) {
        mockTasks.push({
          id: `task-target-${i}`,
          projectId: targetProjectId,
          title: `삭제 대상 작업 ${i}`,
          status: 'todo',
          priority: 'medium',
          category: '기안',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        });
      }
      for (let i = 0; i < 25; i++) {
        mockTasks.push({
          id: `task-foreign-${i}`,
          projectId: foreignProjectId,
          title: `보존 대상 작업 ${i}`,
          status: 'in-progress',
          priority: 'high',
          category: '행사',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        });
      }
      for (let i = 0; i < 10; i++) {
        mockTasks.push({
          id: `task-orphan-${i}`,
          projectId: undefined as any,
          title: `고아 작업 ${i}`,
          status: 'todo',
          priority: 'low',
          category: '일반',
          tags: [],
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        });
      }

      mockReadSheet.mockImplementation(async (sheet: string) => {
        if (sheet === 'PROJECTS') return mockProjects;
        if (sheet === 'TASKS') return mockTasks;
        return [];
      });

      const { Wrapper, queryClient } = createTestWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(2));

      // Trigger cascade deletion
      act(() => {
        result.current.deleteProject(targetProjectId);
      });

      // Verify target project is immediately removed optimistically
      await waitFor(() => {
        expect(result.current.projects).toHaveLength(1);
        expect(result.current.projects[0].id).toBe(foreignProjectId);
      });

      // Wait for cascade deletion to finish
      await waitFor(() => {
        // Exactly 25 deleteRow calls for target tasks
        for (let i = 0; i < 25; i++) {
          expect(mockDeleteRow).toHaveBeenCalledWith('TASKS', `task-target-${i}`);
        }
        // Invalidation of ['TASKS'] triggered
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['TASKS'] })
        );
      });

      // Assert none of foreign or orphan tasks were deleted
      for (let i = 0; i < 25; i++) {
        expect(mockDeleteRow).not.toHaveBeenCalledWith('TASKS', `task-foreign-${i}`);
      }
      for (let i = 0; i < 10; i++) {
        expect(mockDeleteRow).not.toHaveBeenCalledWith('TASKS', `task-orphan-${i}`);
      }
    });

    it('gracefully handles empty TASKS sheet during cascade deletion without unnecessary API calls or exceptions', async () => {
      mockReadSheet.mockImplementation(async (sheet: string) => {
        if (sheet === 'PROJECTS') {
          return [
            {
              id: 'proj-empty-tasks',
              name: '작업 없는 프로젝트',
              description: '',
              color: '#3b82f6',
              checklistItems: [],
              createdAt: '2026-11-01T00:00:00Z',
              updatedAt: '2026-11-01T00:00:00Z',
            },
          ];
        }
        if (sheet === 'TASKS') return [];
        return [];
      });

      const { Wrapper, queryClient } = createTestWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      act(() => {
        result.current.deleteProject('proj-empty-tasks');
      });

      await waitFor(() => {
        expect(result.current.projects).toHaveLength(0);
      });

      // Give microtasks time to execute cascade import
      await new Promise((r) => setTimeout(r, 50));

      // deleteRow should only have been called for PROJECTS, NOT TASKS
      expect(mockDeleteRow).toHaveBeenCalledWith('PROJECTS', 'proj-empty-tasks');
      expect(mockDeleteRow).not.toHaveBeenCalledWith('TASKS', expect.anything());
    });

    it('survives network/storage failure during TASKS sheet read without unhandled promise rejection', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockReadSheet.mockImplementation(async (sheet: string) => {
        if (sheet === 'PROJECTS') {
          return [
            {
              id: 'proj-error-tasks',
              name: '에러 테스트 프로젝트',
              description: '',
              color: '#3b82f6',
              checklistItems: [],
              createdAt: '2026-11-01T00:00:00Z',
              updatedAt: '2026-11-01T00:00:00Z',
            },
          ];
        }
        if (sheet === 'TASKS') {
          throw new Error('E-HOJO API 500: Database Connection Timeout');
        }
        return [];
      });

      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      // Trigger deletion - the internal promise catch block should intercept without throwing to test runner
      act(() => {
        result.current.deleteProject('proj-error-tasks');
      });

      await waitFor(() => {
        expect(result.current.projects).toHaveLength(0);
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to read TASKS for cascade delete:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('survives failure in individual task deleteRow without crashing caller', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockReadSheet.mockImplementation(async (sheet: string) => {
        if (sheet === 'PROJECTS') {
          return [{ id: 'proj-del-fail', name: 'P', checklistItems: [] }];
        }
        if (sheet === 'TASKS') {
          return [{ id: 'task-fail', projectId: 'proj-del-fail', title: 'T' }];
        }
        return [];
      });

      mockDeleteRow.mockImplementation(async (sheet: string, id: string) => {
        if (sheet === 'TASKS') {
          throw new Error('Lock acquisition failed on TASKS sheet');
        }
        return true;
      });

      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      act(() => {
        result.current.deleteProject('proj-del-fail');
      });

      await waitFor(() => {
        expect(result.current.projects).toHaveLength(0);
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Cascade delete tasks failed:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('DIMENSION 2: Checklist Operations & Progress Calculation Precision', () => {
    it('calculates progress accurately across all boundary conditions (empty, zero, fractional, 100%)', async () => {
      mockReadSheet.mockResolvedValue([
        {
          id: 'proj-empty-checklist',
          name: '빈 체크리스트',
          checklistItems: [],
        },
        {
          id: 'proj-zero-progress',
          name: '0% 진행 프로젝트',
          checklistItems: [
            { id: 'c1', text: '과제 1', completed: false },
            { id: 'c2', text: '과제 2', completed: false },
          ],
        },
        {
          id: 'proj-fractional-1-3',
          name: '1/3 진행 (33%)',
          checklistItems: [
            { id: 'c1', text: '과제 1', completed: true },
            { id: 'c2', text: '과제 2', completed: false },
            { id: 'c3', text: '과제 3', completed: false },
          ],
        },
        {
          id: 'proj-fractional-2-3',
          name: '2/3 진행 (67%)',
          checklistItems: [
            { id: 'c1', text: '과제 1', completed: true },
            { id: 'c2', text: '과제 2', completed: true },
            { id: 'c3', text: '과제 3', completed: false },
          ],
        },
        {
          id: 'proj-fractional-5-7',
          name: '5/7 진행 (71%)',
          checklistItems: [
            { id: 'c1', text: '1', completed: true },
            { id: 'c2', text: '2', completed: true },
            { id: 'c3', text: '3', completed: true },
            { id: 'c4', text: '4', completed: true },
            { id: 'c5', text: '5', completed: true },
            { id: 'c6', text: '6', completed: false },
            { id: 'c7', text: '7', completed: false },
          ],
        },
        {
          id: 'proj-100-percent',
          name: '100% 완료 프로젝트',
          checklistItems: [
            { id: 'c1', text: '과제 1', completed: true },
            { id: 'c2', text: '과제 2', completed: true },
          ],
        },
        {
          id: 'proj-missing-checklist-field',
          name: '체크리스트 필드 부재',
          // checklistItems is undefined
        },
      ]);

      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.projects).toHaveLength(7));

      // 1. Non-existent ID => 0
      expect(result.current.getProjectProgress('non-existent-id')).toBe(0);

      // 2. Missing checklistItems field => 0
      expect(result.current.getProjectProgress('proj-missing-checklist-field')).toBe(0);

      // 3. Empty checklistItems array => 0
      expect(result.current.getProjectProgress('proj-empty-checklist')).toBe(0);

      // 4. 0 / 2 => 0
      expect(result.current.getProjectProgress('proj-zero-progress')).toBe(0);

      // 5. 1 / 3 => 33
      expect(result.current.getProjectProgress('proj-fractional-1-3')).toBe(33);

      // 6. 2 / 3 => 67
      expect(result.current.getProjectProgress('proj-fractional-2-3')).toBe(67);

      // 7. 5 / 7 => Math.round((5/7)*100) = Math.round(71.428) = 71
      expect(result.current.getProjectProgress('proj-fractional-5-7')).toBe(71);

      // 8. 2 / 2 => 100
      expect(result.current.getProjectProgress('proj-100-percent')).toBe(100);
    });

    it('safely tolerates malformed checklist items (undefined or non-boolean completed values)', async () => {
      mockReadSheet.mockResolvedValue([
        {
          id: 'proj-malformed',
          name: '비정상 체크리스트 항목',
          checklistItems: [
            { id: 'c1', text: '완료 항목', completed: true },
            { id: 'c2', text: '미완료 항목', completed: false },
            { id: 'c3', text: 'null completed', completed: null as any },
            { id: 'c4', text: 'undefined completed', completed: undefined as any },
            { id: 'c5', text: 'string completed', completed: 'yes' as any }, // truthy string
          ],
        },
      ]);

      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      // In useProjects.ts line 253: `if (items[i].completed) completed++;`
      // c1: true (completed++)
      // c2: false
      // c3: null (falsy)
      // c4: undefined (falsy)
      // c5: 'yes' (truthy)
      // Total completed: 2, total items: 5 => Math.round((2/5)*100) = 40%
      expect(result.current.getProjectProgress('proj-malformed')).toBe(40);
    });

    it('handles adding items to non-existent project and deleting non-existent checklist items without crashing', async () => {
      mockReadSheet.mockResolvedValue([
        {
          id: 'proj-test',
          name: '테스트',
          checklistItems: [{ id: 'c1', text: '기존 항목', completed: false }],
        },
      ]);

      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      // Add to non-existent project: returns generated item, no mutation triggered
      let addedItem: ChecklistItem | null = null;
      act(() => {
        addedItem = result.current.addChecklistItem('proj-ghost', '유령 과제');
      });
      expect(addedItem).not.toBeNull();
      expect(addedItem!.text).toBe('유령 과제');
      expect(result.current.getProjectById('proj-ghost')).toBeUndefined();

      // Delete non-existent item from existing project: items remain intact
      act(() => {
        result.current.deleteChecklistItem('proj-test', 'ghost-item-id');
      });
      await waitFor(() => {
        expect(result.current.getProjectById('proj-test')?.checklistItems).toHaveLength(1);
      });

      // Toggle non-existent item from existing project: items remain intact
      act(() => {
        result.current.toggleChecklistItem('proj-test', 'ghost-item-id');
      });
      await waitFor(() => {
        expect(result.current.getProjectById('proj-test')?.checklistItems?.[0].completed).toBe(false);
      });
    });

    it('orchestrates complete multi-step checklist lifecycle with continuous progress recalculation', async () => {
      mockReadSheet.mockResolvedValue([
        {
          id: 'proj-lifecycle',
          name: '공공행사 추진계획',
          checklistItems: [],
        },
      ]);

      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      // Step 1: Initial progress is 0%
      expect(result.current.getProjectProgress('proj-lifecycle')).toBe(0);

      // Step 2: Add item 1
      let item1: ChecklistItem;
      act(() => {
        item1 = result.current.addChecklistItem('proj-lifecycle', '기본계획 수립');
      });
      await waitFor(() => {
        expect(result.current.getProjectById('proj-lifecycle')?.checklistItems).toHaveLength(1);
      });
      // 0/1 = 0%
      expect(result.current.getProjectProgress('proj-lifecycle')).toBe(0);

      // Step 3: Complete item 1
      act(() => {
        result.current.toggleChecklistItem('proj-lifecycle', item1.id);
      });
      await waitFor(() => {
        expect(result.current.getProjectById('proj-lifecycle')?.checklistItems?.[0].completed).toBe(true);
      });
      // 1/1 = 100%
      expect(result.current.getProjectProgress('proj-lifecycle')).toBe(100);

      // Step 4: Add item 2
      let item2: ChecklistItem;
      act(() => {
        item2 = result.current.addChecklistItem('proj-lifecycle', '예산 부서 협의');
      });
      await waitFor(() => {
        expect(result.current.getProjectById('proj-lifecycle')?.checklistItems).toHaveLength(2);
      });
      // 1/2 = 50%
      expect(result.current.getProjectProgress('proj-lifecycle')).toBe(50);

      // Step 5: Toggle item 1 back to incomplete
      act(() => {
        result.current.toggleChecklistItem('proj-lifecycle', item1.id);
      });
      await waitFor(() => {
        expect(result.current.getProjectById('proj-lifecycle')?.checklistItems?.[0].completed).toBe(false);
      });
      // 0/2 = 0%
      expect(result.current.getProjectProgress('proj-lifecycle')).toBe(0);

      // Step 6: Delete item 2
      act(() => {
        result.current.deleteChecklistItem('proj-lifecycle', item2.id);
      });
      await waitFor(() => {
        expect(result.current.getProjectById('proj-lifecycle')?.checklistItems).toHaveLength(1);
      });
      // 0/1 = 0%
      expect(result.current.getProjectProgress('proj-lifecycle')).toBe(0);

      // Step 7: Complete remaining item 1
      act(() => {
        result.current.toggleChecklistItem('proj-lifecycle', item1.id);
      });
      await waitFor(() => {
        expect(result.current.getProjectById('proj-lifecycle')?.checklistItems?.[0].completed).toBe(true);
      });
      // 1/1 = 100%
      expect(result.current.getProjectProgress('proj-lifecycle')).toBe(100);
    });
  });

  describe('DIMENSION 3: Fallback Execution Without QueryClientProvider', () => {
    it('executes useProjects with all CRUD methods outside QueryClientProvider without throwing', () => {
      localStorage.setItem(
        'hchps-projects',
        JSON.stringify([
          {
            id: 'proj-offline-harness',
            name: '오프라인 보존 프로젝트',
            description: '로컬 스토리지 데이터',
            color: '#4f46e5',
            checklistItems: [{ id: 'chk-1', text: '오프라인 점검', completed: true }],
            createdAt: '2026-11-01T00:00:00Z',
            updatedAt: '2026-11-01T00:00:00Z',
          },
        ])
      );

      // Render hook with NO QueryClientProvider wrapper at all
      const { result } = renderHook(() => useProjects());

      // 1. Initial data hydrated from localStorage
      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0].name).toBe('오프라인 보존 프로젝트');

      // 2. Lookups and calculations function cleanly
      expect(result.current.getProjectById('proj-offline-harness')?.id).toBe('proj-offline-harness');
      expect(result.current.getProjectProgress('proj-offline-harness')).toBe(100);

      // 3. Mutative methods do not throw unhandled context errors
      expect(() => {
        act(() => {
          result.current.addProject({
            name: '신규 오프라인 프로젝트',
            description: '',
            color: '#10b981',
          });
        });
      }).not.toThrow();

      expect(() => {
        act(() => {
          result.current.updateProject('proj-offline-harness', { description: '설명 업데이트' });
        });
      }).not.toThrow();

      expect(() => {
        act(() => {
          result.current.addChecklistItem('proj-offline-harness', '추가 항목');
        });
      }).not.toThrow();

      expect(() => {
        act(() => {
          result.current.deleteProject('proj-offline-harness');
        });
      }).not.toThrow();
    });

    it('executes useMeetings with all query and filter methods outside QueryClientProvider without throwing', () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      localStorage.setItem(
        'hchps-meetings',
        JSON.stringify([
          {
            id: 'meet-offline-today',
            title: '오늘의 대책 회의',
            datetime: `${todayIso}T14:00:00Z`,
            agenda: '보조금 집행',
            notes: '',
            attendees: ['담당자'],
            createdAt: '2026-11-01T00:00:00Z',
            updatedAt: '2026-11-01T00:00:00Z',
          },
          {
            id: 'meet-offline-future',
            title: '미래 전략 회의',
            datetime: '2029-01-01T10:00:00Z',
            agenda: '중장기 계획',
            notes: '',
            attendees: [],
            createdAt: '2026-11-01T00:00:00Z',
            updatedAt: '2026-11-01T00:00:00Z',
          },
        ])
      );

      // Render hook with NO QueryClientProvider wrapper at all
      const { result } = renderHook(() => useMeetings());

      // 1. Initial data hydrated from localStorage
      expect(result.current.meetings).toHaveLength(2);

      // 2. Filters execute without crash
      const todayMeetings = result.current.getTodayMeetings();
      expect(todayMeetings.some((m) => m.id === 'meet-offline-today')).toBe(true);

      const upcomingMeetings = result.current.getUpcomingMeetings();
      expect(upcomingMeetings.some((m) => m.id === 'meet-offline-future')).toBe(true);

      expect(result.current.getMeetingById('meet-offline-today')?.agenda).toBe('보조금 집행');

      // 3. Mutative methods do not throw
      expect(() => {
        act(() => {
          result.current.addMeeting({
            title: '추가 오프라인 회의',
            datetime: '2029-05-01T09:00:00Z',
            agenda: '',
            notes: '',
            attendees: [],
          });
        });
      }).not.toThrow();

      expect(() => {
        act(() => {
          result.current.updateMeeting('meet-offline-today', { notes: '특이사항 기록' });
        });
      }).not.toThrow();

      expect(() => {
        act(() => {
          result.current.deleteMeeting('meet-offline-today');
        });
      }).not.toThrow();
    });
  });

  describe('DIMENSION 4: Optimistic Rollback and Meeting Chronological Stress Testing', () => {
    it('rolls back optimistic project state and localStorage when addProject mutation fails', async () => {
      mockReadSheet.mockResolvedValue([
        {
          id: 'proj-stable',
          name: '안정 프로젝트',
          checklistItems: [],
        },
      ]);
      mockAddRow.mockRejectedValue(new Error('Network disconnected'));

      const { Wrapper, queryClient } = createTestWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      // Attempt to add project that fails on server
      act(() => {
        result.current.addProject({
          name: '실패할 프로젝트',
          description: '',
          color: '#000000',
        });
      });

      // Verify that after error resolution, state is rolled back to original 1 item
      await waitFor(() => {
        const cached = queryClient.getQueryData<Project[]>(['PROJECTS']);
        expect(cached?.some((p) => p.name === '실패할 프로젝트')).toBe(false);
        expect(result.current.projects.some((p) => p.name === '실패할 프로젝트')).toBe(false);
      });
    });

    it('rolls back optimistic meeting state and localStorage when updateMeeting mutation fails', async () => {
      mockReadSheet.mockResolvedValue([
        {
          id: 'meet-original',
          title: '원래 제목',
          datetime: '2026-12-01T10:00:00Z',
          agenda: '기존 안건',
          notes: '',
          attendees: [],
        },
      ]);
      mockUpdateRow.mockRejectedValue(new Error('Concurrency conflict on sheet'));

      const { Wrapper, queryClient } = createTestWrapper();
      const { result } = renderHook(() => useMeetings(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.meetings).toHaveLength(1));

      act(() => {
        result.current.updateMeeting('meet-original', { title: '변조된 제목' });
      });

      // Rollback restores original title
      await waitFor(() => {
        const cached = queryClient.getQueryData<Meeting[]>(['MEETINGS']);
        expect(cached?.[0].title).toBe('원래 제목');
        expect(result.current.getMeetingById('meet-original')?.title).toBe('원래 제목');
      });
    });

    it('robustly sorts upcoming meetings chronologically and filters out invalid dates', async () => {
      const farFuture = '2030-01-01T10:00:00Z';
      const nearFuture = '2028-06-01T10:00:00Z';
      const veryNearFuture = '2027-01-01T10:00:00Z';
      const pastDate = '2020-01-01T10:00:00Z';

      mockReadSheet.mockResolvedValue([
        { id: 'm-far', title: '먼 미래', datetime: farFuture, attendees: [] },
        { id: 'm-past', title: '과거 회의', datetime: pastDate, attendees: [] },
        { id: 'm-near', title: '가까운 미래', datetime: nearFuture, attendees: [] },
        { id: 'm-very-near', title: '매우 가까운 미래', datetime: veryNearFuture, attendees: [] },
        { id: 'm-invalid', title: '잘못된 날짜', datetime: 'invalid-iso-string', attendees: [] },
        { id: 'm-empty-date', title: '날짜 부재', datetime: '', attendees: [] },
      ]);

      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useMeetings(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.meetings).toHaveLength(6));

      // 1. Upcoming should only include future dates, sorted ascending
      const upcoming = result.current.getUpcomingMeetings(10);
      expect(upcoming).toHaveLength(3);
      expect(upcoming[0].id).toBe('m-very-near');
      expect(upcoming[1].id).toBe('m-near');
      expect(upcoming[2].id).toBe('m-far');

      // 2. Limit parameter respected
      const limited = result.current.getUpcomingMeetings(2);
      expect(limited).toHaveLength(2);
      expect(limited[0].id).toBe('m-very-near');
      expect(limited[1].id).toBe('m-near');

      // 3. Limit 0 returns empty array
      const zeroLimit = result.current.getUpcomingMeetings(0);
      expect(zeroLimit).toEqual([]);
    });
  });
});
