/**
 * VITAL Work & Wealth Architecture — Milestone 3 View Integration Empirical Challenger
 * Test Suite: __tests__/challenger-m3-view-integration.test.tsx
 *
 * Empirical adversarial stress testing of:
 * 1. WorkspaceView & ProtectedApp Zero-Prop Rendering & Runtime Resilience
 * 2. AdminOntologyExplorer Project Key Dynamic Switching & Reindexing Lifecycle
 * 3. WeeklyReportManager Wednesday Batching, Aggregation Cycles & HWPX State Flags
 *
 * Standards: Rule S (448px Mobile-First), Rule 1 (Strict M-V-C Controller Isolation), Rule B (Loud Failures)
 */

import { TextEncoder, TextDecoder } from 'util';

// Polyfills for JSDOM environment
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
if (typeof (global as any).fetch === 'undefined') {
  (global as any).fetch = jest.fn();
}

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Components under test
import { WorkspaceView } from '@/components/WorkspaceView';
import { ProtectedApp, ProtectedAppProps } from '@/components/ProtectedApp';
import { AdminOntologyExplorer } from '@/components/ontology/AdminOntologyExplorer';
import WeeklyReportManager from '@/components/weekly/WeeklyReportManager';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';
import { clearAdminOntologyHookCache } from '@/hooks/useAdminOntology';

// Types
import {
  AdminOntologyGraph,
  AdminPolicyEntity,
  AdminOutcomeEntity,
  AdminAuditEntity,
  AdminBudgetPlanEntity,
  AdminWeeklyWorkEntity,
} from '@/lib/ontology/admin-types';
import { WeeklyReportDto, WeeklyWorkItemDto } from '@/lib/schemas';

// Mocks for Canvas 2D
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn().mockImplementation((type: string) => {
    if (type === '2d') {
      return {
        clearRect: jest.fn(),
        beginPath: jest.fn(),
        arc: jest.fn(),
        fill: jest.fn(),
        stroke: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        scale: jest.fn(),
        strokeText: jest.fn(),
        fillText: jest.fn(),
        setLineDash: jest.fn(),
        measureText: jest.fn().mockReturnValue({ width: 50 }),
      };
    }
    return null;
  });

  if (typeof window !== 'undefined') {
    window.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = jest.fn();
    window.alert = jest.fn();
  }
});

// Mock Next.js Navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Domain Hooks for ProtectedApp Integration
jest.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [],
    stats: { total: 4, done: 2, overdue: 0 },
    updateTask: jest.fn(),
  }),
}));

const mockBudgetCategories = [
  { id: 'cat-main-1', name: '일반수용비', totalBudget: 50000000 },
  { id: 'cat-main-2', name: '행사운영비', totalBudget: 30000000 },
];
const mockBudgetEntries = [
  { id: 'bgt-ent-1', categoryId: 'cat-main-1', amount: 12000000, date: '2026-11-01', purpose: '현수막 인쇄', isPlanned: false },
];

jest.mock('@/hooks/useBudget', () => ({
  useBudget: () => ({
    categories: mockBudgetCategories,
    entries: mockBudgetEntries,
    addCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    replaceCategories: jest.fn(),
    addEntry: jest.fn(),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
    batchUpdateEntries: jest.fn(),
    batchDeleteEntries: jest.fn(),
    batchSettleEntries: jest.fn(),
    getCategoryStats: jest.fn().mockReturnValue({ totalBudget: 50000000, spent: 12000000, remaining: 38000000 }),
    overallStatsActual: { totalBudget: 80000000, totalSpent: 12000000, percentage: 15.0 },
  }),
}));

jest.mock('@/hooks/useInventory', () => ({
  useInventory: () => ({
    items: [],
    addItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
    adjustStock: jest.fn(),
    getItemHistory: jest.fn(),
  }),
}));

jest.mock('@/hooks/useMeetings', () => ({
  useMeetings: () => ({ meetings: [] }),
}));

jest.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({ projects: [] }),
}));

jest.mock('@/hooks/useContacts', () => ({
  useContacts: () => ({
    contacts: [{ id: 'ct-1', name: '홍*동', phone: '010-****-1234', role: '총괄주무관' }],
    loading: false,
  }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    logout: jest.fn(),
  }),
}));

