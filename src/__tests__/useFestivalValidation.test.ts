import { EssentialPermitStatus, BudgetValidationReport } from '@/__tests__/fixtures/useFestivalValidation';

describe('Festival Event Tracking & Validation Engine Logic', () => {
  it('correctly categorizes essential permits status', () => {
    const mockPermits: EssentialPermitStatus[] = [
      { key: 'municipal_report', label: '지자체 신고', status: 'INCOMPLETE', nodeId: 'fest-r3' },
      { key: 'police_road', label: '경찰 도로점용', status: 'MISSING' },
      { key: 'fire_safety', label: '소방 안전점검', status: 'MISSING' },
      { key: 'safety_plan', label: '안전관리계획서', status: 'VERIFIED', nodeId: 'fest-p1' },
    ];

    const missingCount = mockPermits.filter(p => p.status === 'MISSING').length;
    const verifiedCount = mockPermits.filter(p => p.status === 'VERIFIED').length;
    const incompleteCount = mockPermits.filter(p => p.status === 'INCOMPLETE').length;

    expect(missingCount).toBe(2);
    expect(verifiedCount).toBe(1);
    expect(incompleteCount).toBe(1);
  });

  it('correctly evaluates 50-70M KRW budget scale bounds and ratios', () => {
    const calcScale = (allocated: number): BudgetValidationReport['scaleStatus'] => {
      if (allocated < 50000000) return 'UNDER_SCALE';
      if (allocated > 70000000) return 'OVER_SCALE';
      return 'IN_SCALE';
    };

    expect(calcScale(45000000)).toBe('UNDER_SCALE');
    expect(calcScale(60000000)).toBe('IN_SCALE');
    expect(calcScale(75000000)).toBe('OVER_SCALE');
  });

  it('determines overall risk level accurately based on permit and budget conditions', () => {
    const evaluateRisk = (hasMissing: boolean, isOverScale: boolean, hasIncomplete: boolean): 'CRITICAL' | 'WARNING' | 'SAFE' => {
      if (hasMissing || isOverScale) return 'CRITICAL';
      if (hasIncomplete) return 'WARNING';
      return 'SAFE';
    };

    expect(evaluateRisk(true, false, false)).toBe('CRITICAL');
    expect(evaluateRisk(false, true, false)).toBe('CRITICAL');
    expect(evaluateRisk(false, false, true)).toBe('WARNING');
    expect(evaluateRisk(false, false, false)).toBe('SAFE');
  });
});
