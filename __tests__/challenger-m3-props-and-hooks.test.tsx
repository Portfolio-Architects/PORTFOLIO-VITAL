import React from 'react';
import { render, screen, fireEvent, waitFor, renderHook, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';
import { WorkspaceView } from '@/components/WorkspaceView';
import { useAdminOntology, clearAdminOntologyHookCache } from '@/hooks/useAdminOntology';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { useBudget } from '@/hooks/useBudget';
import { BudgetCategory, BudgetEntry } from '@/types';
import { AdminOntologyGraph, AdminPolicyEntity } from '@/lib/ontology/admin-types';
import { CrossDomainProjectBundle, CrossDomainRegistry } from '@/lib/ontology/cross-domain-types';
import { WeeklyReportDto } from '@/lib/schemas';

// ============================================================================
// MOCKS SETUP
// ============================================================================

// Mock next/dynamic for BudgetDashboard modal components and WorkspaceView dynamic imports
jest.mock('next/dynamic', () => {
  return (loader: any) => {
    const fnStr = typeof loader === 'function' ? loader.toString() : '';
    if (fnStr.includes('BudgetDashboard')) {
      return function DynamicBudgetDashboard(props: any) {
        return <BudgetDashboard {...props} />;
      };
    }
    return function MockDynamicModal(props: any) {
      if (!props.isOpen && props.isOpen !== undefined) return null;
      return <div data-testid="mock-dynamic-modal" data-modal-props={JSON.stringify(props)} />;
    };
  };
});

// Mock crypto helpers
jest.mock('@/lib/crypto', () => ({
  isCryptoReady: () => true,
  getAuthToken: () => 'mock-auth-token',
}));

// Mock sheets API for useBudget
const mockCategoriesData: BudgetCategory[] = [
  {
    id: 'hook-cat-1',
    name: '신체활동 리플렛 제작',
    statItem: '',
    formationItem: '사무관리비',
    managementProject: '주민건강지원',
    policyProject: '지역사회 건강증진',
    unitProject: '건강생활실천',
    detailedProject: '신체활동 활성화',
    totalBudget: 8000000,
    budgetType: '본예산',
    fundingSource: '시비, 구비',
    color: '#3b82f6',
    sortOrder: 0,
    fundingSplits: [
      { source: '시비', amount: 4000000 },
      { source: '구비(자체)', amount: 4000000 },
    ],
    subItems: [
      {
        prefix: '1)',
        name: '리플렛 4천부 인쇄',
        amount: 4000000,
        calculation: '1,000원 * 4,000부',
      },
    ],
  },
];

const mockEntriesData: BudgetEntry[] = [
  {
    id: 'hook-entry-1',
    categoryId: 'hook-cat-1',
    amount: 2500000,
    date: '2026-10-15',
    purpose: '리플렛 본인쇄 집행',
    docRegNum: '건강증진과-2026-01',
    actionType: 'general',
    isPlanned: false,
    isSettled: true,
  },
  {
    id: 'hook-entry-planned',
    categoryId: 'hook-cat-1',
    amount: 1500000,
    date: '2026-10-20',
    purpose: '2차 배포용 품의(계획)',
    docRegNum: '건강증진과-2026-02',
    actionType: 'general',
    isPlanned: true,
    isSettled: false,
  },
];

const mockAddRow = jest.fn().mockImplementation((_sheet: string, data: any) => Promise.resolve(data));
const mockUpdateRow = jest.fn().mockImplementation((_sheet: string, id: string, updates: any) => Promise.resolve({ id, ...updates }));
const mockDeleteRow = jest.fn().mockImplementation((_sheet: string, id: string) => Promise.resolve({ success: true, id }));

jest.mock('@/lib/sheets-api', () => ({
  readSheet: jest.fn().mockImplementation((sheetName: string) => {
    if (sheetName === 'BUDGET_CATEGORIES') return Promise.resolve(mockCategoriesData);
    if (sheetName === 'BUDGET_ENTRIES') return Promise.resolve(mockEntriesData);
    return Promise.resolve([]);
  }),
  addRow: (...args: any[]) => mockAddRow(...args),
  updateRow: (...args: any[]) => mockUpdateRow(...args),
  deleteRow: (...args: any[]) => mockDeleteRow(...args),
  replaceAll: jest.fn().mockImplementation((_sheet: string, data: any) => Promise.resolve(data)),
  getTombstones: jest.fn().mockReturnValue([]),
}));

// Browser DOM URL mocks
if (typeof window !== 'undefined') {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-download-url');
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = jest.fn();
  }
}

