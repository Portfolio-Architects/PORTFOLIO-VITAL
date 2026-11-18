import { TextEncoder, TextDecoder } from 'util';

// Polyfill standard fetch and encoding globals in JSDOM environment before any imports
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
  global.TextDecoder = TextDecoder as any;
}
if (typeof global.Request === 'undefined') {
  global.Request = globalThis.Request;
}
if (typeof global.Response === 'undefined') {
  global.Response = globalThis.Response;
}
if (typeof global.Headers === 'undefined') {
  global.Headers = globalThis.Headers;
}

import '@testing-library/jest-dom';
import { renderHook, render, act, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { useMergedSignals } from '@/__tests__/fixtures/useMergedSignals';
import { SignalEntry } from '@/hooks/useSignal';
import { Task, Project, Meeting, BudgetEntry, InventoryItem } from '@/types';

// Mocks for hooks used in ProtectedApp
jest.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [
      { id: 't1', title: '강남구 건강검진', description: '지역 보건검진', status: 'todo', priority: 'high', category: '보건', tags: ['보건', '검진'], createdAt: '2026-07-20T10:00:00Z', updatedAt: '2026-07-20T10:00:00Z' },
    ],
    updateTask: jest.fn(),
    stats: { total: 1, pending: 1, completed: 0, highPriority: 1 },
  }),
}));

jest.mock('@/hooks/useBudget', () => ({
  useBudget: () => ({
    categories: [{ id: 'c1', name: '사업비', totalBudget: 1000000 }],
    entries: [{ id: 'b1', categoryId: 'c1', amount: 50000, date: '2026-07-19T10:00:00Z', purpose: '검진 시약 구매', memo: '시약', isPlanned: false }],
    addCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    replaceCategories: jest.fn(),
    addEntry: jest.fn(),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
    getCategoryStats: jest.fn(),
    overallStatsActual: { totalBudget: 1000000, totalSpent: 50000, percentage: 5 },
  }),
}));

jest.mock('@/hooks/useInventory', () => ({
  useInventory: () => ({
    items: [{ id: 'i1', name: '리플렛', category: '홍보물', currentStock: 100, unit: '부', budgetEntryIds: [], createdAt: '2026-07-18T10:00:00Z', updatedAt: '2026-07-18T10:00:00Z' }],
    addItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
    adjustStock: jest.fn(),
    getItemHistory: jest.fn(),
  }),
}));

jest.mock('@/hooks/useMeetings', () => ({
  useMeetings: () => ({
    meetings: [{ id: 'm1', title: '보건소 회의', agenda: '검진 사업 논의', notes: '세부 계획수립', attendees: ['김주무관', '이주무관'], datetime: '2026-07-17T10:00:00Z', createdAt: '2026-07-17T10:00:00Z', updatedAt: '2026-07-17T10:00:00Z' }],
  }),
}));

jest.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: [{ id: 'p1', name: '보건인프라구축', description: '강남구 인프라', color: '#3b82f6', checklistItems: [{ id: 'ck1', text: '장비점검', completed: false }], createdAt: '2026-07-16T10:00:00Z', updatedAt: '2026-07-16T10:00:00Z' }],
  }),
}));

jest.mock('@/hooks/useSignal', () => ({
  useSignal: () => ({
    entries: [{ id: 's1', text: 'AI 스마트 헬스케어 도입', keywords: ['헬스케어', '스마트'], createdAt: '2026-07-21T09:00:00Z', category: '내 생각', tags: [] }],
    addSignal: jest.fn(),
    deleteSignal: jest.fn(),
    updateSignalKeywords: jest.fn(),
    keywordMap: { '헬스케어': 1, '스마트': 1 },
  }),
  extractKeywords: (text: string) => {
    if (!text) return [];
    return text.split(/\s+/).filter(w => w.length >= 2);
  },
}));

