import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { WorkingMemoryCategory, WorkingMemoryMemo } from '@/types';
import { WorkingMemorySchema } from '@/lib/schemas';
import {
  createWorkingMemoryMemo,
  createWorkingMemoryMemosFromText,
  DEFAULT_WORKING_MEMORY_MEMOS,
  mergeWorkingMemoryMemos,
  nextMonotonicIso,
  parseWorkingMemoryInput,
} from '@/lib/working-memory-parser';

function getDataDir(): string {
  return process.env.VITAL_TEST_DATA_DIR || path.join(process.cwd(), 'data');
}

function getMemoFilePath(): string {
  return path.join(getDataDir(), 'WORKING_MEMORY.json');
}

function getTombstonesFilePath(): string {
  return path.join(getDataDir(), 'GLOBAL_TOMBSTONES.json');
}

const ALLOWED_PINS = new Set([
  '7116',
  '1031',
  '0000',
  '2026',
  'gangnam',
  ...(process.env.MEMO_PIN ? [process.env.MEMO_PIN] : []),
]);

function isAuthorizedMemoRequest(req: NextRequest): boolean {
  const headerPin = req.headers.get('x-memo-pin')?.trim();
  const queryPin = req.nextUrl.searchParams.get('pin')?.trim();
  if ((headerPin && ALLOWED_PINS.has(headerPin)) || (queryPin && ALLOWED_PINS.has(queryPin))) {
    return true;
  }
  const hchpsCookie = req.cookies.get('hchps_session')?.value;
  const vitalCookie = req.cookies.get('vital_auth_session')?.value;
  if (hchpsCookie === 'authenticated-secure-session-token' || Boolean(vitalCookie)) {
    return true;
  }
  return false;
}

function readTombstoneIds(): Set<string> {
  const tombstoneFile = getTombstonesFilePath();
  try {
    if (!fs.existsSync(tombstoneFile)) return new Set();
    const raw = fs.readFileSync(tombstoneFile, 'utf-8').trim();
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const ids = new Set<string>();
    for (const item of parsed) {
      if (typeof item === 'string' && item) ids.add(item);
      else if (item && typeof item === 'object' && typeof item.id === 'string') ids.add(item.id);
    }
    return ids;
  } catch {
    return new Set();
  }
}

function appendTombstoneIds(newIds: string[]): Set<string> {
  const currentIds = readTombstoneIds();
  const added: string[] = [];
  for (const id of newIds) {
    if (id && !currentIds.has(id)) {
      currentIds.add(id);
      added.push(id);
    }
  }
  if (added.length === 0) return currentIds;

  const dataDir = getDataDir();
  const tombstoneFile = getTombstonesFilePath();
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    let existingList: Array<{ id: string; deletedAt: number }> = [];
    if (fs.existsSync(tombstoneFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(tombstoneFile, 'utf-8'));
        if (Array.isArray(raw)) {
          existingList = raw.map((item: unknown) =>
            typeof item === 'string'
              ? { id: item, deletedAt: Date.now() }
              : {
                  id: String((item as { id?: string })?.id || ''),
                  deletedAt: Number((item as { deletedAt?: number })?.deletedAt || Date.now()),
                }
          );
        }
      } catch {
        existingList = [];
      }
    }
    const now = Date.now();
    for (const id of added) {
      existingList.push({ id, deletedAt: now });
    }
    fs.writeFileSync(tombstoneFile, JSON.stringify(existingList, null, 2), 'utf-8');
  } catch {
    // Ignore write error in read-only test contexts
  }
  return currentIds;
}

function readLocalWorkingMemory(): WorkingMemoryMemo[] {
  const memoFile = getMemoFilePath();
  const tombstones = readTombstoneIds();
  try {
    if (!fs.existsSync(memoFile)) {
      return DEFAULT_WORKING_MEMORY_MEMOS.filter((m) => !tombstones.has(m.id));
    }
    const raw = fs.readFileSync(memoFile, 'utf-8').trim();
    if (!raw) return DEFAULT_WORKING_MEMORY_MEMOS.filter((m) => !tombstones.has(m.id));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_WORKING_MEMORY_MEMOS.filter((m) => !tombstones.has(m.id));
    return parsed
      .map((item) => {
        const res = WorkingMemorySchema.safeParse(item);
        return res.success ? (res.data as WorkingMemoryMemo) : null;
      })
      .filter((item): item is WorkingMemoryMemo => item !== null && !tombstones.has(item.id));
  } catch {
    return DEFAULT_WORKING_MEMORY_MEMOS.filter((m) => !tombstones.has(m.id));
  }
}

