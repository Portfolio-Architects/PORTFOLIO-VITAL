import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
  global.TextDecoder = TextDecoder as any;
}

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AdminOntologyGraph,
  AdminPolicyEntity,
  AdminOutcomeEntity,
  AdminAuditEntity,
  AdminBudgetPlanEntity,
  AdminWeeklyWorkEntity,
  AdminOntologyEdge,
} from '@/lib/ontology/admin-types';
import { AdminOntologyDrawer } from '@/components/ontology/AdminOntologyDrawer';
import { AdminOntologyExplorer } from '@/components/ontology/AdminOntologyExplorer';

// Canvas 2D context mock for JSDOM
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

describe('Milestone 2: AdminOntologyDrawer & AdminOntologyExplorer Test Suite', () => {
  // Test Fixtures
  const mockPolicyNode: AdminPolicyEntity = {
    id: 'POL-2026-MEDIRUN',
    stage: 'POLICY_DIRECTIVE',
    title: '2026년 서울체력장 및 메디런 운영 기본계획',
    year: 2026,
    department: '보건행정과 건강증진팀',
    project: '04_서울체력장_AI메디헬스_메디런',
    budgetAmount: 1557000000,
    objectives: ['구민 맞춤형 체력인증 및 신체활동 활성화 인프라 구축'],
    targetQuotas: [{ kpi: '체력측정 인원', targetValue: 4500, unit: '명' }],
    sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2026년\\04_서울체력장_AI메디헬스_메디런\\2026년 서울체력장 및 메디런 운영 기본계획.hwpx',
  };

  const mockOutcomeNode: AdminOutcomeEntity = {
    id: 'OUT-2026-MEDIRUN',
    stage: 'OUTCOME_REPORT',
    policyId: 'POL-2026-MEDIRUN',
    title: '2026년 서울체력장 상반기 운영 결과보고',
    year: 2026,
    executionRate: 91.4,
    spentBudget: 1423000000,
    achievements: ['목표 인원 4,500명 대비 4,820명 달성 (달성률 107.1%)'],
    sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2026년\\04_서울체력장_AI메디헬스_메디런\\2026년 서울체력장 상반기 운영 결과보고.hwpx',
  };

  const mockAuditNode: AdminAuditEntity = {
    id: 'AUD-2026-MEDIRUN-01',
    stage: 'AUDIT_REVIEW',
    title: '2026년도 행정사무감사 체력인증센터 운영 지적사항',
    year: 2026,
    auditedOutcomeId: 'OUT-2026-MEDIRUN',
    auditFindings: ['야외 체력프로그램 운영물품 안전관리 규정 보완 요구'],
    correctiveMandates: ['차년도 예산 사업설명서에 안전관리 및 훈련용품 분리 명기'],
    severity: 'WARNING',
    sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2026년\\04_서울체력장_AI메디헬스_메디런\\2026년도 행정사무감사 시정요구서.hwpx',
  };

  const mockBudgetPlanNode: AdminBudgetPlanEntity = {
    id: 'BGT-2027-MEDIRUN',
    stage: 'BUDGET_PLAN',
    title: '2027년도 AI 메디헬스 및 체력인증센터 운영 본예산 사업설명서',
    year: 2027,
    project: '04_서울체력장_AI메디헬스_메디런',
    totalBudget: 1742152000,
    fundingSources: {
      fund: 0,
      city: 0,
      district: 1742152000,
    },
    itemizedBreakdown: [
      { item: '안전관리 및 훈련용품비', amount: 2663000 },
      { item: '프로그램 운영비', amount: 1739489000 },
    ],
    remediatedAuditIds: ['AUD-2026-MEDIRUN-01'],
    sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2026년\\04_서울체력장_AI메디헬스_메디런\\2027년도 사업설명서(신체활동).hwpx',
  };

  const mockWeeklyWorkNode: AdminWeeklyWorkEntity = {
    id: 'WRK-2026-W43-01',
    stage: 'WEEKLY_WORK',
    title: '10월 4주 서울체력장 메디런 운영 주간업무 실적 및 계획',
    date: '2026-10-21',
    category: '04_서울체력장_AI메디헬스_메디런',
    status: 'done',
    relatedPolicyId: 'POL-2026-MEDIRUN',
    sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2026년\\주간업무\\20261021_주간업무보고.hwpx',
  };

  const mockFestivalNode: AdminPolicyEntity = {
    id: 'POL-2026-YANGJAE',
    stage: 'POLICY_DIRECTIVE',
    title: '2026년 양재천 건강 페스티벌 기본계획',
    year: 2026,
    department: '보건행정과 건강증진팀',
    project: '01_양재천_페스티벌',
    budgetAmount: 180000000,
    objectives: ['구민과 함께하는 양재천 건강걷기 및 체험부스 운영'],
    sourceDocPath: 'D:\\Desktop\\공공문서 폴더\\2026년\\01_양재천_페스티벌\\2026년 양재천 페스티벌 추진계획.hwpx',
  };

  const mockEdges: AdminOntologyEdge[] = [
    {
      id: 'e1',
      source: 'POL-2026-MEDIRUN',
      target: 'OUT-2026-MEDIRUN',
      type: 'IMPLEMENTS',
      label: '방침서 계획 실행 종결',
    },
    {
      id: 'e2',
      source: 'OUT-2026-MEDIRUN',
      target: 'AUD-2026-MEDIRUN-01',
      type: 'CRITIQUES',
      label: '사업운영 감사 지적 및 평가',
    },
    {
      id: 'e3',
      source: 'AUD-2026-MEDIRUN-01',
      target: 'BGT-2027-MEDIRUN',
      type: 'MANDATES_IMPROVEMENT',
      label: '시정요구 예산 반영 의무화',
    },
  ];

  const mockGraph: AdminOntologyGraph = {
    policies: [mockPolicyNode, mockFestivalNode],
    outcomes: [mockOutcomeNode],
    audits: [mockAuditNode],
    budgetPlans: [mockBudgetPlanNode],
    weeklyWorks: [mockWeeklyWorkNode],
    edges: mockEdges,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockImplementation(async (url: string, init?: any) => {
      if (typeof url === 'string' && url.includes('/api/archive/open')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, mode: init?.body ? JSON.parse(init.body).mode : 'file' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, graph: mockGraph }),
      };
    }) as any;
  });

  // ==========================================================================
  // Section 1: AdminOntologyDrawer Unit Tests
  // ==========================================================================
  describe('1. AdminOntologyDrawer Unit Verification', () => {
    it('1-1. does not render when isOpen is false or node is null', () => {
      const { container: c1 } = render(
        <AdminOntologyDrawer node={mockPolicyNode} isOpen={false} onClose={jest.fn()} />
      );
      expect(c1).toBeEmptyDOMElement();

      const { container: c2 } = render(
        <AdminOntologyDrawer node={null} isOpen={true} onClose={jest.fn()} />
      );
      expect(c2).toBeEmptyDOMElement();
    });

    it('1-2. renders node title, id, department, year, and stage badge correctly when open', () => {
      render(
        <AdminOntologyDrawer node={mockPolicyNode} isOpen={true} onClose={jest.fn()} />
      );

      expect(screen.getByRole('dialog', { name: /행정 문서 온톨로지 상세 정보/i })).toBeInTheDocument();
      expect(screen.getByText('2026년 서울체력장 및 메디런 운영 기본계획')).toBeInTheDocument();
      expect(screen.getByText('POL-2026-MEDIRUN')).toBeInTheDocument();
      expect(screen.getByText(/소관: 보건행정과 건강증진팀/)).toBeInTheDocument();
      expect(screen.getByText('2026년')).toBeInTheDocument();
      expect(screen.getAllByText(/방침/).length).toBeGreaterThan(0);
    });

    it('1-3. calls onClose when the close button is clicked', () => {
      const onCloseMock = jest.fn();
      render(
        <AdminOntologyDrawer node={mockPolicyNode} isOpen={true} onClose={onCloseMock} />
      );

      const closeBtn = screen.getByRole('button', { name: /닫기/i });
      fireEvent.click(closeBtn);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('1-4. triggers fetch to /api/archive/open with mode "file" when "원본 공문서 열기" is clicked', async () => {
      render(
        <AdminOntologyDrawer node={mockPolicyNode} isOpen={true} onClose={jest.fn()} />
      );

      const openFileBtn =
        screen.queryByTestId('btn-open-source-file') ||
        screen.getByRole('button', { name: /원본 공문서 열기/i });

      expect(openFileBtn).toBeInTheDocument();
      fireEvent.click(openFileBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/archive/open',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              path: mockPolicyNode.sourceDocPath,
              mode: 'file',
            }),
          })
        );
      });
    });

    it('1-5. triggers fetch to /api/archive/open with mode "folder" when "폴더 위치 열기" is clicked', async () => {
      render(
        <AdminOntologyDrawer node={mockPolicyNode} isOpen={true} onClose={jest.fn()} />
      );

      const openFolderBtn =
        screen.queryByTestId('btn-open-source-folder') ||
        screen.getByRole('button', { name: /폴더 위치 열기/i });

      expect(openFolderBtn).toBeInTheDocument();
      fireEvent.click(openFolderBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/archive/open',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              path: mockPolicyNode.sourceDocPath,
              mode: 'folder',
            }),
          })
        );
      });
    });

    it('1-6. calls onNavigateModule("memory") when "작업기억 보드로 이동" is clicked', () => {
      const onNavigateModule = jest.fn();
      render(
        <AdminOntologyDrawer
          node={mockPolicyNode}
          isOpen={true}
          onClose={jest.fn()}
          onNavigateModule={onNavigateModule}
        />
      );

      const jumpMemoryBtn =
        screen.queryByTestId('btn-jump-memory') ||
        screen.getByRole('button', { name: /작업기억.*이동/i });

      expect(jumpMemoryBtn).toBeInTheDocument();
      fireEvent.click(jumpMemoryBtn);
      expect(onNavigateModule).toHaveBeenCalledWith('memory');
    });

    it('1-7. calls onNavigateModule("simulator") when "예산 시뮬레이터로 이동" is clicked', () => {
      const onNavigateModule = jest.fn();
      render(
        <AdminOntologyDrawer
          node={mockBudgetPlanNode}
          isOpen={true}
          onClose={jest.fn()}
          onNavigateModule={onNavigateModule}
        />
      );

      const jumpSimBtn =
        screen.queryByTestId('btn-jump-simulator') ||
        screen.getByRole('button', { name: /예산 시뮬레이터.*이동/i });

      expect(jumpSimBtn).toBeInTheDocument();
      fireEvent.click(jumpSimBtn);
      expect(onNavigateModule).toHaveBeenCalledWith('simulator');
    });

    it('1-8. calls onNavigateModule("workspace") when "예산관리로 이동" is clicked', () => {
      const onNavigateModule = jest.fn();
      render(
        <AdminOntologyDrawer
          node={mockBudgetPlanNode}
          isOpen={true}
          onClose={jest.fn()}
          onNavigateModule={onNavigateModule}
        />
      );

      const jumpBgtBtn =
        screen.queryByTestId('btn-jump-workspace') ||
        screen.getByRole('button', { name: /예산관리.*이동/i });

      expect(jumpBgtBtn).toBeInTheDocument();
      fireEvent.click(jumpBgtBtn);
      expect(onNavigateModule).toHaveBeenCalledWith('workspace');
    });

    it('1-9. calls onSwitchTab("weekly") when "수요일 주간업무 작성으로 이동" is clicked', () => {
      const onSwitchTab = jest.fn();
      render(
        <AdminOntologyDrawer
          node={mockWeeklyWorkNode}
          isOpen={true}
          onClose={jest.fn()}
          onSwitchTab={onSwitchTab}
        />
      );

      const jumpWeeklyBtn =
        screen.queryByTestId('btn-jump-weekly') ||
        screen.getByRole('button', { name: /주간업무.*이동/i });

      expect(jumpWeeklyBtn).toBeInTheDocument();
      fireEvent.click(jumpWeeklyBtn);
      expect(onSwitchTab).toHaveBeenCalledWith('weekly');
    });

    it('1-10. verifies 448px mobile layout compliance without horizontal overflow clipping (Rule S)', () => {
      render(
        <AdminOntologyDrawer node={mockPolicyNode} isOpen={true} onClose={jest.fn()} />
      );

      const dialog = screen.getByRole('dialog', { name: /행정 문서 온톨로지 상세 정보/i });
      // Asserts mobile-first max-width container (max-w-md is 448px)
      expect(dialog).toHaveClass('w-full');
      expect(dialog).toHaveClass('max-w-md');

      // Assert presence of overflow containment for inner scrollable bars
      const breadcrumbBar = dialog.querySelector('.overflow-x-auto');
      expect(breadcrumbBar).not.toBeNull();
    });

    it('1-11. calls onNavigateModule("festival") when Yangjae Festival node is selected', () => {
      const onNavigateModule = jest.fn();
      render(
        <AdminOntologyDrawer
          node={mockFestivalNode}
          isOpen={true}
          onClose={jest.fn()}
          onNavigateModule={onNavigateModule}
        />
      );

      const jumpFestivalBtn =
        screen.queryByTestId('btn-jump-festival') ||
        screen.getByRole('button', { name: /양재천 페스티벌.*이동/i });

      expect(jumpFestivalBtn).toBeInTheDocument();
      fireEvent.click(jumpFestivalBtn);
      expect(onNavigateModule).toHaveBeenCalledWith('festival');
    });
  });

  // ==========================================================================
  // Section 2: AdminOntologyExplorer Props Propagation & Integration Tests
  // ==========================================================================
  describe('2. AdminOntologyExplorer Props Propagation to Drawer', () => {
    it('2-1. passes onNavigateModule and onSwitchTab to AdminOntologyDrawer and executes them on node card selection', async () => {
      const onNavigateModule = jest.fn();
      const onSwitchTab = jest.fn();

      render(
        <AdminOntologyExplorer
          initialGraph={mockGraph}
          onNavigateModule={onNavigateModule}
          onSwitchTab={onSwitchTab}
        />
      );

      // Verify explorer header rendered
      expect(screen.getByText('문서 관계도')).toBeInTheDocument();

      // Switch view mode to "목록 카드 뷰"
      const cardsModeBtn = screen.getByRole('button', { name: /목록 카드 뷰/i });
      fireEvent.click(cardsModeBtn);

      // Verify and click on the policy node card
      const policyCard = await screen.findByText('2026년 서울체력장 및 메디런 운영 기본계획');
      fireEvent.click(policyCard);

      // Verify Drawer is opened
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /행정 문서 온톨로지 상세 정보/i })).toBeInTheDocument();
      });

      // Click "작업기억 보드로 이동" in Drawer
      const jumpMemoryBtn =
        screen.queryByTestId('btn-jump-memory') ||
        screen.getByRole('button', { name: /작업기억.*이동/i });
      fireEvent.click(jumpMemoryBtn);
      expect(onNavigateModule).toHaveBeenCalledWith('memory');

      // Click "수요일 주간업무 작성으로 이동" in Drawer
      const jumpWeeklyBtn =
        screen.queryByTestId('btn-jump-weekly') ||
        screen.getByRole('button', { name: /주간업무.*이동/i });
      fireEvent.click(jumpWeeklyBtn);
      expect(onSwitchTab).toHaveBeenCalledWith('weekly');

      // Click "예산 시뮬레이터로 이동" in Drawer
      const jumpSimBtn =
        screen.queryByTestId('btn-jump-simulator') ||
        screen.getByRole('button', { name: /예산 시뮬레이터.*이동/i });
      fireEvent.click(jumpSimBtn);
      expect(onNavigateModule).toHaveBeenCalledWith('simulator');

      // Click "예산관리로 이동" in Drawer
      const jumpWorkspaceBtn =
        screen.queryByTestId('btn-jump-workspace') ||
        screen.getByRole('button', { name: /예산관리.*이동/i });
      fireEvent.click(jumpWorkspaceBtn);
      expect(onNavigateModule).toHaveBeenCalledWith('workspace');
    });
  });
});
