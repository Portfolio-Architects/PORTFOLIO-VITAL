import {
  formatAdministrativeDate,
  formatAdministrativeTime,
  numberToKoreanHanja,
  formatAdministrativeCurrency,
  sanitizeAdministrativeText,
  ensureAdministrativeEnding
} from '@/lib/administrativeFormatter';

describe('VITAL 행정 공문서 표준 포매터 및 린터 테스트 (Rule M)', () => {
  describe('1. 연월일 표준 포맷팅 (formatAdministrativeDate)', () => {
    it('YYYY-MM-DD 포맷을 YYYY. M. D. 표준 형식으로 변환해야 함', () => {
      expect(formatAdministrativeDate('2026-09-14')).toBe('2026. 9. 14.');
      expect(formatAdministrativeDate('2025-01-08')).toBe('2025. 1. 8.');
    });

    it('마침표 축약 및 2자리 연도 표기를 정규화해야 함', () => {
      expect(formatAdministrativeDate('2026.9.14')).toBe('2026. 9. 14.');
      expect(formatAdministrativeDate("'26. 9. 14")).toBe('2026. 9. 14.');
    });
  });

  describe('2. 24시각제 시간 표준 포맷팅 (formatAdministrativeTime)', () => {
    it('오전/오후 표기를 24시각제 HH:mm 형식으로 변환해야 함', () => {
      expect(formatAdministrativeTime('오후 2시')).toBe('14:00');
      expect(formatAdministrativeTime('오전 9시')).toBe('09:00');
      expect(formatAdministrativeTime('14시')).toBe('14:00');
    });

    it('시간 범위 구간의 하이픈/공백을 물결표(~)로 정규화해야 함', () => {
      expect(formatAdministrativeTime('09:30 - 12:20')).toBe('09:30~12:20');
      expect(formatAdministrativeTime('13:00 ~ 17:00')).toBe('13:00~17:00');
    });
  });

  describe('3. 공문서 한글 금액 위변조 방지 병기 (formatAdministrativeCurrency)', () => {
    it('숫자를 한글 금액(금~원)으로 정확히 변환해야 함', () => {
      expect(numberToKoreanHanja(10000000)).toBe('금일천만원');
      expect(numberToKoreanHanja(13500)).toBe('금일만삼천오백원');
      expect(numberToKoreanHanja(500000)).toBe('금오십만원');
      expect(numberToKoreanHanja(0)).toBe('금영원');
    });

    it('아라비아 숫자와 한글 금액을 병기 형식으로 표기해야 함', () => {
      expect(formatAdministrativeCurrency(10000000)).toBe('금10,000,000원(금일천만원)');
      expect(formatAdministrativeCurrency(13500)).toBe('금13,500원(금일만삼천오백원)');
    });
  });

  describe('4. 중첩어 및 구어체 종결어미 정제 (sanitizeAdministrativeText)', () => {
    it('공문서 금지 중첩어를 표준 행정 어휘로 교정해야 함', () => {
      const input = '2월달 기간 동안 사업을 추진하며, 발생 가능한 리스크를 미리 예측하고 새로 신설되는 부서에는 반드시 필요한 예산을 배정함.';
      const output = sanitizeAdministrativeText(input);
      expect(output).toContain('2월');
      expect(output).not.toContain('2월달');
      expect(output).toContain('기간에');
      expect(output).not.toContain('기간 동안');
      expect(output).toContain('예측하고');
      expect(output).not.toContain('미리 예측');
      expect(output).toContain('신설되는');
      expect(output).not.toContain('새로 신설');
      expect(output).toContain('필요한');
      expect(output).not.toContain('반드시 필요');
    });

    it('구어체 종결어미를 개조식 종결어미로 정제해야 함', () => {
      expect(sanitizeAdministrativeText('시스템 패치를 완료했습니다')).toBe('시스템 패치를 완료함');
      expect(sanitizeAdministrativeText('정상 반영하였습니다')).toBe('정상 반영함');
      expect(sanitizeAdministrativeText('결과가 확인되었습니다.')).toBe('결과가 확인됨.');
    });
  });

  describe('5. 공문서 종결 부호 보정 (ensureAdministrativeEnding)', () => {
    it('문서 끝에 2칸 띄우고 끝. 표기를 보장해야 함', () => {
      expect(ensureAdministrativeEnding('이상 보고를 마칩니다.')).toBe('이상 보고를 마칩니다.  끝.');
      expect(ensureAdministrativeEnding('결과보고 완료  끝.')).toBe('결과보고 완료  끝.');
    });
  });
});
