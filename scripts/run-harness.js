const fs = require('fs');
const path = require('path');
const { z } = require('zod');

const args = process.argv.slice(2);
const isQuick = args.includes('--quick') || args.includes('--db-only');

console.log('====================================================');
console.log('🚀 Zod Gatekeeper: Starting Database Integrity Test...');
console.log('====================================================');

// 1. Declare identical schemas to prevent type drift in unstructured data
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
    virtualAdjustment: z.number().optional().default(0),
    note: z.string().optional().default(''),
    checked: z.boolean().optional().default(false),
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
      virtualAdjustment: z.number().optional().default(0),
      note: z.string().optional().default(''),
      checked: z.boolean().optional().default(false),
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
  isPlanned: z.boolean().optional().default(false),
  isSettled: z.boolean().optional().default(false),
  relatedPlanId: z.string().optional(),
  linkedSubItemId: z.string().optional(),
  entryType: z.string().optional(),
  actionType: z.string().optional(),
  inventoryItemId: z.string().optional(),
  docRegNum: z.string().optional(),
  checked: z.boolean().optional().default(false),
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

const SHEETS_TO_CHECK = [
  { name: 'TASKS', schema: TaskSchema },
  { name: 'BUDGET_CATEGORIES', schema: BudgetCategorySchema },
  { name: 'BUDGET_ENTRIES', schema: BudgetEntrySchema },
  { name: 'PROJECTS', schema: ProjectSchema },
];

let failedCount = 0;

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
    
    let sheetErrors = 0;
    const unionSchema = z.union([
      sheet.schema,
      z.object({
        id: z.string(),
        _enc: z.string(),
      })
    ]);

    data.forEach((item, index) => {
      const parsed = unionSchema.safeParse(item);
      if (!parsed.success) {
        sheetErrors++;
        console.error(`  ↳ ❌ [HARNESS ZOD ERROR] in '${sheet.name}' index [${index}] (ID: ${item.id || 'N/A'}):`);
        console.error(JSON.stringify(parsed.error.format(), null, 2));
      }
    });

    if (sheetErrors === 0) {
      console.log(`  ↳ ✅ [PASS] '${sheet.name}' is perfectly schema-compliant!`);
    } else {
      console.error(`  ↳ ❌ [FAIL] '${sheet.name}' had ${sheetErrors} validation failures.`);
      failedCount += sheetErrors;
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
  // eslint를 실행
  execSync(lintCmd, { stdio: 'inherit' });
  console.log('  ↳ ✅ [PASS] Source code lint & types are perfectly compliant!');
} catch (lintErr) {
  console.log('  ↳ ❌ [WARN] Lint or compilation issues detected! Attempting Auto-Fixing...');
  try {
    // 자동 치유(Auto-Fix) 실행 (코드 업데이트 발동)
    execSync(lintFixCmd, { stdio: 'inherit' });
    console.log('  ↳ 🔧 [FIX] ESLint --fix executed successfully to update code.');
    
    // 복구 후 재차 린트 테스트
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
