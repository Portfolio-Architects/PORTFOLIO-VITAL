'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  FolderOpen,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Presentation,
  RefreshCw,
  Layers,
  LayoutGrid,
  List,
  Sparkles,
  Calendar,
  Tag,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useArchiveExplorer } from '@/hooks/useArchiveExplorer';
import { ArchiveItem } from '@/types/archive';

const PROJECT_LABELS: Record<string, string> = {
  '01_기획총괄_주요업무_행감': '01 기획총괄·주요업무·행감',
  '02_예산회계_보조금_일상경비': '02 예산회계·보조금·일상경비',
  '03_양재천_건강페스티벌': '03 양재천 건강페스티벌',
  '04_서울체력장_AI메디헬스_메디런': '04 서울체력장·AI메디헬스·메디런',
  '05_어린이_아이뛰움_바른자세': '05 어린이 아이뛰움·바른자세',
  '06_비만예방_건강뜀_합동캠페인': '06 비만예방·건강뜀·합동캠페인',
  '07_손목닥터9988_스마트헬스': '07 손목닥터9988·스마트헬스',
  '08_통합건강증진_지역보건의료계획': '08 통합건강증진·지역보건계획',
  '09_일반행정_보안_법령_기타': '09 일반행정·보안·법령·기타',
};

const QUICK_SEARCH_CHIPS = [
  '양재천 페스티벌',
  '서울체력장',
  'AI 메디헬스',
  '아이뛰움',
  '손목닥터9988',
  '행정사무감사',
  '본예산 사업설명서',
  '수의계약',
  '포스터 현수막',
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function formatProjectName(raw: string): string {
  if (PROJECT_LABELS[raw]) return PROJECT_LABELS[raw];
  return raw.replace(/_/g, ' ');
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (tokens.length === 0) return <>{text}</>;

  const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-amber-100 text-slate-900 font-semibold px-0.5 rounded-xs"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

function FileCategoryIcon({ item }: { item: ArchiveItem }) {
  if (item.category === 'image') {
    return <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />;
  }
  if (item.category === 'sheet') {
    return <FileSpreadsheet className="w-4 h-4 text-green-700 shrink-0" />;
  }
  if (item.category === 'slide') {
    return <Presentation className="w-4 h-4 text-orange-600 shrink-0" />;
  }
  return <FileText className="w-4 h-4 text-slate-700 shrink-0" />;
}

export function ArchiveExplorerView() {
  const {
    query,
    setQuery,
    year,
    setYear,
    project,
    setProject,
    category,
    setCategory,
    imageCategory,
    setImageCategory,
    viewMode,
    setViewMode,
    selectedId,
    selectItemForCluster,
    data,
    loading,
    reindexing,
    actionToast,
    openArchiveTarget,
    triggerReindex,
  } = useArchiveExplorer({ initialYear: '2026년' });

  const [previewImage, setPreviewImage] = useState<ArchiveItem | null>(null);

  const yearsList = useMemo(() => {
    const baseYears = ['ALL', '2026년', '2025년', '2024년', '2023년', '2022년', '2021년', '2020년', '2019년', '2018년'];
    return baseYears;
  }, []);

  const projectOptions = useMemo(() => {
    if (year === '2026년') {
      return Object.keys(PROJECT_LABELS);
    }
    if (!data?.facets?.projects) return Object.keys(PROJECT_LABELS);
    return Object.keys(data.facets.projects).slice(0, 15);
  }, [year, data]);

  const handleQuickChip = useCallback(
    (chip: string) => {
      if (query === chip) {
        setQuery('');
      } else {
        setQuery(chip);
      }
    },
    [query, setQuery]
  );

  const items = data?.items || [];
  const cluster = data?.cluster || null;

  return (
    <div
      data-testid="archive-explorer-view"
      className="w-full flex flex-col gap-5 pb-12 text-slate-900"
    >
      {/* Action Toast */}
      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* Top Header & Full-Text Search Bar */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                마스터 아카이브 통합 탐색기
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                총 {data?.totalIndexed?.toLocaleString() || 0}건 색인됨
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              파일명에 키워드가 없어도 문서 본문(.hwpx/.hwp/.pdf/.xlsx), 동의어 추론, 사진 촬영·사업 맥락으로 즉시 검색합니다.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* View Mode Toggle */}
            <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>문서·통합 목록</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('gallery')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'gallery'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>사진·시안 갤러리</span>
              </button>
            </div>

            <button
              type="button"
              onClick={triggerReindex}
              disabled={reindexing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 transition-colors cursor-pointer disabled:opacity-50"
              title="F:\_Organized_Archive 본문 및 사진 색인 새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{reindexing ? '색인 중...' : '색인 갱신'}</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="찾으실 키워드를 입력하세요 (예: 양재천 과업내용서, 체력장 장비 사진, 2027 가내시, 바른자세, 수의계약...)"
            className="w-full pl-11 pr-10 py-3 bg-slate-50/70 focus:bg-white border border-slate-200/90 focus:border-slate-400 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="검색어 지우기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Search Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-slate-500" />
            추천 검색:
          </span>
          {QUICK_SEARCH_CHIPS.map((chip) => {
            const active = query === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => handleQuickChip(chip)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>

        {/* Year & Category Filter Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Year Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">연도:</span>
            {yearsList.map((yr) => {
              const active = year === yr;
              const cnt = yr === 'ALL' ? data?.totalIndexed : data?.facets?.years?.[yr];
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setYear(yr);
                    setProject('ALL');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200/80'
                  }`}
                >
                  {yr === 'ALL' ? '전체 연도' : yr}
                  {cnt !== undefined ? ` (${cnt})` : ''}
                </button>
              );
            })}
          </div>

          {/* File Type or Image Category Filter */}
          {viewMode === 'list' ? (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">자료유형:</span>
              {[
                { id: 'ALL', label: '전체' },
                { id: 'doc', label: '공문·문서(.hwpx/.pdf)' },
                { id: 'sheet', label: '예산·시트(.xlsx)' },
                { id: 'slide', label: '발표자료(.pptx)' },
                { id: 'image', label: '사진·시안(.jpg/.png)' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                    category === cat.id
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200/80'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">사진분류:</span>
              {[
                { id: 'ALL', label: '전체 이미지' },
                { id: 'photo', label: '현장·수행·장비 사진' },
                { id: 'poster', label: '포스터·현수막·시안' },
                { id: 'logo', label: 'CI·로고·슬로건' },
              ].map((ic) => (
                <button
                  key={ic.id}
                  type="button"
                  onClick={() => setImageCategory(ic.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                    imageCategory === ic.id
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200/80'
                  }`}
                >
                  {ic.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Core Project Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-xs font-semibold text-slate-500 mr-1">단위사업 폴더:</span>
          <button
            type="button"
            onClick={() => setProject('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
              project === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
            }`}
          >
            전체 사업
          </button>
          {projectOptions.map((projKey) => {
            const active = project === projKey;
            const cnt = data?.facets?.projects?.[projKey];
            return (
              <button
                key={projKey}
                type="button"
                onClick={() => setProject(active ? 'ALL' : projKey)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80'
                }`}
              >
                {formatProjectName(projKey)}
                {cnt !== undefined ? ` (${cnt})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Split: Search Results (Left 7 cols) + Linked Project Cluster (Right 5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Column: Results List or Photo Gallery */}
        <div className="xl:col-span-7 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {viewMode === 'gallery' ? '사진·시안 썸네일 갤러리' : '검색 및 본문 추론 결과'}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                ({data?.totalMatched?.toLocaleString() || 0}건 일치)
              </span>
            </div>
            {loading && (
              <span className="text-xs text-slate-500 animate-pulse">조회 중...</span>
            )}
          </div>

          {items.length === 0 && !loading ? (
            <div className="p-12 text-center flex flex-col items-center gap-2">
              <Search className="w-8 h-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">
                조건에 일치하는 파일이 없습니다.
              </p>
              <p className="text-xs text-slate-500">
                연도 또는 단위사업 필터를 &apos;전체&apos;로 변경하거나 다른 연관 키워드로 검색해 보세요.
              </p>
            </div>
          ) : viewMode === 'gallery' ? (
            /* Photo Thumbnail Grid Mode */
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[760px] overflow-y-auto">
              {items.map((item) => {
                const isSelected = selectedId === item.id;
                const imgUrl = `/api/archive/image?path=${encodeURIComponent(item.relPath)}`;
                return (
                  <div
                    key={item.id}
                    onClick={() => selectItemForCluster(item)}
                    className={`group rounded-xl border overflow-hidden flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-slate-900 ring-2 ring-slate-900/10 bg-slate-50/70'
                        : 'border-slate-200/80 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div
                      className="relative w-full h-36 bg-slate-100 overflow-hidden flex items-center justify-center"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(item);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgUrl}
                        alt={item.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/75 text-white backdrop-blur-xs">
                        {item.imageCategory === 'poster'
                          ? '포스터·시안'
                          : item.imageCategory === 'logo'
                          ? 'CI·로고'
                          : '현장사진'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage(item);
                        }}
                        className="absolute bottom-2 right-2 px-2 py-1 rounded-md text-[11px] font-semibold bg-white/90 hover:bg-white text-slate-900 shadow-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        크게 보기
                      </button>
                    </div>

                    <div className="p-3 flex flex-col gap-1.5">
                      <div className="text-xs font-bold text-slate-900 truncate" title={item.name}>
                        <HighlightedText text={item.name} query={query} />
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {item.year} · {formatProjectName(item.project)}
                      </div>
                      {item.keywords.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          {item.keywords.slice(0, 3).map((kw) => (
                            <span
                              key={kw}
                              className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600"
                            >
                              #{kw}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-1 pt-2 mt-1 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400">{item.date}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openArchiveTarget(item.relPath, 'file');
                            }}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                          >
                            열기
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openArchiveTarget(item.relPath, 'folder');
                            }}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                          >
                            폴더
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Document & Integrated List Mode */
            <div className="divide-y divide-slate-100 max-h-[760px] overflow-y-auto">
              {items.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => selectItemForCluster(item)}
                    className={`p-4 transition-colors cursor-pointer flex flex-col gap-2 ${
                      isSelected ? 'bg-slate-50/90 border-l-4 border-l-slate-900' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5">
                          <FileCategoryIcon item={item} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 break-all">
                              <HighlightedText text={item.name} query={query} />
                            </span>
                            {item.matchReason === 'content' && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                본문 내용 일치
                              </span>
                            )}
                            {item.matchReason === 'synonym' && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                연관어 추론
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                            <span className="font-semibold text-slate-700">{item.year}</span>
                            <span>·</span>
                            <span className="font-medium text-slate-700">
                              {formatProjectName(item.project)}
                            </span>
                            {item.subFolder && (
                              <>
                                <span>›</span>
                                <span className="text-slate-500">{item.subFolder}</span>
                              </>
                            )}
                            <span>·</span>
                            <span>{item.date}</span>
                            <span>·</span>
                            <span>{formatFileSize(item.size)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Open Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openArchiveTarget(item.relPath, 'file');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                          title="연결 프로그램으로 파일 즉시 열기"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>파일 열기</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openArchiveTarget(item.relPath, 'folder');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="윈도우 탐색기에서 파일 위치 열기"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>폴더</span>
                        </button>
                      </div>
                    </div>

                    {/* Extracted Content Snippet or Photo Context */}
                    {item.snippet && (
                      <div className="pl-6 text-xs text-slate-600 line-clamp-2 bg-slate-50/80 px-3 py-2 rounded-lg border border-slate-100">
                        <HighlightedText text={item.snippet} query={query} />
                      </div>
                    )}

                    {/* Inherited / Extracted Keywords */}
                    {item.keywords && item.keywords.length > 0 && (
                      <div className="pl-6 flex items-center gap-1.5 flex-wrap">
                        {item.keywords.slice(0, 6).map((kw) => (
                          <button
                            key={kw}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuery(kw);
                            }}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-600 transition-colors cursor-pointer"
                          >
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            <span>{kw}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Linked Project Cluster Panel (연계 업무 자료 묶음) */}
        <div className="xl:col-span-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden sticky top-20">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-800" />
              <span className="text-sm font-bold text-slate-900">
                연계 업무 묶음 (Project Cluster)
              </span>
            </div>
            {cluster?.anchor && (
              <span className="text-xs font-semibold text-slate-600">
                {formatProjectName(cluster.anchor.project)}
              </span>
            )}
          </div>

          {!cluster?.anchor ? (
            <div className="p-8 text-center text-xs text-slate-500">
              좌측 목록에서 파일이나 사진을 선택하면 동일 단위사업의 연관 기안문·예산서·사진을 한 묶음으로 표시합니다.
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-4 max-h-[760px] overflow-y-auto">
              {/* Selected Anchor Item Summary */}
              <div className="p-3.5 rounded-xl bg-slate-900 text-white flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-300">
                    현재 선택된 기준 자료 ({cluster.anchor.year} · {formatProjectName(cluster.anchor.project)})
                  </span>
                  <span className="text-[11px] text-slate-300 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {cluster.anchor.date}
                  </span>
                </div>
                <div className="text-sm font-bold break-all">{cluster.anchor.name}</div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openArchiveTarget(cluster.anchor.relPath, 'file')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 cursor-pointer"
                  >
                    기준 파일 열기
                  </button>
                  <button
                    type="button"
                    onClick={() => openArchiveTarget(cluster.anchor.relPath, 'folder')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700 cursor-pointer"
                  >
                    탐색기 폴더 열기
                  </button>
                </div>
              </div>

              {/* 1. Related Official Documents (.hwpx / .pdf) */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>연관 기안문·계획서·보고서 ({cluster.docs.length})</span>
                </h3>
                {cluster.docs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-1">연관 문서가 없습니다.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {cluster.docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-2.5 rounded-lg border border-slate-200/80 hover:border-slate-300 bg-slate-50/50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900 truncate" title={doc.name}>
                            {doc.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {doc.date} · {formatFileSize(doc.size)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openArchiveTarget(doc.relPath, 'file')}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/80 cursor-pointer"
                          >
                            열기
                          </button>
                          <button
                            type="button"
                            onClick={() => openArchiveTarget(doc.relPath, 'folder')}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                          >
                            폴더
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Related Spreadsheets & Budget (.xlsx) */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  연관 예산·산출내역·집행표 ({cluster.sheets.length})
                </h3>
                {cluster.sheets.length === 0 ? (
                  <p className="text-xs text-slate-400 py-1">연관 엑셀 시트가 없습니다.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {cluster.sheets.map((sh) => (
                      <div
                        key={sh.id}
                        className="p-2.5 rounded-lg border border-slate-200/80 hover:border-slate-300 bg-slate-50/50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900 truncate" title={sh.name}>
                            {sh.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {sh.date} · {formatFileSize(sh.size)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openArchiveTarget(sh.relPath, 'file')}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/80 cursor-pointer"
                          >
                            열기
                          </button>
                          <button
                            type="button"
                            onClick={() => openArchiveTarget(sh.relPath, 'folder')}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                          >
                            폴더
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Related Photos & Visual Assets (.jpg / .png) */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  연관 현장 사진·포스터 시안 ({cluster.images.length})
                </h3>
                {cluster.images.length === 0 ? (
                  <p className="text-xs text-slate-400 py-1">연관 이미지가 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {cluster.images.map((img) => {
                      const thumbUrl = `/api/archive/image?path=${encodeURIComponent(img.relPath)}`;
                      return (
                        <div
                          key={img.id}
                          onClick={() => setPreviewImage(img)}
                          className="group relative rounded-lg border border-slate-200/80 overflow-hidden bg-slate-100 h-24 cursor-pointer"
                          title={img.name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumbUrl}
                            alt={img.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-slate-900/75 px-1.5 py-0.5 text-[10px] text-white truncate">
                            {img.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 truncate">{previewImage.name}</h4>
                <p className="text-xs text-slate-500">
                  {previewImage.year} › {formatProjectName(previewImage.project)}
                  {previewImage.subFolder ? ` › ${previewImage.subFolder}` : ''} ({previewImage.date})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 flex items-center justify-center max-h-[65vh] overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/archive/image?path=${encodeURIComponent(previewImage.relPath)}`}
                alt={previewImage.name}
                className="max-h-[60vh] w-auto object-contain rounded"
              />
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {previewImage.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-xs text-slate-600"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openArchiveTarget(previewImage.relPath, 'file')}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                >
                  기본 사진 뷰어로 열기
                </button>
                <button
                  type="button"
                  onClick={() => openArchiveTarget(previewImage.relPath, 'folder')}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 hover:bg-slate-100 cursor-pointer"
                >
                  탐색기 폴더 위치 열기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArchiveExplorerView;
