import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getDomainSchema } from '@/lib/schemas';
import { RAGEngine } from '@/lib/rag/rag-engine';
// 바탕화면 실시간 파일 감시 및 자동 파싱 데몬이 수기 마인드맵 전환에 따라 비활성화되었습니다.

// Allowed sheets
const ALLOWED_SHEETS = new Set([
  'TASKS', 'MEETINGS', 'PROJECTS',
  'BUDGET_CATEGORIES', 'BUDGET_ENTRIES',
  'BUDGET_SIMULATIONS',
  'INVENTORY', 'STOCK_CHANGES',
  'SIGNAL_LOG',
  'MAP_CUSTOMIZATION',
  'PLANNING_MAP_CUSTOMIZATION',
  'DELETED_SIGNALS', 'GLOBAL_TOMBSTONES',
  'EXTERNAL_DOCS',
  'CLASSIFICATION_WORDS',
  'SCHEDULES',
  'CONTACTS'
]);

function validateSheet(sheet: string): boolean {
  return ALLOWED_SHEETS.has(sheet) || sheet.startsWith('WIKI_DOC_');
}

function getFilePath(sheet: string): string {
  // Use process.cwd() so it works regardless of where the app is run from
  return path.join(process.cwd(), 'data', `${sheet}.json`);
}

async function safeWriteFile(filePath: string, dataStr: string, retries = 5, delay = 50): Promise<void> {
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
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      if (renamed) return;
    } catch (err: any) {
      try {
        await fs.unlink(tempFilePath);
      } catch {}

      if (attempt === retries) {
        console.error(`[File System] Write failed after ${retries} attempts for path ${filePath}:`, err);
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function safeReadFile(filePath: string, retries = 5, delay = 50): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw err;
      }
      if (attempt === retries) {
        console.error(`[File System] Read failed after ${retries} attempts for path ${filePath}:`, err);
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`[File System] Read failed for path ${filePath}`);
}

interface CacheEntry {
  data: any[];
  mtimeMs: number;
}
const apiCache = new Map<string, CacheEntry>();

async function readData(sheet: string, retries = 5, delay = 50): Promise<any[]> {
  const filePath = getFilePath(sheet);
  
  let currentMtime = 0;
  try {
    const stats = await fs.stat(filePath);
    currentMtime = stats.mtimeMs;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return [];
    }
  }

  if (currentMtime > 0) {
    const cached = apiCache.get(sheet);
    if (cached && cached.mtimeMs === currentMtime) {
      return cached.data;
    }
  }
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const data = await safeReadFile(filePath);
      // Empty string denotes split-second read during file truncation. Force retry.
      if (!data.trim()) {
        throw new Error('File is empty');
      }
      const parsed = JSON.parse(data);
      if (sheet === 'BUDGET_CATEGORIES') {
        console.log(`[API] Returning ${parsed.length} categories for BUDGET_CATEGORIES!`);
      }
      if (currentMtime > 0) {
        apiCache.set(sheet, { data: parsed, mtimeMs: currentMtime });
      }
      return parsed;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      // If parsing fails due to incomplete writes (SyntaxError) or empty file, wait and retry.
      if (attempt === retries) {
        console.warn(`[API] Read parsed failed for ${sheet} after all attempts. Trying Self-Healing recovery from backups...`);
        try {
          const backupDir = path.join(process.cwd(), 'data', 'backups', sheet);
          const files = await fs.readdir(backupDir);
          const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).sort();
          if (jsonFiles.length > 0) {
            const latestBackupFile = path.join(backupDir, jsonFiles[jsonFiles.length - 1]);
            const backupData = await fs.readFile(latestBackupFile, 'utf-8');
            const parsed = JSON.parse(backupData);
            
            // 깨진 원본 파일을 백업본으로 복원
            await safeWriteFile(filePath, backupData);
            console.info(`[API Self-Healing] Successfully recovered sheet ${sheet} from backup: ${jsonFiles[jsonFiles.length - 1]}`);
            apiCache.delete(sheet);
            return parsed;
          }
        } catch (recoveryErr) {
          console.error(`[API Self-Healing] Failed to recover sheet ${sheet} from backups:`, recoveryErr);
        }

        console.error(`[API] Read parsed failed for ${sheet} after ${retries} attempts:`, err);
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`[API] Read parsed failed for ${sheet}`);
}


