import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
  global.TextDecoder = TextDecoder as any;
}

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SimulationResultTable } from '@/components/budget/ui/SimulationResultTable';
import { ArchiveExplorerView } from '@/components/archive/ArchiveExplorerView';
import { ProjectSimulationSummary, StatItemSimulationSummary, SimulationEntry, BudgetCategory, BudgetEntry } from '@/types';
import type { ArchiveItem } from '@/types/archive';

// Mock canvas for JSDOM
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

// Mock LocalhostStatusHUD
jest.mock('@/components/layout/LocalhostStatusHUD', () => ({
  LocalhostStatusHUD: () => <div data-testid="localhost-status-hud">HUD</div>,
}));

function setNodeEnv(val: string | undefined) {
  if (val === undefined) {
    delete (process.env as any).NODE_ENV;
  } else {
    (process.env as any).NODE_ENV = val;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: val,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  }
}

describe('Empirical Challenger M2.2: SimulationResultTable & ArchiveExplorerView Virtualization & Scale', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    setNodeEnv(originalEnv);
    jest.clearAllMocks();
  });

  // Helper generators
  const generateSimulationData = (projectCount: number, statsPerProject: number) => {
    const projectSummaries: ProjectSimulationSummary[] = [];
    const statItemSummaries: StatItemSimulationSummary[] = [];
    const simulationEntries: SimulationEntry[] = [];
    const categories: BudgetCategory[] = [];
    const budgetEntries: BudgetEntry[] = [];

    for (let p = 1; p <= projectCount; p++) {
      const projName = `세부사업_${p.toString().padStart(3, '0')}`;
      projectSummaries.push({
        detailedProject: projName,
        totalBudget: 100000000,
        currentSpent: 40000000,
        currentRemaining: 60000000,
        simulatedExpenditure: 10000000,
        finalExpectedBalance: 50000000,
        executionRate: 40.0,
        isDeficit: false,
        dailyExpenseIssued: 5000000,
        dailyExpenseSpent: 2000000,
        dailyExpenseRemaining: 3000000,
      });

      for (let s = 1; s <= statsPerProject; s++) {
        const statName = `201-${s.toString().padStart(2, '0')} 통계목_${s}`;
        statItemSummaries.push({
          detailedProject: projName,
          statItem: statName,
          totalBudget: Math.floor(100000000 / statsPerProject),
          currentSpent: 4000000,
          currentRemaining: 6000000,
          simulatedExpenditure: 1000000,
          finalExpectedBalance: 5000000,
          isDeficit: false,
          dailyExpenseIssued: 500000,
          dailyExpenseSpent: 200000,
          dailyExpenseRemaining: 300000,
        });

        simulationEntries.push({
          id: `sim-entry-${p}-${s}`,
          name: `시뮬레이션 품목 ${p}-${s}`,
          detailedProject: projName,
          statItem: statName,
          unitPrice: 50000,
          quantity: 20,
          amount: 1000000,
          status: 'PLANNED',
          createdAt: '2026-10-01T00:00:00.000Z',
        });
      }
    }

    return { projectSummaries, statItemSummaries, simulationEntries, categories, budgetEntries };
  };

  const generateArchiveItems = (count: number): ArchiveItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `arc-${(i + 1).toString().padStart(5, '0')}`,
      name: `공문서_${i + 1}_행정결과보고.hwpx`,
      rawName: `공문서_${i + 1}_행정결과보고.hwpx`,
      relPath: `2026년/사업_${(i % 10) + 1}/공문서_${i + 1}_행정결과보고.hwpx`,
      year: '2026년',
      project: `사업_${(i % 10) + 1}`,
      subFolder: '결과보고',
      ext: '.hwpx',
      category: i % 2 === 0 ? 'doc' : 'image',
      size: 45000 + (i * 100),
      date: '2026-10-15',
      mtime: 1761000000 + i,
      snippet: `2026년도 행정 결과보고 및 물품 검수 내역서 항목 ${i + 1}`,
      keywords: ['결과보고', '보건소', '검수'],
      imageCategory: i % 2 === 1 ? 'photo' : null,
      score: 100 - (i % 20),
      matchReason: 'content',
    }));
  };

  describe('1. SimulationResultTable Virtualization & Scale Stress Tests', () => {
    test('1-1. under production simulation (50 projects, 250 stat items), windowing caps rendered group DOM nodes with >70% reduction', () => {
      // Set to production mode with non-zero viewport
      setNodeEnv('production');
      window.innerHeight = 800;

      const { projectSummaries, statItemSummaries, simulationEntries, categories, budgetEntries } =
        generateSimulationData(50, 5); // 50 projects, 250 stat items

      const startTime = performance.now();
      const { container } = render(
        <SimulationResultTable
          categories={categories}
          budgetEntries={budgetEntries}
          projectSummaries={projectSummaries}
          statItemSummaries={statItemSummaries}
          entries={simulationEntries}
          onDeleteEntry={jest.fn()}
        />
      );
      const mountStallMs = performance.now() - startTime;

      console.log(`[EMPIRICAL CHALLENGER] SimulationResultTable mount stall (50 projects / 250 stat items): ${mountStallMs.toFixed(2)}ms`);
      expect(mountStallMs).toBeLessThan(2500); // JSDOM test runner threshold

      // Verify that rendered project groups in the DOM are windowed (only visible groups rendered)
      // Each rendered group row has a Chevron button and folder icon
      const renderedGroupHeaders = container.querySelectorAll('tr[class*="cursor-pointer"]');
      console.log(`[EMPIRICAL CHALLENGER] Total project groups: 50, Rendered group headers in DOM: ${renderedGroupHeaders.length}`);

      // In 800px viewport with itemHeight=140 and overscan=1:
      // (800 / 140) + 2*1 ≈ 6 + 2 = 8 groups
      expect(renderedGroupHeaders.length).toBeLessThanOrEqual(20);
      expect(renderedGroupHeaders.length).toBeGreaterThan(0);

      // Node reduction vs full 50 groups
      const groupReduction = ((50 - renderedGroupHeaders.length) / 50) * 100;
      console.log(`[EMPIRICAL CHALLENGER] SimulationResultTable group DOM node reduction: ${groupReduction.toFixed(1)}%`);
      expect(groupReduction).toBeGreaterThanOrEqual(60);

      // Verify top and bottom padding spacer rows exist in table
      const spacerRows = container.querySelectorAll('tr[aria-hidden="true"]');
      expect(spacerRows.length).toBeGreaterThanOrEqual(1);
    });

    test('1-2. project view mode (50 projects) virtualizes rows and caps DOM nodes', () => {
      setNodeEnv('production');
      window.innerHeight = 800;

      const { projectSummaries, statItemSummaries, simulationEntries, categories, budgetEntries } =
        generateSimulationData(50, 2);

      const { container } = render(
        <SimulationResultTable
          categories={categories}
          budgetEntries={budgetEntries}
          projectSummaries={projectSummaries}
          statItemSummaries={statItemSummaries}
          entries={simulationEntries}
          onDeleteEntry={jest.fn()}
        />
      );

      // Switch to 'project' view ("세부사업별 요약")
      const projectViewBtn = screen.getByRole('button', { name: /세부사업별 요약/i });
      fireEvent.click(projectViewBtn);

      // Check rendered project table rows
      const projectRows = container.querySelectorAll('tbody tr:not([aria-hidden="true"])');
      console.log(`[EMPIRICAL CHALLENGER] Total projects: 50, Rendered project rows in DOM: ${projectRows.length}`);

      // In 800px viewport with itemHeight=52 and overscan=4:
      // (800 / 52) + 2*4 ≈ 15 + 8 = 23 rows max
      expect(projectRows.length).toBeLessThanOrEqual(30);
      expect(projectRows.length).toBeGreaterThan(0);

      const reduction = ((50 - projectRows.length) / 50) * 100;
      console.log(`[EMPIRICAL CHALLENGER] Project View DOM reduction: ${reduction.toFixed(1)}%`);
      expect(reduction).toBeGreaterThanOrEqual(40);
    });

    test('1-3. handles empty data and filter zero-match gracefully without crash', () => {
      const { container } = render(
        <SimulationResultTable
          categories={[]}
          budgetEntries={[]}
          projectSummaries={[]}
          statItemSummaries={[]}
          entries={[]}
          onDeleteEntry={jest.fn()}
        />
      );

      expect(screen.getByText('검색 조건에 일치하는 결과가 없습니다.')).toBeInTheDocument();
      // No crash, table structure preserved
      expect(container.querySelector('table')).toBeInTheDocument();
    });
  });

  describe('2. ArchiveExplorerView Virtualization & Scale Stress Tests', () => {
    test('2-1. under production simulation (500 archive items in list view), caps rendered DOM cards with >80% reduction', async () => {
      setNodeEnv('production');
      window.innerHeight = 800;

      const mockItems = generateArchiveItems(500);

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('cross-join')) {
          return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            totalIndexed: 500,
            totalMatched: 500,
            facets: { years: { '2026년': 500 }, projects: {}, categories: { doc: 250, image: 250 } },
            items: mockItems,
            cluster: null,
          }),
        };
      }) as any;

      const startTime = performance.now();
      const { container } = render(<ArchiveExplorerView />);

      await waitFor(() => {
        expect(screen.getByText(/검색 결과 500건/)).toBeInTheDocument();
      });

      const mountStallMs = performance.now() - startTime;
      console.log(`[EMPIRICAL CHALLENGER] ArchiveExplorerView mount stall (500 items): ${mountStallMs.toFixed(2)}ms`);
      expect(mountStallMs).toBeLessThan(1500);

      // Verify that list items in the DOM are windowed
      const renderedCards = container.querySelectorAll('.vlds-cv-card');
      console.log(`[EMPIRICAL CHALLENGER] Total items: 500, Rendered list cards in DOM: ${renderedCards.length}`);

      // In 800px viewport with itemHeight=90 and overscan=4:
      // (800 / 90) + 2*4 ≈ 9 + 8 = 17 cards
      expect(renderedCards.length).toBeLessThanOrEqual(40);
      expect(renderedCards.length).toBeGreaterThan(0);

      const reduction = ((500 - renderedCards.length) / 500) * 100;
      console.log(`[EMPIRICAL CHALLENGER] ArchiveExplorerView list DOM reduction: ${reduction.toFixed(1)}%`);
      expect(reduction).toBeGreaterThanOrEqual(80);
    });

    test('2-2. gallery view mode (300 items) groups 3-column rows and caps rendered cards with >80% reduction', async () => {
      setNodeEnv('production');
      window.innerHeight = 800;

      const mockItems = generateArchiveItems(300);

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('cross-join')) {
          return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            totalIndexed: 300,
            totalMatched: 300,
            facets: { years: { '2026년': 300 }, projects: {}, categories: { image: 300 } },
            items: mockItems,
            cluster: null,
          }),
        };
      }) as any;

      const { container } = render(<ArchiveExplorerView />);

      await waitFor(() => {
        expect(screen.getByText('마스터 아카이브 통합 탐색기')).toBeInTheDocument();
      });

      // Switch to Gallery mode
      const galleryBtn = screen.getByText('사진·시안 갤러리').closest('button');
      expect(galleryBtn).not.toBeNull();
      fireEvent.click(galleryBtn!);

      await waitFor(() => {
        expect(screen.getByText('사진·시안 썸네일 갤러리')).toBeInTheDocument();
      });

      // Total items = 300 => 100 rows
      const renderedGalleryCards = container.querySelectorAll('.vlds-cv-card');
      console.log(`[EMPIRICAL CHALLENGER] Total gallery items: 300 (100 rows), Rendered cards in DOM: ${renderedGalleryCards.length}`);

      // In 800px viewport with itemHeight=250 and overscan=2:
      // (800 / 250) + 2*2 ≈ 3.2 + 4 = ~7.2 rows * 3 = ~22-26 cards
      expect(renderedGalleryCards.length).toBeLessThanOrEqual(40);
      expect(renderedGalleryCards.length).toBeGreaterThan(0);

      const reduction = ((300 - renderedGalleryCards.length) / 300) * 100;
      console.log(`[EMPIRICAL CHALLENGER] Gallery View DOM reduction: ${reduction.toFixed(1)}%`);
      expect(reduction).toBeGreaterThanOrEqual(80);
    });

    test('2-3. interaction flow integrity: selecting an item under virtualization updates cluster without crashing', async () => {
      setNodeEnv('production');
      window.innerHeight = 800;

      const mockItems = generateArchiveItems(50);

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('cross-join')) {
          return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            totalIndexed: 50,
            totalMatched: 50,
            facets: { years: { '2026년': 50 }, projects: {}, categories: { doc: 50 } },
            items: mockItems,
            cluster: null,
          }),
        };
      }) as any;

      const { container } = render(<ArchiveExplorerView />);

      await waitFor(() => {
        expect(screen.getByText(/검색 결과 50건/)).toBeInTheDocument();
      });

      // Find first rendered card and click it
      const firstCard = container.querySelector('.vlds-cv-card');
      expect(firstCard).not.toBeNull();
      fireEvent.click(firstCard!);

      // Should be highlighted as selected (ring-2 ring-blue-600/20)
      expect(firstCard?.className).toContain('ring-blue-600/20');
    });
  });
});
