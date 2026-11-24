/**
 * Cloudflare Pages Function — /api/memo
 * 24/7 Mobile Cloudflare KV Memo Inbox Relay (sheet:WORKING_MEMORY)
 */

export interface EdgeKVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface EdgePagesContext<E> {
  request: Request;
  env: E;
}

export type EdgePagesFunction<E = Env> = (
  context: EdgePagesContext<E>
) => Response | Promise<Response>;

export interface Env {
  HCHPS_DATA: EdgeKVNamespace;
  MEMO_PIN?: string;
}

interface WorkingMemoryEdgeIssueMeta {
  severity?: 'low' | 'medium' | 'high' | 'critical';
  responsibleParty?: string;
  proximateCause?: string;
  rootCause?: string;
  machineFix?: string;
  doubleDoRequired?: boolean;
}

interface WorkingMemoryEdgeRecord {
  id: string;
  content: string;
  category: 'budget' | 'audit' | 'festival' | 'directive' | 'issue_log' | 'general';
  tags: string[];
  numericHighlight?: string;
  dateHighlight?: string;
  issueMeta?: WorkingMemoryEdgeIssueMeta;
  status: 'pending' | 'reflected';
  pinned?: boolean;
  source?: 'pc' | 'mobile';
  createdAt: string;
  updatedAt: string;
  reflectedAt?: string;
}

const KV_KEY = 'sheet:WORKING_MEMORY';
const TOMBSTONE_KV_KEY = 'sheet:GLOBAL_TOMBSTONES';
const DEFAULT_PINS = ['7116', '1031', '0000', '2026', 'gangnam'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Memo-Pin',
  'Content-Type': 'application/json',
};

function isAuthorizedEdgeRequest(request: Request, env: Env): boolean {
  const url = new URL(request.url);
  const pin = (request.headers.get('X-Memo-Pin') || url.searchParams.get('pin') || '').trim();
  const allowed = new Set([...DEFAULT_PINS, ...(env.MEMO_PIN ? [env.MEMO_PIN] : [])]);
  if (pin && allowed.has(pin)) return true;

  const cookieHeader = request.headers.get('Cookie') || '';
  if (
    cookieHeader.includes('hchps_session=authenticated-secure-session-token') ||
    cookieHeader.includes('vital_auth_session=')
  ) {
    return true;
  }
  return false;
}

function nextMonotonicEdgeIso(prevIso?: string, secondPrevIso?: string): string {
  const p1 = prevIso ? Date.parse(prevIso) || 0 : 0;
  const p2 = secondPrevIso ? Date.parse(secondPrevIso) || 0 : 0;
  const maxPrev = Math.max(p1, p2);
  return new Date(Math.max(Date.now(), maxPrev + 1)).toISOString();
}

async function readKvTombstones(kv: EdgeKVNamespace): Promise<Set<string>> {
  const raw = await kv.get(TOMBSTONE_KV_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const set = new Set<string>();
    for (const item of parsed) {
      if (typeof item === 'string' && item) set.add(item);
      else if (item && typeof item === 'object' && typeof item.id === 'string') set.add(item.id);
    }
    return set;
  } catch {
    return new Set();
  }
}

async function appendKvTombstones(kv: EdgeKVNamespace, ids: string[]): Promise<Set<string>> {
  const set = await readKvTombstones(kv);
  let changed = false;
  for (const id of ids) {
    if (id && !set.has(id)) {
      set.add(id);
      changed = true;
    }
  }
  if (changed) {
    const now = Date.now();
    const list = Array.from(set).map((id) => ({ id, deletedAt: now }));
    await kv.put(TOMBSTONE_KV_KEY, JSON.stringify(list));
  }
  return set;
}

async function readKvMemos(kv: EdgeKVNamespace): Promise<WorkingMemoryEdgeRecord[]> {
  const [raw, tombstones] = await Promise.all([kv.get(KV_KEY), readKvTombstones(kv)]);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((m: WorkingMemoryEdgeRecord) => m && m.id && !tombstones.has(m.id))
      : [];
  } catch {
    return [];
  }
}