// ISO 주차(Week Number) 구하기 함수
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

// Zod 스키마 게이트키퍼 유효성 검증 함수
function validateDataPayload(sheet: string, data: any[]): boolean {
  const schema = getDomainSchema(sheet);
  
  if (schema && typeof (schema as any).safeParse === 'function') {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const parsed = (schema as any).safeParse(item);
      if (!parsed.success) {
        console.error(`[Zod Gatekeeper Error] Invalid data item in sheet ${sheet} at index ${i}:`, parsed.error.format());
        return false;
      }
    }
  }
  return true;
}

const lastBackupTimes = new Map<string, number>();

async function backupDataFile(sheet: string, data: any[]): Promise<void> {
  const nowMs = Date.now();
  const lastTime = lastBackupTimes.get(sheet) || 0;
  // Debounce: at most 1 backup write per sheet every 5 seconds
  if (nowMs - lastTime < 5000) {
    return;
  }
  lastBackupTimes.set(sheet, nowMs);

  try {
    const dataStr = JSON.stringify(data, null, 2);
    const now = new Date();

    // 1. Son 백업 (최근 20개 변경 이력)
    const backupDir = path.join(process.cwd(), 'data', 'backups', sheet);
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `${timestamp}_${sheet}.json`);
    
    await safeWriteFile(backupFile, dataStr);
    
    // Prune old backups (keep only the 20 most recent)
    try {
      const files = await fs.readdir(backupDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).sort();
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
    const dailyDir = path.join(process.cwd(), 'data', 'backups', 'daily', sheet);
    const dayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dailyFile = path.join(dailyDir, `${dayStr}_${sheet}.json`);
    
    await safeWriteFile(dailyFile, dataStr);
    
    try {
      const dailyFiles = (await fs.readdir(dailyDir)).filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).sort();
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
    const weeklyDir = path.join(process.cwd(), 'data', 'backups', 'weekly', sheet);
    const weekNo = getWeekNumber(now);
    const weekStr = `${now.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    const weeklyFile = path.join(weeklyDir, `${weekStr}_${sheet}.json`);
    
    await safeWriteFile(weeklyFile, dataStr);
    
    try {
      const weeklyFiles = (await fs.readdir(weeklyDir)).filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).sort();
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
    console.error(`[Backup] Failed to backup sheet ${sheet}:`, backupErr);
  }
}

async function writeDataToFile(sheet: string, data: any[]): Promise<void> {
  // 1. Zod 유효성 검사 적용 (무결성 깨진 데이터 디스크 쓰기 방지)
  if (!validateDataPayload(sheet, data)) {
    throw new Error(`[Zod validation failed] Data structure is invalid for sheet: ${sheet}`);
  }

  const filePath = getFilePath(sheet);
  const dataStr = JSON.stringify(data, null, 2);
  
  // 2. 직접 안전 파일 쓰기 (재시도 및 지연 내장)
  await safeWriteFile(filePath, dataStr);
  
  // 캐시 메모리 직렬화 업데이트 (디스크 재읽기 방지)
  try {
    const stats = await fs.stat(filePath);
    apiCache.set(sheet, { data, mtimeMs: stats.mtimeMs });
  } catch {
    apiCache.delete(sheet);
  }
  
  // Trigger backup asynchronously in background so client response is instant (0ms) and not blocked by disk IO
  backupDataFile(sheet, data).catch(err => console.error('[Backup Error]:', err));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sheet = searchParams.get('sheet');
  const metaOnly = searchParams.get('meta') === 'true';

  if (!sheet) {
    return NextResponse.json({ success: false, error: 'Missing sheet parameter' }, { status: 400 });
  }

  if (!validateSheet(sheet)) {
    return NextResponse.json({ success: false, error: 'Invalid sheet name' }, { status: 400 });
  }

  try {
    const filePath = getFilePath(sheet);
    let stats: { mtimeMs: number; size: number };
    try {
      const fsStats = await fs.stat(filePath);
      stats = { mtimeMs: fsStats.mtimeMs, size: fsStats.size };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        stats = { mtimeMs: 0, size: 0 };
      } else {
        throw err;
      }
    }

    if (metaOnly) {
      return NextResponse.json({
        success: true,
        data: {
          mtime: stats.mtimeMs,
          size: stats.size
        }
      });
    }

    const clientMtime = Number(searchParams.get('clientMtime') || '0');
    const clientSize = Number(searchParams.get('clientSize') || '0');

    if (clientMtime && clientSize && clientMtime === stats.mtimeMs && clientSize === stats.size) {
      return NextResponse.json({ success: true, notModified: true, mtime: stats.mtimeMs, size: stats.size });
    }

    const data = await readData(sheet);
    return NextResponse.json({ success: true, data, mtime: stats.mtimeMs, size: stats.size });
  } catch (e) {
    console.error(`[API GET Error] Failed to read data for sheet ${sheet}:`, e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

// Async in-memory mutex queue per sheet to serialize read-modify-write cycles and prevent race conditions
const sheetLocks = new Map<string, Promise<void>>();

export async function withSheetLock<T>(sheet: string, fn: () => Promise<T>): Promise<T> {
  const previousLock = sheetLocks.get(sheet) || Promise.resolve();
  let release: () => void;
  const currentLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  const newChainedLock = previousLock.catch(() => {}).then(() => currentLock);
  sheetLocks.set(sheet, newChainedLock);

  try {
    await previousLock.catch(() => {});
    return await fn();
  } finally {
    release!();
    if (sheetLocks.get(sheet) === newChainedLock) {
      sheetLocks.delete(sheet);
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sheet, action, data, id } = body;

    if (!sheet || !action) {
      return NextResponse.json({ success: false, error: 'Missing sheet or action' }, { status: 400 });
    }

    if (!validateSheet(sheet)) {
      return NextResponse.json({ success: false, error: 'Invalid sheet name' }, { status: 400 });
    }

    return await withSheetLock(sheet, async () => {
      let rows: any[] = [];
      if (action !== 'replace') {
        rows = await readData(sheet);
      }

    if (sheet === 'BUDGET_ENTRIES' && (action === 'add' || action === 'update')) {
      const categories = await readData('BUDGET_CATEGORIES');
      
      let tempRows = [...rows];
      if (action === 'add') {
        tempRows.push(data);
      } else if (action === 'update') {
        const idx = tempRows.findIndex((r: any) => r.id === id);
        if (idx !== -1) {
          tempRows[idx] = { ...tempRows[idx], ...data };
        }
      }

      const targetEntry = action === 'add' ? data : tempRows.find((r: any) => r.id === id);
      // E2EE support: if the payload is encrypted (no categoryId in plaintext), skip server-side budget validation
      if (targetEntry && targetEntry.categoryId) {
        const categoryId = targetEntry.categoryId;
        const cat = categories.find((c: any) => c.id === categoryId);
        
        if (!cat) {
          return NextResponse.json({ success: false, error: 'Invalid category ID' }, { status: 400 });
        }

        const actionType = targetEntry.actionType || 'general';

        if (actionType !== 'transfer' && actionType !== 'correction') {
          const catEntries = tempRows.filter((e: any) => e.categoryId === categoryId);
          
          let lockedAmount = 0;
          if (cat.subItems) {
            cat.subItems.forEach((sub: any) => {
              if (sub.isLocked) {
                lockedAmount += sub.amount;
              } else if (sub.calculations) {
                sub.calculations.forEach((calc: any) => {
                  if (calc.isLocked) lockedAmount += calc.amount;
                });
              }
            });
          }

          const linkedSubItemId = targetEntry.linkedSubItemId;
          if (linkedSubItemId && actionType !== 'settle') {
            let targetSubItem: any = cat.subItems?.find((s: any) => s.id === linkedSubItemId);
            if (!targetSubItem) {
              targetSubItem = cat.subItems?.flatMap((s: any) => s.calculations || []).find((c: any) => c.id === linkedSubItemId);
            }

            if (targetSubItem) {
              const isSelfLocked = targetSubItem.isLocked;
              let isParentLocked = false;
              const parentSub = cat.subItems?.find((s: any) => s.calculations?.some((c: any) => c.id === linkedSubItemId));
              if (parentSub && parentSub.isLocked) isParentLocked = true;

              if (isSelfLocked || isParentLocked) {
                return NextResponse.json({
                  success: false,
                  error: `[잠금 상태] 선택한 산출내역은 예산 지출이 방지(잠금)되어 있습니다.`
                }, { status: 409 });
              }

              const subLimit = targetSubItem.amount;
              if (subLimit > 0) {
                const linkedEntries = catEntries.filter((en: any) => en.linkedSubItemId === linkedSubItemId && en.actionType !== 'settle');
                const newUsage = linkedEntries.reduce((sum: number, en: any) => {
                  if (en.actionType === 'correction') return sum + en.amount;
                  if (en.actionType === 'transfer') return sum - en.amount;
                  return sum + en.amount;
                }, 0);

                if (newUsage > subLimit) {
                  return NextResponse.json({
                    success: false,
                    error: `[산출내역 한도 초과] 선택한 산출내역의 한도(${subLimit.toLocaleString()}원)를 초과하여 등록을 차단합니다. (누적 계산액: ${newUsage.toLocaleString()}원)`
                  }, { status: 409 });
                }
              }
            }
          }

          const dailyExpenseIssued = catEntries.filter((e: any) => !e.isPlanned && e.actionType === 'issuance').reduce((sum: number, e: any) => sum + e.amount, 0);
          const dailyExpenseSpent = catEntries.filter((e: any) => !e.isPlanned && e.actionType === 'daily_expense').reduce((sum: number, e: any) => sum + e.amount, 0);
          
          if (actionType === 'daily_expense') {
            if (dailyExpenseSpent > dailyExpenseIssued) {
              return NextResponse.json({
                success: false,
                error: `[일상경비 한도 초과] 일상경비 교부 잔액을 초과하여 등록을 차단합니다.`
              }, { status: 409 });
            }
          }

          if (actionType !== 'settle' && actionType !== 'daily_expense') {
            const generalSpent = catEntries.filter((e: any) => !e.isPlanned && (!e.actionType || e.actionType === 'general' || e.actionType === 'correction' || e.actionType === 'transfer')).reduce((sum: number, e: any) => {
              if (e.actionType === 'transfer') return sum - e.amount;
              return sum + e.amount;
            }, 0);
            const spent = generalSpent + dailyExpenseIssued;
            const planned = catEntries.filter((e: any) => e.isPlanned && !e.isSettled).reduce((sum: number, e: any) => sum + e.amount, 0);

            const isEntryPlanned = targetEntry.isPlanned === true;
            const totalUsage = isEntryPlanned 
              ? spent + planned + lockedAmount 
              : spent + lockedAmount;

            if (cat.totalBudget > 0 && totalUsage > cat.totalBudget) {
              return NextResponse.json({
                success: false,
                error: `[예산 한도 초과] 등록하려는 금액이 해당 예산 과목의 잔액을 초과하여 등록을 차단합니다. (누적 예정액: ${totalUsage.toLocaleString()}원 / 총예산: ${cat.totalBudget.toLocaleString()}원)`
              }, { status: 409 });
            }
          }
        }
      }
    }

    switch (action) {
      case 'add': {
        if (!data || Array.isArray(data)) {
          return NextResponse.json({ success: false, error: 'Invalid data for add' }, { status: 400 });
        }
        const cleanData = typeof data === 'object' && data !== null && '_enc' in data 
          ? (() => { const copy = { ...data }; delete (copy as any)._enc; return copy; })()
          : data;
        rows.push(cleanData);
        break;
      }
      case 'update': {
        if (!id || !data || Array.isArray(data)) {
          return NextResponse.json({ success: false, error: 'Missing id or data for update' }, { status: 400 });
        }
        const idx = rows.findIndex((r: any) => r.id === id);
        if (idx === -1) {
          return NextResponse.json({ success: false, error: 'ID not found' }, { status: 404 });
        }
        const cleanData = typeof data === 'object' && data !== null && '_enc' in data 
          ? (() => { const copy = { ...data }; delete (copy as any)._enc; return copy; })()
          : data;
        const targetRow = { ...rows[idx] };
        if ('_enc' in targetRow) delete targetRow._enc;
        rows[idx] = { ...targetRow, ...cleanData };
        break;
      }
      case 'delete': {
        if (!id) {
          return NextResponse.json({ success: false, error: 'Missing id for delete' }, { status: 400 });
        }
        const before = rows.length;
        rows = rows.filter((r: any) => r.id !== id);
        if (rows.length === before) {
          return NextResponse.json({ success: false, error: 'ID not found' }, { status: 404 });
        }
        break;
      }
      case 'replace': {
        rows = Array.isArray(data) ? data.map(item => {
          if (item && typeof item === 'object' && '_enc' in item) {
            const copy = { ...item };
            delete (copy as any)._enc;
            return copy;
          }
          return item;
        }) : [];
        break;
      }
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }


    await writeDataToFile(sheet, rows);

    let mtime = 0;
    let size = 0;
    try {
      const stats = await fs.stat(getFilePath(sheet));
      mtime = stats.mtimeMs;
      size = stats.size;
    } catch (statsErr) {
      console.warn(`[API POST] Failed to fetch stats for ${sheet} after write:`, statsErr);
    }

    // RAG 임베딩 자동 색인 트리거 (sheet가 WIKI_DOC_로 시작하는 경우)
    if (sheet.startsWith('WIKI_DOC_')) {
      const nodeId = sheet.replace('WIKI_DOC_', '');
      let nodeLabel = nodeId;
      try {
        const mapCustomFilePath = path.join(process.cwd(), 'data', 'MAP_CUSTOMIZATION.json');
        const mapCustomContent = await fs.readFile(mapCustomFilePath, 'utf-8');
        const mapCustomData = JSON.parse(mapCustomContent);
        
        // customNodes 및 overrides에서 라벨 탐색
        const customNodes = mapCustomData?.customNodes || mapCustomData?.[0]?.customNodes || [];
        const overrides = mapCustomData?.overrides || mapCustomData?.[0]?.overrides || {};
        
        const node = customNodes.find((n: any) => n.id === nodeId);
        if (node) {
          const override = overrides[nodeId];
          nodeLabel = override?.customLabel || node.label || nodeId;
        } else if (nodeId.startsWith('leaf-kw-')) {
          nodeLabel = nodeId.replace('leaf-kw-', '');
        }
      } catch (err) {
        console.warn('[API Data POST] Failed to resolve node label for RAG index, fallback to ID:', err);
      }

      // 비동기로 RAG 임베딩 갱신
      if (rows.length > 0 && rows[0].blocks) {
        RAGEngine.updateNodeEmbedding(nodeId, nodeLabel, rows[0].blocks).catch((err: unknown) => {
          console.error('[API Data POST] Failed to update RAG embedding:', err);
        });
      }
    }

      return NextResponse.json({ success: true, mtime, size });
    });

  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