jest.mock('@/lib/sheets-api', () => ({
  syncTombstones: jest.fn().mockResolvedValue(true),
}));

// Helper to create QueryClient wrapper
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithQueryClient(ui: React.ReactElement, client = createTestQueryClient()) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// ============================================================================
// Multi-Project Mock Graph for AdminOntologyExplorer Testing
// ============================================================================
const mockFitnessPolicy: AdminPolicyEntity = {
  id: 'POL-FITNESS',
  stage: 'POLICY_DIRECTIVE',
  title: '2026년 서울체력장 기본계획',
  year: 2026,
  department: '보건행정과 건강증진팀',
  project: '04_서울체력장_AI메디헬스_메디런',
  budgetAmount: 50000000,
  objectives: ['어르신 및 구민 생활체육 저변 확대'],
};

const mockFitnessAudit: AdminAuditEntity & { project?: string } = {
  id: 'AUD-FITNESS',
  stage: 'AUDIT_REVIEW',
  auditedOutcomeId: 'OUT-FITNESS',
  auditFindings: ['체력측정 장비 안전점검 시정요구'],
  correctiveMandates: ['2026년 신규 예산 반영'],
  title: '2025년 행정사무감사 시정요구 (서울체력장 안전대책)',
  project: '04_서울체력장_AI메디헬스_메디런',
  projectKey: '04_서울체력장_AI메디헬스_메디런',
  year: 2025,
  sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2025년\\행감_체력장.hwpx',
};

const mockFestivalPolicy: AdminPolicyEntity = {
  id: 'POL-HEALTH-FEST',
  stage: 'POLICY_DIRECTIVE',
  title: '2026년 양재천 건강 페스티벌 기본계획',
  year: 2026,
  department: '보건행정과 건강증진팀',
  project: '01_양재천_페스티벌',
  budgetAmount: 180000000,
  objectives: ['구민 건강 페스티벌 및 걷기 코스 운영'],
};

const mockFestivalBudgetPlan: AdminBudgetPlanEntity = {
  id: 'BGT-HEALTH-FEST',
  stage: 'BUDGET_PLAN',
  title: '2026년 양재천 건강 페스티벌 사업설명서',
  year: 2026,
  project: '01_양재천_페스티벌',
  totalBudget: 180000000,
  fundingSources: { fund: 0, city: 90000000, district: 90000000 },
  itemizedBreakdown: [{ item: '일반수용비', amount: 50000000 }],
  sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2026년\\페스티벌_사업설명서.hwpx',
};

const mockFitnessOutcome: AdminOutcomeEntity & { project?: string } = {
  id: 'OUT-FITNESS',
  stage: 'OUTCOME_REPORT',
  policyId: 'POL-FITNESS',
  project: '04_서울체력장_AI메디헬스_메디런',
  projectKey: '04_서울체력장_AI메디헬스_메디런',
  title: '2026년 서울체력장 상반기 운영 결과보고',
  year: 2026,
  executionRate: 95.0,
  spentBudget: 45000000,
  achievements: ['4,500명 참여'],
  sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2026년\\체력장_결과보고.hwpx',
};

const mockFitnessWeekly: AdminWeeklyWorkEntity = {
  id: 'WW-FITNESS',
  stage: 'WEEKLY_WORK',
  title: '체력측정 장비 캘리브레이션 및 참가자 접수',
  date: '2026-11-11',
  category: '04_서울체력장_AI메디헬스_메디런',
  status: 'done',
};

const mockTestGraph: AdminOntologyGraph = {
  policies: [mockFitnessPolicy, mockFestivalPolicy],
  outcomes: [mockFitnessOutcome],
  audits: [mockFitnessAudit],
  budgetPlans: [mockFestivalBudgetPlan],
  weeklyWorks: [mockFitnessWeekly],
  edges: [
    {
      id: 'edge-1',
      source: 'POL-FITNESS',
      target: 'AUD-FITNESS',
      type: 'CRITIQUES',
      label: '행감 지적',
    },
    {
      id: 'edge-2',
      source: 'POL-HEALTH-FEST',
      target: 'BGT-HEALTH-FEST',
      type: 'ALLOCATES_BUDGET',
      label: '예산 배정',
    },
  ],
};

