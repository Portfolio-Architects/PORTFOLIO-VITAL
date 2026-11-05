import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  extractNumericHighlight,
  extractDateHighlight,
  parseWorkingMemoryInput,
  getContextRelevantMemos,
  createWorkingMemoryMemo,
  createWorkingMemoryMemosFromText,
  splitWorkingMemoryLines,
  mergeWorkingMemoryMemos,
  nextMonotonicIso,
  DEFAULT_WORKING_MEMORY_MEMOS,
} from '@/lib/working-memory-parser';
import { resetWorkingMemoryStoreForTest } from '@/hooks/useWorkingMemory';
import { WorkingMemoryBoard } from '@/components/dashboard/WorkingMemoryBoard';
import { WorkingMemoryContextBanner } from '@/components/dashboard/WorkingMemoryContextBanner';
import { MobileMemoInbox } from '@/components/dashboard/MobileMemoInbox';
import {
  EdgeKVNamespace,
  onRequestGet as edgeMemoGet,
  onRequestPost as edgeMemoPost,
} from '../functions/api/memo';

jest.mock('@/lib/sheets-api', () => ({
  readSheet: jest.fn().mockResolvedValue([]),
  addRow: jest.fn().mockResolvedValue(true),
  updateRow: jest.fn().mockResolvedValue(true),
  deleteRow: jest.fn().mockResolvedValue(true),
}));

