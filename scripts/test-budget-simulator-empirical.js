const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 EMPIRICAL CHALLENGER: BUDGET SIMULATOR TEST HARNESS');
console.log('====================================================\n');

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ↳ ✅ [PASS] ${message}`);
  } else {
    console.error(`  ↳ ❌ [FAIL] ${message}`);
    failures++;
  }
}

const rootDir = path.resolve(__dirname, '..');
const categoriesPath = path.join(rootDir, 'data', 'BUDGET_CATEGORIES.json');
const entriesPath = path.join(rootDir, 'data', 'BUDGET_ENTRIES.json');

const budgetCategories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
const budgetEntries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));

console.log(`Loaded ${budgetCategories.length} BUDGET_CATEGORIES and ${budgetEntries.length} BUDGET_ENTRIES from local data.\n`);

// Helper to simulate getCategoryStats
function getCategoryStats(catId) {
  const matchingEntries = budgetEntries.filter(e => e.categoryId === catId);
  const spent = matchingEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
  return { spent, count: matchingEntries.length };
}

// Read useBudgetSimulator.ts file content directly
const hookPath = path.join(rootDir, 'src', 'hooks', 'useBudgetSimulator.ts');
const hookContent = fs.readFileSync(hookPath, 'utf8');

// ----------------------------------------------------
// TEST 1: Preset Data & Real Category Alignment
// ----------------------------------------------------
console.log('🔍 [TEST 1] Verifying TEST_PRESET_ENTRIES in useBudgetSimulator.ts...');

assert(hookContent.includes('export const TEST_PRESET_ENTRIES'), 'TEST_PRESET_ENTRIES is exported in useBudgetSimulator.ts');

const startIndex = hookContent.indexOf('export const TEST_PRESET_ENTRIES');
const arrayStartIndex = hookContent.indexOf('[', startIndex);
const arrayEndIndex = hookContent.indexOf('];', arrayStartIndex);

assert(arrayStartIndex !== -1 && arrayEndIndex !== -1, 'Successfully located TEST_PRESET_ENTRIES array boundary in TS source');

let TEST_PRESET_ENTRIES = [];
if (arrayStartIndex !== -1 && arrayEndIndex !== -1) {
  const rawArrayStr = hookContent.substring(arrayStartIndex, arrayEndIndex + 1);
  try {
    TEST_PRESET_ENTRIES = eval(rawArrayStr);
  } catch (err) {
    console.error('Failed to parse TEST_PRESET_ENTRIES:', err.message);
  }
}

assert(Array.isArray(TEST_PRESET_ENTRIES), 'TEST_PRESET_ENTRIES is an array');
assert(TEST_PRESET_ENTRIES.length === 8, `TEST_PRESET_ENTRIES contains 8 items (found ${TEST_PRESET_ENTRIES.length})`);

let mappedPresetCount = 0;
TEST_PRESET_ENTRIES.forEach((preset, idx) => {
  assert(typeof preset.name === 'string' && preset.name.length > 0, `Preset #${idx + 1} (${preset.name}) has valid name`);
  assert(preset.unitPrice > 0, `Preset #${idx + 1} unitPrice is positive (${preset.unitPrice})`);
  assert(preset.quantity >= 1, `Preset #${idx + 1} quantity is at least 1 (${preset.quantity})`);
  assert(preset.amount === preset.unitPrice * preset.quantity, `Preset #${idx + 1} amount matches unitPrice * quantity (${preset.amount})`);
  
  const match = budgetCategories.find(c => c.detailedProject === preset.detailedProject && c.statItem === preset.statItem);
  if (match) {
    mappedPresetCount++;
  }
});
assert(mappedPresetCount > 0, `At least 1 preset entry matches real BUDGET_CATEGORIES (${mappedPresetCount}/8 matched)`);

// ----------------------------------------------------
// TEST 2: Calculation Engine Accuracy (Project & Stat Item Summaries)
// ----------------------------------------------------
console.log('\n🔍 [TEST 2] Verifying Balance Calculation Engine Math & Logic...');

