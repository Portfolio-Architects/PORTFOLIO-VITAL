import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  withLock,
  safeWriteFile,
  safeReadFile,
  readSheetData,
  writeSheetData,
  backupSheet,
  invalidateSheetCache,
  getSheetFilePath,
  getDataDir,
  getBackupDir,
} from '@/lib/server/storage-service';

describe('Challenger M4-1 Storage Service Adversarial Stress Suite', () => {
  const stressDataDir = path.join(
    os.tmpdir(),
    `vital-m4-stress-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  );

  beforeAll(async () => {
    process.env.VITAL_TEST_DATA_DIR = stressDataDir;
    await fs.mkdir(stressDataDir, { recursive: true });
  });

  afterAll(async () => {
    delete process.env.VITAL_TEST_DATA_DIR;
    try {
      await fs.rm(stressDataDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    invalidateSheetCache();
  });

  // =========================================================================
  // 1. HIGH-CONCURRENCY MUTEX LOCK QUEUE STRESS TESTS
  // =========================================================================
  describe('1. High-Concurrency Mutex Lock Serialization (withLock)', () => {
    it('eliminates lost updates across 30 concurrent read-modify-write workers with simulated jitter', async () => {
      const sheet = 'STRESS_COUNTER';
      await writeSheetData(sheet, { count: 0 }, { skipValidation: true, skipBackup: true });

      const numWorkers = 30;

      // Each worker acquires lock, reads sheet, simulates network/processing delay, increments, and writes back
      const workers = Array.from({ length: numWorkers }, (_, i) =>
        withLock(sheet, async () => {
          const current = await readSheetData<{ count: number }>(sheet, { forceFresh: true });
          // Inject random jitter (1-10ms) to widen any potential race condition window
          await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 10) + 1));
          current.count += 1;
          await writeSheetData(sheet, current, { skipValidation: true, skipBackup: true });
          return { workerId: i, newCount: current.count };
        })
      );

      const results = await Promise.all(workers);

      // Verify all 30 completed
      expect(results).toHaveLength(numWorkers);

      // Verify final counter value on disk is exactly 30 (zero lost updates)
      const finalData = await readSheetData<{ count: number }>(sheet, { forceFresh: true });
      expect(finalData.count).toBe(numWorkers);
    });

    it('safely serializes 25 concurrent array appends with zero dropped items', async () => {
      const sheet = 'STRESS_ARRAY_APPEND';
      await writeSheetData(sheet, [] as { id: number; timestamp: number }[], {
        skipValidation: true,
        skipBackup: true,
      });

      const numAppends = 25;
      const appenders = Array.from({ length: numAppends }, (_, idx) =>
        withLock(sheet, async () => {
          const items = await readSheetData<{ id: number; timestamp: number }[]>(sheet, {
            forceFresh: true,
          });
          await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 8) + 1));
          items.push({ id: idx, timestamp: Date.now() });
          await writeSheetData(sheet, items, { skipValidation: true, skipBackup: true });
          return idx;
        })
      );

      await Promise.all(appenders);

      const finalItems = await readSheetData<{ id: number; timestamp: number }[]>(sheet, {
        forceFresh: true,
      });
      expect(finalItems).toHaveLength(numAppends);

      const savedIds = new Set(finalItems.map((item) => item.id));
      expect(savedIds.size).toBe(numAppends);
      for (let i = 0; i < numAppends; i++) {
        expect(savedIds.has(i)).toBe(true);
      }
    });

    it('preserves strict FIFO execution order across sequentially queued tasks', async () => {
      const resource = 'STRESS_FIFO_QUEUE';
      const executionOrder: number[] = [];
      const numTasks = 20;

      const tasks = Array.from({ length: numTasks }, (_, idx) =>
        withLock(resource, async () => {
          await new Promise((r) => setTimeout(r, 5));
          executionOrder.push(idx);
          return idx;
        })
      );

      await Promise.all(tasks);

      expect(executionOrder).toEqual(Array.from({ length: numTasks }, (_, i) => i));
    });

    it('survives chaos execution: alternating failing and succeeding tasks without deadlocks or stalled queue', async () => {
      const resource = 'STRESS_CHAOS_QUEUE';
      const numTasks = 20;
      let successfulCount = 0;

      const tasks = Array.from({ length: numTasks }, (_, i) => {
        const isError = i % 2 === 0;
        return withLock(resource, async () => {
          await new Promise((r) => setTimeout(r, 4));
          if (isError) {
            throw new Error(`Intentional error at task ${i}`);
          }
          successfulCount++;
          return `ok-${i}`;
        }).catch((err) => {
          return `caught-${err.message}`;
        });
      });

      const settled = await Promise.all(tasks);

      expect(settled).toHaveLength(numTasks);
      expect(successfulCount).toBe(10); // Exactly 10 odd tasks succeeded

      for (let i = 0; i < numTasks; i++) {
        if (i % 2 === 0) {
          expect(settled[i]).toBe(`caught-Intentional error at task ${i}`);
        } else {
          expect(settled[i]).toBe(`ok-${i}`);
        }
      }
    });

    it('executes concurrent workloads on independent resources without cross-blocking', async () => {
      const resA = 'STRESS_PARALLEL_A';
      const resB = 'STRESS_PARALLEL_B';

      let activeA = 0;
      let activeB = 0;
      let witnessedConcurrentOverlap = false;

      // Launch 5 tasks for resA and 5 tasks for resB
      const tasksA = Promise.all(
        Array.from({ length: 5 }, () =>
          withLock(resA, async () => {
            activeA++;
            if (activeB > 0) witnessedConcurrentOverlap = true;
            await new Promise((r) => setTimeout(r, 25));
            if (activeB > 0) witnessedConcurrentOverlap = true;
            activeA--;
            return 'A';
          })
        )
      );

      const tasksB = Promise.all(
        Array.from({ length: 5 }, () =>
          withLock(resB, async () => {
            activeB++;
            if (activeA > 0) witnessedConcurrentOverlap = true;
            await new Promise((r) => setTimeout(r, 25));
            if (activeA > 0) witnessedConcurrentOverlap = true;
            activeB--;
            return 'B';
          })
        )
      );

      const [resListA, resListB] = await Promise.all([tasksA, tasksB]);

      expect(resListA).toHaveLength(5);
      expect(resListB).toHaveLength(5);
      // Independent resources must execute concurrently, proving non-blocking isolation
      expect(witnessedConcurrentOverlap).toBe(true);
    });
  });

  // =========================================================================
  // 2. SELF-HEALING RESILIENCE & BACKUP RECOVERY
  // =========================================================================
  describe('2. Self-Healing Resilience & Backup Recovery', () => {
    it('recovers corrupted primary file (invalid JSON syntax) and restores valid disk state', async () => {
      const sheet = 'STRESS_SELF_HEAL_SYNTAX';
      const goldenData = [
        { id: 'item-gold-1', label: 'Golden Master One' },
        { id: 'item-gold-2', label: 'Golden Master Two' },
      ];

      // 1. Initial write and forced backup creation
      await writeSheetData(sheet, goldenData, { skipValidation: true, skipBackup: false });
      await backupSheet(sheet, goldenData, { force: true });

      // 2. Corrupt the primary file with non-JSON syntax
      invalidateSheetCache(sheet);
      const filePath = getSheetFilePath(sheet);
      await fs.writeFile(filePath, '###CORRUPTED_NON_JSON_DATA_PAYLOAD###', 'utf-8');

      // 3. readSheetData should trigger self-healing and return goldenData
      const recovered = await readSheetData<typeof goldenData>(sheet, {
        retries: 2,
        delay: 10,
        forceFresh: true,
      });

      expect(recovered).toEqual(goldenData);

      // 4. Verify disk file has been physically repaired with valid JSON
      const repairedRaw = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(repairedRaw)).toEqual(goldenData);
    });

    it('recovers from empty (0-byte truncated) primary file', async () => {
      const sheet = 'STRESS_SELF_HEAL_EMPTY';
      const goldenPayload = { version: '2026.1', status: 'operational', count: 999 };

      await writeSheetData(sheet, goldenPayload, { skipValidation: true, skipBackup: false });
      await backupSheet(sheet, goldenPayload, { force: true });

      invalidateSheetCache(sheet);
      const filePath = getSheetFilePath(sheet);
      // Truncate to 0 bytes
      await fs.writeFile(filePath, '', 'utf-8');

      const recovered = await readSheetData<typeof goldenPayload>(sheet, {
        retries: 2,
        delay: 10,
        forceFresh: true,
      });

      expect(recovered).toEqual(goldenPayload);
      expect(recovered.count).toBe(999);
    });

    it('recovers from whitespace-only truncated primary file', async () => {
      const sheet = 'STRESS_SELF_HEAL_WHITESPACE';
      const goldenItems = [{ key: 'alpha', val: 100 }];

      await writeSheetData(sheet, goldenItems, { skipValidation: true, skipBackup: false });
      await backupSheet(sheet, goldenItems, { force: true });

      invalidateSheetCache(sheet);
      const filePath = getSheetFilePath(sheet);
      await fs.writeFile(filePath, '   \r\n\t\t   \n  ', 'utf-8');

      const recovered = await readSheetData<typeof goldenItems>(sheet, {
        retries: 2,
        delay: 10,
        forceFresh: true,
      });

      expect(recovered).toEqual(goldenItems);
    });

    it('restores the latest backup among multiple historical backups', async () => {
      const sheet = 'STRESS_LATEST_BACKUP_PICK';
      const sonDir = getBackupDir(sheet);
      await fs.mkdir(sonDir, { recursive: true });

      // Create 3 historical backups with ordered timestamps
      const backupV1 = [{ version: 1, note: 'older' }];
      const backupV2 = [{ version: 2, note: 'middle' }];
      const backupV3 = [{ version: 3, note: 'newest' }];

      await fs.writeFile(
        path.join(sonDir, `2026-11-10T10-00-00-000Z_${sheet}.json`),
        JSON.stringify(backupV1),
        'utf-8'
      );
      await fs.writeFile(
        path.join(sonDir, `2026-11-10T11-00-00-000Z_${sheet}.json`),
        JSON.stringify(backupV2),
        'utf-8'
      );
      await fs.writeFile(
        path.join(sonDir, `2026-11-10T12-00-00-000Z_${sheet}.json`),
        JSON.stringify(backupV3),
        'utf-8'
      );

      // Create corrupt primary file
      const filePath = getSheetFilePath(sheet);
      await fs.writeFile(filePath, '{broken json unclosed', 'utf-8');
      invalidateSheetCache(sheet);

      const recovered = await readSheetData<typeof backupV3>(sheet, {
        retries: 2,
        delay: 10,
        forceFresh: true,
      });

      // Must recover the latest backup (v3)
      expect(recovered).toEqual(backupV3);
      expect(recovered[0].version).toBe(3);
    });

    it('returns custom fallback or empty array cleanly when file does not exist (ENOENT)', async () => {
      const missingSheet = 'NON_EXISTENT_STRESS_SHEET';
      const resDefault = await readSheetData(missingSheet);
      expect(resDefault).toEqual([]);

      const customFallback = { fallback: true, mode: 'safe' };
      const resCustom = await readSheetData(missingSheet, { fallback: customFallback });
      expect(resCustom).toEqual(customFallback);
    });
  });

  // =========================================================================
  // 3. WINDOWS TEMP FILE ISOLATION & CLEANUP
  // =========================================================================
  describe('3. Windows Temp File Isolation & Cleanup', () => {
    it('leaves zero orphan .tmp files after 30 rapid concurrent atomic writes', async () => {
      const numWrites = 30;
      const writePromises = Array.from({ length: numWrites }, (_, idx) => {
        const filePath = path.join(stressDataDir, `rapid-atomic-${idx % 5}.json`);
        return safeWriteFile(filePath, JSON.stringify({ index: idx, payload: 'data' }));
      });

      await Promise.all(writePromises);

      // Scan directory for any leftover .tmp files
      const files = await fs.readdir(stressDataDir);
      const tmpFiles = files.filter((f) => f.endsWith('.tmp'));

      expect(tmpFiles).toHaveLength(0);
    });

    it('unlinks temp file when rename fails (simulated filesystem failure)', async () => {
      const targetFile = path.join(stressDataDir, 'fail-rename-test.json');
      const payload = JSON.stringify({ test: 'fail-rename' });

      // Spy on fs.rename to simulate a persistent Windows lock / EPERM failure
      const originalRename = fs.rename;
      const renameSpy = jest.spyOn(fs, 'rename').mockImplementation(async () => {
        const err = new Error('EBUSY: resource busy or locked, rename') as any;
        err.code = 'EBUSY';
        throw err;
      });

      try {
        await expect(safeWriteFile(targetFile, payload, 2, 10)).rejects.toThrow('EBUSY');

        // Check directory: the temp file must have been unlinked in catch block
        const dirFiles = await fs.readdir(stressDataDir);
        const orphanTmp = dirFiles.filter((f) => f.includes('fail-rename-test') && f.endsWith('.tmp'));
        expect(orphanTmp).toHaveLength(0);
      } finally {
        renameSpy.mockRestore();
      }
    });

    it('generates distinct temporary file names across concurrent writes to avoid collision', async () => {
      const targetFile = path.join(stressDataDir, 'collision-target.json');

      const interceptedTempPaths: string[] = [];
      const originalWriteFile = fs.writeFile;

      const writeSpy = jest.spyOn(fs, 'writeFile').mockImplementation(async (filePath, data, options) => {
        if (typeof filePath === 'string' && filePath.endsWith('.tmp')) {
          interceptedTempPaths.push(filePath);
        }
        return originalWriteFile(filePath, data, options);
      });

      try {
        const writes = Array.from({ length: 10 }, (_, i) =>
          safeWriteFile(targetFile, JSON.stringify({ writeIndex: i }))
        );
        await Promise.all(writes);

        // At least 10 writes attempted (plus any retry attempts due to Windows file collisions)
        expect(interceptedTempPaths.length).toBeGreaterThanOrEqual(10);
        // All concurrent writes must generate distinct temporary file names (zero temp collisions)
        const uniquePaths = new Set(interceptedTempPaths);
        expect(uniquePaths.size).toBe(10);
      } finally {
        writeSpy.mockRestore();
      }
    });
  });

  // =========================================================================
  // 4. GFS BACKUP PRUNING & CACHE CONSISTENCY
  // =========================================================================
  describe('4. GFS Backup Pruning Limits & In-Memory Cache Invalidation', () => {
    it('prunes Son tier strictly to <= 20 files after burst of 30 backups', async () => {
      const sheet = 'STRESS_PRUNING_BURST';
      const sonDir = getBackupDir(sheet);
      await fs.mkdir(sonDir, { recursive: true });

      // Pre-populate with 25 synthetic backups
      for (let i = 1; i <= 25; i++) {
        const timeStr = String(i).padStart(2, '0');
        const filename = `2026-11-10T00-00-${timeStr}-000Z_${sheet}.json`;
        await fs.writeFile(path.join(sonDir, filename), JSON.stringify({ i }), 'utf-8');
      }

      // Trigger a forced backup
      await backupSheet(sheet, { burst: 'trigger' }, { force: true });

      const files = (await fs.readdir(sonDir)).filter(
        (f) => f.endsWith('.json') && !f.endsWith('.tmp')
      );
      expect(files.length).toBeLessThanOrEqual(20);
    });

    it('enforces in-memory cache bypass when forceFresh is true or cache is invalidated', async () => {
      const sheet = 'STRESS_CACHE_CONSISTENCY';
      const initial = { state: 'cached-initial' };

      await writeSheetData(sheet, initial, { skipValidation: true, skipBackup: true });

      // Read: loads into cache
      const read1 = await readSheetData<typeof initial>(sheet);
      expect(read1.state).toBe('cached-initial');

      // Direct disk modification without calling writeSheetData
      const diskPath = getSheetFilePath(sheet);
      const modified = { state: 'disk-modified-directly' };
      await fs.writeFile(diskPath, JSON.stringify(modified), 'utf-8');

      // Read with forceFresh: true bypasses cache
      const freshRead = await readSheetData<typeof modified>(sheet, { forceFresh: true });
      expect(freshRead.state).toBe('disk-modified-directly');

      // Invalidate cache: normal read now returns fresh disk data
      invalidateSheetCache(sheet);
      const readAfterInvalidate = await readSheetData<typeof modified>(sheet);
      expect(readAfterInvalidate.state).toBe('disk-modified-directly');
    });
  });
});