describe('Milestone 277: Working Memory Post-it Board & Mobile KV Memo Inbox Suite', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetWorkingMemoryStoreForTest(DEFAULT_WORKING_MEMORY_MEMOS);
    jest.clearAllMocks();
  });

  describe('1. 1-Second Auto-Tagging & Numeric/Date Highlight Parser (working-memory-parser.ts)', () => {
    it('accurately parses the real 9/21 2027 budget increase memo with category, multi-tags, numeric transition, and date', () => {
      const input =
        '9/21 통합건강증진사업 가내시 메모보고: 2027 건강생활실천사업 본예산 증액 반영 필요 (기존 6,500만 원 → 변경 7,800만 원)';
      const parsed = parseWorkingMemoryInput(input);

      expect(parsed.category).toBe('budget');
      expect(parsed.tags).toContain('[2027 예산편성]');
      expect(parsed.tags).toContain('[팀장님 지시]');
      expect(parsed.numericHighlight).toBe('6,500만 원 → 7,800만 원');
      expect(parsed.dateHighlight).toBe('9. 21.');
    });

    it('extracts diverse numeric transitions including unitless arrows (6500 -> 7800), right-side-unitless arrows, and unitless deltas', () => {
      expect(extractNumericHighlight('6500 -> 7800')).toBe('6500 → 7800');
      expect(extractNumericHighlight('기존 6,500만 원 -> 7,800')).toBe('6,500만 원 → 7,800');
      expect(extractNumericHighlight('기존 6500만원 -> 변경 7800만원')).toBe(
        '6500만원 → 7800만원'
      );
      expect(extractNumericHighlight('걷기 마일리지 시범동 5개 동 => 6개 동 확대')).toBe(
        '5개 동 → 6개 동'
      );
      expect(extractNumericHighlight('사무관리비 1,200만 원 증액')).toBe('1,200만 원 증액');
      expect(extractNumericHighlight('예산 7,800 증액')).toBe('7,800 증액');
      expect(extractNumericHighlight('일상경비 이중차감 0건 확인')).toBe('0건');
      expect(extractNumericHighlight('')).toBeUndefined();
      expect(extractNumericHighlight('   ')).toBeUndefined();
    });

    it('extracts administrative dates (including ISO & multi-dates) while strictly ignoring e-Hojo statItem codes and decimal numbers', () => {
      expect(extractDateHighlight('9/21 가내시 메모보고')).toBe('9. 21.');
      expect(extractDateHighlight('2026-09-21 통합건강증진사업 가내시')).toBe('9. 21.');
      expect(extractDateHighlight('2026년 10월 5일 팀장님 구두지시')).toBe('10. 5.');
      expect(extractDateHighlight('10. 22. 구의회 행정감사 자료 제출')).toBe('10. 22.');
      expect(extractDateHighlight('9/21 가내시, 10/15 최종확정')).toBe('9. 21. · 10. 15.');
      expect(extractDateHighlight('9/21~9/28 행감 집중 준비기간')).toBe('9. 21.~9. 28.');
      // Must NOT misclassify statItem codes as dates
      expect(extractDateHighlight('201-01 사무관리비 산출내역 점검')).toBeUndefined();
      expect(extractDateHighlight('101-04 기간제근로자등보수 단가 확인')).toBeUndefined();
      // Must NOT misclassify decimal quantities with units as dates
      expect(extractDateHighlight('예산 1.5억 원 증액')).toBeUndefined();
      expect(extractDateHighlight('집행률 3.5% 상승')).toBeUndefined();
      expect(extractDateHighlight('13/45 잘못된 날짜')).toBeUndefined();
    });

    it('splits multi-line pasted text into distinct auto-tagged WorkingMemoryMemo records', () => {
      const multiLine = [
        '- 9/21 가내시 메모보고: 건강생활실천 본예산 6,500만 원 → 7,800만 원 증액',
        '• 팀장님 지시: 10/28 행정감사 요구자료 제출 전 일상경비 대조표 확인',
      ].join('\n');

      const lines = splitWorkingMemoryLines(multiLine);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe(
        '9/21 가내시 메모보고: 건강생활실천 본예산 6,500만 원 → 7,800만 원 증액'
      );

      const records = createWorkingMemoryMemosFromText({ content: multiLine });
      expect(records).toHaveLength(2);
      expect(records[0].category).toBe('budget');
      expect(records[0].numericHighlight).toBe('6,500만 원 → 7,800만 원');
      expect(records[1].tags).toContain('[팀장님 지시]');
      expect(records[1].tags).toContain('[행정감사]');
      expect(records[1].dateHighlight).toBe('10. 28.');
    });

    it('classifies directive, audit, festival, and general memos and respects explicitCategory override', () => {
      const directive = parseWorkingMemoryInput('팀장님 지시: 내일 오전 현안회의 자료 준비');
      expect(directive.category).toBe('directive');
      expect(directive.tags).toContain('[팀장님 지시]');

      const audit = parseWorkingMemoryInput('구의회 행정감사 요구자료 예상질의 답변서 보완');
      expect(audit.category).toBe('audit');
      expect(audit.tags).toContain('[행정감사]');

      const festival = parseWorkingMemoryInput('양재천 페스티벌 건강부스 현수막 시안 최종 확인');
      expect(festival.category).toBe('festival');
      expect(festival.tags).toContain('[양재천 행사]');

      const general = parseWorkingMemoryInput('복합기 토너 여분 확인');
      expect(general.category).toBe('general');
      expect(general.tags).toEqual(['[일반 메모]']);

      const overridden = parseWorkingMemoryInput('복합기 토너 여분 확인', 'budget');
      expect(overridden.category).toBe('budget');
      expect(overridden.tags[0]).toBe('[2027 예산편성]');
    });

    it('filters context-relevant pending memos for workspace, simulator, festival, and project modules', () => {
      const workspaceMemos = getContextRelevantMemos(DEFAULT_WORKING_MEMORY_MEMOS, 'workspace');
      const simulatorMemos = getContextRelevantMemos(DEFAULT_WORKING_MEMORY_MEMOS, 'simulator');
      const festivalMemos = getContextRelevantMemos(DEFAULT_WORKING_MEMORY_MEMOS, 'festival');
      const projectMemos = getContextRelevantMemos(DEFAULT_WORKING_MEMORY_MEMOS, 'project');

      expect(workspaceMemos.map((m) => m.id)).toContain('wm-seed-budget-2027');
      expect(workspaceMemos.map((m) => m.id)).toContain('wm-seed-directive-audit');
      expect(simulatorMemos.map((m) => m.id)).toContain('wm-seed-budget-2027');

      expect(festivalMemos.map((m) => m.id)).toContain('wm-seed-directive-audit');
      expect(festivalMemos.map((m) => m.id)).not.toContain('wm-seed-festival-yangjae');

      expect(projectMemos.map((m) => m.id)).toContain('wm-seed-audit-qna');
    });

    it('resolves concurrent edits under clock skew and filters tombstoned IDs in mergeWorkingMemoryMemos', () => {
      const baseMemo = createWorkingMemoryMemo({
        id: 'wm-skew-1',
        content: '9/21 본예산 6,500만 원 → 7,800만 원',
        nowIso: '2026-10-26T12:00:00.000Z', // PC clock is 5 minutes ahead
      });

      // Mobile device (clock is 5 minutes behind at 11:55:00) marks wm-skew-1 as reflected
      const mobileReflected = {
        ...baseMemo,
        status: 'reflected' as const,
        reflectedAt: '2026-10-26T11:55:00.000Z',
        updatedAt: '2026-10-26T11:55:00.000Z',
      };

      const merged = mergeWorkingMemoryMemos([baseMemo], [mobileReflected]);
      expect(merged).toHaveLength(1);
      expect(merged[0].status).toBe('reflected');
      expect(Date.parse(merged[0].updatedAt)).toBeGreaterThan(Date.parse(baseMemo.updatedAt));

      // Tombstone filtering prevents deleted memo resurrection
      const afterDeleteMerge = mergeWorkingMemoryMemos(
        [baseMemo],
        [mobileReflected],
        ['wm-skew-1']
      );
      expect(afterDeleteMerge).toHaveLength(0);

      // nextMonotonicIso guarantees strictly advancing timestamp even when wall clock is behind
      const monotonic = nextMonotonicIso(
        '2026-10-26T12:00:00.000Z',
        undefined,
        Date.parse('2026-10-26T11:00:00.000Z')
      );
      expect(Date.parse(monotonic)).toBe(Date.parse('2026-10-26T12:00:00.001Z'));
    });
  });

  describe('2. Main Dashboard WorkingMemoryBoard UI, Multi-Line Paste & Category Filtering', () => {
    it('renders seed Post-it cards, supports multi-line paste batch capture, filters cross-tagged memos from data/WORKING_MEMORY.json, and marks reflected', async () => {
      const liveDiskData = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'data', 'WORKING_MEMORY.json'), 'utf-8')
      );
      resetWorkingMemoryStoreForTest(liveDiskData);

      render(<WorkingMemoryBoard />);

      expect(screen.getByTestId('working-memory-board')).toBeInTheDocument();
      expect(screen.getAllByText(/6,500만 원 → 7,800만 원/).length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByRole('combobox')).toHaveLength(0);

      // Filter by '[팀장님 지시]' and verify cross-tagged 'wm-seed-budget-2027' (category: budget, tag: [팀장님 지시]) remains visible
      const directiveFilterBtn = screen.getByRole('button', { name: '[팀장님 지시]' });
      fireEvent.click(directiveFilterBtn);
      expect(screen.getByTestId('working-memory-card-wm-seed-budget-2027')).toBeInTheDocument();
      // Reset filter to all
      fireEvent.click(directiveFilterBtn);

      const input = screen.getByTestId('working-memory-input');
      fireEvent.change(input, {
        target: {
          value:
            '10/28 가내시 확정: 2027 신체활동사업 시비 3,200만 원 → 4,000만 원 증액\n팀장님 지시: 11/2 예산 설명자료 제출',
        },
      });

      // Live preview strip shows multi-line batch badge + numeric highlight
      expect(screen.getByTestId('working-memory-live-preview')).toBeInTheDocument();
      expect(screen.getByTestId('working-memory-preview-multiline')).toHaveTextContent(
        '다중 줄 일괄 캡처 (2건)'
      );
      expect(screen.getByTestId('working-memory-preview-numeric')).toHaveTextContent(
        '3,200만 원 → 4,000만 원'
      );

      // Submit batch capture
      fireEvent.click(screen.getByTestId('working-memory-submit'));

      await waitFor(() => {
        expect(
          screen.getByText(
            /10\/28 가내시 확정: 2027 신체활동사업 시비 3,200만 원 → 4,000만 원 증액/
          )
        ).toBeInTheDocument();
        expect(screen.getByText(/팀장님 지시: 11\/2 예산 설명자료 제출/)).toBeInTheDocument();
      });

      // Click [✓ 반영 완료] on the seed 2027 budget memo
      const reflectBtn = screen.getByTestId('reflect-memo-wm-seed-budget-2027');
      fireEvent.click(reflectBtn);

      await waitFor(() => {
        expect(
          screen.queryByTestId('working-memory-card-wm-seed-budget-2027')
        ).not.toBeInTheDocument();
      });
    });

    it('supports 3 layout modes (Grid, 4-Lane Kanban, Ledger Table), inline memo editing with re-parsed numeric delta, KPI filters, and module navigation', async () => {
      resetWorkingMemoryStoreForTest(DEFAULT_WORKING_MEMORY_MEMOS);
      const onNavigateModule = jest.fn();

      render(<WorkingMemoryBoard onNavigateModule={onNavigateModule} />);

      expect(screen.getByTestId('working-memory-page')).toBeInTheDocument();

      // Switch to 4-Column Kanban view
      fireEvent.click(screen.getByTestId('working-memory-layout-kanban'));
      expect(screen.getByTestId('working-memory-kanban-view')).toBeInTheDocument();
      expect(screen.getByTestId('lane-directive')).toBeInTheDocument();
      expect(screen.getByTestId('lane-budget')).toBeInTheDocument();

      // Switch to Numeric & Deadline Ledger Table view
      fireEvent.click(screen.getByTestId('working-memory-layout-ledger'));
      expect(screen.getByTestId('working-memory-ledger-view')).toBeInTheDocument();
      expect(
        screen.getByTestId('working-memory-ledger-row-wm-seed-budget-2027')
      ).toBeInTheDocument();

      // Switch back to Post-it Grid view and test inline editing
      fireEvent.click(screen.getByTestId('working-memory-layout-grid'));
      fireEvent.click(screen.getByTestId('edit-memo-btn-wm-seed-budget-2027'));

      const editTextarea = screen.getByTestId('edit-memo-textarea-wm-seed-budget-2027');
      fireEvent.change(editTextarea, {
        target: {
          value:
            '9/21 통합건강증진사업 가내시 재조정: 2027 건강생활실천 본예산 7,800만 원 → 8,200만 원 최종 확정',
        },
      });
      fireEvent.click(screen.getByTestId('save-edit-memo-wm-seed-budget-2027'));

      await waitFor(() => {
        expect(screen.getAllByText(/7,800만 원 → 8,200만 원/).length).toBeGreaterThanOrEqual(1);
      });

      // Test keyword search input
      const searchInput = screen.getByTestId('working-memory-search');
      fireEvent.change(searchInput, { target: { value: '8,200만 원' } });
      expect(screen.getByTestId('working-memory-card-wm-seed-budget-2027')).toBeInTheDocument();
      expect(
        screen.queryByTestId('working-memory-card-wm-seed-audit-qna')
      ).not.toBeInTheDocument();
    });
  });

  describe('3. Context-Triggered Auto-Pinned Banner (WorkingMemoryContextBanner)', () => {
    it('auto-pins unreflected budget & directive memos in simulator/workspace and unmounts when all are marked reflected', async () => {
      const onlyOneBudgetMemo = [
        createWorkingMemoryMemo({
          id: 'wm-test-only-1',
          content: '9/21 본예산 6,500만 원 → 7,800만 원 증액 반영',
          explicitCategory: 'budget',
        }),
      ];
      resetWorkingMemoryStoreForTest(onlyOneBudgetMemo);

      render(<WorkingMemoryContextBanner contextModule="simulator" />);

      expect(
        screen.getByTestId('working-memory-context-banner-simulator')
      ).toBeInTheDocument();
      expect(screen.getAllByText(/6,500만 원 → 7,800만 원/).length).toBeGreaterThanOrEqual(2);

      // Click [✓ 반영 완료] inside the banner
      fireEvent.click(screen.getByTestId('banner-reflect-wm-test-only-1'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('working-memory-context-banner-simulator')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('4. Mobile Memo Inbox (MobileMemoInbox) 448px Ergonomics, PIN Lock & Mobile Update/Delete Relay', () => {
    it('enforces PIN lock screen, unlocks with valid PIN, captures mobile memo, and persists mobile reflect/delete via /api/memo', async () => {
      const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];

      global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        const pin = headers.get('X-Memo-Pin');
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url, method: init?.method || 'GET', body });

        if (pin !== '7116') {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ success: false, error: 'PIN 번호가 일치하지 않습니다.' }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: DEFAULT_WORKING_MEMORY_MEMOS,
          }),
        });
      }) as jest.Mock;

      render(<MobileMemoInbox />);

      const container = screen.getByTestId('mobile-memo-inbox-container');
      expect(container.className).toContain('max-w-md');

      // Initially locked
      expect(screen.getByTestId('mobile-memo-pin-form')).toBeInTheDocument();

      // Wrong PIN
      fireEvent.change(screen.getByTestId('mobile-memo-pin-input'), {
        target: { value: '9999' },
      });
      fireEvent.click(screen.getByTestId('mobile-memo-pin-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('mobile-memo-pin-error')).toHaveTextContent(
          'PIN 번호가 일치하지 않습니다.'
        );
      });

      // Correct PIN
      fireEvent.change(screen.getByTestId('mobile-memo-pin-input'), {
        target: { value: '7116' },
      });
      fireEvent.click(screen.getByTestId('mobile-memo-pin-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('mobile-memo-textarea')).toBeInTheDocument();
      });

      // Submit a mobile memo
      fireEvent.change(screen.getByTestId('mobile-memo-textarea'), {
        target: { value: '팀장님 지시: 11/2 예산 설명자료 500만 원 증액분 표기' },
      });
      fireEvent.click(screen.getByTestId('mobile-memo-send-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('mobile-memo-sent-toast')).toHaveTextContent('500만 원 증액');
      });

      // Mobile [✓ 반영 완료] dispatches POST /api/memo with action: 'update'
      fireEvent.click(screen.getByTestId('mobile-reflect-wm-seed-budget-2027'));
      await waitFor(() => {
        expect(
          calls.some(
            (c) =>
              c.url === '/api/memo' &&
              c.method === 'POST' &&
              c.body?.action === 'update' &&
              c.body?.id === 'wm-seed-budget-2027'
          )
        ).toBe(true);
      });

      // Mobile [삭제] dispatches POST /api/memo with action: 'delete' and records tombstone
      fireEvent.click(screen.getByTestId('mobile-delete-wm-seed-audit-qna'));
      await waitFor(() => {
        expect(
          calls.some(
            (c) =>
              c.url === '/api/memo' &&
              c.method === 'POST' &&
              c.body?.action === 'delete' &&
              c.body?.id === 'wm-seed-audit-qna'
          )
        ).toBe(true);
      });
      expect(window.localStorage.getItem('hchps-global-tombstones')).toContain(
        'wm-seed-audit-qna'
      );
    });
  });

  describe('5. Cloudflare Pages Function KV Handler (functions/api/memo.ts) Execution Verification', () => {
    it('executes GET and POST (add, update, delete with tombstone, and clock-skew sync) against an in-memory KVNamespace binding', async () => {
      if (typeof Request === 'undefined' || typeof Response === 'undefined') {
        return;
      }

      const kvStore = new Map<string, string>();
      const mockKv = {
        get: jest.fn(async (key: string) => kvStore.get(key) ?? null),
        put: jest.fn(async (key: string, val: string) => {
          kvStore.set(key, val);
        }),
      };
      const env = { HCHPS_DATA: mockKv as EdgeKVNamespace, MEMO_PIN: '7116' };

      // 1. Unauthorized GET rejected with 401
      const unauthRes = await edgeMemoGet({
        request: new Request('https://portfolio-hchps.pages.dev/api/memo', {
          headers: { 'X-Memo-Pin': 'wrong' },
        }),
        env,
      } as unknown as Parameters<typeof edgeMemoGet>[0]);
      expect(unauthRes.status).toBe(401);

      // 2. Authorized POST add
      const sampleMemo = createWorkingMemoryMemo({
        id: 'wm-edge-1',
        content: '9/21 가내시 6500 -> 7800 증액',
        source: 'mobile',
        nowIso: '2026-10-26T10:00:00.000Z',
      });
      const addRes = await edgeMemoPost({
        request: new Request('https://portfolio-hchps.pages.dev/api/memo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Memo-Pin': '7116' },
          body: JSON.stringify({ action: 'add', memo: sampleMemo }),
        }),
        env,
      } as unknown as Parameters<typeof edgeMemoPost>[0]);
      expect(addRes.status).toBe(200);
      const addJson = await addRes.json();
      expect(addJson.success).toBe(true);
      expect(addJson.data).toHaveLength(1);

      // 3. Authorized POST delete records tombstone and prevents sync resurrection
      const delRes = await edgeMemoPost({
        request: new Request('https://portfolio-hchps.pages.dev/api/memo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Memo-Pin': '7116' },
          body: JSON.stringify({ action: 'delete', id: 'wm-edge-1' }),
        }),
        env,
      } as unknown as Parameters<typeof edgeMemoPost>[0]);
      const delJson = await delRes.json();
      expect(delJson.data).toHaveLength(0);

      // 4. Sync attempting to push deleted 'wm-edge-1' back is blocked by KV tombstone
      const syncRes = await edgeMemoPost({
        request: new Request('https://portfolio-hchps.pages.dev/api/memo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Memo-Pin': '7116' },
          body: JSON.stringify({ action: 'sync', memos: [sampleMemo] }),
        }),
        env,
      } as unknown as Parameters<typeof edgeMemoPost>[0]);
      const syncJson = await syncRes.json();
      expect(syncJson.data).toHaveLength(0);
    });
  });
});