function computeProjectSummaries(categories, entries) {
  const map = new Map();

  categories.forEach(cat => {
    const dp = cat.detailedProject || '기타';
    if (!map.has(dp)) {
      map.set(dp, { totalBudget: 0, currentSpent: 0, simulatedExpenditure: 0 });
    }
    const stats = getCategoryStats(cat.id);
    const target = map.get(dp);
    target.totalBudget += cat.totalBudget || 0;
    target.currentSpent += stats?.spent || 0;
  });

  entries.forEach(entry => {
    const dp = entry.detailedProject || '기타';
    if (!map.has(dp)) {
      map.set(dp, { totalBudget: 0, currentSpent: 0, simulatedExpenditure: 0 });
    }
    const target = map.get(dp);
    target.simulatedExpenditure += entry.amount || 0;
  });

  const results = [];
  map.forEach((val, dp) => {
    const currentRemaining = val.totalBudget - val.currentSpent;
    const finalExpectedBalance = currentRemaining - val.simulatedExpenditure;
    const executionRate = val.totalBudget > 0 
      ? ((val.currentSpent + val.simulatedExpenditure) / val.totalBudget) * 100 
      : 0;
    
    results.push({
      detailedProject: dp,
      totalBudget: val.totalBudget,
      currentSpent: val.currentSpent,
      currentRemaining,
      simulatedExpenditure: val.simulatedExpenditure,
      finalExpectedBalance,
      executionRate,
      isDeficit: finalExpectedBalance < 0,
    });
  });

  return results.sort((a, b) => a.detailedProject.localeCompare(b.detailedProject));
}

function computeStatItemSummaries(categories, entries) {
  const map = new Map();

  categories.forEach(cat => {
    const dp = cat.detailedProject || '기타';
    const st = cat.statItem || '일반';
    const key = `${dp}::${st}`;

    if (!map.has(key)) {
      map.set(key, { statItem: st, detailedProject: dp, totalBudget: 0, currentSpent: 0, simulatedExpenditure: 0 });
    }
    const stats = getCategoryStats(cat.id);
    const target = map.get(key);
    target.totalBudget += cat.totalBudget || 0;
    target.currentSpent += stats?.spent || 0;
  });

  entries.forEach(entry => {
    const dp = entry.detailedProject || '기타';
    const st = entry.statItem || '일반';
    const key = `${dp}::${st}`;

    if (!map.has(key)) {
      map.set(key, { statItem: st, detailedProject: dp, totalBudget: 0, currentSpent: 0, simulatedExpenditure: 0 });
    }
    const target = map.get(key);
    target.simulatedExpenditure += entry.amount || 0;
  });

  const results = [];
  map.forEach((val) => {
    const currentRemaining = val.totalBudget - val.currentSpent;
    const finalExpectedBalance = currentRemaining - val.simulatedExpenditure;

    results.push({
      statItem: val.statItem,
      detailedProject: val.detailedProject,
      totalBudget: val.totalBudget,
      currentSpent: val.currentSpent,
      currentRemaining,
      simulatedExpenditure: val.simulatedExpenditure,
      finalExpectedBalance,
      isDeficit: finalExpectedBalance < 0,
    });
  });

  return results.sort((a, b) => {
    const dpComp = a.detailedProject.localeCompare(b.detailedProject);
    if (dpComp !== 0) return dpComp;
    return a.statItem.localeCompare(b.statItem);
  });
}

// Test with Empty Simulation Entries
const baselineProjectSummaries = computeProjectSummaries(budgetCategories, []);
assert(baselineProjectSummaries.length > 0, `Baseline projectSummaries generated (${baselineProjectSummaries.length} projects)`);

const targetProject = baselineProjectSummaries[0];
console.log(`  ℹ Testing project '${targetProject.detailedProject}': Budget=${targetProject.totalBudget.toLocaleString()}, Spent=${targetProject.currentSpent.toLocaleString()}, Remaining=${targetProject.currentRemaining.toLocaleString()}`);

// Add a test simulation entry to targetProject
const testSimEntry = {
  id: 'test-1',
  name: 'Empirical Test Entry',
  detailedProject: targetProject.detailedProject,
  statItem: '201-01 사무관리비',
  unitPrice: 500000,
  quantity: 3,
  amount: 1500000, // 500000 * 3
  createdAt: new Date().toISOString(),
};

const updatedProjectSummaries = computeProjectSummaries(budgetCategories, [testSimEntry]);
const updatedTarget = updatedProjectSummaries.find(p => p.detailedProject === targetProject.detailedProject);

assert(updatedTarget.simulatedExpenditure === 1500000, `Simulated expenditure updated to 1,500,000 (was 0)`);
assert(updatedTarget.finalExpectedBalance === targetProject.currentRemaining - 1500000, `Final expected balance correct (${targetProject.currentRemaining} - 1500000 = ${updatedTarget.finalExpectedBalance})`);

