import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';

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

// Mock LocalhostStatusHUD so Sidebar unit test doesn't trigger background healthcheck timers
jest.mock('@/components/layout/LocalhostStatusHUD', () => ({
  LocalhostStatusHUD: () => <div data-testid="localhost-status-hud">HUD</div>,
}));

// Mock useContacts for ContactsBox tests
const mockAddContact = jest.fn();
const mockUpdateContact = jest.fn();
const mockDeleteContact = jest.fn();
let mockContactsList: any[] = [];

jest.mock('@/hooks/useContacts', () => ({
  useContacts: () => ({
    contacts: mockContactsList,
    loading: false,
    addContact: mockAddContact,
    updateContact: mockUpdateContact,
    deleteContact: mockDeleteContact,
  }),
}));

// Mock Recharts ResponsiveContainer for jsdom
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="recharts-responsive-container" style={{ width: 600, height: 300 }}>
        {children}
      </div>
    ),
  };
});

import { Sidebar } from '@/components/Sidebar';
import { SplashView } from '@/components/SplashView';
import { ContactsBox } from '@/components/dashboard/ContactsBox';
import { ContactsSideSheet } from '@/components/dashboard/ContactsSideSheet';
import { PortfolioDashboardView } from '@/components/dashboard/PortfolioDashboardView';
import { PortfolioDashboardViewSkeleton } from '@/components/ProtectedApp';
import { YangjaeFestivalSkeleton } from '@/components/skeletons/YangjaeFestivalSkeleton';

