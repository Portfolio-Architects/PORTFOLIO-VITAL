// Mock next/server for deterministic route handler verification in Jest
jest.mock('next/server', () => {
  class MockNextResponse {
    body: any;
    status: number;
    headers: Map<string, string>;

    constructor(body: any, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body;
      this.status = init?.status || 200;
      this.headers = new Map(
        Object.entries(init?.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
      );
    }

    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }

    static json(body: any, init?: { status?: number; headers?: Record<string, string> }) {
      return new MockNextResponse(body, init);
    }
  }

  return {
    NextResponse: MockNextResponse,
  };
});

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { GET as getArchive } from '@/app/api/archive/route';
import { GET as getArchiveImage } from '@/app/api/archive/image/route';
import { resolveAndValidatePath } from '@/app/api/archive/open/route';

const INDEX_PATH = path.join(process.cwd(), 'data', 'ARCHIVE_INDEX.json');
const MIGRATION_LOG_PATH = fs.existsSync(path.join(process.cwd(), 'data', 'archive', 'ARCHIVE_MIGRATION_LOG.json'))
  ? path.join(process.cwd(), 'data', 'archive', 'ARCHIVE_MIGRATION_LOG.json')
  : path.join(process.cwd(), 'data', 'ARCHIVE_MIGRATION_LOG.json');

