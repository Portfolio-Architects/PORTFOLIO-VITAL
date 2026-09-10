import { useState, useCallback, useEffect, useRef } from 'react';
import type { PartialBlock } from '@blocknote/core';
import type { NodeOverride } from './useGraphCustomization';
import { readSheet, replaceAll } from '@/lib/sheets-api';
import { extractRawTextFromBlocks, parseContacts } from '@/lib/contacts-parser';
import { useLocalContacts } from './useLocalContacts';

/**
 * 특정 노드(nodeId)에 해당하는 위키(에디터 블록 구조)를
 * localStorage 및 클라우드(KV)와 동기화하는 훅
 */
export function getCanonicalWikiId(nodeId: string): string {
  if (nodeId.startsWith('leaf-')) {
    // leaf-tag-예산-비만예방 -> leaf-kw-비만예방
    if (nodeId.startsWith('leaf-tag-')) {
      const parts = nodeId.split('-');
      if (parts.length >= 4) {
        return `leaf-kw-${parts.slice(3).join('-')}`;
      }
    }
    const parts = nodeId.split('-');
    if (parts[1] === 'kw') {
      return nodeId;
    }
    return `leaf-kw-${parts.slice(1).join('-')}`;
  }
  return nodeId;
}

let cachedMapStoreRaw: string | null = null;
let cachedMapStoreParsed: any = null;

function getParsedMapStore(): any {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('hchps-map-customization');
  if (!raw) {
    cachedMapStoreRaw = null;
    cachedMapStoreParsed = null;
    return null;
  }
  if (raw === cachedMapStoreRaw && cachedMapStoreParsed !== null) {
    return cachedMapStoreParsed;
  }
  try {
    cachedMapStoreRaw = raw;
    cachedMapStoreParsed = JSON.parse(raw);
    return cachedMapStoreParsed;
  } catch {
    return null;
  }
}

/**
 * 특정 노드(nodeId)에 해당하는 위키(에디터 블록 구조)를
 * localStorage 및 클라우드(KV)와 동기화하는 훅
 */
function findOriginalCustomNodeId(mapStoreData: any, label: string): string | null {
  if (!mapStoreData) return null;
  const customNodes = mapStoreData.customNodes || [];
  const overrides = mapStoreData.overrides || {};
  
  for (const cn of customNodes) {
    const override = overrides[cn.id];
    const actualLabel = override?.customLabel || cn.label;
    if (actualLabel === label) {
      return cn.id;
    }
  }
  return null;
}

/**
 * 특정 노드(nodeId)에 해당하는 위키(에디터 블록 구조)를
 * localStorage 및 클라우드(KV)와 동기화하는 훅
 */
