/**
 * Cloudflare Pages Function — Data API
 * KV 기반 CRUD 엔드포인트 (API Key 인증)
 * 
 * GET  /api/data?sheet=TASKS         → 해당 시트 데이터 전체 읽기
 * POST /api/data { sheet, action, data, id } → add/update/delete/replace
 * 
 * 인증: X-API-Key 헤더 또는 ?key= 쿼리 파라미터
 */

interface Env {
  HCHPS_DATA: KVNamespace;
  HCHPS_AUTH_TOKEN?: string; // Cloudflare Pages 환경변수 (PIN 유도 Auth 토큰)
  API_KEY?: string; // Legacy API Key
}

// 허용된 시트 이름 (CWE-20: 입력값 검증)
const ALLOWED_SHEETS = new Set([
  'TASKS', 'MEETINGS', 'PROJECTS',
  'BUDGET_CATEGORIES', 'BUDGET_ENTRIES',
  'BUDGET_SIMULATIONS',
  'INVENTORY', 'STOCK_CHANGES',
  'SIGNAL_LOG', 'KNOWLEDGE',
  'MAP_CUSTOMIZATION', 'BOSS_SCHEDULE',
  'PLANNING_MAP_CUSTOMIZATION',
  'EXTERNAL_DOCS', 'CLASSIFICATION_WORDS',
  'SCHEDULES', 'CONTACTS',
  'WORKING_MEMORY'
]);

function kvKey(sheet: string): string {
  return `sheet:${sheet}`;
}

function getCorsHeaders(request: Request): Record<string, string> {
  let allowedOrigin = 'https://portfolio-hchps.pages.dev';
  const origin = request.headers.get('Origin') || '';
  if (origin === 'http://localhost:3001' || origin === 'http://127.0.0.1:3001' || origin.startsWith('http://192.168.') || origin === 'https://portfolio-architects.github.io') {
    allowedOrigin = origin;
  }
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Pragma, X-API-Key',
  };
}

function jsonResponse(request: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...getCorsHeaders(request)
    },
  });
}

// API Key 검증 (Dynamic Session Token - E2EE)
function authenticate(request: Request, env: Env): boolean {
  const configuredKey = env.HCHPS_AUTH_TOKEN;
  
  // 환경 변수조차 없으면 서버 자체를 Fail-Close 모드로 운영하여 보안 사고 방지
  if (!configuredKey) {
    console.error("CRITICAL SECURITY WARN: HCHPS_AUTH_TOKEN is missing in environment variables.");
    return false; 
  }

  // 동적 세션 검증 (Authorization Bearer Token 방식만 허용, 구형 X-API-Key 탈피)
  let token = null;
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  return !!token && token === configuredKey;
}

// 시트 이름 검증
function validateSheet(sheet: string): boolean {
  return ALLOWED_SHEETS.has(sheet) || sheet.startsWith('WIKI_DOC_');
}

// Handle CORS preflight
export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    headers: getCorsHeaders(context.request),
  });
};

// GET: Read all data for a sheet
export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!authenticate(context.request, context.env)) {
    return jsonResponse(context.request,{ success: false, error: 'Unauthorized' }, 401);
  }

  const url = new URL(context.request.url);
  const sheet = url.searchParams.get('sheet');

  if (!sheet) {
    return jsonResponse(context.request,{ success: false, error: 'Missing sheet parameter' }, 400);
  }

  if (!validateSheet(sheet)) {
    return jsonResponse(context.request,{ success: false, error: 'Invalid sheet name' }, 400);
  }

  try {
    const raw = await context.env.HCHPS_DATA.get(kvKey(sheet));
    const data = raw ? JSON.parse(raw) : [];
    return jsonResponse(context.request,{ success: true, data });
  } catch {
    return jsonResponse(context.request,{ success: false, error: 'Internal error' }, 500);
  }
};

// POST: Write data (add, update, delete, replace)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!authenticate(context.request, context.env)) {
    return jsonResponse(context.request,{ success: false, error: 'Unauthorized' }, 401);
  }

  // Security: Payload Size Limit (5MB) to prevent OOM
  const contentLength = parseInt(context.request.headers.get('Content-Length') || '0', 10);
  if (contentLength > 5242880) {
    return jsonResponse(context.request, { success: false, error: 'Payload Too Large' }, 413);
  }

  try {
    const body = await context.request.json() as {
      sheet: string;
      action: string;
      data?: Record<string, unknown> | Record<string, unknown>[];
      id?: string;
    };

    const { sheet, action, data, id } = body;
    if (!sheet || !action) {
      return jsonResponse(context.request,{ success: false, error: 'Missing sheet or action' }, 400);
    }

    if (!validateSheet(sheet)) {
      return jsonResponse(context.request,{ success: false, error: 'Invalid sheet name' }, 400);
    }

    const key = kvKey(sheet);
    const raw = await context.env.HCHPS_DATA.get(key);
    let rows: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];

    switch (action) {
      case 'add': {
        if (!data || Array.isArray(data)) {
          return jsonResponse(context.request,{ success: false, error: 'Invalid data for add' }, 400);
        }
        rows.push(data);
        break;
      }

      case 'update': {
        if (!id || !data || Array.isArray(data)) {
          return jsonResponse(context.request,{ success: false, error: 'Missing id or data for update' }, 400);
        }
        const idx = rows.findIndex(r => r.id === id);
        if (idx === -1) {
          return jsonResponse(context.request,{ success: false, error: 'ID not found' }, 404);
        }
        rows[idx] = { ...rows[idx], ...data };
        break;
      }

      case 'delete': {
        if (!id) {
          return jsonResponse(context.request,{ success: false, error: 'Missing id for delete' }, 400);
        }
        const before = rows.length;
        rows = rows.filter(r => r.id !== id);
        if (rows.length === before) {
          return jsonResponse(context.request,{ success: false, error: 'ID not found' }, 404);
        }
        break;
      }

      case 'replace': {
        rows = Array.isArray(data) ? data : [];
        break;
      }

      default:
        return jsonResponse(context.request,{ success: false, error: 'Unknown action' }, 400);
    }

    await context.env.HCHPS_DATA.put(key, JSON.stringify(rows));
    return jsonResponse(context.request,{ success: true });

  } catch {
    return jsonResponse(context.request,{ success: false, error: 'Internal error' }, 500);
  }
};
