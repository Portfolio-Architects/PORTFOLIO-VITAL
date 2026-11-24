const fs = require('fs');
const path = require('path');
const { z } = require('zod');

// Suppress typeless module warning for Node 22+
process.removeAllListeners('warning');

/**
 * Two-tier dynamic loader for src/lib/schemas.ts
 * Tier 1: Native dynamic import via url.pathToFileURL (Node 22.6+ with type-stripping)
 * Tier 2: In-memory transpilation via ts.transpileModule (Node < 22.6, Jest environments)
 */
async function loadStrictSchemas() {
  const schemasPath = path.resolve(__dirname, '../src/lib/schemas.ts');
  try {
    const { pathToFileURL } = require('url');
    return await import(pathToFileURL(schemasPath).href);
  } catch (_err) {
    return loadStrictSchemasSync();
  }
}

function loadStrictSchemasSync() {
  const schemasPath = path.resolve(__dirname, '../src/lib/schemas.ts');
  const ts = require('typescript');
  const vm = require('vm');
  const source = fs.readFileSync(schemasPath, 'utf-8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  });
  const mod = { exports: {} };
  const ctx = vm.createContext({
    module: mod,
    exports: mod.exports,
    require,
    process,
    console,
    Buffer,
    setTimeout,
    clearTimeout,
    Date,
    URL,
  });
  vm.runInContext(transpiled.outputText, ctx);
  return mod.exports;
}

function buildSheetsToCheck(schemas) {
  return [
    { name: 'TASKS', schema: schemas.StrictTaskSchema },
    { name: 'BUDGET_CATEGORIES', schema: schemas.StrictBudgetCategorySchema },
    { name: 'BUDGET_ENTRIES', schema: schemas.StrictBudgetEntrySchema },
    { name: 'BUDGET_SIMULATIONS', schema: schemas.StrictSimulationEntrySchema },
    { name: 'PROJECTS', schema: schemas.StrictProjectSchema },
    { name: 'EXTERNAL_DOCS', schema: schemas.StrictExternalDocSchema },
    { name: 'CLASSIFICATION_WORDS', schema: schemas.StrictClassificationWordsSchema },
    { name: 'SCHEDULES', schema: schemas.StrictScheduleSchema },
    { name: 'CONTACTS', schema: schemas.StrictContactSchema },
    { name: 'WORKING_MEMORY', schema: schemas.StrictWorkingMemorySchema },
    { name: 'ADMIN_DOC_INDEX', schema: schemas.StrictAdminDocMetadataSchema },
    { name: 'WEEKLY_REPORTS', schema: schemas.StrictWeeklyReportSchema },
  ];
}

const syncSchemas = loadStrictSchemasSync();
const SHEETS_TO_CHECK = buildSheetsToCheck(syncSchemas);

const HARNESS_SCHEMAS = {
  ...syncSchemas,
  TaskSchema: syncSchemas.StrictTaskSchema,
  BudgetCategorySchema: syncSchemas.StrictBudgetCategorySchema,
  BudgetEntrySchema: syncSchemas.StrictBudgetEntrySchema,
  SimulationEntrySchema: syncSchemas.StrictSimulationEntrySchema,
  ProjectSchema: syncSchemas.StrictProjectSchema,
  ExternalDocSchema: syncSchemas.StrictExternalDocSchema,
  ClassificationWordsSchema: syncSchemas.StrictClassificationWordsSchema,
  ScheduleSchema: syncSchemas.StrictScheduleSchema,
  ContactSchema: syncSchemas.StrictContactSchema,
  WorkingMemorySchema: syncSchemas.StrictWorkingMemorySchema,
  AdminDocMetadataSchema: syncSchemas.StrictAdminDocMetadataSchema,
  WeeklyWorkItemStatusSchema: syncSchemas.StrictWeeklyWorkItemStatusSchema || syncSchemas.WeeklyWorkItemStatusSchema,
  WeeklyReportSchema: syncSchemas.StrictWeeklyReportSchema,
  FestivalDataSchema: syncSchemas.StrictFestivalDataSchema,
};

const ENUM_SCHEMAS_TO_CHECK = [
  { name: 'TaskStatusSchema', schema: syncSchemas.TaskStatusSchema },
  { name: 'TaskPrioritySchema', schema: syncSchemas.TaskPrioritySchema },
  { name: 'BudgetActionTypeSchema', schema: syncSchemas.BudgetActionTypeSchema },
  { name: 'ScheduleTypeSchema', schema: syncSchemas.ScheduleTypeSchema },
  { name: 'WorkingMemoryCategorySchema', schema: syncSchemas.WorkingMemoryCategorySchema },
  { name: 'WorkingMemoryStatusSchema', schema: syncSchemas.WorkingMemoryStatusSchema },
  { name: 'WorkingMemorySourceSchema', schema: syncSchemas.WorkingMemorySourceSchema },
  { name: 'AdminDocTypeSchema', schema: syncSchemas.AdminDocTypeSchema },
  { name: 'WeeklyWorkItemStatusSchema', schema: syncSchemas.WeeklyWorkItemStatusSchema || syncSchemas.StrictWeeklyWorkItemStatusSchema },
];

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

function loadFestivalFallbackSync() {
  const fallbackPath = path.resolve(__dirname, '../src/lib/constants/yangjaeFestivalFallback.ts');
  if (!fs.existsSync(fallbackPath)) {
    throw new Error(`Fallback file not found: ${fallbackPath}`);
  }
  const ts = require('typescript');
  const vm = require('vm');
  const source = fs.readFileSync(fallbackPath, 'utf-8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  const ctx = vm.createContext({ module: mod, exports: mod.exports, require });
  vm.runInContext(transpiled.outputText, ctx);
  return mod.exports.YANGJAE_FALLBACK_DATA;
}

function validateFestivalSSOT(schemas = syncSchemas, options = {}) {
  const errors = [];
  const strictSchema = schemas.StrictFestivalDataSchema;
  if (!strictSchema) {
    return {
      valid: false,
      errorCount: 1,
      errors: [{ target: 'SCHEMA', error: 'StrictFestivalDataSchema is missing in src/lib/schemas.ts' }],
    };
  }

  const festivalJsonPath = path.resolve(__dirname, '../data/FESTIVAL_YANGJAE_2026.json');
  let diskData = options.diskData !== undefined ? options.diskData : null;
  if (diskData !== null || fs.existsSync(festivalJsonPath)) {
    try {
      if (diskData === null) {
        diskData = JSON.parse(fs.readFileSync(festivalJsonPath, 'utf-8'));
      }
      const parsedDisk = strictSchema.safeParse(diskData);
      if (!parsedDisk.success) {
        errors.push({
          target: 'data/FESTIVAL_YANGJAE_2026.json',
          error: parsedDisk.error.format(),
        });
      } else {
        const alloc = diskData.budget.allocated;
        const allocSum =
          alloc.agencyService + alloc.suppliesAndRental + alloc.refreshments + alloc.volunteerSupport;
        if (diskData.budget.total !== allocSum) {
          errors.push({
            target: 'data/FESTIVAL_YANGJAE_2026.json (Rule R Budget Parity)',
            error: `budget.total (${diskData.budget.total}) !== allocated sum (${allocSum})`,
          });
        }
      }
    } catch (err) {
      errors.push({ target: 'data/FESTIVAL_YANGJAE_2026.json', error: err.message });
    }
  } else {
    errors.push({
      target: 'data/FESTIVAL_YANGJAE_2026.json',
      error: `Festival SSOT file not found: ${festivalJsonPath}`,
    });
  }

  let fallbackData = options.fallbackData !== undefined ? options.fallbackData : null;
  try {
    if (fallbackData === null) {
      fallbackData = loadFestivalFallbackSync();
    }
    const parsedFallback = strictSchema.safeParse(fallbackData);
    if (!parsedFallback.success) {
      errors.push({
        target: 'src/lib/constants/yangjaeFestivalFallback.ts',
        error: parsedFallback.error.format(),
      });
    } else {
      const alloc = fallbackData.budget.allocated;
      const allocSum =
        alloc.agencyService + alloc.suppliesAndRental + alloc.refreshments + alloc.volunteerSupport;
      if (fallbackData.budget.total !== allocSum) {
        errors.push({
          target: 'yangjaeFestivalFallback.ts (Rule R Budget Parity)',
          error: `budget.total (${fallbackData.budget.total}) !== allocated sum (${allocSum})`,
        });
      }
    }
  } catch (err) {
    errors.push({ target: 'src/lib/constants/yangjaeFestivalFallback.ts', error: err.message });
  }

  if (diskData && fallbackData && errors.length === 0) {
    const sections = ['milestones', 'booths', 'schedule', 'duties', 'nextYearChecklist'];
    for (const key of sections) {
      const diskLen = Array.isArray(diskData[key]) ? diskData[key].length : 0;
      const fbLen = Array.isArray(fallbackData[key]) ? fallbackData[key].length : 0;
      if (diskLen !== fbLen) {
        errors.push({
          target: `Festival SSOT <-> Fallback Parity (${key})`,
          error: `data/FESTIVAL_YANGJAE_2026.json ${key}.length (${diskLen}) !== yangjaeFestivalFallback.ts ${key}.length (${fbLen})`,
        });
      }
    }
    if (diskData.meta?.lastUpdated !== fallbackData.meta?.lastUpdated) {
      errors.push({
        target: 'Festival SSOT <-> Fallback Parity (meta.lastUpdated)',
        error: `data/FESTIVAL_YANGJAE_2026.json meta.lastUpdated (${diskData.meta?.lastUpdated}) !== yangjaeFestivalFallback.ts meta.lastUpdated (${fallbackData.meta?.lastUpdated})`,
      });
    }
    if (diskData.meta?.overallProgress !== fallbackData.meta?.overallProgress) {
      errors.push({
        target: 'Festival SSOT <-> Fallback Parity (meta.overallProgress)',
        error: `data/FESTIVAL_YANGJAE_2026.json meta.overallProgress (${diskData.meta?.overallProgress}) !== yangjaeFestivalFallback.ts meta.overallProgress (${fallbackData.meta?.overallProgress})`,
      });
    }
    if (diskData.budget?.total !== fallbackData.budget?.total) {
      errors.push({
        target: 'Festival SSOT <-> Fallback Parity (budget.total)',
        error: `data/FESTIVAL_YANGJAE_2026.json budget.total (${diskData.budget?.total}) !== yangjaeFestivalFallback.ts budget.total (${fallbackData.budget?.total})`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errorCount: errors.length,
    errors,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isQuick = args.includes('--quick') || args.includes('--db-only');

  console.log('====================================================');
  console.log('🚀 Zod Gatekeeper: Starting Database Integrity Test...');
  console.log('====================================================');

  let failedCount = 0;

  // Step 1: Load 12 domain strict schemas dynamically from src/lib/schemas.ts
  let schemas;
  try {
    schemas = await loadStrictSchemas();
    console.log(`🔗 [SSOT PASS] Loaded 12 domain strict schemas dynamically from src/lib/schemas.ts (SSOT).`);
  } catch (err) {
    console.error(`❌ [HARNESS LOAD ERROR] Failed to load domain schemas from src/lib/schemas.ts:`, err.message);
    process.exit(1);
  }

  const sheetsToCheck = buildSheetsToCheck(schemas);

  // Step 2: Validate all 12 domain JSON sheets in data/
  for (const sheet of sheetsToCheck) {
    const filePath = path.join(process.cwd(), 'data', `${sheet.name}.json`);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  [SKIP] Sheet '${sheet.name}' database file does not exist (OK for fresh environment).`);
      continue;
    }

    try {
      const rawContent = fs.readFileSync(filePath, 'utf-8');
      if (!rawContent.trim()) {
        console.log(`⚠️  [SKIP] Sheet '${sheet.name}' is empty.`);
        continue;
      }

      const data = JSON.parse(rawContent);
      if (!Array.isArray(data)) {
        console.error(`❌ [HARNESS ERROR] Database '${sheet.name}' must be a JSON array.`);
        failedCount++;
        continue;
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
  }

  // Step 2-B: Validate Festival 4-Way SSOT (data/FESTIVAL_YANGJAE_2026.json & yangjaeFestivalFallback.ts)
  console.log(`🔍 [CHECK] Validating Festival SSOT ('FESTIVAL_YANGJAE_2026.json' & 'yangjaeFestivalFallback.ts')...`);
  const festivalValidation = validateFestivalSSOT(schemas);
  if (festivalValidation.valid) {
    console.log(`  ↳ ✅ [PASS] 'FESTIVAL_YANGJAE_2026' & 'YANGJAE_FALLBACK_DATA' are schema- and budget-compliant!`);
  } else {
    festivalValidation.errors.forEach(errItem => {
      console.error(`  ↳ ❌ [HARNESS ZOD ERROR] in '${errItem.target}':`);
      console.error(typeof errItem.error === 'string' ? errItem.error : JSON.stringify(errItem.error, null, 2));
    });
    failedCount += festivalValidation.errorCount;
  }

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

  // Step 3: Lint / Type Gatekeeper
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

  // Step 3-B: VLDS UI Copy Design Harness (AST Static Gatekeeper)
  console.log('\n====================================================');
  console.log('🎨 VLDS UI Copy Design Harness: Checking JSX microcopy...');
  console.log('====================================================');
  try {
    const { auditUiCopyDirectory } = require('./audit-ui-copy');
    const uiAudit = auditUiCopyDirectory();
    if (uiAudit.passed) {
      console.log(
        `  ↳ ✅ [PASS] Scanned ${uiAudit.filesScanned} TSX component files. 0 UI copy violations found (ignores: ${uiAudit.ignoredCount}).`
      );
    } else {
      console.error(
        `  ↳ ❌ [HARNESS UI-COPY ERROR] Found ${uiAudit.violationCount} UI copy violation(s):`
      );
      uiAudit.violations.slice(0, 20).forEach(v => {
        console.error(`     - ${v.file}:${v.line} [${v.kind}] "${v.text}" -> ${v.reasons.join(' | ')}`);
      });
      failedCount += uiAudit.violationCount;
    }
  } catch (uiErr) {
    console.error('  ↳ ❌ [FAIL] VLDS UI Copy Design Harness error:', uiErr.message);
    failedCount++;
  }

  // Step 4: AGENTS.md 및 Engineering Report 마일스톤 자동 동기화
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

if (require.main === module) {
  main().catch(err => {
    console.error('❌ [HARNESS FATAL ERROR]', err);
    process.exit(1);
  });
}

module.exports = {
  loadStrictSchemas,
  loadStrictSchemasSync,
  loadFestivalFallbackSync,
  buildSheetsToCheck,
  validateSheetRecords,
  validateFestivalSSOT,
  SHEETS_TO_CHECK,
  HARNESS_SCHEMAS,
  ENUM_SCHEMAS_TO_CHECK,
  DOMAIN_SHEET_NAMES: syncSchemas.DOMAIN_SHEET_NAMES,
};
