/**
 * Data API Client — Cloudflare KV 기반
 * 
 * Cloudflare Pages Functions (/api/data) 엔드포인트와 통신
 * E2EE (End-to-End Encryption) 및 Token 인증 추가
 */

import { decryptPayload, getAuthToken } from '@/lib/crypto';
import { getDomainSchema } from '@/lib/schemas';
import { z } from 'zod';
import * as Y from 'yjs';

const API_BASE = '/api/data';

function getAuthHeaders(): Record<string, string> {
  try {
    const token = getAuthToken();
    return { 'Authorization': `Bearer ${token}` };
  } catch {
    return {};
  }
}

// ============ Read ============

/**
 * 지정된 시트(혹은 KV 저장소 슬롯)에서 데이터를 읽어와 복호화(Decryption) 후 반환합니다.
 * 
 * @typeParam T - 반환할 데이터 행(row)의 타입
 * @param sheetName - 읽어올 대상 시트 이름 (예: 'budgets', 'tasks')
 * @returns 복호화 처리된 데이터 배열. 실패하거나 오프라인 모드일 경우 빈 배열(`[]`)을 반환합니다.
 * 
 * @remarks
 * 백엔드 단에서 평문으로 반환된 데이터 중 `_enc` 해시 필드가 있는 항목들은 `decryptPayload`를 통해 
 * 클라이언트 단에서 복호화됩니다. 세션 토큰(`sessionAuthToken`) 인증 헤더를 동반합니다.
 */
interface CacheEntry {
  mtime: number;
  size: number;
  data: any[];
  lastMetaCheck: number;
}

const clientCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();
const rowValidationCache = new Map<string, Map<string, { rawSig: string; validated: Record<string, unknown> }>>();