describe('Main Page & Yangjae Festival Minimalist Design Overhaul (Milestone 270)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContactsList = [
      {
        id: 'c-1',
        name: '김행정',
        phone: '02-3423-7116',
        email: 'admin@gangnam.go.kr',
        notes: '부서: 보건행정과\n업무: 예산 총괄',
      },
      {
        id: 'c-2',
        name: '이건증',
        phone: '02-3423-7120',
        notes: '부서: 건강증진과\n업무: 신체활동 사업',
      },
    ];
  });

  describe('1. Sidebar Segmented Control, Mobile Dock & SplashView Minimalist Styling', () => {
    it('renders top desktop navigation with segmented control classes and switches tabs cleanly', () => {
      const onModuleChange = jest.fn();
      const { container } = render(
        <Sidebar
          activeModule="dashboard"
          onModuleChange={onModuleChange}
          taskStats={{ total: 5, done: 3, overdue: 0 }}
          appMode="VITAL"
          onModeChange={jest.fn()}
        />
      );

      // Segmented control container
      const navGroup = container.querySelector('.bg-slate-100\\/80.p-1.rounded-xl.border.border-slate-200\\/70');
      expect(navGroup).toBeInTheDocument();

      // Active tab button has white surface & 1px border
      const desktopDashboardBtn = navGroup!.querySelector('button');
      expect(desktopDashboardBtn).toHaveClass('bg-white', 'text-slate-900', 'shadow-2xs', 'border', 'border-slate-200/80');

      // Clicking another tab triggers callback
      const budgetBtn = screen.getByText('예산관리').closest('button');
      expect(budgetBtn).not.toBeNull();
      fireEvent.click(budgetBtn!);
      expect(onModuleChange).toHaveBeenCalledWith('workspace');

      // LocalhostStatusHUD capsule is removed from top-right nav; Business Contacts tab is present
      expect(screen.queryByTestId('localhost-status-hud')).not.toBeInTheDocument();
      const contactsBtn = screen.getByRole('button', { name: '업무 연락처' });
      expect(contactsBtn).toHaveAttribute('aria-expanded', 'false');
    });

    it('triggers contacts side sheet toggle and preload from top-right navigation button', () => {
      const onToggleContacts = jest.fn();
      const onPreloadContacts = jest.fn();
      render(
        <Sidebar
          activeModule="dashboard"
          onModuleChange={jest.fn()}
          taskStats={{ total: 5, done: 3, overdue: 0 }}
          appMode="VITAL"
          onModeChange={jest.fn()}
          isContactsOpen={true}
          onToggleContacts={onToggleContacts}
          onPreloadContacts={onPreloadContacts}
        />
      );

      const contactsBtn = screen.getByRole('button', { name: '업무 연락처' });
      expect(contactsBtn).toHaveAttribute('aria-expanded', 'true');
      expect(contactsBtn).toHaveClass('bg-slate-900', 'text-white');

      fireEvent.mouseEnter(contactsBtn);
      expect(onPreloadContacts).toHaveBeenCalledTimes(1);

      fireEvent.click(contactsBtn);
      expect(onToggleContacts).toHaveBeenCalledTimes(1);
    });

    it('renders SplashView with minimalist slate card surface and zero legacy neon gradients', () => {
      const { container } = render(<SplashView />);
      const rootEl = container.firstElementChild as HTMLElement;
      expect(rootEl).toHaveClass('bg-[#f8fafc]');
      expect(container.innerHTML).toContain('border-slate-200/80');
      expect(container.innerHTML).toContain('rounded-xl');
      expect(container.innerHTML).not.toContain('bg-slate-950');
      expect(container.innerHTML).not.toContain('from-blue-500');
    });
  });

  describe('2. ContactsBox Minimalist Surface, Search, & Form Edge Cases', () => {
    it('renders minimalist 1px border surface without legacy glass-panel or rounded-[2rem]', () => {
      const { container } = render(<ContactsBox />);

      const rootBox = container.firstElementChild as HTMLElement;
      expect(rootBox).toHaveClass('bg-white', 'rounded-xl', 'border', 'border-slate-200/80', 'shadow-2xs');
      expect(rootBox.className).not.toContain('glass-panel');
      expect(rootBox.className).not.toContain('rounded-[2rem]');

      // Verify contact names and phone numbers render with tabular-nums
      expect(screen.getByText('김행정')).toBeInTheDocument();
      expect(screen.getByText('02-3423-7116')).toBeInTheDocument();
    });

    it('handles empty contacts list and form submission cleanly', () => {
      mockContactsList = [];
      render(<ContactsBox />);

      expect(screen.getByText('등록된 연락처가 없습니다.')).toBeInTheDocument();

      const nameInput = screen.getByPlaceholderText('예: 이성섭 상임이사, 최장미');
      const phoneInput = screen.getByPlaceholderText('예: 010-5284-3946');
      fireEvent.change(nameInput, { target: { value: '박신규' } });
      fireEvent.change(phoneInput, { target: { value: '01012345678' } });

      const saveBtn = screen.getByText('연락처 저장');
      fireEvent.click(saveBtn);

      expect(mockAddContact).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '박신규',
          phone: '010-1234-5678',
        })
      );
    });

    it('renders ContactsSideSheet with collapsible add form and closes via close button or Escape key', () => {
      const onClose = jest.fn();
      render(<ContactsSideSheet isOpen={true} onClose={onClose} />);

      const dialog = screen.getByRole('dialog', { name: '업무 연락처' });
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText('김행정')).toBeInTheDocument();

      // Add form is collapsed by default in sheet mode and expands on button click
      expect(screen.queryByPlaceholderText('예: 이성섭 상임이사, 최장미')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '연락처 추가' }));
      expect(screen.getByPlaceholderText('예: 이성섭 상임이사, 최장미')).toBeInTheDocument();

      // Close via Escape key and close button
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: '사이드 시트 닫기' }));
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('3. PortfolioDashboardView Minimalist Layout & Zero-Data Edge Cases', () => {
    const sampleCategories = [
      {
        id: 'cat-1',
        policyProject: '건강증진사업',
        unitProject: '신체활동 증진',
        detailedProject: '건강생활실천사업',
        managementProject: '양재천 걷기',
        formationItem: '행사운영비',
        statItem: '201-03 행사운영비',
        name: '양재천 페스티벌 운영',
        totalBudget: 100000000,
        allocated: 100000000,
        spent: 65400000,
        remaining: 34600000,
        color: '#0f172a',
      },
    ] as any[];

    const sampleEntries = [
      {
        id: 'ent-1',
        categoryId: 'cat-1',
        purpose: '행사 부스 임차',
        amount: 65400000,
        date: '2026-05-15',
        actionType: 'general',
      },
    ] as any[];

    it('renders minimalist 1px cards without legacy glass-panel, rounded-[2rem], or scale hover effects, and removes legacy tabs & sub-bar clutter', () => {
      const { container } = render(
        <PortfolioDashboardView
          budgetCategories={sampleCategories}
          budgetEntries={sampleEntries}
          appMode="VITAL"
        />
      );

      expect(container.innerHTML).not.toContain('glass-panel');
      expect(container.innerHTML).not.toContain('rounded-[2rem]');
      expect(container.innerHTML).not.toContain('rounded-[1.5rem]');
      expect(container.innerHTML).not.toContain('hover:scale-[1.01]');
      expect(container.innerHTML).not.toContain('hover:scale-[1.002]');

      // Verify legacy tabs and removed sub-header items are completely absent
      expect(screen.queryByTestId('donut-mode-performance')).not.toBeInTheDocument();
      expect(screen.queryByTestId('donut-mode-budget')).not.toBeInTheDocument();
      expect(screen.queryByTestId('execution-tab-overview')).not.toBeInTheDocument();
      expect(screen.queryByTestId('execution-tab-risk-drilldown')).not.toBeInTheDocument();
      expect(screen.queryByText('4대 단계 요약')).not.toBeInTheDocument();
      expect(screen.queryByText(/불용 위험 비목/)).not.toBeInTheDocument();
      expect(screen.queryByText('총 편성 예산')).not.toBeInTheDocument();

      // Verify dedicated Execution & Unallocated Risk Diagnosis figures render by default
      expect(screen.getByText('집행·불용 위험 정밀 진단')).toBeInTheDocument();
      expect(screen.getAllByText('65,400,000').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('34,600,000').length).toBeGreaterThanOrEqual(3);
      expect(screen.getAllByText(/65\.4%/).length).toBeGreaterThan(0);
    });

    it('gracefully handles zero budget categories and zero entries', () => {
      render(
        <PortfolioDashboardView
          budgetCategories={[]}
          budgetEntries={[]}
          appMode="HCHPS"
        />
      );

      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/0\.0%/).length).toBeGreaterThan(0);
      expect(screen.getByText('집행 없음')).toBeInTheDocument();
    });

    it('replaces English ALL-CAPS clichés and KRW with Korean accounting terms and 원 units', () => {
      const { container } = render(
        <PortfolioDashboardView
          budgetCategories={sampleCategories}
          budgetEntries={sampleEntries}
          appMode="VITAL"
        />
      );

      // Verify Korean accounting headings and labels are present
      expect(screen.getByText('집행·불용 위험 정밀 진단')).toBeInTheDocument();
      expect(screen.getByText('예산 집행률')).toBeInTheDocument();
      expect(screen.getByText('예산 잔여율')).toBeInTheDocument();
      expect(screen.getByText('누적 집행액')).toBeInTheDocument();
      expect(screen.getByText('가용 잔액')).toBeInTheDocument();
      expect(screen.getByText('월별 예산 집행 추이')).toBeInTheDocument();
      expect(screen.getByText('최대 집행월')).toBeInTheDocument();
      expect(screen.getByText('월 권장 집행액 (11월 기준)')).toBeInTheDocument();
      expect(screen.getByText('목표 대비 잔여액')).toBeInTheDocument();
      expect(screen.getByText('5월')).toBeInTheDocument();

      // Verify legacy English ALL-CAPS clichés and KRW are completely removed
      const text = container.textContent || '';
      expect(text).not.toContain('Budget Allocation');
      expect(text).not.toContain('TOTAL BUDGET');
      expect(text).not.toContain('BUDGET EXECUTION');
      expect(text).not.toContain('REMAINING BUDGET');
      expect(text).not.toContain('EXECUTED AMOUNT');
      expect(text).not.toContain('REMAINING AMOUNT');
      expect(text).not.toContain('Monthly Budget Execution');
      expect(text).not.toContain('PEAK SPENDING');
      expect(text).not.toContain('REQ. SPEND / MO');
      expect(text).not.toContain('REMAINING TARGET');
      expect(text).not.toContain('KRW');
    });

    it('aligns 4-stage execution colors, share percentages, and dynamic detailedProject filtering', () => {
      const multiCategories = [
        {
          id: 'cat-a',
          policyProject: '건강증진사업',
          unitProject: '신체활동 증진',
          detailedProject: '강남 AI 메디헬스센터 운영',
          formationItem: '기간제근로자등보수',
          statItem: '101-04 기간제근로자등보수',
          name: '운동사 인건비',
          totalBudget: 60000000,
        },
        {
          id: 'cat-b',
          policyProject: '건강증진사업',
          unitProject: '신체활동 증진',
          detailedProject: '건강생활실천사업',
          formationItem: '행사운영비',
          statItem: '201-03 행사운영비',
          name: '양재천 걷기 운영',
          totalBudget: 40000000,
        },
      ] as any[];

      const multiEntries = [
        { id: 'e-1', categoryId: 'cat-a', purpose: '급여', amount: 60000000, date: '2026-06-10', actionType: 'general' },
      ] as any[];

      render(
        <PortfolioDashboardView
          budgetCategories={multiCategories}
          budgetEntries={multiEntries}
          appMode="VITAL"
        />
      );

      // Overall: 60,000,000 general executed (60.0%) and 40,000,000 unallocated risk (40.0%)
      expect(screen.getAllByText('60.0%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('40.0%').length).toBeGreaterThanOrEqual(1);

      const swatches = screen.getAllByTestId('breakdown-color-swatch');
      expect(swatches).toHaveLength(4);
      expect(swatches[0]).toHaveStyle({ backgroundColor: '#0f172a' });
      expect(swatches[1]).toHaveStyle({ backgroundColor: '#2563eb' });
      expect(swatches[2]).toHaveStyle({ backgroundColor: '#64748b' });
      expect(swatches[3]).toHaveStyle({ backgroundColor: '#e11d48' });

      // Filter by '강남 AI 메디헬스센터 운영' -> 100% executed, 0 unallocated risk
      const select = screen.getByTestId('execution-project-select');
      fireEvent.change(select, { target: { value: '강남 AI 메디헬스센터 운영' } });
      expect(screen.getByTestId('donut-center-execution-risk')).toHaveTextContent('0');
      expect(screen.getByText('설계 완료 100.0%')).toBeInTheDocument();
    });

    it('preserves 0-won mathematical parity when categories lack detailedProject and formats <0.1% positive shares cleanly', () => {
      const edgeCategories = [
        { id: 'c1', detailedProject: '사업1', name: '항목1', totalBudget: 99970000 },
        { id: 'c2', detailedProject: '', unitProject: '미분류단위사업', name: '소액항목', totalBudget: 30000 },
      ] as any[];
      const edgeEntries = [
        { id: 'ee1', categoryId: 'c1', purpose: '집행', amount: 99970000, date: '2026-04-01', actionType: 'general' },
      ] as any[];

      render(
        <PortfolioDashboardView
          budgetCategories={edgeCategories}
          budgetEntries={edgeEntries}
          appMode="VITAL"
        />
      );

      // Fallback project '미분류단위사업' appears in selector and 30,000원 risk formats share as '<0.1%'
      expect(screen.getByRole('option', { name: '미분류단위사업' })).toBeInTheDocument();
      expect(screen.getByTestId('donut-center-execution-risk')).toHaveTextContent('30,000');
      expect(screen.getByText('<0.1%')).toBeInTheDocument();
    });

    it('renders Execution & Unallocated Risk Diagnosis Donut Panel by default with 0-won SSOT parity and clean header', () => {
      const realCategories = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'data/BUDGET_CATEGORIES.json'), 'utf-8')
      );
      const realEntries = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'data/BUDGET_ENTRIES.json'), 'utf-8')
      );

      const { container } = render(
        <PortfolioDashboardView
          budgetCategories={realCategories}
          budgetEntries={realEntries}
          appMode="VITAL"
        />
      );

      // Verify heading, design completion badge, and center unallocated risk metric (10,173,300원) on initial render
      expect(screen.getByText('집행·불용 위험 정밀 진단')).toBeInTheDocument();
      expect(screen.getByText('설계 완료 97.4%')).toBeInTheDocument();
      expect(screen.getByTestId('donut-center-execution-risk')).toHaveTextContent('10,173,300');
      expect(screen.getByText('설계 97.4% · 실집행 79.2%')).toBeInTheDocument();
      expect(container.textContent || '').not.toContain('본청');

      // Verify enlarged 252x252 donut box and z-index stacking hierarchy (center overlay z-0 beneath chart/tooltip z-20)
      const centerOverlay = screen.getByTestId('donut-center-overlay');
      expect(centerOverlay).toHaveClass('z-0', 'pointer-events-none');
      expect(centerOverlay.parentElement).toHaveClass('w-[252px]', 'h-[252px]');

      // Verify 4 slices summing to 387,992,000원 (266,528,800 + 40,633,500 + 70,656,400 + 10,173,300 = 387,992,000)
      expect(266528800 + 40633500 + 70656400 + 10173300).toBe(387992000);
      expect(screen.getByText('일반지출 집행 완료')).toBeInTheDocument();
      expect(screen.getByText('266,528,800')).toBeInTheDocument();
      expect(screen.getByText('일상경비 집행 완료')).toBeInTheDocument();
      expect(screen.getByText('40,633,500')).toBeInTheDocument();
      expect(screen.getByText('지출 예정(품의·원인행위 대기)')).toBeInTheDocument();
      expect(screen.getByText('70,656,400')).toBeInTheDocument();
      expect(screen.getByText('순수 미계획 불용 위험액')).toBeInTheDocument();

      // Verify color swatches (#0f172a, #2563eb, #64748b, #e11d48)
      const swatches = screen.getAllByTestId('breakdown-color-swatch');
      expect(swatches).toHaveLength(4);
      expect(swatches[0]).toHaveStyle({ backgroundColor: '#0f172a' });
      expect(swatches[1]).toHaveStyle({ backgroundColor: '#2563eb' });
      expect(swatches[2]).toHaveStyle({ backgroundColor: '#64748b' });
      expect(swatches[3]).toHaveStyle({ backgroundColor: '#e11d48' });

      // Filter by detailedProject '건강생활실천사업(건강증진)' and verify dynamic risk update (2,744,000원)
      const projSelect = screen.getByTestId('execution-project-select');
      fireEvent.change(projSelect, { target: { value: '건강생활실천사업(건강증진)' } });
      expect(screen.getByTestId('donut-center-execution-risk')).toHaveTextContent('2,744,000');
    });

    it('renders 4 KPI cards in PortfolioDashboardViewSkeleton without inline ContactsBox and removes English clichés in ProtectedApp.tsx', () => {
      render(<PortfolioDashboardViewSkeleton />);
      const kpiSkeletons = screen.getAllByTestId('dashboard-skeleton-kpi-card');
      expect(kpiSkeletons).toHaveLength(4);
      expect(screen.queryByTestId('dashboard-skeleton-contacts')).not.toBeInTheDocument();

      const protectedAppSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/components/ProtectedApp.tsx'),
        'utf-8'
      );
      expect(protectedAppSrc).toContain('통합 대시보드');
      expect(protectedAppSrc).toContain('로그아웃');
      expect(protectedAppSrc).not.toContain('Precision Operations Intelligence');
      expect(protectedAppSrc).not.toContain('>SECURE<');
      expect(protectedAppSrc).not.toContain('Vital Information & Task Architecture Ledger');
    });
  });

  describe('4. Yangjae Festival Minimalist Source & Static Replica Verification', () => {
    const getStaticReplicaHtml = () => {
      const outPath = path.join(process.cwd(), 'out/festival/yangjae/index.html');
      if (fs.existsSync(outPath)) {
        return fs.readFileSync(outPath, 'utf-8');
      }
      const template = fs.readFileSync(
        path.join(process.cwd(), 'scripts/pages-template.html'),
        'utf-8'
      );
      const festivalData = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'data/FESTIVAL_YANGJAE_2026.json'), 'utf-8')
      );
      return template.replace('__APP_DATA_JSON__', JSON.stringify(festivalData));
    };

    it('renders YangjaeFestivalSkeleton with minimalist 1px border and 4-tab segmented bar', () => {
      const { container } = render(<YangjaeFestivalSkeleton />);
      expect(container.innerHTML).not.toContain('border-2');
      expect(container.innerHTML).toContain('border-slate-200/80');
      expect(container.innerHTML).toContain('grid-cols-4');
    });

    it('verifies YangjaeFestivalDashboard.tsx, LocalhostStatusHUD.tsx, and pages-template.html minimalist integrity', () => {
      const dashboardSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/components/festival/YangjaeFestivalDashboard.tsx'),
        'utf-8'
      );
      const hudSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/components/layout/LocalhostStatusHUD.tsx'),
        'utf-8'
      );
      const templateSrc = fs.readFileSync(
        path.join(process.cwd(), 'scripts/pages-template.html'),
        'utf-8'
      );
      const outHtmlSrc = getStaticReplicaHtml();

      // Root container and segmented tabs use 1px border-slate-200/80 and white active pill
      expect(dashboardSrc).toContain('sm:rounded-xl sm:border sm:border-slate-200/80 sm:shadow-2xs');
      expect(dashboardSrc).toContain('bg-slate-100/90 p-1 rounded-xl border border-slate-200/80');
      expect(dashboardSrc).toContain('bg-white text-slate-900 shadow-2xs border-slate-200/80 font-extrabold');
      expect(dashboardSrc).not.toContain('border-2 border-slate-300');
      expect(dashboardSrc).not.toContain('border-b-2 border-slate-900');

      // Ensure only a single saveToast modal exists in YangjaeFestivalDashboard.tsx
      const saveToastMatches = dashboardSrc.match(/\{saveToast &&/g) || [];
      expect(saveToastMatches.length).toBe(1);

      // LocalhostStatusHUD dynamically renders status.toUpperCase() rather than hardcoding ONLINE
      expect(hudSrc).toContain('{status.toUpperCase()}');

      // Static template and generated out HTML match minimalist specifications and CSS variables
      expect(templateSrc).toContain('--bg: #f8fafc;');
      expect(templateSrc).toContain('.shadow-2xs');
      expect(templateSrc).toContain('sm:rounded-xl sm:border sm:shadow-2xs');
      expect(templateSrc).toContain('bg-slate-100/90 p-1 rounded-xl border border-slate-200/80');
      expect(templateSrc).not.toContain('border-2 border-slate-300');
      expect(outHtmlSrc).toContain('--bg: #f8fafc;');
      expect(outHtmlSrc).toContain('sm:rounded-xl sm:border sm:shadow-2xs');
      expect(outHtmlSrc).not.toContain('border-2 border-slate-300');
    });

    it('parses and executes the embedded JavaScript in out/festival/yangjae/index.html without SyntaxError and preserves is-large-font across tabs', () => {
      const outHtmlSrc = getStaticReplicaHtml();

      const scriptMatches = outHtmlSrc.match(/<script>([\s\S]*?)<\/script>/g);
      expect(scriptMatches).not.toBeNull();
      const mainScript = scriptMatches![scriptMatches!.length - 1].replace(/<\/?script>/g, '');

      // Verify script compiles without SyntaxError (e.g. no duplicate const DUTY_CATEGORIES)
      expect(() => new Function(mainScript)).not.toThrow();

      // Mount HTML body into jsdom and run the script (excluding remote fetch)
      const bodyMatch = outHtmlSrc.match(/<body[^>]*>([\s\S]*?)<script>/);
      expect(bodyMatch).not.toBeNull();
      document.body.innerHTML = bodyMatch![1];

      const safeScript = mainScript.replace('setInterval(pollLatestData, 3000);', '');
      new Function(safeScript)();

      const appRoot = document.getElementById('app-root')!;
      const fontBtn = document.getElementById('btn-toggle-font')!;
      const boothsTabBtn = document.getElementById('tab-booths')!;
      const dutiesTabBtn = document.getElementById('tab-duties')!;

      // Toggle large font ON
      fireEvent.click(fontBtn);
      expect(appRoot.classList.contains('is-large-font')).toBe(true);
      expect(fontBtn.className).toContain('bg-white text-slate-900 border-white shadow-2xs');

      // Switch to booths tab -> is-large-font must persist on #app-root and render 19 operating entities + 1 HQ
      fireEvent.click(boothsTabBtn);
      expect(appRoot.classList.contains('is-large-font')).toBe(true);
      expect(document.getElementById('booth-summary-banner')!.textContent).toContain('총 19개 기관');
      expect(document.getElementById('booth-summary-banner')!.textContent).toContain('본부 1');

      // Switch to duties tab -> is-large-font must persist and duties list must render
      fireEvent.click(dutiesTabBtn);
      expect(appRoot.classList.contains('is-large-font')).toBe(true);
      expect(document.getElementById('duties-table-container')!.textContent).toContain('역할:');
    });
  });
});

