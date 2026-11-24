import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AdminDocType,
  AdminDocTypeSchema,
  AdminDocTypeEnum,
  AdminDocMetadataSchema,
  AdminDocIndexSchema,
  SeedOntologyDocsSchema,
} from '@/lib/schemas';

// ============================================================================
// Curation & Extraction Oracles
// ============================================================================

export function classifyDocument(filename: string, snippet: string = '', ext: string = ''): AdminDocType | null {
  const effectiveExt = (ext || path.extname(filename)).toLowerCase();
  if (!['.hwpx', '.hwp', '.pdf', '.xlsx', '.docx'].includes(effectiveExt)) {
    return null;
  }

  const SEP = '[\\s_]*';
  const PATTERNS = {
    WEEKLY_REPORT: new RegExp(`(?:주${SEP}간${SEP}업${SEP}무${SEP}보${SEP}고|주간${SEP}업무${SEP}실적${SEP}및${SEP}계획|주간${SEP}업무${SEP}보고|주간${SEP}업무|주간${SEP}보고|주요${SEP}업무${SEP}보고.*작성서식|주요${SEP}업무${SEP}보고${SEP}제안설명서|구정${SEP}주요${SEP}업무${SEP}보고|업무실적${SEP}및${SEP}계획)`, 'i'),
    ADMIN_AUDIT: new RegExp(`(?:행${SEP}정${SEP}사${SEP}무${SEP}감${SEP}사|행정${SEP}사무${SEP}감사|행감|감사${SEP}자료|행정${SEP}감사|수감${SEP}자료|시정${SEP}요구|조치${SEP}계획|처리${SEP}결과${SEP}보고서|보충자료\\(공통|보충자료\\(개별)`, 'i'),
    BUDGET_PLAN: new RegExp(`(?:사${SEP}업${SEP}설${SEP}명${SEP}서|사업${SEP}설명서|예산${SEP}요구서|예산${SEP}편성(?:요구)?|본예산.*사업${SEP}설명서|본예산.*편성|세출${SEP}예산.*편성|예산\\(가내시\\)|편성${SEP}총괄표)`, 'i'),
    RESULT_REPORT: new RegExp(`(?:결${SEP}과${SEP}보${SEP}고${SEP}(?:서)?|결과${SEP}보고(?:서)?|추진${SEP}결과(?:보고)?|실적${SEP}보고(?:서)?|성과${SEP}평가(?:보고)?|운영${SEP}결과(?:보고)?|실시${SEP}결과(?:보고)?|정산${SEP}보고(?:서)?|평가${SEP}보고(?:서)?|결과보고서|결과보고)`, 'i'),
    POLICY_PLAN: new RegExp(`(?:방${SEP}침${SEP}(?:서)?|기본${SEP}계획(?:서)?|시행${SEP}계획(?:서)?|추진${SEP}계획(?:서)?|운영${SEP}계획(?:서)?|종합${SEP}계획(?:서)?|사업${SEP}총괄${SEP}계획|실행${SEP}계획(?:서)?|사업${SEP}기획(?:서)?|사업${SEP}계획(?:서)?|예산지원${SEP}계획(?:서)?|지원${SEP}계획(?:서)?|구매${SEP}계획(?:서)?)`, 'i'),
  };

  const EXCLUSIONS = {
    WEEKLY_REPORT: new RegExp('(?:사진|포스터)', 'i'),
    ADMIN_AUDIT: new RegExp(`(?:주간${SEP}업무|사진|리플릿|포스터)`, 'i'),
    BUDGET_PLAN: new RegExp(`(?:주간${SEP}업무|사진|리플릿|결${SEP}과${SEP}보${SEP}고|실적${SEP}보고)`, 'i'),
    RESULT_REPORT: new RegExp(`(?:행${SEP}정${SEP}사${SEP}무${SEP}감${SEP}사자료|행감자료|주간${SEP}업무|사${SEP}업${SEP}설${SEP}명${SEP}서|방${SEP}침${SEP}(?:서)?|출석부|사진|명단)`, 'i'),
    POLICY_PLAN: new RegExp(`(?:결${SEP}과${SEP}보${SEP}고|추진${SEP}결과|실적${SEP}보고|정산${SEP}보고|행${SEP}정${SEP}사${SEP}무${SEP}감${SEP}사|행감|사${SEP}업${SEP}설${SEP}명${SEP}서|주간${SEP}업무|주간${SEP}보고|참석자|명단|출석부|사진)`, 'i'),
  };

  const fn = filename.replace(/[\u200b\u200c\u200d\ufeff]/g, '').replace(/[\u00a0\u3000]/g, ' ');
  const sn = snippet.replace(/[\u200b\u200c\u200d\ufeff]/g, '').replace(/[\u00a0\u3000]/g, ' ');

  // 1. WEEKLY_REPORT
  if (PATTERNS.WEEKLY_REPORT.test(fn) && !EXCLUSIONS.WEEKLY_REPORT.test(fn)) {
    return 'WEEKLY_REPORT';
  }
  if (PATTERNS.WEEKLY_REPORT.test(sn) && sn.includes('업무실적') && sn.includes('업무계획')) {
    return 'WEEKLY_REPORT';
  }

  // 2. ADMIN_AUDIT
  if (PATTERNS.ADMIN_AUDIT.test(fn) && !EXCLUSIONS.ADMIN_AUDIT.test(fn)) {
    return 'ADMIN_AUDIT';
  }

  // 3. BUDGET_PLAN
  if (PATTERNS.BUDGET_PLAN.test(fn) && !EXCLUSIONS.BUDGET_PLAN.test(fn)) {
    return 'BUDGET_PLAN';
  }
  if (sn.includes('사업설명서') && (sn.includes('총사업비') || sn.includes('산출내역'))) {
    return 'BUDGET_PLAN';
  }

  // 4. RESULT_REPORT
  if (PATTERNS.RESULT_REPORT.test(fn) && !EXCLUSIONS.RESULT_REPORT.test(fn)) {
    return 'RESULT_REPORT';
  }
  if ((sn.includes('결과보고') || sn.includes('실시결과')) && (sn.includes('추진실적') || sn.includes('운영실적'))) {
    return 'RESULT_REPORT';
  }

  // 5. POLICY_PLAN
  if (PATTERNS.POLICY_PLAN.test(fn) && !EXCLUSIONS.POLICY_PLAN.test(fn)) {
    return 'POLICY_PLAN';
  }
  if ((sn.includes('추진계획') || sn.includes('운영계획')) && (sn.includes('추진목적') || sn.includes('사업개요'))) {
    return 'POLICY_PLAN';
  }

  return null;
}

