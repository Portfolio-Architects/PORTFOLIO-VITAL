import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;
  global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;
}
if (typeof global.Request === 'undefined' && typeof globalThis.Request !== 'undefined') {
  global.Request = globalThis.Request;
}
if (typeof global.Response === 'undefined' && typeof globalThis.Response !== 'undefined') {
  global.Response = globalThis.Response;
}
if (typeof global.Headers === 'undefined' && typeof globalThis.Headers !== 'undefined') {
  global.Headers = globalThis.Headers;
}

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  VLDS_COPY_BUDGET,
  auditVldsCopy,
  joinTelegraphic,
} from '@/lib/vlds-microcopy';
import { SectionHeader } from '@/components/ui';
import { ProtectedApp } from '@/components/ProtectedApp';
import { PortfolioDashboardView } from '@/components/dashboard/PortfolioDashboardView';
import { ContactsBox } from '@/components/dashboard/ContactsBox';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';
import { BudgetSimulator } from '@/components/budget/BudgetSimulator';
import { WorkingMemoryPage } from '@/components/memory/WorkingMemoryPage';
import { WorkingMemoryContextBanner } from '@/components/dashboard/WorkingMemoryContextBanner';
import { ArchiveExplorerView } from '@/components/archive/ArchiveExplorerView';
import { AdminOntologyExplorer } from '@/components/ontology/AdminOntologyExplorer';
import { CommandPalette } from '@/components/modals/CommandPalette';
import ProjectManagementPage from '@/components/project/ProjectManagementPage';
import { SplashView } from '@/components/SplashView';
import { AppLogModal } from '@/components/AppLogModal';
import { SecurityLockScreen } from '@/components/SecurityLockScreen';
import { MobileMemoInbox } from '@/components/dashboard/MobileMemoInbox';
import { SchedulePresetManageModal } from '@/components/dashboard/SchedulePresetSelector';
import { DailyExpenseStatModal } from '@/components/budget/ui/DailyExpenseStatModal';
import { AdminOntologyDrawer } from '@/components/ontology/AdminOntologyDrawer';
import WeeklyReportManager from '@/components/weekly/WeeklyReportManager';
import { resetWorkingMemoryStoreForTest } from '@/hooks/useWorkingMemory';
import { createWorkingMemoryMemo } from '@/lib/working-memory-parser';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/components/layout/LocalhostStatusHUD', () => ({
  LocalhostStatusHUD: () => <div data-testid="localhost-status-hud">HUD</div>,
}));

jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 300 }}>{children}</div>
    ),
  };
});

jest.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [],
    stats: { total: 0, done: 0, overdue: 0 },
    addTask: jest.fn(),
    updateTask: jest.fn(),
  }),
}));

jest.mock('@/hooks/useBudget', () => ({
  useBudget: () => ({
    categories: [],
    entries: [],
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
    getCategoryStats: () => null,
    overallStatsActual: {
      totalBudget: 0,
      totalSpent: 0,
      totalPlanned: 0,
      remaining: 0,
      dailyExpenseIssued: 0,
      dailyExpenseSpent: 0,
      dailyExpenseRemaining: 0,
    },
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
  useProjects: () => ({
    projects: [],
    addProject: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
    addChecklistItem: jest.fn(),
    toggleChecklistItem: jest.fn(),
    deleteChecklistItem: jest.fn(),
    getProjectProgress: () => 0,
  }),
}));

jest.mock('@/hooks/useContacts', () => ({
  useContacts: () => ({
    contacts: [],
    loading: false,
    addContact: jest.fn(),
    updateContact: jest.fn(),
    deleteContact: jest.fn(),
  }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ logout: jest.fn() }),
}));

jest.mock('@/lib/sheets-api', () => ({
  readSheet: jest.fn().mockResolvedValue([]),
  addRow: jest.fn().mockResolvedValue(true),
  updateRow: jest.fn().mockResolvedValue(true),
  deleteRow: jest.fn().mockResolvedValue(true),
  syncTombstones: jest.fn().mockResolvedValue(true),
}));

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
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
    measureText: jest.fn().mockReturnValue({ width: 40 }),
  });
});

