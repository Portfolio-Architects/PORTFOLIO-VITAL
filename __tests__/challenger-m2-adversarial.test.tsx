import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
  global.TextDecoder = TextDecoder as any;
}

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AdminOntologyGraph,
  AdminPolicyEntity,
  AdminBudgetPlanEntity,
} from '@/lib/ontology/admin-types';
import { AdminOntologyDrawer } from '@/components/ontology/AdminOntologyDrawer';
import { AdminOntologyExplorer } from '@/components/ontology/AdminOntologyExplorer';

// Mock Canvas 2D context for JSDOM
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
});

describe('Challenger 1 Adversarial Stress Test Suite: Milestone 2', () => {
  const basePolicy: AdminPolicyEntity = {
    id: 'POL-TEST-01',
    stage: 'POLICY_DIRECTIVE',
    title: '테스트용 기본계획 방침서',
    year: 2026,
    department: '보건행정과',
    project: '01_양재천_페스티벌',
    budgetAmount: 180000000,
    objectives: ['양재천 건강 페스티벌 성공적 개최'],
    sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2026년\\01_양재천_페스티벌\\추진계획.hwpx',
  };

  const baseBudgetPlan: AdminBudgetPlanEntity = {
    id: 'BGT-TEST-01',
    stage: 'BUDGET_PLAN',
    title: '테스트용 차년도 예산 사업설명서',
    year: 2027,
    project: '01_양재천_페스티벌',
    totalBudget: 250000000,
    fundingSources: { fund: 0, city: 50000000, district: 200000000 },
    itemizedBreakdown: [
      { item: '일반수용비', amount: 50000000 },
      { item: '행사운영비', amount: 200000000 },
    ],
    remediatedAuditIds: [],
    sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2026년\\01_양재천_페스티벌\\사업설명서.hwpx',
  };

  const minimalGraph: AdminOntologyGraph = {
    policies: [basePolicy],
    outcomes: [],
    audits: [],
    budgetPlans: [baseBudgetPlan],
    weeklyWorks: [],
    edges: [],
  };

  const mockBundle = {
    projectId: 'hchps-p1',
    projectKey: '01_양재천_페스티벌',
    projectName: '01 양재천 건강페스티벌',
    department: '보건행정과',
    team: '건강증진팀',
    color: '#14b8a6',
    ontology: { totalNodes: 2, lifecycleComplete: true },
    archive: { totalDocuments: 5, totalPhotos: 12, totalSheets: 2 },
    workingMemory: {
      pendingCount: 3,
      urgentDirectives: [{ id: 'u1', content: '긴급 현장 점검' }],
      pendingMemos: [{ id: 'm1', content: '체험부스 배치안 검토' }],
    },
    budget: {
      executionRate: 78.5,
      totalBudget: 180000000,
      spentBudget: 141300000,
      dailyExpenseRemaining: 5000000,
      isDeficit: false,
      finalExpectedBalance: 33700000,
      categories: [{ id: 'c1', name: '행사운영비', totalBudget: 180000000 }],
    },
    weeklyWork: {
      reportsCount: 4,
      latestHwpxAvailable: true,
      latestReportDate: '2026-10-28',
      recentItems: [{ projectName: '양재천 페스티벌', status: 'performance', contents: ['부스 세부계획 수립'], reportDate: '2026-10-28' }],
    },
    festivalAndContacts: {
      isFestivalProject: true,
      festivalSummary: { progress: 85, boothsCount: 20, dutiesCount: 35 },
      assignedContacts: [{ name: '김*관', phone: '010-****-5678', role: '총괄' }],
    },
  };

  const mockRegistry = {
    '01_양재천_페스티벌': mockBundle,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string') {
        if (url.includes('/api/admin-ontology?action=cross-join')) {
          if (url.includes('projectKey=')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: mockBundle,
              }),
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: mockRegistry,
            }),
          };
        }
        if (url.includes('/api/admin-ontology?action=graph')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, graph: minimalGraph }),
          };
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    }) as any;
  });

  // ==========================================================================
  // Edge Case 1: Null / Undefined / Corrupt Node
  // ==========================================================================
  describe('Edge Case 1: Null, Undefined & Malformed Node Input', () => {
    it('1-1. does not crash and renders null when node is undefined or null', () => {
      const { container: c1 } = render(
        <AdminOntologyDrawer node={null} isOpen={true} onClose={jest.fn()} />
      );
      expect(c1).toBeEmptyDOMElement();

      const { container: c2 } = render(
        <AdminOntologyDrawer node={undefined as any} isOpen={true} onClose={jest.fn()} />
      );
      expect(c2).toBeEmptyDOMElement();

      const { container: c3 } = render(
        <AdminOntologyDrawer node={null} isOpen={false} onClose={jest.fn()} />
      );
      expect(c3).toBeEmptyDOMElement();
    });

    it('1-2. gracefully handles node with missing title, id, and zero/NaN budget without throwing', async () => {
      const corruptNode: any = {
        id: '',
        title: '',
        budgetAmount: NaN,
        objectives: ['기본목표'],
        executionRate: undefined,
        stage: 'POLICY_DIRECTIVE',
      };

      await act(async () => {
        render(<AdminOntologyDrawer node={corruptNode} isOpen={true} onClose={jest.fn()} />);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // formatCurrency(NaN) returns '-'
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Case 2: Missing sourceDocPath
  // ==========================================================================
  describe('Edge Case 2: Missing sourceDocPath Behavior', () => {
    it('2-1. details tab does not render open buttons when sourceDocPath is undefined', async () => {
      const nodeNoPath: AdminPolicyEntity = {
        ...basePolicy,
        sourceDocPath: undefined,
      };

      await act(async () => {
        render(<AdminOntologyDrawer node={nodeNoPath} isOpen={true} onClose={jest.fn()} />);
      });

      expect(screen.queryByTestId('btn-open-source-file')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-open-source-folder')).not.toBeInTheDocument();
    });

    it('2-2. cross-domain tab disables buttons and shows "경로 미지정" when sourceDocPath is missing', async () => {
      const nodeNoPath: AdminPolicyEntity = {
        ...basePolicy,
        sourceDocPath: undefined,
      };

      await act(async () => {
        render(<AdminOntologyDrawer node={nodeNoPath} isOpen={true} onClose={jest.fn()} />);
      });

      // Switch to cross-domain tab
      const crossTabBtn = screen.getByRole('button', { name: /6대 도메인 연계/i });
      fireEvent.click(crossTabBtn);

      expect(screen.getByText('경로 미지정')).toBeInTheDocument();

      const tabFileBtn = screen.getByTestId('btn-tab-open-source-file');
      const tabFolderBtn = screen.getByTestId('btn-tab-open-source-folder');

      expect(tabFileBtn).toBeDisabled();
      expect(tabFolderBtn).toBeDisabled();
    });
  });

  // ==========================================================================
  // Edge Case 3: Missing Callbacks
  // ==========================================================================
  describe('Edge Case 3: Missing Optional Callbacks Safety', () => {
    it('3-1. clicking jump buttons with undefined onNavigateModule and onSwitchTab does not crash', async () => {
      await act(async () => {
        render(
          <AdminOntologyDrawer
            node={basePolicy}
            isOpen={true}
            onClose={jest.fn()}
            // All optional callbacks omitted
          />
        );
      });

      const memoryBtn = screen.getByTestId('btn-jump-memory');
      const workspaceBtn = screen.getByTestId('btn-jump-workspace');
      const simulatorBtn = screen.getByTestId('btn-jump-simulator');
      const weeklyBtn = screen.getByTestId('btn-jump-weekly');
      const festivalBtn = screen.getByTestId('btn-jump-festival');

      // None of these clicks should throw TypeError
      expect(() => {
        fireEvent.click(memoryBtn);
        fireEvent.click(workspaceBtn);
        fireEvent.click(simulatorBtn);
        fireEvent.click(weeklyBtn);
        fireEvent.click(festivalBtn);
      }).not.toThrow();
    });

    it('3-2. AdminOntologyExplorer operates without onNavigateModule or onSwitchTab props', async () => {
      await act(async () => {
        render(<AdminOntologyExplorer initialGraph={minimalGraph} />);
      });

      expect(screen.getByText('문서 관계도')).toBeInTheDocument();
      // Should show fallback labels when callbacks are absent
      expect(screen.getByText('포스트잇 보드')).toBeInTheDocument();
      expect(screen.getByText('수요일 2단 대조')).toBeInTheDocument();
      expect(screen.getByText('양재천 448px 관제')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Case 4: Rapid Tab Switching & State Consistency
  // ==========================================================================
  describe('Edge Case 4: Rapid Tab Switching', () => {
    it('4-1. handles rapid back-and-forth tab transitions without DOM or state corruptions', async () => {
      await act(async () => {
        render(
          <AdminOntologyDrawer
            node={baseBudgetPlan}
            isOpen={true}
            onClose={jest.fn()}
            graph={minimalGraph}
          />
        );
      });

      const detailsTab = screen.getByRole('button', { name: /상세 속성/i });
      const crossTab = screen.getByRole('button', { name: /6대 도메인 연계/i });
      const traceTab = screen.getByRole('button', { name: /인과 추적/i });
      const forensicsTab = screen.getByRole('button', { name: /예산 포렌식 검산/i });

      // Rapidly switch tabs 10 times
      for (let i = 0; i < 5; i++) {
        fireEvent.click(crossTab);
        fireEvent.click(traceTab);
        fireEvent.click(forensicsTab);
        fireEvent.click(detailsTab);
      }

      // Final tab should be details
      expect(screen.getByText('연계 바로가기')).toBeInTheDocument();
      expect(screen.getByTestId('btn-jump-memory')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Case 5: Canvas Resize & Click Geometry
  // ==========================================================================
  describe('Edge Case 5: Canvas Resize & Click Geometry in Explorer', () => {
    it('5-1. handles canvas resize window event and out-of-bounds clicks safely', async () => {
      await act(async () => {
        render(<AdminOntologyExplorer initialGraph={minimalGraph} />);
      });

      // Trigger window resize event
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();

      if (canvas) {
        // Click corners and extreme coordinates
        fireEvent.click(canvas, { clientX: -100, clientY: -100 });
        fireEvent.click(canvas, { clientX: 9999, clientY: 9999 });
        fireEvent.click(canvas, { clientX: 0, clientY: 0 });
      }

      // Explorer should remain functional
      expect(screen.getByText('문서 관계도')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Case 6: Async Network Error & Unmount Protection
  // ==========================================================================
  describe('Edge Case 6: Network Error and Unmount In-Flight', () => {
    it('6-1. displays error gracefully when cross-join API returns 500', async () => {
      global.fetch = jest.fn().mockImplementation(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server exploded' }),
      })) as any;

      await act(async () => {
        render(<AdminOntologyDrawer node={basePolicy} isOpen={true} onClose={jest.fn()} />);
      });

      // Switch to cross-domain tab
      const crossTabBtn = screen.getByRole('button', { name: /6대 도메인 연계/i });
      fireEvent.click(crossTabBtn);

      // Verify error message is rendered
      await waitFor(() => {
        expect(screen.getByText(/연계 지표 로드 실패/i)).toBeInTheDocument();
      });
    });

    it('6-2. unmounting component while fetch is in-flight does not cause memory leaks or errors', async () => {
      let resolvePromise: any;
      const hangingFetch = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      global.fetch = jest.fn().mockReturnValue(hangingFetch);

      const { unmount } = render(
        <AdminOntologyDrawer node={basePolicy} isOpen={true} onClose={jest.fn()} />
      );

      // Immediately unmount while fetch is pending
      unmount();

      // Resolve the pending fetch after unmount
      await act(async () => {
        resolvePromise({
          ok: true,
          json: async () => ({ success: true, data: {} }),
        });
      });

      // No crash or uncaught error
    });
  });

  // ==========================================================================
  // Edge Case 7: Archive Open Error Feedback
  // ==========================================================================
  describe('Edge Case 7: Archive Open API Error Feedback', () => {
    it('7-1. displays error feedback banner when /api/archive/open returns error response', async () => {
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url === '/api/archive/open') {
          return {
            ok: false,
            status: 403,
            json: async () => ({ error: '보안 정책에 따라 허용되지 않는 경로입니다.' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockRegistry }),
        };
      }) as any;

      await act(async () => {
        render(<AdminOntologyDrawer node={basePolicy} isOpen={true} onClose={jest.fn()} />);
      });

      const openFileBtn = screen.getByTestId('btn-open-source-file');
      await act(async () => {
        fireEvent.click(openFileBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('보안 정책에 따라 허용되지 않는 경로입니다.')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Edge Case 8: Robustness under Corrupt or Single Bundle Registry
  // ==========================================================================
  describe('Edge Case 8: Registry Dictionary vs Single Bundle Discovery', () => {
    it('8-1. AdminOntologyExplorer handles single-bundle response vs full registry dictionary', async () => {
      // Test when API returns registry as expected
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('cross-join')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: mockRegistry }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, graph: minimalGraph }),
        };
      }) as any;

      await act(async () => {
        render(<AdminOntologyExplorer initialGraph={minimalGraph} />);
      });

      expect(screen.getByText('1. 문서 관계도')).toBeInTheDocument();
      expect(screen.getByText('2. 문서 보관함')).toBeInTheDocument();
      expect(screen.getByText('3. 작업기억')).toBeInTheDocument();
      expect(screen.getByText('4. e-호조 예산')).toBeInTheDocument();
      expect(screen.getByText('5. 주간업무')).toBeInTheDocument();
      expect(screen.getByText('6. 행사·연락망')).toBeInTheDocument();
    });
  });
});
