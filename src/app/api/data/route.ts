import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getDomainSchema } from '@/lib/schemas';
import { RAGEngine } from '@/lib/rag/rag-engine';
import {
  withLock,
  readSheetData,
  writeSheetData,
  getSheetFilePath,
} from '@/lib/server/storage-service';
import { validateBudgetEntryMutation } from '@/lib/server/budget-validator';

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
  'CONTACTS',
  'WORKING_MEMORY',
  'ADMIN_DOC_INDEX',
  'WEEKLY_REPORTS'
]);

function validateSheet(sheet: string): boolean {
  return ALLOWED_SHEETS.has(sheet) || sheet.startsWith('WIKI_DOC_');
}

// Backward-compatible export of withSheetLock
export async function withSheetLock<T>(sheet: string, fn: () => Promise<T>): Promise<T> {
  return withLock(sheet, fn);
}

// 단일 행 O(1) 증분 Zod 스키마 유효성 검증 함수 (add / update 시 사용)
function validateSingleItemPayload(sheet: string, item: any): boolean {
  const schema = getDomainSchema(sheet);
  if (schema && typeof (schema as any).safeParse === 'function') {
    const parsed = (schema as any).safeParse(item);
    if (!parsed.success) {
      console.error(`[Zod Gatekeeper Error] Invalid single item in sheet ${sheet}:`, parsed.error.format());
      return false;
    }
  }
  return true;
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
    const filePath = getSheetFilePath(sheet);
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

    const data = await readSheetData<any[]>(sheet, { knownMtimeMs: stats.mtimeMs });
    return NextResponse.json({ success: true, data, mtime: stats.mtimeMs, size: stats.size });
  } catch (e) {
    console.error(`[API GET Error] Failed to read data for sheet ${sheet}:`, e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
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
        rows = await readSheetData<any[]>(sheet);
      }

      if (sheet === 'BUDGET_ENTRIES' && (action === 'add' || action === 'update')) {
        const categories = await readSheetData<any[]>('BUDGET_CATEGORIES');
        const validation = validateBudgetEntryMutation({
          action,
          entryData: data,
          entryId: id,
          currentEntries: rows,
          categories,
        });

        if (!validation.valid) {
          return NextResponse.json(
            { success: false, error: validation.error, code: validation.code },
            { status: validation.status }
          );
        }
      }

      let skipFullValidation = false;

      switch (action) {
        case 'add': {
          if (!data || Array.isArray(data)) {
            return NextResponse.json({ success: false, error: 'Invalid data for add' }, { status: 400 });
          }
          const cleanData = typeof data === 'object' && data !== null && '_enc' in data 
            ? (() => { const copy = { ...data }; delete (copy as any)._enc; return copy; })()
            : data;
          if (!validateSingleItemPayload(sheet, cleanData)) {
            throw new Error(`[Zod validation failed] Data structure is invalid for sheet: ${sheet}`);
          }
          rows.push(cleanData);
          skipFullValidation = true;
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
          const updatedRow = { ...targetRow, ...cleanData };
          if (!validateSingleItemPayload(sheet, updatedRow)) {
            throw new Error(`[Zod validation failed] Data structure is invalid for sheet: ${sheet}`);
          }
          rows[idx] = updatedRow;
          skipFullValidation = true;
          break;
        }
        case 'delete': {
          if (!id) {
            return NextResponse.json({ success: false, error: 'Missing id for delete' }, { status: 400 });
          }
          const before = rows.length;
          rows = rows.filter((r: any) => r.id !== id);
          if (rows.length === before) {
            return NextResponse.json({ success: true, alreadyDeleted: true });
          }
          skipFullValidation = true;
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
          skipFullValidation = false;
          break;
        }
        default:
          return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
      }

      const { mtimeMs: mtime, size } = await writeSheetData(sheet, rows, { skipValidation: skipFullValidation });

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