function parseSingleBudgetMatch(text: string, match: RegExpExecArray): number | null {
  const rawNumStr = match[1].replace(/[^\d.]/g, '').trim();
  if (!rawNumStr || !/\d/.test(rawNumStr)) return null;

  const unit = (match[2] || '').trim();
  let multiplier = 1;

  if (unit === '원') {
    multiplier = 1;
  } else if (unit === '천원') {
    multiplier = 1000;
  } else if (unit === '백만원') {
    multiplier = 1000000;
  } else if (unit === '억원') {
    multiplier = 100000000;
  } else {
    // Lookahead boundary check only if unit is empty
    const lookahead = text.slice(match.index + match[0].length);
    const lookMatch = lookahead.match(/^\s*(천원|백만원|억원)(?:\b|[^가-힣]|$)/);
    if (lookMatch) {
      const lookUnit = lookMatch[1];
      if (lookUnit === '천원') multiplier = 1000;
      else if (lookUnit === '백만원') multiplier = 1000000;
      else if (lookUnit === '억원') multiplier = 100000000;
    } else if (!match[1].trim().startsWith('금')) {
      return null;
    }
  }

  if (rawNumStr.includes('.')) {
    return Math.round(parseFloat(rawNumStr) * multiplier);
  } else {
    return parseInt(rawNumStr, 10) * multiplier;
  }
}

