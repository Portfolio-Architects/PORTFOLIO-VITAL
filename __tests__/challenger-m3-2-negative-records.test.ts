import {
  DOMAIN_SHEET_NAMES,
  TaskStatusSchema,
  TaskPrioritySchema,
  BudgetActionTypeSchema,
  ScheduleTypeSchema,
  WorkingMemoryCategorySchema,
  WorkingMemoryStatusSchema,
  WorkingMemorySourceSchema,
  AdminDocTypeSchema,
  WeeklyWorkItemStatusSchema,
} from '@/lib/schemas';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const harness = require('../scripts/run-harness.js');

const {
  validateSheetRecords,
  SHEETS_TO_CHECK,
  HARNESS_SCHEMAS,
  loadStrictSchemasSync,
} = harness;

describe('Adversarial Challenger M3-2: Negative Records & Loud-Failure Stress Harness', () => {
  const schemas = loadStrictSchemasSync();

  describe('1. Non-Array Root Payloads (All 12 Sheets)', () => {
    const nonArrayPayloads = [
      null,
      undefined,
      {},
      { data: [] },
      'invalid string payload',
      12345,
      true,
      false,
      Symbol('adversarial'),
    ];

    it.each([...DOMAIN_SHEET_NAMES])(
      'rejects non-array root payloads for sheet %s with ROOT error',
      (sheetName) => {
        const sheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === sheetName);
        expect(sheet).toBeDefined();
        for (const payload of nonArrayPayloads) {
          const result = validateSheetRecords(sheet, payload);
          expect(result.valid).toBe(false);
          expect(result.errorCount).toBe(1);
          expect(result.errors).toHaveLength(1);
          expect(result.errors[0].index).toBe(-1);
          expect(result.errors[0].id).toBe('ROOT');
          expect(result.errors[0].error).toContain(`Database '${sheetName}' must be a JSON array.`);
        }
      }
    );
  });

  describe('2. Missing Required Fields Across All 12 Domains', () => {
    const negativeFieldTestCases: Record<string, { description: string; record: Record<string, any> }[]> = {
      TASKS: [
        { description: 'missing id', record: { title: 'T', status: 'pending', priority: 'medium', category: 'C', createdAt: '2026-11-11', updatedAt: '2026-11-11' } },
        { description: 'missing title', record: { id: 't1', status: 'pending', priority: 'medium', category: 'C', createdAt: '2026-11-11', updatedAt: '2026-11-11' } },
        { description: 'missing status', record: { id: 't1', title: 'T', priority: 'medium', category: 'C', createdAt: '2026-11-11', updatedAt: '2026-11-11' } },
        { description: 'missing priority', record: { id: 't1', title: 'T', status: 'pending', category: 'C', createdAt: '2026-11-11', updatedAt: '2026-11-11' } },
        { description: 'missing category', record: { id: 't1', title: 'T', status: 'pending', priority: 'medium', createdAt: '2026-11-11', updatedAt: '2026-11-11' } },
        { description: 'missing createdAt', record: { id: 't1', title: 'T', status: 'pending', priority: 'medium', category: 'C', updatedAt: '2026-11-11' } },
        { description: 'missing updatedAt', record: { id: 't1', title: 'T', status: 'pending', priority: 'medium', category: 'C', createdAt: '2026-11-11' } },
      ],
      BUDGET_CATEGORIES: [
        { description: 'missing id', record: { name: 'Cat', totalBudget: 1000 } },
        { description: 'missing name', record: { id: 'c1', totalBudget: 1000 } },
        { description: 'missing totalBudget', record: { id: 'c1', name: 'Cat' } },
      ],
      BUDGET_ENTRIES: [
        { description: 'missing id', record: { categoryId: 'c1', amount: 500, date: '2026-11-11', purpose: 'P' } },
        { description: 'missing categoryId', record: { id: 'b1', amount: 500, date: '2026-11-11', purpose: 'P' } },
        { description: 'missing amount', record: { id: 'b1', categoryId: 'c1', date: '2026-11-11', purpose: 'P' } },
        { description: 'missing date', record: { id: 'b1', categoryId: 'c1', amount: 500, purpose: 'P' } },
        { description: 'missing purpose', record: { id: 'b1', categoryId: 'c1', amount: 500, date: '2026-11-11' } },
      ],
      BUDGET_SIMULATIONS: [
        { description: 'missing id', record: { name: 'S', detailedProject: 'D', statItem: 'I', categoryAllocations: [] } },
        { description: 'missing name', record: { id: 's1', detailedProject: 'D', statItem: 'I', categoryAllocations: [] } },
        { description: 'missing detailedProject', record: { id: 's1', name: 'S', statItem: 'I', categoryAllocations: [] } },
        { description: 'missing statItem', record: { id: 's1', name: 'S', detailedProject: 'D', categoryAllocations: [] } },
      ],
      PROJECTS: [
        { description: 'missing id', record: { name: 'P', color: '#ff0000' } },
        { description: 'missing name', record: { id: 'p1', color: '#ff0000' } },
        { description: 'missing color', record: { id: 'p1', name: 'P' } },
      ],
      EXTERNAL_DOCS: [
        { description: 'missing id', record: { name: 'D', path: '/path', size: 1024, lastModified: '2026-11-11' } },
        { description: 'missing name', record: { id: 'd1', path: '/path', size: 1024, lastModified: '2026-11-11' } },
        { description: 'missing path', record: { id: 'd1', name: 'D', size: 1024, lastModified: '2026-11-11' } },
        { description: 'missing size', record: { id: 'd1', name: 'D', path: '/path', lastModified: '2026-11-11' } },
        { description: 'missing lastModified', record: { id: 'd1', name: 'D', path: '/path', size: 1024 } },
      ],
      CLASSIFICATION_WORDS: [
        { description: 'missing id', record: { agents: [], resources: [], executions: [] } },
      ],
      SCHEDULES: [
        { description: 'missing id', record: { date: '2026-11-11', startTime: '09:00', endTime: '10:00', title: 'M', type: 'meeting', person: 'P' } },
        { description: 'missing date', record: { id: 'sc1', startTime: '09:00', endTime: '10:00', title: 'M', type: 'meeting', person: 'P' } },
        { description: 'missing startTime', record: { id: 'sc1', date: '2026-11-11', endTime: '10:00', title: 'M', type: 'meeting', person: 'P' } },
        { description: 'missing endTime', record: { id: 'sc1', date: '2026-11-11', startTime: '09:00', title: 'M', type: 'meeting', person: 'P' } },
        { description: 'missing title', record: { id: 'sc1', date: '2026-11-11', startTime: '09:00', endTime: '10:00', type: 'meeting', person: 'P' } },
        { description: 'missing type', record: { id: 'sc1', date: '2026-11-11', startTime: '09:00', endTime: '10:00', title: 'M', person: 'P' } },
        { description: 'missing person', record: { id: 'sc1', date: '2026-11-11', startTime: '09:00', endTime: '10:00', title: 'M', type: 'meeting' } },
      ],
      CONTACTS: [
        { description: 'missing id', record: { name: '홍길동', phone: '010-1234-5678' } },
        { description: 'missing name', record: { id: 'ct1', phone: '010-1234-5678' } },
        { description: 'missing phone', record: { id: 'ct1', name: '홍길동' } },
      ],
      WORKING_MEMORY: [
        { description: 'missing id', record: { content: '메모', category: 'festival', status: 'pending', createdAt: '2026-11-11', updatedAt: '2026-11-11' } },
        { description: 'missing content', record: { id: 'wm1', category: 'festival', status: 'pending', createdAt: '2026-11-11', updatedAt: '2026-11-11' } },
        { description: 'missing category', record: { id: 'wm1', content: '메모', status: 'pending', createdAt: '2026-11-11', updatedAt: '2026-11-11' } },
      ],
      ADMIN_DOC_INDEX: [
        { description: 'missing id', record: { docId: 'DOC-1', title: '공문', docType: 'POLICY_PLAN', typeLabel: '방침', year: 2026, department: '보건', project: 'P', filePath: '/p', originalFileName: 'f', sourceLocation: 'DESKTOP', fileExt: 'hwpx', fileSize: 100, summary: 'S', createdAt: '2026-11-11', updatedAt: '2026-11-11' } },
        { description: 'missing title', record: { id: 'ad1', docId: 'DOC-1', docType: 'POLICY_PLAN', typeLabel: '방침', year: 2026, department: '보건', project: 'P', filePath: '/p', originalFileName: 'f', sourceLocation: 'DESKTOP', fileExt: 'hwpx', fileSize: 100, summary: 'S', createdAt: '2026-11-11', updatedAt: '2026-11-11' } },
        { description: 'missing docType', record: { id: 'ad1', docId: 'DOC-1', title: '공문', typeLabel: '방침', year: 2026, department: '보건', project: 'P', filePath: '/p', originalFileName: 'f', sourceLocation: 'DESKTOP', fileExt: 'hwpx', fileSize: 100, summary: 'S', createdAt: '2026-11-11', updatedAt: '2026-11-11' } },
      ],
      WEEKLY_REPORTS: [
        { description: 'missing id', record: { reportDate: '2026-11-14', performancePeriod: '2026. 11. 3.~11. 7.', planPeriod: '2026. 11. 10.~11. 14.', items: [] } },
        { description: 'missing reportDate', record: { id: 'wr1', performancePeriod: '2026. 11. 3.~11. 7.', planPeriod: '2026. 11. 10.~11. 14.', items: [] } },
        { description: 'missing performancePeriod', record: { id: 'wr1', reportDate: '2026-11-14', planPeriod: '2026. 11. 10.~11. 14.', items: [] } },
        { description: 'missing planPeriod', record: { id: 'wr1', reportDate: '2026-11-14', performancePeriod: '2026. 11. 3.~11. 7.', items: [] } },
        { description: 'missing items', record: { id: 'wr1', reportDate: '2026-11-14', performancePeriod: '2026. 11. 3.~11. 7.', planPeriod: '2026. 11. 10.~11. 14.' } },
        {
          description: 'item missing projectName',
          record: {
            id: 'wr1',
            reportDate: '2026-11-14',
            performancePeriod: '2026. 11. 3.~11. 7.',
            planPeriod: '2026. 11. 10.~11. 14.',
            items: [{ id: 'item-1', period: '2026-11-11', contents: ['작업'] }],
          },
        },
      ],
    };

    for (const [sheetName, testCases] of Object.entries(negativeFieldTestCases)) {
      const sheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === sheetName);
      testCases.forEach(({ description, record }) => {
        it(`strictly rejects ${sheetName} with ${description} via validateSheetRecords`, () => {
          expect(sheet).toBeDefined();
          const result = validateSheetRecords(sheet, [record]);
          expect(result.valid).toBe(false);
          expect(result.errorCount).toBe(1);
          expect(result.errors).toHaveLength(1);
          expect(result.errors[0].id).toBe(record.id || 'N/A');
        });
      });
    }
  });

  describe('3. Bad / Incompatible Types Across Domains', () => {
    it('strictly rejects non-numeric amounts in BUDGET_ENTRIES', () => {
      const sheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'BUDGET_ENTRIES');
      const badRecords = [
        { id: 'b1', categoryId: 'c1', amount: '오만원', date: '2026-11-11', purpose: 'test' },
        { id: 'b2', categoryId: 'c1', amount: null, date: '2026-11-11', purpose: 'test' },
        { id: 'b3', categoryId: 'c1', amount: [50000], date: '2026-11-11', purpose: 'test' },
        { id: 'b4', categoryId: 'c1', amount: { val: 50000 }, date: '2026-11-11', purpose: 'test' },
        { id: 'b5', categoryId: 'c1', amount: true, date: '2026-11-11', purpose: 'test' },
      ];

      const result = validateSheetRecords(sheet, badRecords);
      expect(result.valid).toBe(false);
      expect(result.errorCount).toBe(5);
      expect(result.errors.map((e: any) => e.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5']);
    });

    it('strictly rejects non-string titles in TASKS', () => {
      const sheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'TASKS');
      const badRecords = [
        { id: 't1', title: 12345, status: 'pending', priority: 'medium', category: 'C', createdAt: '2026-11-11', updatedAt: '2026-11-11' },
        { id: 't2', title: ['태스크'], status: 'pending', priority: 'medium', category: 'C', createdAt: '2026-11-11', updatedAt: '2026-11-11' },
        { id: 't3', title: { title: '객체' }, status: 'pending', priority: 'medium', category: 'C', createdAt: '2026-11-11', updatedAt: '2026-11-11' },
      ];

      const result = validateSheetRecords(sheet, badRecords);
      expect(result.valid).toBe(false);
      expect(result.errorCount).toBe(3);
    });

    it('strictly rejects non-array checklistItems in PROJECTS', () => {
      const sheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'PROJECTS');
      const badRecords = [
        { id: 'p1', name: 'Project', color: '#ff0000', checklistItems: 'not-an-array' },
        { id: 'p2', name: 'Project', color: '#ff0000', checklistItems: 42 },
      ];

      const result = validateSheetRecords(sheet, badRecords);
      expect(result.valid).toBe(false);
      expect(result.errorCount).toBe(2);
    });

    it('strictly rejects non-numeric fileSize in EXTERNAL_DOCS and ADMIN_DOC_INDEX', () => {
      const docSheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'EXTERNAL_DOCS');
      const badExt = [{ id: 'd1', name: 'D', path: '/path', size: '1024KB', lastModified: '2026-11-11' }];
      expect(validateSheetRecords(docSheet, badExt).valid).toBe(false);

      const adminSheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'ADMIN_DOC_INDEX');
      const badAdmin = [{
        id: 'ad1', docId: 'DOC-1', title: '공문', docType: 'POLICY_PLAN', typeLabel: '방침',
        year: '이천이십육년', department: '보건', project: 'P', filePath: '/p',
        originalFileName: 'f', sourceLocation: 'DESKTOP', fileExt: 'hwpx', fileSize: '1MB',
        summary: 'S', createdAt: '2026-11-11', updatedAt: '2026-11-11'
      }];
      expect(validateSheetRecords(adminSheet, badAdmin).valid).toBe(false);
    });
  });

  describe('4. Malformed Enum Values Across 9 Domain Enums', () => {
    it('rejects malformed TaskStatusSchema and TaskPrioritySchema', () => {
      const sheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'TASKS');
      const badStatus = [{ id: 't1', title: 'T', status: 'COMPLETED_INVALID', priority: 'medium', category: 'C', createdAt: '2026-11-11', updatedAt: '2026-11-11' }];
      const badPriority = [{ id: 't2', title: 'T', status: 'pending', priority: 'URGENT_FIRE', category: 'C', createdAt: '2026-11-11', updatedAt: '2026-11-11' }];

      expect(validateSheetRecords(sheet, badStatus).valid).toBe(false);
      expect(validateSheetRecords(sheet, badPriority).valid).toBe(false);
    });

    it('rejects malformed BudgetActionTypeSchema and transferDirection in BUDGET_ENTRIES', () => {
      const sheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'BUDGET_ENTRIES');
      const badAction = [{ id: 'b1', categoryId: 'c1', amount: 500, date: '2026-11-11', purpose: 'P', actionType: 'illegal_embezzle' }];
      const badTransfer = [{ id: 'b2', categoryId: 'c1', amount: 500, date: '2026-11-11', purpose: 'P', transferDirection: 'sideways' }];

      expect(validateSheetRecords(sheet, badAction).valid).toBe(false);
      expect(validateSheetRecords(sheet, badTransfer).valid).toBe(false);
    });

    it('rejects malformed ScheduleTypeSchema in SCHEDULES', () => {
      const sheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'SCHEDULES');
      const badType = [{ id: 'sc1', date: '2026-11-11', startTime: '09:00', endTime: '10:00', title: 'M', type: 'party_time', person: 'P' }];
      expect(validateSheetRecords(sheet, badType).valid).toBe(false);
    });

    it('rejects malformed WorkingMemory categories, statuses, and sources', () => {
      const sheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'WORKING_MEMORY');
      const badCategory = [{ id: 'wm1', content: 'M', category: 'interstellar_voyage', status: 'pending', createdAt: '2026-11-11', updatedAt: '2026-11-11' }];
      const badStatus = [{ id: 'wm2', content: 'M', category: 'festival', status: 'obliterated', createdAt: '2026-11-11', updatedAt: '2026-11-11' }];
      const badSource = [{ id: 'wm3', content: 'M', category: 'festival', status: 'pending', source: 'dark_web_leak', createdAt: '2026-11-11', updatedAt: '2026-11-11' }];

      expect(validateSheetRecords(sheet, badCategory).valid).toBe(false);
      expect(validateSheetRecords(sheet, badStatus).valid).toBe(false);
      expect(validateSheetRecords(sheet, badSource).valid).toBe(false);
    });

    it('rejects malformed AdminDocTypeSchema in ADMIN_DOC_INDEX', () => {
      const sheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'ADMIN_DOC_INDEX');
      const badDoc = [{
        id: 'ad1', docId: 'DOC-1', title: '공문', docType: 'CONFIDENTIAL_ALIEN_LEAK', typeLabel: '방침',
        year: 2026, department: '보건', project: 'P', filePath: '/p',
        originalFileName: 'f', sourceLocation: 'DESKTOP', fileExt: 'hwpx', fileSize: 1024,
        summary: 'S', createdAt: '2026-11-11', updatedAt: '2026-11-11'
      }];
      expect(validateSheetRecords(sheet, badDoc).valid).toBe(false);
    });

    it('rejects malformed WeeklyWorkItemStatus in WEEKLY_REPORTS', () => {
      const sheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'WEEKLY_REPORTS');
      const badReport = [{
        id: 'wr1',
        reportDate: '2026-11-14',
        performancePeriod: '2026. 11. 3.~11. 7.',
        planPeriod: '2026. 11. 10.~11. 14.',
        items: [{ id: 'it1', projectName: 'P', period: '2026-11-11', contents: ['C'], status: 'permanently_postponed' }],
      }];
      expect(validateSheetRecords(sheet, badReport).valid).toBe(false);
    });
  });

  describe('5. Primitive / Null / Undefined Elements within Data Array', () => {
    it.each([...DOMAIN_SHEET_NAMES])(
      'rejects null, undefined, primitive, and empty elements in array for sheet %s',
      (sheetName) => {
        const sheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === sheetName);
        expect(sheet).toBeDefined();
        const corruptArray = [null, undefined, 42, 'corrupt string', {}, { id: 12345, bogus: true }];
        const result = validateSheetRecords(sheet, corruptArray);
        expect(result.valid).toBe(false);
        expect(result.errorCount).toBe(6);
        expect(result.errors).toHaveLength(6);
      }
    );
  });

  describe('6. E2EE Envelope Boundaries & Malformed Envelopes', () => {
    it('accepts well-formed E2EE envelopes and rejects malformed E2EE envelopes across sheets', () => {
      const taskSheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'TASKS');

      // Valid E2EE
      const validEnc = [{ id: 'task-e2ee-1', _enc: 'AES-GCM-CIPHERTEXT-SAMPLE-BASE64' }];
      const validRes = validateSheetRecords(taskSheet, validEnc);
      expect(validRes.valid).toBe(true);
      expect(validRes.errorCount).toBe(0);

      // Malformed E2EE 1: _enc is non-string (e.g. number)
      const badEnc1 = [{ id: 'task-e2ee-bad1', _enc: 123456 }];
      const badRes1 = validateSheetRecords(taskSheet, badEnc1);
      expect(badRes1.valid).toBe(false);
      expect(badRes1.errorCount).toBe(1);

      // Malformed E2EE 2: missing id
      const badEnc2 = [{ _enc: 'CIPHERTEXT-WITHOUT-ID' }];
      const badRes2 = validateSheetRecords(taskSheet, badEnc2);
      expect(badRes2.valid).toBe(false);
      expect(badRes2.errorCount).toBe(1);

      // Malformed E2EE 3: empty _enc string if required to be non-empty or empty object
      const badEnc3 = [{ id: 'task-e2ee-bad3' }]; // missing _enc AND missing Task fields
      const badRes3 = validateSheetRecords(taskSheet, badEnc3);
      expect(badRes3.valid).toBe(false);
      expect(badRes3.errorCount).toBe(1);
    });
  });

  describe('7. High-Volume Batch Stress Testing (500 Records with Injected Corruptions)', () => {
    it('accurately identifies exactly 50 corrupted records among 500 records without throwing', () => {
      const taskSheet = SHEETS_TO_CHECK.find((s: { name: string }) => s.name === 'TASKS');
      const largeBatch: any[] = [];
      const expectedCorruptIndices: number[] = [];

      for (let i = 0; i < 500; i++) {
        if (i % 10 === 0) {
          // Injected corruption
          expectedCorruptIndices.push(i);
          largeBatch.push({
            id: `corrupt-task-${i}`,
            // missing title, invalid status
            status: 'CORRUPTED_STATUS',
            priority: 'low',
            category: 'stress',
            createdAt: '2026-11-11',
            updatedAt: '2026-11-11',
          });
        } else {
          // Canonical valid task
          largeBatch.push({
            id: `valid-task-${i}`,
            title: `Valid Task #${i}`,
            status: 'in-progress',
            priority: 'high',
            category: 'festival',
            createdAt: '2026-11-11T00:00:00.000Z',
            updatedAt: '2026-11-11T00:00:00.000Z',
          });
        }
      }

      const result = validateSheetRecords(taskSheet, largeBatch);
      expect(result.valid).toBe(false);
      expect(result.errorCount).toBe(50);
      expect(result.errors).toHaveLength(50);

      const actualIndices = result.errors.map((e: any) => e.index);
      expect(actualIndices).toEqual(expectedCorruptIndices);

      const actualIds = result.errors.map((e: any) => e.id);
      expect(actualIds).toEqual(expectedCorruptIndices.map(i => `corrupt-task-${i}`));
    });
  });
});
