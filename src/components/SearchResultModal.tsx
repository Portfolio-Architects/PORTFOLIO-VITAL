import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, FileText } from 'lucide-react';
import { useSemanticSearch } from '@/hooks/useSemanticSearch';
import { useDriveSearch } from '@/hooks/useDrive';

const highlightRegexCache = new Map<string, { splitRegex: RegExp; queryLower: string }>();

function highlightKeyword(text: string, query: string): React.ReactNode {
 if (!query || !text) return text;

 let entry = highlightRegexCache.get(query);
 if (!entry) {
 const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
 entry = {
 splitRegex: new RegExp(`(${escaped})`, 'gi'),
 queryLower: query.toLowerCase()
    };
 highlightRegexCache.set(query, entry);
 if (highlightRegexCache.size > 50) {
 highlightRegexCache.clear();
    }
  }

 const parts = text.split(entry.splitRegex);
 const qLower = entry.queryLower;

 return (
    <>
      {parts.map((part, idx) => 
 part.toLowerCase() === qLower 
          ? <mark key={idx} className="highlight">{part}</mark> 
          : part
      )}
    </>
  );
}

export interface SearchResultItem {
 id: string;      
 title: string;   
 context: string; 
 source: string;  
}

export interface VectorResult {
 id: string;
 score?: number;
 metadata?: {
 text?: string;
  };
}

interface SearchResultModalProps {
 isOpen: boolean;
 onClose: () => void;
 query: string;
 results: SearchResultItem[];
 appMode?: 'HCHPS' | 'VITAL';
}

interface SemanticResultCardItemProps {
 doc: VectorResult;
 query: string;
 onOpenNode: (id: string, label: string) => void;
}

const SemanticResultCardItem = React.memo(({ doc, query, onOpenNode }: SemanticResultCardItemProps) => {
 const nodeId = doc.id.replace('HCHPS-Wiki-', '');
 const handleClick = useCallback(() => {
 onOpenNode(nodeId, nodeId);
  }, [nodeId, onOpenNode]);

 return (
    <button 
 type="button"
 onClick={handleClick}
 className="vlds-cv-card text-left flex flex-col gap-2 p-5 bg-white/95 border border-slate-200/50 rounded-2xl shadow-2xs hover:border-indigo-400 hover:bg-white transition-colors cursor-pointer group"
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-[14.5px] font-bold text-slate-800 group-hover:text-[var(--color-primary)] transition-colors">
          <FileText size={15} className="inline mr-1.5 text-indigo-500" /> {nodeId}
        </span>
        <span className="text-[10.5px] font-bold text-indigo-700 bg-indigo-500/10 border border-indigo-500/15 px-2.5 py-1 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-150 whitespace-nowrap shadow-2xs">
          지식스캔 열기 📄
        </span>
      </div>
      <p className="text-[13px] text-slate-600 line-clamp-3 leading-relaxed mt-1 font-medium">
        {highlightKeyword(doc.metadata?.text || '(텍스트 없음)', query)}
      </p>
    </button>
  );
});
SemanticResultCardItem.displayName = 'SemanticResultCardItem';

interface LocalResultCardItemProps {
 result: SearchResultItem;
 query: string;
 onOpenNode: (id: string, label: string) => void;
}

const LocalResultCardItem = React.memo(({ result, query, onOpenNode }: LocalResultCardItemProps) => {
 const nodeId = result.id.replace('HCHPS-Wiki-', '');
 const displayTitle = result.title.replace('온톨로지 문서 (', '').replace(')', '');
 const handleClick = useCallback(() => {
 onOpenNode(nodeId, displayTitle);
  }, [nodeId, displayTitle, onOpenNode]);

 return (
    <button 
 type="button"
 onClick={handleClick}
 className="vlds-cv-card text-left flex flex-col gap-2 p-5 bg-white/95 border border-slate-200/50 rounded-2xl shadow-2xs hover:border-orange-400 hover:bg-white transition-colors cursor-pointer group"
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-[14.5px] font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
          <FileText size={15} className="inline mr-1.5 text-orange-500" /> {displayTitle}
        </span>
        <span className="text-[10.5px] font-bold text-orange-700 bg-orange-500/10 border border-orange-500/15 px-2.5 py-1 rounded-lg group-hover:bg-orange-500 group-hover:text-white transition-colors duration-150 whitespace-nowrap shadow-2xs">
          로컬 문서 열기 📄
        </span>
      </div>
      <p className="text-[13px] text-slate-600 line-clamp-3 leading-relaxed mt-1 font-medium">
        {highlightKeyword(result.context, query)}
      </p>
    </button>
  );
});
LocalResultCardItem.displayName = 'LocalResultCardItem';

interface DriveFileResult {
 fileName: string;
 relPath: string;
 fullPath: string;
 count: number;
 snippets: Array<{ snippet: string }>;
}

