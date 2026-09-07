"use client";

import React, { useState, useMemo, useSyncExternalStore, useCallback } from 'react';
import { Check, Share2, Edit3, Save, X, Plus, Trash2, Loader2, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { useYangjaeFestival, useSaveYangjaeFestival, YANGJAE_FALLBACK_DATA, FestivalData, MilestoneItem, BoothItem } from '@/hooks/useYangjaeFestival';

export interface DetailDraft {
  uid: string;
  raw: string;
}

// Universal Robust Clipboard Copy (Works on all mobile/desktop browsers, webviews, and sandboxes)
async function copyToClipboardSafe(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Try modern navigator.clipboard if available and secure
  if (typeof navigator !== 'undefined' && navigator?.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallbackCopy on permission denied or sandboxed iframe
    }
  }

  // 2. Fallback for non-secure HTTP / Webview / Kakao In-app / sandboxed iframes
  return fallbackCopy(text);
}

function fallbackCopy(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false;
  const textArea = document.createElement('textarea');
  try {
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    if (typeof textArea.setSelectionRange === 'function') {
      textArea.setSelectionRange(0, text.length);
    }
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    if (textArea.parentNode) {
      textArea.parentNode.removeChild(textArea);
    }
  }
}

const FESTIVAL_CATEGORIES = ['전체', '전문 의료·검진', '민간 헬스케어', '보건소 사업'];
const FESTIVAL_TARGET_TIMESTAMP = new Date("2026-10-31T09:00:00").getTime();

const LARGE_FONT_STYLES = `
  .is-large-font [class*="text-"] {
    font-size: 1.25em !important;
    line-height: 1.6 !important;
  }
  .is-large-font [class*="text-\\[9"] {
    font-size: 12.5px !important;
  }
  .is-large-font [class*="text-\\[10"] {
    font-size: 13.5px !important;
  }
  .is-large-font [class*="text-\\[11"] {
    font-size: 14.5px !important;
  }
  .is-large-font [class*="text-xs"] {
    font-size: 15.5px !important;
    line-height: 1.6 !important;
  }
  .is-large-font [class*="text-sm"] {
    font-size: 18px !important;
    line-height: 1.6 !important;
  }
  .is-large-font [class*="text-base"] {
    font-size: 20px !important;
    line-height: 1.5 !important;
  }
  .is-large-font [class*="text-lg"] {
    font-size: 23px !important;
    line-height: 1.45 !important;
  }
  .is-large-font input, .is-large-font textarea, .is-large-font select {
    font-size: 16px !important;
  }
`;

function safeClone<T>(data: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
}

const YANGJAE_REPORT_TABS = [
  { id: 'milestones' as const, label: '1. 추진과제' },
  { id: 'booths' as const, label: '2. 부스현황' },
];

export interface ParsedDetail {
  date: string;
  status: 'done' | 'in-progress' | 'todo';
  attendees: string;
  text: string;
}

const PARSED_DETAIL_CACHE = new Map<string, ParsedDetail>();

function cacheAndReturnDetail(raw: string, result: ParsedDetail): ParsedDetail {
  if (PARSED_DETAIL_CACHE.size >= 500) {
    PARSED_DETAIL_CACHE.clear();
  }
  PARSED_DETAIL_CACHE.set(raw, result);
  return result;
}

export function parseDetail(raw: string): ParsedDetail {
  if (!raw) return { date: '', status: 'todo', attendees: '', text: '' };
  const cached = PARSED_DETAIL_CACHE.get(raw);
  if (cached) return cached;

  let status: 'done' | 'in-progress' | 'todo' = 'todo';
  let date = '';
  let attendees = '';
  let text = raw;

  // 1. 명시적 구조화 태그 파싱: [완료][7.29][참여:오창선] 본문 (줄바꿈 및 공백 무손실 보존)
  // (?!참여:) 가드로 [참여:...] 태그가 날짜 필드로 오인식되어 칸이 연동되는 오류 영구 차단
  const structuredMatch = raw.match(/^\[(완료|진행|예정)\](?:\[(?!참여:)([^\]]*)\])?(?:\[참여:([^\]]*)\])?(?:\s*([\s\S]*)|$)/);
  if (structuredMatch) {
    const statusStr = structuredMatch[1];
    status = statusStr === '완료' ? 'done' : statusStr === '진행' ? 'in-progress' : 'todo';
    date = structuredMatch[2] || '';
    attendees = structuredMatch[3] || '';
    text = structuredMatch[4] !== undefined ? structuredMatch[4] : '';
    return cacheAndReturnDetail(raw, { date, status, attendees, text });
  }

  // 2. 협조 뱃지 파싱
  if (text.startsWith('[협조완료]') || text.startsWith('[협조확정]')) {
    status = 'done';
  } else if (text.startsWith('[협조협의]') || text.startsWith('[협조기획]')) {
    status = 'in-progress';
  } else if (text.startsWith('[협조예정]')) {
    status = 'todo';
  } else if (text.includes('완료') || text.includes('승인 완료') || text.includes('확정') || text.includes('답사')) {
    status = 'done';
  } else if (text.includes('진행') || text.includes('조율') || text.includes('협의') || text.includes('의뢰')) {
    status = 'in-progress';
  } else {
    status = 'todo';
  }

  // 3. 시간 형식 파싱: "09:00~09:30 : 내용"
  const timeMatch = text.match(/^(\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2})\s*:\s*(.*)$/);
  if (timeMatch) {
    date = timeMatch[1].replace(/\s/g, '');
    text = timeMatch[2];
    return cacheAndReturnDetail(raw, { date, status, attendees, text });
  }

  // 4. 괄호 속 날짜 및 참여자 추출 (예: "1차 사전답사(7.29.(수), 오창선): 현장 실사...")
  const dateParenMatch = text.match(/\(((\d{1,2}\.\d{1,2}(\.\([월화수목금토일]\))?|\d{1,2}월(\s*\d{1,2}주)?|\d{1,2}\.\d{1,2}\.?)[^)]*)\)/);
  if (dateParenMatch) {
    const fullParen = dateParenMatch[0];
    const inner = dateParenMatch[1];
    
    const dateMatch = inner.match(/(\d{1,2}\.\d{1,2}(\.\([월화수목금토일]\))?|\d{1,2}월(\s*\d{1,2}주)?|\d{1,2}\.\d{1,2})/);
    if (dateMatch) {
      date = dateMatch[1].replace(/\.$/, '');
    }

    const remainingInParen = inner.replace(dateMatch ? dateMatch[0] : '', '').replace(/^[\s,.]+/, '').trim();
    if (remainingInParen) {
      attendees = remainingInParen;
    }
    text = text.replace(fullParen, '').replace(/^:\s*/, '');
  }

  // 5. 콜론 뒤의 참여자 목록 추출 (예: "2차 사전답사(8월): 과장, 건강증진팀장(김지영), 서승오, 오창선 코스 답사")
  if (!attendees && text.includes(':')) {
    const parts = text.split(':');
    const header = parts[0].trim();
    const rest = parts.slice(1).join(':').trim();
    
    const peoplePattern = /(과장|팀장(\([^)]*\))?|오창선|서승오|임석훤|남상희|김지영|제이민(\(대행사\))?|김다희)/g;
    const matches = rest.match(peoplePattern);
    if (matches && matches.length >= 2) {
      attendees = matches.map(m => m.replace(/\s+/g, '')).join(', ');
      const cleanAction = rest.replace(peoplePattern, '').replace(/^[\s,]+/, '');
      text = cleanAction ? `${header} : ${cleanAction}` : header;
    }
  }

  return cacheAndReturnDetail(raw, { date, status, attendees, text });
}

export function formatDetail(item: ParsedDetail): string {
  const statusLabel = item.status === 'done' ? '완료' : item.status === 'in-progress' ? '진행' : '예정';
  const dateTag = item.date ? `[${item.date}]` : '';
  const attendeeTag = item.attendees ? `[참여:${item.attendees}]` : '';
  const prefix = `[${statusLabel}]${dateTag}${attendeeTag}`;
  return item.text !== undefined && item.text !== '' ? `${prefix} ${item.text}` : prefix;
}