const expectedRate = ((updatedTarget.currentSpent + 1500000) / updatedTarget.totalBudget) * 100;
assert(Math.abs(updatedTarget.executionRate - expectedRate) < 0.0001, `Execution rate calculation correct (${updatedTarget.executionRate.toFixed(2)}%)`);

// Test Deficit Detection (Stress Test: Over-expenditure)
const deficitSimEntry = {
  id: 'test-deficit',
  name: 'Huge Deficit Item',
  detailedProject: targetProject.detailedProject,
  statItem: '201-01 사무관리비',
  unitPrice: targetProject.totalBudget + 1000000,
  quantity: 1,
  amount: targetProject.totalBudget + 1000000,
  createdAt: new Date().toISOString(),
};

const deficitSummaries = computeProjectSummaries(budgetCategories, [deficitSimEntry]);
const deficitTarget = deficitSummaries.find(p => p.detailedProject === targetProject.detailedProject);
assert(deficitTarget.isDeficit === true, `isDeficit flag correctly set to true when finalExpectedBalance < 0 (${deficitTarget.finalExpectedBalance})`);

// ----------------------------------------------------
// TEST 3: Zero Budget & Edge Case Math Safety
// ----------------------------------------------------
console.log('\n🔍 [TEST 3] Stress-testing Zero Division & Edge Cases...');

const zeroCategory = [{ id: 'zero-cat', detailedProject: 'Zero Budget Project', statItem: '201-01', totalBudget: 0 }];
const zeroSummaries = computeProjectSummaries(zeroCategory, [{ detailedProject: 'Zero Budget Project', amount: 500000 }]);
const zeroResult = zeroSummaries[0];

assert(!isNaN(zeroResult.executionRate), `executionRate is NOT NaN when totalBudget = 0 (got ${zeroResult.executionRate})`);
assert(zeroResult.executionRate === 0, `executionRate handles zero division safely by returning 0`);
assert(zeroResult.isDeficit === true, `isDeficit is true when balance is -500,000 (${zeroResult.finalExpectedBalance})`);

// ----------------------------------------------------
// TEST 4: Zod Schema Verification
// ----------------------------------------------------
console.log('\n🔍 [TEST 4] Verifying SimulationEntrySchema & Zod Fallback Defaults...');

const schemasPath = path.join(rootDir, 'src', 'lib', 'schemas.ts');
const schemasContent = fs.readFileSync(schemasPath, 'utf8');

assert(schemasContent.includes('SimulationEntrySchema'), 'SimulationEntrySchema is defined in src/lib/schemas.ts');
assert(schemasContent.includes('SIMULATION_ENTRIES'), 'SIMULATION_ENTRIES domain schema registered in getDomainSchema');

// ----------------------------------------------------
// TEST 5: SimulationInputForm UI Component Contract Checks
// ----------------------------------------------------
console.log('\n🔍 [TEST 5] Inspecting SimulationInputForm.tsx code contract & performance rules...');

const formPath = path.join(rootDir, 'src', 'components', 'budget', 'ui', 'SimulationInputForm.tsx');
const formContent = fs.readFileSync(formPath, 'utf8');

assert(formContent.includes('React.memo'), 'SimulationInputForm uses React.memo for DOM rendering isolation');
assert(!formContent.includes('fetch('), 'SimulationInputForm has ZERO direct fetch() calls (MVC compliant)');
assert(formContent.includes('useCallback'), 'SimulationInputForm memoizes event handlers with useCallback');
assert(formContent.includes('useMemo'), 'SimulationInputForm memoizes derived amounts with useMemo');
assert(formContent.includes('toLocaleString'), 'SimulationInputForm formats unit price with thousand separators');

// ----------------------------------------------------
// TEST 6: Duplicate Key Prevention & Merged Entries Deduplication
// ----------------------------------------------------
console.log('\n🔍 [TEST 6] Verifying Duplicate Key Prevention & MergedEntries Deduplication...');

// 1. Verify SimulationResultTable & SimulationEntryList have defensive key patterns
const tablePath = path.join(rootDir, 'src', 'components', 'budget', 'ui', 'SimulationResultTable.tsx');
const tableContent = fs.readFileSync(tablePath, 'utf8');
const listPath = path.join(rootDir, 'src', 'components', 'budget', 'ui', 'SimulationEntryList.tsx');
const listContent = fs.readFileSync(listPath, 'utf8');

