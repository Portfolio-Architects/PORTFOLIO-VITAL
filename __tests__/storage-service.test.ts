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

describe('Storage Service Unit Tests (원자적 쓰기, 뮤텍스 락, 3단계 백업 및 자가치유)', () => {
  const testDataDir = path.join(
    os.tmpdir(),
    `vital-storage-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  );

  beforeAll(async () => {
    process.env.VITAL_TEST_DATA_DIR = testDataDir;
    await fs.mkdir(testDataDir, { recursive: true });
  });

  afterAll(async () => {
    delete process.env.VITAL_TEST_DATA_DIR;
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    invalidateSheetCache();
  });

  describe('1. Mutex Queue & Serialization (withLock)', () => {
    it('serializes 20 concurrent tasks on the same resourceId with zero race conditions', async () => {
      const resource = 'RESOURCE_SERIAL_TEST';
      let activeExecutions = 0;
      let maxConcurrent = 0;
      const executionOrder: number[] = [];

      const tasks = Array.from({ length: 20 }, (_, i) =>
        withLock(resource, async () => {
          activeExecutions++;
          maxConcurrent = Math.max(maxConcurrent, activeExecutions);
          await new Promise((resolve) => setTimeout(resolve, 10));
          executionOrder.push(i);
          activeExecutions--;
          return i;
        })
      );

      const results = await Promise.all(tasks);

      expect(results).toHaveLength(20);
      expect(maxConcurrent).toBe(1); // Strict serialization: at most 1 task active at any time
      expect(executionOrder).toHaveLength(20);
    });

    it('does not deadlock or stall queue when an in-flight task throws an error', async () => {
      const resource = 'RESOURCE_ERROR_TEST';
      const results: string[] = [];

      const task1 = withLock(resource, async () => {
        results.push('task1-start');
        throw new Error('Intentional task1 failure');
      }).catch((err) => err.message);

      const task2 = withLock(resource, async () => {
        results.push('task2-success');
        return 'task2-ok';
      });

      const task3 = withLock(resource, async () => {
        results.push('task3-success');
        return 'task3-ok';
      });

      const [res1, res2, res3] = await Promise.all([task1, task2, task3]);

      expect(res1).toBe('Intentional task1 failure');
      expect(res2).toBe('task2-ok');
      expect(res3).toBe('task3-ok');
      expect(results).toEqual(['task1-start', 'task2-success', 'task3-success']);
    });

    it('allows concurrent tasks on different resourceIds without cross-blocking', async () => {
      const startTime = Date.now();

      const taskA = withLock('SHEET_ALPHA', async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return 'alpha';
      });

      const taskB = withLock('SHEET_BETA', async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return 'beta';
      });

      const [resA, resB] = await Promise.all([taskA, taskB]);
      const duration = Date.now() - startTime;

      expect(resA).toBe('alpha');
      expect(resB).toBe('beta');
      // If serialized, duration >= 120ms. In parallel, duration < 110ms.
      expect(duration).toBeLessThan(120);
    });
  });

  describe('2. Low-Level Atomic File Operations (safeWriteFile & safeReadFile)', () => {
    it('writes content atomically without leaving orphan temp files', async () => {
      const filePath = path.join(testDataDir, 'atomic-test.txt');
      const payload = 'VITAL Universal Persistence SSOT Content';

      await safeWriteFile(filePath, payload);

      const readBack = await safeReadFile(filePath);
      expect(readBack).toBe(payload);

      // Verify no orphan .tmp files remain in the folder
      const dirFiles = await fs.readdir(testDataDir);
      const tmpFiles = dirFiles.filter((f) => f.includes('atomic-test.txt') && f.endsWith('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('throws ENOENT immediately when reading a non-existent file', async () => {
      const nonExistentPath = path.join(testDataDir, 'does-not-exist.json');
      await expect(safeReadFile(nonExistentPath)).rejects.toThrow();
    });
  });

  describe('3. Structured JSON Sheet Operations (readSheetData & writeSheetData)', () => {
    it('returns fallback or empty array without error when sheet does not exist', async () => {
      const emptyResult = await readSheetData('UNCREATED_SHEET');
      expect(emptyResult).toEqual([]);

      const customFallback = await readSheetData('ANOTHER_UNCREATED_SHEET', {
        fallback: { status: 'empty' },
      });
      expect(customFallback).toEqual({ status: 'empty' });
    });

    it('writes and reads structured JSON data accurately with in-memory caching', async () => {
      const sheet = 'CUSTOM_TEST_DATA';
      const initialData = [
        { id: 'item-1', name: 'Item One', val: 100 },
        { id: 'item-2', name: 'Item Two', val: 200 },
      ];

      const writeRes = await writeSheetData(sheet, initialData, { skipValidation: true });
      expect(writeRes.mtimeMs).toBeGreaterThan(0);
      expect(writeRes.size).toBeGreaterThan(0);

      // First read: reads from disk, caches in memory
      const read1 = await readSheetData<typeof initialData>(sheet);
      expect(read1).toEqual(initialData);

      // Mutate file on disk directly without updating cache
      const diskPath = getSheetFilePath(sheet);
      await fs.writeFile(
        diskPath,
        JSON.stringify([{ id: 'hacked', name: 'Direct write' }]),
        'utf-8'
      );

      // Second read with matching mtimeMs: returns cached data
      const readCached = await readSheetData<typeof initialData>(sheet, {
        knownMtimeMs: writeRes.mtimeMs,
      });
      expect(readCached).toEqual(initialData);

      // Invalidate cache: forces disk re-read
      invalidateSheetCache(sheet);
      const readFresh = await readSheetData(sheet);
      expect(readFresh).toEqual([{ id: 'hacked', name: 'Direct write' }]);
    });

    it('supports writing and reading structured object payloads (such as Festival SSOT)', async () => {
      const sheet = 'TEST_FESTIVAL_OBJECT';
      const festivalPayload = {
        meta: {
          title: '2026 양재천 페스티벌',
          overallProgress: 100,
        },
        booths: [
          { id: 'booth-1', title: '체험 부스 A' },
        ],
      };

      await writeSheetData(sheet, festivalPayload, { skipValidation: true });
      const readBack = await readSheetData<typeof festivalPayload>(sheet);

      expect(readBack).toEqual(festivalPayload);
      expect(readBack.meta.title).toBe('2026 양재천 페스티벌');
    });

    it('enforces Zod gatekeeper validation on invalid data items for domain sheets', async () => {
      // Primitive in object array fails top-level z.object
      const invalidTasks = ['not-an-object' as any];

      await expect(
        writeSheetData('TASKS', invalidTasks)
      ).rejects.toThrow(/\[Zod validation failed\]/);
    });
  });

  describe('4. 3-Tier GFS Backup Rotation (backupSheet)', () => {
    it('creates Son, Father (daily), and Grandfather (weekly) backups and prunes Son tier', async () => {
      const sheet = 'BACKUP_ROTATION_TEST';
      const sampleData = [{ id: 'record-1', value: 'backup-v1' }];

      // Force create backup
      await backupSheet(sheet, sampleData, { force: true });

      // Verify Son directory
      const sonDir = getBackupDir(sheet);
      const sonFiles = (await fs.readdir(sonDir)).filter(
        (f) => f.endsWith('.json') && !f.endsWith('.tmp')
      );
      expect(sonFiles.length).toBeGreaterThanOrEqual(1);

      // Verify Father directory
      const dailyDir = getBackupDir(sheet, 'daily');
      const dailyFiles = (await fs.readdir(dailyDir)).filter(
        (f) => f.endsWith('.json') && !f.endsWith('.tmp')
      );
      expect(dailyFiles.length).toBeGreaterThanOrEqual(1);

      // Verify Grandfather directory
      const weeklyDir = getBackupDir(sheet, 'weekly');
      const weeklyFiles = (await fs.readdir(weeklyDir)).filter(
        (f) => f.endsWith('.json') && !f.endsWith('.tmp')
      );
      expect(weeklyFiles.length).toBeGreaterThanOrEqual(1);

      // Test Son pruning: synthesize 25 backup files in sonDir
      for (let i = 1; i <= 25; i++) {
        const dummyName = `2026-11-10T12-00-${String(i).padStart(2, '0')}-000Z_${sheet}.json`;
        await fs.writeFile(path.join(sonDir, dummyName), JSON.stringify({ index: i }));
      }

      // Trigger backup which executes pruning
      await backupSheet(sheet, sampleData, { force: true });

      const prunedSonFiles = (await fs.readdir(sonDir)).filter(
        (f) => f.endsWith('.json') && !f.endsWith('.tmp')
      );
      // Max Son backups is 20
      expect(prunedSonFiles.length).toBeLessThanOrEqual(20);
    });
  });

  describe('5. Self-Healing Recovery from Backups', () => {
    it('automatically recovers corrupt sheet file from backup on read failure', async () => {
      const sheet = 'SELF_HEALING_TEST';
      const goodData = [{ id: 'good-1', name: 'Golden Master Data' }];

      // 1. Write valid data and ensure backup is created
      await writeSheetData(sheet, goodData, { skipValidation: true, skipBackup: false });
      await backupSheet(sheet, goodData, { force: true });

      // 2. Clear cache and corrupt the primary file with invalid JSON syntax
      invalidateSheetCache(sheet);
      const filePath = getSheetFilePath(sheet);
      await fs.writeFile(filePath, '<<<CORRUPT-BROKEN-NON-JSON-DATA>>>', 'utf-8');

      // 3. readSheetData should catch SyntaxError, locate latest backup, restore the primary file, and return good data!
      const recoveredData = await readSheetData<typeof goodData>(sheet, {
        retries: 2,
        delay: 10,
        forceFresh: true,
      });

      expect(recoveredData).toEqual(goodData);

      // 4. Verify disk file was restored and is now valid JSON
      const repairedContent = await fs.readFile(filePath, 'utf-8');
      const parsedRepaired = JSON.parse(repairedContent);
      expect(parsedRepaired).toEqual(goodData);
    });
  });
});