describe('VLDS Zero-Verbosity & Particle-Free Microcopy Standard (Milestone 288)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        totalIndexed: 7723,
        items: [],
        facets: {},
        cluster: null,
        data: {},
        logs: [],
        graph: {
          policies: [],
          outcomes: [],
          audits: [],
          budgetPlans: [],
          weeklyWorks: [],
          edges: [],
        },
      }),
    }) as jest.Mock;
  });

  describe('1. auditVldsCopy & joinTelegraphic Unit Verification', () => {
    it('accepts empty/null copy, particle-free telegraphic noun phrases, and public-health department/result nouns ending in 과/을', () => {
      expect(auditVldsCopy('', 'subtitle').valid).toBe(true);
      expect(auditVldsCopy(null, 'helper').valid).toBe(true);
      expect(auditVldsCopy(undefined, 'title').valid).toBe(true);

      const validSamples: Array<[string, 'title' | 'subtitle' | 'cta' | 'helper' | 'placeholder']> = [
        ['업무 연락처', 'title'],
        ['작업기억 보드', 'title'],
        ['일반지출 · 일상경비 통합 (오차 0원)', 'subtitle'],
        ['집행 잔액 - 예정액 · 과목별 예상 잔액', 'subtitle'],
        ['부서 · 유관기관 담당자 통합 조회', 'subtitle'],
        ['본문(HWPX · PDF · XLSX) · 사진 맥락 통합 검색', 'subtitle'],
        // Public-health department names & result/excess nouns ending in '과' or '을' (zero false positives)
        ['보건행정과 담당자 조회', 'subtitle'],
        ['건강증진과 예산 총괄', 'subtitle'],
        ['감염병관리과 협조 요청', 'subtitle'],
        ['의약과 · 위생과 합동 점검', 'subtitle'],
        ['공원녹지과 · 치수과 협조', 'subtitle'],
        ['예산초과 경고', 'cta'],
        ['점검결과 요약', 'title'],
        ['사업성과 지표', 'title'],
        ['가을 걷기 캠페인', 'title'],
        ['마을 건강센터 운영', 'title'],
        ['필터 저장', 'cta'],
        ['초기화', 'cta'],
        ['작업기억 보드 이동', 'cta'],
        ['좌측 항목 선택 시 표시', 'helper'],
        ['이름 · 전화번호 · 소속 · 메모 · 초성(ㅊㄹ) 검색', 'placeholder'],
      ];

      for (const [sample, role] of validSamples) {
        const res = auditVldsCopy(sample, role);
        expect(res.valid).toBe(true);
        expect(res.violations).toEqual([]);
      }
    });

    it('rejects explanatory/imperative prose endings, trailing ellipsis prose, bureaucratic particle chains, directional 로 이동, and redundant English glosses', () => {
      const proseSample = auditVldsCopy(
        '현재 집행 잔액을 기준으로 미집행 확정 지출 예정액을 차감하여 실시간 시뮬레이션합니다.',
        'subtitle'
      );
      expect(proseSample.valid).toBe(false);
      expect(proseSample.violations.some((v) => v.includes('글자 수 초과'))).toBe(true);
      expect(proseSample.violations.some((v) => v.includes('서술형 문장 종결어미'))).toBe(true);
      expect(proseSample.violations.some((v) => v.includes('목적격 조사'))).toBe(true);
      expect(proseSample.violations.some((v) => v.includes('부사격 조사'))).toBe(true);

      // Additional prose endings & multi-sentence prose previously missed
      const imperativeSample = auditVldsCopy('세부 계획을 입력하세요.', 'helper');
      expect(imperativeSample.valid).toBe(false);
      expect(imperativeSample.violations.some((v) => v.includes('서술형 문장 종결어미'))).toBe(true);

      const emptyStateProse = auditVldsCopy('배정된 업무가 없습니다.', 'helper');
      expect(emptyStateProse.valid).toBe(false);
      expect(emptyStateProse.violations.some((v) => v.includes('서술형'))).toBe(true);

      const ellipsisProse = auditVldsCopy('시드 데이터 로딩 중입니다...', 'helper');
      expect(ellipsisProse.valid).toBe(false);

      const multiSentenceProse = auditVldsCopy('실적이 없습니다. [수정] 등록', 'helper');
      expect(multiSentenceProse.valid).toBe(false);

      const conjunctiveSample = auditVldsCopy('초기화 및 해제', 'cta');
      expect(conjunctiveSample.valid).toBe(false);
      expect(conjunctiveSample.violations.some((v) => v.includes('접속 조사'))).toBe(true);

      const gwaParticleSample = auditVldsCopy('세부사업과 통계목 선택', 'helper');
      expect(gwaParticleSample.valid).toBe(false);
      expect(gwaParticleSample.violations.some((v) => v.includes('접속 조사'))).toBe(true);

      const locativeSample = auditVldsCopy('좌측 목록에서 항목 선택', 'helper');
      expect(locativeSample.valid).toBe(false);
      expect(locativeSample.violations.some((v) => v.includes('부사격 조사'))).toBe(true);

      const directionalRoSample = auditVldsCopy('작업기억 보드로 이동', 'cta');
      expect(directionalRoSample.valid).toBe(false);
      expect(directionalRoSample.violations.some((v) => v.includes('부사격 조사'))).toBe(true);

      const bureaucraticChainSample = auditVldsCopy('정보 확인을 위해 클릭', 'helper');
      expect(bureaucraticChainSample.valid).toBe(false);
      expect(bureaucraticChainSample.violations.some((v) => v.includes('관료적 조사구'))).toBe(true);

      const redundantEnglishTitle = auditVldsCopy('주요 추진 실적 (Achievements)', 'title');
      expect(redundantEnglishTitle.valid).toBe(false);
      expect(redundantEnglishTitle.violations.some((v) => v.includes('중복 영문 병기 금지'))).toBe(true);

      const legacyJargonSample = auditVldsCopy('마인드맵 공약제안 연락처', 'subtitle');
      expect(legacyJargonSample.valid).toBe(false);
      expect(legacyJargonSample.violations.some((v) => v.includes('금지 레거시'))).toBe(true);

      // Plain-Word Naming & 3-word title cap (VLDS Design Harness)
      const bloatedShowcaseTitle = auditVldsCopy('통합 행정 지식 쇼케이스', 'title');
      expect(bloatedShowcaseTitle.valid).toBe(false);
      expect(bloatedShowcaseTitle.violations.some((v) => v.includes('장황한 타이틀 어절 초과'))).toBe(true);
      expect(bloatedShowcaseTitle.violations.some((v) => v.includes('과장·추상 UI 용어 금지'))).toBe(true);

      const intuitiveBoardTitle = auditVldsCopy('행정 게시판', 'title');
      expect(intuitiveBoardTitle.valid).toBe(true);
      expect(intuitiveBoardTitle.violations).toEqual([]);

      // Exact boundary check for title (18 chars allowed, 19 chars rejected)
      expect(auditVldsCopy('가'.repeat(VLDS_COPY_BUDGET.title), 'title').valid).toBe(true);
      expect(auditVldsCopy('가'.repeat(VLDS_COPY_BUDGET.title + 1), 'title').valid).toBe(false);
    });

    it('formats telegraphic tokens cleanly while skipping empty values', () => {
      expect(joinTelegraphic(['일반지출', '', null, undefined, false, '일상경비', '오차 0원'])).toBe(
        '일반지출 · 일상경비 · 오차 0원'
      );
    });
  });

  describe('2. SectionHeader UI Primitive', () => {
    it('renders concise title, single-line vlds-subtitle with title tooltip fallback, custom headingLevel, and omits subtitle tag when empty', () => {
      const { container, rerender } = render(
        <SectionHeader
          title="예산 시뮬레이터"
          subtitle="집행 잔액 - 예정액 · 과목별 예상 잔액"
          headingLevel="h3"
          badge={<span data-testid="hdr-badge">안전</span>}
        />
      );

      const headingEl = screen.getByText('예산 시뮬레이터');
      expect(headingEl.tagName).toBe('H3');
      const subEl = screen.getByText('집행 잔액 - 예정액 · 과목별 예상 잔액');
      expect(subEl).toHaveClass('vlds-subtitle', 'line-clamp-1');
      expect(subEl).toHaveAttribute('title', '집행 잔액 - 예정액 · 과목별 예상 잔액');
      expect(screen.getByTestId('hdr-badge')).toBeInTheDocument();

      rerender(<SectionHeader title="예산 시뮬레이터" />);
      expect(container.querySelector('.vlds-subtitle')).toBeNull();
    });
  });

  describe('3. Live App-Wide Zero-Verbosity & Layout Invariant Verification', () => {
    it('preserves 2-tier title padding & wide margins in ProtectedApp and particle-free SSR copy in SplashView', () => {
      const { container: splashContainer } = render(<SplashView />);
      expect(splashContainer.textContent).toContain('로컬 데이터 연결 중');
      expect(splashContainer.textContent).not.toContain('연결하고 있습니다');
      expect(splashContainer.textContent).not.toContain('워크스페이스');
      expect(auditVldsCopy('로컬 데이터 연결 중', 'helper').valid).toBe(true);

      const { container } = render(<ProtectedApp appMode="VITAL" onModeChange={jest.fn()} />);

      // Layout invariants from PORTFOLIO ASSET alignment must remain intact
      expect(container.innerHTML).toContain('w-full max-w-[2400px] mx-auto px-4 sm:px-8 xl:px-12 2xl:px-16');
      expect(container.innerHTML).toContain('pt-5 sm:pt-7 pb-4 sm:pb-5');

      // Verbose abstract slogans & redundant page-level subtitle removed
      const text = container.textContent || '';
      expect(text).not.toContain('초개인화 행정 인텔리전스 워크스페이스');
      expect(text).not.toContain('하이브리드 공공 인텔리전스 아키텍처');
      expect(text).not.toContain('VITAL 통합 대시보드');
      expect(text).toContain('WORK VITAL');
      expect(container.querySelector('[data-testid="vital-logo-mark"]')).toBeInTheDocument();
      expect(splashContainer.textContent).toContain('WORK VITAL');
      expect(splashContainer.textContent).not.toContain('Architecture Ready');
    });

    it('renders concise 2-tier rows and SectionHeader in PortfolioDashboardView and ContactsBox without legacy MindMap prose', () => {
      const { container: dashContainer } = render(
        <PortfolioDashboardView
          budgetCategories={[
            {
              id: 'c1',
              detailedProject: '건강생활실천사업',
              name: '행사운영비',
              totalBudget: 50000000,
            } as any,
          ]}
          budgetEntries={[
            {
              id: 'e1',
              categoryId: 'c1',
              amount: 30000000,
              date: '2026-06-01',
              purpose: '집행',
              actionType: 'general',
            } as any,
          ]}
          appMode="VITAL"
        />
      );

      const dashText = dashContainer.textContent || '';
      expect(dashText).not.toContain('부서 일상경비 통장 입금액 제외한 일반지출분');
      expect(dashText).not.toContain('클릭 시 비목 상세');
      expect(dashText).not.toContain('본청');
      const trendSub = screen.getByText('11월 전액 집행 목표');
      expect(trendSub).toHaveClass('vlds-subtitle', 'line-clamp-1');

      const { container: contactsContainer } = render(<ContactsBox />);
      const contactsText = contactsContainer.textContent || '';
      expect(contactsText).not.toContain('마인드맵 공약제안');
      expect(contactsText).not.toContain('연락 정보를 관리합니다');
      expect(contactsText).not.toContain('적어두시면 검색창에서 즉시 찾아낼 수 있습니다');
      expect(contactsText).not.toContain('초성 · 메모 검색');
      expect(contactsText).not.toContain('부서 · 유관기관 담당자 통합 조회');
      expect(screen.getByText('업무 연락처')).toBeInTheDocument();
    });

    it('eliminates verbose explanatory sentences and unnecessary particles across BudgetDashboard, BudgetSimulator, WorkingMemory, ArchiveExplorer, AdminOntology, ProjectManagementPage (both tabs), CommandPalette, and Modals', async () => {
      // 1. BudgetDashboard & DailyExpenseStatModal
      const { container: bdContainer } = render(
        <BudgetDashboard
          categories={[]}
          entries={[]}
          addCategory={jest.fn()}
          updateCategory={jest.fn()}
          deleteCategory={jest.fn()}
          addEntry={jest.fn()}
          updateEntry={jest.fn()}
          deleteEntry={jest.fn()}
          getCategoryStats={() => null}
          overallStats={{
            totalBudget: 0,
            totalSpent: 0,
            totalPlanned: 0,
            remaining: 0,
            dailyExpenseIssued: 0,
            dailyExpenseSpent: 0,
            dailyExpenseRemaining: 0,
          }}
        />
      );
      expect(bdContainer.textContent).not.toContain('다중 필터링 & 실시간 대조 시스템');
      expect(bdContainer.textContent).not.toContain('초기화 및 해제');
      expect(screen.getByText('필터 저장')).toBeInTheDocument();

      const { container: dailyModalContainer } = render(
        <DailyExpenseStatModal
          isOpen={true}
          onClose={jest.fn()}
          categories={[]}
          getCategoryStats={() => null}
        />
      );
      expect(dailyModalContainer.textContent).toContain('세부사업 · 통계목별 교부액 · 실지출 · 가용 잔액 대조');
      expect(dailyModalContainer.textContent).not.toContain('가용 잔액 현황입니다');

      // 2. WorkingMemoryPage, WorkingMemoryContextBanner & MobileMemoInbox
      resetWorkingMemoryStoreForTest([
        createWorkingMemoryMemo({
          id: 'wm-concise-1',
          content: '9/21 본예산 6,500만 원 → 7,800만 원',
          explicitCategory: 'budget',
        }),
      ]);
      const { container: wmContainer } = render(<WorkingMemoryPage />);
      expect(wmContainer.textContent).not.toContain('Working Memory Post-it');
      expect(wmContainer.textContent).not.toContain('상단에 자동 고정합니다');

      const { container: bannerContainer } = render(
        <WorkingMemoryContextBanner contextModule="simulator" />
      );
      expect(bannerContainer.textContent).not.toContain(
        '반영 완료 버튼을 누르기 전까지 하단에 고정 노출됩니다'
      );

      const { container: mobileMemoContainer } = render(<MobileMemoInbox />);
      expect(mobileMemoContainer.textContent).toContain('PIN 4자리 인증 · PC 작업기억 보드 즉시 전송');
      expect(mobileMemoContainer.textContent).not.toContain('메모를 남길 수 있습니다');

      // 3. ArchiveExplorerView, AdminOntologyExplorer, AdminOntologyDrawer & WeeklyReportManager
      const { container: arcContainer } = render(<ArchiveExplorerView />);
      expect(await screen.findByText('HWPX · PDF · XLSX · 사진 검색')).toBeInTheDocument();
      expect(arcContainer.textContent).not.toContain('파일명에 키워드가 없어도');
      expect(arcContainer.textContent).not.toContain('좌측 목록에서 항목을 선택하면');
      expect(arcContainer.textContent).not.toContain('주간업무 작성으로 이동');
      expect(screen.getByText('주간업무 작성 이동')).toBeInTheDocument();

      const { container: ontoContainer } = render(
        <AdminOntologyExplorer
          initialGraph={{
            policies: [],
            outcomes: [],
            audits: [],
            budgetPlans: [],
            weeklyWorks: [],
            edges: [],
          }}
        />
      );
      expect(
        await screen.findByText('방침 · 결과 · 감사 · 예산서')
      ).toBeInTheDocument();
      expect(ontoContainer.textContent).not.toContain('사이버네틱스 환류 순회');
      expect(
        screen.getByPlaceholderText('문서명 · 사업명 · 부서명 · 지적사항 검색')
      ).toBeInTheDocument();

      const { container: drawerContainer } = render(
        <AdminOntologyDrawer
          isOpen={true}
          onClose={jest.fn()}
          node={{
            id: 'POL-TEST-1',
            title: '2026 양재천 건강 페스티벌 추진계획',
            department: '보건행정과',
            year: 2026,
            stage: 'POLICY_DIRECTIVE',
            project: '01_양재천_페스티벌',
            budgetAmount: 60000000,
            objectives: [],
            targetQuotas: [],
          } as any}
        />
      );
      fireEvent.click(screen.getByText('6대 도메인 연계'));
      expect(drawerContainer.textContent).not.toContain('해당 윈도우 폴더를 즉시 탐색합니다');
      expect(drawerContainer.textContent).not.toContain('작업기억 보드로 전환합니다');
      expect(drawerContainer.textContent).not.toContain('번다운을 실시간 확인합니다');
      expect(drawerContainer.textContent).toContain('실무 폴더 · 마스터 아카이브 원본(HWPX · PDF) · 위치 열기');

      const { container: weeklyContainer } = render(<WeeklyReportManager />);
      expect(weeklyContainer.textContent).toContain('주간업무 실적 · 계획');
      expect(weeklyContainer.textContent).not.toContain('등록된 업무 실적이 없습니다.');

      // 4. CommandPalette concise navigation, particle-free category labels & project module jump
      const { container: cpContainer } = render(
        <CommandPalette
          isOpen={true}
          onClose={jest.fn()}
          onSelectModule={jest.fn()}
          tasks={[{ id: 't1', title: '예산 점검', status: 'todo', priority: 'high', category: '예산' } as any]}
        />
      );
      expect(cpContainer.textContent).not.toContain('업무 (Tasks)');
      expect(cpContainer.textContent).not.toContain('재고 관리');
      const cpInput = screen.getByPlaceholderText('모듈 · 업무 · 예산 · 연락처 검색');
      fireEvent.change(cpInput, { target: { value: 'simulator' } });
      expect(screen.getAllByText('집행 잔액 - 예정액 · 과목별 예상 잔액').length).toBeGreaterThanOrEqual(1);

      // 5. BudgetSimulator & SimulationInputForm internal copy verification
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const { container: simContainer } = render(
        <QueryClientProvider client={queryClient}>
          <BudgetSimulator />
        </QueryClientProvider>
      );
      expect(simContainer.textContent).not.toContain('Commitment Balance Engine');
      expect(simContainer.textContent).not.toContain('실시간 시뮬레이션합니다');
      expect(simContainer.textContent).not.toContain('세부사업과 통계목을 먼저 선택하세요');
      expect(simContainer.textContent).not.toContain('시뮬레이션에 반영됩니다');
      expect(simContainer.textContent).not.toContain('지출 재원 및 경비 구분');
      expect(simContainer.textContent).not.toContain('산출근거 및 비고');
      expect(simContainer.textContent).toContain('지출 재원 · 경비 구분');
      expect(simContainer.textContent).toContain('산출근거 · 비고 (선택)');
      expect(screen.getAllByText('집행 잔액 - 예정액 · 과목별 예상 잔액').length).toBeGreaterThanOrEqual(2);

      // 6. ProjectManagementPage (both overview empty state AND scheduler tab)
      const { container: projContainer } = render(
        <QueryClientProvider client={queryClient}>
          <ProjectManagementPage />
        </QueryClientProvider>
      );
      expect(projContainer.textContent).not.toContain('조율합니다');
      expect(projContainer.textContent).not.toContain('수동 관리를 시작하세요');
      expect(projContainer.textContent).not.toContain('직접 수동으로 제어하실 수 있습니다');
      expect(projContainer.textContent).toContain('좌측 사업 선택 → 추진 현황 · 체크리스트 · 연계 업무 조회');
      expect(screen.getAllByText('사업 · 일정 관리').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('단위사업 개요 · 체크리스트 · 일정 플래너').length).toBeGreaterThanOrEqual(1);

      // Switch to '일정 플래너' tab and verify WeeklyScheduler also has zero verbose prose
      fireEvent.click(screen.getByText('일정 플래너'));
      expect(await screen.findByText('보안 · 회의 · 교육 일정 주간 · 월간 · 타임테이블 관리')).toBeInTheDocument();
      expect(projContainer.textContent).not.toContain('다각도 뷰로 통합 조율합니다');

      // 7. SchedulePresetManageModal, AppLogModal & SecurityLockScreen
      const { container: presetModalContainer } = render(
        <SchedulePresetManageModal
          isOpen={true}
          onClose={jest.fn()}
          onSelectPreset={jest.fn()}
        />
      );
      expect(presetModalContainer.textContent).toContain('원클릭 자동 입력 · 자주 쓰는 일정 저장');
      expect(presetModalContainer.textContent).not.toContain('등록해 재사용합니다');

      const { container: logModalContainer } = render(
        <QueryClientProvider client={queryClient}>
          <AppLogModal isOpen={true} onClose={jest.fn()} appMode="VITAL" />
        </QueryClientProvider>
      );
      expect(logModalContainer.textContent).toContain('수집 로그 없음 · 데몬 대기 중');
      expect(logModalContainer.textContent).not.toContain('로그 기록이 비어있습니다');

      const { container: lockContainer } = render(
        <SecurityLockScreen hasSetupPIN={true} failCount={0} onVerify={jest.fn()} onSetup={jest.fn()} />
      );
      expect(lockContainer.textContent).toContain('4자리 PIN 입력');
      expect(lockContainer.textContent).not.toContain('설정하신 4자리 PIN을 입력하세요');
    });

    it('passes AST UI Copy Design Harness across all src/components/**/*.tsx files and catches inflated titles/prose in synthetic JSX', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { auditUiCopyDirectory, auditUiCopySource } = require('@/../scripts/audit-ui-copy');

      const badSample = auditUiCopySource(
        'src/components/Sample.tsx',
        `export function Sample({ empty }: { empty: boolean }) {
          return (
            <div>
              <SectionHeader title="통합 행정 지식 쇼케이스" subtitle="자세히 확인해 보세요." />
              <h1><span className="dot" /><span>행정 문서 업무 온톨로지 탐색기</span></h1>
              <p>등록된 항목이 없습니다.</p>
              <p>{empty ? '검색 결과가 없습니다.' : '정상'}</p>
              <span>주요 사업목표 (Objectives)</span>
            </div>
          );
        }`
      );
      expect(badSample.violations.length).toBeGreaterThanOrEqual(6);

      const goodSample = auditUiCopySource(
        'src/components/Sample.tsx',
        `export function Sample({ empty }: { empty: boolean }) {
          return (
            <div>
              <SectionHeader title="행정 게시판" />
              <h1><span className="dot" /><span>문서 관계도</span></h1>
              <p>등록 항목 없음</p>
              <p>{empty ? '검색 결과 없음' : '정상'}</p>
              <span>주요 사업목표</span>
            </div>
          );
        }`
      );
      expect(goodSample.violations).toEqual([]);

      const liveAudit = auditUiCopyDirectory();
      expect(liveAudit.passed).toBe(true);
      expect(liveAudit.violationCount).toBe(0);
    });
  });
});
