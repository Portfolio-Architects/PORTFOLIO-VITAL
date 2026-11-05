const fs = require('fs');
const path = require('path');
const { z } = require('zod');

// 1. Declare 9-domain strict schemas synchronized 1:1 with src/lib/schemas.ts
const TaskStatusSchema = z.enum(['todo', 'in-progress', 'done']);
const TaskPrioritySchema = z.enum(['low', 'medium', 'high']);

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  category: z.string(),
  dueDate: z.string().optional(),
  projectId: z.string().optional(),
  recurrence: z.string().optional(),
  recurrenceStartDate: z.string().optional(),
  recurrenceEndDate: z.string().optional(),
  recurrenceCount: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()).default([]),
});

const BudgetActionTypeSchema = z.enum([
  'general',
  'issuance',
  'daily_expense',
  'transfer',
  'correction',
  'settle',
]);

const BudgetCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  totalBudget: z.number(),
  color: z.string().optional().default('#3b82f6'),
  description: z.string().optional(),
  policyProject: z.string().optional(),
  unitProject: z.string().optional(),
  detailedProject: z.string().optional(),
  managementProject: z.string().optional(),
  statItem: z.string().optional(),
  formationItem: z.string().optional(),
  budgetType: z.enum(['본예산', '간주예산', '추경']).optional(),
  fundingSource: z.string().optional(),
  fundingSplits: z.array(z.object({
    source: z.string(),
    amount: z.number()
  })).optional(),
  subItems: z.array(z.object({
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
    fundingSplits: z.array(z.object({
      source: z.string(),
      amount: z.number()
    })).optional(),
    calculations: z.array(z.object({
      id: z.string().optional(),
      name: z.string().optional(),
      calculation: z.string(),
      amount: z.number(),
      isCustomFunding: z.boolean().optional(),
      isLocked: z.boolean().optional(),
      virtualAdjustment: z.number().optional(),
      note: z.string().optional(),
      checked: z.boolean().optional(),
      fundingSplits: z.array(z.object({
        source: z.string(),
        amount: z.number()
      })).optional()
    })).optional()
  })).optional(),
  sortOrder: z.number().optional(),
});

const BudgetEntrySchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  amount: z.number(),
  date: z.string(),
  purpose: z.string(),
  memo: z.string().optional(),
  isPlanned: z.boolean().optional(),
  isSettled: z.boolean().optional(),
  relatedPlanId: z.string().optional(),
  linkedSubItemId: z.string().optional(),
  entryType: z.literal('approval').optional(),
  actionType: BudgetActionTypeSchema.optional(),
  inventoryItemId: z.string().optional(),
  docRegNum: z.string().optional(),
  checked: z.boolean().optional(),
  fundingSource: z.string().optional(),
  transferDirection: z.enum(['in', 'out']).optional(),
  simulationEntryId: z.string().optional(),
});

const SimulationEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  detailedProject: z.string(),
  statItem: z.string(),
  categoryId: z.string().optional(),
  actionType: BudgetActionTypeSchema.optional(),
  unitPrice: z.number(),
  quantity: z.number(),
  amount: z.number(),
  memo: z.string().optional(),
  createdAt: z.string(),
  status: z.enum(['PLANNED', 'SETTLED', 'CANCELLED']).optional(),
  budgetEntryId: z.string().optional(),
  settledEntryId: z.string().optional(),
  settledDate: z.string().optional(),
});

const ChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
});

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string(),
  checklistItems: z.array(ChecklistItemSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  target: z.string().optional(),
  budget: z.string().optional(),
  location: z.string().optional(),
  staff: z.string().optional(),
  performance: z.string().optional(),
  futurePlans: z.string().optional(),
  timeline: z.string().optional(),
});

const ExternalDocSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  size: z.number(),
  lastModified: z.string(),
  content: z.string().optional(),
  parsedAt: z.string().optional(),
  layerId: z.number().default(3),
});

const ClassificationWordsSchema = z.object({
  id: z.string(),
  agents: z.array(z.string()).default([]),
  resources: z.array(z.string()).default([]),
  executions: z.array(z.string()).default([]),
});

const ScheduleTypeSchema = z.enum(['security', 'meeting', 'education', 'other']);

