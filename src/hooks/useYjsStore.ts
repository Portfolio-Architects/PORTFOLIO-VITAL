'use client';

import '@/lib/bypass-unload';
import { useMemo } from 'react';
import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';
import { IndexeddbPersistence, storeState } from 'y-indexeddb';
import { getAuthToken } from '@/lib/crypto';

declare global {
  interface Window {
    __globalYDoc?: Y.Doc;
    __globalYProvider?: YPartyKitProvider;
    __globalYIndexeddb?: IndexeddbPersistence;
  }
}

// 동시성 트랜잭션 락 상태 관리
let isTransacting = false;

/**
 * Yjs 트랜잭션의 동시성 경합을 원천적으로 제어하고 락(Lock)을 가하는 안전 유틸리티
 */
export async function runSafeTransaction(ydoc: Y.Doc, fn: () => void, retries = 5): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    if (!isTransacting) {
      isTransacting = true;
      try {
        ydoc.transact(fn);
        return;
      } finally {
        isTransacting = false;
      }
    }
    // 경합 발생 시 지수 백오프/지연 후 재시도
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
  }
  // 최종 시도
  ydoc.transact(fn);
}

// 싱글톤 패턴: 앱 전역에서 Y.Doc을 하나만 씁니다 (HMR 환경에서 초기화되는 것 방지)
export const globalYDoc = (typeof window !== 'undefined' && window.__globalYDoc) 
  ? window.__globalYDoc 
  : new Y.Doc();

let globalIndexeddbProvider: IndexeddbPersistence | null = null;
let globalPartyKitProvider: YPartyKitProvider | null = null;

if (typeof window !== 'undefined') {
  window.__globalYDoc = globalYDoc;

  // Initialize global IndexedDB persistence once (guarded for JSDOM / restricted environments)
  if (typeof indexedDB !== 'undefined') {
    if (!window.__globalYIndexeddb) {
      globalIndexeddbProvider = new IndexeddbPersistence('hchps-global', globalYDoc);
      window.__globalYIndexeddb = globalIndexeddbProvider;
    } else {
      globalIndexeddbProvider = window.__globalYIndexeddb;
    }
  }

  // Handle periodic compaction
  let updateCount = 0;
  globalYDoc.on('update', () => {
    updateCount++;
    if (updateCount >= 100 && globalIndexeddbProvider) {
      updateCount = 0;
      try {
        storeState(globalIndexeddbProvider, false);
      } catch {}
    }
  });

  // Optional PartyKit websocket connection
  const useLocalParty = window.localStorage.getItem('use-local-partykit') === 'true';
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const shouldConnectWebSocket = !isLocal || useLocalParty;

  if (shouldConnectWebSocket && !window.__globalYProvider) {
    const host = isLocal ? 'localhost:1999' : 'hchps-party.portfolio-architects.partykit.dev';
    let token = '';
    try {
      token = getAuthToken();
    } catch {}

    globalPartyKitProvider = new YPartyKitProvider(host, 'hchps-global', globalYDoc, {
      connect: true,
      params: { token }
    });
    window.__globalYProvider = globalPartyKitProvider;
  }
}

export function useYjsStore(roomId: string = 'hchps-global') {
  const ydoc = useMemo(() => {
    return roomId === 'hchps-global' ? globalYDoc : new Y.Doc();
  }, [roomId]);

  return { ydoc };
}


