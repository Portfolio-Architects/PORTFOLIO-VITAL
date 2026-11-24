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
  ArrowUpDown,
  PhoneCall
} from 'lucide-react';
import { Contact } from '@/types';
import { SectionHeader } from '@/components/ui';

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

type ContactSortOrder = 'RECENT_CONTACT' | 'NAME_ASC' | 'NEWEST';

function parseTimestampMs(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function formatRecentContactDate(iso?: string): { short: string; full: string } | null {
  const ms = parseTimestampMs(iso);
  if (ms <= 0) return null;
  const d = new Date(ms);
  const now = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const short = isSameDay
    ? `오늘 ${hh}:${min}`
    : yyyy === now.getFullYear()
    ? `${mm}.${dd}`
    : `${String(yyyy).slice(2)}.${mm}.${dd}`;
  return {
    short,
    full: `${yyyy}. ${mm}. ${dd}. ${hh}:${min}`,
  };
}

interface IndexedContact {
  contact: Contact;
  parsedNotes: ParsedNotes;
  searchStr: string;
  cleanStr: string;
  chosungStr: string;
  cleanChosungStr: string;
  createdAtTimestamp: number;
  activityTimestamp: number;
  lastContactedTimestamp: number;
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
  containerRef,
  defaultContainerHeight = 480
}: {
  totalItems: number;
  columns?: number;
  estimatedItemHeight?: number;
  gap?: number;
  overscan?: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  defaultContainerHeight?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(defaultContainerHeight);

  const totalRows = Math.ceil(totalItems / columns);
  const rowHeight = estimatedItemHeight + gap;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateHeight = () => {
      if (containerRef.current && containerRef.current.clientHeight > 0) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    updateHeight();

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
    window.addEventListener('resize', updateHeight, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateHeight);
      resizeObserver?.disconnect();
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
  onDelete,
  onRecordContact
}: { 
  contact: Contact; 
  parsedNotes: ParsedNotes;
  queryTokens: string[];
  onStartEdit: (contact: Contact) => void; 
  onDelete: (id: string) => void;
  onRecordContact: (id: string) => void;
}) => {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [recordedContact, setRecordedContact] = useState(false);

  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
      if (contactTimerRef.current) clearTimeout(contactTimerRef.current);
    };
  }, []);

  const handleCallPhone = useCallback(() => {
    onRecordContact(contact.id);
  }, [onRecordContact, contact.id]);

  const handleCopyPhone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!contact.phone) return;
    navigator.clipboard?.writeText?.(contact.phone);
    setCopiedPhone(true);
    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    phoneTimerRef.current = setTimeout(() => setCopiedPhone(false), 1500);
    onRecordContact(contact.id);
  }, [contact.phone, contact.id, onRecordContact]);

  const handleCopyEmail = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!contact.email) return;
    navigator.clipboard?.writeText?.(contact.email);
    setCopiedEmail(true);
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    emailTimerRef.current = setTimeout(() => setCopiedEmail(false), 1500);
    onRecordContact(contact.id);
  }, [contact.email, contact.id, onRecordContact]);

  const handleMarkContacted = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRecordContact(contact.id);
    setRecordedContact(true);
    if (contactTimerRef.current) clearTimeout(contactTimerRef.current);
    contactTimerRef.current = setTimeout(() => setRecordedContact(false), 1500);
  }, [onRecordContact, contact.id]);

  const handleEdit = useCallback(() => {
    onStartEdit(contact);
  }, [onStartEdit, contact]);

  const handleDelete = useCallback(() => {
    if (confirm(`'${contact.name}' 연락처를 삭제하시겠습니까?`)) {
      onDelete(contact.id);
    }
  }, [onDelete, contact.id, contact.name]);

  const parsed = parsedNotes;
  const recentContactInfo = formatRecentContactDate(contact.lastContactedAt);

  return (
    <div className="group relative flex flex-col justify-between p-4 bg-white hover:bg-slate-50/50 border border-slate-200/80 hover:border-slate-300 rounded-xl shadow-2xs transition-colors">
      {/* Top Header: Name & Action Buttons */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-sm font-bold text-slate-900 tracking-tight">
              <HighlightText text={contact.name} queryTokens={queryTokens} />
            </span>
            {parsed.source && (
              <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200/80 rounded-md">
                <HighlightText text={parsed.source} queryTokens={queryTokens} />
              </span>
            )}
            {recentContactInfo && (
              <span
                title={`최근 연락: ${recentContactInfo.full}`}
                className="inline-flex items-center text-[10px] font-mono tabular-nums font-semibold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-md"
              >
                최근 {recentContactInfo.short}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleMarkContacted}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md border transition-colors cursor-pointer ${
                recordedContact
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50/80 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 border-slate-200/80 hover:border-emerald-200'
              }`}
              title="최근 연락 기록"
              aria-label={`${contact.name} 연락 기록`}
            >
              {recordedContact ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>기록됨</span>
                </>
              ) : (
                <>
                  <PhoneCall className="w-3 h-3" />
                  <span>연락</span>
                </>
              )}
            </button>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button
                onClick={handleEdit}
                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
                title="연락처 수정"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                title="연락처 삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Contact Info (Phone & Email) */}
        <div className="flex flex-col gap-1.5 mt-2.5 text-xs font-semibold text-slate-600">
          <div className="flex items-center justify-between group/phone">
            <a 
              href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}
              onClick={handleCallPhone}
              className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 transition-colors font-mono tabular-nums font-medium"
              title="전화 걸기"
            >
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <HighlightText text={contact.phone} queryTokens={queryTokens} />
            </a>
            <button
              onClick={handleCopyPhone}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="전화번호 복사"
            >
              {copiedPhone ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">복사됨</span>
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
                className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors text-[11px] font-mono text-left truncate cursor-pointer select-text"
                title="클릭하여 이메일 텍스트 복사"
              >
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate select-text">
                  <HighlightText text={contact.email} queryTokens={queryTokens} />
                </span>
              </button>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer shrink-0"
                title="이메일 텍스트 복사"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">복사됨</span>
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
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-col gap-1.5 text-[11px] font-medium text-slate-600">
          {parsed.affiliation && (
            <div className="flex items-start gap-1.5 text-slate-700">
              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="leading-snug">
                <span className="text-slate-400 font-medium mr-1">소속/직책:</span>
                <HighlightText text={parsed.affiliation} queryTokens={queryTokens} className="font-semibold text-slate-800" />
              </span>
            </div>
          )}

          {parsed.detailNote && (
            <div className="flex items-start gap-1.5 text-slate-600 bg-slate-50/80 p-2 rounded-lg border border-slate-200/70">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed break-all">
                <span className="text-slate-700 font-semibold mr-1">비고:</span>
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
export interface ContactsBoxProps {
  variant?: 'card' | 'sheet';
  onClose?: () => void;
}

const ContactsBoxComponent: React.FC<ContactsBoxProps> = ({ variant = 'card', onClose }) => {
  const isSheet = variant === 'sheet';
  const { contacts, loading, addContact, updateContact, markContacted, deleteContact } = useContacts();

  // 검색 및 정렬 상태 (기본: 최근 연락순)
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<ContactSortOrder>('RECENT_CONTACT');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 반응형 그리드 열 수 (시트: 1열, 카드 모바일: 1열, 카드 데스크톱: 2열)
  const [responsiveColumns, setResponsiveColumns] = useState(2);
  useEffect(() => {
    if (isSheet) return;
    const updateCols = () => {
      if (typeof window !== 'undefined') {
        setResponsiveColumns(window.innerWidth >= 768 ? 2 : 1);
      }
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, [isSheet]);
  const columns = isSheet ? 1 : responsiveColumns;

  const handleClearSearch = useCallback(() => {
    setLocalSearchTerm('');
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    searchInputRef.current?.focus();
  }, []);

  const handleRecordContact = useCallback((id: string) => {
    if (typeof markContacted === 'function') {
      markContacted(id);
    } else {
      const now = new Date().toISOString();
      updateContact(id, { lastContactedAt: now, updatedAt: now });
    }
  }, [markContacted, updateContact]);

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
    if (isSheet) {
      setIsFormOpen(true);
    }
  }, [isSheet]);

  const handleCancelEdit = useCallback(() => {
    setFormData({
      editingId: null,
      name: '',
      phone: '',
      email: '',
      notes: '',
      error: null
    });
    if (isSheet) {
      setIsFormOpen(false);
    }
  }, [isSheet]);

  const handleToggleForm = useCallback(() => {
    setIsFormOpen(prev => {
      if (prev) {
        setFormData({
          editingId: null,
          name: '',
          phone: '',
          email: '',
          notes: '',
          error: null
        });
      }
      return !prev;
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
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, []);

  const handleToggleSort = useCallback(() => {
    setSortOrder((prev) => {
      if (prev === 'RECENT_CONTACT') return 'NAME_ASC';
      if (prev === 'NAME_ASC') return 'NEWEST';
      return 'RECENT_CONTACT';
    });
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
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
      const createdAtTs = parseTimestampMs(c.createdAt);
      const updatedAtTs = parseTimestampMs(c.updatedAt);
      const lastContactedTs = parseTimestampMs(c.lastContactedAt);

      list[i] = {
        contact: c,
        parsedNotes: parsed,
        searchStr: combined,
        cleanStr: clean,
        chosungStr: chosung,
        cleanChosungStr: cleanChosung,
        createdAtTimestamp: createdAtTs,
        activityTimestamp: Math.max(createdAtTs, updatedAtTs),
        lastContactedTimestamp: lastContactedTs
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

    // 3. 정렬 적용 (기본: 최근 연락순 → 미연락 항목은 최근 등록/수정순 → 가나다순)
    if (sortOrder === 'RECENT_CONTACT') {
      list.sort((a, b) => {
        const aHasContact = a.lastContactedTimestamp > 0;
        const bHasContact = b.lastContactedTimestamp > 0;
        if (aHasContact !== bHasContact) {
          return bHasContact ? 1 : -1;
        }
        if (a.lastContactedTimestamp !== b.lastContactedTimestamp) {
          return b.lastContactedTimestamp - a.lastContactedTimestamp;
        }
        if (b.activityTimestamp !== a.activityTimestamp) {
          return b.activityTimestamp - a.activityTimestamp;
        }
        return a.contact.name.localeCompare(b.contact.name, 'ko');
      });
    } else if (sortOrder === 'NAME_ASC') {
      list.sort((a, b) => a.contact.name.localeCompare(b.contact.name, 'ko'));
    } else {
      list.sort((a, b) => {
        if (b.createdAtTimestamp !== a.createdAtTimestamp) {
          return b.createdAtTimestamp - a.createdAtTimestamp;
        }
        return a.contact.name.localeCompare(b.contact.name, 'ko');
      });
    }

    return list;
  }, [indexedContacts, queryTokens, sortOrder]);

  // 가상 스크롤 계산 (가시 영역 아이템만 렌더링하여 DOM 프리징 제거)
  const { startIndex, endIndex, topPadding, bottomPadding } = useContainerVirtualGrid({
    totalItems: filteredContacts.length,
    columns,
    estimatedItemHeight: isSheet ? 160 : 220,
    gap: 12,
    overscan: 2,
    containerRef: scrollContainerRef,
    defaultContainerHeight: isSheet ? 680 : 480
  });

  const visibleContacts = useMemo(() => {
    return filteredContacts.slice(startIndex, endIndex);
  }, [filteredContacts, startIndex, endIndex]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setFormData(prev => ({ ...prev, error: '이름 입력 필요' }));
      return;
    }
    if (!formData.phone.trim()) {
      setFormData(prev => ({ ...prev, error: '연락처 입력 필요' }));
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
    if (isSheet) {
      setIsFormOpen(false);
    }
  }, [formData, updateContact, addContact, isSheet]);

  const countBadge = (
    <span className="text-[11px] font-mono tabular-nums font-semibold px-3 py-1 bg-slate-50 border border-slate-200/80 text-slate-600 rounded-lg">
      {localSearchTerm ? (
        <>검색 <strong className="text-slate-900 font-bold">{filteredContacts.length}</strong>명 / 전체 {contacts.length}명</>
      ) : (
        <>총 <strong className="text-slate-900 font-bold">{contacts.length}</strong>명</>
      )}
    </span>
  );

  const sortButton = (
    <button
      type="button"
      onClick={handleToggleSort}
      className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 rounded-lg transition-colors cursor-pointer"
      title="정렬 기준 변경 (최근 연락순 · 가나다순 · 최근 등록순)"
    >
      <ArrowUpDown className="w-3 h-3 text-slate-500" />
      {sortOrder === 'RECENT_CONTACT'
        ? '최근 연락순'
        : sortOrder === 'NAME_ASC'
        ? '가나다순'
        : '최근 등록순'}
    </button>
  );

  const formElement = (
    <form
      onSubmit={handleSubmit}
      className={
        isSheet
          ? 'flex flex-col gap-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 shrink-0'
          : 'lg:col-span-4 flex flex-col gap-4 bg-slate-50/70 p-6 rounded-xl border border-slate-200/80 h-fit'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
          {formData.editingId ? (
            <>
              <Pencil className="w-4 h-4 text-slate-700" /> 연락처 수정
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 text-slate-700" /> 연락처 추가
            </>
          )}
        </span>
        {isSheet && (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            닫기
          </button>
        )}
      </div>

      {formData.error && (
        <div className="flex items-center gap-2 text-xs font-bold bg-rose-50 text-rose-700 p-3 rounded-lg border border-rose-200/80">
          <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
          <span>{formData.error}</span>
        </div>
      )}

      <div className={isSheet ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'flex flex-col gap-4'}>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-600">이름 · 직함</label>
          <input
            type="text"
            value={formData.name}
            onChange={handleNameChange}
            placeholder="예: 이성섭 상임이사, 최장미"
            className="w-full px-3.5 py-2 rounded-lg border border-slate-200/90 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-slate-400 transition-colors placeholder:text-slate-400"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-600">연락처</label>
          <input
            type="text"
            value={formData.phone}
            onChange={handlePhoneChange}
            placeholder="예: 010-5284-3946"
            className="w-full px-3.5 py-2 rounded-lg border border-slate-200/90 text-sm font-mono tabular-nums font-semibold text-slate-800 bg-white focus:outline-none focus:border-slate-400 transition-colors placeholder:text-slate-400"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-600">이메일 (선택)</label>
        <input
          type="email"
          value={formData.email}
          onChange={handleEmailChange}
          placeholder="예: email@example.com"
          className="w-full px-3.5 py-2 rounded-lg border border-slate-200/90 text-sm font-mono font-semibold text-slate-800 bg-white focus:outline-none focus:border-slate-400 transition-colors placeholder:text-slate-400"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-600">소속 · 담당 메모 (선택)</label>
        <textarea
          rows={isSheet ? 2 : 3}
          value={formData.notes}
          onChange={handleNotesChange}
          placeholder="예: 소속: 보건행정과, 비고: 예산 총괄"
          className="w-full px-3.5 py-2 rounded-lg border border-slate-200/90 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-slate-400 transition-colors placeholder:text-slate-400 resize-none leading-relaxed"
        />
      </div>

      <div className={isSheet ? 'flex items-center gap-2 mt-0.5' : 'flex flex-col gap-2 mt-1'}>
        <button
          type="submit"
          className="flex-1 w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-colors shadow-2xs cursor-pointer"
        >
          {formData.editingId ? '연락처 수정 완료' : '연락처 저장'}
        </button>
        {formData.editingId && (
          <button
            type="button"
            onClick={handleCancelEdit}
            className={`${isSheet ? 'px-4' : 'w-full px-4'} bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 font-bold py-2.5 rounded-lg transition-colors cursor-pointer text-xs`}
          >
            수정 취소
          </button>
        )}
      </div>
    </form>
  );

  const searchAndListElement = (
    <div className={isSheet ? 'flex flex-col flex-1 min-h-0' : 'lg:col-span-8 flex flex-col min-w-0'}>
      {/* Search bar */}
      <div
        className="relative mb-3 cursor-text shrink-0"
        onClick={() => searchInputRef.current?.focus()}
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          value={localSearchTerm}
          onChange={handleSearchChange}
          placeholder="이름 · 전화번호 · 소속 · 메모 · 초성(ㅊㄹ) 검색"
          className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-200/90 text-sm font-semibold text-slate-800 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:border-slate-400 transition-colors placeholder:text-slate-400 shadow-2xs cursor-text"
        />
        {localSearchTerm && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClearSearch();
            }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            title="검색어 초기화"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Contacts Card Grid with Window Virtualization */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-slate-800 mb-3" />
          <p className="text-xs font-bold">연락처 로딩 중</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 border border-dashed border-slate-200/90 rounded-xl">
          <BookOpen className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-500">
            {localSearchTerm
              ? `"${localSearchTerm}" 검색 결과 없음`
              : '등록 연락처 없음'}
          </p>
          {localSearchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="mt-3 text-xs font-bold text-slate-700 hover:text-slate-900 underline cursor-pointer"
            >
              검색어 초기화
            </button>
          )}
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className={
            isSheet
              ? 'flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar'
              : 'max-h-[480px] overflow-y-auto pr-1.5 scrollbar-thin'
          }
        >
          <div style={{ paddingTop: `${topPadding}px`, paddingBottom: `${bottomPadding}px` }}>
            <div className={isSheet ? 'grid grid-cols-1 gap-3 pb-2' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
              {visibleContacts.map((item) => (
                <ContactCard
                  key={item.contact.id}
                  contact={item.contact}
                  parsedNotes={item.parsedNotes}
                  queryTokens={queryTokens}
                  onStartEdit={startEdit}
                  onDelete={deleteContact}
                  onRecordContact={handleRecordContact}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isSheet) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {/* Side Sheet Top Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 bg-white shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl border border-slate-200/80 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight truncate min-w-0">
                업무 연락처
              </h2>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="사이드 시트 닫기"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 mt-3.5 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              {countBadge}
              {sortButton}
            </div>
            <button
              type="button"
              onClick={handleToggleForm}
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                isFormOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              {isFormOpen ? '입력 닫기' : '연락처 추가'}
            </button>
          </div>
        </div>

        {/* Side Sheet Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 p-5 overflow-hidden bg-white">
          {isFormOpen && formElement}
          {searchAndListElement}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 sm:p-8 shadow-2xs border border-slate-200/80">
      {/* Header (VLDS SectionHeader) */}
      <SectionHeader
        title="업무 연락처"
        headingLevel="h4"
        titleClassName="text-xl font-bold text-slate-900 tracking-tight"
        className="pb-5 mb-6"
        icon={
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl border border-slate-200/80 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
        }
        actions={
          <>
            {countBadge}
            {sortButton}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {formElement}
        {searchAndListElement}
      </div>
    </div>
  );
};

export const ContactsBox = React.memo(ContactsBoxComponent);
ContactsBox.displayName = 'ContactsBox';


