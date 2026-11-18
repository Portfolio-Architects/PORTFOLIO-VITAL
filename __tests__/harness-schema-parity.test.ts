import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import {
  DOMAIN_SHEET_NAMES,
  getDomainSchema,
  getStrictDomainSchema,
  TaskStatusSchema,
  TaskPrioritySchema,
  BudgetActionTypeSchema,
  ScheduleTypeSchema,
  WorkingMemoryCategorySchema,
  WorkingMemoryStatusSchema,
  WorkingMemorySourceSchema,
  AdminDocTypeSchema,
  WeeklyWorkItemStatusSchema,
  StrictWeeklyWorkItemStatusSchema,
  StrictTaskSchema,
  StrictBudgetCategorySchema,
  StrictBudgetEntrySchema,
  StrictSimulationEntrySchema,
  StrictProjectSchema,
  StrictExternalDocSchema,
  StrictClassificationWordsSchema,
  StrictScheduleSchema,
  StrictContactSchema,
  StrictWorkingMemorySchema,
  StrictAdminDocMetadataSchema,
  StrictWeeklyReportSchema,
  StrictFestivalDataSchema,
  FestivalDataSchema,
  BudgetEntrySchema,
  SimulationEntrySchema,
  ScheduleSchema,
  ContactSchema,
  WorkingMemorySchema,
} from '@/lib/schemas';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const harnessModule = require('../scripts/run-harness.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const syncRulesModule = require('../scripts/sync-rules.js');

const {
  loadStrictSchemas,
  loadStrictSchemasSync,
  buildSheetsToCheck,
  validateSheetRecords,
  validateFestivalSSOT,
  SHEETS_TO_CHECK,
  HARNESS_SCHEMAS,
  ENUM_SCHEMAS_TO_CHECK,
} = harnessModule;

const { auditGovernanceAndSkillDocs, GOVERNANCE_DOC_PATHS } = syncRulesModule;

describe('Milestone 275 & 276 & 280 & Phase 4 Task 4.3: 12-Domain Dynamic Schema SSOT & Integrity Verification Suite', () => {
  describe('1. 12-Domain SSOT Dynamic Loader & Registry Parity', () => {
    it('dynamically loads all 12 strict schemas from src/lib/schemas.ts via async loadStrictSchemas()', async () => {
      const schemas = await loadStrictSchemas();
      expect(schemas).toBeDefined();

      const expectedStrictNames = [
        'StrictTaskSchema',
        'StrictBudgetCategorySchema',
        'StrictBudgetEntrySchema',
        'StrictSimulationEntrySchema',
        'StrictProjectSchema',
        'StrictExternalDocSchema',
        'StrictClassificationWordsSchema',
        'StrictScheduleSchema',
        'StrictContactSchema',
        'StrictWorkingMemorySchema',
        'StrictAdminDocMetadataSchema',
        'StrictWeeklyReportSchema',
      ];

      for (const name of expectedStrictNames) {
        expect(schemas[name]).toBeDefined();
        expect(typeof schemas[name].safeParse).toBe('function');
      }

      expect(Array.isArray(schemas.DOMAIN_SHEET_NAMES)).toBe(true);
      expect(schemas.DOMAIN_SHEET_NAMES).toHaveLength(12);
    });

    it('dynamically loads all 12 strict schemas via sync fallback loadStrictSchemasSync()', () => {
      const syncSchemas = loadStrictSchemasSync();
      expect(syncSchemas).toBeDefined();

      expect(syncSchemas.StrictTaskSchema).toBeDefined();
      expect(syncSchemas.StrictBudgetCategorySchema).toBeDefined();
      expect(syncSchemas.StrictBudgetEntrySchema).toBeDefined();
      expect(syncSchemas.StrictSimulationEntrySchema).toBeDefined();
      expect(syncSchemas.StrictProjectSchema).toBeDefined();
      expect(syncSchemas.StrictExternalDocSchema).toBeDefined();
      expect(syncSchemas.StrictClassificationWordsSchema).toBeDefined();
      expect(syncSchemas.StrictScheduleSchema).toBeDefined();
      expect(syncSchemas.StrictContactSchema).toBeDefined();
      expect(syncSchemas.StrictWorkingMemorySchema).toBeDefined();
      expect(syncSchemas.StrictAdminDocMetadataSchema).toBeDefined();
      expect(syncSchemas.StrictWeeklyReportSchema).toBeDefined();
      expect(syncSchemas.DOMAIN_SHEET_NAMES).toHaveLength(12);
    });

    it('registers all 12 canonical domain sheets in both src/lib/schemas.ts and scripts/run-harness.js', () => {
      const expectedSheets = [
        'TASKS',
        'BUDGET_CATEGORIES',
        'BUDGET_ENTRIES',
        'BUDGET_SIMULATIONS',
        'PROJECTS',
        'EXTERNAL_DOCS',
        'CLASSIFICATION_WORDS',
        'SCHEDULES',
        'CONTACTS',
        'WORKING_MEMORY',
        'ADMIN_DOC_INDEX',
        'WEEKLY_REPORTS',
      ];

      expect([...DOMAIN_SHEET_NAMES]).toEqual(expectedSheets);
      expect(SHEETS_TO_CHECK.map((s: { name: string }) => s.name)).toEqual(expectedSheets);
      expect(SHEETS_TO_CHECK).toHaveLength(12);
    });

    it('resolves SIMULATION_ENTRIES alias to the same schema as BUDGET_SIMULATIONS', () => {
      expect(getDomainSchema('SIMULATION_ENTRIES')).toBe(getDomainSchema('BUDGET_SIMULATIONS'));
      expect(getStrictDomainSchema('SIMULATION_ENTRIES')).toBe(getStrictDomainSchema('BUDGET_SIMULATIONS'));
    });

    it('maintains 1:1 enum option parity across all 9 domain enum schemas', () => {
      expect(HARNESS_SCHEMAS.TaskStatusSchema.options).toEqual(TaskStatusSchema.options);
      expect(HARNESS_SCHEMAS.TaskPrioritySchema.options).toEqual(TaskPrioritySchema.options);
      expect(HARNESS_SCHEMAS.BudgetActionTypeSchema.options).toEqual(BudgetActionTypeSchema.options);
      expect(HARNESS_SCHEMAS.ScheduleTypeSchema.options).toEqual(ScheduleTypeSchema.options);
      expect(HARNESS_SCHEMAS.WorkingMemoryCategorySchema.options).toEqual(WorkingMemoryCategorySchema.options);
      expect(HARNESS_SCHEMAS.WorkingMemoryStatusSchema.options).toEqual(WorkingMemoryStatusSchema.options);
      expect(HARNESS_SCHEMAS.WorkingMemorySourceSchema.options).toEqual(WorkingMemorySourceSchema.options);
      expect(HARNESS_SCHEMAS.AdminDocTypeSchema.options).toEqual(AdminDocTypeSchema.options);
      expect(HARNESS_SCHEMAS.WeeklyWorkItemStatusSchema.options).toEqual(StrictWeeklyWorkItemStatusSchema.options);
      expect(ENUM_SCHEMAS_TO_CHECK).toHaveLength(9);
    });
  });

  describe('2. Positive Validation: Schema Compliance on Canonical Sample Records Across All 12 Sheets', () => {
    const canonicalPositiveSamples: Record<string, Record<string, unknown>> = {
      TASKS: {
        id: 'task-test-pos',
        title: '양재천 페스티벌 안전관리계획 수립',
        description: '대규모 공공행사 안전관리 매뉴얼 수립',
        status: 'todo',
        priority: 'high',
        category: '안전행정',
        dueDate: '2026-11-20',
        projectId: 'proj-001',
        createdAt: '2026-11-11T00:00:00.000Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
        tags: ['안전', '페스티벌'],
      },
      BUDGET_CATEGORIES: {
        id: 'cat-test-pos',
        name: '신체활동 활성화 사업',
        totalBudget: 150000000,
        color: '#3b82f6',
        description: '구민 건강증진',
        policyProject: '건강도시조성',
        unitProject: '신체활동증진',
        detailedProject: '신체활동리더양성',
        statItem: '201-01',
        budgetType: '본예산',
        fundingSource: '구비',
        subItems: [
          {
            id: 'sub-01',
            name: '강사료',
            amount: 2000000,
            calculations: [
              {
                id: 'calc-01',
                calculation: '100,000원 * 20회',
                amount: 2000000,
              },
            ],
          },
        ],
      },
      BUDGET_ENTRIES: {
        id: 'entry-test-pos',
        categoryId: 'cat-test-pos',
        amount: 2000000,
        date: '2026-11-11',
        purpose: '신체활동 리더 교육 강사료 지급',
        memo: '1회차 지급',
        isPlanned: false,
        isSettled: true,
        actionType: 'general',
      },
      BUDGET_SIMULATIONS: {
        id: 'sim-test-pos',
        name: '걷기 챌린지 홍보물 제작',
        detailedProject: '신체활동증진',
        statItem: '201-01 사무관리비',
        unitPrice: 5000,
        quantity: 500,
        amount: 2500000,
        createdAt: '2026-11-11T00:00:00.000Z',
        status: 'PLANNED',
      },
      PROJECTS: {
        id: 'proj-test-pos',
        name: '2026 양재천 건강 페스티벌',
        description: '양재천 일원 건강 체험 및 걷기 페스티벌',
        color: '#10b981',
        checklistItems: [
          { id: 'chk-01', text: '부스 배치도 확정', completed: true },
          { id: 'chk-02', text: '의전 국민의례 음원 점검', completed: false },
        ],
        createdAt: '2026-11-11T00:00:00.000Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
      },
      EXTERNAL_DOCS: {
        id: 'ext-test-pos',
        name: '2026_신체활동사업_종합지침.hwpx',
        path: 'D:/Desktop/공공문서 폴더/2026년/2026_신체활동사업_종합지침.hwpx',
        size: 1048576,
        lastModified: '2026-11-11T00:00:00.000Z',
        layerId: 3,
      },
      CLASSIFICATION_WORDS: {
        id: 'words-test-pos',
        agents: ['보건소장', '건강증진과장', '총괄주무관'],
        resources: ['예산서', '기안문', '행사계획서'],
        executions: ['지출결의', '공문발송', '현장점검'],
      },
      SCHEDULES: {
        id: 'sched-test-pos',
        date: '2026-11-15',
        startTime: '10:00',
        endTime: '11:30',
        title: '양재천 페스티벌 중간보고회',
        type: 'meeting',
        person: '건강증진팀장',
        notes: '기획상황실',
        createdAt: '2026-11-11T00:00:00.000Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
      },
      CONTACTS: {
        id: 'contact-test-pos',
        name: '김보건',
        phone: '010-9876-5432',
        email: 'health@gangnam.go.kr',
        notes: '건강증진팀',
        createdAt: '2026-11-11T00:00:00.000Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
      },
      WORKING_MEMORY: {
        id: 'wm-test-pos',
        content: '신체활동 리더 위촉식 현수막 문안 검토 필요',
        category: 'festival',
        tags: ['현수막', '위촉식'],
        status: 'pending',
        createdAt: '2026-11-11T00:00:00.000Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
      },
      ADMIN_DOC_INDEX: {
        id: 'admin-doc-test-pos',
        docId: 'ADMIN-2026-001',
        title: '2026년도 신체활동 리더 양성 추진계획(안)',
        docType: 'POLICY_PLAN',
        typeLabel: '방침서',
        year: 2026,
        department: '보건소',
        project: '신체활동증진',
        filePath: 'D:/Desktop/공공문서 폴더/2026년/계획서.hwpx',
        originalFileName: '계획서.hwpx',
        sourceLocation: 'DESKTOP',
        fileExt: 'hwpx',
        fileSize: 524288,
        summary: '2026년도 신체활동 리더 양성을 위한 세부 시행방안',
        createdAt: '2026-11-11T00:00:00.000Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
      },
      WEEKLY_REPORTS: {
        id: 'report-test-pos',
        reportDate: '2026-11-14',
        departmentName: '보건행정과',
        teamTitle: '건강증진팀장 김지영',
        performancePeriod: '2026. 11. 3.~11. 7.',
        planPeriod: '2026. 11. 10.~11. 14.',
        items: [
          {
            id: 'item-01',
            projectOrder: 1,
            projectName: '신체활동 증진사업',
            period: '2026. 11. 3.~11. 7.',
            contents: ['신체활동 리더 20명 위촉 및 오리엔테이션 완료'],
            status: 'performance',
          },
        ],
        createdAt: '2026-11-11T00:00:00.000Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
      },
    };

    it.each([...DOMAIN_SHEET_NAMES])(
      'validates a canonical positive record for sheet %s with 0 errors in validateSheetRecords',
      (sheetName) => {
        const harnessEntry = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === sheetName);
        expect(harnessEntry).toBeDefined();

        const sample = canonicalPositiveSamples[sheetName];
        expect(sample).toBeDefined();

        const result = validateSheetRecords(harnessEntry, [sample]);
        expect(result.valid).toBe(true);
        expect(result.errorCount).toBe(0);
        expect(result.errors).toEqual([]);

        // Strict schema should also directly parse successfully
        const strictParsed = harnessEntry.schema.safeParse(sample);
        expect(strictParsed.success).toBe(true);
      }
    );
  });

  describe('3. Loud-Failure Gatekeeper vs Resilient Runtime Fallback Semantics', () => {
    it('strictly rejects invalid BudgetEntry actionType, transferDirection, and entryType in Harness while gracefully falling back at runtime', () => {
      const invalidEntry = {
        id: 'entry-1',
        categoryId: 'cat-1',
        amount: 50000,
        date: '2026-10-26',
        purpose: '테스트 지출',
        actionType: 'unauthorized_action',
        transferDirection: 'diagonal',
        entryType: 'invalid_type',
      };

      const harnessSheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'BUDGET_ENTRIES');
      const harnessCheck = validateSheetRecords(harnessSheet, [invalidEntry]);
      expect(harnessCheck.valid).toBe(false);
      expect(harnessCheck.errorCount).toBe(1);

      const strictCheck = StrictBudgetEntrySchema.safeParse(invalidEntry);
      expect(strictCheck.success).toBe(false);

      // Runtime schema uses .catch() per Rule B to prevent UI crash on legacy rows
      const runtimeCheck = BudgetEntrySchema.safeParse(invalidEntry);
      expect(runtimeCheck.success).toBe(true);
      if (runtimeCheck.success) {
        expect(runtimeCheck.data.actionType).toBeUndefined();
        expect(runtimeCheck.data.transferDirection).toBeUndefined();
        expect(runtimeCheck.data.entryType).toBeUndefined();
      }
    });

    it('strictly validates SimulationEntrySchema, ScheduleSchema, ContactSchema, and WorkingMemorySchema in Harness', () => {
      const invalidSim = {
        id: 'sim-1',
        name: '시뮬레이션 항목',
        detailedProject: '건강증진',
        statItem: '201-01 사무관리비',
        unitPrice: 'not-a-number',
        quantity: 1,
        amount: 10000,
        createdAt: '2026-10-26T00:00:00.000Z',
        status: 'INVALID_STATUS',
      };
      expect(StrictSimulationEntrySchema.safeParse(invalidSim).success).toBe(false);
      expect(HARNESS_SCHEMAS.SimulationEntrySchema.safeParse(invalidSim).success).toBe(false);
      expect(SimulationEntrySchema.safeParse(invalidSim).success).toBe(true);

      const invalidSchedule = {
        id: 'sched-1',
        date: '2026-10-26',
        startTime: '09:00',
        endTime: '10:00',
        title: '회의',
        type: 'party', // invalid enum
        person: '담당자',
        createdAt: '2026-10-26T00:00:00.000Z',
        updatedAt: '2026-10-26T00:00:00.000Z',
      };
      expect(StrictScheduleSchema.safeParse(invalidSchedule).success).toBe(false);
      expect(HARNESS_SCHEMAS.ScheduleSchema.safeParse(invalidSchedule).success).toBe(false);
      expect(ScheduleSchema.safeParse(invalidSchedule).success).toBe(true);

      const invalidContact = {
        id: 'contact-1',
        name: '홍길동',
        // missing required phone, createdAt, updatedAt
      };
      expect(StrictContactSchema.safeParse(invalidContact).success).toBe(false);
      expect(HARNESS_SCHEMAS.ContactSchema.safeParse(invalidContact).success).toBe(false);
      expect(ContactSchema.safeParse(invalidContact).success).toBe(true);

      const invalidWorkingMemory = {
        id: 'wm-invalid-1',
        content: '메모 내용',
        category: 'invalid_category',
        status: 'invalid_status',
      };
      expect(StrictWorkingMemorySchema.safeParse(invalidWorkingMemory).success).toBe(false);
      expect(HARNESS_SCHEMAS.WorkingMemorySchema.safeParse(invalidWorkingMemory).success).toBe(false);
      expect(WorkingMemorySchema.safeParse(invalidWorkingMemory).success).toBe(true);
    });

    it('strictly rejects invalid Task record lacking required title or having invalid status', () => {
      const invalidTaskMissingTitle = {
        id: 'task-err-1',
        status: 'todo',
        priority: 'medium',
        category: '행정',
        createdAt: '2026-11-11T00:00:00.000Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
      };
      expect(StrictTaskSchema.safeParse(invalidTaskMissingTitle).success).toBe(false);

      const invalidTaskBadStatus = {
        id: 'task-err-2',
        title: '과제',
        status: 'unknown_status',
        priority: 'medium',
        category: '행정',
        createdAt: '2026-11-11T00:00:00.000Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
      };
      expect(StrictTaskSchema.safeParse(invalidTaskBadStatus).success).toBe(false);
    });

    it('strictly rejects invalid AdminDocMetadata lacking title or having invalid docType', () => {
      const invalidAdminDoc = {
        id: 'doc-err-1',
        docId: 'DOC-999',
        docType: 'INVALID_TYPE',
        typeLabel: '라벨',
        year: 2026,
        department: '보건소',
        project: '사업',
        filePath: 'test.hwpx',
        originalFileName: 'test.hwpx',
        sourceLocation: 'DESKTOP',
        fileExt: 'hwpx',
        fileSize: 100,
        summary: '요약',
        createdAt: '2026-11-11T00:00:00.000Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
      };
      expect(StrictAdminDocMetadataSchema.safeParse(invalidAdminDoc).success).toBe(false);
    });

    it('strictly rejects invalid WeeklyReport item lacking projectName or having invalid status', () => {
      const invalidWeeklyReport = {
        id: 'report-err-1',
        reportDate: '2026-11-14',
        performancePeriod: '2026. 11. 3.~11. 7.',
        planPeriod: '2026. 11. 10.~11. 14.',
        items: [
          {
            id: 'item-err-1',
            projectOrder: 1,
            // missing projectName
            period: '2026. 11. 3.~11. 7.',
            status: 'invalid_status',
          },
        ],
        createdAt: '2026-11-11T00:00:00.000Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
      };
      expect(StrictWeeklyReportSchema.safeParse(invalidWeeklyReport).success).toBe(false);
    });

    it('rejects non-array root payloads and accepts E2EE-wrapped {_enc} records in validateSheetRecords', () => {
      const tasksSheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'TASKS');

      const nonArrayResult = validateSheetRecords(tasksSheet, { id: 'not-an-array' });
      expect(nonArrayResult.valid).toBe(false);
      expect(nonArrayResult.errorCount).toBe(1);
      expect(nonArrayResult.errors[0].id).toBe('ROOT');

      const encryptedRecordResult = validateSheetRecords(tasksSheet, [
        { id: 'enc-task-1', _enc: '{"id":"enc-task-1"}' },
      ]);
      expect(encryptedRecordResult.valid).toBe(true);
      expect(encryptedRecordResult.errorCount).toBe(0);
    });
  });

  describe('4. Live SSOT Database (data/*.json) 12-Domain Integrity & Parsed Output Equality Verification', () => {
    it.each([...DOMAIN_SHEET_NAMES])(
      'validates all live records in data/%s.json with 0 schema errors and produces 100% identical parsed objects across runtime, strict, and CLI harness schemas',
      (sheetName) => {
        const filePath = path.join(process.cwd(), 'data', `${sheetName}.json`);
        if (!fs.existsSync(filePath)) {
          return;
        }
        const raw = fs.readFileSync(filePath, 'utf-8').trim();
        if (!raw) {
          return;
        }

        const data = JSON.parse(raw);
        expect(Array.isArray(data)).toBe(true);

        const harnessEntry = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === sheetName);
        const validation = validateSheetRecords(harnessEntry, data);
        expect(validation.valid).toBe(true);
        expect(validation.errorCount).toBe(0);

        const runtimeSchema = getDomainSchema(sheetName);
        const strictSchema = getStrictDomainSchema(sheetName);
        data.forEach((item: Record<string, unknown>) => {
          if (item && typeof item._enc === 'string') return;
          const runtimeParsed = runtimeSchema.safeParse(item);
          const strictParsed = strictSchema.safeParse(item);
          const harnessParsed = harnessEntry.schema.safeParse(item);

          expect(runtimeParsed.success).toBe(true);
          expect(strictParsed.success).toBe(true);
          expect(harnessParsed.success).toBe(true);

          if (runtimeParsed.success && strictParsed.success && harnessParsed.success) {
            expect(strictParsed.data).toEqual(runtimeParsed.data);
            expect(harnessParsed.data).toEqual(runtimeParsed.data);
          }
        });
      }
    );
  });

  describe('5. Milestone 296: Festival SSOT Validation (validateFestivalSSOT) & 9-Document Governance Audit', () => {
    it('validates data/FESTIVAL_YANGJAE_2026.json and yangjaeFestivalFallback.ts via validateFestivalSSOT with 0 errors', async () => {
      const schemas = await loadStrictSchemas();
      const result = validateFestivalSSOT(schemas);
      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('strictly rejects invalid FestivalData milestone status while runtime FestivalDataSchema gracefully falls back', () => {
      const festivalPath = path.join(process.cwd(), 'data', 'FESTIVAL_YANGJAE_2026.json');
      const liveFestival = JSON.parse(fs.readFileSync(festivalPath, 'utf-8'));

      const mutated = {
        ...liveFestival,
        milestones: [
          {
            ...liveFestival.milestones[0],
            status: 'INVALID_FESTIVAL_STATUS',
          },
        ],
      };

      expect(StrictFestivalDataSchema.safeParse(mutated).success).toBe(false);
      const runtimeParsed = FestivalDataSchema.safeParse(mutated);
      expect(runtimeParsed.success).toBe(true);
      if (runtimeParsed.success) {
        expect(runtimeParsed.data.milestones[0].status).toBe('todo');
      }
    });

    it('rejects 1-KRW budget parity mismatch and SSOT-to-fallback metadata/length drift in validateFestivalSSOT', async () => {
      const schemas = await loadStrictSchemas();
      const festivalPath = path.join(process.cwd(), 'data', 'FESTIVAL_YANGJAE_2026.json');
      const liveFestival = JSON.parse(fs.readFileSync(festivalPath, 'utf-8'));

      // 1-KRW budget mismatch
      const budgetMismatchDisk = {
        ...liveFestival,
        budget: {
          ...liveFestival.budget,
          total: liveFestival.budget.total + 1,
        },
      };
      const budgetResult = validateFestivalSSOT(schemas, {
        diskData: budgetMismatchDisk,
        fallbackData: liveFestival,
      });
      expect(budgetResult.valid).toBe(false);
      expect(budgetResult.errors.some((e: { target: string }) => e.target.includes('Rule R Budget Parity'))).toBe(true);

      // Stale fallback snapshot drift (meta.lastUpdated / meta.overallProgress / booths length)
      const staleFallback = {
        ...liveFestival,
        meta: {
          ...liveFestival.meta,
          lastUpdated: '2026-10-12',
          overallProgress: 70,
        },
        booths: liveFestival.booths.slice(0, -1),
      };
      const driftResult = validateFestivalSSOT(schemas, {
        diskData: liveFestival,
        fallbackData: staleFallback,
      });
      expect(driftResult.valid).toBe(false);
      expect(driftResult.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('audits all 9 governance, skill, and guideline documents via auditGovernanceAndSkillDocs() with 0 errors', () => {
      expect(GOVERNANCE_DOC_PATHS).toHaveLength(9);
      const auditResult = auditGovernanceAndSkillDocs();
      expect(auditResult.passed).toBe(true);
      expect(auditResult.errors).toEqual([]);
      expect(auditResult.docStats).toHaveLength(9);
      for (const stat of auditResult.docStats) {
        expect(stat.puaCount).toBe(0);
        expect(stat.doubleBullets).toBe(0);
        expect(stat.rsiViolations).toBe(0);
      }
    });

    it('detects dead .agents/ and __tests__/ paths, broken PUA, and double bullets in auditGovernanceAndSkillDocs()', () => {
      const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'temp_gov_audit_'));
      try {
        const badDocRel = 'bad_skill.md';
        fs.writeFileSync(
          path.join(tempDir, badDocRel),
          `## ▣ 테스트\n- ❍ 이중 불릿 위반함.\n- 참조: \`.agents/skills/non-existent/SKILL.md\`, \`__tests__/missing.test.ts\` \u{F03DA}  끝.\n`,
          'utf8'
        );
        const badAudit = auditGovernanceAndSkillDocs(tempDir, [badDocRel]);
        expect(badAudit.passed).toBe(false);
        expect(badAudit.errors.some((e: string) => e.includes('[BROKEN PUA]'))).toBe(true);
        expect(badAudit.errors.some((e: string) => e.includes('[DOUBLE BULLET]'))).toBe(true);
        expect(
          badAudit.errors.some(
            (e: string) =>
              e.includes('[DEAD PATH REF]') &&
              e.includes('.agents/skills/non-existent/SKILL.md') &&
              e.includes('__tests__/missing.test.ts')
          )
        ).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