describe('Option 3 Non-Destructive Archive Rescue & End-to-End Route Integrity Suite', () => {
  const indexData = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  const migrationLog = JSON.parse(fs.readFileSync(MIGRATION_LOG_PATH, 'utf-8'));

  it('1. verifies ARCHIVE_INDEX.json excludes _Archive_Duplicates and OS/AppleDouble junk while indexing rescued originals', () => {
    expect(indexData.totalIndexed).toBe(indexData.items.length);
    expect(indexData.totalIndexed).toBeGreaterThanOrEqual(7700);

    const dupRefs = indexData.items.filter((it: any) =>
      String(it.relPath).includes('_Archive_Duplicates')
    );
    expect(dupRefs).toHaveLength(0);

    const osJunk = indexData.items.filter((it: any) => {
      const rn = String(it.rawName || '');
      const low = rn.toLowerCase();
      return (
        rn.startsWith('._') ||
        rn.startsWith('~$') ||
        rn.includes('__._') ||
        low === '.ds_store' ||
        low === 'thumbs.db' ||
        low === 'desktop.ini'
      );
    });
    expect(osJunk).toHaveLength(0);

    // Verify Option 3 rescued buckets in ARCHIVE_MIGRATION_LOG.json (1,438 rescued operations)
    const rescuedRecords = (migrationLog.records || []).filter((r: any) =>
      ['D1', 'D4A', 'D4B', 'D5', 'D6', 'M1'].includes(r.bucket)
    );
    expect(rescuedRecords).toHaveLength(1438);
  });

  it('2. enforces Rule Q PIPA masking across all indexed names, snippets, and keywords (RRN, mobile/landline, cards, bank accounts, emails, C1 chars, personal-doc names)', () => {
    const rrnBroadRegex =
      /(?<![\d*-])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\s*[-~–—_.]\s*|\s+)?([1-8]\d{6})(?![\d*-])/;
    const mobileBroadRegex =
      /(?<![\dA-Za-z*-])(01[016789])(?:\s*[-.~–—)]\s*|\s+)?(\d{3,4})(?:\s*[-.~–—]\s*|\s+)?(\d{4})(?![\d*-])/;
    const telSepBroadRegex =
      /(?<![\dA-Za-z*-])(\(?(?:02|0[3-6]\d|070)\)?)[\s.\-~–—)]+(\d{3,4})[\s.\-~–—]+(\d{4})(?![\d*-])/;
    const telNoSepRegex = /(?<![\dA-Za-z*-])(02|0[3-6]\d|070)(\d{3,4})(\d{4})(?![\d*-])/;
    const cardSepBroadRegex =
      /(?<![\d*-])(\d{4})(?:\s*[-~–—]\s*|\s+)(\d{4})(?:\s*[-~–—]\s*|\s+)(\d{4})(?:\s*[-~–—]\s*|\s+)(\d{4})(?![\d*-])/g;
    const bankContextAcctRegex =
      /(?:NH농협|IBK기업|SC제일|카카오뱅크|케이뱅크|토스뱅크|새마을금고|국민|신한|우리|하나|농협|기업|우체국|수협)(?:은행)?[\s:：()]*(\d{2,6}(?:\s*[-–—]\s*\d{1,8}){1,5}|\d{3,6}(?:\s+\d{2,6}){1,2}\s+\d{2,8}|\d{10,16})(?![\d,%.-])/;
    const unmaskedEmailRegex = /[A-Za-z0-9_.+-]{4,}@[A-Za-z0-9-]+\.[A-Za-z0-9-.]+/;
    const controlCharRegex = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/;
    const unmaskedIdOrBankbookFilenameRegex =
      /^(?!강사\s|감사\s|연수\s|연사\s)[가-힣]{2,4}\s+(?:신분증사본|통장사본)\./;

    for (const item of indexData.items) {
      expect(unmaskedIdOrBankbookFilenameRegex.test(item.name || '')).toBe(false);
      const fields = [item.name || '', item.snippet || '', (item.keywords || []).join(' ')];
      for (const text of fields) {
        expect(rrnBroadRegex.test(text)).toBe(false);
        expect(mobileBroadRegex.test(text)).toBe(false);
        expect(telSepBroadRegex.test(text)).toBe(false);
        expect(telNoSepRegex.test(text)).toBe(false);
        expect(bankContextAcctRegex.test(text)).toBe(false);
        expect(unmaskedEmailRegex.test(text)).toBe(false);
        expect(controlCharRegex.test(text)).toBe(false);

        for (const cm of text.matchAll(cardSepBroadRegex)) {
          const gs = [cm[1], cm[2], cm[3], cm[4]];
          const isCalendarYearSeries = gs.every((g) => {
            const yr = Number(g);
            return (g.startsWith('19') || g.startsWith('20')) && yr >= 1990 && yr <= 2039;
          });
          expect(isCalendarYearSeries).toBe(true);
        }
      }
    }

    // Verify Python sanitize_pipa handles Hangul/underscore-adjacent PII, whitespace/en-dash separators,
    // bank-contextualized accounts, personal-doc names, emails, and C1 controls using synthetic fixtures
    const joinDot = (...parts: string[]) => parts.join('.');
    const joinHyphen = (...parts: string[]) => parts.join('-');
    const joinSpacedHyphen = (...parts: string[]) => parts.join(' - ');
    const joinSpace = (...parts: string[]) => parts.join(' ');
    const joinConcat = (...parts: string[]) => parts.join('');
    const joinAt = (local: string, domain: string) => `${local}@${domain}`;

    const syntheticBizNo = joinHyphen('100', '00', '00001');
    const syntheticBudgetCode = joinHyphen('100', '101', '2000', '2001', '300');
    const syntheticSpacedBudgetCode = joinSpacedHyphen('100', '101', '2000', '2001', '300');
    const synthetic10DigitCode = joinHyphen('10', '000', '00001'); // 10 digits (<11): preserved
    const synthetic17DigitCode = joinHyphen('100000', '000', '00000001'); // 17 digits (>16): preserved
    const syntheticYearSeries = joinSpace('2023', '2024', '2025', '2026');
    const syntheticSamples = [
      `연락처${joinDot('010', '0000', '1001')}번 / 공백포함 ${joinSpacedHyphen('010', '0000', '1002')}`,
      `2026_${joinHyphen('010', '0000', '2002')}_강사.hwpx`,
      `홍길동 (洪吉洞) ${joinConcat('900101', ' -', '1000000')} 외 외국인${joinHyphen('920202', '5000000')}`,
      `가상은행A ${joinHyphen('1000', '00', '0000101')} 성명: 홍길동 가상은행B ${joinHyphen('110', '000000', '00202')}`,
      `가상은행C ${joinHyphen('100', '000000', '01', '303')} 사업자번호 ${syntheticBizNo} 예산과목 ${syntheticBudgetCode} / ${syntheticSpacedBudgetCode}`,
      `담당\u0080메일 ${joinAt('tester01', 'example.org')} 유선 (02) ${joinConcat('0000', ' – ', '4004')} 직통 전화: ${joinConcat('02', '0000', '5005')}`,
      '',
      `경계값10자리 ${synthetic10DigitCode} 경계값11자리 ${joinHyphen('100', '00', '000005')} 경계값16자리 ${joinHyphen('100000', '00', '00000606')} 경계값17자리 ${synthetic17DigitCode}`,
      `국민은행 ${joinConcat('10000000', '000101')} 50,000원 / 농협은행 ${joinConcat('301012', '1000202')} / 신한은행 ${joinSpace('110', '000', '000303')}`,
      `카드결제 <${joinConcat('1000-2000-', ' 3000-4004')}> 연도표 ${syntheticYearSeries}`,
      '홍길동 신분증사본.jpg | 10월 근로기록부_김철.pdf | 강사 신분증.zip | 통장사본(메이즈컴퍼니).jpg',
    ];

    const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
    const pyOut = execFileSync(
      pythonBin,
      [
        '-c',
        [
          'import json, sys',
          'from scripts.organize_and_index_archive import sanitize_pipa',
          'samples = json.loads(sys.argv[1])',
          'print(json.dumps([sanitize_pipa(s) for s in samples], ensure_ascii=False))',
        ].join('\n'),
        JSON.stringify(syntheticSamples),
      ],
      { encoding: 'utf-8' }
    ).trim();
    const masked = JSON.parse(pyOut);
    expect(masked[0]).toBe('연락처010-****-1001번 / 공백포함 010-****-1002');
    expect(masked[1]).toBe('2026_010-****-2002_강사.hwpx');
    expect(masked[2]).toBe('홍*동 (***) 900101-******* 외 외국인920202-*******');
    expect(masked[3]).toBe('가상은행A 1000-****-0101 성명: 홍*동 가상은행B 110-****-0202');
    expect(masked[4]).toBe(
      `가상은행C 100-****-303 사업자번호 ${syntheticBizNo} 예산과목 ${syntheticBudgetCode} / ${syntheticSpacedBudgetCode}`
    );
    expect(masked[5]).toBe('담당메일 tes***@example.org 유선 02-***-4004 직통 전화: 02-***-5005');
    expect(masked[6]).toBe('');
    expect(masked[7]).toBe(
      `경계값10자리 ${synthetic10DigitCode} 경계값11자리 100-****-0005 경계값16자리 100000-****-0606 경계값17자리 ${synthetic17DigitCode}`
    );
    expect(masked[8]).toBe(
      '국민은행 1000-****-0101 50,000원 / 농협은행 3010-****-0202 / 신한은행 110-****-0303'
    );
    expect(masked[9]).toBe(`카드결제 <1000-****-****-4004> 연도표 ${syntheticYearSeries}`);
    expect(masked[10]).toBe(
      '홍*동 신분증사본.jpg | 10월 근로기록부_김*.pdf | 강사 신분증.zip | 통장사본(메이즈컴퍼니).jpg'
    );
  });

  it('3. serves special-character rescued files (U+0080 C1 control, unclosed parens, literal %, &) cleanly across /api/archive, /api/archive/image, and resolveAndValidatePath', async () => {
    // 3a. Find real rescued items with C1 control char (U+0080), unclosed parens, literal %, and &
    const c1Image = indexData.items.find(
      (it: any) => it.category === 'image' && /[\x80-\x9f]/.test(it.relPath)
    );
    const unclosedParenDoc = indexData.items.find(
      (it: any) => it.ext === '.hwpx' && /\([^)]*\.hwpx$/i.test(it.relPath)
    );
    const literalPercentImage = indexData.items.find(
      (it: any) => it.category === 'image' && it.relPath.includes('%')
    );
    const ampersandDoc = indexData.items.find((it: any) => it.relPath.includes('&'));

    expect(c1Image).toBeDefined();
    expect(unclosedParenDoc).toBeDefined();
    expect(literalPercentImage).toBeDefined();
    expect(ampersandDoc).toBeDefined();

    // 3b. Verify GET /api/archive/image handles U+0080 and literal % filenames without 400/403/500
    // and returns 200 + binary buffer whenever the target file is present on F:\_Organized_Archive
    const hasArchiveDrive = fs.existsSync('F:\\_Organized_Archive');
    if (hasArchiveDrive) {
      let servedLiveImage = false;
      for (const imgItem of [c1Image, literalPercentImage]) {
        const reqUrl = `http://localhost:3001/api/archive/image?path=${encodeURIComponent(
          imgItem.relPath
        )}`;
        const res: any = await getArchiveImage({ url: reqUrl } as any);
        const targetExists = fs.existsSync(
          path.win32.resolve('F:\\_Organized_Archive', imgItem.relPath)
        );
        if (targetExists) {
          expect(res.status).toBe(200);
          expect(Buffer.isBuffer(res.body) || res.body instanceof Uint8Array).toBe(true);
          expect(res.body.length).toBeGreaterThan(100);
          servedLiveImage = true;
        } else {
          // Special-character path still passes validation cleanly (404 missing file, never 400/403/500)
          expect(res.status).toBe(404);
        }
      }
      if (!servedLiveImage) {
        // Confirm /api/archive/image serves an actual image present in F:\_Organized_Archive
        const rootImage = fs
          .readdirSync('F:\\_Organized_Archive')
          .find((name) => /\.(png|jpe?g|webp|gif)$/i.test(name));
        if (rootImage) {
          const res: any = await getArchiveImage({
            url: `http://localhost:3001/api/archive/image?path=${encodeURIComponent(rootImage)}`,
          } as any);
          expect(res.status).toBe(200);
          expect(Buffer.isBuffer(res.body) || res.body instanceof Uint8Array).toBe(true);
          expect(res.body.length).toBeGreaterThan(100);
        }
      }
    }

    // 3c. Verify GET /api/archive search handles unclosed parenthesis query without RegExp crash
    const searchUrl = `http://localhost:3001/api/archive?year=ALL&q=${encodeURIComponent(
      '_1(강남구보건소'
    )}`;
    const searchRes: any = await getArchive({ url: searchUrl } as any);
    expect(searchRes.status).toBe(200);
    const searchJson = await searchRes.json();
    expect(searchJson.totalMatched).toBeGreaterThan(0);

    // 3d. Verify resolveAndValidatePath accepts %25-escaped literal-% path, C1 path, unclosed-paren path, and &-path
    const hasHierarchicalArchiveTree =
      hasArchiveDrive && fs.existsSync('F:\\_Organized_Archive\\2026년');
    for (const target of [c1Image, unclosedParenDoc, literalPercentImage, ampersandDoc]) {
      const clientEscaped = String(target.relPath).replace(/%/g, '%25');
      const v = resolveAndValidatePath(clientEscaped);
      expect(v.ok).toBe(true);
      if (v.ok && hasHierarchicalArchiveTree) {
        expect(fs.existsSync(v.fullPath)).toBe(true);
      }
    }

    // 3e. Verify /api/archive/image blocks traversal and poison null bytes
    const badTraversal: any = await getArchiveImage({
      url: 'http://localhost:3001/api/archive/image?path=..%2F..%2FWindows%2Fwin.ini',
    } as any);
    expect(badTraversal.status).toBe(403);

    const badNull: any = await getArchiveImage({
      url: 'http://localhost:3001/api/archive/image?path=2026%EB%85%84%2Ftest%00.png',
    } as any);
    expect(badNull.status).toBe(400);
  });
});
