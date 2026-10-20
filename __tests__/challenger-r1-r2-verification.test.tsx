import { renderHook, act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTasks } from '@/hooks/useTasks';
import { useBudget } from '@/hooks/useBudget';
import { useInventory } from '@/hooks/useInventory';
import { useContacts } from '@/hooks/useContacts';
import { useMeetings } from '@/hooks/useMeetings';
import { useProjects } from '@/hooks/useProjects';
import { readSheet } from '@/lib/sheets-api';
import { useLocalhostHealth } from '@/hooks/useLocalhostHealth';
import { LocalhostStatusHUD } from '@/components/layout/LocalhostStatusHUD';

jest.mock('@/lib/crypto', () => ({
  isCryptoReady: jest.fn(() => true),
  initCryptoContext: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/sheets-api', () => ({
  readSheet: jest.fn().mockImplementation((sheetName: string) => {
    if (sheetName === 'TASKS') return Promise.resolve([{ id: 'task-1', title: 'Task 1', status: 'todo', priority: 'medium', category: 'General', tags: [] }]);
    if (sheetName === 'BUDGET_CATEGORIES') return Promise.resolve([{ id: 'cat-1', name: 'Cat 1', totalBudget: 100000, policyProject: 'Policy', unitProject: 'Unit', detailedProject: 'Detail', statItem: 'Stat' }]);
    if (sheetName === 'BUDGET_ENTRIES') return Promise.resolve([{ id: 'entry-1', categoryId: 'cat-1', amount: 50000, title: 'Entry 1' }]);
    if (sheetName === 'INVENTORY') return Promise.resolve([{ id: 'inv-1', name: 'Item 1', currentStock: 10, targetStock: 20, minStock: 5, category: 'General', unit: 'ea', unitPrice: 1000, isLentOut: false }]);
    if (sheetName === 'STOCK_CHANGES') return Promise.resolve([{ id: 'sc-1', itemId: 'inv-1', change: 5, reason: 'Restock', date: new Date().toISOString() }]);
    if (sheetName === 'CONTACTS') return Promise.resolve([{ id: 'contact-1', name: 'Contact 1', phone: '010-1234-5678', email: 'test@example.com', notes: '' }]);
    if (sheetName === 'MEETINGS') return Promise.resolve([{ id: 'meet-1', title: 'Meeting 1', agenda: 'Agenda', notes: 'Notes', attendees: ['A'], datetime: '2026-10-19T10:00:00Z' }]);
    if (sheetName === 'PROJECTS') return Promise.resolve([{ id: 'proj-1', name: 'Project 1', description: 'Desc', color: '#3b82f6', checklistItems: [] }]);
    return Promise.resolve([]);
  }),
  addRow: jest.fn().mockImplementation((sheetName, data) => Promise.resolve(data)),
  updateRow: jest.fn().mockImplementation((sheetName, id, updates) => Promise.resolve({ id, ...updates })),
  deleteRow: jest.fn().mockImplementation((sheetName, id) => Promise.resolve({ success: true, id })),
  replaceAll: jest.fn().mockImplementation((sheetName, data) => Promise.resolve(data)),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('R1 & R2 Empirical Challenger Verification Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. R1: LOCAL DATA HYDRATION & OPTIMISTIC UPDATES VERIFICATION
  // =========================================================================
  describe('1. R1: React Query Local Hydration & Optimistic Updates', () => {
    it('useTasks safely initializes with empty array for SSR and loads query data', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });

      expect(result.current.tasks).toEqual([]);
      await waitFor(() => expect(result.current.tasks.length).toBeGreaterThan(0));
    });

    it('useTasks performs optimistic updates and triggers zero redundant invalidateQueries onSettled', async () => {
      const { queryClient, Wrapper } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });

      // Wait for initial query fetch to settle
      await waitFor(() => expect(result.current.tasks.length).toBeGreaterThan(0));

      // Perform optimistic task add and await async onMutate (cancelQueries microtask)
      await act(async () => {
        result.current.addTask({ title: 'New Task', status: 'todo', priority: 'medium', category: 'General', tags: [] });
      });

      // Optimistic update must reflect in query cache
      await waitFor(() => {
        const tasksInCache = queryClient.getQueryData<any[]>(['TASKS']);
        expect(tasksInCache).toBeDefined();
        expect(tasksInCache?.some(t => t.title === 'New Task')).toBe(true);
      });

      // Verify no invalidateQueries was executed in onSettled
      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('useBudget safely initializes with empty array for SSR and loads query data', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useBudget(), { wrapper: Wrapper });

      expect(result.current.categories).toEqual([]);
      expect(result.current.entries).toEqual([]);
      await waitFor(() => expect(result.current.categories.length).toBeGreaterThan(0));
    });

    it('useBudget performs optimistic updates without triggering invalidateQueries', async () => {
      const { queryClient, Wrapper } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useBudget(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.categories.length).toBeGreaterThan(0));

      await act(async () => {
        result.current.addCategory({ name: 'Optimistic Cat', totalBudget: 300000, color: '#3b82f6', policyProject: 'P2', unitProject: 'U2', detailedProject: 'D2', statItem: 'S2' });
      });

      await waitFor(() => {
        const catsInCache = queryClient.getQueryData<any[]>(['BUDGET_CATEGORIES']);
        expect(catsInCache?.some(c => c.name === 'Optimistic Cat')).toBe(true);
      });
      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('useInventory loads initialData safely for SSR and optimistic updates work', async () => {
      const { queryClient, Wrapper } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useInventory(), { wrapper: Wrapper });

      expect(result.current.items).toEqual([]);

      await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));

      await act(async () => {
        result.current.addItem({ name: 'New Item', category: 'Supplies', currentStock: 5, unit: 'ea', budgetEntryIds: [] });
      });

      await waitFor(() => {
        const itemsInCache = queryClient.getQueryData<any[]>(['INVENTORY']);
        expect(itemsInCache?.some(i => i.name === 'New Item')).toBe(true);
      });
      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('useContacts loads initialData safely for SSR and optimistic updates work', async () => {
      const { queryClient, Wrapper } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useContacts(), { wrapper: Wrapper });

      expect(result.current.contacts).toEqual([]);

      await waitFor(() => expect(result.current.contacts.length).toBeGreaterThan(0));

      await act(async () => {
        result.current.addContact({ name: 'New Contact', phone: '010-0000-1111', email: '', notes: '' });
      });

      await waitFor(() => {
        const contactsInCache = queryClient.getQueryData<any[]>(['CONTACTS']);
        expect(contactsInCache?.some(c => c.name === 'New Contact')).toBe(true);
      });
      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('Option A: defers TASKS, MEETINGS, PROJECTS, INVENTORY on initial dashboard (only 2 budget requests) and fetches once when enabled', async () => {
      localStorage.setItem('hchps-meetings', JSON.stringify([{ id: 'cached-m', title: 'Cached Meeting', agenda: '', notes: '', attendees: [], datetime: '2026-10-18T09:00:00Z' }]));
      const { Wrapper } = createWrapper();
      const readSheetMock = readSheet as jest.Mock;
      readSheetMock.mockClear();

      const { result, rerender } = renderHook(
        ({ deferredEnabled }) => {
          const budget = useBudget();
          const tasks = useTasks({ enabled: deferredEnabled });
          const inventory = useInventory({ enabled: deferredEnabled });
          const meetings = useMeetings({ enabled: deferredEnabled });
          const projects = useProjects({ enabled: deferredEnabled });
          const contacts = useContacts({ enabled: deferredEnabled });
          return { budget, tasks, inventory, meetings, projects, contacts };
        },
        { wrapper: Wrapper, initialProps: { deferredEnabled: false } }
      );

      await waitFor(() => expect(result.current.budget.categories.length).toBeGreaterThan(0));
      await waitFor(() => expect(result.current.budget.entries.length).toBeGreaterThan(0));

      // Initial Dashboard load: only 2 /api/data requests (BUDGET_CATEGORIES, BUDGET_ENTRIES)
      const initialSheetsRequested = readSheetMock.mock.calls.map(c => c[0]);
      expect(initialSheetsRequested).toEqual(expect.arrayContaining(['BUDGET_CATEGORIES', 'BUDGET_ENTRIES']));
      expect(initialSheetsRequested).toHaveLength(2);
      expect(result.current.meetings.meetings[0]?.id).toBe('cached-m');

      // Enable deferred hooks (simulating tab switch or Ctrl+K)
      rerender({ deferredEnabled: true });

      await waitFor(() => {
        expect(result.current.tasks.tasks.length).toBeGreaterThan(0);
        expect(result.current.inventory.items.length).toBeGreaterThan(0);
        expect(result.current.meetings.meetings[0]?.id).toBe('meet-1');
        expect(result.current.projects.projects.length).toBeGreaterThan(0);
        expect(result.current.contacts.contacts.length).toBeGreaterThan(0);
      });

      const callsBeforeCryptoEvent = readSheetMock.mock.calls.filter(c => c[0] === 'MEETINGS' || c[0] === 'PROJECTS').length;
      expect(callsBeforeCryptoEvent).toBe(2);

      // Dispatching crypto-ready after initial load must NOT trigger duplicate readSheet calls
      await act(async () => {
        window.dispatchEvent(new Event('crypto-ready'));
      });

      const callsAfterCryptoEvent = readSheetMock.mock.calls.filter(c => c[0] === 'MEETINGS' || c[0] === 'PROJECTS').length;
      expect(callsAfterCryptoEvent).toBe(2);
    });
  });

  // =========================================================================
  // 2. R2: LOCALHOST STATUS HUD & HEALTH PROBING VERIFICATION
  // =========================================================================
  describe('2. R2: Localhost Status HUD & Health Probing', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockImplementation((url) => {
        if (url === '/api/app-logs') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              daemonActive: true,
              watchDir: 'd:/Desktop',
              serverHeapMB: 128,
              backupStats: { son: 15, father: 7, grandfather: 4, total: 26 },
              data: [{ timestamp: '10:00:00', level: 'info', message: 'Daemon active' }],
            }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      }) as jest.Mock;
    });

    it('useLocalhostHealth probes Port 3001, Heap MB, Auto-Backups, File Watcher, and Offline Sync', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useLocalhostHealth(true), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.data).toBeDefined());

      const health = result.current.data;
      expect(health).toBeDefined();
      expect(health?.port3001.port).toBe(3001);
      expect(health?.port3001.status).toBe('online');
      expect(health?.heapMemory.serverMB).toBe(128);
      expect(health?.backups).toEqual({ son: 15, father: 7, grandfather: 4, total: 26 });
      expect(health?.fileWatcher.active).toBe(true);
      expect(health?.fileWatcher.path).toBe('d:/Desktop');
      expect(health?.offlineSync.isOnline).toBe(true);
    });

    it('LocalhostStatusHUD displays compact pill and expands modal with health metrics', async () => {
      const { Wrapper } = createWrapper();
      render(
        <Wrapper>
          <LocalhostStatusHUD />
        </Wrapper>
      );

      // Wait for async fetch to resolve and display backup count
      await waitFor(() => expect(screen.getByText(/Bk:26/)).toBeInTheDocument());

      // Verify compact pill text
      expect(screen.getByText('3001')).toBeInTheDocument();
      expect(screen.getByText(/Bk:26/)).toBeInTheDocument();

      // Click pill to open modal via title attribute
      const button = screen.getByTitle(/Localhost Health/i);
      fireEvent.click(button);

      // Verify modal headers & content
      expect(screen.getByText('Localhost Health & Daemon Status HUD')).toBeInTheDocument();
      expect(screen.getByText(/Son Tier/i)).toBeInTheDocument();
      expect(screen.getByText(/Father Tier/i)).toBeInTheDocument();
      expect(screen.getByText(/Grandfather/i)).toBeInTheDocument();
      expect(screen.getByText('d:/Desktop')).toBeInTheDocument();
    });
  });
});