export async function readSheet<T>(sheetName: string): Promise<T[]> {
  const cached = clientCache.get(sheetName);
  const now = Date.now();

  // Deduplicate concurrent in-flight requests for the same sheet
  if (inFlightRequests.has(sheetName)) {
    return inFlightRequests.get(sheetName) as Promise<T[]>;
  }


  const fetchPromise = (async (): Promise<T[]> => {
    try {
      let url = `${API_BASE}?sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`;
      if (cached && cached.mtime && cached.size) {
        url += `&clientMtime=${cached.mtime}&clientSize=${cached.size}`;
      }
      const res = await fetch(url, {
        headers: { 
          ...getAuthHeaders(),
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        cache: 'no-store'
      });
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const json = await res.json();
      if (json.success && json.notModified && cached) {
        cached.lastMetaCheck = Date.now();
        return cached.data as T[];
      }
      if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || 'API returned success=false or invalid data');
      }
      if (
        cached &&
        typeof json.mtime === 'number' &&
        json.mtime > 0 &&
        typeof json.size === 'number' &&
        json.size > 0 &&
        cached.mtime === json.mtime &&
        cached.size === json.size
      ) {
        cached.lastMetaCheck = Date.now();
        return cached.data as T[];
      }

      // E2EE Decryption
      let rawRows: any[];
      let isE2EEBypass = true;
      if (json.data.length > 0) {
        for (let i = 0; i < json.data.length; i++) {
          const row = json.data[i];
          if (!row || !row._enc) continue;
          const encStr = (row._enc as string).trim();
          if (!encStr.startsWith('{') && !encStr.startsWith('[')) {
            isE2EEBypass = false;
            break;
          }
        }
      }

      if (isE2EEBypass) {
        const rawRowsArr: any[] = [];
        for (let i = 0; i < json.data.length; i++) {
          const row = json.data[i];
          if (row && row._enc) {
            try {
              const dec = JSON.parse(row._enc as string) as Record<string, any>;
              let finalDec = { ...dec };
              
              // Self-Healing: 복호화된 BUDGET_CATEGORIES의 calculations가 지출 내역 purpose로 오염되었을 경우 디스크 평문 백업 데이터로 복구
              if (sheetName === 'BUDGET_CATEGORIES' && row.subItems && Array.isArray(row.subItems) && dec.subItems && Array.isArray(dec.subItems)) {
                const subItemsArr: any[] = [];
                for (let sIdx = 0; sIdx < dec.subItems.length; sIdx++) {
                  const decSub = dec.subItems[sIdx];
                  let originalSub: any = undefined;
                  for (let oIdx = 0; oIdx < row.subItems.length; oIdx++) {
                    const s = row.subItems[oIdx];
                    if (s.id === decSub.id || s.name === decSub.name) {
                      originalSub = s;
                      break;
                    }
                  }
                  if (originalSub) {
                    const restoredSub = { ...decSub };
                    if (originalSub.calculations && Array.isArray(originalSub.calculations)) {
                      const decCalcs = Array.isArray(decSub.calculations) ? decSub.calculations : [];
                      const decCalcsMap = new Map<string, any>();
                      for (let cIdx = 0; cIdx < decCalcs.length; cIdx++) {
                        const c = decCalcs[cIdx];
                        if (c && c.id) decCalcsMap.set(c.id, c);
                      }
                      const calcsArr: any[] = [];
                      for (let origIdx = 0; origIdx < originalSub.calculations.length; origIdx++) {
                        const origCalc = originalSub.calculations[origIdx];
                        const decCalc = decCalcsMap.get(origCalc.id) || {};
                        calcsArr.push({
                          ...origCalc,
                          isLocked: typeof decCalc.isLocked === 'boolean' ? decCalc.isLocked : (origCalc.isLocked || false)
                        });
                      }
                      restoredSub.calculations = calcsArr;
                    } else {
                      restoredSub.calculations = [];
                    }
                    subItemsArr.push(restoredSub);
                  } else {
                    subItemsArr.push(decSub);
                  }
                }
                finalDec.subItems = subItemsArr;
              }
              
              rawRowsArr.push({ id: row.id, ...finalDec });
            } catch (e) {
              console.error('Synchronous parsing failed for row', row.id, e);
              throw e;
            }
          } else {
            rawRowsArr.push(row);
          }
        }
        rawRows = rawRowsArr;
      } else {
        const decryptedPromises = json.data.map(async (row: Record<string, unknown>) => {
          if (row._enc) {
            try {
              const dec = await decryptPayload(row._enc as string) as Record<string, any>;
              let finalDec = { ...dec };
              
              // Self-Healing: 복호화된 BUDGET_CATEGORIES의 calculations가 지출 내역 purpose로 오염되었을 경우 디스크 평문 백업 데이터로 복구
              if (sheetName === 'BUDGET_CATEGORIES' && row.subItems && Array.isArray(row.subItems) && dec.subItems && Array.isArray(dec.subItems)) {
                finalDec.subItems = dec.subItems.map((decSub: any) => {
                  const originalSub = (row.subItems as any[]).find((s: any) => s.id === decSub.id || s.name === decSub.name);
                  if (originalSub) {
                    const restoredSub = { ...decSub };
                    if (originalSub.calculations && Array.isArray(originalSub.calculations)) {
                      const decCalcs = Array.isArray(decSub.calculations) ? decSub.calculations : [];
                      const decCalcsMap = new Map<string, any>();
                      decCalcs.forEach((c: any) => {
                        if (c && c.id) decCalcsMap.set(c.id, c);
                      });
                      restoredSub.calculations = originalSub.calculations.map((origCalc: any) => {
                        const decCalc = decCalcsMap.get(origCalc.id) || {};
                        return {
                          ...origCalc,
                          isLocked: typeof decCalc.isLocked === 'boolean' ? decCalc.isLocked : (origCalc.isLocked || false)
                        };
                      });
                    } else {
                      restoredSub.calculations = [];
                    }
                    return restoredSub;
                  }
                  return decSub;
                });
              }
              
              return { id: row.id, ...finalDec };
            } catch (e) {
              console.error('Decryption failed for row', row.id, e);
              throw e; // Decryption failure must propagate to prevent silent empty overwrites!
            }
          }
          return row; // Legacy plaintext fallback
        });
        rawRows = await Promise.all(decryptedPromises);
      }
      
      // Global Tombstone: Filter out deleted items to prevent Cloudflare KV eventual consistency zombie data
      const deletedIdSet = new Set(getTombstones().map(t => t.id));
      
      // Zod Runtimes Validation (Fail-Safe + Incremental Row Memoization)
      const schema = getDomainSchema(sheetName);
      let sheetRowCache = rowValidationCache.get(sheetName);
      if (!sheetRowCache) {
        sheetRowCache = new Map();
        rowValidationCache.set(sheetName, sheetRowCache);
      }
      const nextSheetRowCache = new Map<string, { rawSig: string; validated: Record<string, unknown> }>();
      const validRows: Record<string, unknown>[] = [];
      for (const row of rawRows) {
        if (deletedIdSet.has(row.id)) continue; // 🚀 Kill Zombies (O(1) lookup)
        if ('safeParse' in schema) {
          const rowId = typeof row?.id === 'string' ? row.id : '';
          let rawSig = '';
          if (rowId) {
            rawSig = JSON.stringify(row);
            const prevValidated = sheetRowCache.get(rowId);
            if (prevValidated && prevValidated.rawSig === rawSig) {
              nextSheetRowCache.set(rowId, prevValidated);
              validRows.push(prevValidated.validated);
              continue;
            }
          }
          const result = schema.safeParse(row);
          if (result.success) {
            const validatedData = result.data as Record<string, unknown>;
            if (rowId && rawSig) {
              nextSheetRowCache.set(rowId, { rawSig, validated: validatedData });
            }
            validRows.push(validatedData);
          } else {
            // HARNESS SYSTEM: Loud Failure for Self-Reinforcing AI loops
            console.error(`\n======================================================`);
            console.error(`🚨 [HARNESS ZOD ERROR] Schema Validation Failed!`);
            console.error(`Sheet: ${sheetName}`);
            console.error(`Row ID: ${row.id || 'unknown'}`);
            console.error(`Errors:`, JSON.stringify(result.error.format(), null, 2));
            console.error(`======================================================\n`);

            // 1. Zod 에러 이벤트를 발송하여 UI에 경고/복구 유도
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('hchps-zod-error', {
                detail: { sheetName, rowId: row.id, errors: result.error.format() }
              }));
            }

            // 2. Sandboxing: 깨진 필드만 기본값으로 자동 보정하여 화면 붕괴(다운타임) 방지
            try {
              const sanitized = sanitizeRowWithFallback(row, schema);
              validRows.push(sanitized);
            } catch (sanitizeErr) {
              console.error('[API Sandboxing] Failed to sanitize row:', sanitizeErr);
            }
          }
        } else {
          validRows.push(row);
        }
      }
      rowValidationCache.set(sheetName, nextSheetRowCache);
      const finalData = validRows as T[];
      const mtime = json.mtime || Date.now();
      const size = json.size || 0;
      clientCache.set(sheetName, {
        mtime,
        size,
        data: finalData,
        lastMetaCheck: now
      });
      // localStorage 오프라인 캐시 저장 (휘발성/오프라인 복원용)
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          try {
            localStorage.setItem(`hchps-fallback-${sheetName}`, JSON.stringify(finalData));
          } catch (lsErr) {
            console.warn(`[sheets-api] Failed to save offline fallback for ${sheetName}:`, lsErr);
          }
        }, 0);
      }
      return finalData;
    } catch (err) {
      console.warn(`[sheets-api] 데이터 읽기 실패: ${sheetName}, 캐시/로컬 복구 시도.`, err);
      
      // 1. 메모리 캐시 반환 시도
      const cached = clientCache.get(sheetName);
      if (cached) {
        console.info(`[sheets-api] 메모리 캐시 데이터를 복구하여 반환합니다: ${sheetName}`);
        return cached.data as T[];
      }
      
      // 2. localStorage 오프라인 백업 반환 시도
      if (typeof window !== 'undefined') {
        try {
          const localFallback = localStorage.getItem(`hchps-fallback-${sheetName}`);
          if (localFallback) {
            const parsed = JSON.parse(localFallback);
            if (Array.isArray(parsed)) {
              console.info(`[sheets-api] localStorage 오프라인 캐시 데이터를 복구하여 반환합니다: ${sheetName}`);
              
              // 메모리 캐시에 적재
              clientCache.set(sheetName, {
                mtime: Date.now(),
                size: localFallback.length,
                data: parsed,
                lastMetaCheck: Date.now()
              });
              
              return parsed as T[];
            }
          }
        } catch (lsErr) {
          console.error(`[sheets-api] localStorage fallback read failed for ${sheetName}:`, lsErr);
        }
      }
      throw err; // Propagate the error so callers (especially React Query or fallback logic) are aware
    } finally {
      inFlightRequests.delete(sheetName);
    }
  })();

  inFlightRequests.set(sheetName, fetchPromise);
  return fetchPromise;
}