// ============================================================================
// Multi-Item Mock Weekly Report Fixture
// ============================================================================
const mockWeeklyReportFixture: WeeklyReportDto = {
  id: 'report-2026-11-11',
  reportDate: '2026-11-11',
  departmentName: '보건행정과',
  teamTitle: '건강증진팀장 김지영',
  performancePeriod: '11. 09.(월) ~ 11. 15.(일)',
  planPeriod: '11. 16.(월) ~ 11. 22.(일)',
  items: [
    {
      id: 'perf-item-1',
      projectOrder: 1,
      projectName: '서울체력장 강남센터',
      period: '11. 09.(월) ~ 11. 15.(일)',
      target: '구민 500명',
      location: '강남구민체육관',
      contents: ['체력측정 및 운동처방 520명 실시'],
      status: 'performance',
    },
    {
      id: 'perf-item-2',
      projectOrder: 2,
      projectName: '양재천 건강 페스티벌',
      period: '11. 09.(월) ~ 11. 15.(일)',
      contents: ['코스 안내 5대 부스 시공 완료'],
      status: 'performance',
    },
    {
      id: 'plan-item-1',
      projectOrder: 1,
      projectName: '서울체력장 강남센터',
      period: '11. 16.(월) ~ 11. 22.(일)',
      target: '구민 400명',
      contents: ['2차 스마트 헬스케어 상담 진행'],
      status: 'plan',
    },
    {
      id: 'plan-item-2',
      projectOrder: 3,
      projectName: '모바일 헬스케어',
      period: '11. 16.(월) ~ 11. 22.(일)',
      contents: ['활동량계 데이터 분석 및 이상치 검출'],
      status: 'plan',
    },
  ],
  createdAt: '2026-11-11T09:00:00Z',
  updatedAt: '2026-11-11T09:00:00Z',
};

// ============================================================================
// TEST SUITE BEGINS
// ============================================================================

