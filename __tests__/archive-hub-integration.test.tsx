import { TextEncoder, TextDecoder } from 'util';

// 1. Polyfill standard encoding globals for JSDOM
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
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArchiveExplorerView } from '@/components/archive/ArchiveExplorerView';
import { ProtectedApp } from '@/components/ProtectedApp';
import { ModuleType } from '@/types';
import { CrossDomainRegistry } from '@/lib/ontology/cross-domain-types';
import { AdminOntologyGraph } from '@/lib/ontology/admin-types';

// 2. Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// 3. Mock LocalhostStatusHUD to prevent background polling in Jest
jest.mock('@/components/layout/LocalhostStatusHUD', () => ({
  LocalhostStatusHUD: () => <div data-testid="localhost-status-hud">HUD</div>,
}));

// 4. Mock Canvas 2D Context for AdminOntologyExplorer Orbit Canvas
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

// 5. Mock Domain Hooks for ProtectedApp Integration (Test 6)
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

// ============================================================================
// Mock Data Fixtures
// ============================================================================

const mockSampleItems = [
  {
    id: 'arc-00001',
    name: '(붙임2) 합동 캠페인 결과보고_강남구보건소.hwpx',
    rawName: '(붙임2) 합동 캠페인 결과보고_강남구보건소.hwpx',
    relPath: '2026년/03_양재천_건강페스티벌/(붙임2) 합동 캠페인 결과보고_강남구보건소.hwpx',
    year: '2026년',
    project: '03_양재천_건강페스티벌',
    subFolder: '',
    ext: '.hwpx',
    category: 'doc' as const,
    size: 48200,
    date: '2026-10-21',
    mtime: 1761000000,
    snippet: '2026 양재천 걷자 건강 페스티벌 수변문화쉼터 부스 운영 및 걷기 코스 완주 리워드 배부 결과',
    keywords: ['양재천', '페스티벌', '수변문화쉼터', '부스'],
    imageCategory: null,
    score: 125,
    matchReason: 'content' as const,
  },
  {
    id: 'arc-00002',
    name: 'KakaoTalk_20261023_104835625.jpg',
    rawName: 'KakaoTalk_20261023_104835625.jpg',
    relPath: '2026년/03_양재천_건강페스티벌/KakaoTalk_20261023_104835625.jpg',
    year: '2026년',
    project: '03_양재천_건강페스티벌',
    subFolder: '현장사진',
    ext: '.jpg',
    category: 'image' as const,
    size: 512000,
    date: '2026-10-23',
    mtime: 1761100000,
    snippet: '2026년 | 03 양재천 건강페스티벌 | 현장·수행 사진 자료',
    keywords: ['양재천', '페스티벌', '부스'],
    imageCategory: 'photo' as const,
    score: 90,
    matchReason: 'context' as const,
  },
  {
    id: 'arc-00003',
    name: '261020_물자총괄표.xlsx',
    rawName: '261020_물자총괄표.xlsx',
    relPath: '2026년/03_양재천_건강페스티벌/261020_물자총괄표.xlsx',
    year: '2026년',
    project: '03_양재천_건강페스티벌',
    subFolder: '',
    ext: '.xlsx',
    category: 'sheet' as const,
    size: 32400,
    date: '2026-10-20',
    mtime: 1760900000,
    snippet: '시트: 부스별물자, 현수막규격, 타올배부수량',
    keywords: ['양재천', '페스티벌', '물자총괄표'],
    imageCategory: null,
    score: 85,
    matchReason: 'content' as const,
  },
];

