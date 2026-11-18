/**
 * VITAL Work & Wealth Architecture — Comprehensive Weekly HWPX Test Suite
 * Requirement: R1 (Weekly Administrative Work Reports & 2-Column Comparative HWPX Auto-Build)
 * Standards: Rule G (HWPX Pipeline), Rule M (Admin Style), Rule P (Clinical Hard Breaks), Rule O (Non-Destructive)
 */

import fs from 'fs';
import path from 'path';
import { execSync, execFileSync } from 'child_process';
import JSZip from 'jszip';
import {
  computeWednesdayBatchPeriods,
  formatPeriodLabel,
  formatWeeklyBlockToLines,
  groupWeeklyItemsByProject,
  aggregateTasksForWednesday,
  WeeklyProjectBlock,
} from '@/lib/weekly/wednesday-batcher';
import {
  WeeklyReportSchema,
  WeeklyWorkItemSchema,
  WeeklyReportDto,
  WeeklyWorkItemDto,
  TaskDto,
} from '@/lib/schemas';

describe('VITAL Requirement R1 — Weekly HWPX Pipeline & Wednesday Batching Suite', () => {
  const scratchDir = path.join(process.cwd(), 'scratch');

  beforeAll(() => {
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
  });

  // ==========================================================================
  // Tier 1: Wednesday Batching Window & Date Arithmetic
  // ==========================================================================
  describe('Tier 1: Wednesday Date Arithmetic & Cycle Calculations', () => {
    it('computes exact date windows for standard Wednesday 2026-11-04 [W-2, W+4] and [W+5, W+11]', () => {
      const cycle = computeWednesdayBatchPeriods('2026-11-04');

      expect(cycle.targetWednesday).toBe('2026-11-04');
      expect(cycle.performanceStart).toBe('2026-11-02'); // Monday
      expect(cycle.performanceEnd).toBe('2026-11-08');   // Sunday
      expect(cycle.planStart).toBe('2026-11-09');          // Next Monday
      expect(cycle.planEnd).toBe('2026-11-15');            // Next Sunday

      expect(cycle.performanceLabel).toBe('11. 02.(월) ~ 11. 08.(일)');
      expect(cycle.planLabel).toBe('11. 09.(월) ~ 11. 15.(일)');
    });

    it('correctly shifts to target Wednesday when given Thursday or Monday within the week', () => {
      // Monday 2026-11-02 should target Wednesday 2026-11-04
      const fromMon = computeWednesdayBatchPeriods('2026-11-02');
      expect(fromMon.targetWednesday).toBe('2026-11-04');

      // Friday 2026-11-06 should also target Wednesday 2026-11-04
      const fromFri = computeWednesdayBatchPeriods('2026-11-06');
      expect(fromFri.targetWednesday).toBe('2026-11-04');
    });

    it('handles leap day boundary (Feb 29, 2028 - Tuesday -> Wed Mar 1, 2028)', () => {
      const cycle = computeWednesdayBatchPeriods('2028-02-29');
      expect(cycle.targetWednesday).toBe('2028-03-01');
      expect(cycle.performanceStart).toBe('2028-02-28'); // Monday
      expect(cycle.performanceEnd).toBe('2028-03-05');   // Sunday
    });

    it('handles year-end transition boundary (Dec 30, 2026 - Wednesday)', () => {
      const cycle = computeWednesdayBatchPeriods('2026-12-30');
      expect(cycle.targetWednesday).toBe('2026-12-30');
      expect(cycle.performanceStart).toBe('2026-12-28');
      expect(cycle.performanceEnd).toBe('2027-01-03');
      expect(cycle.planStart).toBe('2027-01-04');
      expect(cycle.planEnd).toBe('2027-01-10');
      expect(cycle.performanceLabel).toBe('12. 28.(월) ~ 01. 03.(일)');
    });

    it('loudly throws error on invalid date inputs (Loud-Failure guard)', () => {
      expect(() => computeWednesdayBatchPeriods('not-a-valid-date')).toThrow(
        '[WEDNESDAY BATCH ERROR]'
      );
      expect(() => computeWednesdayBatchPeriods('')).toThrow(
        '[WEDNESDAY BATCH ERROR]'
      );
    });
  });

  // ==========================================================================
  // Tier 2: Task Batching, Category Grouping & Public Admin Formatting
  // ==========================================================================
  describe('Tier 2: Batch Grouping & Public Admin Formatting', () => {
    it('groups weekly items into performance and plan sorted by projectOrder', () => {
      const rawItems: WeeklyWorkItemDto[] = [
        {
          id: 'it-1',
          projectOrder: 10,
          projectName: '비만예방 및 걷기 챌린지',
          period: '2026. 11. 2.(월) ~ 11. 8.(일)',
          contents: ['가을철 15만보 걷기 챌린지 운영'],
          status: 'performance',
        },
        {
          id: 'it-2',
          projectOrder: 8,
          projectName: '서울체력장 강남센터 운영',
          period: '2026. 11. 2.(월) ~ 11. 6.(금)',
          contents: ['과학적 체력 측정 및 운동처방'],
          status: 'performance',
        },
        {
          id: 'it-3',
          projectOrder: 8,
          projectName: '서울체력장 강남센터 운영',
          period: '2026. 11. 9.(월) ~ 11. 13.(금)',
          contents: ['찾아가는 이동 체력측정실 운영'],
          status: 'plan',
        },
      ];

      const { performance, plan } = groupWeeklyItemsByProject(rawItems);
      expect(performance.length).toBe(2);
      expect(plan.length).toBe(1);

      // Verify ascending order by projectOrder
      expect(performance[0].projectOrder).toBe(8);
      expect(performance[1].projectOrder).toBe(10);
      expect(plan[0].projectOrder).toBe(8);
    });

    it('formats a project block into public administration standard lines (Rule M & Rule P)', () => {
      const block: WeeklyProjectBlock = {
        projectOrder: 8,
        projectName: '서울체력장 강남센터',
        period: '2026. 11. 2.(월) ~ 11. 6.(금)',
        target: '관내 주민, 직장인 등',
        location: '강남스포츠문화센터',
        contents: [
          '과학적 체력 측정 및 운동처방 실시',
          '국민체력100 공인인증서 발급',
        ],
        metrics: '금주 48명 측정 / 누계 1,280명',
        status: 'performance',
      };

      const lines = formatWeeklyBlockToLines(block);

      expect(lines[0]).toBe('8. 서울체력장 강남센터');
      expect(lines[1]).toBe(' ○ 기    간 : 2026. 11. 2.(월) ~ 11. 6.(금)');
      expect(lines[2]).toBe(' ○ 대    상 : 관내 주민, 직장인 등');
      expect(lines[3]).toBe(' ○ 장    소 : 강남스포츠문화센터');
      expect(lines[4]).toBe(' ○ 내    용');
      expect(lines[5]).toBe('   - 과학적 체력 측정 및 운동처방 실시');
      expect(lines[6]).toBe('   - 국민체력100 공인인증서 발급');
      expect(lines[7]).toBe(' ○ 실    적 : 금주 48명 측정 / 누계 1,280명');
    });

    it('aggregates generic TaskDto tasks into authentic Wednesday weekly report', () => {
      const sampleTasks: TaskDto[] = [
        {
          id: 'tsk-01',
          title: '체력측정 장비 정밀 검교정 완료',
          status: 'done',
          category: '서울체력장',
          priority: 'high',
          dueDate: '2026-11-04',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-04T00:00:00Z',
          tags: ['체력장'],
        },
        {
          id: 'tsk-02',
          title: '취약계층 어르신 PT 순환운동 지도',
          status: 'in-progress',
          category: '공공PT',
          priority: 'medium',
          dueDate: '2026-11-10',
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-02T00:00:00Z',
          tags: ['신체활동'],
        },
      ];

      const { periods, weeklyReport } = aggregateTasksForWednesday(sampleTasks, '2026-11-04');
      expect(periods.targetWednesday).toBe('2026-11-04');
      expect(weeklyReport.items.length).toBe(2);

      const perfItem = weeklyReport.items.find((it) => it.status === 'performance');
      const planItem = weeklyReport.items.find((it) => it.status === 'plan');

      expect(perfItem).toBeDefined();
      expect(perfItem?.projectName).toContain('서울체력장');
      expect(planItem).toBeDefined();
      expect(planItem?.projectName).toContain('공공 PT');
    });
  });

  // ==========================================================================
  // Tier 3: Zod Schema Compliance & Seed Parity
  // ==========================================================================
  describe('Tier 3: Schema Compliance & Seed Database Parity', () => {
    it('validates WeeklyWorkItemSchema with valid fields', () => {
      const item: WeeklyWorkItemDto = {
        id: 'test-item-1',
        projectOrder: 8,
        projectName: '서울체력장 강남센터',
        period: '2026. 11. 2.(월) ~ 11. 6.(금)',
        target: '관내 주민',
        contents: ['맞춤형 운동처방'],
        metrics: '금주 50명',
        status: 'performance',
      };

      const parsed = WeeklyWorkItemSchema.parse(item);
      expect(parsed.projectOrder).toBe(8);
      expect(parsed.status).toBe('performance');
    });

    it('validates data/WEEKLY_REPORTS.json seed file against WeeklyReportSchema', () => {
      const dataPath = path.join(process.cwd(), 'data', 'WEEKLY_REPORTS.json');
      expect(fs.existsSync(dataPath)).toBe(true);

      const raw = fs.readFileSync(dataPath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(1);

      parsed.forEach((report: any) => {
        const validated = WeeklyReportSchema.parse(report);
        expect(validated.departmentName).toBe('보건행정과');
        expect(validated.teamTitle).toContain('건강증진팀장');
        expect(validated.items.length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // Tier 4: Master 2-Column HWPX Generation & 5-Pillar Anti-Overlap Verification
  // ==========================================================================
  describe('Tier 4: Master 2-Column HWPX Generation & 5-Pillar Verification', () => {
    const testHwpxPath = path.join(scratchDir, 'test_weekly_generated.hwpx');

    afterAll(() => {
      if (fs.existsSync(testHwpxPath)) {
        try {
          fs.unlinkSync(testHwpxPath);
        } catch {}
      }
    });

    it('generates authentic 2-column comparative HWPX via scripts/generate_weekly_hwpx.py', () => {
      const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
      const scriptPath = path.join(process.cwd(), 'scripts', 'generate_weekly_hwpx.py');

      const cmd = `"${pythonBin}" "${scriptPath}" --date 2026-11-04 --output "${testHwpxPath}"`;
      const stdout = execSync(cmd).toString('utf-8');

      expect(stdout).toContain('SUCCESS');
      expect(fs.existsSync(testHwpxPath)).toBe(true);
    });

    it('validates ZIP headers: mimetype at 0-offset STORE and Bit 2 Fast Deflating flag (value 4)', async () => {
      const buf = fs.readFileSync(testHwpxPath);
      const zip = await JSZip.loadAsync(buf);

      // 1. Verify mimetype
      const files = Object.keys(zip.files);
      expect(files[0]).toBe('mimetype');

      // 2. Verify section0.xml & header.xml exist
      expect(zip.file('Contents/section0.xml')).not.toBeNull();
      expect(zip.file('Contents/header.xml')).not.toBeNull();

      // 3. Verify Bit 2 Fast Deflating flags via binary scan
      let hasBadFlag = false;
      let offset = 0;
      while (offset < buf.length - 30) {
        if (buf.readUInt32LE(offset) === 0x04034b50) {
          // Local header
          const compMethod = buf.readUInt16LE(offset + 8);
          const flagBits = buf.readUInt16LE(offset + 6);
          if (compMethod === 8 && flagBits !== 4) {
            hasBadFlag = true;
          }
        }
        offset++;
      }
      expect(hasBadFlag).toBe(false);
    });

    it('validates XML structure: Table 0 (Organization) and Table 1 (2-Column Comparative Table)', async () => {
      const buf = fs.readFileSync(testHwpxPath);
      const zip = await JSZip.loadAsync(buf);
      const sectionXml = await zip.file('Contents/section0.xml')!.async('string');

      // Table 0 checks
      expect(sectionXml).toContain('❚ 보건행정과');
      expect(sectionXml).toContain('건강증진팀장 김지영');

      // Table 1 Row 0 Header checks
      expect(sectionXml).toContain('업무실적');
      expect(sectionXml).toContain('11. 02.(월) ~ 11. 08.(일)');
      expect(sectionXml).toContain('업무계획');
      expect(sectionXml).toContain('11. 09.(월) ~ 11. 15.(일)');

      // Table 1 Attributes: Multi-page streaming
      expect(sectionXml).toContain('pageBreak="CELL"');
      expect(sectionXml).toContain('repeatHeader="1"');
      expect(sectionXml).toContain('treatAsChar="0"');

      // Table 1 Row 1 in-cell content checks
      expect(sectionXml).toContain('서울체력장 강남센터');
      expect(sectionXml).toContain('기    간 :');
      expect(sectionXml).toContain('내    용');
    });

    it('passes 5-Pillar anti-overlap gatekeeper verification with 0 defects', () => {
      const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
      const code = [
        'import sys',
        'sys.path.insert(0, "scripts")',
        'from generate_weekly_hwpx import verify_weekly_hwpx_no_overlap',
        `metrics = verify_weekly_hwpx_no_overlap(r"${testHwpxPath}")`,
        'print(f"DEFECTS: squeeze={metrics[\'squeeze_count\']}, inverted={metrics[\'inverted_order_p\']}, dup_vpos={metrics[\'dup_vpos_cells\']}, huge_cells={metrics[\'huge_height_cells\']}, bad_zip={metrics[\'bad_zip_flags\']}")',
        'print("GATEKEEPER_PASSED")',
      ].join('\n');
      const stdout = execFileSync(pythonBin, ['-c', code], { encoding: 'utf-8' });
      expect(stdout).toContain('GATEKEEPER_PASSED');
      expect(stdout).toContain('squeeze=0');
      expect(stdout).toContain('inverted=0');
      expect(stdout).toContain('dup_vpos=0');
      expect(stdout).toContain('bad_zip=0');
    });
  });

  // ==========================================================================
  // Tier 5: Edge Cases & Robustness
  // ==========================================================================
  describe('Tier 5: Edge Cases & Robustness', () => {
    it('generates valid HWPX when weekly items are empty without crashing', () => {
      const emptyHwpxPath = path.join(scratchDir, 'test_weekly_empty.hwpx');
      const emptyJsonPath = path.join(scratchDir, 'test_weekly_empty.json');

      const emptyReport: WeeklyReportDto = {
        id: 'weekly-empty-test',
        reportDate: '2026-11-04',
        departmentName: '보건행정과',
        teamTitle: '건강증진팀장 김지영',
        performancePeriod: '11. 02.(월) ~ 11. 08.(일)',
        planPeriod: '11. 09.(월) ~ 11. 15.(일)',
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      fs.writeFileSync(emptyJsonPath, JSON.stringify([emptyReport], null, 2), 'utf-8');

      try {
        const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
        const scriptPath = path.join(process.cwd(), 'scripts', 'generate_weekly_hwpx.py');

        const stdout = execFileSync(
          pythonBin,
          [scriptPath, '--date', '2026-11-04', '--data', emptyJsonPath, '--output', emptyHwpxPath],
          { encoding: 'utf-8' }
        );
        expect(stdout).toContain('SUCCESS');
        expect(fs.existsSync(emptyHwpxPath)).toBe(true);

        const verifyCode = [
          'import sys',
          'sys.path.insert(0, "scripts")',
          'from generate_weekly_hwpx import verify_weekly_hwpx_no_overlap',
          `metrics = verify_weekly_hwpx_no_overlap(r"${emptyHwpxPath}")`,
          'print("EMPTY_REPORT_PASSED")',
        ].join('\n');
        const vOut = execFileSync(pythonBin, ['-c', verifyCode], { encoding: 'utf-8' });
        expect(vOut).toContain('EMPTY_REPORT_PASSED');
      } finally {
        if (fs.existsSync(emptyHwpxPath)) fs.unlinkSync(emptyHwpxPath);
        if (fs.existsSync(emptyJsonPath)) fs.unlinkSync(emptyJsonPath);
      }
    });
  });
});