describe('Milestone 3 Empirical Challenger: View Integrations Stress Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAdminOntologyHookCache();
    localStorage.clear();
  });

  // ==========================================================================
  // Section 1: WorkspaceView & ProtectedApp Zero-Prop Rendering & Null-Safety
  // ==========================================================================
  describe('1. WorkspaceView & ProtectedApp Zero-Prop Rendering & Runtime Resilience', () => {
    it('1-1. mounts WorkspaceView with zero props without throwing TypeError or crash', async () => {
      let container!: HTMLElement;
      expect(() => {
        const res = renderWithQueryClient(<WorkspaceView />);
        container = res.container;
      }).not.toThrow();
      expect(container).toBeInTheDocument();
      // Unified budget control board renders directly without legacy dual top tabs
      expect(await screen.findByText('예산 현황')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /과목별 대조/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /예정 · 소진 표/ })).toBeInTheDocument();
    });

    it('1-2. renders WorkspaceView with empty object props ({}) and switches between unified sub-views cleanly', async () => {
      const { container } = renderWithQueryClient(<WorkspaceView {...{}} />);
      expect(container).toBeInTheDocument();

      // Switch to "예정 · 소진 표" sub-view
      const planSubViewBtn = await screen.findByRole('button', { name: /예정 · 소진 표/ });
      fireEvent.click(planSubViewBtn);
      expect(planSubViewBtn).toHaveAttribute('aria-pressed', 'true');

      // Switch back to "과목별 대조" sub-view
      const catSubViewBtn = screen.getByRole('button', { name: /과목별 대조/ });
      fireEvent.click(catSubViewBtn);
      expect(catSubViewBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('1-3. mounts WorkspaceView with initialTab="simulator" directly without prop drilling', async () => {
      renderWithQueryClient(<WorkspaceView initialTab="simulator" />);
      const planSubViewBtn = await screen.findByRole('button', { name: /예정 · 소진 표/ });
      expect(planSubViewBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('1-4. handles window custom event "hchps-zod-error" safely without crashing', () => {
      renderWithQueryClient(<WorkspaceView />);

      act(() => {
        window.dispatchEvent(
          new CustomEvent('hchps-zod-error', {
            detail: {
              sheetName: 'BUDGET',
              rowId: 'row-404-corrupt',
              errors: { amount: 'Must be number' },
            },
          })
        );
      });

      // Verify the warning banner rendered safely
      expect(screen.getByText(/안전 기본값 자동 격리 적용/i)).toBeInTheDocument();
      expect(screen.getByText(/row-404-corrupt/i)).toBeInTheDocument();
    });

    it('1-5. renders BudgetDashboard with zero props under QueryClientProvider (useBudget fallback)', () => {
      expect(() => {
        const { container } = renderWithQueryClient(<BudgetDashboard />);
        expect(container).toBeInTheDocument();
      }).not.toThrow();
    });

    it('1-6. renders BudgetDashboard with zero props outside QueryClientProvider (null-safety inner fallback)', () => {
      expect(() => {
        // Without QueryClientProvider wrapper
        const { container } = render(<BudgetDashboard />);
        expect(container).toBeInTheDocument();
      }).not.toThrow();
    });

    it('1-7. renders ProtectedApp with standard props and verifies module switching to WorkspaceView with 0 props drilled', async () => {
      const onModeChange = jest.fn();
      renderWithQueryClient(<ProtectedApp appMode="HCHPS" onModeChange={onModeChange} />);

      // ProtectedApp starts at dashboard
      expect(screen.getByText(/HCHPS 대시보드/i)).toBeInTheDocument();

      // Switch module to workspace (예산관리)
      const workspaceNavBtns = screen.getAllByText('예산관리');
      expect(workspaceNavBtns.length).toBeGreaterThan(0);
      fireEvent.click(workspaceNavBtns[0]);

      // WorkspaceView should be active with 0 drilled props rendering unified board
      await waitFor(() => {
        expect(screen.getByText('예산 현황')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /과목별 대조/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /예정 · 소진 표/ })).toBeInTheDocument();
      });
    });

    it('1-8. renders ProtectedApp with zero props (via runtime fallback cast) without unhandled property access errors', async () => {
      // Adversarial test: runtime zero props on ProtectedApp
      expect(() => {
        const { container } = renderWithQueryClient(<ProtectedApp {...({} as any)} />);
        expect(container).toBeInTheDocument();
      }).not.toThrow();

      // Switch to workspace even under undefined appMode
      const workspaceNavBtns = screen.getAllByText('예산관리');
      fireEvent.click(workspaceNavBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('예산 현황')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Section 2: AdminOntologyExplorer Project Key Switching & Reindex Operations
  // ==========================================================================
  describe('2. AdminOntologyExplorer Project Key Dynamic Switching & Reindexing Lifecycle', () => {
    it('2-1. initializes with projectKey="ALL" and dynamically filters when projectKey prop changes', async () => {
      const { rerender } = render(
        <AdminOntologyExplorer initialGraph={mockTestGraph} projectKey="ALL" />
      );

      // Switch to list cards view to inspect rendered nodes
      const cardsModeBtn = screen.getByRole('button', { name: /목록 카드 뷰/i });
      fireEvent.click(cardsModeBtn);

      // Verify all multi-project nodes are visible under "ALL"
      expect(screen.getByText('2026년 서울체력장 기본계획')).toBeInTheDocument();
      expect(screen.getByText('2026년 양재천 건강 페스티벌 기본계획')).toBeInTheDocument();
      expect(screen.getByText('2026년 서울체력장 상반기 운영 결과보고')).toBeInTheDocument();

      // Switch projectKey to "04_서울체력장_AI메디헬스_메디런"
      rerender(<AdminOntologyExplorer initialGraph={mockTestGraph} projectKey="04_서울체력장_AI메디헬스_메디런" />);

      await waitFor(() => {
        // Fitness policy and audit should remain visible
        expect(screen.getByText('2026년 서울체력장 기본계획')).toBeInTheDocument();
        expect(screen.getByText(/2025년 행정사무감사 시정요구/i)).toBeInTheDocument();

        // Festival should be filtered out
        expect(screen.queryByText('2026년 양재천 건강 페스티벌 기본계획')).not.toBeInTheDocument();
      });

      // Switch projectKey to "01_양재천_페스티벌"
      rerender(<AdminOntologyExplorer initialGraph={mockTestGraph} projectKey="01_양재천_페스티벌" />);

      await waitFor(() => {
        expect(screen.getByText('2026년 양재천 건강 페스티벌 기본계획')).toBeInTheDocument();
        expect(screen.getByText('2026년 양재천 건강 페스티벌 사업설명서')).toBeInTheDocument();
        expect(screen.queryByText('2026년 서울체력장 기본계획')).not.toBeInTheDocument();
      });

      // Switch projectKey to unknown key: should not crash and render empty list
      rerender(<AdminOntologyExplorer initialGraph={mockTestGraph} projectKey="UNKNOWN_PROJECT_KEY" />);

      await waitFor(() => {
        expect(screen.queryByText('2026년 서울체력장 기본계획')).not.toBeInTheDocument();
        expect(screen.queryByText('2026년 양재천 건강 페스티벌 기본계획')).not.toBeInTheDocument();
      });

      // Switch back to "ALL"
      rerender(<AdminOntologyExplorer initialGraph={mockTestGraph} projectKey="ALL" />);

      await waitFor(() => {
        expect(screen.getByText('2026년 서울체력장 기본계획')).toBeInTheDocument();
        expect(screen.getByText('2026년 양재천 건강 페스티벌 기본계획')).toBeInTheDocument();
      });
    });

    it('2-2. updates filter interactively when user clicks project filter chips in the UI', async () => {
      render(<AdminOntologyExplorer initialGraph={mockTestGraph} projectKey="ALL" />);

      // Switch to list cards view
      const cardsModeBtn = screen.getByRole('button', { name: /목록 카드 뷰/i });
      fireEvent.click(cardsModeBtn);

      // Click "01 양재천 건강페스티벌" chip
      const festivalChip = screen.getByRole('button', { name: /01 양재천 건강페스티벌/i });
      fireEvent.click(festivalChip);

      await waitFor(() => {
        expect(screen.getByText('2026년 양재천 건강 페스티벌 기본계획')).toBeInTheDocument();
        expect(screen.queryByText('2026년 서울체력장 기본계획')).not.toBeInTheDocument();
      });

      // Click "전체 사업 (9개)" chip
      const allProjectsChip = screen.getByRole('button', { name: /전체 사업 \(9개\)/i });
      fireEvent.click(allProjectsChip);

      await waitFor(() => {
        expect(screen.getByText('2026년 서울체력장 기본계획')).toBeInTheDocument();
        expect(screen.getByText('2026년 양재천 건강 페스티벌 기본계획')).toBeInTheDocument();
      });
    });

    it('2-3. triggers reindex operation via useAdminOntology hook and handles success lifecycle', async () => {
      const newlyReindexedGraph: AdminOntologyGraph = {
        ...mockTestGraph,
        policies: [
          ...mockTestGraph.policies,
          {
            id: 'POL-NEW-REINDEXED',
            stage: 'POLICY_DIRECTIVE',
            title: '신규 비파괴 재색인 방침서',
            year: 2026,
            department: '보건행정과',
            project: '04_서울체력장_AI메디헬스_메디런',
            budgetAmount: 10000000,
            objectives: ['비파괴 재색인 검증'],
          },
        ],
      };

      // Mock fetch for reindex POST
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input: any, init?: any) => {
        const urlStr = typeof input === 'string' ? input : input.url;
        if (urlStr.includes('/api/admin-ontology') && init?.method === 'POST') {
          const body = JSON.parse(init.body);
          if (body.action === 'reindex') {
            return {
              ok: true,
              json: async () => ({
                success: true,
                graph: newlyReindexedGraph,
                crossJoin: {},
              }),
            } as any;
          }
        }
        return {
          ok: true,
          json: async () => ({ success: true, graph: mockTestGraph }),
        } as any;
      });

      render(<AdminOntologyExplorer initialGraph={mockTestGraph} projectKey="ALL" />);

      // Switch to list cards view
      const cardsModeBtn = screen.getByRole('button', { name: /목록 카드 뷰/i });
      fireEvent.click(cardsModeBtn);

      const reindexBtn = screen.getByTitle('문서 색인 갱신');
      expect(reindexBtn).toBeInTheDocument();

      // Trigger reindex
      fireEvent.click(reindexBtn);

      // Verify POST request sent
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/admin-ontology',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ action: 'reindex' }),
          })
        );
      });

      // Verify newly reindexed policy is now in the document
      await waitFor(() => {
        expect(screen.getByText('신규 비파괴 재색인 방침서')).toBeInTheDocument();
      });

      fetchSpy.mockRestore();
    });

    it('2-4. handles reindex failure gracefully without component unmount or fatal error', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input: any, init?: any) => {
        const urlStr = typeof input === 'string' ? input : input.url;
        if (urlStr.includes('/api/admin-ontology') && init?.method === 'POST') {
          return {
            ok: false,
            status: 500,
            json: async () => ({ success: false, error: 'Database busy' }),
          } as any;
        }
        return {
          ok: true,
          json: async () => ({ success: true, graph: mockTestGraph }),
        } as any;
      });

      render(<AdminOntologyExplorer initialGraph={mockTestGraph} projectKey="ALL" />);

      const reindexBtn = screen.getByTitle('문서 색인 갱신');
      fireEvent.click(reindexBtn);

      // Verify button recovers from reindexing state without fatal crash
      await waitFor(() => {
        expect(reindexBtn).not.toBeDisabled();
        expect(screen.getByText('동기화 갱신')).toBeInTheDocument();
      });

      // Explorer view remains stable and healthy
      expect(screen.getByText('문서 관계도')).toBeInTheDocument();

      fetchSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Section 3: WeeklyReportManager Wednesday Cycles, Aggregation & HWPX Flags
  // ==========================================================================
  describe('3. WeeklyReportManager Wednesday Batching, Aggregation & HWPX State Flags', () => {
    it('3-1. computes Wednesday cycle from initialDate="2026-11-11" and shifts weeks via buttons', async () => {
      let requestedDates: string[] = [];

      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input: any) => {
        const urlStr = typeof input === 'string' ? input : input.url;
        const match = urlStr.match(/date=([^&]+)/);
        if (match) {
          requestedDates.push(match[1]);
        }
        return {
          ok: true,
          json: async () => ({ success: true, currentReport: mockWeeklyReportFixture }),
        } as any;
      });

      render(<WeeklyReportManager initialDate="2026-11-11" />);

      // Verify date displayed
      expect(screen.getByText('2026-11-11')).toBeInTheDocument();

      // Click "이전 주 수요일" (<)
      const prevWeekBtn = screen.getByTitle('이전 주 수요일');
      fireEvent.click(prevWeekBtn);

      await waitFor(() => {
        expect(screen.getByText('2026-11-04')).toBeInTheDocument();
      });

      // Click "다음 주 수요일" (>) twice
      const nextWeekBtn = screen.getByTitle('다음 주 수요일');
      fireEvent.click(nextWeekBtn);
      fireEvent.click(nextWeekBtn);

      await waitFor(() => {
        expect(screen.getByText('2026-11-18')).toBeInTheDocument();
      });

      // Initial date, then shift -7 (11-04), then +7 (11-11), then +7 (11-18)
      expect(requestedDates).toContain('2026-11-11');
      expect(requestedDates).toContain('2026-11-04');
      expect(requestedDates).toContain('2026-11-18');

      fetchSpy.mockRestore();
    });

    it('3-2. executes task aggregation cycle and validates loading flags and status message', async () => {
      let resolveAggregate: any;
      const aggregatePromise = new Promise((resolve) => {
        resolveAggregate = resolve;
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input: any, init?: any) => {
        const urlStr = typeof input === 'string' ? input : input.url;
        if (init?.method === 'POST') {
          const body = JSON.parse(init.body);
          if (body.action === 'aggregate') {
            await aggregatePromise;
            return {
              ok: true,
              json: async () => ({
                success: true,
                report: mockWeeklyReportFixture,
              }),
            } as any;
          }
        }
        return {
          ok: true,
          json: async () => ({
            success: true,
            currentReport: { ...mockWeeklyReportFixture, items: [] },
          }),
        } as any;
      });

      render(<WeeklyReportManager initialDate="2026-11-11" />);

      // Wait for initial fetch to finish so aggregate button is enabled
      const aggregateBtn = screen.getByRole('button', { name: /태스크 집계/i });
      await waitFor(() => {
        expect(aggregateBtn).not.toBeDisabled();
      });

      fireEvent.click(aggregateBtn);

      // Verify button enters disabled state during aggregation
      await waitFor(() => {
        expect(aggregateBtn).toBeDisabled();
      });

      // Resolve the aggregate API promise
      act(() => {
        resolveAggregate();
      });

      // After completion: statusMessage updated, button re-enabled, items rendered
      await waitFor(() => {
        expect(screen.getByText('TASKS 실적 · 계획 자동 집계 완료')).toBeInTheDocument();
        expect(aggregateBtn).not.toBeDisabled();
      });

      // Check rendered items with flexible regex
      expect(screen.getByText(/체력측정 및 운동처방 520명 실시/i)).toBeInTheDocument();
      expect(screen.getByText(/코스 안내 5대 부스 시공 완료/i)).toBeInTheDocument();
      expect(screen.getByText(/2차 스마트 헬스케어 상담 진행/i)).toBeInTheDocument();

      fetchSpy.mockRestore();
    });

    it('3-3. manages HWPX generation cycle and verifies download state flags and Blob generation', async () => {
      let resolveHwpx: any;
      const hwpxPromise = new Promise((resolve) => {
        resolveHwpx = resolve;
      });

      const mockBlob = new Blob(['mock-hwpx-binary-stream'], {
        type: 'application/x-hwp+zip',
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input: any, init?: any) => {
        const urlStr = typeof input === 'string' ? input : input.url;
        if (init?.method === 'POST') {
          const body = JSON.parse(init.body);
          if (body.action === 'generate-hwpx') {
            await hwpxPromise;
            return {
              ok: true,
              blob: async () => mockBlob,
            } as any;
          }
        }
        return {
          ok: true,
          json: async () => ({
            success: true,
            currentReport: mockWeeklyReportFixture,
          }),
        } as any;
      });

      render(<WeeklyReportManager initialDate="2026-11-11" />);

      // Wait for initial report load
      await waitFor(() => {
        expect(screen.getByText(/체력측정 및 운동처방 520명 실시/i)).toBeInTheDocument();
      });

      const hwpxBtn = screen.getByRole('button', { name: /HWPX 다운/i });
      expect(hwpxBtn).not.toBeDisabled();

      fireEvent.click(hwpxBtn);

      // Verify button is disabled during generation
      await waitFor(() => {
        expect(hwpxBtn).toBeDisabled();
      });

      // Resolve HWPX generation
      act(() => {
        resolveHwpx();
      });

      // Verify state flag recovery & completion message
      await waitFor(() => {
        expect(screen.getByText('✅ 표준 2단 대조 HWPX 다운로드 완료')).toBeInTheDocument();
        expect(hwpxBtn).not.toBeDisabled();
        expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
        expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      });

      fetchSpy.mockRestore();
    });

    it('3-4. handles HWPX generation failure without fatal crash and resets downloading flag', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input: any, init?: any) => {
        const urlStr = typeof input === 'string' ? input : input.url;
        if (init?.method === 'POST') {
          const body = JSON.parse(init.body);
          if (body.action === 'generate-hwpx') {
            return {
              ok: false,
              status: 500,
            } as any;
          }
        }
        return {
          ok: true,
          json: async () => ({
            success: true,
            currentReport: mockWeeklyReportFixture,
          }),
        } as any;
      });

      render(<WeeklyReportManager initialDate="2026-11-11" />);

      await waitFor(() => {
        expect(screen.getByText(/체력측정 및 운동처방 520명 실시/i)).toBeInTheDocument();
      });

      const hwpxBtn = screen.getByRole('button', { name: /HWPX 다운/i });
      fireEvent.click(hwpxBtn);

      await waitFor(() => {
        expect(screen.getByText('HWPX 다운로드 실패')).toBeInTheDocument();
        expect(hwpxBtn).not.toBeDisabled();
      });

      fetchSpy.mockRestore();
    });

    it('3-5. supports interactive item deletion and addition preserving state consistency', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({
            success: true,
            currentReport: mockWeeklyReportFixture,
          }),
        } as any;
      });

      render(<WeeklyReportManager initialDate="2026-11-11" />);

      // Verify item exists
      await waitFor(() => {
        expect(screen.getByText(/코스 안내 5대 부스 시공 완료/i)).toBeInTheDocument();
      });

      // Click delete button for item
      const deleteButtons = screen.getAllByTitle('항목 삭제');
      expect(deleteButtons.length).toBeGreaterThan(0);
      fireEvent.click(deleteButtons[1]); // Delete second item

      // Item should be removed
      await waitFor(() => {
        expect(screen.queryByText(/코스 안내 5대 부스 시공 완료/i)).not.toBeInTheDocument();
      });

      fetchSpy.mockRestore();
    });
  });
});
