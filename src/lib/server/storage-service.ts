import { promises as fs } from 'fs';
import path from 'path';
import { getDomainSchema } from '@/lib/schemas';

export interface StorageOptions {
  dataDir?: string;
  backupDir?: string;
  retries?: number;
  retryDelayMs?: number;
  backupDebounceMs?: number;
  maxSonBackups?: number;
  maxFatherDailyBackups?: number;
  maxGrandfatherWeeklyBackups?: number;
}

export interface WriteResult {
  mtimeMs: number;
  size: number;
  recoveredFromBackup?: boolean;
}

export interface SheetCacheEntry<T = unknown> {
  data: T;
  mtimeMs: number;
  size: number;
}

export interface ReadSheetOptions<T = unknown> {
  knownMtimeMs?: number;
  forceFresh?: boolean;
  fallback?: T;
  retries?: number;
  delay?: number;
}

export interface WriteSheetOptions {
  skipValidation?: boolean;
  skipBackup?: boolean;
  retries?: number;
  delay?: number;
}

// Global In-Memory Cache
const apiCache = new Map<string, SheetCacheEntry<any>>();

// Global Lock Map
const resourceLocks = new Map<string, Promise<void>>();

// Backup Debounce Tracking
const lastBackupTimes = new Map<string, number>();

/**
 * Returns the effective data directory (supports VITAL_TEST_DATA_DIR for isolated testing).
 */
export function getDataDir(): string {
  return process.env.VITAL_TEST_DATA_DIR || path.join(process.cwd(), 'data');
}

/**
 * Resolves the absolute file path for a given sheet.
 */
export function getSheetFilePath(sheet: string): string {
  return path.join(getDataDir(), `${sheet}.json`);
}

/**
 * Resolves the backup directory for a given sheet and tier.
 */
export function getBackupDir(sheet?: string, tier?: 'daily' | 'weekly'): string {
  const base = path.join(getDataDir(), 'backups');
  if (tier === 'daily') {
    return sheet ? path.join(base, 'daily', sheet) : path.join(base, 'daily');
  }
  if (tier === 'weekly') {
    return sheet ? path.join(base, 'weekly', sheet) : path.join(base, 'weekly');
  }
  return sheet ? path.join(base, sheet) : base;
}

/**
 * Mutex lock execution for a given resource or sheet.
 * Serializes read-modify-write operations across concurrent requests to prevent race conditions.
 */
export async function withLock<T>(resourceId: string, fn: () => Promise<T>): Promise<T> {
  const previousLock = resourceLocks.get(resourceId) || Promise.resolve();
  let release: () => void;
  const currentLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  const newChainedLock = previousLock.catch(() => {}).then(() => currentLock);
  resourceLocks.set(resourceId, newChainedLock);

  try {
    await previousLock.catch(() => {});
    return await fn();
  } finally {
    release!();
    if (resourceLocks.get(resourceId) === newChainedLock) {
      resourceLocks.delete(resourceId);
    }
  }
}

/**
 * Low-level atomic file write with temporary file renaming and retry loops for Windows file locks.
 */
