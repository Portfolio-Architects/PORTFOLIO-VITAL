'use client';

import React, { useState, useMemo, useCallback, useRef, useDeferredValue, useEffect } from 'react';
import { useContacts } from '@/hooks/useContacts';
import { 
  BookOpen, 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  FileText, 
  Trash2, 
  ShieldAlert, 
  Pencil, 
  X, 
  Copy, 
  Check, 
  Building, 
  Sparkles,
  ArrowUpDown
} from 'lucide-react';
import { Contact } from '@/types';

// ============ Korean Chosung & Search Utilities ============
const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

/** 한글 문자열에서 초성을 추출합니다. */
function getChosung(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const chosungIndex = Math.floor((code - 0xAC00) / 588);
      result += CHOSUNG_LIST[chosungIndex];
    } else {
      result += str[i];
    }
  }
  return result;
}

/** 초성만으로 구성된 검색어인지 확인합니다. */
function isChosungOnly(str: string): boolean {
  return /^[ㄱ-ㅎ]+$/.test(str.replace(/\s+/g, ''));
}

/** 전화번호 자동 하이픈 포맷팅 */
function formatPhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  } else {
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length <= 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
}

// ============ Parsed Contact Notes Model ============
interface ParsedNotes {
  source?: string;       // [출처: 사업운영] -> "사업운영"
  affiliation?: string;  // 소속: 매헌기념관 -> "매헌기념관"
  role?: string;         // 소속/직책: ...
  detailNote?: string;   // 비고: 체력측정요구 뒷빽
  freeText?: string;     // 기타 일반 메모
}

interface IndexedContact {
  contact: Contact;
  parsedNotes: ParsedNotes;
  searchStr: string;
  cleanStr: string;
  chosungStr: string;
  cleanChosungStr: string;
  createdAtTimestamp: number;
}

function parseContactNotes(notes?: string): ParsedNotes {
  if (!notes || !notes.trim()) return {};

  const result: ParsedNotes = {};
  let text = notes;

  // 1. [출처: XXX] 추출
  const sourceMatch = text.match(/\[출처:\s*([^\]]+)\]/);
  if (sourceMatch) {
    result.source = sourceMatch[1].trim();
    text = text.replace(sourceMatch[0], '');
  }

  // 2. 소속: XXX 추출
  const affMatch = text.match(/(?:소속\/직책|소속|직책):\s*([^\n;]+)/);
  if (affMatch) {
    result.affiliation = affMatch[1].trim();
    text = text.replace(affMatch[0], '');
  }

  // 3. 비고: XXX 추출
  const detailMatch = text.match(/비고:\s*([^\n;]+)/);
  if (detailMatch) {
    result.detailNote = detailMatch[1].trim();
    text = text.replace(detailMatch[0], '');
  }

  // 4. 나머지 잔여 텍스트
  const cleaned = text.replace(/[;\n]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned) {
    result.freeText = cleaned;
  }

  return result;
}

// ============ Zero-Dependency Container Virtualizer Hook ============
function useContainerVirtualGrid({
  totalItems,
  columns = 2,
  estimatedItemHeight = 220,
  gap = 12,
  overscan = 2,
  containerRef
}: {
  totalItems: number;
  columns?: number;
  estimatedItemHeight?: number;
  gap?: number;
  overscan?: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerHeight = 480;

  const totalRows = Math.ceil(totalItems / columns);
  const rowHeight = estimatedItemHeight + gap;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (containerRef.current) {
          setScrollTop(containerRef.current.scrollTop);
        }
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [containerRef]);

  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan);

  const startIndex = startRow * columns;
  const endIndex = Math.min(totalItems, endRow * columns);

  const topPadding = startRow * rowHeight;
  const bottomPadding = Math.max(0, (totalRows - endRow) * rowHeight);

  return {
    startIndex,
    endIndex,
    topPadding,
    bottomPadding
  };
}

// ============ Ultra-fast Substring Highlighter ============
const regexCache = new Map<string, { regex: RegExp; tokenSet: Set<string> } | null>();