jest.mock('@/lib/sheets-api', () => ({
  syncTombstones: jest.fn().mockResolvedValue(true),
  readSheet: jest.fn().mockResolvedValue([]),
  addRow: jest.fn().mockResolvedValue(true),
  deleteRow: jest.fn().mockResolvedValue(true),
  updateRow: jest.fn().mockResolvedValue(true),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('next/dynamic', () => (func: any) => {
  const str = func.toString();
  if (str.includes('PortfolioDashboardView')) {
    return function MockDash() { return <div data-testid="dashboard-component">Dashboard View</div>; };
  }
  if (str.includes('ArchiveExplorerView')) {
    return function MockArch() { return <div data-testid="archive-component">Archive View</div>; };
  }
  if (str.includes('WorkingMemoryPage')) {
    return function MockMem() { return <div data-testid="memory-component">Memory View</div>; };
  }
  if (str.includes('WorkspaceView')) {
    return function MockWS() { return <div data-testid="workspace-component">Workspace View</div>; };
  }
  if (str.includes('ProjectManagementPage')) {
    return function MockProj() { return <div data-testid="project-component">Project View</div>; };
  }
  return function MockGeneric() { return <div data-testid="generic-dynamic" />; };
});

jest.mock('@/components/Sidebar', () => ({
  Sidebar: ({ activeModule, onModuleChange }: any) => (
    <nav data-testid="sidebar">
      <button onClick={() => onModuleChange('dashboard')}>Nav Dashboard</button>
      <button onClick={() => onModuleChange('memory')}>Nav Memory</button>
      <button onClick={() => onModuleChange('workspace')}>Nav Workspace</button>
      <button onClick={() => onModuleChange('archive')}>Nav Archive</button>
      <button onClick={() => onModuleChange('project')}>Nav Project</button>
      <span data-testid="active-nav">{activeModule}</span>
    </nav>
  ),
}));

jest.mock('@/components/AppLogModal', () => ({
  AppLogModal: () => null,
}));

describe('Empirical Challenge: useMergedSignals & ProtectedApp Tab Switching', () => {

  describe('1. useMergedSignals Hook Dynamic Enabled Toggling', () => {
    const mockSignalEntries: SignalEntry[] = [
      { id: 's1', text: '생각 노트', keywords: ['노트'], createdAt: '2026-07-21T09:00:00Z', category: '생각' }
    ];
    const mockKeywordMap: Record<string, number> = { '노트': 1 };
    const mockTasks: Task[] = [
      { id: 't1', title: '원기백세 건강사업', description: '어르신 건강증진', status: 'todo', priority: 'high', category: '건강', tags: ['건강', '어르신'], createdAt: '2026-07-20T10:00:00Z', updatedAt: '2026-07-20T10:00:00Z' }
    ];
    const mockProjects: Project[] = [
      { id: 'p1', name: '스마트경로당', description: '경로당 시스템', color: '#10b981', checklistItems: [{ id: 'c1', text: '설치검토', completed: false }], createdAt: '2026-07-19T10:00:00Z', updatedAt: '2026-07-19T10:00:00Z' }
    ];
    const mockMeetings: Meeting[] = [
      { id: 'm1', title: '사업간담회', agenda: '주민의견수렴', notes: '의견 정리', attendees: ['박주무관'], datetime: '2026-07-18T10:00:00Z', createdAt: '2026-07-18T10:00:00Z', updatedAt: '2026-07-18T10:00:00Z' }
    ];
    const mockBudget: BudgetEntry[] = [
      { id: 'b1', categoryId: 'c1', amount: 120000, date: '2026-07-17T10:00:00Z', purpose: '홍보물 제작', memo: '현수막', isPlanned: false }
    ];
    const mockInventory: InventoryItem[] = [
      { id: 'i1', name: '건강책자', category: '홍보물', currentStock: 50, unit: '권', budgetEntryIds: [], createdAt: '2026-07-16T10:00:00Z', updatedAt: '2026-07-16T10:00:00Z' }
    ];

    it('should compute signals correctly when enabled is true', () => {
      const { result } = renderHook(
        ({ enabled }) => useMergedSignals(
          mockSignalEntries, mockKeywordMap, mockTasks, mockProjects, mockMeetings, mockBudget, mockInventory, enabled
        ),
        { initialProps: { enabled: true } }
      );

      expect(Object.keys(result.current.mergedKeywordMap).length).toBeGreaterThan(0);
      expect(result.current.mergedEntries.length).toBe(6); // 1 signal + 1 task + 1 project + 1 meeting + 1 budget + 1 inventory
      
      // Verify sorting descending by createdAt
      const times = result.current.mergedEntries.map(e => new Date(e.createdAt).getTime());
      for (let i = 0; i < times.length - 1; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i + 1]);
      }
    });

    it('should return empty references when enabled is false', () => {
      const { result } = renderHook(
        ({ enabled }) => useMergedSignals(
          mockSignalEntries, mockKeywordMap, mockTasks, mockProjects, mockMeetings, mockBudget, mockInventory, enabled
        ),
        { initialProps: { enabled: false } }
      );

      expect(result.current.mergedKeywordMap).toEqual({});
      expect(result.current.mergedEntries).toEqual([]);
      expect(result.current.mergedEntries.length).toBe(0);
    });

    it('should dynamically switch between true and false without breaking or leaking state', () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useMergedSignals(
          mockSignalEntries, mockKeywordMap, mockTasks, mockProjects, mockMeetings, mockBudget, mockInventory, enabled
        ),
        { initialProps: { enabled: true } }
      );

      const computedEntries1 = result.current.mergedEntries;
      expect(computedEntries1.length).toBe(6);

      // Disable dynamically
      rerender({ enabled: false });
      expect(result.current.mergedEntries).toEqual([]);
      expect(result.current.mergedKeywordMap).toEqual({});

      // Enable again dynamically
      rerender({ enabled: true });
      expect(result.current.mergedEntries.length).toBe(6);

      // Disable again dynamically
      rerender({ enabled: false });
      expect(result.current.mergedEntries).toEqual([]);
    });

    it('should react immediately when data changes while enabled is true', () => {
      let currentTasks = mockTasks;
      const { result, rerender } = renderHook(
        ({ enabled, tasks }) => useMergedSignals(
          mockSignalEntries, mockKeywordMap, tasks, mockProjects, mockMeetings, mockBudget, mockInventory, enabled
        ),
        { initialProps: { enabled: true, tasks: currentTasks } }
      );

      expect(result.current.mergedEntries.length).toBe(6);

      // Add a new task while enabled
      const updatedTasks: Task[] = [
        ...mockTasks,
        { id: 't2', title: '추가 검진 업무', description: '추가 검진', status: 'todo', priority: 'medium', category: '보건', createdAt: '2026-07-21T11:00:00Z', updatedAt: '2026-07-21T11:00:00Z', tags: ['검진'] }
      ];

      rerender({ enabled: true, tasks: updatedTasks });
      expect(result.current.mergedEntries.length).toBe(7);
      expect(result.current.mergedEntries[0].id).toBe('task-t2'); // newest entry
    });

    it('should NOT recompute while enabled is false, but update when re-enabled', () => {
      let currentTasks = mockTasks;
      const { result, rerender } = renderHook(
        ({ enabled, tasks }) => useMergedSignals(
          mockSignalEntries, mockKeywordMap, tasks, mockProjects, mockMeetings, mockBudget, mockInventory, enabled
        ),
        { initialProps: { enabled: false, tasks: currentTasks } }
      );

      expect(result.current.mergedEntries).toEqual([]);

      // Update tasks while disabled
      const updatedTasks: Task[] = [
        ...mockTasks,
        { id: 't2', title: '추가 업무', status: 'todo', priority: 'low', category: '일반', createdAt: '2026-07-21T12:00:00Z', updatedAt: '2026-07-21T12:00:00Z', tags: [] }
      ];

      rerender({ enabled: false, tasks: updatedTasks });
      // Still returns empty array
      expect(result.current.mergedEntries).toEqual([]);

      // Now enable
      rerender({ enabled: true, tasks: updatedTasks });
      expect(result.current.mergedEntries.length).toBe(7);
    });
  });

  describe('2. ProtectedApp Tab Switching & State Isolation Stress Test', () => {
    // Import page component dynamically for testing
    let Page: any;

    beforeAll(async () => {
      jest.spyOn(React, 'useSyncExternalStore').mockImplementation((_sub: any, getClientSnapshot: any) => getClientSnapshot());
      const pageModule = await import('@/app/page');
      Page = pageModule.default;
    });

    const renderPage = () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      return render(
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      );
    };

    it('should render initial dashboard view and switch tabs cleanly without exceptions', async () => {
      renderPage();
      
      // Wait for client mount and initial dashboard view
      await waitFor(() => expect(screen.getByTestId('dashboard-component')).toBeInTheDocument());
      expect(screen.getByTestId('active-nav')).toHaveTextContent('dashboard');

      // Click Nav Memory
      fireEvent.click(screen.getByText('Nav Memory'));
      expect(screen.getByTestId('memory-component')).toBeInTheDocument();
      expect(screen.getByTestId('active-nav')).toHaveTextContent('memory');

      // Click Nav Workspace
      fireEvent.click(screen.getByText('Nav Workspace'));
      expect(screen.getByTestId('workspace-component')).toBeInTheDocument();
      expect(screen.getByTestId('active-nav')).toHaveTextContent('workspace');

      // Click Nav Archive
      fireEvent.click(screen.getByText('Nav Archive'));
      expect(screen.getByTestId('archive-component')).toBeInTheDocument();
      expect(screen.getByTestId('active-nav')).toHaveTextContent('archive');

      // Click Nav Project
      fireEvent.click(screen.getByText('Nav Project'));
      expect(screen.getByTestId('project-component')).toBeInTheDocument();
      expect(screen.getByTestId('active-nav')).toHaveTextContent('project');
    });

    it('should handle rapid stress switching between all tabs without dropping state or throwing errors', async () => {
      renderPage();

      await waitFor(() => expect(screen.getByText('Nav Dashboard')).toBeInTheDocument());

      const navDashboard = screen.getByText('Nav Dashboard');
      const navMemory = screen.getByText('Nav Memory');
      const navWorkspace = screen.getByText('Nav Workspace');
      const navArchive = screen.getByText('Nav Archive');
      const navProject = screen.getByText('Nav Project');

      const tabs = [navDashboard, navMemory, navWorkspace, navArchive, navProject];

      // Perform 40 rapid tab switches
      act(() => {
        for (let i = 0; i < 40; i++) {
          const targetTab = tabs[i % tabs.length];
          fireEvent.click(targetTab);
        }
        fireEvent.click(navDashboard);
      });

      // Verify final tab state is stable
      expect(screen.getByTestId('active-nav')).toHaveTextContent('dashboard');
      expect(screen.getByTestId('dashboard-component')).toBeInTheDocument();
      expect(screen.getByTestId('memory-component')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-component')).toBeInTheDocument();
      expect(screen.getByTestId('archive-component')).toBeInTheDocument();
      expect(screen.getByTestId('project-component')).toBeInTheDocument();
    });
  });
});