const mockCrossDomainRegistry: any = {
  '01_양재천_페스티벌': {
    projectKey: '01_양재천_페스티벌',
    canonicalId: 'hchps-p1',
    name: '양재천 건강 페스티벌',
    projectName: '양재천 건강 페스티벌',
    department: '보건행정과 건강증진팀',
    ontology: {
      policiesCount: 1,
      outcomesCount: 1,
      auditsCount: 1,
      budgetPlansCount: 1,
      activeGapsCount: 0,
      totalNodes: 4,
      lifecycleComplete: true,
      auditGaps: [],
      entities: [
        {
          id: 'POL-2026-YANGJAE',
          stage: 'POLICY_DIRECTIVE',
          title: '2026년 양재천 건강 페스티벌 추진계획',
          year: 2026,
          department: '보건행정과 건강증진팀',
          budgetAmount: 180000000,
          objectives: ['양재천 걷기 코스 및 20개 건강 부스 운영'],
          sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2026년\\01_양재천_페스티벌\\2026년 양재천 페스티벌 추진계획.hwpx',
        },
      ],
    },
    archive: {
      totalFiles: 42,
      totalDocuments: 18,
      totalPhotos: 12,
      totalSheets: 12,
      docsCount: 18,
      sheetsCount: 12,
      imagesCount: 12,
    },
    workingMemory: {
      totalCount: 3,
      pendingCount: 2,
      doneCount: 1,
      latestMemos: ['물자 총괄표 수량 재확인', '현수막 시안 검토'],
      urgentDirectives: [],
    },
    budget: {
      totalBudget: 180000000,
      spentBudget: 142000000,
      executionRate: 78.9,
      remainingBudget: 38000000,
      dailyExpenseRemaining: 5000000,
    },
    weeklyWork: {
      totalCount: 4,
      reportsCount: 4,
      latestItems: ['10월 4주 페스티벌 부스 배치 완료'],
    },
    festivalAndContacts: {
      isFestivalProject: true,
      festivalSummary: {
        progress: 85,
        boothsCount: 20,
        dutiesCount: 41,
        coursesCount: 5,
      },
      assignedContacts: [
        { name: '김*정', phone: '02-***-7116', role: '총괄 주무관' },
      ],
    },
  },
  '04_서울체력장_AI메디헬스_메디런': {
    projectKey: '04_서울체력장_AI메디헬스_메디런',
    canonicalId: 'hchps-p7',
    name: '서울체력장 및 AI 메디헬스',
    projectName: '서울체력장 및 AI 메디헬스',
    department: '보건행정과 건강증진팀',
    ontology: {
      policiesCount: 2,
      outcomesCount: 2,
      auditsCount: 1,
      budgetPlansCount: 1,
      activeGapsCount: 0,
      totalNodes: 6,
      lifecycleComplete: true,
      auditGaps: [],
      entities: [],
    },
    archive: {
      totalFiles: 85,
      totalDocuments: 40,
      totalPhotos: 20,
      totalSheets: 25,
      docsCount: 40,
      sheetsCount: 25,
      imagesCount: 20,
    },
    workingMemory: {
      totalCount: 2,
      pendingCount: 1,
      doneCount: 1,
      latestMemos: ['체력인증센터 안전펜스 보강'],
      urgentDirectives: [],
    },
    budget: {
      totalBudget: 1557000000,
      spentBudget: 1423000000,
      executionRate: 91.4,
      remainingBudget: 134000000,
      dailyExpenseRemaining: 12000000,
    },
    weeklyWork: {
      totalCount: 6,
      reportsCount: 6,
      latestItems: ['10월 4주 서울체력장 메디런 운영 실적'],
    },
    festivalAndContacts: {
      isFestivalProject: false,
      assignedContacts: [
        { name: '이*수', phone: '02-***-7118', role: '체력측정사' },
      ],
    },
  },
};

const mockGraph: AdminOntologyGraph = {
  policies: [
    {
      id: 'POL-2026-YANGJAE',
      stage: 'POLICY_DIRECTIVE',
      title: '2026년 양재천 건강 페스티벌 기본계획',
      year: 2026,
      department: '보건행정과 건강증진팀',
      project: '01_양재천_페스티벌',
      budgetAmount: 180000000,
      objectives: ['구민 참여형 걷기 코스 및 건강체험 부스 운영'],
    },
  ],
  outcomes: [],
  audits: [],
  budgetPlans: [],
  weeklyWorks: [],
  edges: [],
};

// ============================================================================
// Test Suite: Archive & Enterprise Ontology Integrated Hub Integration
// ============================================================================

