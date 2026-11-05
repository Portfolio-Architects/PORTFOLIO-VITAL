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

    it('renders minimalist 1px cards without legacy glass-panel, rounded-[2rem], or scale hover effects', () => {
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

      // Verify KPI figures are rendered intact with tabular-nums
      expect(screen.getAllByText('100,000,000').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('65,400,000').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('34,600,000').length).toBeGreaterThanOrEqual(2);
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
      expect(screen.getByText('세부사업별 예산 편성 현황')).toBeInTheDocument();
      expect(screen.getByText('총 편성 예산')).toBeInTheDocument();
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

    it('aligns donut chart slices and breakdown list colors and share percentages across multiple categories', () => {
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
          allocated: 60000000,
          spent: 30000000,
          remaining: 30000000,
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
          allocated: 40000000,
          spent: 10000000,
          remaining: 30000000,
        },
      ] as any[];

      render(
        <PortfolioDashboardView
          budgetCategories={multiCategories}
          budgetEntries={[]}
          appMode="VITAL"
        />
      );

      // Verify share percentages (60.0% and 40.0%) in breakdown list
      expect(screen.getByText('60.0%')).toBeInTheDocument();
      expect(screen.getByText('40.0%')).toBeInTheDocument();

      // Verify color swatches match VITAL_THEME_COLORS
      const swatches = screen.getAllByTestId('breakdown-color-swatch');
      expect(swatches).toHaveLength(2);
      expect(swatches[0]).toHaveStyle({ backgroundColor: '#0f172a' });
      expect(swatches[1]).toHaveStyle({ backgroundColor: '#2563eb' });

      // Filter by specific detailed project and verify breakdown updates to formationItem + category name
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '강남 AI 메디헬스센터 운영' } });
      expect(screen.getByText('기간제근로자등보수')).toBeInTheDocument();
      expect(screen.getByText('운동사 인건비')).toBeInTheDocument();
      expect(screen.getAllByText('100.0%').length).toBeGreaterThanOrEqual(2);
    });

    it('preserves 0-won mathematical parity when categories lack detailedProject, avoids 7-slice circular color collision, and formats <0.1% positive shares cleanly', () => {
      const edgeCategories = [
        { id: 'c1', detailedProject: '사업1', name: '항목1', totalBudget: 20000000 },
        { id: 'c2', detailedProject: '사업2', name: '항목2', totalBudget: 20000000 },
        { id: 'c3', detailedProject: '사업3', name: '항목3', totalBudget: 20000000 },
        { id: 'c4', detailedProject: '사업4', name: '항목4', totalBudget: 20000000 },
        { id: 'c5', detailedProject: '사업5', name: '항목5', totalBudget: 10000000 },
        { id: 'c6', detailedProject: '사업6', name: '항목6', totalBudget: 9970000 },
        // Missing detailedProject (falls back to unitProject '미분류단위사업') with tiny positive budget (0.03% -> '<0.1%')
        { id: 'c7', detailedProject: '', unitProject: '미분류단위사업', name: '소액항목', totalBudget: 30000 },
      ] as any[];

      render(
        <PortfolioDashboardView
          budgetCategories={edgeCategories}
          budgetEntries={[]}
          appMode="VITAL"
        />
      );

      // Missing detailedProject category is NOT dropped; its fallback project name and <0.1% share are rendered
      expect(screen.getAllByText('미분류단위사업').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('30,000')).toBeInTheDocument();
      expect(screen.getByText('<0.1%')).toBeInTheDocument();

      // 7 items -> 7th swatch (idx 6) must NOT collide with 1st swatch (idx 0, #0f172a) or 6th swatch (idx 5, #94a3b8)
      const swatches = screen.getAllByTestId('breakdown-color-swatch');
      expect(swatches).toHaveLength(7);
      expect(swatches[0]).toHaveStyle({ backgroundColor: '#0f172a' });
      expect(swatches[5]).toHaveStyle({ backgroundColor: '#94a3b8' });
      expect(swatches[6]).toHaveStyle({ backgroundColor: '#2563eb' });
    });

    it('renders 4 KPI cards and ContactsBox placeholder in PortfolioDashboardViewSkeleton and removes English clichés in ProtectedApp.tsx', () => {
      render(<PortfolioDashboardViewSkeleton />);
      const kpiSkeletons = screen.getAllByTestId('dashboard-skeleton-kpi-card');
      expect(kpiSkeletons).toHaveLength(4);
      expect(screen.getByTestId('dashboard-skeleton-contacts')).toBeInTheDocument();

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