const HighlightText = React.memo(({ 
  text, 
  queryTokens,
  className = '' 
}: { 
  text?: string; 
  queryTokens: string[];
  className?: string;
}) => {
  if (!text) return null;
  if (!queryTokens || queryTokens.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const cacheKey = queryTokens.join('|||');
  let compiled = regexCache.get(cacheKey);

  if (compiled === undefined) {
    const validTokens = queryTokens
      .map(t => t.trim())
      .filter(t => t.length > 0 && !isChosungOnly(t));

    if (validTokens.length === 0) {
      compiled = null;
    } else {
      const escapedTokens = validTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      compiled = {
        regex: new RegExp(`(${escapedTokens.join('|')})`, 'gi'),
        tokenSet: new Set(validTokens.map(t => t.toLowerCase()))
      };
    }
    regexCache.set(cacheKey, compiled);
    if (regexCache.size > 50) {
      regexCache.clear();
    }
  }

  if (!compiled) {
    return <span className={className}>{text}</span>;
  }

  const parts = text.split(compiled.regex);
  const tokenSet = compiled.tokenSet;

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const isMatch = tokenSet.has(part.toLowerCase());
        return isMatch ? (
          <mark 
            key={i} 
            className="bg-amber-200/90 text-amber-950 font-bold px-1 py-0.2 rounded-md shadow-3xs"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </span>
  );
});
HighlightText.displayName = 'HighlightText';

// ============ Memoized ContactCard Subcomponent ============
const ContactCard = React.memo(({ 
  contact, 
  parsedNotes,
  queryTokens,
  onStartEdit, 
  onDelete 
}: { 
  contact: Contact; 
  parsedNotes: ParsedNotes;
  queryTokens: string[];
  onStartEdit: (contact: Contact) => void; 
  onDelete: (id: string) => void; 
}) => {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyPhone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!contact.phone) return;
    navigator.clipboard.writeText(contact.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 1500);
  }, [contact.phone]);

  const handleCopyEmail = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!contact.email) return;
    navigator.clipboard.writeText(contact.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 1500);
  }, [contact.email]);

  const handleEdit = useCallback(() => {
    onStartEdit(contact);
  }, [onStartEdit, contact]);

  const handleDelete = useCallback(() => {
    if (confirm(`'${contact.name}' 연락처를 삭제하시겠습니까?`)) {
      onDelete(contact.id);
    }
  }, [onDelete, contact.id, contact.name]);

  const parsed = parsedNotes;

  return (
    <div className="group relative flex flex-col justify-between p-4 bg-white/70 hover:bg-white border border-slate-200/70 hover:border-emerald-500/50 rounded-2xl transition-all duration-200 hover:shadow-md">
      {/* Top Header: Name & Action Buttons */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-sm font-bold text-slate-800 tracking-tight">
              <HighlightText text={contact.name} queryTokens={queryTokens} />
            </span>
            {parsed.source && (
              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 rounded-full">
                <HighlightText text={parsed.source} queryTokens={queryTokens} />
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={handleEdit}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
              title="연락처 수정"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
              title="연락처 삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Contact Info (Phone & Email) */}
        <div className="flex flex-col gap-1.5 mt-2.5 text-xs font-semibold text-slate-600">
          <div className="flex items-center justify-between group/phone">
            <a 
              href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}
              className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-600 transition-colors font-medium"
              title="전화 걸기"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <HighlightText text={contact.phone} queryTokens={queryTokens} />
            </a>
            <button
              onClick={handleCopyPhone}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
              title="전화번호 복사"
            >
              {copiedPhone ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">복사됨</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="opacity-0 group-hover/phone:opacity-100 transition-opacity">복사</span>
                </>
              )}
            </button>
          </div>

          {contact.email && (
            <div className="flex items-center justify-between group/email">
              <button
                type="button"
                onClick={handleCopyEmail}
                className="flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 transition-colors text-[11px] font-medium text-left truncate cursor-pointer select-text"
                title="클릭하여 이메일 텍스트 복사"
              >
                <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate select-text">
                  <HighlightText text={contact.email} queryTokens={queryTokens} />
                </span>
              </button>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer shrink-0"
                title="이메일 텍스트 복사"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-3 h-3 text-indigo-600" />
                    <span className="text-indigo-600 font-bold">복사됨</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="opacity-0 group-hover/email:opacity-100 transition-opacity">복사</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Structured Notes & Affiliation Area */}
      {contact.notes && (
        <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col gap-1.5 text-[11px] font-medium text-slate-600">
          {parsed.affiliation && (
            <div className="flex items-start gap-1.5 text-slate-700">
              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="leading-snug">
                <span className="text-slate-400 font-semibold mr-1">소속/직책:</span>
                <HighlightText text={parsed.affiliation} queryTokens={queryTokens} className="font-semibold text-slate-800" />
              </span>
            </div>
          )}

          {parsed.detailNote && (
            <div className="flex items-start gap-1.5 text-slate-600 bg-slate-50/70 p-2 rounded-xl border border-slate-150/50">
              <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed break-all">
                <span className="text-amber-700 font-bold mr-1">비고:</span>
                <HighlightText text={parsed.detailNote} queryTokens={queryTokens} />
              </span>
            </div>
          )}

          {parsed.freeText && (
            <div className="flex items-start gap-1.5 text-slate-500">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed break-all">
                <HighlightText text={parsed.freeText} queryTokens={queryTokens} />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
ContactCard.displayName = 'ContactCard';

// ============ Main ContactsBox Component ============
const ContactsBoxComponent: React.FC = () => {
  const { contacts, loading, addContact, updateContact, deleteContact } = useContacts();

  // 검색 및 정렬 상태
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'NAME_ASC' | 'NEWEST'>('NAME_ASC');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 반응형 그리드 열 수 (모바일: 1, 데스크톱: 2)
  const [columns, setColumns] = useState(2);
  useEffect(() => {
    const updateCols = () => {
      if (typeof window !== 'undefined') {
        setColumns(window.innerWidth >= 768 ? 2 : 1);
      }
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const handleClearSearch = useCallback(() => {
    setLocalSearchTerm('');
    searchInputRef.current?.focus();
  }, []);

  // 폼 등록 및 수정 상태 (단일 객체로 배치 관리)
  const [formData, setFormData] = useState({
    editingId: null as string | null,
    name: '',
    phone: '',
    email: '',
    notes: '',
    error: null as string | null
  });

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData(prev => ({ ...prev, phone: formatted }));
  }, []);

  const startEdit = useCallback((contact: Contact) => {
    setFormData({
      editingId: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email || '',
      notes: contact.notes || '',
      error: null
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setFormData({
      editingId: null,
      name: '',
      phone: '',
      email: '',
      notes: '',
      error: null
    });
  }, []);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, name: e.target.value }));
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, email: e.target.value }));
  }, []);

  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, notes: e.target.value }));
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchTerm(e.target.value);
  }, []);

  const handleToggleSort = useCallback(() => {
    setSortOrder(prev => (prev === 'NAME_ASC' ? 'NEWEST' : 'NAME_ASC'));
  }, []);

  const deferredSearchTerm = useDeferredValue(localSearchTerm);

  // Pre-index contacts (runs ONLY when contacts array changes, NOT on every keystroke)
  const indexedContacts = useMemo<IndexedContact[]>(() => {
    const list: IndexedContact[] = new Array(contacts.length);
    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      const parsed = parseContactNotes(c.notes);
      const combined = `${c.name || ''} ${c.phone || ''} ${c.email || ''} ${c.notes || ''} ${parsed.source || ''} ${parsed.affiliation || ''} ${parsed.detailNote || ''} ${parsed.freeText || ''}`.toLowerCase();
      const clean = combined.replace(/[\s\-\,\.\[\]\(\)\:\/]/g, '');
      const chosung = getChosung(combined);
      const cleanChosung = getChosung(clean);
      const ts = c.createdAt ? Date.parse(c.createdAt) || 0 : 0;

      list[i] = {
        contact: c,
        parsedNotes: parsed,
        searchStr: combined,
        cleanStr: clean,
        chosungStr: chosung,
        cleanChosungStr: cleanChosung,
        createdAtTimestamp: ts
      };
    }
    return list;
  }, [contacts]);

  // 검색 쿼리 토큰 목록 (공백 분리 다중 키워드)
  const queryTokens = useMemo(() => {
    return deferredSearchTerm.trim().split(/\s+/).filter(Boolean);
  }, [deferredSearchTerm]);

  // 초고속 다차원 검색 및 단일 순회 필터링
  const filteredContacts = useMemo<IndexedContact[]>(() => {
    const list: IndexedContact[] = [];
    const hasTokens = queryTokens.length > 0;
    
    // 쿼리 토큰 사전 전처리 (아이템 루프 밖에서 1회만 계산)
    const processedTokens = hasTokens ? queryTokens.map(token => {
      const tokenLower = token.toLowerCase();
      const cleanToken = tokenLower.replace(/[\s\-\,\.\[\]\(\)\:\/]/g, '');
      const isChosung = isChosungOnly(tokenLower);
      return { tokenLower, cleanToken, isChosung };
    }) : [];

    for (let i = 0; i < indexedContacts.length; i++) {
      const item = indexedContacts[i];

      // 다중 토큰 검색 (미일치 시 즉시 break)
      if (hasTokens) {
        let allTokensMatch = true;
        for (let j = 0; j < processedTokens.length; j++) {
          const { tokenLower, cleanToken, isChosung } = processedTokens[j];
          let tokenMatch = item.searchStr.includes(tokenLower);
          if (!tokenMatch && cleanToken && item.cleanStr.includes(cleanToken)) {
            tokenMatch = true;
          }
          if (!tokenMatch && isChosung) {
            if (item.chosungStr.includes(tokenLower) || (cleanToken && item.cleanChosungStr.includes(cleanToken))) {
              tokenMatch = true;
            }
          }
          if (!tokenMatch) {
            allTokensMatch = false;
            break;
          }
        }
        if (!allTokensMatch) continue;
      }

      list.push(item);
    }

    // 3. 정렬 적용
    if (sortOrder === 'NAME_ASC') {
      list.sort((a, b) => a.contact.name.localeCompare(b.contact.name, 'ko'));
    } else {
      list.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);
    }

    return list;
  }, [indexedContacts, queryTokens, sortOrder]);

  // 가상 스크롤 계산 (가시 영역 아이템만 렌더링하여 DOM 프리징 제거)
  const { startIndex, endIndex, topPadding, bottomPadding } = useContainerVirtualGrid({
    totalItems: filteredContacts.length,
    columns,
    estimatedItemHeight: 220,
    gap: 12,
    overscan: 2,
    containerRef: scrollContainerRef
  });

  const visibleContacts = useMemo(() => {
    return filteredContacts.slice(startIndex, endIndex);
  }, [filteredContacts, startIndex, endIndex]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setFormData(prev => ({ ...prev, error: '이름/노드명을 입력해주세요.' }));
      return;
    }
    if (!formData.phone.trim()) {
      setFormData(prev => ({ ...prev, error: '연락처 번호를 입력해주세요.' }));
      return;
    }

    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      notes: formData.notes.trim()
    };

    if (formData.editingId) {
      updateContact(formData.editingId, payload);
    } else {
      addContact(payload);
    }

    setFormData({
      editingId: null,
      name: '',
      phone: '',
      email: '',
      notes: '',
      error: null
    });
  }, [formData, updateContact, addContact]);

  return (
    <div className="glass-panel rounded-[2rem] p-8 shadow-2xs border border-white/20 transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/50 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl border border-emerald-500/15">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xl font-bold text-slate-800 tracking-tight">내 연락처 및 주소록 관리</h4>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-100/70 text-emerald-800 rounded-full">
                <Sparkles className="w-3 h-3 text-emerald-600" /> 비고/메모·초성 스마트 검색
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-450 mt-0.5">
              실무 협업자 및 마인드맵 공약제안 노드별 연락 정보를 관리합니다. (비고/메모, 소속, 직책, 출처 통합 검색)
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-semibold px-3 py-1 bg-emerald-500/10 border border-emerald-500/15 text-emerald-700 rounded-full shadow-3xs">
            {localSearchTerm ? (
              <>검색 <strong className="text-emerald-800 font-bold">{filteredContacts.length}</strong>명 / 전체 {contacts.length}명</>
            ) : (
              <>총 <strong className="text-emerald-800 font-bold">{contacts.length}</strong>명</>
            )}
          </span>
          <button
            onClick={handleToggleSort}
            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors cursor-pointer"
            title="정렬 기준 변경"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortOrder === 'NAME_ASC' ? '가나다순' : '최신순'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Container (left side) */}
        <form onSubmit={handleSubmit} className="lg:col-span-4 flex flex-col gap-4 bg-slate-55/20 p-6 rounded-2xl border border-slate-200/40 backdrop-blur-xs h-fit">
          <span className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
            {formData.editingId ? (
              <>
                <Pencil className="w-4 h-4 text-emerald-500 animate-pulse" /> 연락처 수정
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 text-emerald-500" /> 신규 연락처 추가
              </>
            )}
          </span>

          {formData.error && (
            <div className="flex items-center gap-2 text-xs font-bold bg-rose-500/10 text-rose-605 p-3 rounded-xl border border-rose-500/20">
              <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
              <span>{formData.error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-600">이름 / 노드명</label>
            <input
              type="text"
              value={formData.name}
              onChange={handleNameChange}
              placeholder="예: 이성섭 상임이사, 최장미"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-350"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-600">연락처 (전화번호)</label>
            <input
              type="text"
              value={formData.phone}
              onChange={handlePhoneChange}
              placeholder="예: 010-5284-3946"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-350"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-600">이메일 주소 (선택)</label>
            <input
              type="email"
              value={formData.email}
              onChange={handleEmailChange}
              placeholder="예: email@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-350"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-600">비고 / 메모 / 소속 (선택)</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={handleNotesChange}
              placeholder="예: 소속: 매헌기념관, 비고: 체력측정요구 뒷빽, [출처: 사업운영]"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-350 resize-none leading-relaxed"
            />
            <p className="text-[10px] text-slate-400">
              * 소속, 직책, 출처, 비고 내용을 적어두시면 검색창에서 즉시 찾아낼 수 있습니다.
            </p>
          </div>

          <div className="flex flex-col gap-2 mt-1">
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/10 active:scale-[0.98] cursor-pointer"
            >
              {formData.editingId ? '연락처 수정 완료' : '연락처 저장'}
            </button>
            {formData.editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-all duration-200 cursor-pointer text-xs"
              >
                수정 취소
              </button>
            )}
          </div>
        </form>

        {/* Contacts List (right side) */}
        <div className="lg:col-span-8 flex flex-col min-w-0">
          {/* Search bar */}
          <div 
            className="relative mb-3 cursor-text"
            onClick={() => searchInputRef.current?.focus()}
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={localSearchTerm}
              onChange={handleSearchChange}
              placeholder="이름, 전화번호, 비고/메모, 소속, 직책 키워드 및 초성(ㅊㄹ, ㅇㅅㅅ) 검색..."
              className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-300/80 text-sm font-semibold text-slate-800 bg-white hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-slate-400 shadow-3xs cursor-text"
            />
            {localSearchTerm && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearSearch();
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="검색어 초기화"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Contacts Card Grid with Window Virtualization */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3" />
              <p className="text-xs font-bold">주소록 데이터를 불러오고 있습니다...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/40 border border-dashed border-slate-200 rounded-2xl">
              <BookOpen className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-500">
                {localSearchTerm 
                  ? `"${localSearchTerm}" 관련 검색 결과가 없습니다.`
                  : '등록된 연락처가 없습니다.'}
              </p>
              {localSearchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="mt-3 text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  검색어 초기화
                </button>
              )}
            </div>
          ) : (
            <div 
              ref={scrollContainerRef}
              className="max-h-[480px] overflow-y-auto pr-1.5 scrollbar-thin"
            >
              <div style={{ paddingTop: `${topPadding}px`, paddingBottom: `${bottomPadding}px` }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {visibleContacts.map((item) => (
                    <ContactCard
                      key={item.contact.id}
                      contact={item.contact}
                      parsedNotes={item.parsedNotes}
                      queryTokens={queryTokens}
                      onStartEdit={startEdit}
                      onDelete={deleteContact}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ContactsBox = React.memo(ContactsBoxComponent);
ContactsBox.displayName = 'ContactsBox';


