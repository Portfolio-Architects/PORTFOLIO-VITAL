/**
 * Empirical Concurrency & Persistence Stress Test Runner (Milestone M1)
 * 
 * Verifies:
 * 1. Zero race condition clobbering with async mutex queue (withSheetLock).
 * 2. Safe atomic writes & zero file corruption under rapid bursts.
 * 3. Lock queue resilience against unhandled rejections.
 * 4. Per-sheet isolation (no cross-sheet blocking).
 * 5. Deep inspection of the lock lifecycle & memory characteristics.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 EMPIRICAL CHALLENGER: CONCURRENCY & PERSISTENCE HARNESS');
console.log('====================================================\n');

let failures = 0;
let passes = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ↳ ✅ [PASS] ${message}`);
    passes++;
  } else {
    console.error(`  ↳ ❌ [FAIL] ${message}`);
    failures++;
  }
}

// ----------------------------------------------------
// 1. Mutex Queue Implementation from src/app/api/data/route.ts
// ----------------------------------------------------
const sheetLocks = new Map();

async function withSheetLock(sheet, fn) {
  const previousLock = sheetLocks.get(sheet) || Promise.resolve();
  let release;
  const currentLock = new Promise((resolve) => {
    release = resolve;
  });

  sheetLocks.set(sheet, previousLock.catch(() => {}).then(() => currentLock));

  try {
    await previousLock.catch(() => {});
    return await fn();
  } finally {
    release();
    if (sheetLocks.get(sheet) === currentLock) {
      sheetLocks.delete(sheet);
    }
  }
}

// ----------------------------------------------------
// 2. Safe Atomic File Operations from src/app/api/data/route.ts
// ----------------------------------------------------
async function safeWriteFile(filePath, dataStr, retries = 5, delay = 50) {
  const dirPath = path.dirname(filePath);
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch {}

  const tempFilePath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fs.promises.writeFile(tempFilePath, dataStr, 'utf-8');

      let renamed = false;
      for (let renameAttempt = 1; renameAttempt <= 3; renameAttempt++) {
        try {
          await fs.promises.rename(tempFilePath, filePath);
          renamed = true;
          break;
        } catch (renameErr) {
          if (renameAttempt === 3) throw renameErr;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      if (renamed) return;
    } catch (err) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch {}

      if (attempt === retries) {
        console.error(`[File System] Write failed after ${retries} attempts for path ${filePath}:`, err);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function safeReadFile(filePath) {
  return await fs.promises.readFile(filePath, 'utf-8');
}

// ----------------------------------------------------
// EXECUTION HARNESS
// ----------------------------------------------------
async function runAllEmpiricalChecks() {
  const testSheet = 'WIKI_DOC_stress_test_runner';
  const testFilePath = path.join(process.cwd(), 'data', `${testSheet}.json`);

  async function cleanup() {
    try {
      await fs.promises.unlink(testFilePath);
    } catch {}
    try {
      const dir = path.join(process.cwd(), 'data');
      const files = await fs.promises.readdir(dir);
      for (const f of files) {
        if (f.startsWith(testSheet) && f.endsWith('.tmp')) {
          await fs.promises.unlink(path.join(dir, f));
        }
      }
    } catch {}
  }

  await cleanup();

  // ----------------------------------------------------
  // TEST 1: Serialization Under 50 Parallel Tasks
  // ----------------------------------------------------
  console.log('🔍 [TEST 1] Testing withSheetLock serialization under 50 parallel tasks...');
  let activeCount = 0;
  let maxSimultaneous = 0;
  const executionOrder = [];

  const tasks = Array.from({ length: 50 }, (_, i) => async () => {
    return withSheetLock('TEST_SHEET_SERIAL', async () => {
      activeCount++;
      if (activeCount > maxSimultaneous) {
        maxSimultaneous = activeCount;
      }
      await new Promise((resolve) => setTimeout(resolve, 3));
      executionOrder.push(i);
      activeCount--;
      return i;
    });
  });

  const results = await Promise.all(tasks.map((t) => t()));
  check(results.length === 50, 'All 50 tasks completed');
  check(maxSimultaneous === 1, `Max simultaneous executions was strictly 1 (got ${maxSimultaneous})`);
  check(activeCount === 0, 'Active execution count returned cleanly to 0');
  check(executionOrder.length === 50, 'Execution order contains all 50 task IDs');

  // ----------------------------------------------------
  // TEST 2: Error Fault Tolerance & Deadlock Immunity
  // ----------------------------------------------------
  console.log('\n🔍 [TEST 2] Testing error resilience and deadlock immunity...');
  let errorCaught = false;
  let subsequentExecuted = false;

  const errTask = withSheetLock('TEST_ERROR_QUEUE', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    throw new Error('Deliberate test error');
  }).catch((e) => {
    errorCaught = true;
  });

  const nextTask = withSheetLock('TEST_ERROR_QUEUE', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    subsequentExecuted = true;
    return 'ok';
  });

  await Promise.all([errTask, nextTask]);
  check(errorCaught, 'Error was caught by caller');
  check(subsequentExecuted, 'Subsequent task executed successfully without deadlocking');

  // ----------------------------------------------------
  // TEST 3: Per-Sheet Concurrency Isolation
  // ----------------------------------------------------
  console.log('\n🔍 [TEST 3] Testing per-sheet concurrency isolation (no cross-sheet blocking)...');
  const timestamps = {};

  const sheetA = withSheetLock('SHEET_A', async () => {
    timestamps.startA = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 100));
    timestamps.endA = Date.now();
  });

  const sheetB = withSheetLock('SHEET_B', async () => {
    timestamps.startB = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 20));
    timestamps.endB = Date.now();
  });

  await Promise.all([sheetA, sheetB]);
  check(timestamps.endB < timestamps.endA, 'Sheet B (20ms) finished before Sheet A (100ms) - independent lock channels');

  // ----------------------------------------------------
  // TEST 4: Race Condition Demonstration (Unprotected vs Protected)
  // ----------------------------------------------------
  console.log('\n🔍 [TEST 4] Demonstrating race condition clobbering (Unprotected vs Protected)...');

  // Unprotected: 30 concurrent reads & writes
  await safeWriteFile(testFilePath, JSON.stringify([]));
  async function unprotectedAdd(item) {
    const raw = await safeReadFile(testFilePath);
    const data = JSON.parse(raw);
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 5)); // simulate latency
    data.push(item);
    await safeWriteFile(testFilePath, JSON.stringify(data));
  }

  const unprotCalls = Array.from({ length: 30 }, (_, i) => unprotectedAdd({ id: i }));
  await Promise.all(unprotCalls);
  const unprotData = JSON.parse(await safeReadFile(testFilePath));
  console.log(`  ℹ Unprotected: 30 additions resulted in only ${unprotData.length} records (clobbered: ${30 - unprotData.length})`);
  check(unprotData.length < 30, `Unprotected concurrent writes suffer race condition loss (${unprotData.length}/30 preserved)`);

  // Protected: 30 concurrent reads & writes with withSheetLock
  await safeWriteFile(testFilePath, JSON.stringify([]));
  async function protectedAdd(item) {
    return withSheetLock(testSheet, async () => {
      const raw = await safeReadFile(testFilePath);
      const data = JSON.parse(raw);
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 5)); // simulate latency
      data.push(item);
      await safeWriteFile(testFilePath, JSON.stringify(data));
    });
  }

  const protCalls = Array.from({ length: 30 }, (_, i) => protectedAdd({ id: i }));
  await Promise.all(protCalls);
  const protData = JSON.parse(await safeReadFile(testFilePath));
  console.log(`  ℹ Protected: 30 additions resulted in exactly ${protData.length} records`);
  check(protData.length === 30, `Protected concurrent writes achieved 100% zero-loss persistence (30/30 preserved)`);

  // ----------------------------------------------------
  // TEST 5: Rapid Burst Atomic Writes & File Corruption Resistance
  // ----------------------------------------------------
  console.log('\n🔍 [TEST 5] Testing rapid burst atomic writes and file corruption resistance...');
  let parseErrors = 0;

  const burstPromises = Array.from({ length: 25 }, (_, i) => {
    const payload = Array.from({ length: 100 }, (__, j) => ({
      id: `burst-${i}-${j}`,
      val: 'x'.repeat(200),
      timestamp: Date.now(),
    }));
    return withSheetLock(testSheet, async () => {
      await safeWriteFile(testFilePath, JSON.stringify(payload));
      // Immediately read back and verify valid JSON
      try {
        const text = await safeReadFile(testFilePath);
        JSON.parse(text);
      } catch (err) {
        parseErrors++;
      }
    });
  });

  await Promise.all(burstPromises);
  check(parseErrors === 0, `Zero JSON parse errors during 25 rapid bursts of 100-item payloads (parse errors: ${parseErrors})`);

  // Check no leftover .tmp files
  const dataDir = path.join(process.cwd(), 'data');
  const dirFiles = await fs.promises.readdir(dataDir);
  const leftoverTmp = dirFiles.filter((f) => f.startsWith(testSheet) && f.endsWith('.tmp'));
  check(leftoverTmp.length === 0, `No leftover temporary (.tmp) files found in data/ (found: ${leftoverTmp.length})`);

  // ----------------------------------------------------
  // TEST 6: Lock Map Lifecycle Analysis (Challenger Discovery)
  // ----------------------------------------------------
  console.log('\n🔍 [TEST 6] Inspecting withSheetLock memory cleanup & identity check...');
  // Check if sheetLocks still has entries after queue is completely idle
  const hasEntry = sheetLocks.has('TEST_SHEET_SERIAL');
  console.log(`  ℹ Notice: sheetLocks.has('TEST_SHEET_SERIAL') = ${hasEntry}`);
  console.log(`  ℹ Analysis: line 369 \`sheetLocks.get(sheet) === currentLock\` evaluates to false because sheetLocks stores a .then() promise, not currentLock.`);
  check(hasEntry === true, 'Confirmed Challenger Finding: sheetLocks entry persists due to Promise wrapper reference disparity');

  await cleanup();

  console.log('\n====================================================');
  if (failures === 0) {
    console.log(`🎉 ALL ${passes} EMPIRICAL CHECKS PASSED (0 failures)!`);
  } else {
    console.error(`❌ EMPIRICAL CHECKS COMPLETED with ${failures} failure(s) out of ${passes + failures}.`);
  }
  console.log('====================================================');

  return failures;
}

runAllEmpiricalChecks()
  .then((errCount) => process.exit(errCount > 0 ? 1 : 0))
  .catch((e) => {
    console.error('Fatal execution error:', e);
    process.exit(1);
  });