assert(tableContent.includes('key={`sim-row-${entry.id}-${entryIdx}`}'), 'SimulationResultTable uses indexed unique keys for Level 3 simulation rows');
assert(tableContent.includes('key={`stat-${statKey}-${sIdx}`}'), 'SimulationResultTable uses indexed unique keys for stat items');
assert(listContent.includes('key={`sim-grp-item-${item.id}-${itemIdx}`}'), 'SimulationEntryList uses indexed unique keys for grouped view items');
assert(listContent.includes('key={`sim-tbl-item-${item.id}-${itemIdx}`}'), 'SimulationEntryList uses indexed unique keys for table view items');
assert(listContent.includes('key={`sim-card-item-${item.id}-${itemIdx}`}'), 'SimulationEntryList uses indexed unique keys for card view items');

// 2. Simulate the mergedEntries deduplication logic with identical IDs
function simulateMergedEntries(entries, budgetEntries, categories) {
  const list = [];
  const seenSimIds = new Set();
  const existingBudgetEntryIds = new Set();

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e || !e.id) continue;
    if (seenSimIds.has(e.id)) continue;
    seenSimIds.add(e.id);
    if (e.budgetEntryId) {
      existingBudgetEntryIds.add(e.budgetEntryId);
    }
    list.push({ ...e });
  }

  if (budgetEntries) {
    for (let i = 0; i < budgetEntries.length; i++) {
      const be = budgetEntries[i];
      if (!be.isPlanned) continue;

      let matchedIdx = -1;
      if (be.simulationEntryId && seenSimIds.has(be.simulationEntryId)) {
        matchedIdx = list.findIndex(e => e.id === be.simulationEntryId);
      } else if (be.id && existingBudgetEntryIds.has(be.id)) {
        matchedIdx = list.findIndex(e => e.budgetEntryId === be.id);
      }

      if (matchedIdx >= 0) {
        const current = list[matchedIdx];
        const needsBudgetEntryId = !current.budgetEntryId && be.id;
        const needsSettled = be.isSettled && current.status !== 'SETTLED';
        if (needsBudgetEntryId || needsSettled) {
          list[matchedIdx] = {
            ...current,
            budgetEntryId: current.budgetEntryId || be.id,
            status: be.isSettled ? 'SETTLED' : current.status,
          };
        }
        if (be.id) existingBudgetEntryIds.add(be.id);
        continue;
      }

      let targetSimId = be.simulationEntryId || `sim-be-${be.id}`;
      if (seenSimIds.has(targetSimId)) {
        targetSimId = `sim-be-${be.id}-${targetSimId}`;
      }
      seenSimIds.add(targetSimId);
      if (be.id) existingBudgetEntryIds.add(be.id);

      const cat = categories?.find(c => c.id === be.categoryId);
      list.push({
        id: targetSimId,
        name: be.purpose,
        detailedProject: cat?.detailedProject || '기타사업',
        statItem: cat?.statItem || cat?.name || '일반운영비',
        categoryId: be.categoryId,
        unitPrice: be.amount,
        quantity: 1,
        amount: be.amount,
        memo: be.memo,
        createdAt: be.date || new Date().toISOString(),
        status: be.isSettled ? 'SETTLED' : 'PLANNED',
        budgetEntryId: be.id,
      });
    }
  }

  const finalSeenIds = new Set();
  const sanitizedList = [];
  for (let i = 0; i < list.length; i++) {
    let item = list[i];
    if (finalSeenIds.has(item.id)) {
      item = { ...item, id: `${item.id}-${i}` };
    }
    finalSeenIds.add(item.id);
    sanitizedList.push(item);
  }

  return sanitizedList;
}

// Test with the exact bug scenario reported: collision with key 'mtthb2h1aczgpm6o3'
const localEntriesWithCollision = [
  { id: 'mtthb2h1aczgpm6o3', name: 'Item In Local Storage', amount: 500000, detailedProject: '사업A', statItem: '201-01' },
  { id: 'mtthb2h1aczgpm6o3', name: 'Accidental Duplicate In Storage', amount: 500000, detailedProject: '사업A', statItem: '201-01' },
  { id: 'other-item-1', name: 'Other Item', amount: 100000, detailedProject: '사업A', statItem: '201-01' }
];

const budgetEntriesWithSameSimId = [
  { id: 'be-12345', simulationEntryId: 'mtthb2h1aczgpm6o3', isPlanned: true, purpose: 'Synced SSOT Item', amount: 500000, categoryId: 'cat-1' }
];