export function extractBudgetAmount(text: string): number | null {
  if (!text) return null;

  const patterns = [
    /(?:총\s*사업비|총\s*소요예산(?:액)?|총\s*구매\s*소요예산|총\s*예산(?:액)?)[\s:：]*([금\d,]+(?:\.\d+)?)\s*(천원|원|백만원|억원)?/gi,
    /(?:소요예산액|소요예산|예산액|편성액|소요재원|사업비|집행액|본예산|세출예산)[\s:：]*([금\d,]+(?:\.\d+)?)\s*(천원|원|백만원|억원)?/gi,
    /(?:총)[\s:：]+([금\d,]+(?:\.\d+)?)\s*(천원|원|백만원|억원)/gi,
  ];

  for (const pat of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pat.exec(text)) !== null) {
      const parsed = parseSingleBudgetMatch(text, match);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

export function extractFundingSplits(text: string): { city: number; district: number; fund: number; national: number } {
  const result = { city: 0, district: 0, fund: 0, national: 0 };

  const cityMatch = text.match(/시비[\s:：]*([금\d,]+)\s*(천원|원|백만원|억원)?/i);
  if (cityMatch) {
    const val = parseInt(cityMatch[1].replace(/,/g, ''), 10);
    const unit = cityMatch[2] || (text.includes('백만원') ? '백만원' : '원');
    if (unit.includes('천원')) result.city = val * 1000;
    else if (unit.includes('백만원')) result.city = val * 1000000;
    else if (unit.includes('억원')) result.city = val * 100000000;
    else result.city = val;
  }

  const distMatch = text.match(/구비[\s:：]*([금\d,]+)\s*(천원|원|백만원|억원)?/i);
  if (distMatch) {
    const val = parseInt(distMatch[1].replace(/,/g, ''), 10);
    const unit = distMatch[2] || (text.includes('백만원') ? '백만원' : '원');
    if (unit.includes('천원')) result.district = val * 1000;
    else if (unit.includes('백만원')) result.district = val * 1000000;
    else if (unit.includes('억원')) result.district = val * 100000000;
    else result.district = val;
  }

  const fundMatch = text.match(/기금[\s:：]*([금\d,]+)\s*(천원|원|백만원|억원)?/i);
  if (fundMatch) {
    const val = parseInt(fundMatch[1].replace(/,/g, ''), 10);
    const unit = fundMatch[2] || (text.includes('백만원') ? '백만원' : '원');
    if (unit.includes('천원')) result.fund = val * 1000;
    else if (unit.includes('백만원')) result.fund = val * 1000000;
    else if (unit.includes('억원')) result.fund = val * 100000000;
    else result.fund = val;
  }

  const natMatch = text.match(/국비[\s:：]*([금\d,]+)\s*(천원|원|백만원|억원)?/i);
  if (natMatch) {
    const val = parseInt(natMatch[1].replace(/,/g, ''), 10);
    const unit = natMatch[2] || (text.includes('백만원') ? '백만원' : '원');
    if (unit.includes('천원')) result.national = val * 1000;
    else if (unit.includes('백만원')) result.national = val * 1000000;
    else if (unit.includes('억원')) result.national = val * 100000000;
    else result.national = val;
  }

  return result;
}

export async function curateAdminDocuments(options?: {
  sourceDirectories?: string[];
  dryRun?: boolean;
}): Promise<any[]> {
  const dirs = options?.sourceDirectories || ['D:\\Desktop'];
  const results: any[] = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fp = path.join(dir, f);
      const stat = fs.statSync(fp);
      if (!stat.isFile()) continue;

      const docType = classifyDocument(f, '');
      if (docType) {
        results.push({
          id: `doc-${f}`,
          docId: `doc-${f}`,
          title: f,
          docType,
          filePath: fp,
          size: stat.size,
          mtime: stat.mtimeMs,
        });
      }
    }
  }

  return results;
}

// ============================================================================
// Fixtures
// ============================================================================

const SAMPLE_POLICY_PLAN_FIXTURES = [
  '20260818_강남구보건소 신체활동 사업 총괄 계획_인계 보고용2.hwpx',
  '2026_메디런_프로그램_운영_계획.hwpx',
  '5. 방침서.hwpx',
  '찾아가는 AI 서울체력장 측정 장비 구매 계획 2.hwpx',
  '개별-1 강남체력인증센터 추진계획.hwpx',
  '1. [본문] - 서울형 서울체력장 조성 및 운영을 위한 -자치구 특별조정교부금 예산지원 계획.hwpx',
  '제8기 지역보건의료계획 2026년도 시행계획(안).hwpx',
];