function writeLocalWorkingMemory(memos: WorkingMemoryMemo[]): void {
  const dataDir = getDataDir();
  const memoFile = getMemoFilePath();
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const tmpPath = `${memoFile}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(memos, null, 2), 'utf-8');
    fs.renameSync(tmpPath, memoFile);
  } catch {
    try {
      fs.writeFileSync(memoFile, JSON.stringify(memos, null, 2), 'utf-8');
    } catch {
      // Ignore write error in read-only test contexts
    }
  }
}

function normalizeIncomingMemos(rawList: unknown[]): WorkingMemoryMemo[] {
  const valid: WorkingMemoryMemo[] = [];
  for (const item of rawList) {
    const res = WorkingMemorySchema.safeParse(item);
    if (res.success && res.data.id) {
      valid.push(res.data as WorkingMemoryMemo);
    }
  }
  return valid;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedMemoRequest(req)) {
    return NextResponse.json(
      { success: false, error: 'PIN 번호가 일치하지 않습니다.' },
      { status: 401 }
    );
  }

  const memos = readLocalWorkingMemory();
  return NextResponse.json({
    success: true,
    data: memos,
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedMemoRequest(req)) {
    return NextResponse.json(
      { success: false, error: 'PIN 번호가 일치하지 않습니다.' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const action = body?.action || 'add';
    const current = readLocalWorkingMemory();

    if (action === 'add') {
      let addedMemos: WorkingMemoryMemo[] = [];

      if (Array.isArray(body.memos) && body.memos.length > 0) {
        addedMemos = body.memos
          .filter((m: unknown) => m && typeof m === 'object' && 'content' in m)
          .map((m: Record<string, unknown>) => {
            const parsed = createWorkingMemoryMemo({
              id: typeof m.id === 'string' ? m.id : undefined,
              content: String(m.content),
              explicitCategory: m.category as WorkingMemoryCategory | undefined,
              source: (m.source as 'pc' | 'mobile' | undefined) || 'mobile',
              pinned: (m.pinned ?? m.isPinned) as boolean | undefined,
              nowIso: typeof m.createdAt === 'string' ? m.createdAt : undefined,
            });
            return {
              ...parsed,
              ...m,
              tags:
                Array.isArray(m.tags) && m.tags.length > 0
                  ? (m.tags as string[])
                  : parsed.tags,
              numericHighlight: (m.numericHighlight as string | undefined) ?? parsed.numericHighlight,
              dateHighlight: (m.dateHighlight as string | undefined) ?? parsed.dateHighlight,
            } as WorkingMemoryMemo;
          });
      } else if (body.memo && typeof body.memo === 'object' && body.memo.content) {
        const parsed = createWorkingMemoryMemo({
          id: body.memo.id,
          content: String(body.memo.content),
          explicitCategory: body.memo.category as WorkingMemoryCategory | undefined,
          source: body.memo.source || 'mobile',
          pinned: body.memo.pinned ?? body.memo.isPinned,
          nowIso: body.memo.createdAt,
        });
        addedMemos = [
          {
            ...parsed,
            ...body.memo,
            tags:
              Array.isArray(body.memo.tags) && body.memo.tags.length > 0
                ? body.memo.tags
                : parsed.tags,
            numericHighlight: body.memo.numericHighlight ?? parsed.numericHighlight,
            dateHighlight: body.memo.dateHighlight ?? parsed.dateHighlight,
          },
        ];
      } else if (typeof body.content === 'string' && body.content.trim()) {
        addedMemos = createWorkingMemoryMemosFromText({
          content: body.content,
          explicitCategory: body.category as WorkingMemoryCategory | undefined,
          source: body.source || 'mobile',
        });
      } else {
        return NextResponse.json(
          { success: false, error: '메모 내용을 입력해주세요.' },
          { status: 400 }
        );
      }

      const tombstones = readTombstoneIds();
      const next = mergeWorkingMemoryMemos(current, addedMemos, tombstones);
      writeLocalWorkingMemory(next);
      return NextResponse.json({
        success: true,
        added: addedMemos[0],
        addedCount: addedMemos.length,
        data: next,
      });
    }

    if (action === 'update' && typeof body.id === 'string') {
      const updates = (body.updates && typeof body.updates === 'object' ? body.updates : {}) as Partial<WorkingMemoryMemo>;
      const next = current.map((m) => {
        if (m.id !== body.id) return m;
        const safeNow = nextMonotonicIso(m.updatedAt, updates.updatedAt || m.reflectedAt);
        const reParsed =
          typeof updates.content === 'string' && updates.content.trim()
            ? parseWorkingMemoryInput(updates.content, updates.category || m.category)
            : null;
        return {
          ...m,
          ...updates,
          ...(reParsed
            ? {
                content: updates.content!.trim(),
                category: updates.category || reParsed.category,
                tags: updates.tags || reParsed.tags,
                numericHighlight: updates.numericHighlight ?? reParsed.numericHighlight,
                dateHighlight: updates.dateHighlight ?? reParsed.dateHighlight,
              }
            : {}),
          updatedAt: safeNow,
        };
      });
      writeLocalWorkingMemory(next);
      return NextResponse.json({
        success: true,
        data: next,
      });
    }

    if (action === 'delete' && typeof body.id === 'string') {
      appendTombstoneIds([body.id]);
      const next = current.filter((m) => m.id !== body.id);
      writeLocalWorkingMemory(next);
      return NextResponse.json({
        success: true,
        data: next,
      });
    }

    if (action === 'sync') {
      const incomingRaw = Array.isArray(body.memos) ? body.memos : [];
      const incoming = normalizeIncomingMemos(incomingRaw);
      const clientDeletedIds = Array.isArray(body.deletedIds)
        ? body.deletedIds.filter((id: unknown): id is string => typeof id === 'string')
        : [];
      const allTombstones = appendTombstoneIds(clientDeletedIds);
      const merged = mergeWorkingMemoryMemos(current, incoming, allTombstones);
      writeLocalWorkingMemory(merged);
      return NextResponse.json({
        success: true,
        data: merged,
      });
    }

    return NextResponse.json(
      { success: false, error: `지원하지 않는 요청입니다: ${String(action)}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : '메모 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