// 보건소 핵심 담당자 행정 직통번호(내선) 매핑 테이블
export const STAFF_PHONE_MAP: Record<string, { ext: string; full: string; role: string }> = {
  '오창선': { ext: '7116', full: '02-3423-7116', role: '주무관' },
  '서승오': { ext: '7034', full: '02-3423-7034', role: '주무관' },
  '서승오주무관': { ext: '7034', full: '02-3423-7034', role: '주무관' },
  '서승오 주무관': { ext: '7034', full: '02-3423-7034', role: '주무관' },
  '임석훤': { ext: '7012', full: '02-3423-7012', role: '주무관' },
  '임석훤주무관': { ext: '7012', full: '02-3423-7012', role: '주무관' },
  '임석훤 주무관': { ext: '7012', full: '02-3423-7012', role: '주무관' },
  '남상희': { ext: '7025', full: '02-3423-7025', role: '주무관' },
  '남상희주무관': { ext: '7025', full: '02-3423-7025', role: '주무관' },
  '남상희 주무관': { ext: '7025', full: '02-3423-7025', role: '주무관' },
  // 김희선 팀장님 (내선 7011)
  '김희선팀장님': { ext: '7011', full: '02-3423-7011', role: '팀장' },
  '김희선 팀장님': { ext: '7011', full: '02-3423-7011', role: '팀장' },
  '희선팀장님': { ext: '7011', full: '02-3423-7011', role: '팀장' },
  '희선 팀장님': { ext: '7011', full: '02-3423-7011', role: '팀장' },
  '김희선팀장': { ext: '7011', full: '02-3423-7011', role: '팀장' },
  '김희선 팀장': { ext: '7011', full: '02-3423-7011', role: '팀장' },
  '희선팀장': { ext: '7011', full: '02-3423-7011', role: '팀장' },
  '희선 팀장': { ext: '7011', full: '02-3423-7011', role: '팀장' },
  '김희선': { ext: '7011', full: '02-3423-7011', role: '팀장' },
  '희선': { ext: '7011', full: '02-3423-7011', role: '팀장' },
  // 김지영 팀장님 (내선 7031)
  '김지영팀장님': { ext: '7031', full: '02-3423-7031', role: '팀장' },
  '김지영 팀장님': { ext: '7031', full: '02-3423-7031', role: '팀장' },
  '지영팀장님': { ext: '7031', full: '02-3423-7031', role: '팀장' },
  '지영 팀장님': { ext: '7031', full: '02-3423-7031', role: '팀장' },
  '김지영팀장': { ext: '7031', full: '02-3423-7031', role: '팀장' },
  '김지영 팀장': { ext: '7031', full: '02-3423-7031', role: '팀장' },
  '지영팀장': { ext: '7031', full: '02-3423-7031', role: '팀장' },
  '지영 팀장': { ext: '7031', full: '02-3423-7031', role: '팀장' },
  '김지영': { ext: '7031', full: '02-3423-7031', role: '팀장' },
  '지영': { ext: '7031', full: '02-3423-7031', role: '팀장' },
  '건강증진팀장(김지영)': { ext: '7031', full: '02-3423-7031', role: '팀장' },
  '팀장(김지영)': { ext: '7031', full: '02-3423-7031', role: '팀장' },
  // 과장님 (02-3423-7116)
  '과장님': { ext: '7116', full: '02-3423-7116', role: '과장' },
  '과장': { ext: '7116', full: '02-3423-7116', role: '과장' },
  '보건행정과장': { ext: '7116', full: '02-3423-7116', role: '과장' },
  // 제이민 커뮤니케이션 김다희 팀장님 (010-8494-0544)
  '제이민': { ext: '0544', full: '010-8494-0544', role: '대행사(김다희 팀장)' },
  '제이민(대행사)': { ext: '0544', full: '010-8494-0544', role: '대행사(김다희 팀장)' },
  '제이민 커뮤니케이션': { ext: '0544', full: '010-8494-0544', role: '대행사(김다희 팀장)' },
  '김다희': { ext: '0544', full: '010-8494-0544', role: '대행사 팀장' },
  '김다희팀장': { ext: '0544', full: '010-8494-0544', role: '대행사 팀장' },
  '김다희 팀장': { ext: '0544', full: '010-8494-0544', role: '대행사 팀장' },
  '김다희팀장님': { ext: '0544', full: '010-8494-0544', role: '대행사 팀장' },
  '김다희 팀장님': { ext: '0544', full: '010-8494-0544', role: '대행사 팀장' },
};

const STAFF_PHONE_ENTRIES = Object.entries(STAFF_PHONE_MAP);
const STAFF_INFO_CACHE = new Map<string, { ext: string; full: string; role: string } | null>();

export function getStaffInfo(name: string): { ext: string; full: string; role: string } | null {
  const clean = name.replace(/\s+/g, '');
  if (STAFF_INFO_CACHE.has(clean)) {
    return STAFF_INFO_CACHE.get(clean)!;
  }
  let result: { ext: string; full: string; role: string } | null = null;
  if (STAFF_PHONE_MAP[clean]) {
    result = STAFF_PHONE_MAP[clean];
  } else if (clean.includes('희선')) {
    result = STAFF_PHONE_MAP['희선팀장님'];
  } else if (clean.includes('지영')) {
    result = STAFF_PHONE_MAP['지영팀장님'];
  } else if (clean.includes('제이민') || clean.includes('김다희') || clean.includes('다희')) {
    result = STAFF_PHONE_MAP['제이민'];
  } else if (clean.includes('과장')) {
    result = STAFF_PHONE_MAP['과장님'];
  } else {
    for (let i = 0; i < STAFF_PHONE_ENTRIES.length; i++) {
      const [key, val] = STAFF_PHONE_ENTRIES[i];
      if (clean.includes(key) || key.includes(clean)) {
        result = val;
        break;
      }
    }
  }
  if (STAFF_INFO_CACHE.size >= 200) {
    STAFF_INFO_CACHE.clear();
  }
  STAFF_INFO_CACHE.set(clean, result);
  return result;
}

