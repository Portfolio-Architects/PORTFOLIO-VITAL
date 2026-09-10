// Mock next/server to bypass Next.js server-side loading issues in JSDOM
jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: jest.fn().mockImplementation((body, init) => {
        return {
          status: init?.status || 200,
          json: async () => body,
        };
      }),
    },
  };
});

import { withSheetLock, POST, GET } from '@/app/api/data/route';
import { promises as fs } from 'fs';
import path from 'path';

function createPostRequest(body: any): any {
  return {
    url: 'http://localhost:3001/api/data',
    json: async () => body,
  };
}

function createGetRequest(url: string): any {
  return {
    url,
  };
}

describe('Milestone M1 Concurrency & Persistence Empirical Challenger', () => {
  jest.setTimeout(30000);

  const BASE_SHEET = `WIKI_DOC_test_m1_${Date.now()}`;

  const cleanSheet = async (sheet: string) => {
    const filePath = path.join(process.cwd(), 'data', `${sheet}.json`);
    try {
      await fs.unlink(filePath);
    } catch {}
    try {
      const dir = path.join(process.cwd(), 'data');
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.startsWith(sheet) && file.endsWith('.tmp')) {
          await fs.unlink(path.join(dir, file));
        }
      }
    } catch {}
  };

  afterAll(async () => {
    try {
      const dir = path.join(process.cwd(), 'data');
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.startsWith('WIKI_DOC_test_m1_') || file.startsWith('WIKI_DOC_stress_test_')) {
          await fs.unlink(path.join(dir, file));
        }
      }
    } catch {}
  });

  // ----------------------------------------------------
  // SECTION 1: withSheetLock Mutex Serialization Tests
  // ----------------------------------------------------
  describe('1. withSheetLock Concurrency & Serialization', () => {
    it('serializes 50 concurrent async tasks on the same sheet with zero overlapping execution', async () => {
      let activeExecutions = 0;
      let maxSimultaneous = 0;
      const executionOrder: number[] = [];

      const tasks = Array.from({ length: 50 }, (_, i) => async () => {
        return withSheetLock('TEST_MUTEX_SERIAL', async () => {
          activeExecutions++;
          if (activeExecutions > maxSimultaneous) {
            maxSimultaneous = activeExecutions;
          }

          // Artificial async work
          await new Promise((resolve) => setTimeout(resolve, 5));

          executionOrder.push(i);
          activeExecutions--;
          return i;
        });
      });

      const results = await Promise.all(tasks.map((t) => t()));

      expect(results).toHaveLength(50);
      expect(maxSimultaneous).toBe(1); // Crucial: At no point were 2 tasks active simultaneously!
      expect(activeExecutions).toBe(0);
      expect(executionOrder).toHaveLength(50);
    });

    it('recovers cleanly and does not deadlock subsequent queue items when an error is thrown', async () => {
      const order: string[] = [];

      const p1 = withSheetLock('TEST_ERROR_QUEUE', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        order.push('task1');
        throw new Error('Task 1 deliberate failure');
      });

      const p2 = withSheetLock('TEST_ERROR_QUEUE', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        order.push('task2');
        return 'task2-ok';
      });

      const p3 = withSheetLock('TEST_ERROR_QUEUE', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        order.push('task3');
        return 'task3-ok';
      });

      await expect(p1).rejects.toThrow('Task 1 deliberate failure');
      const res2 = await p2;
      const res3 = await p3;

      expect(res2).toBe('task2-ok');
      expect(res3).toBe('task3-ok');
      expect(order).toEqual(['task1', 'task2', 'task3']);
    });

    it('allows concurrent operations across different sheets without cross-blocking', async () => {
      const timestamps: { sheet: string; start: number; end: number }[] = [];

      const taskA = withSheetLock('SHEET_CONCUR_A', async () => {
        const start = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 150));
        const end = Date.now();
        timestamps.push({ sheet: 'SHEET_CONCUR_A', start, end });
      });

      const taskB = withSheetLock('SHEET_CONCUR_B', async () => {
        const start = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const end = Date.now();
        timestamps.push({ sheet: 'SHEET_CONCUR_B', start, end });
      });

      await Promise.all([taskA, taskB]);

      const finishA = timestamps.find((t) => t.sheet === 'SHEET_CONCUR_A')!;
      const finishB = timestamps.find((t) => t.sheet === 'SHEET_CONCUR_B')!;

      expect(finishB.end).toBeLessThan(finishA.end);
    });
  });

  // ----------------------------------------------------
  // SECTION 2: Rapid Concurrent Mutation Requests (POST)
  // ----------------------------------------------------
  describe('2. End-to-End Concurrent Disk Persistence & Race Condition Clobbering', () => {
    it('persists all 30 concurrent ADD requests without dropping or clobbering any rows', async () => {
      const sheet = `${BASE_SHEET}_adds`;
      const filePath = path.join(process.cwd(), 'data', `${sheet}.json`);
      await cleanSheet(sheet);

      // Initialize the test sheet with empty array
      const initReq = createPostRequest({
        sheet,
        action: 'replace',
        data: [],
      });
      const initRes = await POST(initReq);
      const initJson = await initRes.json();
      expect(initJson.success).toBe(true);

      // Fire 30 rapid concurrent ADD requests
      const addRequests = Array.from({ length: 30 }, (_, i) => {
        const item = {
          id: `item-${i + 1}`,
          title: `Concurrent Item ${i + 1}`,
          order: i + 1,
          createdAt: new Date().toISOString(),
        };

        const req = createPostRequest({
          sheet,
          action: 'add',
          data: item,
        });
        return POST(req);
      });

      const responses = await Promise.all(addRequests);

      for (const res of responses) {
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
      }

      // Read directly from disk
      const diskContent = await fs.readFile(filePath, 'utf-8');
      const diskData = JSON.parse(diskContent);

      expect(Array.isArray(diskData)).toBe(true);
      expect(diskData).toHaveLength(30);

      // Verify every single ID exists (ZERO clobbering)
      const diskIds = diskData.map((d: any) => d.id).sort();
      const expectedIds = Array.from({ length: 30 }, (_, i) => `item-${i + 1}`).sort();
      expect(diskIds).toEqual(expectedIds);

      // Verify via GET handler
      const getReq = createGetRequest(`http://localhost:3001/api/data?sheet=${sheet}`);
      const getRes = await GET(getReq);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(true);
      expect(getJson.data).toHaveLength(30);

      await cleanSheet(sheet);
    });

    it('safely handles interleaved concurrent ADD, UPDATE, and DELETE operations', async () => {
      const sheet = `${BASE_SHEET}_interleaved`;
      const filePath = path.join(process.cwd(), 'data', `${sheet}.json`);
      await cleanSheet(sheet);

      // 1. Pre-seed 10 items
      const seedItems = Array.from({ length: 10 }, (_, i) => ({
        id: `seed-${i}`,
        title: `Original Title ${i}`,
        counter: 0,
      }));

      const seedReq = createPostRequest({
        sheet,
        action: 'replace',
        data: seedItems,
      });
      await POST(seedReq);

      // 2. Interleave:
      // - 10 Adds (new-0 to new-9)
      // - 5 Updates on seed items (seed-0 to seed-4)
      // - 3 Deletes on seed items (seed-7, seed-8, seed-9)
      const operations: Promise<any>[] = [];

      for (let i = 0; i < 10; i++) {
        operations.push(
          POST(
            createPostRequest({
              sheet,
              action: 'add',
              data: { id: `new-${i}`, title: `Added ${i}`, counter: 100 + i },
            })
          )
        );
      }

      for (let i = 0; i < 5; i++) {
        operations.push(
          POST(
            createPostRequest({
              sheet,
              action: 'update',
              id: `seed-${i}`,
              data: { title: `Updated Title ${i}`, counter: 999 },
            })
          )
        );
      }

      for (let i = 7; i < 10; i++) {
        operations.push(
          POST(
            createPostRequest({
              sheet,
              action: 'delete',
              id: `seed-${i}`,
            })
          )
        );
      }

      // Shuffle the execution order
      const shuffled = operations.sort(() => Math.random() - 0.5);
      const results = await Promise.all(shuffled);

      for (const res of results) {
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
      }

      // Read from disk
      const finalContent = await fs.readFile(filePath, 'utf-8');
      const finalData = JSON.parse(finalContent);

      expect(finalData).toHaveLength(17);

      for (let i = 0; i < 10; i++) {
        const found = finalData.find((d: any) => d.id === `new-${i}`);
        expect(found).toBeDefined();
        expect(found.title).toBe(`Added ${i}`);
      }

      for (let i = 0; i < 5; i++) {
        const found = finalData.find((d: any) => d.id === `seed-${i}`);
        expect(found).toBeDefined();
        expect(found.title).toBe(`Updated Title ${i}`);
        expect(found.counter).toBe(999);
      }

      for (let i = 7; i < 10; i++) {
        const found = finalData.find((d: any) => d.id === `seed-${i}`);
        expect(found).toBeUndefined();
      }

      await cleanSheet(sheet);
    });

    it('ensures safe atomic writes with no corrupt JSON or orphaned temp files during rapid bursts', async () => {
      const sheet = `${BASE_SHEET}_burst`;
      const filePath = path.join(process.cwd(), 'data', `${sheet}.json`);
      await cleanSheet(sheet);

      const burstWrites = Array.from({ length: 20 }, (_, i) => {
        const req = createPostRequest({
          sheet,
          action: 'replace',
          data: Array.from({ length: 50 }, (__, j) => ({
            id: `burst-${i}-${j}`,
            val: `content-${i}-${j}`,
            timestamp: Date.now(),
          })),
        });
        return POST(req);
      });

      await Promise.all(burstWrites);

      // Verify disk file is valid JSON
      const content = await fs.readFile(filePath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
      const parsed = JSON.parse(content);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(50);

      // Verify no orphaned .tmp files remain in data/
      const dataDir = path.join(process.cwd(), 'data');
      const files = await fs.readdir(dataDir);
      const orphanedTmp = files.filter(
        (f) => f.startsWith(sheet) && f.endsWith('.tmp')
      );
      expect(orphanedTmp).toHaveLength(0);

      await cleanSheet(sheet);
    });
  });
});