const ScheduleSchema = z.object({
  id: z.string(),
  date: z.string(),
  endDate: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  title: z.string(),
  type: ScheduleTypeSchema,
  person: z.string(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const WorkingMemoryCategorySchema = z.enum(['budget', 'audit', 'festival', 'directive', 'general']);
const WorkingMemoryStatusSchema = z.enum(['pending', 'reflected']);
const WorkingMemorySourceSchema = z.enum(['pc', 'mobile']);

const WorkingMemorySchema = z.object({
  id: z.string(),
  content: z.string(),
  category: WorkingMemoryCategorySchema,
  tags: z.array(z.string()).default([]),
  numericHighlight: z.string().optional(),
  dateHighlight: z.string().optional(),
  status: WorkingMemoryStatusSchema,
  source: WorkingMemorySourceSchema.optional(),
  pinned: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reflectedAt: z.string().optional(),
});

// Admin Document Module (Milestone 1)
const AdminDocTypeSchema = z.enum([
  'POLICY_PLAN',
  'RESULT_REPORT',
  'ADMIN_AUDIT',
  'BUDGET_PLAN',
  'WEEKLY_REPORT',
]);

const AdminDocMetadataSchema = z.object({
  id: z.string(),
  docId: z.string(),
  title: z.string(),
  docType: AdminDocTypeSchema,
  typeLabel: z.string(),
  year: z.number(),
  department: z.string(),
  team: z.string().optional(),
  project: z.string(),
  projectId: z.string().nullable().optional(),
  filePath: z.string(),
  originalFileName: z.string(),
  sourceLocation: z.enum(['DESKTOP', 'MASTER_ARCHIVE']),
  documentDate: z.string().optional(),
  fileExt: z.string(),
  fileSize: z.number(),
  budgetAmount: z.number().nullable().optional(),
  executionRate: z.number().nullable().optional(),
  auditFindings: z.array(z.string()).nullable().optional(),
  summary: z.string(),
  ontologyLinks: z.object({
    projectId: z.string().nullable().optional(),
    planDocId: z.string().nullable().optional(),
    resultDocId: z.string().nullable().optional(),
    auditDocId: z.string().nullable().optional(),
    budgetDocId: z.string().nullable().optional(),
    weeklyDocIds: z.array(z.string()).default([]),
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const HARNESS_SCHEMAS = {
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskSchema,
  BudgetActionTypeSchema,
  BudgetCategorySchema,
  BudgetEntrySchema,
  SimulationEntrySchema,
  ChecklistItemSchema,
  ProjectSchema,
  ExternalDocSchema,
  ClassificationWordsSchema,
  ScheduleTypeSchema,
  ScheduleSchema,
  ContactSchema,
  WorkingMemoryCategorySchema,
  WorkingMemoryStatusSchema,
  WorkingMemorySourceSchema,
  WorkingMemorySchema,
  AdminDocTypeSchema,
  AdminDocMetadataSchema,
};

const ENUM_SCHEMAS_TO_CHECK = [
  { name: 'TaskStatusSchema', schema: TaskStatusSchema },
  { name: 'TaskPrioritySchema', schema: TaskPrioritySchema },
  { name: 'BudgetActionTypeSchema', schema: BudgetActionTypeSchema },
  { name: 'ScheduleTypeSchema', schema: ScheduleTypeSchema },
  { name: 'WorkingMemoryCategorySchema', schema: WorkingMemoryCategorySchema },
  { name: 'WorkingMemoryStatusSchema', schema: WorkingMemoryStatusSchema },
  { name: 'WorkingMemorySourceSchema', schema: WorkingMemorySourceSchema },
  { name: 'AdminDocTypeSchema', schema: AdminDocTypeSchema },
];

const SHEETS_TO_CHECK = [
  { name: 'TASKS', schema: TaskSchema, sourceSchemaName: 'TaskSchema' },
  { name: 'BUDGET_CATEGORIES', schema: BudgetCategorySchema, sourceSchemaName: 'BudgetCategorySchema' },
  { name: 'BUDGET_ENTRIES', schema: BudgetEntrySchema, sourceSchemaName: 'BudgetEntrySchema' },
  { name: 'BUDGET_SIMULATIONS', schema: SimulationEntrySchema, sourceSchemaName: 'SimulationEntrySchema' },
  { name: 'PROJECTS', schema: ProjectSchema, sourceSchemaName: 'ProjectSchema' },
  { name: 'EXTERNAL_DOCS', schema: ExternalDocSchema, sourceSchemaName: 'ExternalDocSchema' },
  { name: 'CLASSIFICATION_WORDS', schema: ClassificationWordsSchema, sourceSchemaName: 'ClassificationWordsSchema' },
  { name: 'SCHEDULES', schema: ScheduleSchema, sourceSchemaName: 'ScheduleSchema' },
  { name: 'CONTACTS', schema: ContactSchema, sourceSchemaName: 'ContactSchema' },
  { name: 'WORKING_MEMORY', schema: WorkingMemorySchema, sourceSchemaName: 'WorkingMemorySchema' },
  { name: 'ADMIN_DOC_INDEX', schema: AdminDocMetadataSchema, sourceSchemaName: 'AdminDocMetadataSchema' },
];

function stripTsComments(text) {
  let result = '';
  let i = 0;
  let inString = null;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (inString) {
      result += ch;
      if (ch === '\\' && i + 1 < text.length) {
        result += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      i++;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      inString = ch;
      result += ch;
      i++;
      continue;
    }

    if (ch === '/' && next === '/') {
      i += 2;
      while (i < text.length && text[i] !== '\n') {
        i++;
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') result += '\n';
        i++;
      }
      i += 2;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

function extractBalancedBraceBody(cleanText, startAfterOpenBraceIdx) {
  let braceDepth = 1;
  let inString = null;
  let body = '';

  for (let i = startAfterOpenBraceIdx; i < cleanText.length; i++) {
    const ch = cleanText[i];

    if (inString) {
      body += ch;
      if (ch === '\\' && i + 1 < cleanText.length) {
        body += cleanText[i + 1];
        i++;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      inString = ch;
      body += ch;
      continue;
    }

    if (ch === '{') {
      braceDepth++;
      body += ch;
    } else if (ch === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        return body;
      }
      body += ch;
    } else {
      body += ch;
    }
  }

  return null;
}

function splitTopLevelObjectEntries(objectBody) {
  const entries = [];
  let current = '';
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let inString = null;

  for (let i = 0; i < objectBody.length; i++) {
    const ch = objectBody[i];

    if (inString) {
      current += ch;
      if (ch === '\\' && i + 1 < objectBody.length) {
        current += objectBody[i + 1];
        i++;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      inString = ch;
      current += ch;
      continue;
    }

    if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth--;
    else if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth--;
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;

    if (ch === ',' && braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
      if (current.trim()) entries.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    entries.push(current.trim());
  }

  return entries;
}

function parseObjectBodyKeyMap(cleanSourceText, objectBody, prefix = '', resultMap = {}) {
  const entries = splitTopLevelObjectEntries(objectBody);
  const keys = [];

  for (const entry of entries) {
    const propMatch = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([\s\S]*)$/.exec(entry);
    if (!propMatch) continue;

    const propName = propMatch[1];
    const propExpr = propMatch[2];
    keys.push(propName);

    const childPath = prefix ? `${prefix}.${propName}` : propName;

    // 1. Check for inline z.object({ ... }) inside property expression
    const inlineObjMatch = /z\.object\(\{/.exec(propExpr);
    if (inlineObjMatch) {
      const startAfterBrace = inlineObjMatch.index + inlineObjMatch[0].length;
      const nestedBody = extractBalancedBraceBody(propExpr, startAfterBrace);
      if (nestedBody !== null) {
        parseObjectBodyKeyMap(cleanSourceText, nestedBody, childPath, resultMap);
      }
      continue;
    }

    // 2. Check for referenced object schema inside z.array(SomeSchema)
    const refArrayMatch = /z\.array\(\s*([A-Za-z_][A-Za-z0-9_]*Schema)\s*\)/.exec(propExpr);
    if (refArrayMatch) {
      const refSchemaName = refArrayMatch[1];
      const refDeclPattern = new RegExp(`export\\s+const\\s+${refSchemaName}\\s*=\\s*z\\.object\\(\\{`);
      const refMatch = refDeclPattern.exec(cleanSourceText);
      if (refMatch) {
        const refBody = extractBalancedBraceBody(cleanSourceText, refMatch.index + refMatch[0].length);
        if (refBody !== null) {
          parseObjectBodyKeyMap(cleanSourceText, refBody, childPath, resultMap);
        }
      }
    }
  }

  resultMap[prefix] = keys;
  return resultMap;
}

function extractNestedObjectKeyMapFromSchemaSource(sourceText, schemaVarName) {
  const cleanText = stripTsComments(sourceText);
  const declPattern = new RegExp(`export\\s+const\\s+${schemaVarName}\\s*=\\s*z\\.object\\(\\{`);
  const match = declPattern.exec(cleanText);
  if (!match) return null;

  const objectBody = extractBalancedBraceBody(cleanText, match.index + match[0].length);
  if (objectBody === null) return null;

  return parseObjectBodyKeyMap(cleanText, objectBody, '', {});
}

function extractTopLevelKeysFromSchemaSource(sourceText, schemaVarName) {
  const keyMap = extractNestedObjectKeyMapFromSchemaSource(sourceText, schemaVarName);
  if (!keyMap || !Array.isArray(keyMap[''])) return null;
  return keyMap[''];
}

function extractEnumValuesFromSchemaSource(sourceText, enumVarName) {
  const cleanText = stripTsComments(sourceText);
  const declPattern = new RegExp(`export\\s+const\\s+${enumVarName}\\s*=\\s*z\\.enum\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`);
  const match = declPattern.exec(cleanText);
  if (!match) return null;

  const values = [];
  const strRegex = /'([^']+)'|"([^"]+)"/g;
  let m;
  while ((m = strRegex.exec(match[1])) !== null) {
    values.push(m[1] || m[2]);
  }
  return values;
}

function unwrapZodToObjectSchema(zodSchema) {
  let cur = zodSchema;
  while (cur && cur.def && cur.def.innerType) {
    cur = cur.def.innerType;
  }
  if (cur && (cur.type === 'array' || (cur.def && cur.def.type === 'array'))) {
    const elem = cur.element || (cur.def && cur.def.element);
    return unwrapZodToObjectSchema(elem);
  }
  if (cur && cur.shape && typeof cur.shape === 'object') {
    return cur;
  }
  return null;
}

function extractZodObjectKeyMap(zodSchema, prefix = '', resultMap = {}) {
  const objSchema = unwrapZodToObjectSchema(zodSchema);
  if (!objSchema) return resultMap;

  const shape = objSchema.shape;
  const keys = Object.keys(shape);
  resultMap[prefix] = keys;

  for (const key of keys) {
    const childObj = unwrapZodToObjectSchema(shape[key]);
    if (childObj) {
      const childPath = prefix ? `${prefix}.${key}` : key;
      extractZodObjectKeyMap(childObj, childPath, resultMap);
    }
  }

  return resultMap;
}

function verifySchemaParityWithSource(
  schemasFilePath = path.join(process.cwd(), 'src', 'lib', 'schemas.ts'),
  sheetsToCheck = SHEETS_TO_CHECK,
  enumsToCheck = ENUM_SCHEMAS_TO_CHECK
) {
  const driftErrors = [];
  if (!fs.existsSync(schemasFilePath)) {
    driftErrors.push(`Source schema file not found at ${schemasFilePath}`);
    return { valid: false, driftErrors };
  }

  const sourceText = fs.readFileSync(schemasFilePath, 'utf-8');
  const cleanText = stripTsComments(sourceText);

  // 1. Verify DOMAIN_SHEET_NAMES parity if declared in schemas.ts
  const sheetArrayMatch = /export\s+const\s+DOMAIN_SHEET_NAMES\s*=\s*\[([\s\S]*?)\]\s*as\s+const/.exec(cleanText);
  if (sheetArrayMatch) {
    const sourceSheets = [];
    const strRegex = /'([A-Z_]+)'|"([A-Z_]+)"/g;
    let m;
    while ((m = strRegex.exec(sheetArrayMatch[1])) !== null) {
      sourceSheets.push(m[1] || m[2]);
    }
    const harnessSheetNames = sheetsToCheck.map(s => s.name);
    const missingSheets = sourceSheets.filter(s => !harnessSheetNames.includes(s));
    const extraSheets = harnessSheetNames.filter(s => !sourceSheets.includes(s));
    if (missingSheets.length > 0 || extraSheets.length > 0) {
      driftErrors.push(
        `Sheet list drift between src/lib/schemas.ts and scripts/run-harness.js (missing: [${missingSheets.join(', ')}], extra: [${extraSheets.join(', ')}])`
      );
    }
  }

  // 2. Verify Enum Schema Parity
  for (const enumItem of enumsToCheck) {
    const sourceValues = extractEnumValuesFromSchemaSource(sourceText, enumItem.name);
    if (!sourceValues) {
      driftErrors.push(`Could not find enum '${enumItem.name}' in src/lib/schemas.ts`);
      continue;
    }
    const harnessValues = Array.isArray(enumItem.schema.options) ? enumItem.schema.options : [];
    const missingVals = sourceValues.filter(v => !harnessValues.includes(v));
    const extraVals = harnessValues.filter(v => !sourceValues.includes(v));
    if (missingVals.length > 0 || extraVals.length > 0) {
      driftErrors.push(
        `Enum drift in '${enumItem.name}': missing in harness=[${missingVals.join(', ')}], extra in harness=[${extraVals.join(', ')}]`
      );
    }
  }

  // 3. Verify Root + Recursive Nested Object Key Parity across all 9 Domain Schemas
  for (const sheet of sheetsToCheck) {
    const sourceKeyMap = extractNestedObjectKeyMapFromSchemaSource(sourceText, sheet.sourceSchemaName);
    if (!sourceKeyMap) {
      driftErrors.push(`Could not find '${sheet.sourceSchemaName}' in src/lib/schemas.ts for sheet '${sheet.name}'`);
      continue;
    }
    const harnessKeyMap = extractZodObjectKeyMap(sheet.schema);
    const allPaths = Array.from(new Set([...Object.keys(sourceKeyMap), ...Object.keys(harnessKeyMap)]));

    for (const subPath of allPaths) {
      const pathLabel = subPath ? `${sheet.name}.${subPath}` : sheet.name;
      const sourceKeys = sourceKeyMap[subPath] || [];
      const harnessKeys = harnessKeyMap[subPath] || [];
      const missingInHarness = sourceKeys.filter(k => !harnessKeys.includes(k));
      const extraInHarness = harnessKeys.filter(k => !sourceKeys.includes(k));

      if (missingInHarness.length > 0 || extraInHarness.length > 0) {
        driftErrors.push(
          `Schema drift in '${pathLabel}' (${sheet.sourceSchemaName}): missing in harness=[${missingInHarness.join(', ')}], extra in harness=[${extraInHarness.join(', ')}]`
        );
      }
    }
  }

  return {
    valid: driftErrors.length === 0,
    driftErrors,
  };
}

function validateSheetRecords(sheet, data) {
  if (!Array.isArray(data)) {
    return {
      valid: false,
      errorCount: 1,
      errors: [{ index: -1, id: 'ROOT', error: `Database '${sheet.name}' must be a JSON array.` }],
    };
  }

  const unionSchema = z.union([
    sheet.schema,
    z.object({
      id: z.string(),
      _enc: z.string(),
    }),
  ]);

  const errors = [];
  data.forEach((item, index) => {
    const parsed = unionSchema.safeParse(item);
    if (!parsed.success) {
      errors.push({
        index,
        id: item && item.id ? item.id : 'N/A',
        error: parsed.error.format(),
      });
    }
  });

  return {
    valid: errors.length === 0,
    errorCount: errors.length,
    errors,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const isQuick = args.includes('--quick') || args.includes('--db-only');

  console.log('====================================================');
  console.log('🚀 Zod Gatekeeper: Starting Database Integrity Test...');
  console.log('====================================================');

  let failedCount = 0;

  // Step 1-A: Verify 1:1 Schema Parity with src/lib/schemas.ts
  const parityResult = verifySchemaParityWithSource();
  if (parityResult.valid) {
    console.log(`🔗 [PARITY PASS] All ${SHEETS_TO_CHECK.length} domain schemas (including nested objects & enums) are 100% synchronized with src/lib/schemas.ts.`);
  } else {
    parityResult.driftErrors.forEach(errMsg => {
      console.error(`❌ [HARNESS SCHEMA DRIFT ERROR] ${errMsg}`);
      failedCount++;
    });
  }

  // Step 1-B: Validate all 9 domain JSON sheets in data/
  SHEETS_TO_CHECK.forEach(sheet => {
    const filePath = path.join(process.cwd(), 'data', `${sheet.name}.json`);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  [SKIP] Sheet '${sheet.name}' database file does not exist (OK for fresh environment).`);
      return;
    }

    try {
      const rawContent = fs.readFileSync(filePath, 'utf-8');
      if (!rawContent.trim()) {
        console.log(`⚠️  [SKIP] Sheet '${sheet.name}' is empty.`);
        return;
      }

      const data = JSON.parse(rawContent);
      if (!Array.isArray(data)) {
        console.error(`❌ [HARNESS ERROR] Database '${sheet.name}' must be a JSON array.`);
        failedCount++;
        return;
      }

      console.log(`🔍 [CHECK] Validating ${data.length} records in '${sheet.name}'...`);

      const validation = validateSheetRecords(sheet, data);
      if (validation.valid) {
        console.log(`  ↳ ✅ [PASS] '${sheet.name}' is perfectly schema-compliant!`);
      } else {
        validation.errors.forEach(errItem => {
          console.error(`  ↳ ❌ [HARNESS ZOD ERROR] in '${sheet.name}' index [${errItem.index}] (ID: ${errItem.id}):`);
          console.error(JSON.stringify(errItem.error, null, 2));
        });
        console.error(`  ↳ ❌ [FAIL] '${sheet.name}' had ${validation.errorCount} validation failures.`);
        failedCount += validation.errorCount;
      }
    } catch (err) {
      console.error(`❌ [HARNESS FATAL ERROR] Reading/parsing '${sheet.name}' failed:`, err.message);
      failedCount++;
    }
  });

  console.log('====================================================');
  if (failedCount === 0) {
    console.log('🎉 [PASS] Zod Gatekeeper: Database integrity test complete. 0 errors found.');
  } else {
    console.error(`🚨 [FAIL] Zod Gatekeeper: ${failedCount} validation errors found.`);
  }

  if (isQuick) {
    if (failedCount === 0) {
      console.log('⚡ [QUICK] Quick mode enabled. Database Zod schema check complete.');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }

  // 2. 소스 코드 린트/타입 상태 자동 진단 및 자가 치유(Code Auto-Fixing)
  console.log('\n====================================================');
  console.log('🔍 Lint/Type Gatekeeper: Checking source code syntax & warnings...');
  console.log('====================================================');

  const { execSync } = require('child_process');
  const eslintBin = path.join(process.cwd(), 'node_modules', 'eslint', 'bin', 'eslint.js');
  const lintCmd = fs.existsSync(eslintBin) ? `node "${eslintBin}" src` : 'npm run lint';
  const lintFixCmd = fs.existsSync(eslintBin) ? `node "${eslintBin}" --fix src` : 'npx eslint --fix src';

  try {
    execSync(lintCmd, { stdio: 'inherit' });
    console.log('  ↳ ✅ [PASS] Source code lint & types are perfectly compliant!');
  } catch (lintErr) {
    console.log('  ↳ ❌ [WARN] Lint or compilation issues detected! Attempting Auto-Fixing...');
    try {
      execSync(lintFixCmd, { stdio: 'inherit' });
      console.log('  ↳ 🔧 [FIX] ESLint --fix executed successfully to update code.');

      execSync(lintCmd, { stdio: 'ignore' });
      console.log('  ↳ ✅ [PASS] Source code fixed and verified successfully!');
    } catch (fixErr) {
      console.error('  ↳ 🚨 [FAIL] Auto-Fix failed to resolve all issues. Manual intervention required:', fixErr.message);
      failedCount++;
    }
  }

  // 3. AGENTS.md 및 Engineering Report 마일스톤 자동 동기화
  console.log('\n====================================================');
  console.log('🔄 Sync-Rules: Automatically syncing Manifest milestones...');
  console.log('====================================================');
  try {
    const syncPath = path.join(process.cwd(), 'scripts', 'sync-rules.js');
    if (fs.existsSync(syncPath)) {
      execSync('node scripts/sync-rules.js', { stdio: 'inherit' });
    } else {
      console.log('  ↳ ⚠️  [SKIP] sync-rules.js not found.');
    }
  } catch (syncErr) {
    console.error('  ↳ ❌ [FAIL] Milestone sync failed:', syncErr.message);
  }

  console.log('====================================================');

  if (failedCount === 0) {
    console.log('🎉 [PASS] All Gatekeeper tests complete. 0 errors found.');
    console.log('====================================================');
    process.exit(0);
  } else {
    console.error(`🚨 [FAIL] Gatekeepers failed with ${failedCount} errors.`);
    console.error('====================================================');
    process.exit(1);
  }
}

module.exports = {
  HARNESS_SCHEMAS,
  ENUM_SCHEMAS_TO_CHECK,
  SHEETS_TO_CHECK,
  extractTopLevelKeysFromSchemaSource,
  extractNestedObjectKeyMapFromSchemaSource,
  extractEnumValuesFromSchemaSource,
  extractZodObjectKeyMap,
  verifySchemaParityWithSource,
  validateSheetRecords,
};


