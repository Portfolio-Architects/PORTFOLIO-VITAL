import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import all exported symbols from YangjaeFestivalDashboard
import YangjaeFestivalDashboardDefault, {
  YangjaeFestivalDashboard,
  YangjaeFestivalSkeleton,
  formatAutoHyphen,
  maskPersonName,
  SCHEDULE_PHASES,
  DUTY_CATEGORIES,
  parseBoothScale,
  parseDetail,
  formatDetail,
  getDetailSortKey,
  sortDetailsAscending,
  STAFF_PHONE_MAP,
  getStaffInfo,
  renderBulletedContent,
} from '@/components/festival/YangjaeFestivalDashboard';

import type {
  DetailDraft,
  YangjaeReportTab,
  ParsedDetail,
  BoothScaleParsed,
  YangjaeFestivalDashboardProps,
} from '@/components/festival/YangjaeFestivalDashboard';

// Mock Lucide icons
jest.mock('lucide-react', () => {
  const DummyIcon = ({ className, ...props }: any) => (
    <span data-testid="lucide-icon" className={className} {...props} />
  );
  return new Proxy({}, {
    get: () => DummyIcon,
  });
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('Challenger M2: 20-Symbol Export Parity & Invariant Stress-Testing', () => {
  // =========================================================================
  // 1. EXPORT PARITY & TYPE CONTRACT ASSERTIONS
  // =========================================================================
  describe('1. Export Parity Assertions (All 20 Symbols)', () => {
    it('verifies all 15 runtime value exports exist and have expected types', () => {
      // 1. Functions
      expect(typeof formatAutoHyphen).toBe('function');
      expect(typeof maskPersonName).toBe('function');
      expect(typeof parseBoothScale).toBe('function');
      expect(typeof parseDetail).toBe('function');
      expect(typeof formatDetail).toBe('function');
      expect(typeof getDetailSortKey).toBe('function');
      expect(typeof sortDetailsAscending).toBe('function');
      expect(typeof getStaffInfo).toBe('function');
      expect(typeof renderBulletedContent).toBe('function');
      expect(typeof YangjaeFestivalSkeleton).toBe('function');

      // 2. Constants / Objects / Arrays
      expect(Array.isArray(SCHEDULE_PHASES)).toBe(true);
      expect(Array.isArray(DUTY_CATEGORIES)).toBe(true);
      expect(typeof STAFF_PHONE_MAP).toBe('object');
      expect(STAFF_PHONE_MAP).not.toBeNull();

      // 3. Components
      expect(typeof YangjaeFestivalDashboard).toBe('object'); // React.memo is an object
      const displayName =
        (YangjaeFestivalDashboard as any).displayName ||
        (YangjaeFestivalDashboard as any).type?.displayName;
      expect(displayName).toBe('YangjaeFestivalDashboard');
      expect(YangjaeFestivalDashboardDefault).toBe(YangjaeFestivalDashboard);
    });

    it('verifies static type definitions compile without error', () => {
      const draft: DetailDraft = { uid: 'u-1', raw: '[완료] 과업' };
      const tab: YangjaeReportTab = 'milestones';
      const parsed: ParsedDetail = { date: '10.31', status: 'done', attendees: '오창선', text: '점검' };
      const scale: BoothScaleParsed = { dong: 2, bus: 1 };
      const props: YangjaeFestivalDashboardProps = { isActive: true };

      expect(draft.uid).toBe('u-1');
      expect(tab).toBe('milestones');
      expect(parsed.status).toBe('done');
      expect(scale.dong).toBe(2);
      expect(props.isActive).toBe(true);
    });
  });

  // =========================================================================
  // 2. ADVERSARIAL STRESS-TESTING: PHONE FORMATTING & NAME MASKING
  // =========================================================================
  describe('2. Phone Formatting & Name Masking Invariants', () => {
    it('stress-tests formatAutoHyphen across all phone patterns and malformed inputs', () => {
      // Edge / falsy
      expect(formatAutoHyphen(undefined)).toBe('');
      expect(formatAutoHyphen(null)).toBe('');
      expect(formatAutoHyphen('')).toBe('');
      expect(formatAutoHyphen('   ')).toBe('');

      // 4-digit extension
      expect(formatAutoHyphen('7116')).toBe('7116');
      expect(formatAutoHyphen('7034')).toBe('7034');

      // 8-digit representative
      expect(formatAutoHyphen('15881234')).toBe('1588-1234');
      expect(formatAutoHyphen('16001234')).toBe('1600-1234');
      expect(formatAutoHyphen('18991234')).toBe('1899-1234');

      // Seoul 02 numbers
      expect(formatAutoHyphen('02')).toBe('02');
      expect(formatAutoHyphen('02123')).toBe('02-123');
      expect(formatAutoHyphen('021234567')).toBe('02-123-4567');
      expect(formatAutoHyphen('0234237116')).toBe('02-3423-7116');

      // Mobile 010 numbers
      expect(formatAutoHyphen('010')).toBe('010');
      expect(formatAutoHyphen('0101234')).toBe('010-1234');
      expect(formatAutoHyphen('01012345678')).toBe('010-1234-5678');
      expect(formatAutoHyphen('010-1234-5678')).toBe('010-1234-5678'); // Idempotency

      // Regional 031, 051, 070
      expect(formatAutoHyphen('0311234567')).toBe('031-123-4567');
      expect(formatAutoHyphen('03112345678')).toBe('031-1234-5678');
      expect(formatAutoHyphen('07012345678')).toBe('070-1234-5678');

      // Non-digits string
      expect(formatAutoHyphen('내선없음')).toBe('내선없음');
    });

    it('stress-tests maskPersonName with PIPA compliance rules and edge cases', () => {
      // Falsy
      expect(maskPersonName(undefined)).toBe('');
      expect(maskPersonName(null)).toBe('');
      expect(maskPersonName('')).toBe('');

      // 2-character Korean name
      expect(maskPersonName('홍길')).toBe('홍O');

      // 3-character Korean name
      expect(maskPersonName('오창선')).toBe('오O선');
      expect(maskPersonName('서승오')).toBe('서O오');
      expect(maskPersonName('남상희')).toBe('남O희');

      // 4-character Korean name
      expect(maskPersonName('남궁민수')).toBe('남OO수');

      // Korean name with job title
      expect(maskPersonName('오창선 주무관')).toBe('오O선 주무관');
      expect(maskPersonName('김희선 팀장')).toBe('김O선 팀장');
      expect(maskPersonName('김형종 주임')).toBe('김O종 주임');

      // Organizations / Departments preserved without masking
      expect(maskPersonName('서울대병원 강남센터')).toBe('서울대병원 강남센터');
      expect(maskPersonName('강남차병원')).toBe('강남차병원');
      expect(maskPersonName('(주)유디')).toBe('(주)유디');
      expect(maskPersonName('한국신체정보 연구소')).toBe('한국신체정보 연구소');
      expect(maskPersonName('건강증진과')).toBe('건강증진과');
      expect(maskPersonName('모자보건팀')).toBe('모자보건팀');
    });
  });

  // =========================================================================
  // 3. ADVERSARIAL STRESS-TESTING: PARSING & SORTING ORACLES
  // =========================================================================
  describe('3. Parsing, Formatting & Sorting Oracles', () => {
    it('stress-tests parseBoothScale across diverse string formats', () => {
      expect(parseBoothScale('')).toEqual({ dong: 0, bus: 0 });
      expect(parseBoothScale('3동')).toEqual({ dong: 3, bus: 0 });
      expect(parseBoothScale('2동(몽골텐트)')).toEqual({ dong: 2, bus: 0 });
      expect(parseBoothScale('검진버스 1대')).toEqual({ dong: 0, bus: 1 });
      expect(parseBoothScale('버스 2대')).toEqual({ dong: 0, bus: 2 });
      expect(parseBoothScale('캐노피 2동 + 검진버스 1대')).toEqual({ dong: 2, bus: 1 });
      expect(parseBoothScale('4')).toEqual({ dong: 4, bus: 0 });
    });

    it('stress-tests parseDetail & formatDetail roundtrip invariants', () => {
      // Empty input
      expect(parseDetail('')).toEqual({ date: '', status: 'todo', attendees: '', text: '' });

      // Structured format
      const raw1 = '[완료][10.31][참여:오창선] 현장 부스 점검';
      const parsed1 = parseDetail(raw1);
      expect(parsed1).toEqual({
        date: '10.31',
        status: 'done',
        attendees: '오창선',
        text: '현장 부스 점검',
      });
      expect(formatDetail(parsed1)).toBe(raw1);

      // In-progress status
      const raw2 = '[진행][9.1] 사전 준비 진행';
      const parsed2 = parseDetail(raw2);
      expect(parsed2.status).toBe('in-progress');
      expect(parsed2.date).toBe('9.1');

      // Time format
      const raw3 = '09:00~09:30 : 개회식 및 국민의례';
      const parsed3 = parseDetail(raw3);
      expect(parsed3.date).toBe('09:00~09:30');
      expect(parsed3.text).toBe('개회식 및 국민의례');

      // Parentheses date & attendees
      const raw4 = '1차 사전답사(7.29.(수), 오창선): 현장 실사';
      const parsed4 = parseDetail(raw4);
      expect(parsed4.date).toBe('7.29.(수)');
      expect(parsed4.attendees).toBe('오창선');
      expect(parsed4.text).toBe('1차 사전답사: 현장 실사');

      // Cache hit test
      const firstCall = parseDetail(raw1);
      const secondCall = parseDetail(raw1);
      expect(firstCall).toBe(secondCall); // Reference equality via cache
    });

    it('stress-tests getDetailSortKey and sortDetailsAscending chronological ordering', () => {
      const items = [
        '[완료][10.31] 행사 당일',
        '[완료][7.29] 1차 답사',
        '[진행][9.3] 2차 점검',
        '[예정][08:00~09:00] 식전 행사',
        '날짜 미정 항목',
      ];

      const sorted = sortDetailsAscending(items);
      // 7.29 -> 9.3 -> 10.31 (date) / 10.31 당일 08:00 -> 날짜 미정 (Infinity)
      expect(sorted[0]).toContain('7.29');
      expect(sorted[1]).toContain('9.3');
      expect(sorted[sorted.length - 1]).toBe('날짜 미정 항목');

      // Edge cases
      expect(sortDetailsAscending([])).toEqual([]);
      expect(sortDetailsAscending(null as any)).toEqual([]);
    });
  });

  // =========================================================================
  // 4. ADVERSARIAL STRESS-TESTING: STAFF INFO & BULLETED CONTENT
  // =========================================================================
  describe('4. Staff Info & Bulleted Content Invariants', () => {
    it('stress-tests getStaffInfo against STAFF_PHONE_MAP directory', () => {
      // Known key staff
      const changsun = getStaffInfo('오창선');
      expect(changsun).not.toBeNull();
      expect(changsun?.ext).toBe('7116');
      expect(changsun?.full).toBe('02-3423-7116');

      // Staff with whitespace or title
      const seungoh = getStaffInfo('서승오 주무관');
      expect(seungoh?.ext).toBe('7034');

      const hyeongjong = getStaffInfo('김형종 주임님');
      expect(hyeongjong?.ext).toBe('7250');

      // Agency / Hospital
      const snu = getStaffInfo('서울대병원');
      expect(snu?.ext).toBe('8276');

      const agency = getStaffInfo('제이민');
      expect(agency?.full).toBe('010-8494-0544');

      // Unknown staff returns null
      expect(getStaffInfo('존재하지않는인물XYZ')).toBeNull();
    });

    it('stress-tests renderBulletedContent with single, multi-line, and empty text', () => {
      // Empty input
      expect(renderBulletedContent('', false)).toBeNull();

      // Multi-line input
      const multiLine = '주요 추진 방향\n- 1차 현장 점검 완료\n- 2차 부스 배치 확정';
      const result = renderBulletedContent(multiLine, false);
      expect(React.isValidElement(result)).toBe(true);

      const { container } = render(<div>{result}</div>);
      expect(container.textContent).toContain('주요 추진 방향');
      expect(container.textContent).toContain('1차 현장 점검 완료');
      expect(container.textContent).toContain('2차 부스 배치 확정');
    });
  });

  // =========================================================================
  // 5. 4-WAY DORMANT TAB CYCLING & RETENTION STRESS-TEST
  // =========================================================================
  describe('5. 4-Way Dormant Tab Persistence & Input Retention Stress-Test', () => {
    it('retains uncommitted draft changes across continuous 4-tab circular navigation', () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <YangjaeFestivalDashboard isActive={true} />
        </QueryClientProvider>
      );

      // Locate 4 tab buttons
      const tab1Btn = screen.getByRole('button', { name: /1\.\s*추진과제/i });
      const tab2Btn = screen.getByRole('button', { name: /2\.\s*부스현황/i });
      const tab3Btn = screen.getByRole('button', { name: /3\.\s*업무분장/i });
      const tab4Btn = screen.getByRole('button', { name: /4\.\s*행사식순/i });

      expect(tab1Btn).toBeInTheDocument();
      expect(tab2Btn).toBeInTheDocument();
      expect(tab3Btn).toBeInTheDocument();
      expect(tab4Btn).toBeInTheDocument();

      // 1. Enter edit mode on Tab 1 (Milestones)
      const editButtons = screen.getAllByTitle('과제 수정');
      expect(editButtons.length).toBeGreaterThan(0);
      fireEvent.click(editButtons[0]);

      const titleInput = screen.getByPlaceholderText('추진과제 제목');
      expect(titleInput).toBeInTheDocument();
      const stressDraftText = '공공안전 종합 관제 및 현장 의전 계획 (스트레스 테스트 검증용)';
      fireEvent.change(titleInput, { target: { value: stressDraftText } });
      expect(titleInput).toHaveValue(stressDraftText);

      // 2. Cycle through Tab 2 -> Tab 3 -> Tab 4 -> Tab 1
      fireEvent.click(tab2Btn);
      expect(screen.getByText(/부스 배치 계획/i)).toBeInTheDocument();
      // Verify draft in Tab 1 is STILL preserved in DOM (hidden)
      expect(screen.getByPlaceholderText('추진과제 제목')).toHaveValue(stressDraftText);

      fireEvent.click(tab3Btn);
      expect(screen.getByText(/업무분장 및 비상연락망/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('추진과제 제목')).toHaveValue(stressDraftText);

      fireEvent.click(tab4Btn);
      expect(screen.getByRole('heading', { name: /행사 식순/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('추진과제 제목')).toHaveValue(stressDraftText);

      // Return to Tab 1
      fireEvent.click(tab1Btn);
      expect(screen.getByPlaceholderText('추진과제 제목')).toBeVisible();
      expect(screen.getByPlaceholderText('추진과제 제목')).toHaveValue(stressDraftText);
    });

    it('renders YangjaeFestivalSkeleton with 448px max-w-md constraint and 1px borders', () => {
      const { container } = render(<YangjaeFestivalSkeleton />);
      expect(container.querySelector('.max-w-md')).toBeInTheDocument();
      expect(container.innerHTML).toContain('animate-pulse');
      expect(container.innerHTML).not.toContain('border-2');
    });
  });
});
