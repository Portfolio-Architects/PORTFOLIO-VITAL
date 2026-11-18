import { TextEncoder, TextDecoder } from 'util';

// Polyfills for JSDOM
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

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminOntologyExplorer } from '@/components/ontology/AdminOntologyExplorer';
import { AdminOntologyDrawer } from '@/components/ontology/AdminOntologyDrawer';
import { ArchiveExplorerView } from '@/components/archive/ArchiveExplorerView';
import { AdminEntity, AdminPolicyEntity, AdminBudgetPlanEntity } from '@/lib/ontology/admin-types';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Canvas 2D
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

describe('Challenger 2 Empirical Cross-Component Null-Safety Stress Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. AdminOntologyExplorer Null-Safety & Degraded Data Tests', () => {
    it('1-1. renders safely with completely empty registry {} without crashing or NaN', async () => {
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/admin-ontology?action=cross-join')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: {} }),
          };
        }
        if (url.includes('/api/admin-ontology?action=graph')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                policies: [],
                outcomes: [],
                audits: [],
                budgetPlans: [],
                weeklyWorks: [],
                edges: [],
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      });

      let container: HTMLElement | undefined;
      await act(async () => {
        const res = render(<AdminOntologyExplorer />);
        container = res.container;
      });

      expect(container).toBeDefined();
      expect(screen.getByText('행정 문서·업무 온톨로지 양방향 탐색기')).toBeInTheDocument();
      expect(screen.getByText('전체 사업 (9개)')).toBeInTheDocument();
      expect(screen.getByText('0건 연계')).toBeInTheDocument();
      expect(screen.getByText('미반영 0건')).toBeInTheDocument();
    });

    it('1-2. renders safely when registry contains nulls, undefineds, and empty objects', async () => {
      const corruptRegistry = {
        'PROJ_NULL': null,
        'PROJ_EMPTY': {},
        'PROJ_PARTIAL_1': {
          workingMemory: null,
          budget: undefined,
          archive: null,
          weeklyWork: undefined,
          festivalAndContacts: null,
        },
        'PROJ_PARTIAL_2': {
          workingMemory: { pendingCount: 5 }, // missing urgentDirectives
          budget: { totalBudget: 10000000, executionRate: 50.0 }, // missing spentBudget
          archive: { totalDocuments: 2 },      // missing totalPhotos & totalSheets
          weeklyWork: {},                     // missing reportsCount
          festivalAndContacts: {},            // missing assignedContacts
        },
      };

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/admin-ontology?action=cross-join')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: corruptRegistry }),
          };
        }
        if (url.includes('/api/admin-ontology?action=graph')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                policies: [],
                outcomes: [],
                audits: [],
                budgetPlans: [],
                weeklyWorks: [],
                edges: [],
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      });

      await act(async () => {
        render(<AdminOntologyExplorer />);
      });

      // Verify enterprise summary does not crash and handles total calculations safely
      expect(screen.getByText('전체 사업 (9개)')).toBeInTheDocument();
      // Verify memos rendered safely
      expect(screen.getByText('미반영 5건')).toBeInTheDocument();
    });

    it('1-3. clicking a project chip with a partial bundle does not throw TypeError', async () => {
      const partialRegistry: any = {
        '01_양재천_페스티벌': {
          projectId: 'p1',
          projectKey: '01_양재천_페스티벌',
          projectName: '01 양재천 건강페스티벌',
          // completely missing ontology, archive, workingMemory, budget, weeklyWork, festivalAndContacts
        },
      };

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/admin-ontology?action=cross-join')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: partialRegistry }),
          };
        }
        if (url.includes('/api/admin-ontology?action=graph')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                policies: [],
                outcomes: [],
                audits: [],
                budgetPlans: [],
                weeklyWorks: [],
                edges: [],
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      });

      await act(async () => {
        render(<AdminOntologyExplorer />);
      });

      const projectChip = screen.getByRole('button', { name: '01 양재천 건강페스티벌' });
      await act(async () => {
        fireEvent.click(projectChip);
      });

      // Assert project chip selected without unhandled exception
      expect(projectChip).toHaveClass('font-bold');
      expect(screen.getByText('미반영 0건')).toBeInTheDocument();
    });

    it('1-4. graph with undefined collection arrays is handled gracefully', async () => {
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/admin-ontology?action=cross-join')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: {} }),
          };
        }
        if (url.includes('/api/admin-ontology?action=graph')) {
          return {
            ok: true,
            status: 200,
            // graph with undefined arrays
            json: async () => ({
              success: true,
              data: {
                policies: undefined,
                outcomes: undefined,
                audits: undefined,
                budgetPlans: undefined,
                weeklyWorks: undefined,
                edges: undefined,
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      });

      let container: HTMLElement | undefined;
      await act(async () => {
        const res = render(<AdminOntologyExplorer />);
        container = res.container;
      });

      expect(container).toBeDefined();
      expect(screen.getByText('전체 단계 (0)')).toBeInTheDocument();
    });
  });

  describe('2. AdminOntologyDrawer Null-Safety & Fallback Tests', () => {
    it('2-1. handles minimal node with missing optional fields safely', async () => {
      const minimalNode: AdminEntity = {
        id: 'MIN-01',
        stage: 'POLICY_DIRECTIVE',
        title: '초소형 방침서',
        year: 2026,
        department: '행정과',
        project: '테스트',
      } as any;

      global.fetch = jest.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: null }),
      }));

      await act(async () => {
        render(
          <AdminOntologyDrawer
            isOpen={true}
            node={minimalNode}
            onClose={jest.fn()}
          />
        );
      });

      expect(screen.getByText('초소형 방침서')).toBeInTheDocument();
      expect(screen.getByText('MIN-01')).toBeInTheDocument();
    });

    it('2-2. handles partial bundle where workingMemory and budget are empty objects, and forensic tab works on budgetPlan', async () => {
      const testBudgetPlan: AdminBudgetPlanEntity = {
        id: 'BGT-DEF-1',
        stage: 'BUDGET_PLAN',
        title: '방어 테스트 사업설명서',
        year: 2027,
        project: '01_양재천_페스티벌',
        totalBudget: 150000000,
        fundingSources: { fund: 0, city: 50000000, district: 100000000 },
        itemizedBreakdown: [
          { item: '일반수용비', amount: 50000000 },
        ],
        remediatedAuditIds: [],
      };

      const emptyBundle = {
        projectId: 'p1',
        projectKey: '01_양재천_페스티벌',
        workingMemory: {}, // missing pendingCount, urgentDirectives
        budget: {},        // missing executionRate, totalBudget, spentBudget
        archive: {},
        weeklyWork: {},
        festivalAndContacts: {},
      };

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/admin-ontology?action=cross-join')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: emptyBundle }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      });

      await act(async () => {
        render(
          <AdminOntologyDrawer
            isOpen={true}
            node={testBudgetPlan}
            onClose={jest.fn()}
          />
        );
      });

      expect(screen.getByText('방어 테스트 사업설명서')).toBeInTheDocument();

      // Click on Forensic tab to test (node.totalBudget ?? 0).toLocaleString()
      const forensicTab = screen.getByRole('button', { name: /예산 포렌식 검산/i });
      await act(async () => {
        fireEvent.click(forensicTab);
      });

      expect(screen.getByText('Rule R: 0원 오차 수리적 무결성 점검')).toBeInTheDocument();
      expect(screen.getAllByText(/150,000,000/).length).toBeGreaterThan(0);
    });

    it('2-3. action buttons do not crash when callbacks (onNavigateModule, onSwitchTab) are omitted', async () => {
      const testNode: AdminEntity = {
        id: 'NODE-01',
        stage: 'POLICY_DIRECTIVE',
        title: '콜백 누락 테스트 노드',
        year: 2026,
        department: '보건행정과',
        project: '01_양재천_페스티벌',
        sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2026년\\test.hwpx',
      } as any;

      global.fetch = jest.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      }));

      await act(async () => {
        render(
          <AdminOntologyDrawer
            isOpen={true}
            node={testNode}
            onClose={jest.fn()}
            // onNavigateModule and onSwitchTab are intentionally omitted
          />
        );
      });

      // Quick access buttons in details tab
      const jumpMemoryBtn = screen.getByTestId('btn-jump-memory');
      const jumpWeeklyBtn = screen.getByTestId('btn-jump-weekly');
      const jumpSimulatorBtn = screen.getByTestId('btn-jump-simulator');

      // Click all without throwing
      expect(() => {
        fireEvent.click(jumpMemoryBtn);
        fireEvent.click(jumpWeeklyBtn);
        fireEvent.click(jumpSimulatorBtn);
      }).not.toThrow();
    });
  });

  describe('3. ArchiveExplorerView Cross-Domain Null-Safety Tests', () => {
    it('3-1. renders right-hand panel safely with empty cross-domain registry {}', async () => {
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/admin-ontology?action=cross-join')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: {} }),
          };
        }
        if (url.includes('/api/archive')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              totalIndexed: 42,
              items: [
                {
                  id: 'DOC-1',
                  filename: 'test.hwpx',
                  relativePath: '2026/test.hwpx',
                  absolutePath: 'F:\\_Organized_Archive\\2026\\test.hwpx',
                  size: 1024,
                  extension: 'hwpx',
                  year: 2026,
                  project: '01_양재천_페스티벌',
                  category: '보고서',
                  confidence: 1.0,
                  metadata: {},
                },
              ],
              facets: { years: {}, projects: {}, categories: {}, extensions: {} },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      });

      await act(async () => {
        render(<ArchiveExplorerView />);
      });

      // Right-hand panel should show default fallback stats
      expect(screen.getByText('6대 도메인 라이브 연계 현황')).toBeInTheDocument();
      expect(screen.getByText('미반영 메모 0건')).toBeInTheDocument();
      expect(screen.getByText('0.0억원')).toBeInTheDocument();
    });

    it('3-2. handles active bundle with null/empty nested domain fields', async () => {
      const corruptRegistry = {
        '01_양재천_페스티벌': {
          projectId: 'p1',
          projectKey: '01_양재천_페스티벌',
          projectName: '01 양재천 건강페스티벌',
          department: '보건행정과',
          ontology: null,
          archive: null,
          workingMemory: null,
          budget: null,
          weeklyWork: null,
          festivalAndContacts: null,
        },
      };

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/admin-ontology?action=cross-join')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: corruptRegistry }),
          };
        }
        if (url.includes('/api/archive')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              totalIndexed: 10,
              items: [
                {
                  id: 'DOC-1',
                  filename: 'test.hwpx',
                  relativePath: '2026/test.hwpx',
                  absolutePath: 'F:\\_Organized_Archive\\2026\\test.hwpx',
                  size: 1024,
                  extension: 'hwpx',
                  year: 2026,
                  project: '01_양재천_페스티벌',
                  category: '보고서',
                  confidence: 1.0,
                  metadata: {},
                },
              ],
              facets: { years: {}, projects: {}, categories: {}, extensions: {} },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      });

      await act(async () => {
        render(<ArchiveExplorerView />);
      });

      // Right-hand panel should safely fallback to 0건 색인, 미반영 메모 0건, 0.0억원
      expect(screen.getByText(/0건 색인/)).toBeInTheDocument();
      expect(screen.getByText(/미반영 메모 0건/)).toBeInTheDocument();
      expect(screen.getByText(/누적 0건/)).toBeInTheDocument();
    });

    it('3-3. clicking all jump buttons on degraded bundle with omitted onNavigateModule does not throw', async () => {
      const degradedRegistry = {
        '01_양재천_페스티벌': {
          projectId: 'p1',
          projectKey: '01_양재천_페스티벌',
          projectName: '01 양재천 건강페스티벌',
          department: '보건행정과',
          workingMemory: { pendingCount: 0 },
          budget: { totalBudget: 0, executionRate: 0 },
        },
      };

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/admin-ontology?action=cross-join')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: degradedRegistry }),
          };
        }
        if (url.includes('/api/archive')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              totalIndexed: 5,
              items: [
                {
                  id: 'DOC-1',
                  filename: 'test.hwpx',
                  relativePath: '2026/test.hwpx',
                  absolutePath: 'F:\\_Organized_Archive\\2026\\test.hwpx',
                  size: 1024,
                  extension: 'hwpx',
                  year: 2026,
                  project: '01_양재천_페스티벌',
                  category: '보고서',
                  confidence: 1.0,
                  metadata: {},
                },
              ],
              facets: { years: {}, projects: {}, categories: {}, extensions: {} },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      });

      await act(async () => {
        // onNavigateModule is undefined
        render(<ArchiveExplorerView onNavigateModule={undefined} />);
      });

      const jumpButtons = screen.getAllByRole('button', { name: /이동|전환|조회|보기/i });
      expect(() => {
        jumpButtons.forEach((btn) => fireEvent.click(btn));
      }).not.toThrow();
    });
  });
});
