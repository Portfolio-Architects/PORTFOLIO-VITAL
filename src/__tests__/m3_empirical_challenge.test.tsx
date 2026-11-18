import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Badge, ProgressBar, Button, Card, CardHeader, CardContent, NumericText } from '@/components/ui';
import { FestivalValidationReport, EssentialPermitStatus, BudgetValidationReport } from '@/__tests__/fixtures/useFestivalValidation';
import { FESTIVAL_5DOMAINS } from '@/lib/presets/festival5DomainPreset';

describe('EMPIRICAL CHALLENGE SUITE: VLDS Design System & Festival Risk Validation', () => {
  const createMockReport = (overrides?: Partial<FestivalValidationReport>): FestivalValidationReport => {
    const defaultPermits: EssentialPermitStatus[] = [
      { key: 'municipal_report', label: '지자체 신고', status: 'INCOMPLETE', nodeId: 'fest-r3' },
      { key: 'police_road', label: '경찰 도로점용', status: 'MISSING', nodeId: 'fest-p2' },
      { key: 'fire_safety', label: '소방 안전점검', status: 'MISSING', nodeId: 'fest-p3' },
      { key: 'safety_plan', label: '안전관리계획서', status: 'VERIFIED', nodeId: 'fest-p1' },
    ];

    const defaultBudgetValidation: BudgetValidationReport = {
      scaleStatus: 'IN_SCALE',
      targetScaleMin: 50000000,
      targetScaleMax: 70000000,
      totalAllocated: 60000000,
      totalSpent: 60000000,
      spendRatio: 100,
      overrunCategories: [],
      unenteredDomains: [],
    };

    const defaultRiskNodesMap = new Map<string, { riskLevel: 'CRITICAL' | 'WARNING'; reason: string }>([
      ['fest-p2', { riskLevel: 'CRITICAL', reason: '경찰 도로점용 필수 인허가 서류 누락' }],
      ['fest-p3', { riskLevel: 'CRITICAL', reason: '소방 안전점검 필수 인허가 서류 누락' }],
      ['fest-r3', { riskLevel: 'WARNING', reason: '지자체 신고 인허가 검증 미완료' }],
    ]);

    return {
      permits: defaultPermits,
      budgetValidation: defaultBudgetValidation,
      riskNodesMap: defaultRiskNodesMap,
      overallRiskLevel: 'CRITICAL',
      injectMissingPermits: jest.fn(),
      ...overrides,
    };
  };

  describe('1. VLDS Surface Card, Semantic Badges & Permit Status Mapping', () => {
    it('renders offscreen-isolated Card with semantic permit badges and action button', () => {
      const report = createMockReport();
      const { container } = render(
        <Card offscreenIsolate hover>
          <CardHeader density="compact">
            <span>축제 인허가 점검</span>
          </CardHeader>
          <CardContent density="compact">
            {report.permits.map((p) => (
              <Badge
                key={p.key}
                variant={
                  p.status === 'VERIFIED'
                    ? 'success'
                    : p.status === 'INCOMPLETE'
                    ? 'warning'
                    : 'danger'
                }
              >
                {p.label}
              </Badge>
            ))}
            <Button variant="primary" size="xs" onClick={report.injectMissingPermits}>
              필수 인허가 자동 보완
            </Button>
          </CardContent>
        </Card>
      );

      expect(container.querySelector('.vlds-cv-card')).toBeInTheDocument();
      expect(screen.getByText('지자체 신고')).toBeInTheDocument();
      expect(screen.getByText('경찰 도로점용')).toBeInTheDocument();
      expect(screen.getByText('소방 안전점검')).toBeInTheDocument();
      expect(screen.getByText('안전관리계획서')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '필수 인허가 자동 보완' }));
      expect(report.injectMissingPermits).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. VLDS ProgressBar Clamping & Tabular Numeric Formatting', () => {
    it('clamps progress values to [0, 100] and renders tabular-nums labels', () => {
      const { container, rerender } = render(
        <div>
          <ProgressBar value={86} showLabel />
          <NumericText value={60000000} unit="원" />
        </div>
      );

      expect(container.querySelector('.progress-fill')).toHaveStyle({ width: '86%' });
      expect(screen.getByText('86%')).toBeInTheDocument();
      expect(screen.getByText('60,000,000')).toBeInTheDocument();

      rerender(<ProgressBar value={145} showLabel />);
      expect(container.querySelector('.progress-fill')).toHaveStyle({ width: '100%' });
      expect(screen.getByText('100%')).toBeInTheDocument();

      rerender(<ProgressBar value={-15} showLabel />);
      expect(container.querySelector('.progress-fill')).toHaveStyle({ width: '0%' });
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('3. Canvas Crimson Risk Aura Physics & Color Math', () => {
    it('verifies sinusoidal pulse math bounds [0, 1] and alpha bounds [0.75, 1.0]', () => {
      const testTimestamps = [0, 100, 500, 1000, 2000, 5000, 123456789];
      testTimestamps.forEach((ts) => {
        const pulse = 0.5 + 0.5 * Math.sin(ts * 0.005);
        expect(pulse).toBeGreaterThanOrEqual(0);
        expect(pulse).toBeLessThanOrEqual(1);

        const alpha = 0.75 + 0.25 * pulse;
        expect(alpha).toBeGreaterThanOrEqual(0.75);
        expect(alpha).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe('4. Preset & Schema Boundaries', () => {
    it('verifies FESTIVAL_5DOMAINS dataset has exactly 5 domain hubs and all mandatory permit keys', () => {
      expect(FESTIVAL_5DOMAINS).toHaveLength(5);

      const permitKeysInPreset = new Set<string>();
      FESTIVAL_5DOMAINS.forEach((hub) => {
        hub.children.forEach((child) => {
          if (child.permitKey) {
            permitKeysInPreset.add(child.permitKey);
          }
        });
      });

      expect(permitKeysInPreset.has('municipal_report')).toBe(true);
      expect(permitKeysInPreset.has('police_road')).toBe(true);
      expect(permitKeysInPreset.has('fire_safety')).toBe(true);
      expect(permitKeysInPreset.has('safety_plan')).toBe(true);
    });
  });
});