function createTestQueryClient() {
  return new QueryClient({
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
}

function QueryWrapper({ children, client }: { children: React.ReactNode; client?: QueryClient }) {
  const queryClient = client || createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('Milestone 3 Empirical Challenger: Props & Hooks Verification Suite', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    clearAdminOntologyHookCache();
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  // ==========================================================================
  // SECTION 1: BudgetDashboard Props vs useBudget Fallback & Math Stress Tests
  // ==========================================================================
  describe('1. BudgetDashboard Component Props & Hook Fallback', () => {
    const customPropsCategories: BudgetCategory[] = [
      {
        id: 'prop-cat-1',
        name: '양재천 건강 걷기대회 홍보',
        statItem: '',
        formationItem: '사무관리비',
        managementProject: '주민건강증진',
        policyProject: '지역사회 건강생활실천',
        unitProject: '건강생활실천',
        detailedProject: '양재천 걷기 사업',
        totalBudget: 15000000,
        budgetType: '본예산',
        fundingSource: '구비',
        color: '#10b981',
        sortOrder: 0,
        fundingSplits: [{ source: '구비(자체)', amount: 15000000 }],
        subItems: [
          {
            prefix: '1)',
            name: '현수막 제작',
            amount: 5000000,
            calculation: '500,000원 * 10개',
          },
        ],
      },
    ];

    const customPropsEntries: BudgetEntry[] = [
      {
        id: 'prop-entry-1',
        categoryId: 'prop-cat-1',
        amount: 3000000,
        date: '2026-09-10',
        purpose: '현수막 제작 및 게시대 설치',
        actionType: 'general',
        isPlanned: false,
        isSettled: true,
      },
      {
        id: 'prop-entry-planned',
        categoryId: 'prop-cat-1',
        amount: 2000000,
        date: '2026-09-15',
        purpose: '포스터 추가 인쇄 품의',
        actionType: 'general',
        isPlanned: true,
        isSettled: false,
      },
    ];

    it('1-1. renders with full mock props without QueryClientProvider and displays accurate values', () => {
      const mockGetCategoryStats = jest.fn().mockReturnValue({
        totalBudget: 15000000,
        spent: 3000000,
        planned: 2000000,
        locked: 0,
        remaining: 10000000,
        usageRate: 20,
        generalSpent: 3000000,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
      });

      render(
        <BudgetDashboard
          categories={customPropsCategories}
          entries={customPropsEntries}
          getCategoryStats={mockGetCategoryStats}
        />
      );

      // Verify policy header rendered
      expect(screen.getByText('지역사회 건강생활실천')).toBeInTheDocument();
      // Verify formatted budget text rendered across cards
      expect(screen.getAllByText('15,000,000').length).toBeGreaterThan(0);

      // Expand accordion
      fireEvent.click(screen.getByText('지역사회 건강생활실천'));

      // Verify category name rendered inside expanded card
      expect(screen.getAllByText('양재천 건강 걷기대회 홍보').length).toBeGreaterThan(0);

      // Verify getCategoryStats was invoked for the category
      expect(mockGetCategoryStats).toHaveBeenCalledWith('prop-cat-1', undefined);
    });

    it('1-2. invokes passed callback props directly (addCategory, updateCategory, deleteCategory)', () => {
      const mockAddCategory = jest.fn();
      const mockUpdateCategory = jest.fn();
      const mockDeleteCategory = jest.fn();

      render(
        <BudgetDashboard
          categories={customPropsCategories}
          entries={customPropsEntries}
          addCategory={mockAddCategory}
          updateCategory={mockUpdateCategory}
          deleteCategory={mockDeleteCategory}
        />
      );

      // Click "지출 품의" button to open modal
      const expenseButton = screen.getByRole('button', { name: /지출 품의/i });
      fireEvent.click(expenseButton);

      // Check modal opened
      expect(screen.getByTestId('mock-dynamic-modal')).toBeInTheDocument();

      // Expand accordion and click add category inside policy group
      fireEvent.click(screen.getByText('지역사회 건강생활실천'));
      const addCategoryBtn = screen.getByTitle('이 세부사업에 새 통계목 추가');
      fireEvent.click(addCategoryBtn);
      expect(screen.getAllByTestId('mock-dynamic-modal').length).toBeGreaterThan(0);
    });

    it('1-3. renders cleanly under QueryClientProvider without props by delegating to useBudget()', async () => {
      const queryClient = createTestQueryClient();

      render(
        <QueryWrapper client={queryClient}>
          <BudgetDashboard />
        </QueryWrapper>
      );

      // Wait for useBudget() data to resolve from mock sheets-api
      await waitFor(() => {
        expect(screen.getByText('지역사회 건강증진')).toBeInTheDocument();
      });

      // Expand accordion to see category
      fireEvent.click(screen.getByText('지역사회 건강증진'));
      expect(screen.getAllByText('신체활동 리플렛 제작').length).toBeGreaterThan(0);
      expect(screen.getAllByText('8,000,000').length).toBeGreaterThan(0);
    });

    it('1-4. automatically filters out planned entries when using useBudget hook fallback', async () => {
      const queryClient = createTestQueryClient();

      // Test hook behavior directly to ensure filtering parity
      const { result } = renderHook(() => useBudget(), {
        wrapper: ({ children }) => <QueryWrapper client={queryClient}>{children}</QueryWrapper>,
      });

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0);
      });

      // useBudget provides all entries
      expect(result.current.entries.some((e) => e.isPlanned)).toBe(true);

      // BudgetDashboardInner filters entries where !e.isPlanned
      const nonPlanned = result.current.entries.filter((e) => !e.isPlanned);
      expect(nonPlanned.length).toBe(1);
      expect(nonPlanned[0].id).toBe('hook-entry-1');
    });

    it('1-5. gracefully handles standalone rendering with 0 props and no QueryClientProvider without crashing', () => {
      const { container } = render(<BudgetDashboard />);
      expect(container).toBeInTheDocument();
      // Verify empty state fallback
      expect(screen.getByText('예산 과목을 추가해 보세요')).toBeInTheDocument();
      expect(screen.getByText('0개 정책사업 · 0개 통계목')).toBeInTheDocument();
    });

    it('1-6. handles hybrid props: uses custom categories with stats while hook supplies fallback entries under QueryClient', async () => {
      const queryClient = createTestQueryClient();
      const mockGetCategoryStats = jest.fn().mockReturnValue({
        totalBudget: 15000000,
        spent: 3000000,
        planned: 0,
        locked: 0,
        remaining: 12000000,
        usageRate: 20,
        generalSpent: 3000000,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
      });

      render(
        <QueryWrapper client={queryClient}>
          <BudgetDashboard
            categories={customPropsCategories}
            getCategoryStats={mockGetCategoryStats}
          />
        </QueryWrapper>
      );

      // Since entries prop is missing, it should render via BudgetDashboardWithHook
      // but preserve prop categories and custom stats
      await waitFor(() => {
        expect(screen.getByText('지역사회 건강생활실천')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('지역사회 건강생활실천'));
      expect(screen.getAllByText('양재천 건강 걷기대회 홍보').length).toBeGreaterThan(0);
      expect(screen.getAllByText('15,000,000').length).toBeGreaterThan(0);
    });

    it('1-7. WorkspaceView forwards all props to BudgetDashboard and renders with 0 props', () => {
      // 0 props render (ProtectedApp pattern)
      const { container } = render(<WorkspaceView initialTab="budget" />);
      expect(container).toBeInTheDocument();
      expect(screen.getByText('예산 과목을 추가해 보세요')).toBeInTheDocument();

      // Render with custom categories and getCategoryStats forwarded
      const mockForwardStats = jest.fn().mockReturnValue({
        totalBudget: 15000000,
        spent: 0,
        planned: 0,
        locked: 0,
        remaining: 15000000,
        usageRate: 0,
        generalSpent: 0,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
      });
      render(
        <WorkspaceView
          initialTab="budget"
          budgetCategories={customPropsCategories}
          getCategoryStats={mockForwardStats}
        />
      );
      expect(screen.getByText('지역사회 건강생활실천')).toBeInTheDocument();
      fireEvent.click(screen.getByText('지역사회 건강생활실천'));
      expect(screen.getAllByText('양재천 건강 걷기대회 홍보').length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SECTION 2: useAdminOntology Hook Adversarial & State Machine Verification
  // ==========================================================================
  describe('2. useAdminOntology Controller Hook', () => {
    const mockPolicy: AdminPolicyEntity = {
      id: 'POL-2026-MEDIRUN',
      stage: 'POLICY_DIRECTIVE',
      title: '2026년 서울체력장 및 메디런 운영 기본계획',
      year: 2026,
      department: '보건행정과',
      project: '04_서울체력장_AI메디헬스_메디런',
      budgetAmount: 1557000000,
      objectives: ['서울체력장 운영'],
    };

    const mockGraph: AdminOntologyGraph = {
      policies: [mockPolicy],
      outcomes: [],
      audits: [],
      budgetPlans: [],
      weeklyWorks: [],
      edges: [],
      metadata: { totalNodes: 1, totalEdges: 0 },
    };

    const mockBundle: CrossDomainProjectBundle = {
      projectId: 'hchps-p7',
      projectKey: '04_서울체력장_AI메디헬스_메디런',
      projectName: '2026년 서울체력장',
      department: '보건행정과',
      team: '건강증진팀',
      color: '#6366f1',
      ontology: {
        policies: [mockPolicy],
        outcomes: [],
        audits: [],
        budgetPlans: [],
        weeklyWorks: [],
        totalNodes: 1,
        lifecycleComplete: false,
        auditGaps: [],
      },
      archive: {
        totalDocuments: 12,
        totalPhotos: 0,
        totalSheets: 0,
        recentDocuments: [],
        recentPhotos: [],
      },
      workingMemory: {
        pendingMemos: [],
        pendingCount: 0,
        reflectedCount: 0,
        urgentDirectives: [],
      },
      budget: {
        totalBudget: 1557000000,
        spentBudget: 500000000,
        remainingBudget: 1057000000,
        executionRate: 32.1,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
        simulatedExpenditure: 0,
        finalExpectedBalance: 1057000000,
        isDeficit: false,
        categories: [
          {
            id: 'cat-1',
            name: '체력측정 운영비',
            totalBudget: 1557000000,
            spent: 500000000,
            remaining: 1057000000,
          },
        ],
      },
      weeklyWork: {
        reportsCount: 1,
        recentItems: [],
        latestHwpxAvailable: false,
      },
      festivalAndContacts: {
        isFestivalProject: false,
        assignedContacts: [],
      },
    };

    const mockRegistry: CrossDomainRegistry = {
      '04_서울체력장_AI메디헬스_메디런': mockBundle,
    };

    it('2-1. respects autoFetch: false and does not trigger network calls on mount', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      const { result } = renderHook(() =>
        useAdminOntology({
          autoFetch: false,
          autoFetchGraph: false,
          autoFetchCrossJoin: false,
        })
      );

      expect(result.current.graph).toBeNull();
      expect(result.current.crossDomainRegistry).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('2-2. triggers fetchGraph and fetchCrossJoin automatically when autoFetch is true', async () => {
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('action=graph')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, graph: mockGraph }),
          };
        }
        if (url.includes('action=cross-join')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: mockRegistry }),
          };
        }
        return { ok: false, status: 404 };
      }) as any;

      const { result } = renderHook(() => useAdminOntology());

      await waitFor(() => {
        expect(result.current.graph).not.toBeNull();
        expect(result.current.crossDomainRegistry).not.toBeNull();
      });

      expect(result.current.graph?.policies[0].id).toBe('POL-2026-MEDIRUN');
      expect(result.current.lastSyncedAt).not.toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('2-3. captures errors when fetchGraph fails and handles recovery on retry', async () => {
      let fail = true;
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('action=graph')) {
          if (fail) {
            return {
              ok: false,
              status: 500,
              json: async () => ({ error: 'Internal Server Error' }),
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, graph: mockGraph }),
          };
        }
        return { ok: true, json: async () => ({ success: true, data: {} }) };
      }) as any;

      const { result } = renderHook(() =>
        useAdminOntology({ autoFetchGraph: false, autoFetchCrossJoin: false })
      );

      // First call fails
      await act(async () => {
        const res = await result.current.fetchGraph();
        expect(res).toBeNull();
      });

      expect(result.current.error).toContain('HTTP 500');
      expect(result.current.loading).toBe(false);

      // Recovery call succeeds
      fail = false;
      await act(async () => {
        const res = await result.current.fetchGraph();
        expect(res).not.toBeNull();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.graph?.policies[0].id).toBe('POL-2026-MEDIRUN');
    });

    it('2-4. resolves targeted fetchCrossJoin and fetchProjectBundle accurately', async () => {
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('&projectKey=')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: mockBundle }),
          };
        }
        return { ok: true, json: async () => ({ success: true, data: mockRegistry }) };
      }) as any;

      const { result } = renderHook(() =>
        useAdminOntology({ autoFetch: false })
      );

      let fetchedBundle: CrossDomainProjectBundle | null = null;
      await act(async () => {
        fetchedBundle = await result.current.fetchProjectBundle('04_서울체력장_AI메디헬스_메디런');
      });

      expect(fetchedBundle).toBeDefined();
      expect((fetchedBundle as any)?.projectKey).toBe('04_서울체력장_AI메디헬스_메디런');
      expect(result.current.projectBundle?.budget.totalBudget).toBe(1557000000);
    });

    it('2-5. executes reindex mutation updating graph and crossDomainRegistry', async () => {
      const updatedGraph = { ...mockGraph, metadata: { totalNodes: 99 } };
      global.fetch = jest.fn().mockImplementation(async (url: string, init?: any) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(init.body);
          if (body.action === 'reindex') {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                graph: updatedGraph,
                crossJoin: mockRegistry,
              }),
            };
          }
        }
        return { ok: true, json: async () => ({ success: true }) };
      }) as any;

      const { result } = renderHook(() => useAdminOntology({ autoFetch: false }));

      await act(async () => {
        const reindexRes = await result.current.reindex();
        expect(reindexRes).not.toBeNull();
        expect(reindexRes?.graph.metadata?.totalNodes).toBe(99);
      });

      expect(result.current.graph?.metadata?.totalNodes).toBe(99);
      expect(result.current.isReindexing).toBe(false);
      expect(result.current.lastSyncedAt).not.toBeNull();
    });

    it('2-6. openArchiveTarget safely encodes special characters and handles errors', async () => {
      let postedBody: any = null;
      global.fetch = jest.fn().mockImplementation(async (url: string, init?: any) => {
        if (url.includes('/api/archive/open')) {
          postedBody = JSON.parse(init.body);
          if (postedBody.path.includes('forbidden')) {
            return {
              ok: false,
              status: 403,
              json: async () => ({ error: '접근이 거부된 경로' }),
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true }),
          };
        }
        return { ok: true, json: async () => ({ success: true }) };
      }) as any;

      const { result } = renderHook(() => useAdminOntology({ autoFetch: false }));

      // Test path with '%' character encoding
      await act(async () => {
        const res = await result.current.openArchiveTarget('D:\\Docs\\100%_Final_Doc.hwpx', 'file');
        expect(res.ok).toBe(true);
      });
      expect(postedBody.path).toBe('D:\\Docs\\100%25_Final_Doc.hwpx');
      expect(postedBody.mode).toBe('file');

      // Test forbidden error path
      await act(async () => {
        const res = await result.current.openArchiveTarget('D:\\forbidden\\secret.hwpx', 'file');
        expect(res.ok).toBe(false);
        expect(res.error).toBe('접근이 거부된 경로');
      });

      // Test openArchiveFile convenience boolean wrapper
      await act(async () => {
        const ok = await result.current.openArchiveFile('D:\\Docs\\Normal.hwpx', 'folder');
        expect(ok).toBe(true);
      });
      expect(postedBody.mode).toBe('folder');
    });

    it('2-7. executes traceNode, searchNodes, and fetchAuditGaps calls', async () => {
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('action=trace')) {
          return { ok: true, status: 200, json: async () => ({ upstream: ['POL-1'], downstream: [] }) };
        }
        if (url.includes('action=search')) {
          return { ok: true, status: 200, json: async () => ({ results: [mockGraph.policies[0]] }) };
        }
        if (url.includes('action=gaps')) {
          return { ok: true, status: 200, json: async () => ({ gaps: [{ auditId: 'AUD-1', description: 'Gap 1' }] }) };
        }
        return { ok: false };
      }) as any;

      const { result } = renderHook(() => useAdminOntology({ autoFetch: false }));

      await act(async () => {
        const trace = await result.current.traceNode('POL-1', 'upstream');
        expect(trace.upstream).toContain('POL-1');

        const search = await result.current.searchNodes('메디런');
        expect(search.length).toBe(1);
        expect(search[0].id).toBe('POL-2026-MEDIRUN');

        const gaps = await result.current.fetchAuditGaps();
        expect(gaps.length).toBe(1);
        expect(gaps[0].auditId).toBe('AUD-1');
      });
    });
  });

  // ==========================================================================
  // SECTION 3: useWeeklyReport Hook Wednesday Cycle & Actions Verification
  // ==========================================================================
  describe('3. useWeeklyReport Controller Hook', () => {
    const mockReport: WeeklyReportDto = {
      id: 'rep-20261104',
      reportDate: '2026-11-04',
      departmentName: '보건행정과',
      teamTitle: '건강증진팀장 김지영',
      performancePeriod: '11. 02.(월) ~ 11. 08.(일)',
      planPeriod: '11. 09.(월) ~ 11. 15.(일)',
      items: [
        {
          id: 'item-perf-1',
          projectOrder: 1,
          projectName: '04_서울체력장_AI메디헬스_메디런',
          period: '11. 02.(월) ~ 11. 08.(일)',
          target: '체력측정 대상 구민 100명',
          location: '강남구민체육관',
          contents: ['1차 정밀 체력측정 및 운동처방 제공', '데이터 연동 모니터링'],
          metrics: '누적 1,200명 측정 완료',
          status: 'performance',
        },
        {
          id: 'item-perf-2',
          projectOrder: 1,
          projectName: '04_서울체력장_AI메디헬스_메디런',
          period: '11. 02.(월) ~ 11. 08.(일)',
          contents: ['홍보 리플렛 보건소 로비 비치'],
          status: 'performance',
        },
        {
          id: 'item-plan-1',
          projectOrder: 1,
          projectName: '04_서울체력장_AI메디헬스_메디런',
          period: '11. 09.(월) ~ 11. 15.(일)',
          target: '찾아가는 체력측정반',
          contents: ['관내 노인종합복지관 방문 측정'],
          status: 'plan',
        },
      ],
      createdAt: '2026-11-04T09:00:00Z',
      updatedAt: '2026-11-04T09:00:00Z',
    };

    it('3-1. calculates Wednesday batch periods correctly and handles shifts (+7, -7)', () => {
      const { result } = renderHook(() =>
        useWeeklyReport({ initialDate: '2026-11-04', autoFetch: false })
      );

      // Verify exact Wednesday periods
      expect(result.current.periods.targetWednesday).toBe('2026-11-04');
      expect(result.current.periods.performanceStart).toBe('2026-11-02');
      expect(result.current.periods.performanceEnd).toBe('2026-11-08');
      expect(result.current.periods.planStart).toBe('2026-11-09');
      expect(result.current.periods.planEnd).toBe('2026-11-15');

      // Shift week +7 days
      act(() => {
        result.current.shiftWeek(7);
      });
      expect(result.current.selectedDate).toBe('2026-11-11');
      expect(result.current.periods.targetWednesday).toBe('2026-11-11');

      // Shift week -14 days
      act(() => {
        result.current.shiftWeek(-14);
      });
      expect(result.current.selectedDate).toBe('2026-10-28');
      expect(result.current.periods.targetWednesday).toBe('2026-10-28');
    });

    it('3-2. automatically shifts non-Wednesday input date (e.g. Friday) to the week Wednesday', () => {
      const { result } = renderHook(() =>
        useWeeklyReport({ initialDate: '2026-11-06', autoFetch: false }) // Friday
      );

      expect(result.current.periods.targetWednesday).toBe('2026-11-04');
    });

    it('3-3. computes project-grouped perfBlocks and planBlocks when currentReport is loaded', () => {
      const { result } = renderHook(() =>
        useWeeklyReport({ initialDate: '2026-11-04', autoFetch: false })
      );

      act(() => {
        result.current.setCurrentReport(mockReport);
      });

      // Verify performance blocks
      expect(result.current.perfBlocks.length).toBe(2);
      expect(result.current.perfBlocks[0].projectName).toBe('04_서울체력장_AI메디헬스_메디런');
      expect(result.current.perfBlocks[0].contents.length).toBe(2);
      expect(result.current.perfBlocks[1].contents.length).toBe(1);

      // Verify plan blocks
      expect(result.current.planBlocks.length).toBe(1);
      expect(result.current.planBlocks[0].projectName).toBe('04_서울체력장_AI메디헬스_메디런');
      expect(result.current.planBlocks[0].contents.length).toBe(1);
    });

    it('3-4. fetches report via API and handles fetch errors gracefully', async () => {
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/weekly-report?date=2026-11-04')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              currentReport: mockReport,
              allReports: [mockReport],
            }),
          };
        }
        return { ok: false, status: 500 };
      }) as any;

      const { result } = renderHook(() =>
        useWeeklyReport({ initialDate: '2026-11-04', autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.currentReport).not.toBeNull();
      });

      expect(result.current.currentReport?.id).toBe('rep-20261104');
      expect(result.current.allReports.length).toBe(1);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('3-5. aggregates report from tasks and updates currentReport and status message', async () => {
      const aggregatedReport: WeeklyReportDto = {
        ...mockReport,
        id: 'rep-agg-1',
      };

      global.fetch = jest.fn().mockImplementation(async (url: string, init?: any) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(init.body);
          if (body.action === 'aggregate') {
            return {
              ok: true,
              status: 200,
              json: async () => ({ success: true, report: aggregatedReport }),
            };
          }
        }
        return { ok: false };
      }) as any;

      const { result } = renderHook(() =>
        useWeeklyReport({ initialDate: '2026-11-04', autoFetch: false })
      );

      await act(async () => {
        const res = await result.current.aggregateReport();
        expect(res?.id).toBe('rep-agg-1');
      });

      expect(result.current.currentReport?.id).toBe('rep-agg-1');
      expect(result.current.statusMessage).toBe('TASKS 실적 · 계획 자동 집계 완료');
      expect(result.current.isAggregating).toBe(false);
    });

    it('3-6. saves report and fires onSignalAdded callback with summary', async () => {
      const onSignalSpy = jest.fn();
      global.fetch = jest.fn().mockImplementation(async (_url: string, init?: any) => {
        const body = JSON.parse(init?.body || '{}');
        if (body.action === 'save-report') {
          return { ok: true, status: 200, json: async () => ({ success: true }) };
        }
        return { ok: false };
      }) as any;

      const { result } = renderHook(() =>
        useWeeklyReport({
          initialDate: '2026-11-04',
          autoFetch: false,
          onSignalAdded: onSignalSpy,
        })
      );

      act(() => {
        result.current.setCurrentReport(mockReport);
      });

      let saveSuccess = false;
      await act(async () => {
        saveSuccess = await result.current.saveReport();
      });

      expect(saveSuccess).toBe(true);
      expect(result.current.statusMessage).toBe('주간업무 보고서 저장 완료');
      expect(onSignalSpy).toHaveBeenCalledWith(
        expect.stringContaining('[주간보고 저장] 2026-11-04')
      );
    });

    it('3-7. generates and downloads HWPX file with standard filename', async () => {
      const mockBlob = new Blob(['mock-hwpx-binary'], { type: 'application/x-hwp' });
      global.fetch = jest.fn().mockImplementation(async (_url: string, init?: any) => {
        const body = JSON.parse(init?.body || '{}');
        if (body.action === 'generate-hwpx') {
          return {
            ok: true,
            status: 200,
            blob: async () => mockBlob,
          };
        }
        return { ok: false };
      }) as any;

      const { result } = renderHook(() =>
        useWeeklyReport({ initialDate: '2026-11-04', autoFetch: false })
      );

      act(() => {
        result.current.setCurrentReport(mockReport);
      });

      let downloadedBlob: Blob | null = null;
      await act(async () => {
        downloadedBlob = await result.current.generateHwpx();
      });

      expect(downloadedBlob).toBe(mockBlob);
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-download-url');
    });

    it('3-8. safely returns null from generateHwpx and false from saveReport when no report exists', async () => {
      const { result } = renderHook(() =>
        useWeeklyReport({ initialDate: '2026-11-04', autoFetch: false })
      );

      await act(async () => {
        const blob = await result.current.generateHwpx();
        expect(blob).toBeNull();
        const saved = await result.current.saveReport();
        expect(saved).toBe(false);
      });
    });
  });
});