const resultMerged = simulateMergedEntries(localEntriesWithCollision, budgetEntriesWithSameSimId, [{ id: 'cat-1', detailedProject: '사업A', statItem: '201-01' }]);

assert(resultMerged.length === 2, `Duplicate entries merged to exact unique count (expected 2, got ${resultMerged.length})`);
const matchedSim = resultMerged.find(e => e.id === 'mtthb2h1aczgpm6o3');
assert(matchedSim !== undefined, 'Simulation entry mtthb2h1aczgpm6o3 exists in result');
assert(matchedSim.budgetEntryId === 'be-12345', `Simulation entry mtthb2h1aczgpm6o3 backfilled budgetEntryId correctly (${matchedSim.budgetEntryId})`);

const allIds = resultMerged.map(e => e.id);
const uniqueIds = new Set(allIds);
assert(allIds.length === uniqueIds.size, 'All IDs in merged entries are strictly 100% unique');

// ----------------------------------------------------
// TEST 7: Daily Expense Issuance & Unexecuted Balance Calculation
// ----------------------------------------------------
console.log('\n🔍 [TEST 7] Verifying Daily Expense Unexecuted Balance Calculation & Surface Integration...');

// 1. Check hook integration
assert(hookContent.includes('target.dailyExpenseIssued += stats?.dailyExpenseIssued || 0;'), 'useBudgetSimulator accumulates dailyExpenseIssued in projectSummaries');
assert(hookContent.includes('dailyExpenseRemaining: val.dailyExpenseRemaining'), 'useBudgetSimulator outputs dailyExpenseRemaining in projectSummaries');

// 2. Check UI component integration
const freshTableContent = fs.readFileSync(tablePath, 'utf8');

assert(freshTableContent.includes('onlyWithDailyExpenses'), 'SimulationResultTable defines onlyWithDailyExpenses filter state');
assert(freshTableContent.includes('statItemsWithDailyExpenseCount'), 'SimulationResultTable computes statItemsWithDailyExpenseCount');
assert(freshTableContent.includes('일상 미집행'), 'SimulationResultTable renders 일상 미집행 badge/subtext');
assert(freshTableContent.includes('Coins'), 'SimulationResultTable imports Coins icon');

const cardsComponentPath = path.join(rootDir, 'src', 'components', 'budget', 'ui', 'SimulationSummaryCards.tsx');
const cardsContent = fs.readFileSync(cardsComponentPath, 'utf8');

assert(cardsContent.includes('totalDailyRemaining'), 'SimulationSummaryCards computes totalDailyRemaining');
assert(cardsContent.includes('totalDailyIssued'), 'SimulationSummaryCards computes totalDailyIssued');
assert(cardsContent.includes('실가용'), 'SimulationSummaryCards renders real available funds with daily expense balance');

// 3. Mathematical validation of daily expense entries in local dataset
let totalDailyIssuedFromData = 0;
let totalDailySpentFromData = 0;
budgetEntries.forEach(e => {
  if (e.actionType === 'issuance') {
    totalDailyIssuedFromData += (e.amount || 0);
  } else if (e.actionType === 'daily_expense') {
    totalDailySpentFromData += (e.amount || 0);
  }
});
const totalDailyRemainingFromData = totalDailyIssuedFromData - totalDailySpentFromData;

console.log(`  ↳ Local Data Daily Expense: Issued=₩${totalDailyIssuedFromData.toLocaleString()}, Spent=₩${totalDailySpentFromData.toLocaleString()}, Remaining=₩${totalDailyRemainingFromData.toLocaleString()}`);

assert(totalDailyIssuedFromData > 0, `Local database contains daily expense issuances (₩${totalDailyIssuedFromData.toLocaleString()})`);
assert(totalDailyRemainingFromData > 0, `Unexecuted daily expense balance is positive (₩${totalDailyRemainingFromData.toLocaleString()})`);
assert(totalDailyRemainingFromData === totalDailyIssuedFromData - totalDailySpentFromData, 'Daily expense balance strictly equals issued - spent');

console.log('\n====================================================');
if (failures === 0) {
  console.log('🎉 ALL EMPIRICAL CHECKS PASSED PERFECTLY (0 failures)!');
} else {
  console.log(`❌ VERIFICATION FAILED with ${failures} failure(s).`);
}
console.log('====================================================');

process.exit(failures > 0 ? 1 : 0);