export function useWikiStorage(
  nodeId: string | null,
  nodeLabel?: string | null,
  setNodeOverride?: (id: string, override: Partial<NodeOverride>) => void
) {
  const { recordContactMutation } = useLocalContacts();
  const [blocks, setBlocks] = useState<PartialBlock[] | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadedNodeId, setLoadedNodeId] = useState<string | null>(null);
  const syncTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const pendingBlocksRef = useRef<Record<string, { nodeId: string; canonicalId: string; blocks: PartialBlock[] }>>({});
  const isFetchedRef = useRef(false);

  // Auto-flush any pending debounce sync saves on unmount
  useEffect(() => {
    return () => {
      const timers = syncTimersRef.current;
      for (const k in timers) {
        if (Object.prototype.hasOwnProperty.call(timers, k)) {
          clearTimeout(timers[k]);
        }
      }

      // Flush pending blocks to disk immediately so navigating away never loses edits
      const pending = pendingBlocksRef.current;
      for (const canonicalId in pending) {
        if (Object.prototype.hasOwnProperty.call(pending, canonicalId)) {
          const item = pending[canonicalId];
          if (item && item.blocks) {
            replaceAll(`WIKI_DOC_${canonicalId}`, [{ id: 'singleton', blocks: item.blocks }])
              .then(() => {
                console.log(`[Auto-Flush on Unmount] Wiki ${canonicalId} saved to disk SSOT.`);
              })
              .catch((err) => {
                console.error(`[Auto-Flush on Unmount] Failed to flush wiki ${canonicalId}:`, err);
              });
          }
        }
      }
    };
  }, []);

  // 로컬/클라우드 병합 로드
  useEffect(() => {
    if (!nodeId) {
      setBlocks(undefined);
      setIsLoaded(false);
      setLoadedNodeId(null);
      isFetchedRef.current = false;
      return;
    }

    let isCancelled = false;
    setIsLoaded(false); // 로딩 완료 전까지 UI 마운트 차단 (레이스 컨디션 및 오버라이트 방지)
    setLoadedNodeId(nodeId);
    isFetchedRef.current = false;

    const canonicalWikiId = getCanonicalWikiId(nodeId);

    // 1. 빠른 렌더링을 위해 로컬에서 먼저 읽음 (새로운 캐시 또는 오래된 캐시 모두 확인)
    let stored = localStorage.getItem(`HCHPS-Wiki-${canonicalWikiId}`);
    if (!stored && canonicalWikiId !== nodeId) {
      stored = localStorage.getItem(`HCHPS-Wiki-${nodeId}`);
      if (stored) {
        // 오래된 로컬 캐시가 있으면 새로운 캐시 키로 마이그레이션 저장
        localStorage.setItem(`HCHPS-Wiki-${canonicalWikiId}`, stored);
      }
    }
    let initialBlocks: PartialBlock[] | undefined = undefined;

    if (stored) {
      try {
        initialBlocks = JSON.parse(stored);
      } catch (e) {
        console.error("Wiki Loading Error", e);
      }
    }

    // 5W1H 실시간(JIT) 마이그레이션 - 문서 열람 시점에 병합
    let originalCustomNodeId: string | null = null;
    try {
      const data = getParsedMapStore();
      if (data) {
        // 데이터 노드와 겹치는 기존 화이트보드 커스텀 노드가 있었는지 식별
        if (nodeLabel) {
          originalCustomNodeId = findOriginalCustomNodeId(data, nodeLabel);
        }

        const override = data?.overrides?.[nodeId];
        if (override?.story5W1H) {
           const hasMigration = JSON.stringify(initialBlocks || []).includes('5W1H 정보 (마이그레이션)');
           if (!hasMigration) {
              const { who, department, title, contact, when, where, what, how, why } = override.story5W1H;
              if (who || department || title || contact || when || where || what || how || why) {
                const migrationBlocks: PartialBlock[] = [
                  { type: "heading", props: { level: 2 }, content: "5W1H 정보 (마이그레이션)" }
                ];
                if (who) migrationBlocks.push({ type: "paragraph", content: `**누구(Who):** ${who}` });
                if (department) migrationBlocks.push({ type: "paragraph", content: `**소속:** ${department}` });
                if (title) migrationBlocks.push({ type: "paragraph", content: `**직함:** ${title}` });
                if (contact) migrationBlocks.push({ type: "paragraph", content: `**연락처:** ${contact}` });
                if (when) migrationBlocks.push({ type: "paragraph", content: `**언제(When):** ${when}` });
                if (where) migrationBlocks.push({ type: "paragraph", content: `**어디서(Where):** ${where}` });
                if (what) migrationBlocks.push({ type: "paragraph", content: `**무엇을(What):** ${what}` });
                if (how) migrationBlocks.push({ type: "paragraph", content: `**어떻게(How):** ${how}` });
                if (why) migrationBlocks.push({ type: "paragraph", content: `**왜(Why):** ${why}` });

                if (!initialBlocks || (initialBlocks.length === 1 && (!initialBlocks[0].content || (initialBlocks[0].content as unknown[]).length === 0))) {
                  initialBlocks = migrationBlocks;
                } else {
                  initialBlocks = [...migrationBlocks, {type: "paragraph", content: ""}, ...initialBlocks];
                }
                
                // 마이그레이션된 데이터를 즉시 저장
                localStorage.setItem(`HCHPS-Wiki-${canonicalWikiId}`, JSON.stringify(initialBlocks));
              }
           }
           
           // 기존 5W1H 마스터본을 메모리 상태 레벨(useGraphCustomization)에서 안전하게 삭제 (좀비 방지)
           if (setNodeOverride) {
             setNodeOverride(nodeId, { story5W1H: undefined });
           } else {
             // Fallback
             delete data.overrides[nodeId].story5W1H;
             localStorage.setItem('hchps-map-customization', JSON.stringify(data));
           }
        }
      }
    } catch {}

    // 2. 비동기 클라우드 동기화 (클라우드 데이터가 존재하면 로컬 덮어씌움)
    const fetchCloud = async () => {
      try {
        // A. 먼저 새로운 canonicalWikiId 경로로 시도
        let rows = await readSheet<any>(`WIKI_DOC_${canonicalWikiId}`);
        let loadedBlocks: PartialBlock[] | null = null;
        let migrationSourceSheet: string | null = null;

        if (rows && rows.length > 0 && rows[0].id === 'singleton' && rows[0].blocks) {
          loadedBlocks = rows[0].blocks;
        } else {
          // B. 새로운 경로에 없으면 오래된 nodeId 경로로 시도 (하위 호환성 폴백)
          if (canonicalWikiId !== nodeId) {
            const oldRows = await readSheet<any>(`WIKI_DOC_${nodeId}`);
            if (oldRows && oldRows.length > 0 && oldRows[0].id === 'singleton' && oldRows[0].blocks) {
              loadedBlocks = oldRows[0].blocks;
              migrationSourceSheet = `WIKI_DOC_${nodeId}`;
            }
          }
          
          // C. 그래도 없으면, 혹시 이 데이터 노드와 합쳐진 기존 커스텀 화이트보드 노드가 있었는지 체크 및 이관
          if (!loadedBlocks && originalCustomNodeId) {
            const customRows = await readSheet<any>(`WIKI_DOC_${originalCustomNodeId}`);
            if (customRows && customRows.length > 0 && customRows[0].id === 'singleton' && customRows[0].blocks) {
              loadedBlocks = customRows[0].blocks;
              migrationSourceSheet = `WIKI_DOC_${originalCustomNodeId}`;
              console.info(`[Wiki Migration] Found merged custom node wiki WIKI_DOC_${originalCustomNodeId} for label ${nodeLabel}, preparing migration`);
            }
          }
        }

        if (isCancelled) return;

        // 서버 조회 혹은 local fallback이 정상 완료되었음을 식별 (네트워크/암호화 실패 시 false 유지)
        isFetchedRef.current = true;

        if (loadedBlocks) {
          setBlocks(loadedBlocks);
          localStorage.setItem(`HCHPS-Wiki-${canonicalWikiId}`, JSON.stringify(loadedBlocks));
          
          // 이전 경로에서 가져온 데이터인 경우 새로운 Canonical 경로로 즉시 마이그레이션 저장
          if (migrationSourceSheet) {
            replaceAll(`WIKI_DOC_${canonicalWikiId}`, [{ id: 'singleton', blocks: loadedBlocks }]).then(() => {
              console.info(`[Wiki Migration] Successfully migrated ${migrationSourceSheet} to WIKI_DOC_${canonicalWikiId}`);
            }).catch(err => {
              console.warn(`[Wiki Migration] Failed to migrate server file to canonical path`, err);
            });
          }
        } else {
          // 서버에 전혀 데이터가 존재하지 않는 신규 노드인 경우 로컬 캐시 적용
          setBlocks(initialBlocks);
        }
      } catch (e) {
        if (!isCancelled) {
          console.error('Failed to fetch wiki from cloud', e);
          // E2EE 복호화 에러나 네트워크 실패인 경우 안전하게 로컬 캐시 폴백하되, 서버 저장은 차단 (isFetchedRef=false)
          setBlocks(initialBlocks);
        }
      } finally {
        if (!isCancelled) {
          setIsLoaded(true);
        }
      }
    };
    fetchCloud();

    return () => {
      isCancelled = true;
    };
  }, [nodeId, nodeLabel, setNodeOverride]);

  // 새로운 블록 배열 저장 (자동 클라우드 백업)
  const saveBlocks = useCallback((nodeIdToSave: string, newBlocks: PartialBlock[]) => {
    if (!nodeIdToSave) return;
    
    const canonicalId = getCanonicalWikiId(nodeIdToSave);
    
    // 로컬 보존 1순위
    localStorage.setItem(`HCHPS-Wiki-${canonicalId}`, JSON.stringify(newBlocks));

    // 안전장치: 클라우드 데이터를 성공적으로 패치하지 못한 상태(복호화 오류/네트워크 순단)라면,
    // 서버의 원본 데이터를 잘못 덮어쓰지(overwrite) 않도록 자동 저장을 중단함
    if (!isFetchedRef.current) {
      console.warn(`[Auto-Save Blocked] Skip saving ${canonicalId} to cloud because it was not loaded successfully.`);
      return;
    }

    // 디바운스 클라우드 백업 (2초 유지 후 업로드) - 노드 단위로 독립 타이머
    pendingBlocksRef.current[canonicalId] = { nodeId: nodeIdToSave, canonicalId, blocks: newBlocks };

    if (syncTimersRef.current[canonicalId]) {
      clearTimeout(syncTimersRef.current[canonicalId]);
    }
    syncTimersRef.current[canonicalId] = setTimeout(async () => {
      delete pendingBlocksRef.current[canonicalId];
      try {
        await replaceAll(`WIKI_DOC_${canonicalId}`, [{ id: 'singleton', blocks: newBlocks }]);
        console.log(`[Auto-Save] Wiki ${canonicalId} uploaded to cloud.`);

        // Auto-sync contacts to local_contacts.txt when successfully saved
        const rawText = extractRawTextFromBlocks(newBlocks);
        const { phones, emails } = parseContacts(rawText);
        if (phones.length > 0 || emails.length > 0) {
          await recordContactMutation.mutateAsync({
            nodeId: nodeIdToSave,
            nodeLabel: nodeLabel || nodeIdToSave,
            phones,
            emails
          });
        }
      } catch (error) {
        console.error(`[Auto-Save] Wiki ${canonicalId} upload failed or contacts auto-sync failed.`, error);
      }
    }, 2000);
  }, [nodeLabel, recordContactMutation]);

  const safeBlocks = loadedNodeId === nodeId ? blocks : undefined;
  const safeIsLoaded = loadedNodeId === nodeId ? isLoaded : false;

  return { blocks: safeBlocks, isLoaded: safeIsLoaded, saveBlocks };
}