interface DriveResultCardItemProps {
 res: DriveFileResult;
 idx: number;
 isExpanded: boolean;
 copiedPath: string | null;
 query: string;
 onCopyPath: (pathStr: string) => void;
 onToggleExpand: (idx: number) => void;
}

const DriveResultCardItem = React.memo(({
 res,
 idx,
 isExpanded,
 copiedPath,
 query,
 onCopyPath,
 onToggleExpand
}: DriveResultCardItemProps) => {
 const handleCopy = useCallback(() => {
 onCopyPath(res.fullPath);
  }, [onCopyPath, res.fullPath]);

 const handleToggle = useCallback(() => {
 onToggleExpand(idx);
  }, [onToggleExpand, idx]);

 return (
    <div 
 className="flex flex-col p-5 bg-white/80 border border-slate-200/50 rounded-2xl shadow-2xs hover:shadow-xs transition-colors duration-150"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col text-left">
          <span className="text-[14px] font-extrabold text-slate-800">
            📄 {res.fileName}
          </span>
          <span className="text-[10px] text-slate-500 font-bold tracking-wide mt-1">
            📂 {res.relPath}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-extrabold text-emerald-800 bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-1 rounded-lg">
            {res.count}회 매칭
          </span>
          <button
 type="button"
 onClick={handleCopy}
 className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg border transition-colors duration-150 cursor-pointer whitespace-nowrap shadow-2xs ${
 copiedPath === res.fullPath
                ? 'bg-emerald-500 text-white border-emerald-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {copiedPath === res.fullPath ? '복사 완료 ✓' : '경로 복사 📋'}
          </button>
          <button
 type="button"
 onClick={handleToggle}
 className="px-2.5 py-1 text-[10.5px] font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap shadow-2xs"
          >
            {isExpanded ? '닫기 ▴' : '문맥 보기 ▾'}
          </button>
        </div>
      </div>

      {/* Snippets Accordion Area */}
      {isExpanded && (
        <div className="mt-4 pt-3.5 border-t border-slate-200/50 flex flex-col gap-2.5">
          <p className="text-[10.5px] font-extrabold text-slate-400 tracking-widest uppercase mb-1">📝 본문 검색 일치 문맥</p>
          {res.snippets.map((snip, sIdx) => (
            <div key={sIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/30 text-[12px] text-slate-600 font-medium leading-relaxed">
              {highlightKeyword(snip.snippet, query)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
DriveResultCardItem.displayName = 'DriveResultCardItem';

function SearchResultModalComponent({ isOpen, onClose, query, results: localResults, appMode = 'VITAL' }: SearchResultModalProps) {
 const [activeTab, setActiveTab] = useState<'wiki' | 'file'>('file');
 const [copiedPath, setCopiedPath] = useState<string | null>(null);
 const [expandedFileIdx, setExpandedFileIdx] = useState<number | null>(null);

 const semanticSearchMutation = useSemanticSearch();
 const driveSearchMutation = useDriveSearch();

 const { mutate: mutateSemantic } = semanticSearchMutation;
 const { mutate: mutateDrive } = driveSearchMutation;

 useEffect(() => {
 if (!isOpen || !query) return;

 window.dispatchEvent(new CustomEvent('wiki:closeNode'));

    // 1. 위키 시맨틱 벡터 검색 트리거
 mutateSemantic({
 query,
 limit: 5
    });

    // 2. 로컬 아카이브 문서 본문 검색 트리거
 mutateDrive({ query });
  }, [isOpen, query, mutateSemantic, mutateDrive]);

 const handleCopyPath = useCallback((pathStr: string) => {
 navigator.clipboard.writeText(pathStr)
      .then(() => {
 setCopiedPath(pathStr);
 setTimeout(() => setCopiedPath(null), 1500);
      })
      .catch(() => {});
  }, []);

 const handleOpenNode = useCallback((id: string, label: string) => {
 window.dispatchEvent(new CustomEvent('wiki:openNode', {
 detail: { id, label }
    }));
 onClose();
  }, [onClose]);

 const handleToggleExpandFile = useCallback((idx: number) => {
 setExpandedFileIdx(prev => prev === idx ? null : idx);
  }, []);

 const handleSetWikiTab = useCallback(() => setActiveTab('wiki'), []);
 const handleSetFileTab = useCallback(() => setActiveTab('file'), []);

 if (!isOpen) return null;

 const isPending = semanticSearchMutation.isPending;
 const isDrivePending = driveSearchMutation.isPending;
 const semanticResults = semanticSearchMutation.data || [];
 const errorMsg = semanticSearchMutation.error ? (semanticSearchMutation.error as Error).message : '';
 const driveResults = driveSearchMutation.data || [];
 const driveError = driveSearchMutation.error ? (driveSearchMutation.error as Error).message : '';

 return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 transition-opacity duration-300" onClick={onClose}>
      <div 
 className="pointer-events-auto glass-panel rounded-2xl shadow-md w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] transition-transform duration-300 scale-100"
 onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/20 bg-gradient-to-r from-indigo-500/5 to-blue-500/5 flex-shrink-0">
          <div className="flex items-center gap-3 text-[var(--color-primary)]">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-sm">
              <Search size={20} />
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-slate-800 flex items-center gap-2">
                {appMode} 지식 및 파일 통합 검색
              </h3>
              <p className="text-[11px] text-slate-500 font-bold tracking-wide mt-0.5">🔍 &quot;{query}&quot; 통합 검색 결과</p>
            </div>
          </div>
          <button 
 type="button"
 onClick={onClose}
 className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors duration-150 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-slate-200/50 bg-slate-50/50 px-6 py-2 flex-shrink-0 gap-2">
          <button
 type="button"
 onClick={handleSetWikiTab}
 className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors duration-150 cursor-pointer ${
 activeTab === 'wiki'
                ? 'bg-indigo-500 text-white shadow-xs'
                : 'text-slate-500 hover:bg-slate-200/50'
            }`}
          >
            💡 사내 지식 위키 검색 ({isPending ? '...' : semanticResults.length + localResults.length})
          </button>
          <button
 type="button"
 onClick={handleSetFileTab}
 className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors duration-150 cursor-pointer ${
 activeTab === 'file'
                ? 'bg-blue-500 text-white shadow-xs'
                : 'text-slate-500 hover:bg-slate-200/50'
            }`}
          >
            📂 로컬 문서 본문 검색 ({isDrivePending ? '...' : driveResults.length})
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/20 custom-scrollbar flex flex-col gap-4">
          
          {/* TAB 1: Wiki Semantic Search */}
          {activeTab === 'wiki' && (
            <>
              {isPending && (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
                  <span className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"/>
                  <span className="text-xs font-semibold tracking-wide">지식베이스 검색 중...</span>
                </div>
              )}
              
              {!isPending && errorMsg && localResults.length === 0 && (
                <div className="text-xs font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-2">
                  <X size={15} /> 지식 검색 장애: {errorMsg}
                </div>
              )}

              {!isPending && semanticResults.length === 0 && localResults.length === 0 && !errorMsg && (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                  <Search size={36} className="opacity-25 mb-1.5 text-slate-400"/>
                  <p className="text-[13px] font-bold text-slate-500">관련 문서 없음</p>
                </div>
              )}

              {!isPending && (semanticResults.length > 0 || localResults.length > 0) && (
                <div className="flex flex-col gap-3.5">
                  {semanticResults.length > 0 
                    ? semanticResults.map((doc, idx) => (
                        <SemanticResultCardItem
 key={`sem-${idx}`}
 doc={doc}
 query={query}
 onOpenNode={handleOpenNode}
                        />
                      ))
                    : localResults.map((res, idx) => (
                        <LocalResultCardItem
 key={`loc-${idx}`}
 result={res}
 query={query}
 onOpenNode={handleOpenNode}
                        />
                      ))
                  }

                  {semanticResults.length === 0 && localResults.length > 0 && (
                    <div className="mt-1 text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/15 p-3.5 rounded-xl leading-relaxed font-semibold">
 Vectorize 결과 없음 · 브라우저 로컬 캐시 표시
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* TAB 2: Local File Content Search */}
          {activeTab === 'file' && (
            <>
              {isDrivePending && (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
                  <span className="w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"/>
                  <span className="text-xs font-semibold tracking-wide">F:\부엉이_정리됨 내 모든 HWPX, PDF 본문 고속 스캔 중...</span>
                </div>
              )}

              {!isDrivePending && driveError && (
                <div className="text-xs font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-2">
                  <X size={15} /> 본문 검색 장애: {driveError}
                </div>
              )}

              {!isDrivePending && driveResults.length === 0 && !driveError && (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                  <Search size={36} className="opacity-25 mb-1.5 text-slate-400"/>
                  <p className="text-[13px] font-bold text-slate-500">본문 일치 파일 없음</p>
                </div>
              )}

              {!isDrivePending && driveResults.length > 0 && (
                <div className="flex flex-col gap-3.5">
                  {driveResults.map((res, idx) => (
                    <DriveResultCardItem
 key={`drive-${idx}`}
 res={res}
 idx={idx}
 isExpanded={expandedFileIdx === idx}
 copiedPath={copiedPath}
 query={query}
 onCopyPath={handleCopyPath}
 onToggleExpand={handleToggleExpandFile}
                    />
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}

SearchResultModalComponent.displayName = 'SearchResultModal';
export const SearchResultModal = React.memo(SearchResultModalComponent);