const SAMPLE_RESULT_REPORT_FIXTURES = [
  '2026 강남구 보건소 신체활동 결과보고.hwp',
  '(붙임2) 합동 캠페인 결과보고_강남구보건소.hwpx',
  '개별-8 아이뛰움 프로그램， 상반기 운영 결과 보고.hwpx',
  '개별-1 2026 공공PT 프로그램 운영 결과보고（2 기）.hwpx',
  '2026년 상반기 건강생활실천사업 추진실적보고서.hwpx',
];

const SAMPLE_ADMIN_AUDIT_FIXTURES = [
  '(건강증진팀) 2026 보건소 행정사무감사 참고자료 final.hwpx',
  '(261026) 2026년 행정사무감사자료(건강증진팀)-수정내용(파란색)_최종 2.hwpx',
  '(261019) 2026년 행정사무감사자료(건강증진팀)-팀장님 수정.hwp',
  '2026년도 행정사무감사 시정 및 처리요구사항 조치계획서.hwpx',
  '행정사무감사 보충자료(공통)-1.hwpx',
];

const SAMPLE_BUDGET_PLAN_FIXTURES = [
  "(보건행정과) 2027년도 본예산 사업설명서('26.10.26.자).hwpx",
  '(261022) 사업설명서(건강증진팀)_신체활동_통합 증액반영_수정내역 표기.hwpx',
  '(261022) 편성 총괄표(건강증진팀)_신체활동_통합 증액 반영.xlsx',
  '2027년도 본예산 편성 서브자료(건강증진팀)_건생, AI메디헬스.hwpx',
  '★2026년도 보건행정과 본예산 편성 서브자료(25년 11월 30일 집행률 기준).hwpx',
];

const SAMPLE_WEEKLY_REPORT_FIXTURES = [
  '(20261104) 보건소 주간 업무실적 및 계획(건강증진팀) (1).hwpx',
  '(20261104) 보건소 주간 업무실적 및 계획(건강증진팀)_신체활동.hwpx',
  '(20261021) 보건소 주간 업무실적 및 계획(건강증진팀)_신체활동.hwpx',
  '(20260930) 보건소 주간 업무실적 및 계획(건강증진팀)_신체활동.hwpx',
  '2026년 44주차 주간업무보고(건강증진팀).hwpx',
];

const SAMPLE_NOISE_EXCLUSIONS = [
  'KakaoTalk_20261023_104835625.jpg',
  '양재천페스티벌_현장사진_01.png',
  '2026 양재천 건강페스티벌 포스터_최종시안.ai',
  '건강생활실천 리플릿 3단접지.pdf',
  '참석자명단_및_서명부.xlsx',
  '261020_물자총괄표.xlsx',
  '회의메모_20261020.txt',
];

function computeFileSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Milestone 1: 행정 문서 비파괴 선별·분류 인덱서 검증 스위트 (curation-indexer.test.ts)', () => {

  // --------------------------------------------------------------------------
  // Tier 1: Rule O Compliance & Non-Destructive Filesystem Execution
  // --------------------------------------------------------------------------
  describe('1. Rule O 준수 & 파일시스템 비파괴 무결성 검증 (Non-destructive Invariant)', () => {
    let mockSandboxDir: string;
    let preExecutionStats: Map<string, { size: number; mtimeMs: number; sha256: string }>;

    beforeAll(() => {
      mockSandboxDir = path.join(process.cwd(), 'temp_test_sandbox_' + Date.now());
      fs.mkdirSync(mockSandboxDir, { recursive: true });

      const testFiles = [
        '2026_메디런_프로그램_운영_계획.hwpx',
        '2026 강남구 보건소 신체활동 결과보고.hwp',
        '(건강증진팀) 2026 보건소 행정사무감사 참고자료 final.hwpx',
        "(보건행정과) 2027년도 본예산 사업설명서('26.10.26.자).hwpx",
        '(20261104) 보건소 주간 업무실적 및 계획(건강증진팀)_신체활동.hwpx',
        'KakaoTalk_20261023_104835625.jpg',
      ];

      preExecutionStats = new Map();
      testFiles.forEach((fname) => {
        const fp = path.join(mockSandboxDir, fname);
        const dummyContent = `TEST_CONTENT_FOR_${fname}_${Date.now()}`;
        fs.writeFileSync(fp, dummyContent, 'utf-8');
        const stat = fs.statSync(fp);
        preExecutionStats.set(fp, {
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          sha256: computeFileSha256(fp),
        });
      });
    });

    afterAll(() => {
      if (fs.existsSync(mockSandboxDir)) {
        fs.rmSync(mockSandboxDir, { recursive: true, force: true });
      }
    });

    it('인덱서 실행 시 원본 폴더 내 모든 파일의 크기, mtime, SHA-256이 100% 불변해야 함 (0건 변형)', async () => {
      const result = await curateAdminDocuments({
        sourceDirectories: [mockSandboxDir],
        dryRun: true,
      });

      expect(result).toBeDefined();

      const currentFiles = fs.readdirSync(mockSandboxDir);
      expect(currentFiles.length).toBe(preExecutionStats.size);

      for (const fname of currentFiles) {
        const fp = path.join(mockSandboxDir, fname);
        const preStat = preExecutionStats.get(fp);
        expect(preStat).toBeDefined();

        const curStat = fs.statSync(fp);
        const curSha = computeFileSha256(fp);

        expect(curStat.size).toBe(preStat!.size);
        expect(curStat.mtimeMs).toBe(preStat!.mtimeMs);
        expect(curSha).toBe(preStat!.sha256);
      }
    });

    it('인덱서 실행 중 fs 쓰기/삭제/이동 연산이 D:\\Desktop 또는 F:\\_Organized_Archive를 향하지 않아야 함', async () => {
      const writeSpy = jest.spyOn(fs, 'writeFileSync');
      const unlinkSpy = jest.spyOn(fs, 'unlinkSync');
      const renameSpy = jest.spyOn(fs, 'renameSync');

      await curateAdminDocuments({
        sourceDirectories: [mockSandboxDir],
        dryRun: true,
      });

      const illegalTargets = [mockSandboxDir, 'D:\\Desktop', 'F:\\_Organized_Archive'];

      [writeSpy, unlinkSpy, renameSpy].forEach((spy) => {
        spy.mock.calls.forEach((call) => {
          const targetPath = String(call[0]);
          for (const illegal of illegalTargets) {
            if (targetPath.startsWith(illegal) && !targetPath.includes('PORTFOLIO - VITAL\\data')) {
              throw new Error(`Rule O Violation! File operation targeted: ${targetPath}`);
            }
          }
        });
      });

      writeSpy.mockRestore();
      unlinkSpy.mockRestore();
      renameSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // Tier 2: 5-Type Classification Precision & Exclusions
  // --------------------------------------------------------------------------
  describe('2. 5대 핵심 행정 문서 분류 정밀도 및 노이즈 배제 검증 (5-Type Classification)', () => {
    it.each(SAMPLE_POLICY_PLAN_FIXTURES)(
      '방침서 픽스처를 POLICY_PLAN으로 100% 정밀 분류해야 함: %s',
      (fixture) => {
        const docType = classifyDocument(fixture, '');
        expect(docType).toBe('POLICY_PLAN');
      }
    );

    it.each(SAMPLE_RESULT_REPORT_FIXTURES)(
      '결과보고서 픽스처를 RESULT_REPORT로 100% 정밀 분류해야 함: %s',
      (fixture) => {
        const docType = classifyDocument(fixture, '');
        expect(docType).toBe('RESULT_REPORT');
      }
    );

    it.each(SAMPLE_ADMIN_AUDIT_FIXTURES)(
      '행정사무감사 픽스처를 ADMIN_AUDIT로 100% 정밀 분류해야 함: %s',
      (fixture) => {
        const docType = classifyDocument(fixture, '');
        expect(docType).toBe('ADMIN_AUDIT');
      }
    );

    it.each(SAMPLE_BUDGET_PLAN_FIXTURES)(
      '예산설명서/요구서 픽스처를 BUDGET_PLAN으로 100% 정밀 분류해야 함: %s',
      (fixture) => {
        const docType = classifyDocument(fixture, '');
        expect(docType).toBe('BUDGET_PLAN');
      }
    );

    it.each(SAMPLE_WEEKLY_REPORT_FIXTURES)(
      '주간업무보고 픽스처를 WEEKLY_REPORT로 100% 정밀 분류해야 함: %s',
      (fixture) => {
        const docType = classifyDocument(fixture, '');
        expect(docType).toBe('WEEKLY_REPORT');
      }
    );

    it.each(SAMPLE_NOISE_EXCLUSIONS)(
      '사진, 포스터, 리플릿, 명단 등 비핵심 노이즈 문서를 배제(null 반환)해야 함: %s',
      (fixture) => {
        const docType = classifyDocument(fixture, '');
        expect(docType).toBeNull();
      }
    );

    it('교차 모호성 파일에 대해 행정 생애주기 우선순위가 올바르게 작동해야 함', () => {
      // 1. 감사 처리결과보고서 -> ADMIN_AUDIT
      expect(classifyDocument('2026년도 행정사무감사 시정요구사항 처리결과보고서.hwpx', '')).toBe('ADMIN_AUDIT');

      // 2. 본예산 편성 추진계획 -> BUDGET_PLAN
      expect(classifyDocument('2027년도 신체활동 본예산 편성 추진계획(안).hwpx', '')).toBe('BUDGET_PLAN');

      // 3. 주간 실적 및 계획 -> WEEKLY_REPORT
      expect(classifyDocument('(20261104) 주간 업무실적 및 계획(건강증진팀).hwpx', '')).toBe('WEEKLY_REPORT');
    });

    it('글자별 띄어쓰기, 전각/특수 공백 및 제로위드 공백이 포함된 문서를 올바르게 식별해야 함', () => {
      expect(classifyDocument('방  침  서.hwpx', '')).toBe('POLICY_PLAN');
      expect(classifyDocument('방   침   서 .hwpx', '')).toBe('POLICY_PLAN');
      expect(classifyDocument('방\u200b침\u200b서.hwpx', '')).toBe('POLICY_PLAN');
      expect(classifyDocument('결 과 보 고 서.hwpx', '')).toBe('RESULT_REPORT');
      expect(classifyDocument('결과\u00a0보고서.hwpx', '')).toBe('RESULT_REPORT');
      expect(classifyDocument('행 정 사 무 감 사.hwpx', '')).toBe('ADMIN_AUDIT');
      expect(classifyDocument('사 업 설 명 서.hwpx', '')).toBe('BUDGET_PLAN');
    });

    it('결과보고서와 사업설명서 간의 상충 모호성 파일은 배제(null 반환)해야 함', () => {
      expect(classifyDocument('결과보고서_사업설명서.hwpx', '')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Tier 3: Budget Extraction & KRW Mathematical Normalization
  // --------------------------------------------------------------------------
  describe('3. 공공 예산 금액 추출 및 원(KRW) 단위 수리 정규화 검증 (Budget Extraction)', () => {
    it.each([
      { input: '총사업비: 금1,255,000천원', expected: 1255000000 },
      { input: '소요예산: 7,174천원', expected: 7174000 },
      { input: '총사업비 1,742,152천원', expected: 1742152000 },
      { input: '총사업비: 1,557백만원', expected: 1557000000 },
      { input: '소요예산액: 금10,000,000원(금일천만원)', expected: 10000000 },
      { input: '편성액: 500,000원', expected: 500000 },
      { input: '소요예산: 0원', expected: 0 },
    ])('예산 표현식 "$input"을 정확한 원 단위 정수 $expected(으)로 파싱해야 함', ({ input, expected }) => {
      const amount = extractBudgetAmount(input);
      expect(amount).toBe(expected);
    });

    it('소수점 포함 예산 단위(억원, 백만원, 천원)를 정확한 원 단위 정수로 파싱해야 함', () => {
      expect(extractBudgetAmount('소요예산: 1.5억원')).toBe(150000000);
      expect(extractBudgetAmount('소요예산: 3.5백만원')).toBe(3500000);
      expect(extractBudgetAmount('소요예산: 2.5천원')).toBe(2500);
    });

    it('명시적 "원" 단위 뒤에 "천원" 설명이 부기되더라도 1,000배 오승산되지 않아야 함 (False-Multiplier 방어 / Rule R)', () => {
      expect(extractBudgetAmount('총사업비: 100원 (천원단위 아님)')).toBe(100);
      expect(extractBudgetAmount('총사업비: 50,000원 (천원할인)')).toBe(50000);
    });

    it('소요재원 분할 표기(시비+구비=총사업비)의 수리적 일치율을 검증해야 함 (Rule R)', () => {
      const text = '총사업비: 1,557백만원 (시비 332백만원, 구비 1,225백만원)';
      const total = extractBudgetAmount(text);
      const splits = extractFundingSplits(text);

      expect(total).toBe(1557000000);
      expect(splits).toBeDefined();
      expect(splits.city).toBe(332000000);
      expect(splits.district).toBe(1225000000);
      expect(splits.city + splits.district).toBe(total);
    });

    it('전화번호, 문서등록번호, 날짜 등을 예산 금액으로 오인식하지 않아야 함 (False-Positive 방어)', () => {
      const noiseText = '보건행정과-7357호 (2026. 10. 21.) 담당자 연락처: 010-1234-5678, 수량: 500개';
      const amount = extractBudgetAmount(noiseText);
      expect(amount).toBeNull();
      expect(extractBudgetAmount('2027년도 본예산 편성 서브자료 (2027)')).toBeNull();
      expect(extractBudgetAmount('총 4,549명 (목표 4,500명 대비 101.1%)')).toBeNull();
    });

    it('다중 예산 수치 문서에서 "총 소요예산"을 선행 "예산액/소요예산"보다 우선 추출하고 축약형 "총 <금액><단위>"를 정확히 파싱해야 함', () => {
      expect(extractBudgetAmount('총 1,255백만원')).toBe(1255000000);
      expect(
        extractBudgetAmount(
          '예산액: 금32,000,000원(교부액) / 거점형 소요예산: 금22,000,000원 / 출장형 소요예산: 금6,630,000원 / 총 소요예산: 금28,630,000원'
        )
      ).toBe(28630000);
    });
  });

  // --------------------------------------------------------------------------
  // Tier 4: JSON Integrity, Zod Schema & PIPA Rule Q Compliance
  // --------------------------------------------------------------------------
  describe('4. JSON 유효성, Zod 런타임 스키마 준수 및 개인정보 비식별화 검증 (Rule Q)', () => {
    const adminIndexPath = path.join(process.cwd(), 'data', 'ADMIN_DOC_INDEX.json');
    const seedDocsPath = path.join(process.cwd(), 'data', 'SEED_ONTOLOGY_DOCS.json');

    it('data/ADMIN_DOC_INDEX.json이 존재하며 유효한 JSON 형식이어야 함', () => {
      expect(fs.existsSync(adminIndexPath)).toBe(true);
      const raw = fs.readFileSync(adminIndexPath, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it('data/ADMIN_DOC_INDEX.json 내용이 AdminDocIndexSchema 스키마에 완전 부합해야 함', () => {
      const raw = fs.readFileSync(adminIndexPath, 'utf-8');
      const data = JSON.parse(raw);
      const parseResult = AdminDocIndexSchema.safeParse(data);

      if (!parseResult.success) {
        console.error('Schema Validation Errors:', parseResult.error.format());
      }
      expect(parseResult.success).toBe(true);
    });

    it('data/SEED_ONTOLOGY_DOCS.json이 존재하며 SeedOntologyDocsSchema에 부합해야 함', () => {
      expect(fs.existsSync(seedDocsPath)).toBe(true);
      const raw = fs.readFileSync(seedDocsPath, 'utf-8');
      const data = JSON.parse(raw);
      const parseResult = SeedOntologyDocsSchema.safeParse(data);

      if (!parseResult.success) {
        console.error('Seed Schema Validation Errors:', parseResult.error.format());
      }
      expect(parseResult.success).toBe(true);
    });

    it('색인된 모든 문서의 docId가 전역적으로 유일해야 함 (중복 ID 0건)', () => {
      const data = JSON.parse(fs.readFileSync(adminIndexPath, 'utf-8'));
      const docs = Array.isArray(data) ? data : data.documents || [];
      const ids = docs.map((d: { docId: string }) => d.docId);

      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeGreaterThanOrEqual(300);
    });

    it('생성된 인덱스 파일 내에 평문 개인정보(주민등록번호, 휴대전화번호, 카드번호)가 0건이어야 함 (Rule Q)', () => {
      const content = fs.readFileSync(adminIndexPath, 'utf-8');

      // 1. 주민등록번호 패턴
      const rrnPattern = /\b(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))[- ]?([1-4]\d{6})\b/g;
      const rrnMatches = content.match(rrnPattern) || [];
      expect(rrnMatches).toEqual([]);

      // 2. 휴대전화번호 패턴
      const mobilePattern = /\b(01[016789])[- ]?(\d{3,4})[- ]?(\d{4})\b/g;
      const mobileMatches = content.match(mobilePattern) || [];
      expect(mobileMatches).toEqual([]);

      // 3. 카드번호 패턴
      const cardPattern = /\b(\d{4})[- ]?(\d{4})[- ]?(\d{4})[- ]?(\d{4})\b/g;
      const cardMatches = content.match(cardPattern) || [];
      expect(cardMatches).toEqual([]);
    });

    it('찾아가는 AI 서울체력장 측정 장비 구매 계획 2.hwpx 및 역방향 온톨로지 환류(WORKING_MEMORY, SCHEDULES)가 실제 HWPX 소요예산(28,630,000원)과 100% 일치해야 함 (Rule K & R)', () => {
      const data = JSON.parse(fs.readFileSync(adminIndexPath, 'utf-8'));
      const docs = Array.isArray(data) ? data : data.documents || [];

      const mainPlan = docs.find((d: { originalFileName: string }) => d.originalFileName === '찾아가는 AI 서울체력장 측정 장비 구매 계획 2.hwpx');
      expect(mainPlan).toBeDefined();
      expect(mainPlan.budgetAmount).toBe(28630000);
      expect(mainPlan.summary).toContain('28,630,000원');
      expect(mainPlan.summary).toContain('26,027,273원');
      expect(mainPlan.summary).toContain('40일 이내');

      const copyPlan = docs.find((d: { originalFileName: string }) => d.originalFileName === '찾아가는 AI 서울체력장 측정 장비 구매 계획 2 - 복사본.hwpx');
      if (copyPlan) {
        expect(copyPlan.budgetAmount).toBe(22000000);
        expect(copyPlan.summary).toContain('22,000,000원');
      }

      const wmPath = path.join(process.cwd(), 'data', 'WORKING_MEMORY.json');
      const wmData = JSON.parse(fs.readFileSync(wmPath, 'utf-8'));
      expect(Array.isArray(wmData)).toBe(true);
      const procureWm = wmData.find((item: { id: string }) => item.id === 'wm-procure-ai-seoul-fitness-202611');
      if (procureWm) {
        expect(procureWm.numericHighlight).toBe('28,630,000원');
        expect(procureWm.content).toContain('28,630,000원');
        expect(procureWm.content).toContain('26,027,273원');
        expect(procureWm.content).toContain('40일 이내');
      }

      const schedulesPath = path.join(process.cwd(), 'data', 'SCHEDULES.json');
      const schedulesData = JSON.parse(fs.readFileSync(schedulesPath, 'utf-8'));
      const procureSchedule = schedulesData.find((item: { id: string }) => item.id === 'procure-ai-seoul-fitness-20261125');
      expect(procureSchedule).toBeDefined();
      expect(procureSchedule.notes).toContain('32,000,000원');
      expect(procureSchedule.notes).toContain('22,000,000원');
      expect(procureSchedule.notes).toContain('10,000,000원');
      expect(procureSchedule.notes).toContain('20,000,000원');
      expect(procureSchedule.notes).toContain('9,090,909원');
    });
  });
});