describe('Archive & Enterprise Ontology Integrated Hub (Milestone 3 Test Suite)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';

      if (urlStr.startsWith('/api/archive/open')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      }

      if (urlStr.includes('/api/admin-ontology')) {
        if (urlStr.includes('action=cross-join')) {
          if (urlStr.includes('projectKey=')) {
            const key = decodeURIComponent(urlStr.split('projectKey=')[1].split('&')[0]);
            const bundle = (mockCrossDomainRegistry as any)[key] || mockCrossDomainRegistry['01_양재천_페스티벌'];
            return {
              ok: true,
              status: 200,
              json: async () => ({ success: true, data: bundle }),
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: mockCrossDomainRegistry, totalProjects: 2 }),
          };
        }

        if (urlStr.includes('action=graph')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              graph: mockGraph,
              stats: { totalNodes: 1, totalPolicies: 1, totalEdges: 0, totalGaps: 0, totalBudgetKrw: 180000000 },
            }),
          };
        }
      }

      // Default: /api/archive search endpoint
      return {
        ok: true,
        status: 200,
        json: async () => ({
          generatedAt: '2026-10-26T12:55:00.000Z',
          totalIndexed: 6208,
          totalMatched: mockSampleItems.length,
          facets: {
            years: { '2026년': 2150, '2025년': 750, '2024년': 924 },
            projects: {
              '03_양재천_건강페스티벌': 165,
              '04_서울체력장_AI메디헬스_메디런': 680,
            },
            categories: { doc: 3200, image: 2400, sheet: 550 },
          },
          items: mockSampleItems,
          cluster: {
            anchor: mockSampleItems[0],
            docs: [mockSampleItems[0]],
            sheets: [mockSampleItems[2]],
            images: [mockSampleItems[1]],
          },
        }),
      };
    }) as any;
  });

  // --------------------------------------------------------------------------
  // Test 1: Default active tab is 'archive' (100% backward compatible)
  // --------------------------------------------------------------------------
  it('Test 1: Default active tab is "archive" and 100% backward compatibility is preserved', async () => {
    render(<ArchiveExplorerView />);

    // 1. Verify 3 workflow tabs are rendered
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /문서 보관함/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /문서 관계도/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /주간업무/i })).toBeInTheDocument();
    });

    // 2. Verify 'archive' tab is active by default
    const archiveTab = screen.getByRole('tab', { name: /문서 보관함/i });
    expect(archiveTab).toHaveAttribute('aria-selected', 'true');

    // 3. Verify existing archive search bar, facets, and indexing stats are displayed
    await waitFor(() => {
      expect(screen.getAllByText('문서 보관함').length).toBeGreaterThan(0);
      expect(screen.getByText(/총 6,208건 색인됨/)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/키워드 검색/i)
      ).toBeInTheDocument();
    });

    // 4. Verify existing filter chips and items are intact
    await waitFor(() => {
      expect(screen.getByText('양재천 페스티벌')).toBeInTheDocument();
      expect(screen.getAllByText('(붙임2) 합동 캠페인 결과보고_강남구보건소.hwpx').length).toBeGreaterThan(0);
      expect(screen.getAllByText('본문 내용 일치').length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Test 2: Tab switching between 'archive', 'ontology', and 'weekly'
  // --------------------------------------------------------------------------
  it('Test 2: Smooth tab switching between "archive", "ontology", and "weekly"', async () => {
    render(<ArchiveExplorerView />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /문서 보관함/i })).toBeInTheDocument();
    });

    // Switch to 'ontology' tab
    const ontologyTab = screen.getByRole('tab', { name: /문서 관계도/i });
    fireEvent.click(ontologyTab);

    await waitFor(() => {
      expect(ontologyTab).toHaveAttribute('aria-selected', 'true');
      expect(
        screen.getAllByText('문서 관계도').length
      ).toBeGreaterThan(0);
    });

    // Verify archive search input is not visible in ontology tab
    expect(
      screen.queryByPlaceholderText(/키워드 검색/i)
    ).not.toBeInTheDocument();

    // Switch to 'weekly' tab
    const weeklyTab = screen.getByRole('tab', { name: /주간업무/i });
    fireEvent.click(weeklyTab);

    await waitFor(() => {
      expect(weeklyTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getAllByText(/주간업무/i).length).toBeGreaterThan(0);
    });

    // Switch back to 'archive' tab
    const archiveTab = screen.getByRole('tab', { name: /문서 보관함/i });
    fireEvent.click(archiveTab);

    await waitFor(() => {
      expect(archiveTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getAllByText('문서 보관함').length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Test 3: Right-hand 6-domain linked bundle panel renders metrics & buttons
  // --------------------------------------------------------------------------
  it('Test 3: Right-hand 6-domain linked bundle panel renders live metrics and action buttons', async () => {
    render(<ArchiveExplorerView />);

    await waitFor(() => {
      expect(screen.getByText(/연계 자료/i)).toBeInTheDocument();
    });

    // 1. Verify 6-domain metrics are rendered for selected project
    await waitFor(() => {
      // Domain 1: 행정 온톨로지
      expect(screen.getByText(/방침·결과·감사·설명서/i)).toBeInTheDocument();
      // Domain 3: 작업기억 미반영 지시사항
      expect(screen.getByText(/미반영 메모 2건/i)).toBeInTheDocument();
      // Domain 4: e-호조 예산 집행률
      expect(screen.getByText(/78.9%/)).toBeInTheDocument();
      // Domain 6: 양재천 페스티벌 관제
      expect(screen.getByText(/20개 부스.*41명 분장/i)).toBeInTheDocument();
    });

    // 2. Verify direct jump buttons are present in the DOM
    expect(
      screen.queryByTestId('btn-jump-memory') ||
      screen.getByRole('button', { name: /작업기억.*이동/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId('btn-jump-workspace') ||
      screen.getByRole('button', { name: /예산관리.*이동/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId('btn-jump-simulator') ||
      screen.getByRole('button', { name: /예산 시뮬레이터.*이동/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId('btn-jump-festival') ||
      screen.getByRole('button', { name: /양재천 페스티벌.*이동/i })
    ).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Test 4: Clicking direct jump buttons calls onNavigateModule callbacks
  // --------------------------------------------------------------------------
  it('Test 4: Clicking direct jump buttons invokes onNavigateModule and tab switch callbacks', async () => {
    const onNavigateModule = jest.fn();
    render(<ArchiveExplorerView onNavigateModule={onNavigateModule} />);

    await waitFor(() => {
      expect(screen.getByText(/연계 자료/i)).toBeInTheDocument();
    });

    // 1. Jump to Memory
    const jumpMemoryBtn =
      screen.queryByTestId('btn-jump-memory') ||
      screen.getByRole('button', { name: /포스트잇.*열기/i });
    fireEvent.click(jumpMemoryBtn);
    expect(onNavigateModule).toHaveBeenCalledWith('memory');

    // 2. Jump to Workspace
    const jumpWorkspaceBtn =
      screen.queryByTestId('btn-jump-workspace') ||
      screen.getByRole('button', { name: /예산관리.*이동/i });
    fireEvent.click(jumpWorkspaceBtn);
    expect(onNavigateModule).toHaveBeenCalledWith('workspace');

    // 3. Jump to Budget Simulator
    const jumpSimBtn =
      screen.queryByTestId('btn-jump-simulator') ||
      screen.getByRole('button', { name: /예산 시뮬레이터.*이동/i });
    fireEvent.click(jumpSimBtn);
    expect(onNavigateModule).toHaveBeenCalledWith('simulator');

    // 4. Jump to Yangjae Festival
    const jumpFestivalBtn =
      screen.queryByTestId('btn-jump-festival') ||
      screen.getByRole('button', { name: /양재천 페스티벌.*이동/i });
    fireEvent.click(jumpFestivalBtn);
    expect(onNavigateModule).toHaveBeenCalledWith('festival');

    // 5. Jump to Weekly Report (switches to 'weekly' workflow tab)
    const jumpWeeklyBtn =
      screen.queryByTestId('btn-jump-weekly') ||
      screen.getByRole('button', { name: /주간업무.*이동/i });
    fireEvent.click(jumpWeeklyBtn);

    await waitFor(() => {
      const weeklyTab = screen.getByRole('tab', { name: /주간업무/i });
      expect(weeklyTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  // --------------------------------------------------------------------------
  // Test 5: Rule S 448px mobile-first container constraints
  // --------------------------------------------------------------------------
  it('Test 5: Rule S 448px mobile-first layout constraints and overflow containment', async () => {
    render(<ArchiveExplorerView />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /문서 보관함/i })).toBeInTheDocument();
    });

    // 1. Verify workflow tab navigation bar has horizontal scroll containment (no page clipping)
    const tabNav = screen.getByRole('tablist');
    expect(tabNav.className).toMatch(/overflow-x-auto|whitespace-nowrap|max-w-full/);

    // 2. Verify main layout container utilizes responsive grid (stacked 1-column on mobile max-w-md)
    const viewContainer = screen.getByTestId('archive-explorer-view');
    expect(viewContainer).toHaveClass('w-full');

    const gridLayout = viewContainer.querySelector('.grid');
    expect(gridLayout).toHaveClass('grid-cols-1');
    expect(gridLayout).toHaveClass('xl:grid-cols-12');

    // 3. Verify right-hand cluster panel buttons and text enforce truncation/break protection
    const jumpMemoryBtn =
      screen.queryByTestId('btn-jump-memory') ||
      screen.getByRole('button', { name: /포스트잇.*열기/i });
    expect(jumpMemoryBtn.className).toMatch(/truncate|w-full/);
  });

  // --------------------------------------------------------------------------
  // Test 6: ProtectedApp integration with onNavigateModule
  // --------------------------------------------------------------------------
  it('Test 6: ProtectedApp integration smoothly propagates onNavigateModule jumps without state loss', async () => {
    render(<ProtectedApp appMode="VITAL" onModeChange={jest.fn()} />);

    // 1. Initially on Dashboard
    await waitFor(() => {
      expect(screen.getByText('WORK VITAL')).toBeInTheDocument();
    });

    // 2. Navigate to 'archive' via Sidebar
    const archiveNavBtn = within(screen.getByRole('banner')).getByText('문서 보관함').closest('button');
    expect(archiveNavBtn).not.toBeNull();
    fireEvent.click(archiveNavBtn!);

    // 3. Verify Archive Explorer is rendered in ProtectedApp with title
    await waitFor(() => {
      expect(screen.getByText('WORK VITAL')).toBeInTheDocument();
      expect(screen.getAllByText('문서 보관함').length).toBeGreaterThan(0);
    });

    // 4. Trigger jump to 'memory' from within the rendered ArchiveExplorerView
    const jumpMemoryBtn = await within(screen.getByTestId('archive-explorer-view')).findByTestId('btn-jump-memory');
    fireEvent.click(jumpMemoryBtn);

    // 5. Verify ProtectedApp transitioned smoothly to StickyNotes / memory drawer
    await waitFor(() => {
      expect(
        screen.queryByText('VITAL 포스트잇') || screen.queryByTestId('sticky-notes-panel') || screen.queryByText('포스트잇')
      ).toBeTruthy();
    });

    // 6. Navigate back to 'archive' and jump to 'workspace' (예산관리)
    fireEvent.click(archiveNavBtn!);
    await waitFor(() => {
      expect(screen.getByText('WORK VITAL')).toBeInTheDocument();
      expect(screen.getAllByText('문서 보관함').length).toBeGreaterThan(0);
    });

    const jumpWorkspaceBtns = await screen.findAllByRole('button', { name: /예산관리.*이동/i });
    const jumpWorkspaceBtn = jumpWorkspaceBtns[0];
    fireEvent.click(jumpWorkspaceBtn);

    await waitFor(() => {
      expect(screen.getByText('WORK VITAL')).toBeInTheDocument();
      expect(screen.getAllByText('예산관리').length).toBeGreaterThan(1);
    });
  });
});
