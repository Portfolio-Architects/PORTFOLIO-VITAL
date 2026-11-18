'use client';

import React, { useState } from 'react';
import { Search, FileText, ExternalLink, Scale, Check, AlertCircle, X, ArrowLeft, RefreshCw } from 'lucide-react';
import { useLawSearch, useLawBody, LawSearchItem } from '@/hooks/useLawSearch';

const RECOMMENDATION_CHIPS = [
  { label: '세출예산 집행기준', query: '세출예산 집행기준', target: 'admrul' as const },
  { label: '지방자치단체 조례', query: '지방자치단체 조례', target: 'ordin' as const },
  { label: '강남구 회계 규칙', query: '회계', target: 'ordin' as const },
  { label: '보건소 예산', query: '보건소 예산', target: 'ordin' as const },
];

export function LawSearchPanel() {
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<'law' | 'admrul' | 'ordin'>('admrul'); // Default to admrul for execution standards
  const [selectedMst, setSelectedMst] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState('');

  const searchMutation = useLawSearch();
  const bodyMutation = useLawBody();

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    searchMutation.mutate({
      query: query.trim(),
      target,
      page: 1
    });
  };

  const handleChipClick = (chip: typeof RECOMMENDATION_CHIPS[number]) => {
    setQuery(chip.query);
    setTarget(chip.target);
    searchMutation.mutate({
      query: chip.query,
      target: chip.target,
      page: 1
    });
  };

  const handleViewBody = (item: LawSearchItem) => {
    setSelectedMst(item.id);
    setSelectedTitle(item.title);
    bodyMutation.mutate({
      mst: item.id,
      target,
      type: 'HTML'
    });
  };

  const handleCloseBody = () => {
    setSelectedMst(null);
    setSelectedTitle('');
    bodyMutation.reset();
  };

  const isPending = searchMutation.isPending;
  const errorMsg = searchMutation.error?.message || '';
  const searchResults = searchMutation.data?.items || [];
  const totalCnt = searchMutation.data?.totalCnt || 0;

  return (
    <div className="w-full bg-white/95 border border-slate-200/60 rounded-[2rem] p-6 shadow-xs flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl text-white shadow-md shadow-blue-500/10">
            <Scale size={20} />
          </div>
          <div>
            <h3 className="text-[17px] font-bold text-slate-800 flex items-center gap-2">
              법제처 국가법령 / 자치법규 실시간 연계
            </h3>
            <p className="text-[11px] text-slate-400 font-bold tracking-wider mt-0.5 uppercase">
              National Law & Ordinance API Integration Hub
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full text-[10px] font-black tracking-widest">
          <Check size={10} className="stroke-[3]" /> API CONNECTED
        </div>
      </div>

      {/* Target Selector Tabs */}
      <div className="flex bg-slate-100/80 p-1.5 rounded-2xl w-full border border-slate-200/30">
        <button
          onClick={() => { setTarget('admrul'); searchMutation.reset(); }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer ${
            target === 'admrul'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          중앙부처 집행기준 (행정규칙)
        </button>
        <button
          onClick={() => { setTarget('ordin'); searchMutation.reset(); }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer ${
            target === 'ordin'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          지방자치단체 조례 (자치법규)
        </button>
        <button
          onClick={() => { setTarget('law'); searchMutation.reset(); }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer ${
            target === 'law'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          현행 국가법령
        </button>
      </div>

      {/* Search Input and Recommendation Chips */}
      <div className="flex flex-col gap-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" size={16} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`${
                target === 'admrul' ? '행정규칙명 (예: 세출예산 집행기준)' :
                target === 'ordin' ? '조례/자치법규명 (예: 강남구 조례)' : '법령명 (예: 지방재정법)'
              }을 입력하세요...`}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-3xs cursor-text"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold transition-colors duration-150 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            {isPending ? <RefreshCw size={14} className="animate-spin" /> : '조회하기'}
          </button>
        </form>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-black text-slate-400 tracking-wider mr-1.5">추천 키워드</span>
          {RECOMMENDATION_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(chip)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/40 rounded-xl text-[11px] font-semibold text-slate-600 transition-colors duration-150 cursor-pointer shadow-3xs"
            >
              #{chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Result Display Area */}
      <div className="relative min-h-[150px] border border-slate-100 bg-slate-50/20 rounded-[1.5rem] overflow-hidden flex flex-col">
        
        {/* Loading Spinner */}
        {isPending && (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3 flex-1">
            <span className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"/>
            <span className="text-[11.5px] font-bold text-slate-500 tracking-wide">공공데이터 포털 경유 법제처 연계 서버 응답 대기 중...</span>
          </div>
        )}

        {/* Error Alert */}
        {!isPending && errorMsg && (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-3 text-rose-600 flex-1">
            <AlertCircle size={32} className="opacity-80" />
            <p className="text-xs font-bold">API 호출 장애: {errorMsg}</p>
            <p className="text-[10.5px] text-slate-400 font-semibold mt-1">인증키 적용 여부 및 IP 등록 내역을 확인해 주세요.</p>
          </div>
        )}

        {/* Empty State */}
        {!isPending && searchResults.length === 0 && !errorMsg && (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2 flex-1">
            <FileText size={40} className="opacity-20 mb-1 text-slate-400"/>
            <p className="text-xs font-bold text-slate-500">조회된 정보가 없습니다. 검색어를 입력해 조회를 시작하세요.</p>
          </div>
        )}

        {/* Results List */}
        {!isPending && searchResults.length > 0 && !errorMsg && (
          <div className="flex flex-col flex-1 divide-y divide-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
            <div className="bg-slate-100/50 px-5 py-2.5 flex items-center justify-between text-[10px] font-bold text-slate-500 tracking-wider">
              <span>총 {totalCnt}건의 법규가 매칭되었습니다. (상위 50건 표시)</span>
              <span>정렬: 최신 시행일순</span>
            </div>
            {searchResults.map((item, idx) => (
              <div
                key={idx}
                className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group"
              >
                <div className="flex flex-col gap-1.5 text-left max-w-[80%]">
                  <button
                    onClick={() => handleViewBody(item)}
                    className="font-bold text-slate-800 text-[13.5px] group-hover:text-indigo-600 transition-colors hover:underline text-left cursor-pointer"
                  >
                    {item.title}
                  </button>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-semibold">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/30 text-slate-500 font-bold">
                      {item.agency || '소관기관 미지정'}
                    </span>
                    <span>시행일자: {item.date ? `${item.date.slice(0,4)}-${item.date.slice(4,6)}-${item.date.slice(6,8)}` : '미시행'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewBody(item)}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-xl transition-colors duration-150 border border-indigo-100 cursor-pointer shadow-3xs"
                  >
                    본문 보기 🔍
                  </button>
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200/20"
                      title="국가법령정보센터 원본 페이지 열기"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Law Body Drawer / Backdrop Overlay */}
      {selectedMst && (
        <div className="fixed inset-0 z-[110] flex items-center justify-end bg-slate-900/60 transition-opacity duration-300" onClick={handleCloseBody}>
          <div
            className="w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in pointer-events-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCloseBody}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors mr-1 cursor-pointer"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h4 className="font-extrabold text-[15.5px] text-slate-800 max-w-[500px] truncate">
                    {selectedTitle}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5 uppercase">
                    National Law XML/HTML Document Viewer
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseBody}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar relative">
              {bodyMutation.isPending && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 gap-3">
                  <span className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"/>
                  <span className="text-[11.5px] font-bold text-slate-500 tracking-wide">법령/조례 본문 내용을 로드하는 중...</span>
                </div>
              )}

              {bodyMutation.error && (
                <div className="flex flex-col items-center justify-center p-12 text-rose-600 gap-3">
                  <AlertCircle size={36} />
                  <p className="text-xs font-bold">본문 로드 실패: {bodyMutation.error.message}</p>
                </div>
              )}

              {!bodyMutation.isPending && bodyMutation.data && (
                <div className="bg-white p-8 border border-slate-200 rounded-[1.5rem] shadow-sm max-w-3xl mx-auto text-left leading-relaxed text-sm text-slate-700">
                  {/* Render the raw HTML from lawService.do */}
                  {/* Note: The lawService.do return HTML might have its own stylesheets or structured layout */}
                  <div
                    className="law-html-container font-sans text-xs sm:text-sm text-slate-800"
                    dangerouslySetInnerHTML={{ __html: bodyMutation.data }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
