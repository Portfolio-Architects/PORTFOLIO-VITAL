'use client';

import React, { useState, useMemo } from 'react';
import { BookOpen, FileText, Search, Scale, Check, Copy, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

const LawSearchPanel = dynamic(
  () => import('./LawSearchPanel').then((mod) => mod.LawSearchPanel),
  { ssr: false }
);

interface DictionaryTerm {
  term: string;
  english: string;
  definition: string;
  usage: string;
}

const DICTIONARY_TERMS: DictionaryTerm[] = [
  {
    term: '세출예산',
    english: 'Annual Expenditure Budget',
    definition: '한 회계연도 내에서 지방자치단체가 공익적 목적 달성을 위해 지출할 수 있는 세출의 법적 계획 및 한도 예산.',
    usage: '세출예산 집행기준에 의거하여 본 예산 집행 품의를 진행합니다.'
  },
  {
    term: '일상경비',
    english: 'Daily Operations Expenses',
    definition: '지방자치단체 관서의 원활한 일상 운영을 위해 매월 혹은 정기적으로 교부받아 일상경비 출납공무원이 직접 집행하는 경상적 비용.',
    usage: '부서 사무실 소모품 구입 및 부서 운영 경비는 일상경비 계좌에서 집행합니다.'
  },
  {
    term: '편성목',
    english: 'Budget Allocation Item',
    definition: '예산 편성 시 사업 계획 및 목적에 맞춰 예산 과목의 성질별로 세부 구분한 예산 통제 단위.',
    usage: '사무관리비 편성목에서 홍보물 제작비 1,000,000원을 집행할 계획입니다.'
  },
  {
    term: '통계목',
    english: 'Statistical Account Item',
    definition: '예산 집행 실적을 세부 통계 정보로 누적 관리하기 위해 행정안전부에서 지정한 최소 단위의 회계 계정과목.',
    usage: '통계목 분류 규정에 준하여 수수료 및 임차료를 일반운영비 세부 항목에 할당합니다.'
  },
  {
    term: '원인행위',
    english: 'Debt Commitment',
    definition: '지방자치단체의 재정 지출의 원인이 되는 계약의 체결 또는 법령·행정처분에 의해 지출 의무를 지는 행정 및 법률 행위.',
    usage: '인쇄 업체와의 공식 조달 계약서 서명을 통해 지출원인행위를 마쳤습니다.'
  },
  {
    term: '지출품의',
    english: 'Expense Authorization',
    definition: '예산을 실제로 집행하기 전에 결재권자에게 사업 취지와 소요 예산의 타당성을 설명하고 사전에 집행 승인을 득하는 내부 의사결정 절차.',
    usage: '보건소 홍보 리플릿 인쇄를 위하여 세출예산 집행 지출품의를 요청합니다.'
  },
  {
    term: '예비비',
    english: 'Reserve Fund',
    definition: '예측할 수 없는 회계연도 중의 예산 외 지출이나 예산 초과 지출에 충당하기 위해 상당한 금액을 예산에 계상해 두는 자금.',
    usage: '감염병 확산 방지를 위한 방역 용품 추가 조달을 위해 예비비 사용 승인을 신청했습니다.'
  },
  {
    term: '추가경정예산',
    english: 'Supplementary Budget',
    definition: '이미 성립된 예산에 변경을 가할 필요가 있을 때 추가적인 수입이나 목적 변경을 반영하여 예산안을 다시 작성하고 지방의회의 심의·의결을 거쳐 성립하는 예산.',
    usage: '지방교부세 증액 결정 및 국고보조금 증액에 따라 제1회 추가경정예산안을 편성합니다.'
  },
  {
    term: '지방재정법',
    english: 'Local Finance Act',
    definition: '지방자치단체의 재정 및 회계에 관한 기본 원칙과 건전하고 투명한 운영 체계를 확립하여 재정의 자주성과 건전한 발전을 도모하는 법률.',
    usage: '지방재정법 제32조의2(지방보조금의 예산 편성 등) 조항에 명시된 절차를 준수합니다.'
  },
  {
    term: '지방자치법',
    english: 'Local Autonomy Act',
    definition: '지방자치단체의 종류, 조직, 주민의 참정권과 자치단체의 권한, 사무 범위 등을 포괄적으로 규정하여 주민의 편익 증진과 민주적 자치를 보장하는 기본법.',
    usage: '지방자치법 제28조(조례)에 의거하여 권리 제한에 관한 사항은 조례 제정이 필수적입니다.'
  },
  {
    term: '행정규칙',
    english: 'Administrative Rules',
    definition: '행정기관 내부의 사무 처리 기준과 조직 내 규율을 위하여 훈령, 예규, 고시 등의 형태로 제정한 상위 법규 위임 규범.',
    usage: '행정안전부의 세출예산 집행기준 예규는 행정 절차의 대외적 통일성을 유지하는 대표적 행정규칙입니다.'
  },
  {
    term: '조례',
    english: 'Municipal Ordinance',
    definition: '지방자치단체가 법령의 범위 안에서 그 권한에 속하는 자치 사무에 관하여 지방의회의 의결을 거쳐 자주적으로 제정하는 지방적 법규.',
    usage: '강남구 구민건강증진 조례 개정안이 지방의회 심의를 통과하였습니다.'
  },
  {
    term: '규칙',
    english: 'Municipal Rule',
    definition: '지방자치단체의 장이 법령 또는 조례가 위임한 범위나 지방자치단체의 사무에 관하여 권한 범위 내에서 직권으로 제정하는 법규.',
    usage: '보건소 이용 수수료 징수 조례 시행에 따른 세부 감면 절차는 시행규칙을 제정하여 구체화합니다.'
  }
];

export default function LawSystemPage() {
  const [activeTab, setActiveTab] = useState<'search' | 'dictionary' | 'guide'>('search');
  const [dictSearch, setDictSearch] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const filteredTerms = useMemo(() => {
    const q = dictSearch.toLowerCase().trim();
    if (!q) return DICTIONARY_TERMS;
    return DICTIONARY_TERMS.filter(item => 
      item.term.includes(q) || 
      item.english.toLowerCase().includes(q) || 
      item.definition.includes(q)
    );
  }, [dictSearch]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Title Header */}
      <div className="flex flex-col gap-1 text-left">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">법령 · 공문 표준</h1>
        <p className="text-xs text-slate-500 font-semibold">
          법령 조회 · 행정 용어 · 공문서 규격
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs sm:text-sm tracking-wide transition-colors duration-150 cursor-pointer whitespace-nowrap ${
            activeTab === 'search'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Scale size={16} />
          법령/조례 실시간 검색
        </button>
        <button
          onClick={() => setActiveTab('dictionary')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs sm:text-sm tracking-wide transition-colors duration-150 cursor-pointer whitespace-nowrap ${
            activeTab === 'dictionary'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <BookOpen size={16} />
          자치/행정 용어 사전
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs sm:text-sm tracking-wide transition-colors duration-150 cursor-pointer whitespace-nowrap ${
            activeTab === 'guide'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <FileText size={16} />
          공문서 표준 작성 가이드
        </button>
      </div>

      {/* Dynamic Tab Content */}
      <div className="w-full">
        {activeTab === 'search' && (
          <div className="animate-fade-in">
            <LawSearchPanel />
          </div>
        )}

        {activeTab === 'dictionary' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            {/* Dictionary Search Bar */}
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="용어명, 영문명 또는 정의 검색..."
                value={dictSearch}
                onChange={e => setDictSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-3xs cursor-text"
              />
            </div>

            {/* Dictionary Term Cards */}
            {filteredTerms.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400 bg-white/60 border border-slate-200/60 rounded-[2rem] shadow-3xs">
                일치 용어 없음
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTerms.map((item, idx) => (
                  <div key={idx} className="bg-white/95 border border-slate-200/75 rounded-[2rem] p-5 shadow-3xs flex flex-col justify-between hover:shadow-md hover:border-indigo-250 transition-colors duration-150 group">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="text-left">
                          <h4 className="font-extrabold text-base text-slate-800 tracking-tight group-hover:text-indigo-655 transition-colors">{item.term}</h4>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">{item.english}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(item.term, item.term)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                          title="용어 복사"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium text-left bg-slate-50/50 p-3 rounded-xl border border-slate-150/40">
                        {item.definition}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-left">
                      <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider">공문서 활용 예시</span>
                      <div className="text-xs text-indigo-700 bg-indigo-50/30 border border-indigo-100/40 px-3 py-2 rounded-xl flex items-center justify-between gap-2">
                        <span className="font-semibold italic">"{item.usage}"</span>
                        <button
                          onClick={() => handleCopy(item.usage, `${item.term}-usage`)}
                          className="shrink-0 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 cursor-pointer flex items-center gap-1 hover:underline"
                        >
                          {copiedText === `${item.term}-usage` ? '복사됨!' : '예문 복사'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="flex flex-col gap-6 animate-fade-in text-left">
            {/* Top Guide Overview */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-[2rem] p-6 shadow-sm border border-indigo-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 px-3 py-1 rounded-full uppercase tracking-widest">STANDARD</span>
                <h3 className="text-lg font-bold">공문서 작성 표준 (HWPX)</h3>
                <p className="text-xs text-indigo-200/80 leading-relaxed">
                  지역보건법 · 지방재정법 · 행안부 공문 규격 기준
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-full border border-white/10 text-[10.5px] font-extrabold tracking-wider text-indigo-100">
                <Check size={12} className="stroke-[3] text-emerald-400" /> GUIDELINE VERIFIED
              </div>
            </div>

            {/* Detailed Guidelines Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Layout & Typography Card */}
              <div className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-3xs flex flex-col gap-4">
                <h4 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  1. 여백 · 서체
                </h4>
                <div className="space-y-4 text-xs font-semibold text-slate-600">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-2.5">
                    <p className="text-slate-800 font-extrabold text-[12.5px] mb-1">용지 여백</p>
                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                      <div>• 상하 여백: <span className="font-mono text-indigo-600">15mm</span> (머리말/꼬리말 포함)</div>
                      <div>• 좌우 여백: <span className="font-mono text-indigo-600">20mm</span></div>
                      <div className="col-span-2">• 기본 줄간격: <span className="font-mono text-indigo-600">130%</span> (가독성 극대화)</div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-slate-800 font-extrabold text-[12.5px]">서체 · 글자 크기</p>
                    <div className="space-y-2 divide-y divide-slate-100">
                      <div className="pt-2 flex justify-between items-center">
                        <span className="font-bold text-slate-800">제목 (대제목)</span>
                        <span className="font-mono text-indigo-600">22pt / HeadlineM</span>
                      </div>
                      <div className="pt-2 flex justify-between items-center">
                        <span className="font-bold text-slate-800">1단계 항목 기호</span>
                        <span className="font-mono text-indigo-600">16pt / HeadlineM</span>
                      </div>
                      <div className="pt-2 flex justify-between items-center">
                        <span className="font-bold text-slate-850">본문 내용 (기본)</span>
                        <span className="font-mono text-indigo-650">15pt / Human Myeongjo (장평 98%, 자간 -2%)</span>
                      </div>
                      <div className="pt-2 flex justify-between items-center">
                        <span className="font-bold text-slate-700">표 및 참고 사항</span>
                        <span className="font-mono text-indigo-600">13pt / Jung Gothic</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hierarchical Indexing Card */}
              <div className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-3xs flex flex-col gap-4">
                <h4 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  2. 기호 · 들여쓰기
                </h4>
                <div className="space-y-4 text-xs font-semibold text-slate-600">
                  <p className="text-slate-500">공문서 항목 구분 · 5단계 기호 계층 규격</p>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 font-mono space-y-3 text-slate-750">
                    <div className="flex items-center gap-3">
                      <span className="text-indigo-600 font-bold shrink-0">Ⅰ. (1단계)</span>
                      <span>대제목 / 22pt 서체 (1칸 띄고 본문 시작)</span>
                    </div>
                    <div className="pl-4 flex items-center gap-3 border-l border-indigo-200">
                      <span className="text-indigo-600 font-bold shrink-0">가. (2단계)</span>
                      <span>중제목 / 16pt / 10pt(2칸) 들여쓰기</span>
                    </div>
                    <div className="pl-8 flex items-center gap-3 border-l-2 border-indigo-300">
                      <span className="text-indigo-600 font-bold shrink-0">1) (3단계)</span>
                      <span>소제목 / 15pt / 20pt(4칸) 들여쓰기</span>
                    </div>
                    <div className="pl-12 flex items-center gap-3 border-l-2 border-indigo-400">
                      <span className="text-indigo-600 font-bold shrink-0">가) (4단계)</span>
                      <span>상세 / 15pt / 30pt(6칸) 들여쓰기</span>
                    </div>
                    <div className="pl-16 flex items-center gap-3 border-l-2 border-indigo-500">
                      <span className="text-indigo-600 font-bold shrink-0">⑴ (5단계)</span>
                      <span>세부 사항 / 15pt / 40pt(8칸) 들여쓰기</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-250 p-3.5 rounded-xl text-amber-900">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[11.5px] text-amber-900">정렬 규칙 주의</p>
                      <p className="text-[10.5px] text-amber-800 mt-0.5">둘째 줄 이하 첫 단어 위치 수직 정렬 · 내어쓰기 적용</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spacing & "끝." Ending Rules Card */}
              <div className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-3xs flex flex-col gap-4">
                <h4 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  3. 띄어쓰기 · 끝.
                </h4>
                <div className="space-y-4 text-xs font-semibold text-slate-600">
                  <div className="space-y-2">
                    <p className="text-slate-800 font-extrabold text-[12.5px]">공백 간격 규정</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600">
                      <li>기호/번호 뒤: <span className="font-bold text-indigo-650">1공백 (1 space)</span></li>
                      <li>붙임 기호 뒤: <span className="font-bold text-indigo-650">2공백 (2 spaces)</span> (예: `붙임  1.`)</li>
                    </ul>
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-slate-800 font-extrabold text-[12.5px] mb-1">상황별 "끝." 작성 표준 (마침표 뒤 2타 규칙)</p>
                    
                    <div className="space-y-3">
                      {/* Case 1: No attachment */}
                      <div className="bg-slate-50 border border-slate-200/50 p-3 rounded-2xl">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800 text-[11.5px]">① 첨부 서류가 없는 경우</span>
                          <button
                            onClick={() => handleCopy('수고하셨습니다.  끝.', 'end-case-1')}
                            className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                          >
                            {copiedText === 'end-case-1' ? '복사됨!' : '예시 복사'}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-1.5">본문 마지막 글자 뒤 2타 공백 + `끝.` 표기</p>
                        <div className="font-mono text-xs bg-white border border-slate-150 p-2.5 rounded-xl text-slate-700 select-all">
                          {/* vlds-ignore-next-line */}
                          ... 협조해 주시기 바랍니다.<span className="bg-indigo-100 text-indigo-800 font-bold px-1 rounded mx-0.5">  </span>끝.
                        </div>
                      </div>

                      {/* Case 2: With attachment */}
                      <div className="bg-slate-50 border border-slate-200/50 p-3 rounded-2xl">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800 text-[11.5px]">② 첨부 서류가 있는 경우</span>
                          <button
                            onClick={() => handleCopy('1부.  끝.', 'end-case-2')}
                            className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                          >
                            {copiedText === 'end-case-2' ? '복사됨!' : '예시 복사'}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-1.5">붙임 마지막 항목 뒤 2타 공백 + `끝.` 표기</p>
                        <div className="font-mono text-xs bg-white border border-slate-150 p-2.5 rounded-xl text-slate-700 space-y-1">
                          <div>붙임  1. 추진계획서 1부.</div>
                          <div>      2. 사업 예산 산출내역서 1부.<span className="bg-indigo-100 text-indigo-800 font-bold px-1 rounded mx-0.5">  </span>끝.</div>
                        </div>
                      </div>

                      {/* Case 3: Table ending */}
                      <div className="bg-slate-50 border border-slate-200/50 p-3 rounded-2xl">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800 text-[11.5px]">③ 표로 끝나는 경우</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-1.5">표 하단 1줄 아래 좌측 2타 공백 + `끝.` 표기</p>
                        <div className="font-mono text-[11px] bg-white border border-slate-150 p-2.5 rounded-xl text-slate-700 leading-tight">
                          <div>┌───────────┬───────────┐</div>
                          <div>│  구  분   │  금  액   │</div>
                          <div>├───────────┼───────────┤</div>
                          <div>│  합  계   │ 1,000천원 │</div>
                          <div>└───────────┴───────────┘</div>
                          <div className="mt-1"><span className="bg-indigo-100 text-indigo-800 font-bold px-1 rounded">  </span>끝.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Administrative Language Tuning Card */}
              <div className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-3xs flex flex-col gap-4">
                <h4 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  4. 행정어 순화
                </h4>
                <div className="space-y-4 text-xs font-semibold text-slate-600">
                  <p className="text-slate-555">공공문서 행정어 순화 4대 기준</p>
                  
                  <div className="space-y-3.5">
                    {/* Factuality */}
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold shrink-0 text-[10.5px]">사실성</div>
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800 text-[12px]">• 능동태 권장 · 피동 표현 배제</p>
                        <p className="text-slate-500 text-[11px]">피동 접사 `-시키다` 배제 (`개선시키다` → `개선하다` / `교육시키다` → `교육하다`)</p>
                      </div>
                    </div>

                    {/* Accessibility */}
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold shrink-0 text-[10.5px]">접근성</div>
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800 text-[12px]">• 외래어 · 한자어 순화</p>
                        <p className="text-slate-500 text-[11px]">어려운 한자어 · 외래어 순화 (`공람` → `함께 봄` / `시말서` → `경위서` / `TF` → `전담팀`)</p>
                      </div>
                    </div>

                    {/* Non-Authoritativeness */}
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold shrink-0 text-[10.5px]">비권위</div>
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800 text-[12px]">• 상호존중 어휘</p>
                        {/* vlds-ignore-next-line */}
                        <p className="text-slate-500 text-[11px]">고압적 명령조 배제 (`즉시 제출을 명함` → `제출해 주시기 바랍니다`)</p>
                      </div>
                    </div>

                    {/* Neutrality */}
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold shrink-0 text-[10.5px]">중립성</div>
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800 text-[12px]">• 성 평등 · 중립적 순서</p>
                        <p className="text-slate-500 text-[11px]">성역할 편견 배제 · 가나다순 배치 (`남 20, 여 15` → `여 15, 남 20`)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