// ============ Write ============

async function writeData(sheetName: string, action: string, data?: unknown, id?: string): Promise<boolean> {
  try {
    const payload = data;

    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ sheet: sheetName, action, data: payload, id }),
    });
    
    if (!res.ok) {
      let errMsg = `Data API returned HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson.error) errMsg = errJson.error;
      } catch {}
      throw new Error(errMsg);
    }
    
    const json = await res.json();
    if (json.success === true) {
      // Invalidate memory cache so next query reads fresh SSOT from disk
      clientCache.delete(sheetName);
      return true;
    }
    
    throw new Error(json.error || `Failed to write data to ${sheetName}`);
  } catch (err) {
    console.error(`데이터 쓰기 실패 [${sheetName}/${action}]:`, err);
    throw err;
  }
}


/**
 * 새 행(Row)을 저장소에 추가(Add)합니다.
 * 백그라운드 로직에 의해 E2EE 암호화된 `_enc` 페이로드로 치환되어 서버에 전송됩니다.
 * 
 * @param sheetName - 저장할 대상 시트 이름
 * @param data - 저장할 원본 객체 (암호화 전)
 * @returns 성공 여부 (true/false)
 */
export async function addRow<T>(sheetName: string, data: T): Promise<boolean> {
  return writeData(sheetName, 'add', data);
}

/**
 * 특정 ID의 행(Row) 데이터를 통째로 변경(Update)합니다.
 * 
 * @param sheetName - 저장할 대상 시트 이름
 * @param id - 변경할 대상의 고유 ID 식별자
 * @param data - 변경할 내용의 객체 (재암호화 수행됨)
 * @returns 성공 여부 (true/false)
 */
export async function updateRow<T = Record<string, unknown>>(sheetName: string, id: string, data: T): Promise<boolean> {
  return writeData(sheetName, 'update', data, id);
}

/**
 * 특정 ID의 행(Row) 데이터를 삭제(Delete)합니다.
 * 
 * @param sheetName - 삭제를 수행할 시트 이름
 * @param id - 삭제 대상 식별자 ID
 * @returns 성공 여부 (true/false)
 */
export async function deleteRow(sheetName: string, id: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      const tombstones = getTombstones();
      if (!tombstones.some(t => t.id === id)) {
        tombstones.push({ id, deletedAt: Date.now() });
        localStorage.setItem('hchps-global-tombstones', JSON.stringify(tombstones));
      }
      // 30일 만료된 툼스톤 정리 GC 구동
      purgeExpiredTombstones();
    } catch {}
  }
  return writeData(sheetName, 'delete', undefined, id);
}

/**
 * 저장소의 전체 데이터를 덮어씁니다(Replace All). 동기화 및 마이그레이션 백업 재조립용입니다.
 * 
 * @param sheetName - 대상 시트 이름
 * @param data - 새롭게 완전히 대체할 배열 (각 요소 모두 일괄 암호화 대상)
 * @returns 성공 여부 (true/false)
 */
export async function replaceAll<T>(sheetName: string, data: T[]): Promise<boolean> {
  return writeData(sheetName, 'replace', data);
}

// ============ Config check ============

export function isGoogleSheetsConfigured(): boolean {
  return true; // Always "configured" since we use Local JSON System
}

/**
 * 최신 글로벌 톰스톤 목록을 서버에서 불러와 브라우저 local storage 캐시와 동기화합니다.
 * 서버에서 톰스톤이 지워진 항목(복원된 항목)을 감지하여 클라이언트 local storage 캐시에서도 함께 제거합니다.
 */
export async function syncTombstones(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const serverTombstones = await readSheet<{ id: string; deletedAt?: number } | string>('GLOBAL_TOMBSTONES');
    if (Array.isArray(serverTombstones)) {
      const parsedTombstones = serverTombstones.map(item => {
        if (typeof item === 'string') {
          return { id: item, deletedAt: Date.now() };
        }
        return { id: item.id, deletedAt: item.deletedAt || Date.now() };
      });
      localStorage.setItem('hchps-global-tombstones', JSON.stringify(parsedTombstones));
      console.info('[Tombstone Sync] 글로벌 툼스톤 목록 동기화 완료:', parsedTombstones);
      
      // 동기화 시점에 GC 구동
      purgeExpiredTombstones();
    }
  } catch (err) {
    console.error('[Tombstone Sync] 글로벌 툼스톤 목록 동기화 실패:', err);
  }
}

// ============ Tombstone & Zod Sandbox Helpers ============

/**
 * 툼스톤 캐시 목록을 안전하게 파싱 및 마이그레이션하여 반환합니다.
 */
export function getTombstones(): Array<{ id: string; deletedAt: number }> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('hchps-global-tombstones') || '[]';
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => {
        if (typeof item === 'string') {
          return { id: item, deletedAt: Date.now() }; // 하위 호환 마이그레이션
        }
        return { id: item.id || 'unknown', deletedAt: item.deletedAt || Date.now() };
      });
    }
  } catch {}
  return [];
}

/**
 * 30일이 경과한 노드/간선의 만료된 툼스톤을 영구히 GC 클린업합니다.
 */
export function purgeExpiredTombstones(): void {
  if (typeof window === 'undefined') return;
  try {
    const tombstones = getTombstones();
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    const activeTombstones = tombstones.filter(t => (now - t.deletedAt) < thirtyDays);
    const expiredTombstones = tombstones.filter(t => (now - t.deletedAt) >= thirtyDays);
    
    if (expiredTombstones.length > 0) {
      localStorage.setItem('hchps-global-tombstones', JSON.stringify(activeTombstones));
      console.info(`[Tombstone GC] Purged ${expiredTombstones.length} expired tombstones:`, expiredTombstones);
      
      // Yjs deletedEdgesMap 에서도 툼스톤 동시 삭제
      const globalYProvider = (window as any).__globalYProvider;
      if (globalYProvider && globalYProvider.doc) {
        const ydoc = globalYProvider.doc as Y.Doc;
        const deletedEdgesMap = ydoc.getMap('deletedEdgesMap');
        
        ydoc.transact(() => {
          expiredTombstones.forEach(t => {
            if (deletedEdgesMap.has(t.id)) {
              deletedEdgesMap.delete(t.id);
            }
          });
        });
      }
    }
  } catch (err) {
    console.error('[Tombstone GC] Failed to purge tombstones:', err);
  }
}

/**
 * Zod 검증이 실패한 Row 객체에 대해 스키마 기본 정의 폴백값으로 강제 정화(Sanitize)합니다.
 */
function sanitizeRowWithFallback(row: any, schema: any): any {
  const clean = { ...row };
  if (schema && schema.shape) {
    for (const key of Object.keys(schema.shape)) {
      const fieldSchema = schema.shape[key];
      const fieldResult = fieldSchema.safeParse(clean[key]);
      if (!fieldResult.success) {
        // 1. safeParse(undefined)를 통해 catch() 매핑 기본값 추출 시도
        const fallbackResult = fieldSchema.safeParse(undefined);
        if (fallbackResult.success) {
          clean[key] = fallbackResult.data;
        } else {
          // 2. 강제 깡통 디폴트값 주입
          if (fieldSchema instanceof z.ZodString) clean[key] = '';
          else if (fieldSchema instanceof z.ZodNumber) clean[key] = 0;
          else if (fieldSchema instanceof z.ZodBoolean) clean[key] = false;
          else if (fieldSchema instanceof z.ZodArray) clean[key] = [];
          else if (fieldSchema instanceof z.ZodEnum) clean[key] = (fieldSchema as z.ZodEnum<any>).options[0];
          else clean[key] = null;
        }
      } else {
        clean[key] = fieldResult.data;
      }
    }
  }
  return clean;
}
