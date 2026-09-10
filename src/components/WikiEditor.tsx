'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useWikiSync } from '@/hooks/useWikiSync';
import { PartialBlock } from '@blocknote/core';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems, DefaultReactSuggestionItem } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { askLlamaStream } from '@/lib/llm-client';

import '@blocknote/mantine/style.css';

interface WikiEditorProps {
  nodeId: string;
  nodeTitle: string;
  initialBlocks?: PartialBlock[];
  onChange?: (blocks: PartialBlock[]) => void;
  onClose?: () => void;
  addCustomEdge?: (source: string, target: string) => void;
}

const subscribeDarkMode = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const getDarkSnapshot = () => (typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false);
const getDarkServerSnapshot = () => false;

const getCustomSlashMenuItems = (editor: any): DefaultReactSuggestionItem[] => [
  ...getDefaultReactSlashMenuItems(editor),
  {
    title: "AI 문맥 이어쓰기 (Llama 3.1-8B)",
    onItemClick: async () => {
      const currentBlock = editor.getTextCursorPosition().block;
      const aiBlockId = `ai-${Date.now()}`;
      
      editor.insertBlocks([{ id: aiBlockId, type: "paragraph", content: "✨ AI 답변 생성 중..." }], currentBlock, "after");
      
      try {
        const docText = await editor.blocksToMarkdownLossy(editor.document);
        
        const messages = [
          { role: 'system', content: '당신은 HCHPS 워크스페이스의 위키 문서 작성을 돕는 전문 AI 비서(Llama 3.1)입니다. 사용자의 문서 맥락을 파악하고, 이어서 작성할 전문성 있는 내용이나 요약을 제공하세요. markdown 문법을 사용하지 말고 바로 블록에 들어갈 평문으로 답변하세요.' },
          { role: 'user', content: `[현재 문서 컨텍스트]\n${docText}\n\n이 문서의 맥락을 살펴보고, 이어서 자연스럽게 작성할 수 있는 내용으로 뒷부분을 채워주세요.` }
        ];

        let accumulated = "";
        await askLlamaStream(messages, (chunk) => {
          accumulated += chunk;
          editor.updateBlock(aiBlockId, { content: accumulated });
        });
        
        if (!accumulated) {
          editor.updateBlock(aiBlockId, { content: "⚠️ AI가 내용을 생성하지 못했습니다." });
        }
      } catch (err: any) {
        editor.updateBlock(aiBlockId, { content: `⚠️ AI 응답 오류: ${err.message}` });
      }
    },
    aliases: ["ai", "llama", "자동완성", "ai작성"],
    group: "AI 인텔리전스",
    icon: <span className="text-indigo-500 font-bold">✨</span>,
    subtext: "현재 문서의 문맥을 읽고 자연스럽게 내용을 이어서 작성합니다."
  }
];

class SaveStatusStore {
  private message: string = '';
  private listeners: Set<() => void> = new Set();

  setMessage = (msg: string) => {
    this.message = msg;
    this.listeners.forEach((listener) => listener());
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.message;
}

const WikiSaveIndicator = React.memo(function WikiSaveIndicator({
  store,
}: {
  store: SaveStatusStore;
}) {
  const msg = useSyncExternalStore(store.subscribe, store.getSnapshot, () => '');
  if (!msg) return null;
  return (
    <span className="text-xs text-emerald-600 font-medium animate-pulse">
      {msg}
    </span>
  );
});

function WikiEditorComponent(props: WikiEditorProps) {
  const { nodeId, nodeTitle, initialBlocks, onChange, onClose } = props;

  const wikiSyncMutation = useWikiSync();
  const isDark = useSyncExternalStore(subscribeDarkMode, getDarkSnapshot, getDarkServerSnapshot);

  // 에디터 인스턴스 생성 (협업 대신 단일 유저 로컬/클라우드 저장소 사용)
  const editor = useCreateBlockNote({
    initialContent: initialBlocks && initialBlocks.length > 0 ? initialBlocks : undefined
  });

  // 클라우드 데이터가 뒤늦게 도착했을 때 빈 에디터에 내용 강제 주입
  useEffect(() => {
    if (editor && initialBlocks && initialBlocks.length > 0) {
      const doc = editor.document;
      const isEditorEmpty = doc.length === 1 && (!doc[0].content || (Array.isArray(doc[0].content) && doc[0].content.length === 0));
      
      if (isEditorEmpty) {
        editor.replaceBlocks(doc, initialBlocks);
      }
    }
  }, [editor, initialBlocks]);

  const saveStatusStore = React.useMemo(() => new SaveStatusStore(), []);

  const handleCloseAction = React.useCallback(async () => {
    if (onChange && editor) {
      onChange(editor.document);
      saveStatusStore.setMessage('저장 성공!');
    }
    
    if (editor) {
      try {
        const docText = await editor.blocksToMarkdownLossy(editor.document);
        wikiSyncMutation.mutate({
          id: `HCHPS-Wiki-${nodeId}`,
          text: `${nodeTitle}\n\n${docText}`
        });
      } catch (e) {
        console.log('Failed to sync to Vectorize:', e);
      }
    }

    setTimeout(() => onClose?.(), 100);
  }, [editor, nodeId, nodeTitle, onChange, onClose, wikiSyncMutation, saveStatusStore]);

  const handleEditorChange = React.useCallback(() => {
    if (onChange && editor) {
      onChange(editor.document);
      const now = new Date();
      saveStatusStore.setMessage(
        `자동 저장됨 (${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')})`
      );
    }
  }, [editor, onChange, saveStatusStore]);

  const customSlashMenuItems = React.useMemo(() => {
    if (!editor) return [];
    return getCustomSlashMenuItems(editor);
  }, [editor]);

  const handleGetSlashMenuItems = React.useCallback(async (query: string) => {
    const lower = query.toLowerCase();
    const len = customSlashMenuItems.length;
    const filtered = [];
    for (let i = 0; i < len; i++) {
      const item = customSlashMenuItems[i];
      if (item.title.toLowerCase().includes(lower) || (item.aliases && item.aliases.some(a => a.toLowerCase().includes(lower)))) {
        filtered.push(item);
      }
    }
    return filtered;
  }, [customSlashMenuItems]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 relative">
      {/* 윗부분 헤더 */}
      <div className="shrink-0 pt-6 px-8 pb-4 border-b border-[var(--color-border-light)] dark:border-slate-800 flex justify-between items-start">
        <div>
          <div className="text-xs font-semibold text-[var(--color-primary)] mb-1 uppercase tracking-wider">
            Wiki Document
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-white">
            {nodeTitle === 'root-HCHPS' ? '메인 루트 위키' : nodeTitle}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <WikiSaveIndicator store={saveStatusStore} />

          {onClose && (
            <button 
              onClick={handleCloseAction}
              className="p-2 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center rounded-full transition-colors"
              title="닫기"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 에디터 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <BlockNoteView
          editor={editor}
          onChange={handleEditorChange}
          slashMenu={false}
          theme={isDark ? "dark" : "light"}
          className="min-h-full"
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={handleGetSlashMenuItems}
          />
        </BlockNoteView>
      </div>
    </div>
  );
}

WikiEditorComponent.displayName = 'WikiEditor';
export const WikiEditor = React.memo(WikiEditorComponent);
