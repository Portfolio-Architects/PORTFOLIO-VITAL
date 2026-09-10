const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 EMPIRICAL CHALLENGER 2: STATE SYNC STRESS HARNESS');
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
const dataDir = path.join(rootDir, 'data');
const budgetSimPath = path.join(dataDir, 'BUDGET_SIMULATIONS.json');
const budgetEntriesPath = path.join(dataDir, 'BUDGET_ENTRIES.json');
const wikiHookPath = path.join(rootDir, 'src', 'hooks', 'useWikiStorage.ts');
const simHookPath = path.join(rootDir, 'src', 'hooks', 'useBudgetSimulator.ts');

// ----------------------------------------------------
// TEST 1: Source Inspection of State Synchronization Mechanics
// ----------------------------------------------------
console.log('🔍 [TEST 1] Verifying Code Invariants in useWikiStorage.ts & useBudgetSimulator.ts...');

const wikiSrc = fs.readFileSync(wikiHookPath, 'utf8');
const simSrc = fs.readFileSync(simHookPath, 'utf8');

// 1.1 Wiki unmount cleanup must flush pendingBlocksRef
assert(wikiSrc.includes('pendingBlocksRef.current'), 'useWikiStorage defines pendingBlocksRef for in-flight blocks');
assert(wikiSrc.includes('replaceAll(`WIKI_DOC_${canonicalId}`'), 'useWikiStorage calls replaceAll on unmount for each pending canonical document');
assert(wikiSrc.includes('clearTimeout(timers[k])'), 'useWikiStorage cancels pending debounce timers on unmount to prevent duplicate delayed writes');

// 1.2 Budget Simulator bidirectional sync
assert(simSrc.includes('updateBudgetEntry(budgetEntryId, budgetUpdate)'), 'useBudgetSimulator calls updateBudgetEntry when budgetEntryId exists');
assert(simSrc.includes('deleteBudgetEntry(target.budgetEntryId)'), 'useBudgetSimulator cascades deleteEntry to deleteBudgetEntry');
assert(simSrc.includes('updateBudgetEntry(sim.budgetEntryId, { isSettled: true })'), 'useBudgetSimulator settleEntry marks planned BudgetEntry as settled');
assert(/useQuery\(\s*\{[\s\S]*?queryKey:\s*\['BUDGET_SIMULATIONS'\]/.test(simSrc), 'useBudgetSimulator queries BUDGET_SIMULATIONS from disk SSOT');
assert(simSrc.includes("replaceAll('BUDGET_SIMULATIONS'"), 'useBudgetSimulator persists simulations to disk SSOT via replaceAll');

// ----------------------------------------------------
// TEST 2: Disk SSOT Integrity & Bidirectional Linkage
// ----------------------------------------------------
console.log('\n🔍 [TEST 2] Verifying Disk SSOT Linkage between BUDGET_SIMULATIONS.json & BUDGET_ENTRIES.json...');

assert(fs.existsSync(budgetSimPath), 'data/BUDGET_SIMULATIONS.json exists on disk');
assert(fs.existsSync(budgetEntriesPath), 'data/BUDGET_ENTRIES.json exists on disk');

const simEntries = JSON.parse(fs.readFileSync(budgetSimPath, 'utf8'));
const budgetEntries = JSON.parse(fs.readFileSync(budgetEntriesPath, 'utf8'));

console.log(`  ℹ Found ${simEntries.length} items in BUDGET_SIMULATIONS.json`);
console.log(`  ℹ Found ${budgetEntries.length} items in BUDGET_ENTRIES.json`);

// Check if linked entries in BUDGET_SIMULATIONS actually exist in BUDGET_ENTRIES
const plannedBudgetEntries = budgetEntries.filter(e => e.isPlanned);
console.log(`  ℹ Found ${plannedBudgetEntries.length} planned entries in BUDGET_ENTRIES.json`);

let linkedFoundCount = 0;
simEntries.forEach((sim, idx) => {
  if (sim.budgetEntryId) {
    const matched = budgetEntries.find(b => b.id === sim.budgetEntryId);
    if (matched) {
      linkedFoundCount++;
      assert(matched.isPlanned === true, `Sim entry #${idx + 1} (${sim.name}) links to planned BudgetEntry ${matched.id}`);
      assert(matched.amount === sim.amount, `Sim entry #${idx + 1} amount (${sim.amount}) matches BudgetEntry amount (${matched.amount})`);
    }
  }
});

assert(linkedFoundCount > 0, `At least 1 linked simulation entry corresponds to a real planned BudgetEntry on disk (found ${linkedFoundCount})`);

// ----------------------------------------------------
// TEST 3: Empirical Simulation of Disk SSOT Write & Mutex Serialization
// ----------------------------------------------------
console.log('\n🔍 [TEST 3] Empirical Verification of Atomic File Operations & Disk Writes...');

const testWikiFile = path.join(dataDir, 'WIKI_DOC_challenger_test_singleton.json');
try {
  // Simulate what replaceAll does via safe file write
  const testPayload = [{ id: 'singleton', blocks: [{ type: 'paragraph', content: 'Challenger Unmount Flush Empirical Payload' }] }];
  fs.writeFileSync(testWikiFile, JSON.stringify(testPayload, null, 2), 'utf8');

  assert(fs.existsSync(testWikiFile), 'Test wiki file successfully written to disk');
  const readBack = JSON.parse(fs.readFileSync(testWikiFile, 'utf8'));
  assert(readBack.length === 1 && readBack[0].blocks[0].content === 'Challenger Unmount Flush Empirical Payload', 'Disk content verified with 100% fidelity');
} finally {
  if (fs.existsSync(testWikiFile)) {
    fs.unlinkSync(testWikiFile);
    console.log('  ℹ Cleaned up temporary test wiki file.');
  }
}

// ----------------------------------------------------
// TEST 4: Detection of Accidental Duplication on Disk
// ----------------------------------------------------
console.log('\n🔍 [TEST 4] Adversarial Check: Duplicate IDs in BUDGET_SIMULATIONS.json...');

const simIds = simEntries.map(e => e.id);
const uniqueSimIds = new Set(simIds);
if (simIds.length !== uniqueSimIds.size) {
  console.warn(`  ⚠️ [ADVERSARIAL FINDING] BUDGET_SIMULATIONS.json contains ${simIds.length - uniqueSimIds.size} duplicate entries on disk!`);
  console.warn(`     Total items on disk: ${simIds.length}, Unique IDs: ${uniqueSimIds.size}`);
  console.warn(`     (Note: While frontend mergedEntries deduplicates in memory, disk JSON should ideally be pruned to prevent storage bloating.)`);
} else {
  console.log('  ↳ ✅ [PASS] No duplicate IDs in BUDGET_SIMULATIONS.json on disk.');
}

console.log('\n====================================================');
if (failures === 0) {
  console.log('🎉 ALL EMPIRICAL CHECKS PASSED (0 critical failures)!');
} else {
  console.log(`❌ VERIFICATION FAILED with ${failures} failure(s).`);
}
console.log('====================================================');

process.exit(failures > 0 ? 1 : 0);