// 본문 내용을 개조식(-)으로 깔끔하게 렌더링하는 함수
export function renderBulletedContent(text: string, isLargeFont: boolean) {
  if (!text) return null;

  // 1. 줄바꿈(\n)이 있는 경우: 엔터로 분리된 각 줄을 개조식(-)으로 렌더링
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (rawLines.length > 1) {
    return (
      <div className="space-y-1">
        {rawLines.map((line, idx) => {
          const cleanLine = line.replace(/^[-•*·]\s*/, '');
          const isHeading = idx === 0 && !line.startsWith('-') && !line.startsWith('•') && !line.startsWith('*');
          return (
            <div key={`${idx}-${cleanLine.slice(0, 16)}`} className="flex items-start gap-1.5">
              <span className="text-slate-400 font-bold shrink-0 text-xs select-none mt-0.5">
                {isHeading ? '▪' : '-'}
              </span>
              <span className={`${isLargeFont ? 'text-sm' : 'text-xs'} ${isHeading ? 'font-bold text-slate-900' : 'font-medium text-slate-800'} leading-relaxed break-keep`}>
                {cleanLine}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // 2. 콜론(:)이 포함된 경우: "제목"과 "개조식 내용(-)"으로 2줄 분리
  // 예: "1차 사전답사: 현장 실사 및 행사장소 '수변문화쉼터' 검토 완료"
  if (text.includes(':')) {
    const colonIdx = text.indexOf(':');
    const titlePart = text.substring(0, colonIdx).trim();
    const bodyPart = text.substring(colonIdx + 1).trim();

    return (
      <div className="space-y-1">
        {titlePart && (
          <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} font-bold text-slate-900 flex items-center gap-1`}>
            <span>{titlePart}</span>
          </div>
        )}
        {bodyPart && (
          <div className="flex items-start gap-1.5 pl-1">
            <span className="text-slate-400 font-bold shrink-0 text-xs select-none mt-0.5">-</span>
            <span className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-700 font-medium leading-relaxed break-keep`}>
              {bodyPart}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 3. 일반 단일 라인
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-slate-400 font-bold shrink-0 text-xs select-none mt-0.5">-</span>
      <span className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-800 font-medium leading-relaxed break-keep`}>
        {text}
      </span>
    </div>
  );
}

interface DetailEditRowProps {
  initialDetail: string;
  onUpdate: (newDetail: string) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

const DetailEditRow = React.memo(function DetailEditRow({
  initialDetail,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: DetailEditRowProps) {
  const parsed = useMemo(() => parseDetail(initialDetail), [initialDetail]);
  const [lastEmitted, setLastEmitted] = useState<string>(initialDetail);
  const [prevDetail, setPrevDetail] = useState<string>(initialDetail);
  const [date, setDate] = useState<string>(parsed.date);
  const [status, setStatus] = useState<'done' | 'in-progress' | 'todo'>(parsed.status);
  const [attendees, setAttendees] = useState<string>(parsed.attendees);
  const [text, setText] = useState<string>(parsed.text);

  if (prevDetail !== initialDetail) {
    setPrevDetail(initialDetail);
    // 외부 변경(순서 이동 ▲/▼, 초기 로드 등)인 경우에만 파싱값 동기화, 자체 타이핑 시 덮어쓰기 차단
    if (initialDetail !== lastEmitted) {
      setLastEmitted(initialDetail);
      setDate(parsed.date);
      setStatus(parsed.status);
      setAttendees(parsed.attendees);
      setText(parsed.text);
    }
  }

  const emitChange = useCallback(
    (newDate: string, newStatus: 'done' | 'in-progress' | 'todo', newAttendees: string, newText: string) => {
      const formatted = formatDetail({ date: newDate, status: newStatus, attendees: newAttendees, text: newText });
      setLastEmitted(formatted);
      onUpdate(formatted);
    },
    [onUpdate]
  );

  return (
    <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1.5 shadow-2xs">
      <div className="flex items-center gap-1.5">
        {/* 날짜 입력 */}
        <input
          type="text"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            emitChange(e.target.value, status, attendees, text);
          }}
          placeholder="날짜 (7.29)"
          className="w-24 px-2 py-0.5 border border-amber-400 rounded bg-amber-50/40 text-xs font-bold font-mono shrink-0"
        />
        {/* 상태 선택 */}
        <select
          value={status}
          onChange={(e) => {
            const nextStatus = e.target.value as 'done' | 'in-progress' | 'todo';
            setStatus(nextStatus);
            emitChange(date, nextStatus, attendees, text);
          }}
          className={`px-1.5 py-0.5 text-xs font-black rounded border cursor-pointer shrink-0 ${
            status === 'done'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : status === 'in-progress'
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-blue-50 text-blue-900 border-blue-300'
          }`}
        >
          <option value="done">✓ 완료</option>
          <option value="in-progress">▶ 진행</option>
          <option value="todo">○ 예정</option>
        </select>
        {/* 참여자 입력 */}
        <input
          type="text"
          value={attendees}
          onChange={(e) => {
            setAttendees(e.target.value);
            emitChange(date, status, e.target.value, text);
          }}
          placeholder="참석자 (예: 과장님 7116, 오창선 7116, 제이민(김다희) 0544, 지영팀장님 7031, 희선팀장님 7011, 서승오 7034, 임석훤 7012, 남상희 7025)"
          className="flex-1 min-w-0 px-2 py-0.5 border border-slate-300 rounded text-xs font-medium text-slate-800 bg-white"
        />
        {/* 위치(순서) 이동 및 삭제 버튼 그룹 */}
        <div className="flex items-center gap-0.5 shrink-0 bg-slate-100 p-0.5 rounded-md border border-slate-200">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            className={`p-1 rounded cursor-pointer transition-colors ${
              canMoveUp
                ? 'text-slate-700 hover:bg-slate-200 hover:text-slate-900 active:scale-95'
                : 'text-slate-300 cursor-not-allowed opacity-40'
            }`}
            title="위로 이동"
          >
            <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            className={`p-1 rounded cursor-pointer transition-colors ${
              canMoveDown
                ? 'text-slate-700 hover:bg-slate-200 hover:text-slate-900 active:scale-95'
                : 'text-slate-300 cursor-not-allowed opacity-40'
            }`}
            title="아래로 이동"
          >
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
          <span className="w-[1px] h-3 bg-slate-300 mx-0.5" />
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-red-500 hover:bg-red-50 hover:text-red-700 rounded cursor-pointer transition-colors active:scale-95"
            title="과업 삭제"
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        </div>
      </div>
      {/* 내용 본문 입력 (스페이스바 띄어쓰기 100% 완벽 보존 textarea) */}
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          emitChange(date, status, attendees, e.target.value);
        }}
        rows={2}
        placeholder="세부 과업 내용 입력 (엔터로 줄바꿈하여 한 줄씩 개조식 작성 가능)"
        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-900 bg-white leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
    </div>
  );
});

const subscribeDays = () => () => {};
const getClientDaysLeft = () => {
  const diff = Math.ceil((FESTIVAL_TARGET_TIMESTAMP - Date.now()) / (1000 * 60 * 60 * 24));
  return typeof diff === 'number' && !isNaN(diff) && diff > 0 ? diff : 0;
};
const getServerDaysLeft = () => 0;

// 외부 링크 접속자 vs 로컬 PC 관리자 판별 (SSR 하이드레이션 무결성 보장)
const subscribeLocalAdmin = () => () => {};
const getClientIsLocalAdmin = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('127.0.0.1') ||
    window.location.hostname.includes('trycloudflare.com') ||
    window.location.hostname.includes('loca.lt')
  );
};
const getServerIsLocalAdmin = () => false;

function YangjaeFestivalDashboardComponent() {
  const { data = YANGJAE_FALLBACK_DATA } = useYangjaeFestival();
  const saveMutation = useSaveYangjaeFestival();

  // 로컬 관리자 여부 (외부 링크로 접속한 일반 사용자는 false -> 공유/편집 기능 숨김)
  const isLocalAdmin = useSyncExternalStore(subscribeLocalAdmin, getClientIsLocalAdmin, getServerIsLocalAdmin);

  // 컴포넌트별 분리된 독립 편집 상태 (undefined 크래시 방지 안전 폴백 장착)
  const [editingOverview, setEditingOverview] = useState<boolean>(false);
  const [editOverviewData, setEditOverviewData] = useState<FestivalData['meta']>(() => data?.meta || YANGJAE_FALLBACK_DATA.meta);

  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [editMilestoneData, setEditMilestoneData] = useState<MilestoneItem | null>(null);
  const [detailDrafts, setDetailDrafts] = useState<DetailDraft[]>([]);

  const [editingBooths, setEditingBooths] = useState<boolean>(false);
  const [editBoothsData, setEditBoothsData] = useState<BoothItem[]>(() => data?.booths || YANGJAE_FALLBACK_DATA.booths || []);

  const [saveToast, setSaveToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('수정 사항이 저장되었습니다!');

  const [selectedTab, setSelectedTab] = useState<'milestones' | 'booths'>('milestones');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [copied, setCopied] = useState<boolean>(false);
  const [isLargeFont, setIsLargeFont] = useState<boolean>(false);

  // 과제별 Collapse / Expand 상태 (ID 단위, 기본 전체 접힘: Default Collapsed)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(() => new Set());

  const toggleTaskExpand = useCallback((id: number) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const allMilestoneIds = useMemo(() => {
    const list = data?.milestones || [];
    const ids = new Set<number>();
    for (let i = 0; i < list.length; i++) {
      if (list[i]?.id !== undefined) {
        ids.add(list[i].id);
      }
    }
    return ids;
  }, [data?.milestones]);

  const isAllExpanded = useMemo(() => {
    if (allMilestoneIds.size === 0) return false;
    for (const id of allMilestoneIds) {
      if (!expandedTaskIds.has(id)) return false;
    }
    return true;
  }, [allMilestoneIds, expandedTaskIds]);

  const toggleAllExpand = useCallback(() => {
    setExpandedTaskIds((prev) => {
      if (allMilestoneIds.size === 0) return new Set();
      let allExpanded = true;
      for (const id of allMilestoneIds) {
        if (!prev.has(id)) {
          allExpanded = false;
          break;
        }
      }
      return allExpanded ? new Set() : new Set(allMilestoneIds);
    });
  }, [allMilestoneIds]);

  // Derived D-Day calculation
  const daysLeft = useSyncExternalStore(subscribeDays, getClientDaysLeft, getServerDaysLeft);

  const activeBooths = useMemo(() => {
    return (editingBooths ? editBoothsData : (data?.booths || [])) || [];
  }, [editingBooths, editBoothsData, data?.booths]);

  const confirmedBoothCount = useMemo(() => {
    let count = 0;
    const list = activeBooths || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i]?.status === '확정') {
        count++;
      }
    }
    return count;
  }, [activeBooths]);

  const categoryBoothsMap = useMemo(() => {
    const map = new Map<string, BoothItem[]>();
    const list = activeBooths || [];
    map.set('전체', list);
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b) continue;
      const cat = b.category || '기타';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(b);
      // Dual-key alias support for '보건소 사업' and '보건소 특화'
      if (cat === '보건소 사업') {
        if (!map.has('보건소 특화')) map.set('보건소 특화', []);
        map.get('보건소 특화')!.push(b);
      } else if (cat === '보건소 특화') {
        if (!map.has('보건소 사업')) map.set('보건소 사업', []);
        map.get('보건소 사업')!.push(b);
      }

      // Multi-key alias support for '전문 의료·검진', '의료·검진', '의료 검진'
      if (cat === '전문 의료·검진' || cat === '의료·검진' || cat === '의료 검진') {
        const medicalAliases = ['전문 의료·검진', '의료·검진', '의료 검진'];
        for (const alias of medicalAliases) {
          if (!map.has(alias)) map.set(alias, []);
          if (alias !== cat) map.get(alias)!.push(b);
        }
      }
    }
    return map;
  }, [activeBooths]);

  const handleSelectTab = useCallback((tabId: 'milestones' | 'booths') => {
    setSelectedTab(tabId);
  }, []);

  const handleSelectCategory = useCallback((cat: string) => {
    setSelectedCategory(cat);
  }, []);

  const PUBLIC_SHARE_URL = 'https://codes-investing-findings-lucas.trycloudflare.com/festival/yangjae';

  // 1. 행사 개요 독립 편집 핸들러
  const handleStartEditOverview = () => {
    setEditOverviewData(safeClone(data.meta));
    setEditingOverview(true);
  };
  const handleCancelEditOverview = () => {
    setEditingOverview(false);
  };
  const handleSaveOverview = async () => {
    try {
      await saveMutation.mutateAsync({
        ...data,
        meta: editOverviewData,
      });
      setEditingOverview(false);
      setToastMessage('행사 개요가 저장되었습니다!');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('행사 개요 저장에 실패했습니다.');
    }
  };

  // 2. 개별 추진과제 독립 편집 핸들러
  const handleStartEditMilestone = (m: MilestoneItem) => {
    setEditMilestoneData(safeClone(m));
    setEditingMilestoneId(m.id);
    setExpandedTaskIds((prev) => new Set([...prev, m.id]));
    const drafts: DetailDraft[] = (m.details || []).map((detail, idx) => ({
      uid: `m-${m.id}-detail-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      raw: detail,
    }));
    setDetailDrafts(drafts);
  };
  const handleCancelEditMilestone = () => {
    setEditingMilestoneId(null);
    setEditMilestoneData(null);
    setDetailDrafts([]);
  };
  const handleSaveMilestone = async () => {
    if (!editMilestoneData || editingMilestoneId === null) return;
    try {
      const finalDetails = detailDrafts.length > 0
        ? detailDrafts.map((d) => d.raw)
        : (editMilestoneData.details || []);
      const updatedMilestone: MilestoneItem = {
        ...editMilestoneData,
        details: finalDetails,
      };
      const nextMilestones = (data.milestones || []).map((m) =>
        m.id === editingMilestoneId ? updatedMilestone : m
      );
      await saveMutation.mutateAsync({
        ...data,
        milestones: nextMilestones,
      });
      setEditingMilestoneId(null);
      setEditMilestoneData(null);
      setDetailDrafts([]);
      setToastMessage('추진과제가 저장되었습니다!');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('추진과제 저장에 실패했습니다.');
    }
  };
  const handleAddMilestone = async () => {
    const maxId = (data.milestones || []).reduce((max, m) => Math.max(max, Number(m?.id) || 0), 0);
    const nextId = (Number.isFinite(maxId) ? maxId : 0) + 1;
    const initialDetailStr = '세부 추진 계획을 입력하세요.';
    const newTask: MilestoneItem = {
      id: nextId,
      number: `추진과제 ${nextId}`,
      title: '신규 추진과제',
      status: 'todo',
      period: '',
      cooperationDepts: [],
      details: [initialDetailStr],
    };
    const nextMilestones = [...(data.milestones || []), newTask];
    try {
      await saveMutation.mutateAsync({
        ...data,
        milestones: nextMilestones,
      });
      setExpandedTaskIds((prev) => new Set([...prev, nextId]));
      setEditMilestoneData(newTask);
      setEditingMilestoneId(nextId);
      setDetailDrafts([
        {
          uid: `m-${nextId}-detail-0-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          raw: initialDetailStr,
        },
      ]);
    } catch {
      alert('과제 추가에 실패했습니다.');
    }
  };
  const handleDeleteMilestone = async (id: number) => {
    if (!confirm('해당 추진과제를 삭제하시겠습니까?')) return;
    const nextMilestones = (data.milestones || []).filter((m) => m.id !== id);
    try {
      await saveMutation.mutateAsync({
        ...data,
        milestones: nextMilestones,
      });
      setExpandedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (editingMilestoneId === id) {
        setEditingMilestoneId(null);
        setEditMilestoneData(null);
        setDetailDrafts([]);
      }
      setToastMessage('추진과제가 삭제되었습니다.');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('과제 삭제에 실패했습니다.');
    }
  };

  // 3. 부스 현황 독립 편집 핸들러
  const handleStartEditBooths = () => {
    setEditBoothsData(safeClone(data.booths || []));
    setEditingBooths(true);
  };
  const handleCancelEditBooths = () => {
    setEditBoothsData(safeClone(data.booths || []));
    setEditingBooths(false);
  };

  // 부스 순서 변경 핸들러 (위로 이동)
  const handleMoveBoothUp = useCallback((boothId: number) => {
    setEditBoothsData((prev) => {
      const list = [...prev];
      if (selectedCategory === '전체') {
        const idx = list.findIndex((b) => b.id === boothId);
        if (idx <= 0) return prev;
        const temp = list[idx];
        list[idx] = list[idx - 1];
        list[idx - 1] = temp;
        return list;
      } else {
        const filtered = list.filter((b) => {
          if (selectedCategory === '보건소 사업' || selectedCategory === '보건소 특화') {
            return b.category === '보건소 사업' || b.category === '보건소 특화';
          }
          if (selectedCategory === '전문 의료·검진' || selectedCategory === '의료·검진' || selectedCategory === '의료 검진') {
            return b.category === '전문 의료·검진' || b.category === '의료·검진' || b.category === '의료 검진';
          }
          return b.category === selectedCategory || (typeof b.category === 'string' && b.category.includes(selectedCategory));
        });
        const filteredIdx = filtered.findIndex((b) => b.id === boothId);
        if (filteredIdx <= 0) return prev;
        const prevBoothId = filtered[filteredIdx - 1].id;
        const idxA = list.findIndex((b) => b.id === boothId);
        const idxB = list.findIndex((b) => b.id === prevBoothId);
        if (idxA === -1 || idxB === -1) return prev;
        const temp = list[idxA];
        list[idxA] = list[idxB];
        list[idxB] = temp;
        return list;
      }
    });
  }, [selectedCategory]);

  // 부스 순서 변경 핸들러 (아래로 이동)
  const handleMoveBoothDown = useCallback((boothId: number) => {
    setEditBoothsData((prev) => {
      const list = [...prev];
      if (selectedCategory === '전체') {
        const idx = list.findIndex((b) => b.id === boothId);
        if (idx === -1 || idx >= list.length - 1) return prev;
        const temp = list[idx];
        list[idx] = list[idx + 1];
        list[idx + 1] = temp;
        return list;
      } else {
        const filtered = list.filter((b) => {
          if (selectedCategory === '보건소 사업' || selectedCategory === '보건소 특화') {
            return b.category === '보건소 사업' || b.category === '보건소 특화';
          }
          if (selectedCategory === '전문 의료·검진' || selectedCategory === '의료·검진' || selectedCategory === '의료 검진') {
            return b.category === '전문 의료·검진' || b.category === '의료·검진' || b.category === '의료 검진';
          }
          return b.category === selectedCategory || (typeof b.category === 'string' && b.category.includes(selectedCategory));
        });
        const filteredIdx = filtered.findIndex((b) => b.id === boothId);
        if (filteredIdx === -1 || filteredIdx >= filtered.length - 1) return prev;
        const nextBoothId = filtered[filteredIdx + 1].id;
        const idxA = list.findIndex((b) => b.id === boothId);
        const idxB = list.findIndex((b) => b.id === nextBoothId);
        if (idxA === -1 || idxB === -1) return prev;
        const temp = list[idxA];
        list[idxA] = list[idxB];
        list[idxB] = temp;
        return list;
      }
    });
  }, [selectedCategory]);

  const handleSaveBooths = async () => {
    try {
      // 변경된 순서에 맞춰 No.1~No.N ID 순차 정규화 후 저장
      const normalizedBooths = editBoothsData.map((b, idx) => ({
        ...b,
        id: idx + 1,
      }));
      await saveMutation.mutateAsync({
        ...data,
        booths: normalizedBooths,
      });
      setEditingBooths(false);
      setToastMessage('부스 순서 및 현황이 저장되었습니다!');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('부스 현황 저장에 실패했습니다.');
    }
  };

  const handleCopySummary = useCallback(async () => {
    const targetUrl = typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')
      ? `${window.location.origin}/festival/yangjae`
      : PUBLIC_SHARE_URL;

    const title = data?.meta?.title || '2026 양재천 걷자! 건강 페스티벌';
    const period = data?.weeklyReport?.period || '8. 31. ~ 9. 4.';
    const weekTitle = data?.weeklyReport?.weekTitle || '주간 추진실적 보고';
    const staffNote = data?.meta?.staffNote || '행사 참여 직원 대체휴무 시행 예정';

    const fallbackWeeklyItems = [
      '1. [홍보] 행사 포스터 시안 제작 및 대구민 홍보 채널 구축 진행중 (지영팀장님, 오창선)\n   - 내용: 메인 포스터 디자인 감수 및 구청·보건소 홈페이지 배너·통합예약 연계 준비',
      '2. [기획/회의] 9. 1. 행사 추진 총괄 및 현안 실무회의 완료\n   - 참석: 과장님, 희선팀장님, 지영팀장님, 임석훤, 남상희, 오창선\n   - 안건: 행사 추진 관련 전반, VIP 초청, 참가자 모집 방법(800명), 보도자료 배포 등',
      '3. [장소/현장] 9. 2. 양재천 현장답사 및 유관기관 합동점검 실시\n   - 참석: 지영팀장님, 오창선, 유디치과 관계자\n   - 내용: 유디치과 이동 검진버스 진입 동선 및 건강체험 추가 부스 설치 구역 현장 실측',
      '4. [의전] 구청장님 행사 참석 관련 구청 비서실 사전 협의 완료\n   - 내용: 행사 개회식 및 걷기대회 구청장님 참석 확정 조율 (지영팀장님)',
      '5. [부스] 9. 3. 유관 의료단체(강남구의사회·한의사회) 부스 운영 협조 회의\n   - 참석: 과장님, 오창선\n   - 내용: 전문 의료진 건강상담 부스 운영 확정 및 세부 프로그램 운영안 협의 조율중',
    ];

    const weeklyLines = data?.weeklyReport?.items && data.weeklyReport.items.length > 0
      ? data.weeklyReport.items.join('\n')
      : fallbackWeeklyItems.join('\n');

    const text = `[${title} | ${weekTitle}]
(추진기간: ${period})

**${staffNote}**

■ 추진내역
${weeklyLines}

※ 아래 링크 클릭하시면 전체 추진내역 열람이 가능합니다.
${targetUrl}`;

    // 1. First attempt clipboard copy
    const copiedSuccess = await copyToClipboardSafe(text);

    // 2. Mobile/Tablet or Native Web Share support
    let sharedSuccess = false;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const shareData = {
          title: `[${title} | ${weekTitle}] (${period})`,
          text: text,
        };
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          sharedSuccess = true;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          sharedSuccess = true;
        }
      }
    }

    // 3. UI Feedback / Graceful Fallback
    if (copiedSuccess) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    } else if (!sharedSuccess && typeof window !== 'undefined' && typeof window.prompt === 'function') {
      window.prompt('아래 주간 추진실적 내용을 복사(Ctrl+C 또는 길게 터치)하세요:', text);
    }
  }, [data, PUBLIC_SHARE_URL]);

  const filteredBooths = useMemo(() => {
    if (selectedCategory === '전체') return activeBooths || [];
    if (categoryBoothsMap.has(selectedCategory)) {
      return categoryBoothsMap.get(selectedCategory)!;
    }
    const list: BoothItem[] = [];
    const booths = activeBooths || [];
    for (let i = 0; i < booths.length; i++) {
      const b = booths[i];
      if (b && typeof b.category === 'string' && b.category.includes(selectedCategory)) {
        list.push(b);
      }
    }
    return list;
  }, [activeBooths, selectedCategory, categoryBoothsMap]);

  return (
    <div className="w-full flex justify-center selection:bg-slate-800 selection:text-white pb-16 relative">
      
      {/* Floating Copy Success Toast Modal */}
      {copied && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-slate-700">
          <Check className="w-5 h-5 text-emerald-400 stroke-[3]" />
          <div>
            <div className="font-bold text-sm">금주({data?.weeklyReport?.period || '8. 31. ~ 9. 4.'}) 주간 추진실적이 복사되었습니다!</div>
            <div className="text-xs text-slate-300">카카오톡 또는 문자에 바로 붙여넣기(Ctrl+V) 하세요.</div>
          </div>
        </div>
      )}

      {/* Floating Save Success Toast Modal */}
      {saveToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-emerald-600">
          <Check className="w-5 h-5 text-emerald-300 stroke-[3]" />
          <div>
            <div className="font-bold text-sm">{toastMessage}</div>
            <div className="text-xs text-emerald-200">로컬 DB에 성공적으로 반영되었습니다.</div>
          </div>
        </div>
      )}

      <div 
        className={`yangjae-dashboard-container w-full max-w-md bg-white sm:rounded-2xl sm:border-2 sm:shadow-lg overflow-hidden flex flex-col min-h-screen text-slate-900 font-sans transition-all sm:border-slate-300 ${
          isLargeFont ? 'is-large-font text-[16px]' : ''
        }`}
      >
        <style>{LARGE_FONT_STYLES}</style>
        
        {/* Top Sticky Header */}
        <div className="sticky top-0 z-30 bg-slate-900 text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-1.5 sm:gap-2 border-b border-slate-800 shadow-sm">
          <div className="min-w-0 flex-1">
            <div className={`${isLargeFont ? 'text-lg' : 'text-sm'} font-bold tracking-tight truncate`}>2026 양재천 건강 페스티벌</div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Large Font Toggle Button */}
            <button
              type="button"
              onClick={() => setIsLargeFont(!isLargeFont)}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black border transition-all cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap ${
                isLargeFont 
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md ring-2 ring-amber-300/60' 
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
              title="글자 크기 확대/보통 전환"
            >
              <span className="font-extrabold text-[12px] sm:text-[13px]">{isLargeFont ? '가-' : '가+'}</span>
              <span>{isLargeFont ? '보통' : '큰글씨'}</span>
            </button>

            {/* Kakao Share / Copy Button: 전체 접속자(모바일/데스크톱) 공유 지원 */}
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1 sm:gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all whitespace-nowrap"
              title="카카오톡/문자 주간 추진실적 공유"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>공유</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-3.5 space-y-4 bg-slate-100">
          
          {/* Section 1: Official Event Overview (Administrative Korean Document Style 󰏚 개 요) */}
          <div className="bg-white border-2 border-slate-300 rounded-xl p-4 shadow-2xs">
            {/* Header: Title + Independent Edit Buttons + D-Day Badge */}
            <div className="flex items-center justify-between pb-2 mb-3 border-b-2 border-slate-900 gap-2">
              <div className="flex items-center gap-2">
                <span className={`inline-block ${isLargeFont ? 'w-4.5 h-4.5 border-[2.5px]' : 'w-4 h-4 border-2'} border-slate-900 rounded-[1.5px] shrink-0`} />
                <span className={`${isLargeFont ? 'text-lg' : 'text-base'} font-black text-slate-900 tracking-tight`}>
                  행사 개요
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {editingOverview ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSaveOverview}
                      disabled={saveMutation.isPending}
                      className="px-2 py-0.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-1 cursor-pointer"
                      title="행사 개요 저장"
                    >
                      {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      <span>저장</span>
                    </button>
                    <button
                      onClick={handleCancelEditOverview}
                      className="px-2 py-0.5 text-xs font-bold bg-slate-600 hover:bg-slate-500 text-white rounded flex items-center gap-0.5 cursor-pointer"
                      title="취소"
                    >
                      <X className="w-3 h-3" />
                      <span>취소</span>
                    </button>
                  </div>
                ) : isLocalAdmin ? (
                  <button
                    type="button"
                    onClick={handleStartEditOverview}
                    className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded cursor-pointer transition-colors"
                    title="행사 개요 수정"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                ) : null}
                <span className={`font-black ${isLargeFont ? 'text-sm px-3 py-1' : 'text-xs px-2.5 py-0.5'} bg-slate-900 text-amber-300 rounded-full border border-slate-700 shadow-xs tracking-wide shrink-0`}>
                  D-{daysLeft}
                </span>
              </div>
            </div>

            {/* Key-Value Details Grid */}
            <div className="space-y-2">
              {/* 행사명 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[68px_10px_1fr] text-sm' : 'grid-cols-[58px_8px_1fr] text-xs'} items-baseline gap-1`}>
                <span className="font-bold text-slate-600 tracking-wider">• 행사명</span>
                <span className="font-bold text-slate-400 text-center">:</span>
                {editingOverview ? (
                  <input
                    type="text"
                    value={editOverviewData?.title || ''}
                    onChange={(e) => setEditOverviewData(prev => ({
                      ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                      title: e.target.value
                    }))}
                    className="w-full px-2 py-1 border border-amber-400 rounded bg-amber-50/50 font-bold text-slate-900"
                  />
                ) : (
                  <span className="font-extrabold text-slate-900 leading-snug break-keep">{data?.meta?.title || '2026 양재천 건강 페스티벌'}</span>
                )}
              </div>

              {/* 일시 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[68px_10px_1fr] text-sm' : 'grid-cols-[58px_8px_1fr] text-xs'} items-baseline gap-1`}>
                <span className="font-bold text-slate-600 tracking-wider">• 일&nbsp;&nbsp;&nbsp;&nbsp;시</span>
                <span className="font-bold text-slate-400 text-center">:</span>
                {editingOverview ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={editOverviewData?.eventDate || ''}
                      onChange={(e) => setEditOverviewData(prev => ({
                        ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                        eventDate: e.target.value
                      }))}
                      className="w-1/2 px-2 py-1 border border-amber-400 rounded bg-amber-50/50 font-semibold text-slate-900"
                      placeholder="2026-10-31(토)"
                    />
                    <input
                      type="text"
                      value={editOverviewData?.eventTime || ''}
                      onChange={(e) => setEditOverviewData(prev => ({
                        ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                        eventTime: e.target.value
                      }))}
                      className="w-1/2 px-2 py-1 border border-amber-400 rounded bg-amber-50/50 font-semibold text-slate-900"
                      placeholder="09:00 ~ 14:00"
                    />
                  </div>
                ) : (
                  <span className="font-semibold text-slate-800">{data?.meta?.eventDate || ''} ({data?.meta?.eventTime || ''})</span>
                )}
              </div>

              {/* 장소 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[68px_10px_1fr] text-sm' : 'grid-cols-[58px_8px_1fr] text-xs'} items-baseline gap-1`}>
                <span className="font-bold text-slate-600 tracking-wider">• 장&nbsp;&nbsp;&nbsp;&nbsp;소</span>
                <span className="font-bold text-slate-400 text-center">:</span>
                {editingOverview ? (
                  <input
                    type="text"
                    value={editOverviewData?.location || ''}
                    onChange={(e) => setEditOverviewData(prev => ({
                      ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                      location: e.target.value
                    }))}
                    className="w-full px-2 py-1 border border-amber-400 rounded bg-amber-50/50 font-semibold text-slate-900"
                  />
                ) : (
                  <span className="font-semibold text-slate-800 leading-snug break-keep">{data?.meta?.location || ''}</span>
                )}
              </div>

              {/* 코스 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[68px_10px_1fr] text-sm' : 'grid-cols-[58px_8px_1fr] text-xs'} items-baseline gap-1`}>
                <span className="font-bold text-slate-600 tracking-wider">• 코&nbsp;&nbsp;&nbsp;&nbsp;스</span>
                <span className="font-bold text-slate-400 text-center">:</span>
                {editingOverview ? (
                  <input
                    type="text"
                    value={editOverviewData?.course || ''}
                    onChange={(e) => setEditOverviewData(prev => ({
                      ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                      course: e.target.value
                    }))}
                    className="w-full px-2 py-1 border border-amber-400 rounded bg-amber-50/50 font-semibold text-slate-900"
                  />
                ) : (
                  <span className="font-semibold text-slate-800">{data?.meta?.course || ''}</span>
                )}
              </div>

              {/* 참여 대상 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[68px_10px_1fr] text-sm' : 'grid-cols-[58px_8px_1fr] text-xs'} items-baseline gap-1`}>
                <span className="font-bold text-slate-600 tracking-wider">• 참&nbsp;&nbsp;&nbsp;&nbsp;여</span>
                <span className="font-bold text-slate-400 text-center">:</span>
                {editingOverview ? (
                  <input
                    type="text"
                    value={editOverviewData?.targetAudience || ''}
                    onChange={(e) => setEditOverviewData(prev => ({
                      ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                      targetAudience: e.target.value
                    }))}
                    className="w-full px-2 py-1 border border-amber-400 rounded bg-amber-50/50 font-semibold text-slate-900"
                  />
                ) : (
                  <span className="font-semibold text-slate-800">{data?.meta?.targetAudience || ''}</span>
                )}
              </div>

              {/* 구   성 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[68px_10px_1fr] text-sm' : 'grid-cols-[58px_8px_1fr] text-xs'} items-baseline gap-1`}>
                <span className="font-bold text-slate-600 tracking-wider">• 구&nbsp;&nbsp;&nbsp;&nbsp;성</span>
                <span className="font-bold text-slate-400 text-center">:</span>
                <div className="space-y-1">
                  {(editingOverview ? (editOverviewData?.programStructure || []) : (data?.meta?.programStructure || [])).map((item: string, pIdx: number) => (
                    <div key={`prog-${pIdx}-${item.slice(0, 15)}`} className="flex items-start">
                      {editingOverview ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const nextProg = [...(editOverviewData?.programStructure || [])];
                              nextProg[pIdx] = e.target.value;
                              setEditOverviewData(prev => ({
                                ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                                programStructure: nextProg
                              }));
                            }}
                            className="w-full px-2 py-0.5 border border-amber-400 rounded bg-white text-xs font-semibold text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextProg = (editOverviewData?.programStructure || []).filter((_: string, idx: number) => idx !== pIdx);
                              setEditOverviewData(prev => ({
                                ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                                programStructure: nextProg
                              }));
                            }}
                            className="p-0.5 text-red-500 hover:bg-red-50 rounded cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className={`font-semibold text-slate-800 leading-snug break-keep ${isLargeFont ? 'text-sm' : 'text-xs'}`}>
                          {item}
                        </span>
                      )}
                    </div>
                  ))}
                  {editingOverview && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextProg = [...(editOverviewData?.programStructure || [])];
                        nextProg.push('신규 체험·홍보 프로그램');
                        setEditOverviewData(prev => ({
                          ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                          programStructure: nextProg
                        }));
                      }}
                      className="mt-1 px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-900 rounded border border-amber-300 hover:bg-amber-200 flex items-center gap-1 cursor-pointer w-fit"
                    >
                      <Plus className="w-3 h-3" />
                      <span>구성 항목 추가</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 비고 (직원 복무) - 눈에 띄는 선명한 블루 강조 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[68px_10px_1fr] text-sm' : 'grid-cols-[58px_8px_1fr] text-xs'} items-baseline gap-1 pt-0.5`}>
                <span className="font-extrabold text-blue-600 tracking-wider">• 비&nbsp;&nbsp;&nbsp;&nbsp;고</span>
                <span className="font-bold text-blue-400 text-center">:</span>
                {editingOverview ? (
                  <input
                    type="text"
                    value={editOverviewData?.staffNote ?? data?.meta?.staffNote ?? '행사 참여 직원 대체휴무 시행 예정'}
                    onChange={(e) => setEditOverviewData(prev => ({
                      ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                      staffNote: e.target.value
                    }))}
                    className="w-full px-2 py-1 border border-blue-400 rounded bg-blue-50/50 font-bold text-blue-900"
                    placeholder="행사 참여 직원 대체휴무 시행 예정"
                  />
                ) : (
                  <span className="font-bold text-blue-600 leading-snug break-keep">
                    {data?.meta?.staffNote || '행사 참여 직원 대체휴무 시행 예정'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Tab Navigation (Clean Public Report Tabs - 2 Cols) */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-200 p-1.5 rounded-xl border border-slate-300">
            {YANGJAE_REPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`${isLargeFont ? 'py-3 text-base font-black' : 'py-2.5 text-xs font-bold'} rounded-lg transition-all cursor-pointer text-center ${
                  selectedTab === tab.id
                    ? 'bg-slate-900 text-white shadow-xs font-extrabold'
                    : 'text-slate-700 hover:bg-slate-300/70 font-bold'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: 추진과제별 현황 (협조부서 통합) */}
          {selectedTab === 'milestones' && (
            <div className="space-y-3.5">
              {/* Top Controls: 전체 펼치기/접기 + 과제 추가 */}
              <div className="px-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleAllExpand}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer py-1"
                >
                  {isAllExpanded ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>전체 접기</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>전체 펼치기</span>
                    </>
                  )}
                </button>
                {isLocalAdmin && (
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    disabled={saveMutation.isPending}
                    className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-900 rounded border border-amber-300 hover:bg-amber-200 flex items-center gap-1 cursor-pointer shadow-2xs"
                    title="신규 추진과제 추가"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>과제 추가</span>
                  </button>
                )}
              </div>

              {(data?.milestones || []).map((item) => {
                if (!item) return null;
                const isEditingThis = editingMilestoneId === item.id && editMilestoneData !== null;
                const targetItem = (isEditingThis ? editMilestoneData : item) || item;
                if (!targetItem) return null;
                const isExpanded = expandedTaskIds.has(item.id) || isEditingThis;

                return (
                  <div 
                    key={`milestone-card-${item.id}`}
                    className={`p-3.5 rounded-xl border-2 transition-all shadow-2xs ${
                      targetItem.status === 'in-progress'
                        ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-300'
                        : targetItem.status === 'done'
                        ? 'bg-white border-slate-300'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {/* Milestone Card Top: Number, Title, Status, Edit Buttons, Accordion Toggle */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 gap-1.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <input
                              type="text"
                              value={targetItem?.number || ''}
                              onChange={(e) => setEditMilestoneData({ ...targetItem, number: e.target.value })}
                              className="w-20 px-1.5 py-0.5 border border-amber-400 rounded bg-white text-xs font-black shrink-0"
                            />
                            <input
                              type="text"
                              value={targetItem?.title || ''}
                              onChange={(e) => setEditMilestoneData({ ...targetItem, title: e.target.value })}
                              className="flex-1 px-1.5 py-0.5 border border-amber-400 rounded bg-white text-xs font-extrabold text-slate-900 min-w-0"
                              placeholder="추진과제 제목"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleTaskExpand(item.id)}
                            className="flex items-center text-left cursor-pointer flex-1 min-w-0 group"
                          >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white shadow-2xs group-hover:bg-slate-800 transition-colors max-w-full">
                              <span className="font-black text-amber-300 text-[11px] shrink-0">
                                {item?.number || ''}
                              </span>
                              <span className="w-[1px] h-3 bg-slate-600 shrink-0" />
                              <span className={`${isLargeFont ? 'text-sm' : 'text-xs'} font-extrabold text-slate-50 tracking-tight truncate`}>
                                {item?.title || ''}
                              </span>
                            </div>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isEditingThis ? (
                          <>
                            <select
                              value={targetItem?.status || 'todo'}
                              onChange={(e) => setEditMilestoneData(prev => ({
                                ...(targetItem || {}),
                                ...(prev || {}),
                                status: e.target.value as 'done' | 'in-progress' | 'todo'
                              }))}
                              className="px-1.5 py-0.5 text-xs font-bold border border-amber-400 rounded bg-white"
                            >
                              <option value="done">완료</option>
                              <option value="in-progress">진행중</option>
                              <option value="todo">예정</option>
                            </select>
                            <button
                              type="button"
                              onClick={handleSaveMilestone}
                              disabled={saveMutation.isPending}
                              className="px-2 py-0.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-0.5 cursor-pointer"
                              title="과제 저장"
                            >
                              {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              <span>저장</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditMilestone}
                              className="px-2 py-0.5 text-xs font-bold bg-slate-600 hover:bg-slate-500 text-white rounded flex items-center gap-0.5 cursor-pointer"
                              title="취소"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMilestone(item.id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                              title="과제 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className={`${isLargeFont ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5'} font-bold rounded border ${
                              item.status === 'done'
                                ? 'bg-slate-100 text-slate-700 border-slate-300 font-extrabold'
                                : item.status === 'in-progress'
                                ? 'bg-amber-100 text-amber-900 border-amber-400 font-black'
                                : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}>
                              {item.status === 'done' ? '✓ 완료' : item.status === 'in-progress' ? '▶ 진행중' : '○ 예정'}
                            </span>
                            {isLocalAdmin && (
                              <button
                                type="button"
                                onClick={() => handleStartEditMilestone(item)}
                                className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded cursor-pointer transition-colors"
                                title="과제 수정"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleTaskExpand(item.id)}
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer transition-colors"
                              aria-label={isExpanded ? "과제 접기" : "과제 펼치기"}
                              title={isExpanded ? "과제 접기" : "과제 펼치기"}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expandable Body: Cooperation Departments & Detailed Task List */}
                    {isExpanded && (
                      <div className="pt-1 space-y-2.5">
                        {/* Cooperation Departments Tags (Integrated) */}
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-bold text-slate-500`}>협조부서:</span>
                          {isEditingThis ? (
                            <input
                              type="text"
                              key={`${targetItem?.id}-coop-input`}
                              defaultValue={targetItem?.cooperationDepts ? targetItem.cooperationDepts.join(', ') : ''}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setEditMilestoneData(prev => ({
                                  ...(targetItem || {}),
                                  ...(prev || {}),
                                  cooperationDepts: raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
                                }));
                              }}
                              placeholder="부서명 쉼표(,) 구분 (예: 치수과, 공원녹지과)"
                              className="flex-1 px-2 py-0.5 border border-amber-400 rounded bg-white text-xs"
                            />
                          ) : (
                            targetItem?.cooperationDepts && targetItem.cooperationDepts.length > 0 ? (
                              targetItem.cooperationDepts.map((dept: string, dIdx: number) => (
                                <span
                                  key={`${targetItem?.id}-dept-${dept}-${dIdx}`}
                                  className={`${isLargeFont ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5'} font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-md`}
                                >
                                  {dept}
                                </span>
                              ))
                            ) : null
                          )}
                        </div>

                        {/* Detailed Task List: 구분선, 맨 앞 날짜 뱃지, 완료/예정 상태 뱃지, 참여자 태그 */}
                        <div className="space-y-1">
                          {isEditingThis ? (
                            <div className="space-y-2 p-2 bg-slate-100/70 rounded-xl border border-slate-300">
                              <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                                <span>세부 실행 과업 (날짜 / 상태 / 참여자 / 내용)</span>
                                <span className="text-[10px] text-slate-500 font-normal">▲▼ 버튼으로 순서 이동 가능</span>
                              </div>
                              {(() => {
                                const activeDetailItems: DetailDraft[] = detailDrafts.length > 0
                                  ? detailDrafts
                                  : (targetItem?.details || []).map((detail, idx) => ({
                                      uid: `m-${targetItem.id}-detail-fallback-${idx}`,
                                      raw: detail,
                                    }));

                                return (
                                  <>
                                    {activeDetailItems.map((draft, dIdx) => (
                                      <DetailEditRow
                                        key={draft.uid}
                                        initialDetail={draft.raw}
                                        canMoveUp={dIdx > 0}
                                        canMoveDown={dIdx < activeDetailItems.length - 1}
                                        onMoveUp={() => {
                                          if (dIdx <= 0) return;
                                          const next = [...activeDetailItems];
                                          const [moved] = next.splice(dIdx, 1);
                                          next.splice(dIdx - 1, 0, moved);
                                          setDetailDrafts(next);
                                          setEditMilestoneData((prev) => (prev ? { ...prev, details: next.map((d) => d.raw) } : null));
                                        }}
                                        onMoveDown={() => {
                                          if (dIdx >= activeDetailItems.length - 1) return;
                                          const next = [...activeDetailItems];
                                          const [moved] = next.splice(dIdx, 1);
                                          next.splice(dIdx + 1, 0, moved);
                                          setDetailDrafts(next);
                                          setEditMilestoneData((prev) => (prev ? { ...prev, details: next.map((d) => d.raw) } : null));
                                        }}
                                        onUpdate={(newDetailStr) => {
                                          const next = [...activeDetailItems];
                                          next[dIdx] = { ...next[dIdx], raw: newDetailStr };
                                          setDetailDrafts(next);
                                          setEditMilestoneData((prev) => (prev ? { ...prev, details: next.map((d) => d.raw) } : null));
                                        }}
                                        onDelete={() => {
                                          const next = activeDetailItems.filter((_, i) => i !== dIdx);
                                          setDetailDrafts(next);
                                          setEditMilestoneData((prev) => (prev ? { ...prev, details: next.map((d) => d.raw) } : null));
                                        }}
                                      />
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newDetailStr = formatDetail({ date: '', status: 'todo', attendees: '', text: '신규 세부 과업 내용' });
                                        const newDraft: DetailDraft = {
                                          uid: `m-${targetItem.id}-detail-new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                                          raw: newDetailStr,
                                        };
                                        const next = [...activeDetailItems, newDraft];
                                        setDetailDrafts(next);
                                        setEditMilestoneData((prev) => (prev ? { ...prev, details: next.map((d) => d.raw) } : null));
                                      }}
                                      className="mt-1 px-2.5 py-1 text-[11px] font-bold bg-amber-100 text-amber-900 rounded border border-amber-300 hover:bg-amber-200 flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>세부 과업 추가</span>
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200/90 shadow-2xs">
                              {item.details.map((detail: string, dIdx: number) => {
                                const parsed = parseDetail(detail);
                                const isCoopTask = parsed.text.includes('[협조') || detail.includes('[협조');
                                return (
                                  <div 
                                    key={`${item.id}-detail-row-${dIdx}-${detail.slice(0, 20)}`} 
                                    className={`p-2.5 flex items-start gap-2.5 transition-colors ${
                                      isCoopTask 
                                        ? 'bg-indigo-50/50 hover:bg-indigo-50/80' 
                                        : 'hover:bg-white'
                                    }`}
                                  >
                                    {/* 1. 세로 한 열(Column) 타일: 위는 날짜, 아래는 상태로 배치 */}
                                    <div className="shrink-0 flex flex-col items-center justify-center rounded-lg border border-slate-300 overflow-hidden shadow-2xs font-mono min-w-[56px] text-center mt-0.5 bg-white">
                                      <span className="w-full bg-slate-200 text-slate-900 font-black text-[10.5px] px-1 py-0.5 tracking-tight border-b border-slate-300">
                                        {parsed.date || '상시'}
                                      </span>
                                      <span className={`w-full px-1 py-0.5 text-[9.5px] font-black tracking-tight ${
                                        parsed.status === 'done'
                                          ? 'bg-emerald-100 text-emerald-900'
                                          : parsed.status === 'in-progress'
                                          ? 'bg-amber-100 text-amber-900'
                                          : 'bg-sky-100 text-sky-900'
                                      }`}>
                                        {parsed.status === 'done' ? '✓ 완료' : parsed.status === 'in-progress' ? '▶ 진행' : '○ 예정'}
                                      </span>
                                    </div>

                                    {/* 3. 본문 텍스트 (개조식 렌더링) 및 참석자 태그 */}
                                    <div className="flex-1 min-w-0 pt-0.5 space-y-1.5">
                                      <div className={parsed.status === 'done' ? 'text-slate-700' : 'text-slate-950 font-medium'}>
                                        {renderBulletedContent(parsed.text, isLargeFont)}
                                      </div>

                                      {/* 4. 분리된 참석자 태그 & 행정번호 연동 (라벨 없이 순수 뱃지만 노출) */}
                                      {parsed.attendees && (
                                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                          {parsed.attendees.split(',').map((person, pIdx) => {
                                            const trimmed = person.trim();
                                            if (!trimmed) return null;
                                            const staff = getStaffInfo(trimmed);
                                            return staff ? (
                                              <a
                                                key={`attendee-${trimmed}-${pIdx}`}
                                                href={`tel:${staff.full}`}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 shadow-3xs transition-colors cursor-pointer"
                                                title={`전화 연결: ${staff.full}`}
                                              >
                                                <span>{trimmed}</span>
                                                <span className="text-amber-900 font-mono text-[9.5px] bg-amber-200/90 px-1 py-0.2 rounded font-black">
                                                  {staff.ext}
                                                </span>
                                              </a>
                                            ) : (
                                              <span
                                                key={`attendee-${trimmed}-${pIdx}`}
                                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-3xs"
                                              >
                                                {trimmed}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
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
                );
              })}
            </div>
          )}

          {/* TAB 2: 테마별 부스 현황 */}
          {selectedTab === 'booths' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <h3 className={`${isLargeFont ? 'text-base' : 'text-sm'} font-bold text-slate-900 flex items-center gap-1.5`}>
                  <span className={`inline-block ${isLargeFont ? 'w-3.5 h-3.5 border-2' : 'w-3 h-3 border-[1.5px]'} border-slate-900 rounded-[1px] shrink-0`} />
                  <span>테마별 부스 배치 계획</span>
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className={`${isLargeFont ? 'text-sm' : 'text-xs'} font-bold text-slate-700 mr-1`}>
                    확정 {confirmedBoothCount} / 총 {activeBooths.length}개
                  </span>
                  {editingBooths ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const maxId = (editBoothsData || []).reduce((max, b) => Math.max(max, Number(b?.id) || 0), 0);
                          const nextId = (Number.isFinite(maxId) ? maxId : 0) + 1;
                          setEditBoothsData([
                            ...editBoothsData,
                            {
                              id: nextId,
                              category: '보건소 사업',
                              name: '신규 부스명',
                              scale: '1동',
                              program: '체험 프로그램 내용',
                              status: '확정',
                            }
                          ]);
                        }}
                        className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-900 rounded border border-amber-300 hover:bg-amber-200 flex items-center gap-0.5 cursor-pointer"
                        title="부스 추가"
                      >
                        <Plus className="w-3 h-3" />
                        <span>추가</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveBooths}
                        disabled={saveMutation.isPending}
                        className="px-2 py-0.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-0.5 cursor-pointer"
                        title="부스 저장"
                      >
                        {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        <span>저장</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditBooths}
                        className="px-2 py-0.5 text-xs font-bold bg-slate-600 hover:bg-slate-500 text-white rounded flex items-center gap-0.5 cursor-pointer"
                        title="취소"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : isLocalAdmin ? (
                    <button
                      type="button"
                      onClick={handleStartEditBooths}
                      className="px-2.5 py-1 text-xs font-extrabold bg-amber-50 hover:bg-amber-100 text-amber-950 rounded-lg border border-amber-300 flex items-center gap-1 cursor-pointer transition-colors shadow-3xs"
                      title="부스 순서 변경 및 현황 수정"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-amber-700" />
                      <span>순서 변경 / 편집</span>
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {FESTIVAL_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleSelectCategory(cat)}
                    className={`${isLargeFont ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'} rounded-lg font-bold whitespace-nowrap border cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Editing Guidance Banner */}
              {editingBooths && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-2.5 text-xs text-amber-950 flex items-center justify-between shadow-3xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold bg-amber-200/90 text-amber-900 px-1.5 py-0.5 rounded text-[10.5px]">순서 변경</span>
                    <span>각 부스 카드의 <strong>▲ / ▼</strong> 버튼을 눌러 순서를 조정한 후 상단 <strong>[저장]</strong>을 눌러주세요.</span>
                  </div>
                </div>
              )}

              {/* Booths Cards List */}
              <div className="space-y-2.5">
                {filteredBooths.map((booth, fIdx) => {
                  const overallIdx = activeBooths.findIndex((b) => b.id === booth.id);
                  const displayNo = overallIdx !== -1 ? overallIdx + 1 : booth.id;
                  const canMoveUp = fIdx > 0;
                  const canMoveDown = fIdx < filteredBooths.length - 1;

                  return (
                    <div 
                      key={`booth-card-${booth.id}`}
                      className={`p-3.5 bg-white border-2 rounded-xl shadow-2xs transition-all ${
                        editingBooths ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-mono font-black text-slate-700`}>
                            No.{displayNo}
                          </span>
                          {editingBooths ? (
                            <input
                              type="text"
                              value={booth.category}
                              onChange={(e) => {
                                const next = [...editBoothsData];
                                const targetIdx = next.findIndex((b) => b.id === booth.id);
                                if (targetIdx !== -1) {
                                  next[targetIdx].category = e.target.value;
                                  setEditBoothsData(next);
                                }
                              }}
                              className="px-1.5 py-0.5 border border-amber-400 rounded bg-white text-xs font-bold w-24"
                            />
                          ) : (
                            <span className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300`}>
                              {booth.category}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {editingBooths ? (
                            <div className="flex items-center gap-1">
                              {/* 순서 변경 버튼 그룹 (▲ 위로 / ▼ 아래로) */}
                              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200">
                                <button
                                  type="button"
                                  disabled={!canMoveUp}
                                  onClick={() => handleMoveBoothUp(booth.id)}
                                  className={`p-1 rounded cursor-pointer transition-colors ${
                                    canMoveUp
                                      ? 'text-slate-700 hover:bg-slate-200 hover:text-slate-900 active:scale-95'
                                      : 'text-slate-300 cursor-not-allowed opacity-40'
                                  }`}
                                  title="위로 이동"
                                  aria-label={`${booth.name} 위로 이동`}
                                >
                                  <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                                <button
                                  type="button"
                                  disabled={!canMoveDown}
                                  onClick={() => handleMoveBoothDown(booth.id)}
                                  className={`p-1 rounded cursor-pointer transition-colors ${
                                    canMoveDown
                                      ? 'text-slate-700 hover:bg-slate-200 hover:text-slate-900 active:scale-95'
                                      : 'text-slate-300 cursor-not-allowed opacity-40'
                                  }`}
                                  title="아래로 이동"
                                  aria-label={`${booth.name} 아래로 이동`}
                                >
                                  <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                              </div>

                              <select
                                value={booth.status}
                                onChange={(e) => {
                                  const next = [...editBoothsData];
                                  const targetIdx = next.findIndex((b) => b.id === booth.id);
                                  if (targetIdx !== -1) {
                                    next[targetIdx].status = e.target.value;
                                    setEditBoothsData(next);
                                  }
                                }}
                                className="px-1.5 py-0.5 text-xs font-bold border border-amber-400 rounded bg-white"
                              >
                                <option value="확정">확정</option>
                                <option value="협의중">협의중</option>
                                <option value="신청완료">신청완료</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = editBoothsData.filter((b) => b.id !== booth.id);
                                  setEditBoothsData(next);
                                }}
                                className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                                title="부스 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className={`${isLargeFont ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5'} font-bold rounded border ${
                              booth.status === '확정'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}>
                              {booth.status}
                            </span>
                          )}
                        </div>
                      </div>

                    {editingBooths ? (
                      <input
                        type="text"
                        value={booth.name}
                        onChange={(e) => {
                          const next = [...editBoothsData];
                          const targetIdx = next.findIndex((b) => b.id === booth.id);
                          if (targetIdx !== -1) {
                            next[targetIdx].name = e.target.value;
                            setEditBoothsData(next);
                          }
                        }}
                        className="w-full px-2 py-1 border border-amber-400 rounded bg-white text-sm font-extrabold mb-1.5"
                        placeholder="부스 이름"
                      />
                    ) : (
                      <div className={`${isLargeFont ? 'text-base' : 'text-sm'} font-extrabold text-slate-900 mb-1.5`}>
                        {booth.name}
                      </div>
                    )}

                    {editingBooths ? (
                      <div className="space-y-1 bg-slate-50 p-2.5 rounded border border-slate-200 mb-1.5">
                        <span className="font-bold text-xs text-slate-600">내용:</span>
                        <textarea
                          value={booth.program}
                          onChange={(e) => {
                            const next = [...editBoothsData];
                            const targetIdx = next.findIndex((b) => b.id === booth.id);
                            if (targetIdx !== -1) {
                              next[targetIdx].program = e.target.value;
                              setEditBoothsData(next);
                            }
                          }}
                          className="w-full px-2 py-1 border border-amber-400 rounded bg-white text-xs leading-relaxed"
                          rows={2}
                        />
                      </div>
                    ) : (
                      <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed mb-1.5`}>
                        <span className="font-bold text-slate-600">내용: </span>{booth.program}
                      </div>
                    )}

                    <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-600 font-medium flex items-center justify-between`}>
                      {editingBooths ? (
                        <div className="flex items-center gap-1 w-full">
                          <span>부스규모:</span>
                          <input
                            type="text"
                            value={booth.scale}
                            onChange={(e) => {
                              const next = [...editBoothsData];
                              const targetIdx = next.findIndex((b) => b.id === booth.id);
                              if (targetIdx !== -1) {
                                next[targetIdx].scale = e.target.value;
                                setEditBoothsData(next);
                              }
                            }}
                            className="px-2 py-0.5 border border-amber-400 rounded bg-white text-xs flex-1"
                          />
                        </div>
                      ) : (
                        <span>부스규모: <strong className="text-slate-900">{booth.scale}</strong></span>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function YangjaeFestivalSkeleton() {
  return (
    <div className="w-full flex justify-center pb-16">
      <div className="w-full max-w-md bg-white sm:rounded-2xl sm:border-2 sm:border-slate-300 sm:shadow-lg overflow-hidden flex flex-col min-h-screen animate-pulse">
        {/* Top Header Skeleton */}
        <div className="bg-slate-900 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-1.5 sm:gap-2 border-b border-slate-800">
          <div className="min-w-0 flex-1">
            <div className="h-5 w-44 bg-slate-600 rounded" />
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <div className="h-7 w-14 sm:w-16 bg-slate-800 rounded-lg" />
            <div className="h-7 w-12 sm:w-14 bg-emerald-700/60 rounded-lg" />
          </div>
        </div>
        {/* Content Skeleton */}
        <div className="flex-1 p-4 space-y-4 bg-slate-50/50">
          <div className="bg-white border-2 border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b-2 border-slate-200">
              <div className="h-5 w-32 bg-slate-200 rounded" />
              <div className="h-6 w-14 bg-slate-300 rounded-md" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-slate-100 rounded w-full" />
              <div className="h-4 bg-slate-100 rounded w-5/6" />
              <div className="h-4 bg-slate-100 rounded w-4/6" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-10 bg-slate-200 rounded-xl" />
            <div className="h-10 bg-slate-200 rounded-xl" />
          </div>
          <div className="space-y-3">
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-3" />
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

YangjaeFestivalDashboardComponent.displayName = 'YangjaeFestivalDashboard';
export const YangjaeFestivalDashboard = React.memo(YangjaeFestivalDashboardComponent);
export default YangjaeFestivalDashboard;

