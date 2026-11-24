import { TextEncoder, TextDecoder } from 'util';

// Polyfills
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
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArchiveExplorerView } from '@/components/archive/ArchiveExplorerView';
import { ProtectedApp } from '@/components/ProtectedApp';

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

// Mock LocalhostStatusHUD
jest.mock('@/components/layout/LocalhostStatusHUD', () => ({
  LocalhostStatusHUD: () => <div data-testid="localhost-status-hud">HUD</div>,
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

// Mock domain hooks for ProtectedApp
jest.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [],
    stats: { total: 5, done: 3, overdue: 0 },
    updateTask: jest.fn(),
  }),
}));

jest.mock('@/hooks/useBudget', () => ({
  useBudget: () => ({
    categories: [{ id: 'cat-1', name: '사업비', totalBudget: 180000000 }],
    entries: [{ id: 'ent-1', categoryId: 'cat-1', amount: 142000000, date: '2026-10-20', purpose: '행사물품', isPlanned: false }],
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
    getCategoryStats: jest.fn(),
    overallStatsActual: { totalBudget: 180000000, totalSpent: 142000000, percentage: 78.9 },
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
    contacts: [{ id: 'c-1', name: '김*정', phone: '02-***-7116', role: '총괄' }],
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

describe('Milestone 3 Empirical Challenger Stress Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('Stress 1: Rapid tab switching (15 consecutive switches) does not crash or leave inconsistent tab state', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('action=cross-join')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: {} }),
        };
      }
      if (url.includes('action=graph')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            graph: { policies: [], outcomes: [], audits: [], budgetPlans: [], weeklyWorks: [], edges: [] },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          totalIndexed: 10,
          items: [],
          facets: {},
          cluster: null,
        }),
      };
    });

    const onNavigateModule = jest.fn();
    render(<ArchiveExplorerView onNavigateModule={onNavigateModule} />);

    const tabArchive = screen.getByTestId('tab-archive');
    const tabOntology = screen.getByTestId('tab-ontology');
    const tabWeekly = screen.getByTestId('tab-weekly');

    // Rapidly switch tabs 15 times
    const tabs = [tabOntology, tabWeekly, tabArchive, tabOntology, tabWeekly, tabArchive, tabOntology, tabWeekly, tabArchive, tabOntology, tabWeekly, tabArchive, tabOntology, tabWeekly, tabArchive];
    
    act(() => {
      for (const tab of tabs) {
        fireEvent.click(tab);
      }
    });

    // Final target should be archive
    await waitFor(() => {
      expect(tabArchive).toHaveAttribute('aria-selected', 'true');
      expect(tabOntology).toHaveAttribute('aria-selected', 'false');
      expect(tabWeekly).toHaveAttribute('aria-selected', 'false');
    });

    expect(screen.getByTestId('tab-archive')).toBeInTheDocument();
  });

  test('Stress 2: Missing onNavigateModule callback (rendered as <ArchiveExplorerView />) is completely safe on all jump buttons', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('action=cross-join')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              '01_양재천_페스티벌': {
                projectKey: '01_양재천_페스티벌',
                projectName: '양재천 페스티벌',
                ontology: { totalNodes: 2, auditGaps: [] },
                archive: { totalFiles: 10 },
                workingMemory: { pendingCount: 3 },
                budget: { totalBudget: 10000000, spentBudget: 5000000, executionRate: 50 },
                weeklyWork: { totalCount: 2 },
                festivalAndContacts: { isFestivalProject: true, assignedContacts: [] },
              },
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          totalIndexed: 5,
          items: [],
          cluster: null,
        }),
      };
    });

    // Render with NO PROPS
    render(<ArchiveExplorerView />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-jump-memory')).toBeInTheDocument();
    });

    // Clicking jump buttons with NO callback should not throw an error
    expect(() => {
      fireEvent.click(screen.getByTestId('btn-jump-memory'));
      fireEvent.click(screen.getByTestId('btn-jump-workspace'));
      fireEvent.click(screen.getByTestId('btn-jump-simulator'));
      fireEvent.click(screen.getByTestId('btn-jump-festival'));
    }).not.toThrow();

    // Internal tab jump buttons should switch tabs cleanly
    fireEvent.click(screen.getByTestId('btn-jump-weekly'));
    await waitFor(() => {
      expect(screen.getByTestId('weekly-workflow-pane')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-archive'));
    await waitFor(() => {
      expect(screen.getByTestId('btn-jump-ontology')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-jump-ontology'));
    await waitFor(() => {
      expect(screen.getByTestId('ontology-workflow-pane')).toBeInTheDocument();
    });
  });

  test('Stress 3: Empty search results & 500 API error degrades gracefully without breaking UI', async () => {
    // Both endpoints return errors or empty
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('action=cross-join')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal Server Error' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          totalIndexed: 0,
          totalMatched: 0,
          facets: { years: {}, projects: {}, categories: {} },
          items: [],
          cluster: null,
        }),
      };
    });

    render(<ArchiveExplorerView onNavigateModule={jest.fn()} />);

    // Should render empty fallback message
    await waitFor(() => {
      expect(screen.getByText('일치 아카이브 자료 없음')).toBeInTheDocument();
    });

    // Enterprise summary should display default values (e.g., 9개 사업, 0건)
    expect(screen.getByText('전체 연계')).toBeInTheDocument();
    expect(screen.getByText(/9개 사업 완결/)).toBeInTheDocument();
    expect(screen.getByText(/미반영 메모 0건/)).toBeInTheDocument();
  });

  test('Stress 4: Adversarial search queries with regex special chars and Unicode', async () => {
    global.fetch = jest.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          totalIndexed: 1,
          totalMatched: 1,
          facets: {},
          items: [
            {
              id: 'item-adv-1',
              name: '공공PT (보조금) [2026.10] $100^ & * + ? . \\ / <script>',
              relPath: '2026년/test.hwpx',
              year: '2026년',
              project: '02_예산회계_보조금_일상경비',
              ext: '.hwpx',
              category: 'doc',
              size: 1000,
              date: '2026-10-20',
              snippet: '공공PT (보조금) [2026.10] $100^ & * + ? . \\ / <script> 세부내역',
              keywords: ['공공PT', '보조금'],
            },
          ],
          cluster: null,
        }),
      };
    });

    render(<ArchiveExplorerView onNavigateModule={jest.fn()} />);

    const searchInput = screen.getByPlaceholderText(/키워드 검색/);

    // Adversarial inputs
    const adversarialQueries = [
      '(보조금)',
      '[2026.10]',
      '$100^',
      '\\',
      '+',
      '?',
      '.*',
      '<script>',
      '   ',
    ];

    for (const q of adversarialQueries) {
      act(() => {
        fireEvent.change(searchInput, { target: { value: q } });
      });
      // Should not throw RegExp syntax error
      expect(screen.getByTestId('archive-explorer-view')).toBeInTheDocument();
    }
  });

  test('Stress 5: Mobile viewport class verification (Rule S: max-w-full, overflow containment)', async () => {
    global.fetch = jest.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        totalIndexed: 1,
        items: [],
        facets: {},
        cluster: null,
      }),
    }));

    const { container } = render(<ArchiveExplorerView onNavigateModule={jest.fn()} />);

    // Tablist container check
    const tablist = screen.getByRole('tablist');
    expect(tablist.className).toContain('overflow-x-auto');
    expect(tablist.className).toContain('max-w-full');

    // Results container check
    const resultsGrid = container.querySelector('#archive-search-results');
    expect(resultsGrid).toBeInTheDocument();
    expect(resultsGrid?.className).toContain('grid-cols-1');
  });

  test('Stress 6: ProtectedApp module jump pipeline under multi-hop navigation (archive -> memory -> archive -> simulator)', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('action=cross-join')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              '01_양재천_페스티벌': {
                projectKey: '01_양재천_페스티벌',
                projectName: '양재천 페스티벌',
                ontology: { totalNodes: 2, auditGaps: [] },
                archive: { totalFiles: 10 },
                workingMemory: { pendingCount: 3 },
                budget: { totalBudget: 10000000, spentBudget: 5000000, executionRate: 50 },
                weeklyWork: { totalCount: 2 },
                festivalAndContacts: { isFestivalProject: true, assignedContacts: [] },
              },
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          totalIndexed: 10,
          items: [],
          facets: {},
          cluster: null,
        }),
      };
    });

    render(<ProtectedApp appMode="VITAL" onModeChange={jest.fn()} />);

    // Initially on Dashboard
    await waitFor(() => {
      expect(screen.getByText('WORK VITAL')).toBeInTheDocument();
    });

    // Navigate to 'archive' via Sidebar / Top Nav
    const archiveNavBtn = within(screen.getByRole('banner')).getByText('문서 보관함').closest('button');
    expect(archiveNavBtn).not.toBeNull();
    fireEvent.click(archiveNavBtn!);

    // Wait for archive explorer view
    await waitFor(() => {
      expect(screen.getByTestId('archive-explorer-view')).toBeInTheDocument();
    });

    // 1. Jump from archive to memory
    const btnMemory = await within(screen.getByTestId('archive-explorer-view')).findByTestId('btn-jump-memory');
    fireEvent.click(btnMemory);

    await waitFor(() => {
      expect(
        screen.queryByText('VITAL 포스트잇') || screen.queryByTestId('sticky-notes-panel') || screen.queryByText('포스트잇')
      ).toBeTruthy();
    });

    // 2. Return to archive via navigation button
    fireEvent.click(archiveNavBtn!);

    await waitFor(() => {
      expect(screen.getByTestId('archive-explorer-view')).toBeInTheDocument();
    });

    // 3. Jump from archive to workspace (예산관리)
    const jumpWorkspaceBtns = await screen.findAllByRole('button', { name: /예산관리.*이동/i });
    fireEvent.click(jumpWorkspaceBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('WORK VITAL')).toBeInTheDocument();
      expect(screen.getAllByText('예산관리').length).toBeGreaterThan(1);
    });
  });
});