export async function safeWriteFile(
  filePath: string,
  dataStr: string,
  retries = 5,
  delay = 50
): Promise<void> {
  const dirPath = path.dirname(filePath);
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {}

  // 1. Windows file-lock collisions isolated using unique temp files per write request
  const tempFilePath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fs.writeFile(tempFilePath, dataStr, 'utf-8');

      // Retry loop specifically for renaming, in case files are briefly locked by read streams
      let renamed = false;
      for (let renameAttempt = 1; renameAttempt <= 3; renameAttempt++) {
        try {
          await fs.rename(tempFilePath, filePath);
          renamed = true;
          break;
        } catch (renameErr) {
          if (renameAttempt === 3) throw renameErr;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      if (renamed) return;
    } catch (err: any) {
      try {
        await fs.unlink(tempFilePath);
      } catch {}

      if (attempt === retries) {
        console.error(`[Storage Service] Write failed after ${retries} attempts for path ${filePath}:`, err);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Low-level safe file read with retry loops.
 */
export async function safeReadFile(
  filePath: string,
  retries = 5,
  delay = 50
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw err;
      }
      if (attempt === retries) {
        console.error(`[Storage Service] Read failed after ${retries} attempts for path ${filePath}:`, err);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`[Storage Service] Read failed for path ${filePath}`);
}

/**
 * ISO Week number calculation.
 */
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}

/**
 * Zod schema gatekeeper payload validation (O(N) validation for array or single object).
 */
export function validateDataPayload(sheet: string, data: unknown): boolean {
  const schema = getDomainSchema(sheet);
  if (!schema || typeof (schema as any).safeParse !== 'function') {
    return true;
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const parsed = (schema as any).safeParse(item);
      if (!parsed.success) {
        console.error(
          `[Zod Gatekeeper Error] Invalid data item in sheet ${sheet} at index ${i}:`,
          parsed.error.format()
        );
        return false;
      }
    }
    return true;
  }

  // Non-array data payload validation (e.g. single document)
  const parsed = (schema as any).safeParse(data);
  if (!parsed.success) {
    console.error(`[Zod Gatekeeper Error] Invalid data object in sheet ${sheet}:`, parsed.error.format());
    return false;
  }
  return true;
}

/**
 * Invalidate in-memory cache for a sheet, or clear all if no sheet provided.
 */
export function invalidateSheetCache(sheet?: string): void {
  if (sheet) {
    apiCache.delete(sheet);
  } else {
    apiCache.clear();
  }
}

/**
 * Read structured JSON data for a sheet with in-memory caching and self-healing backup recovery.
 */
export async function readSheetData<T = unknown>(
  sheet: string,
  options?: ReadSheetOptions<T>
): Promise<T> {
  const retries = options?.retries ?? 5;
  const delay = options?.delay ?? 50;
  const filePath = getSheetFilePath(sheet);

  let currentMtime = 0;
  if (typeof options?.knownMtimeMs === 'number') {
    if (options.knownMtimeMs === 0) {
      return (options?.fallback !== undefined ? options.fallback : ([] as unknown as T));
    }
    currentMtime = options.knownMtimeMs;
  } else {
    try {
      const stats = await fs.stat(filePath);
      currentMtime = stats.mtimeMs;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return (options?.fallback !== undefined ? options.fallback : ([] as unknown as T));
      }
    }
  }

  if (!options?.forceFresh && currentMtime > 0) {
    const cached = apiCache.get(sheet);
    if (cached && cached.mtimeMs === currentMtime) {
      return cached.data as T;
    }
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const raw = await safeReadFile(filePath, 1, delay);
      if (!raw.trim()) {
        throw new Error('File is empty');
      }
      const parsed = JSON.parse(raw);
      if (currentMtime > 0) {
        apiCache.set(sheet, {
          data: parsed,
          mtimeMs: currentMtime,
          size: Buffer.byteLength(raw, 'utf-8'),
        });
      }
      return parsed as T;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return (options?.fallback !== undefined ? options.fallback : ([] as unknown as T));
      }

      // If parsing fails due to incomplete writes (SyntaxError) or empty file, wait and retry.
      if (attempt === retries) {
        console.warn(
          `[Storage Service] Read failed for ${sheet} after ${retries} attempts. Attempting self-healing recovery from backups...`
        );
        try {
          const backupDir = getBackupDir(sheet);
          const files = await fs.readdir(backupDir);
          const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.endsWith('.tmp')).sort();
          if (jsonFiles.length > 0) {
            const latestBackupFile = path.join(backupDir, jsonFiles[jsonFiles.length - 1]);
            const backupData = await fs.readFile(latestBackupFile, 'utf-8');
            const parsed = JSON.parse(backupData);

            // Recover broken file with latest backup
            await safeWriteFile(filePath, backupData);
            console.info(
              `[Storage Service Self-Healing] Successfully recovered sheet ${sheet} from backup: ${jsonFiles[jsonFiles.length - 1]}`
            );
            apiCache.delete(sheet);
            return parsed as T;
          }
        } catch (recoveryErr) {
          console.error(
            `[Storage Service Self-Healing] Failed to recover sheet ${sheet} from backups:`,
            recoveryErr
          );
        }

        console.error(`[Storage Service] Read parsed failed for ${sheet} after ${retries} attempts:`, err);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`[Storage Service] Read parsed failed for ${sheet}`);
}

/**
 * 3-Tier GFS (Grandfather-Father-Son) Backup Rotation.
 * Tier 1 (Son): data/backups/${sheet} (max 20 files)
 * Tier 2 (Father): data/backups/daily/${sheet} (max 7 days)
 * Tier 3 (Grandfather): data/backups/weekly/${sheet} (max 4 weeks)
 */
