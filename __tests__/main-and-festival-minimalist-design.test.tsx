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
    });
  });

  describe('4. Yangjae Festival Minimalist Source & Static Replica Verification', () => {
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
      const outHtmlSrc = fs.readFileSync(
        path.join(process.cwd(), 'out/festival/yangjae/index.html'),
        'utf-8'
      );

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
      const outHtmlSrc = fs.readFileSync(
        path.join(process.cwd(), 'out/festival/yangjae/index.html'),
        'utf-8'
      );

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

