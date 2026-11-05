import fs from 'fs';
import os from 'os';
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
  BudgetEntrySchema,
  StrictBudgetEntrySchema,
  SimulationEntrySchema,
  StrictSimulationEntrySchema,
  ScheduleSchema,
  StrictScheduleSchema,
  ContactSchema,
  StrictContactSchema,
  WorkingMemorySchema,
  StrictWorkingMemorySchema,
} from '@/lib/schemas';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const harnessModule = require('../scripts/run-harness.js');

const {
  HARNESS_SCHEMAS,
  ENUM_SCHEMAS_TO_CHECK,
  SHEETS_TO_CHECK,
  extractTopLevelKeysFromSchemaSource,
  extractNestedObjectKeyMapFromSchemaSource,
  extractEnumValuesFromSchemaSource,
  extractZodObjectKeyMap,
  verifySchemaParityWithSource,
  validateSheetRecords,
} = harnessModule;

describe('Milestone 275 & 276: 10-Domain Harness & Schema Drift Parity Verification Suite', () => {
  describe('1. 10-Domain SSOT Sheet Coverage & Registry Parity', () => {
    it('registers all 10 canonical domain sheets in both src/lib/schemas.ts and scripts/run-harness.js', () => {
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
      ];

      expect([...DOMAIN_SHEET_NAMES]).toEqual(expectedSheets);
      expect(SHEETS_TO_CHECK.map((s: { name: string }) => s.name)).toEqual(expectedSheets);
      expect(SHEETS_TO_CHECK).toHaveLength(10);
    });

    it('resolves SIMULATION_ENTRIES alias to the same schema as BUDGET_SIMULATIONS', () => {
      expect(getDomainSchema('SIMULATION_ENTRIES')).toBe(getDomainSchema('BUDGET_SIMULATIONS'));
      expect(getStrictDomainSchema('SIMULATION_ENTRIES')).toBe(getStrictDomainSchema('BUDGET_SIMULATIONS'));
    });

    it('maintains 1:1 enum option parity across all 7 domain enum schemas', () => {
      expect(HARNESS_SCHEMAS.TaskStatusSchema.options).toEqual(TaskStatusSchema.options);
      expect(HARNESS_SCHEMAS.TaskPrioritySchema.options).toEqual(TaskPrioritySchema.options);
      expect(HARNESS_SCHEMAS.BudgetActionTypeSchema.options).toEqual(BudgetActionTypeSchema.options);
      expect(HARNESS_SCHEMAS.ScheduleTypeSchema.options).toEqual(ScheduleTypeSchema.options);
      expect(HARNESS_SCHEMAS.WorkingMemoryCategorySchema.options).toEqual(WorkingMemoryCategorySchema.options);
      expect(HARNESS_SCHEMAS.WorkingMemoryStatusSchema.options).toEqual(WorkingMemoryStatusSchema.options);
      expect(HARNESS_SCHEMAS.WorkingMemorySourceSchema.options).toEqual(WorkingMemorySourceSchema.options);
      expect(ENUM_SCHEMAS_TO_CHECK).toHaveLength(7);
    });
  });

  describe('2. Zero Schema Drift: Recursive 1:1 Shape Key Parity Across Runtime, Strict, and CLI Harness Schemas', () => {
    it.each([...DOMAIN_SHEET_NAMES])(
      'maintains 100% identical top-level and nested object field keys for sheet %s across runtime, strict, and CLI harness schemas',
      (sheetName) => {
        const runtimeSchema = getDomainSchema(sheetName) as z.ZodObject<z.ZodRawShape>;
        const strictSchema = getStrictDomainSchema(sheetName) as z.ZodObject<z.ZodRawShape>;
        const harnessEntry = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === sheetName);

        expect(harnessEntry).toBeDefined();

        const runtimeKeyMap = extractZodObjectKeyMap(runtimeSchema);
        const strictKeyMap = extractZodObjectKeyMap(strictSchema);
        const harnessKeyMap = extractZodObjectKeyMap(harnessEntry.schema);

        expect(strictKeyMap).toEqual(runtimeKeyMap);
        expect(harnessKeyMap).toEqual(runtimeKeyMap);
      }
    );

    it('recursively extracts all 6 nested object paths in BudgetCategorySchema and 2 paths in ProjectSchema', () => {
      const schemasPath = path.join(process.cwd(), 'src', 'lib', 'schemas.ts');
      const sourceText = fs.readFileSync(schemasPath, 'utf-8');

      const budgetCatMap = extractNestedObjectKeyMapFromSchemaSource(sourceText, 'BudgetCategorySchema');
      expect(Object.keys(budgetCatMap).sort()).toEqual([
        '',
        'fundingSplits',
        'subItems',
        'subItems.calculations',
        'subItems.calculations.fundingSplits',
        'subItems.fundingSplits',
      ]);
      expect(budgetCatMap).toEqual(extractZodObjectKeyMap(HARNESS_SCHEMAS.BudgetCategorySchema));

      const projectMap = extractNestedObjectKeyMapFromSchemaSource(sourceText, 'ProjectSchema');
      expect(Object.keys(projectMap).sort()).toEqual(['', 'checklistItems']);
      expect(projectMap['checklistItems']).toEqual(['id', 'text', 'completed']);
      expect(projectMap).toEqual(extractZodObjectKeyMap(HARNESS_SCHEMAS.ProjectSchema));
    });

    it('includes all e-Hojo dual-pipeline and simulator linkage fields in BudgetEntrySchema', () => {
      const requiredBudgetEntryFields = [
        'id',
        'categoryId',
        'amount',
        'date',
        'purpose',
        'memo',
        'isPlanned',
        'isSettled',
        'relatedPlanId',
        'linkedSubItemId',
        'entryType',
        'actionType',
        'inventoryItemId',
        'docRegNum',
        'checked',
        'fundingSource',
        'transferDirection',
        'simulationEntryId',
      ];

      expect(Object.keys(BudgetEntrySchema.shape)).toEqual(requiredBudgetEntryFields);
      expect(Object.keys(StrictBudgetEntrySchema.shape)).toEqual(requiredBudgetEntryFields);
      expect(Object.keys(HARNESS_SCHEMAS.BudgetEntrySchema.shape)).toEqual(requiredBudgetEntryFields);
    });

    it('passes verifySchemaParityWithSource against the actual src/lib/schemas.ts file with 0 drift errors', () => {
      const parityResult = verifySchemaParityWithSource();
      expect(parityResult.valid).toBe(true);
      expect(parityResult.driftErrors).toEqual([]);
    });

    it('accurately parses multi-property single lines and ignores braces inside comments or string literals', () => {
      const singleLineSource = 'export const TaskSchema = z.object({ id: z.string(), title: z.string(), count: z.number() });';
      expect(extractTopLevelKeysFromSchemaSource(singleLineSource, 'TaskSchema')).toEqual([
        'id',
        'title',
        'count',
      ]);

      const commentBraceSource = [
        'export const TaskSchema = z.object({',
        '  // single-line comment with } and { braces',
        '  /* multi-line comment with } and { braces */',
        '  id: z.string().default("{escaped}"),',
        '  title: z.string(),',
        '});',
      ].join('\n');
      expect(extractTopLevelKeysFromSchemaSource(commentBraceSource, 'TaskSchema')).toEqual(['id', 'title']);

      const enumSource = "export const TaskStatusSchema = z.enum(['todo', /* } */ 'in-progress', 'done']);";
      expect(extractEnumValuesFromSchemaSource(enumSource, 'TaskStatusSchema')).toEqual([
        'todo',
        'in-progress',
        'done',
      ]);
    });

    it('detects simulated schema drift across sheets, top-level keys, nested subItems/calculations, ChecklistItemSchema, and enums', () => {
      const schemasPath = path.join(process.cwd(), 'src', 'lib', 'schemas.ts');

      // Case A: Missing sheet in harness
      const incompleteSheets = SHEETS_TO_CHECK.slice(0, 8);
      const resMissingSheet = verifySchemaParityWithSource(schemasPath, incompleteSheets);
      expect(resMissingSheet.valid).toBe(false);
      expect(resMissingSheet.driftErrors.some((e: string) => e.includes('CONTACTS'))).toBe(true);

      // Case B: Missing top-level field in harness schema
      const driftedTaskSchema = z.object({
        id: z.string(),
        title: z.string(),
      });
      const driftedSheets = SHEETS_TO_CHECK.map((s: { name: string }) =>
        s.name === 'TASKS' ? { ...s, schema: driftedTaskSchema } : s
      );
      const resDriftedField = verifySchemaParityWithSource(schemasPath, driftedSheets);
      expect(resDriftedField.valid).toBe(false);
      expect(resDriftedField.driftErrors.some((e: string) => e.includes("Schema drift in 'TASKS'"))).toBe(true);

      // Case C: Nested object field drift inside BudgetCategorySchema.subItems.calculations
      const driftedBudgetCategorySchema = z.object({
        ...HARNESS_SCHEMAS.BudgetCategorySchema.shape,
        subItems: z.array(
          z.object({
            id: z.string().optional(),
            prefix: z.string().optional(),
            name: z.string(),
            calculation: z.string().optional(),
            amount: z.number(),
            isCustomFunding: z.boolean().optional(),
            isLocked: z.boolean().optional(),
            virtualAdjustment: z.number().optional(),
            note: z.string().optional(),
            checked: z.boolean().optional(),
            fundingSplits: z.array(z.object({ source: z.string(), amount: z.number() })).optional(),
            calculations: z.array(
              z.object({
                id: z.string().optional(),
                // 'calculation' and 'isLocked' intentionally omitted to simulate nested drift
                amount: z.number(),
              })
            ).optional(),
          })
        ).optional(),
      });
      const nestedDriftedSheets = SHEETS_TO_CHECK.map((s: { name: string }) =>
        s.name === 'BUDGET_CATEGORIES' ? { ...s, schema: driftedBudgetCategorySchema } : s
      );
      const resNestedDrift = verifySchemaParityWithSource(schemasPath, nestedDriftedSheets);
      expect(resNestedDrift.valid).toBe(false);
      expect(
        resNestedDrift.driftErrors.some((e: string) =>
          e.includes("Schema drift in 'BUDGET_CATEGORIES.subItems.calculations'")
        )
      ).toBe(true);

      // Case D: Enum option drift
      const driftedEnums = [
        { name: 'BudgetActionTypeSchema', schema: z.enum(['general', 'daily_expense']) },
      ];
      const resEnumDrift = verifySchemaParityWithSource(schemasPath, SHEETS_TO_CHECK, driftedEnums);
      expect(resEnumDrift.valid).toBe(false);
      expect(resEnumDrift.driftErrors.some((e: string) => e.includes("Enum drift in 'BudgetActionTypeSchema'"))).toBe(
        true
      );

      // Case E: Non-existent schema file path
      const resMissingFile = verifySchemaParityWithSource(path.join(os.tmpdir(), 'non-existent-schemas-9999.ts'));
      expect(resMissingFile.valid).toBe(false);
      expect(resMissingFile.driftErrors[0]).toContain('Source schema file not found');

      // Case F: Missing schema variable in source text
      expect(extractTopLevelKeysFromSchemaSource('export const OtherSchema = z.object({ a: z.string() });', 'TaskSchema')).toBeNull();
    });
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

  describe('4. Live SSOT Database (data/*.json) 9-Domain Integrity & Parsed Output Equality Verification', () => {
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
});