function mergeEdgeMemos(
  baseMemos: WorkingMemoryEdgeRecord[],
  incomingMemos: WorkingMemoryEdgeRecord[],
  deletedIds: Set<string>
): WorkingMemoryEdgeRecord[] {
  const map = new Map<string, WorkingMemoryEdgeRecord>();
  for (const m of baseMemos) {
    if (m && m.id && !deletedIds.has(m.id)) map.set(m.id, m);
  }
  for (const incoming of incomingMemos) {
    if (!incoming || !incoming.id || deletedIds.has(incoming.id)) continue;
    const existing = map.get(incoming.id);
    if (!existing) {
      map.set(incoming.id, incoming);
      continue;
    }
    const existingUpdatedMs = Date.parse(existing.updatedAt || existing.createdAt || '') || 0;
    const incomingUpdatedMs = Date.parse(incoming.updatedAt || incoming.createdAt || '') || 0;
    const existingCreatedMs = Date.parse(existing.createdAt || '') || 0;
    const incomingCreatedMs = Date.parse(incoming.createdAt || '') || 0;

    const existingIsUntouchedPending =
      existing.status === 'pending' && !existing.reflectedAt && existingUpdatedMs === existingCreatedMs;
    const incomingIsUntouchedPending =
      incoming.status === 'pending' && !incoming.reflectedAt && incomingUpdatedMs === incomingCreatedMs;

    if (incoming.status === 'reflected' && existingIsUntouchedPending) {
      map.set(incoming.id, {
        ...incoming,
        updatedAt: nextMonotonicEdgeIso(existing.updatedAt, incoming.updatedAt),
      });
      continue;
    }
    if (existing.status === 'reflected' && incomingIsUntouchedPending) {
      map.set(existing.id, {
        ...existing,
        updatedAt: nextMonotonicEdgeIso(existing.updatedAt, incoming.updatedAt),
      });
      continue;
    }

    if (incomingUpdatedMs >= existingUpdatedMs) {
      map.set(incoming.id, incoming);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

export const onRequestOptions: EdgePagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const onRequestGet: EdgePagesFunction<Env> = async (context) => {
  const { request, env } = context;
  if (!isAuthorizedEdgeRequest(request, env)) {
    return new Response(
      JSON.stringify({ success: false, error: 'PIN 번호가 일치하지 않습니다.' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  try {
    const data = await readKvMemos(env.HCHPS_DATA);
    return new Response(JSON.stringify({ success: true, data }), {
      headers: CORS_HEADERS,
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'KV 조회 실패',
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

export const onRequestPost: EdgePagesFunction<Env> = async (context) => {
  const { request, env } = context;
  if (!isAuthorizedEdgeRequest(request, env)) {
    return new Response(
      JSON.stringify({ success: false, error: 'PIN 번호가 일치하지 않습니다.' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  try {
    const body = (await request.json()) as {
      action?: 'add' | 'update' | 'delete' | 'sync';
      memo?: WorkingMemoryEdgeRecord;
      memos?: WorkingMemoryEdgeRecord[];
      deletedIds?: string[];
      id?: string;
      updates?: Partial<WorkingMemoryEdgeRecord>;
    };

    const action = body.action || 'add';
    const current = await readKvMemos(env.HCHPS_DATA);

    if (action === 'add' && (body.memo || (Array.isArray(body.memos) && body.memos.length > 0))) {
      const addedList =
        Array.isArray(body.memos) && body.memos.length > 0
          ? body.memos
          : body.memo
            ? [body.memo]
            : [];
      const tombstones = await readKvTombstones(env.HCHPS_DATA);
      const next = mergeEdgeMemos(current, addedList, tombstones);
      await env.HCHPS_DATA.put(KV_KEY, JSON.stringify(next));
      return new Response(
        JSON.stringify({
          success: true,
          added: addedList[0],
          addedCount: addedList.length,
          data: next,
        }),
        { headers: CORS_HEADERS }
      );
    }

    if (action === 'update' && body.id) {
      const updates = body.updates || {};
      const next = current.map((m) =>
        m.id === body.id
          ? {
              ...m,
              ...updates,
              updatedAt: nextMonotonicEdgeIso(m.updatedAt, updates.updatedAt || m.reflectedAt),
            }
          : m
      );
      await env.HCHPS_DATA.put(KV_KEY, JSON.stringify(next));
      return new Response(JSON.stringify({ success: true, data: next }), {
        headers: CORS_HEADERS,
      });
    }

    if (action === 'delete' && body.id) {
      await appendKvTombstones(env.HCHPS_DATA, [body.id]);
      const next = current.filter((m) => m.id !== body.id);
      await env.HCHPS_DATA.put(KV_KEY, JSON.stringify(next));
      return new Response(JSON.stringify({ success: true, data: next }), {
        headers: CORS_HEADERS,
      });
    }

    if (action === 'sync' && Array.isArray(body.memos)) {
      const clientDeleted = Array.isArray(body.deletedIds) ? body.deletedIds : [];
      const tombstones = await appendKvTombstones(env.HCHPS_DATA, clientDeleted);
      const merged = mergeEdgeMemos(current, body.memos, tombstones);
      await env.HCHPS_DATA.put(KV_KEY, JSON.stringify(merged));
      return new Response(JSON.stringify({ success: true, data: merged }), {
        headers: CORS_HEADERS,
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: `Invalid action: ${String(action)}` }),
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'KV 저장 실패',
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