export async function backupSheet(
  sheet: string,
  data: unknown,
  options?: { force?: boolean }
): Promise<void> {
  const nowMs = Date.now();
  const lastTime = lastBackupTimes.get(sheet) || 0;

  // Debounce: at most 1 backup write per sheet every 5 seconds, unless forced
  if (!options?.force && nowMs - lastTime < 5000) {
    return;
  }
  lastBackupTimes.set(sheet, nowMs);

  try {
    const dataStr = JSON.stringify(data, null, 2);
    const now = new Date();

    // 1. Son 백업 (최근 20개 변경 이력)
    const backupDir = getBackupDir(sheet);
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `${timestamp}_${sheet}.json`);

    await safeWriteFile(backupFile, dataStr);

    try {
      const files = await fs.readdir(backupDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.endsWith('.tmp')).sort();
      if (jsonFiles.length > 20) {
        const toDelete = jsonFiles.slice(0, jsonFiles.length - 20);
        for (const file of toDelete) {
          try {
            await fs.unlink(path.join(backupDir, file));
          } catch {}
        }
      }
    } catch {}

    // 2. Father 백업 (일별 아카이브 - 최대 7일 보존)
    const dailyDir = getBackupDir(sheet, 'daily');
    const dayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const dailyFile = path.join(dailyDir, `${dayStr}_${sheet}.json`);

    await safeWriteFile(dailyFile, dataStr);

    try {
      const dailyFiles = (await fs.readdir(dailyDir))
        .filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
        .sort();
      if (dailyFiles.length > 7) {
        const toDelete = dailyFiles.slice(0, dailyFiles.length - 7);
        for (const file of toDelete) {
          try {
            await fs.unlink(path.join(dailyDir, file));
          } catch {}
        }
      }
    } catch {}

    // 3. Grandfather 백업 (주별 아카이브 - 최대 4주 보존)
    const weeklyDir = getBackupDir(sheet, 'weekly');
    const weekNo = getWeekNumber(now);
    const weekStr = `${now.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    const weeklyFile = path.join(weeklyDir, `${weekStr}_${sheet}.json`);

    await safeWriteFile(weeklyFile, dataStr);

    try {
      const weeklyFiles = (await fs.readdir(weeklyDir))
        .filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
        .sort();
      if (weeklyFiles.length > 4) {
        const toDelete = weeklyFiles.slice(0, weeklyFiles.length - 4);
        for (const file of toDelete) {
          try {
            await fs.unlink(path.join(weeklyDir, file));
          } catch {}
        }
      }
    } catch {}
  } catch (backupErr) {
    console.error(`[Storage Service Backup] Failed to backup sheet ${sheet}:`, backupErr);
  }
}

/**
 * Write structured JSON data for a sheet with Zod validation, atomic rename, cache update, and 3-tier backup.
 */
export async function writeSheetData<T = unknown>(
  sheet: string,
  data: T,
  options?: WriteSheetOptions
): Promise<WriteResult> {
  // 1. Zod 유효성 검사 적용 (무결성 깨진 데이터 디스크 쓰기 방지)
  if (!options?.skipValidation && !validateDataPayload(sheet, data)) {
    throw new Error(`[Zod validation failed] Data structure is invalid for sheet: ${sheet}`);
  }

  const filePath = getSheetFilePath(sheet);
  const dataStr = JSON.stringify(data, null, 2);

  // 2. 직접 안전 파일 쓰기 (재시도 및 임시파일 원자적 rename)
  await safeWriteFile(filePath, dataStr, options?.retries, options?.delay);

  // 3. 캐시 메모리 직렬화 업데이트 (디스크 재읽기 및 중복 fs.stat 방지)
  let mtimeMs = 0;
  let size = 0;
  try {
    const stats = await fs.stat(filePath);
    mtimeMs = stats.mtimeMs;
    size = stats.size;
    apiCache.set(sheet, { data, mtimeMs, size });
  } catch {
    apiCache.delete(sheet);
  }

  // 4. Trigger backup asynchronously in background so response latency is 0ms
  if (!options?.skipBackup) {
    backupSheet(sheet, data).catch((err) =>
      console.error(`[Storage Service Backup Error] Sheet: ${sheet}:`, err)
    );
  }

  return { mtimeMs, size };
}
