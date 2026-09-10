"use client";

import React, { useState, useMemo, useSyncExternalStore, useCallback } from 'react';
import { Check, Share2, Edit3, Save, X, Plus, Trash2, Loader2, ChevronDown, ChevronUp, ArrowUpDown, Phone, User, Building2, Tent, FolderInput, ArrowRightLeft } from 'lucide-react';
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

const FESTIVAL_CATEGORIES = ['전체', '민간', '보건소 부서'];
const FESTIVAL_TARGET_TIMESTAMP = new Date("2026-10-31T09:00:00").getTime();

const LARGE_FONT_STYLES = `
  .is-large-font .text-\\[9px\\] { font-size: 11.5px !important; }
  .is-large-font .text-\\[9\\.5px\\] { font-size: 12px !important; }
  .is-large-font .text-\\[10px\\] { font-size: 12.5px !important; }
  .is-large-font .text-\\[10\\.5px\\] { font-size: 13px !important; }
  .is-large-font .text-\\[11px\\] { font-size: 13.5px !important; }
  .is-large-font .text-\\[13px\\] { font-size: 15.5px !important; }
  .is-large-font .text-\\[13\\.5px\\] { font-size: 16px !important; }
  .is-large-font .text-xs {
    font-size: 14.5px !important;
    line-height: 1.55 !important;
  }
  .is-large-font .text-sm {
    font-size: 16.5px !important;
    line-height: 1.55 !important;
  }
  .is-large-font .text-base {
    font-size: 18.5px !important;
    line-height: 1.5 !important;
  }
  .is-large-font .text-lg {
    font-size: 21px !important;
    line-height: 1.45 !important;
  }
  .is-large-font .date-tile {
    min-width: 86px !important;
  }
  .is-large-font .date-text {
    font-size: 16.5px !important;
    line-height: 1.3 !important;
  }
  .is-large-font .status-text {
    font-size: 13px !important;
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

export interface BoothScaleParsed {
  dong: number;
  bus: number;
}

export function parseBoothScale(scale: string): BoothScaleParsed {
  if (!scale || typeof scale !== 'string') return { dong: 0, bus: 0 };
  const dongMatch = scale.match(/(\d+)\s*동/);
  let dong = 0;
  if (dongMatch) {
    dong = parseInt(dongMatch[1], 10);
  } else {
    const numOnly = scale.match(/^(\d+)$/);
    if (numOnly) dong = parseInt(numOnly[1], 10);
  }
  const busMatch = scale.match(/(?:검진)?버스\s*(\d+)\s*대|(\d+)\s*대\s*(?:검진)?버스|(?:검진)?버스/);
  let bus = 0;
  if (busMatch) {
    const num = busMatch[1] || busMatch[2];
    bus = num ? parseInt(num, 10) : 1;
  }
  return { dong, bus };
}

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
    
    const peoplePattern = /(과장|팀장(\([^)]*\))?|오창선|서승오|임석훤|남상희|김지영|제이민(\(대행사\))?|김다희|김형종|한국신체정보|김지현|서울대병원|유디|강남차병원)/g;
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
  // 김형종 주임님 (내선 7250 / 02-3423-7250)
  '김형종': { ext: '7250', full: '02-3423-7250', role: '주임' },
  '김형종주임': { ext: '7250', full: '02-3423-7250', role: '주임' },
  '김형종 주임': { ext: '7250', full: '02-3423-7250', role: '주임' },
  '김형종주임님': { ext: '7250', full: '02-3423-7250', role: '주임' },
  '김형종 주임님': { ext: '7250', full: '02-3423-7250', role: '주임' },
  '형종': { ext: '7250', full: '02-3423-7250', role: '주임' },
  '형종주임': { ext: '7250', full: '02-3423-7250', role: '주임' },
  '형종 주임': { ext: '7250', full: '02-3423-7250', role: '주임' },
  '형종주임님': { ext: '7250', full: '02-3423-7250', role: '주임' },
  '형종 주임님': { ext: '7250', full: '02-3423-7250', role: '주임' },
  // 김지현 보건소 담당자 (내선 7173 / 02-3423-7173)
  '김지현': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '김지현주무관': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '김지현 주무관': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '김지현주무관님': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '김지현 주무관님': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '지현': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '김지현담당자': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  // 서울대병원 강남센터 (010-5663-8276 / 8276)
  '서울대병원 강남센터': { ext: '8276', full: '010-5663-8276', role: '민간 의료기관 부스' },
  '서울대병원강남센터': { ext: '8276', full: '010-5663-8276', role: '민간 의료기관 부스' },
  '서울대학교병원 강남센터': { ext: '8276', full: '010-5663-8276', role: '민간 의료기관 부스' },
  '서울대학교병원강남센터': { ext: '8276', full: '010-5663-8276', role: '민간 의료기관 부스' },
  '서울대병원': { ext: '8276', full: '010-5663-8276', role: '민간 의료기관 부스' },
  '서울대학교병원': { ext: '8276', full: '010-5663-8276', role: '민간 의료기관 부스' },
  // (주)유디 (010-5192-2210 / 2210)
  '(주)유디': { ext: '2210', full: '010-5192-2210', role: '민간 의료기관 부스' },
  '주식회사 유디': { ext: '2210', full: '010-5192-2210', role: '민간 의료기관 부스' },
  '유디': { ext: '2210', full: '010-5192-2210', role: '민간 의료기관 부스' },
  '유디치과': { ext: '2210', full: '010-5192-2210', role: '민간 의료기관 부스' },
  '(주)유디치과': { ext: '2210', full: '010-5192-2210', role: '민간 의료기관 부스' },
  '유디 치과': { ext: '2210', full: '010-5192-2210', role: '민간 의료기관 부스' },
  // 강남차병원 (010-2698-0992 / 0992)
  '강남차병원': { ext: '0992', full: '010-2698-0992', role: '민간 의료기관 부스' },
  '강남 차병원': { ext: '0992', full: '010-2698-0992', role: '민간 의료기관 부스' },
  '차병원': { ext: '0992', full: '010-2698-0992', role: '민간 의료기관 부스' },
  // 한국신체정보 (010-9985-3732 / 3732)
  '한국신체정보': { ext: '3732', full: '010-9985-3732', role: '민간 헬스케어 부스' },
  '한국신체정보(주)': { ext: '3732', full: '010-9985-3732', role: '민간 헬스케어 부스' },
  '한국신체정보 (주)': { ext: '3732', full: '010-9985-3732', role: '민간 헬스케어 부스' },
  '한국신체정보주식회사': { ext: '3732', full: '010-9985-3732', role: '민간 헬스케어 부스' },
  '한국신체': { ext: '3732', full: '010-9985-3732', role: '민간 헬스케어 부스' },
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
  // 과장님 (02-3423-7010)
  '과장님': { ext: '7010', full: '02-3423-7010', role: '과장' },
  '과장': { ext: '7010', full: '02-3423-7010', role: '과장' },
  '보건행정과장': { ext: '7010', full: '02-3423-7010', role: '과장' },
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
  } else if (clean.includes('형종')) {
    result = STAFF_PHONE_MAP['김형종'];
  } else if (clean.includes('한국신체정보') || clean.includes('한국신체')) {
    result = STAFF_PHONE_MAP['한국신체정보'];
  } else if (clean.includes('김지현') || clean.includes('지현')) {
    result = STAFF_PHONE_MAP['김지현'];
  } else if (clean.includes('서울대병원') || clean.includes('서울대학교병원')) {
    result = STAFF_PHONE_MAP['서울대병원 강남센터'];
  } else if (clean.includes('유디')) {
    result = STAFF_PHONE_MAP['(주)유디'];
  } else if (clean.includes('강남차병원') || clean.includes('차병원')) {
    result = STAFF_PHONE_MAP['강남차병원'];
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

  // 2. 콜론(:)이 포함된 경우: "제목"과 "개조식 내용"으로 2줄 분리
  // 예: "1차 사전답사: 현장 실사 및 행사장소 '수변문화쉼터' 검토 완료"
  if (text.includes(':')) {
    const colonIdx = text.indexOf(':');
    const titlePart = text.substring(0, colonIdx).trim();
    const bodyPart = text.substring(colonIdx + 1).trim();

    return (
      <div className="space-y-1">
        {titlePart && (
          <div className={`${isLargeFont ? 'text-sm' : 'text-[13px] sm:text-[13.5px]'} font-extrabold text-slate-900 tracking-tight leading-snug break-keep flex items-center gap-1.5`}>
            <span>{titlePart}</span>
          </div>
        )}
        {bodyPart && (
          <div className="mt-1 pl-2.5 border-l-2 border-slate-300/90 py-0.5">
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
      <span className={`${isLargeFont ? 'text-sm' : 'text-[13px] sm:text-[13.5px]'} text-slate-900 font-bold leading-relaxed break-keep`}>
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
  onTransfer?: () => void;
}

const DetailEditRow = React.memo(function DetailEditRow({
  initialDetail,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  onTransfer,
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
          placeholder="참석자 (예: 과장님 7010, 오창선 7116, 김지현 7173, 김형종 7250, 강남차병원 0992, 서울대병원 8276, 유디 2210, 한국신체정보 3732, 제이민(김다희) 0544, 지영팀장님 7031, 희선팀장님 7011...)"
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
          {onTransfer && (
            <>
              <span className="w-[1px] h-3 bg-slate-300 mx-0.5" />
              <button
                type="button"
                onClick={onTransfer}
                className="p-1 text-amber-700 hover:bg-amber-100 rounded cursor-pointer transition-colors active:scale-95"
                title="다른 추진과제 카테고리로 이동"
              >
                <FolderInput className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </>
          )}
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

  // 세부 과업 다른 추진과제 카테고리로 이동(Transfer) 상태
  const [transferTarget, setTransferTarget] = useState<{
    sourceMilestoneId: number;
    detailIndex: number;
    detailRaw: string;
  } | null>(null);
  const [selectedTargetMilestoneId, setSelectedTargetMilestoneId] = useState<number | null>(null);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

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

  const boothMetrics = useMemo(() => {
    const list = activeBooths || [];
    let confirmedEntities = 0;
    let pendingEntities = 0;
    let totalDong = 0;
    let confirmedDong = 0;
    let pendingDong = 0;
    let totalBus = 0;
    let confirmedBus = 0;

    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b) continue;
      const isConfirmed = b.status === '확정';
      if (isConfirmed) {
        confirmedEntities++;
      } else {
        pendingEntities++;
      }
      const parsed = parseBoothScale(b.scale);
      totalDong += parsed.dong;
      totalBus += parsed.bus;
      if (isConfirmed) {
        confirmedDong += parsed.dong;
        confirmedBus += parsed.bus;
      } else {
        pendingDong += parsed.dong;
      }
    }

    return {
      totalEntities: list.length,
      confirmedEntities,
      pendingEntities,
      totalDong,
      confirmedDong,
      pendingDong,
      totalBus,
      confirmedBus,
    };
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
      // Dual-key alias support for '보건소 부서' and legacy aliases
      if (cat === '보건소 부서' || cat === '보건소 사업' || cat === '보건소 특화') {
        const publicAliases = ['보건소 부서', '보건소 사업', '보건소 특화'];
        for (const alias of publicAliases) {
          if (!map.has(alias)) map.set(alias, []);
          if (alias !== cat) map.get(alias)!.push(b);
        }
      }

      // Multi-key alias support for '민간' and legacy aliases
      if (cat === '민간' || cat === '민간 헬스케어' || cat === '전문 의료·검진' || cat === '의료·검진' || cat === '의료 검진') {
        const privateAliases = ['민간', '민간 헬스케어', '전문 의료·검진', '의료·검진', '의료 검진'];
        for (const alias of privateAliases) {
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

  const PUBLIC_SHARE_URL = 'https://portfolio-hchps.pages.dev/festival/yangjae';

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

  // 2-1. 세부 과업 카테고리(추진과제) 이동 모달 및 실행 핸들러
  const handleOpenTransferModal = useCallback((sourceMilestoneId: number, detailIndex: number, detailRaw: string) => {
    setTransferTarget({ sourceMilestoneId, detailIndex, detailRaw });
    const otherMilestones = (data?.milestones || []).filter((m) => m.id !== sourceMilestoneId);
    setSelectedTargetMilestoneId(otherMilestones.length > 0 ? otherMilestones[0].id : null);
  }, [data?.milestones]);

  const handleCloseTransferModal = useCallback(() => {
    if (isTransferring) return;
    setTransferTarget(null);
    setSelectedTargetMilestoneId(null);
  }, [isTransferring]);

  const handleExecuteTransfer = async () => {
    if (!transferTarget || selectedTargetMilestoneId === null) return;
    if (selectedTargetMilestoneId === transferTarget.sourceMilestoneId) return;

    const { sourceMilestoneId, detailIndex, detailRaw } = transferTarget;
    setIsTransferring(true);

    try {
      const currentMilestones: MilestoneItem[] = safeClone(data?.milestones || []);
      const sourceMilestone = currentMilestones.find((m) => m.id === sourceMilestoneId);
      const targetMilestone = currentMilestones.find((m) => m.id === selectedTargetMilestoneId);

      if (!sourceMilestone || !targetMilestone) {
        alert('대상 추진과제를 찾을 수 없습니다.');
        setIsTransferring(false);
        return;
      }

      const nextMilestones = currentMilestones.map((m) => {
        if (m.id === sourceMilestoneId) {
          const nextDetails = [...(m.details || [])];
          if (detailIndex >= 0 && detailIndex < nextDetails.length) {
            nextDetails.splice(detailIndex, 1);
          } else {
            const matchIdx = nextDetails.findIndex((d) => d === detailRaw);
            if (matchIdx !== -1) nextDetails.splice(matchIdx, 1);
          }
          return {
            ...m,
            details: nextDetails,
          };
        }
        if (m.id === selectedTargetMilestoneId) {
          return {
            ...m,
            details: [...(m.details || []), detailRaw],
          };
        }
        return m;
      });

      await saveMutation.mutateAsync({
        ...data,
        milestones: nextMilestones,
      });

      // 현재 소속 과제를 편집 중이었던 경우 드래프트 목록 동기화
      if (editingMilestoneId === sourceMilestoneId) {
        setDetailDrafts((prev) => prev.filter((_, i) => i !== detailIndex));
        setEditMilestoneData((prev) => {
          if (!prev) return null;
          const nextDetails = [...(prev.details || [])];
          nextDetails.splice(detailIndex, 1);
          return { ...prev, details: nextDetails };
        });
      }

      // 대상 과제를 편집 중이었던 경우 드래프트 목록에 추가
      if (editingMilestoneId === selectedTargetMilestoneId) {
        const newDraft: DetailDraft = {
          uid: `m-${selectedTargetMilestoneId}-detail-transferred-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          raw: detailRaw,
        };
        setDetailDrafts((prev) => [...prev, newDraft]);
        setEditMilestoneData((prev) => {
          if (!prev) return null;
          return { ...prev, details: [...(prev.details || []), detailRaw] };
        });
      }

      // 이동된 대상 추진과제를 자동으로 펼쳐서 즉각 시각 확인 가능하도록 보장
      setExpandedTaskIds((prev) => new Set([...prev, selectedTargetMilestoneId]));

      setTransferTarget(null);
      setSelectedTargetMilestoneId(null);
      setToastMessage(`과업이 '${targetMilestone.number || '추진과제'}. ${targetMilestone.title}'(으)로 이동되었습니다!`);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('과업 이동에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsTransferring(false);
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
          if (selectedCategory === '보건소 부서' || selectedCategory === '보건소 사업' || selectedCategory === '보건소 특화') {
            return b.category === '보건소 부서' || b.category === '보건소 사업' || b.category === '보건소 특화';
          }
          if (selectedCategory === '민간' || selectedCategory === '민간 헬스케어' || selectedCategory === '전문 의료·검진' || selectedCategory === '의료·검진' || selectedCategory === '의료 검진') {
            return b.category === '민간' || b.category === '민간 헬스케어' || b.category === '전문 의료·검진' || b.category === '의료·검진' || b.category === '의료 검진';
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
          if (selectedCategory === '보건소 부서' || selectedCategory === '보건소 사업' || selectedCategory === '보건소 특화') {
            return b.category === '보건소 부서' || b.category === '보건소 사업' || b.category === '보건소 특화';
          }
          if (selectedCategory === '민간' || selectedCategory === '민간 헬스케어' || selectedCategory === '전문 의료·검진' || selectedCategory === '의료·검진' || selectedCategory === '의료 검진') {
            return b.category === '민간' || b.category === '민간 헬스케어' || b.category === '전문 의료·검진' || b.category === '의료·검진' || b.category === '의료 검진';
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
    const period = data?.weeklyReport?.period || '9. 7. ~ 9. 11.';
    const weekTitle = data?.weeklyReport?.weekTitle || '주간 추진실적 보고';
    const staffNote = data?.meta?.staffNote || '행사 참여 직원 대체휴무 시행 예정';

    const fallbackWeeklyItems = [
      '1. [체육회/공동개최] 9. 7. 강남구체육회(걷기협회) 구청장배 걷기대회 공동 개최 협의 (과장님, 지영팀장님, 오창선)\n   - 내용: 당초 영동3교 분산 추진 건(체육회 11.21. 연기안)을 10. 31.(토) 우리 행사와 전격 통합·공동 개최 협의\n   - 효과: 체육회 참가 인원(200~250명) 합류로 총 1,000명 이상 대규모 축제 외연 확장 및 행사 시너지 극대화',
      '2. [기획/방침] 공동 개최 연계에 따른 행사 기본계획 방침서 수정 및 식순 보완\n   - 내용: 체육회 공동 주관 명기, 개회식 식순 연계(내빈 의전 및 준비운동), 걷기 코스 및 참가자 통합 운영안 조율',
      '3. [부스/의료] 12개 전문 건강체험 부스 최종 확정 및 협력 기관 세부 조율 완료\n   - 내용: 대학병원·의사회·민간 헬스케어 등 12개 부스(검진버스 2대 포함) 배치도 확정 및 기관별 체험 프로그램 조율',
      '4. [홍보/접수] 행사 메인 포스터 최종 감수 및 대구민 사전접수 시스템 연계 준비\n   - 내용: 공동개최 기관 표기 포스터 최종 감수, 10. 1. 보건소 통합예약시스템(800명 선착순) 접수 페이지 등록 사전 점검',
      '5. [현장/안전] 행사장 시설 사용 협조 및 1,000명 인파 대비 안전관리 대책 수립\n   - 내용: 수변문화센터 외부(치수과)·내부(문화도시과) 시설 사용 조율, 남부혈액원 주차 협조(5대) 및 응급 안전 동선 구축',
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
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
                <span className="font-bold text-slate-600 tracking-wide whitespace-nowrap shrink-0">• 행사명</span>
                <span className="font-bold text-slate-400 text-center shrink-0">:</span>
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
                  <span className="font-extrabold text-slate-900 leading-snug break-keep min-w-0">{data?.meta?.title || '2026 양재천 건강 페스티벌'}</span>
                )}
              </div>

              {/* 일시 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
                <span className="font-bold text-slate-600 tracking-wide whitespace-nowrap shrink-0">• 일&nbsp;&nbsp;&nbsp;&nbsp;시</span>
                <span className="font-bold text-slate-400 text-center shrink-0">:</span>
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
                  <span className="font-semibold text-slate-800 break-keep min-w-0">{data?.meta?.eventDate || ''} ({data?.meta?.eventTime || ''})</span>
                )}
              </div>

              {/* 장소 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
                <span className="font-bold text-slate-600 tracking-wide whitespace-nowrap shrink-0">• 장&nbsp;&nbsp;&nbsp;&nbsp;소</span>
                <span className="font-bold text-slate-400 text-center shrink-0">:</span>
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
                  <span className="font-semibold text-slate-800 leading-snug break-keep min-w-0">{data?.meta?.location || ''}</span>
                )}
              </div>

              {/* 코스 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
                <span className="font-bold text-slate-600 tracking-wide whitespace-nowrap shrink-0">• 코&nbsp;&nbsp;&nbsp;&nbsp;스</span>
                <span className="font-bold text-slate-400 text-center shrink-0">:</span>
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
                  <span className="font-semibold text-slate-800 break-keep min-w-0">{data?.meta?.course || ''}</span>
                )}
              </div>

              {/* 참여 대상 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
                <span className="font-bold text-slate-600 tracking-wide whitespace-nowrap shrink-0">• 참&nbsp;&nbsp;&nbsp;&nbsp;여</span>
                <span className="font-bold text-slate-400 text-center shrink-0">:</span>
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
                  <span className="font-semibold text-slate-800 break-keep min-w-0">{data?.meta?.targetAudience || ''}</span>
                )}
              </div>

              {/* 프로그램 구성 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
                <span className="font-bold text-slate-600 tracking-wide whitespace-nowrap shrink-0">• 구&nbsp;&nbsp;&nbsp;&nbsp;성</span>
                <span className="font-bold text-slate-400 text-center shrink-0">:</span>
                <div className="space-y-1 min-w-0">
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
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline pt-0.5`}>
                <span className="font-extrabold text-blue-600 tracking-wide whitespace-nowrap shrink-0">• 비&nbsp;&nbsp;&nbsp;&nbsp;고</span>
                <span className="font-bold text-blue-400 text-center shrink-0">:</span>
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
                                        onTransfer={() => {
                                          handleOpenTransferModal(targetItem.id, dIdx, draft.raw);
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
                                  const displayDate = parsed.date ? parsed.date.replace(/\.$/, '') : '상시';
                                  const isTimeRange = displayDate.includes('~');
                                  const isShortDate = displayDate.length <= 5 && !isTimeRange;

                                  return (
                                    <div 
                                      key={`${item.id}-detail-row-${dIdx}-${detail.slice(0, 20)}`} 
                                      className={`p-3 flex items-start gap-3 transition-colors ${
                                        isCoopTask 
                                          ? 'bg-indigo-50/40 hover:bg-indigo-50/70' 
                                          : 'hover:bg-white bg-white/70'
                                      }`}
                                    >
                                      {/* 1. 세로 한 열(Column) 캘린더형 상태 타일: 날짜 크기 대폭 확대 및 시각성 극대화 */}
                                      <div className={`date-tile shrink-0 flex flex-col items-center justify-center rounded-xl border-2 overflow-hidden shadow-xs font-mono min-w-[70px] sm:min-w-[76px] text-center mt-0.5 bg-white transition-all ${
                                        parsed.status === 'done'
                                          ? 'border-emerald-500'
                                          : parsed.status === 'in-progress'
                                          ? 'border-amber-500'
                                          : 'border-slate-400'
                                      }`}>
                                        <span className={`date-text w-full bg-slate-50 text-slate-950 font-black px-1 py-1.5 tracking-tight border-b border-slate-200 break-all leading-snug ${
                                          isTimeRange ? 'text-[10.5px] sm:text-[11px]' : isShortDate ? 'text-[14.5px] sm:text-[15px]' : 'text-[13px] sm:text-[13.5px]'
                                        }`}>
                                          {displayDate}
                                        </span>
                                        <span className={`status-text w-full px-1 py-1 text-[11px] sm:text-[11.5px] font-black tracking-normal ${
                                          parsed.status === 'done'
                                            ? 'bg-emerald-600 text-white'
                                            : parsed.status === 'in-progress'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-slate-600 text-white'
                                        }`}>
                                          {parsed.status === 'done' ? '✓ 완료' : parsed.status === 'in-progress' ? '▶ 진행' : '○ 예정'}
                                        </span>
                                      </div>

                                      {/* 3. 본문 텍스트 (개조식 렌더링) 및 참석자 태그 */}
                                      <div className="flex-1 min-w-0 pt-0.5 space-y-1.5">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className={`flex-1 min-w-0 ${parsed.status === 'done' ? 'text-slate-800' : 'text-slate-950 font-medium'}`}>
                                            {renderBulletedContent(parsed.text, isLargeFont)}
                                          </div>
                                          {isLocalAdmin && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenTransferModal(item.id, dIdx, detail);
                                              }}
                                              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10.5px] font-extrabold text-slate-500 hover:text-amber-950 bg-slate-100 hover:bg-amber-100/90 rounded-md border border-slate-200/80 hover:border-amber-300 transition-all cursor-pointer shadow-3xs active:scale-95"
                                              title="다른 추진과제로 이동"
                                            >
                                              <FolderInput className="w-3 h-3 text-slate-500" />
                                              <span>이동</span>
                                            </button>
                                          )}
                                        </div>

                                        {/* 4. 분리된 참석자 태그 & 행정번호 연동 */}
                                        {parsed.attendees && (
                                          <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-200/70 mt-1.5">
                                            {parsed.attendees.split(',').map((person, pIdx) => {
                                              const trimmed = person.trim();
                                              if (!trimmed) return null;
                                              const staff = getStaffInfo(trimmed);
                                              return staff ? (
                                                <a
                                                  key={`attendee-${trimmed}-${pIdx}`}
                                                  href={`tel:${staff.full}`}
                                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300/80 shadow-3xs transition-all cursor-pointer active:scale-95"
                                                  title={`전화 연결: ${staff.full}`}
                                                >
                                                  <Phone className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                                  <span>{trimmed}</span>
                                                  <span className="text-amber-900 font-mono text-[9px] bg-amber-200/90 px-1.5 py-0.2 rounded-full font-black">
                                                    {staff.ext}
                                                  </span>
                                                </a>
                                              ) : (
                                                <span
                                                  key={`attendee-${trimmed}-${pIdx}`}
                                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80 shadow-3xs"
                                                >
                                                  <User className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                                  <span>{trimmed}</span>
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

          {/* TAB 2: 부스 현황 */}
          {selectedTab === 'booths' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2 px-1 flex-wrap sm:flex-nowrap">
                <h3 className={`${isLargeFont ? 'text-base' : 'text-sm'} font-extrabold text-slate-900 flex items-center gap-1.5 whitespace-nowrap shrink-0`}>
                  <span className={`inline-block ${isLargeFont ? 'w-3.5 h-3.5 border-2' : 'w-3 h-3 border-[1.5px]'} border-slate-900 rounded-[1px] shrink-0`} />
                  <span>부스 배치 계획</span>
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1 ${isLargeFont ? 'text-xs' : 'text-[11px] sm:text-xs'} font-bold text-slate-700 bg-slate-100 border border-slate-200/90 px-2.5 py-1 rounded-full whitespace-nowrap shadow-3xs`}>
                    <span>확정 <strong className="font-black text-slate-900">{boothMetrics.confirmedEntities}</strong> / 총 <strong className="font-black text-slate-900">{boothMetrics.totalEntities}개</strong></span>
                    <span className="text-slate-400 mx-0.5">·</span>
                    <span className="font-black text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] border border-emerald-300/60">
                      필요 {boothMetrics.totalDong}동
                    </span>
                  </span>
                  {editingBooths ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const maxId = (editBoothsData || []).reduce((max, b) => Math.max(max, Number(b?.id) || 0), 0);
                          const nextId = (Number.isFinite(maxId) ? maxId : 0) + 1;
                          setEditBoothsData([
                            ...editBoothsData,
                            {
                              id: nextId,
                              category: '보건소 부서',
                              name: '신규 부스명',
                              scale: '1동',
                              program: '체험 프로그램 내용',
                              status: '확정',
                            }
                          ]);
                        }}
                        className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-900 rounded border border-amber-300 hover:bg-amber-200 flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
                        title="부스 추가"
                      >
                        <Plus className="w-3 h-3" />
                        <span>추가</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveBooths}
                        disabled={saveMutation.isPending}
                        className="px-2 py-0.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
                        title="부스 저장"
                      >
                        {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        <span>저장</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditBooths}
                        className="px-2 py-0.5 text-xs font-bold bg-slate-600 hover:bg-slate-500 text-white rounded flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
                        title="취소"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : isLocalAdmin ? (
                    <button
                      type="button"
                      onClick={handleStartEditBooths}
                      className="px-2.5 py-1 text-xs font-extrabold bg-amber-50 hover:bg-amber-100 text-amber-950 rounded-lg border border-amber-300 flex items-center gap-1 cursor-pointer transition-colors shadow-3xs whitespace-nowrap shrink-0"
                      title="부스 순서 변경 및 현황 수정"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-amber-700" />
                      <span>순서 변경 / 편집</span>
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Booth Summary Metrics Card (행렬 정렬 & 프리미엄 다크 카드) */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white rounded-xl shadow-xs border border-slate-700 p-3 sm:p-3.5">
                <div className="grid grid-cols-2 divide-x divide-slate-800 gap-x-3 sm:gap-x-4">
                  {/* Col 1: 총 부스 참여 주체 */}
                  <div className="flex flex-col justify-between pr-1">
                    {/* Row 1: Header / Label */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-indigo-300" />
                      </div>
                      <span className="text-[11px] sm:text-xs font-bold text-slate-300 whitespace-nowrap">
                        총 부스 참여 주체
                      </span>
                    </div>

                    {/* Row 2: Primary Big Metric */}
                    <div className="py-0.5">
                      <div className={`${isLargeFont ? 'text-2xl' : 'text-xl sm:text-2xl'} font-black text-white tracking-tight whitespace-nowrap`}>
                        총 {boothMetrics.totalEntities}개 기관
                      </div>
                    </div>

                    {/* Row 3: Aligned Status Chips */}
                    <div className="mt-2 pt-2 border-t border-slate-800/90 flex items-center gap-1 sm:gap-1.5 flex-wrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-extrabold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 whitespace-nowrap">
                        확정 {boothMetrics.confirmedEntities}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-slate-800/90 text-slate-300 border border-slate-700 whitespace-nowrap">
                        협의 {boothMetrics.pendingEntities}
                      </span>
                    </div>
                  </div>

                  {/* Col 2: 총 필요 부스 규모 */}
                  <div className="flex flex-col justify-between pl-3 sm:pl-4">
                    {/* Row 1: Header / Label */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                        <Tent className="w-3.5 h-3.5 text-emerald-300" />
                      </div>
                      <span className="text-[11px] sm:text-xs font-bold text-slate-300 whitespace-nowrap">
                        총 필요 부스 규모
                      </span>
                    </div>

                    {/* Row 2: Primary Big Metric */}
                    <div className="py-0.5">
                      <div className={`${isLargeFont ? 'text-2xl' : 'text-xl sm:text-2xl'} font-black text-emerald-400 tracking-tight whitespace-nowrap`}>
                        총 {boothMetrics.totalDong}동
                      </div>
                    </div>

                    {/* Row 3: Aligned Status Chips */}
                    <div className="mt-2 pt-2 border-t border-slate-800/90 flex items-center gap-1 sm:gap-1.5 flex-wrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-extrabold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 whitespace-nowrap">
                        확정 {boothMetrics.confirmedDong}동
                      </span>
                      {boothMetrics.pendingDong > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-700/60 whitespace-nowrap">
                          협의 {boothMetrics.pendingDong}동
                        </span>
                      )}
                      {boothMetrics.totalBus > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-sky-950/80 text-sky-300 border border-sky-700/60 whitespace-nowrap">
                          버스 {boothMetrics.totalBus}대
                        </span>
                      )}
                    </div>
                  </div>
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

      {/* Floating Save / Action Toast */}
      {saveToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-xs text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sub-Task Category Transfer Modal */}
      {transferTarget && (() => {
        const currentMilestones = data?.milestones || [];
        const sourceMilestone = currentMilestones.find((m) => m.id === transferTarget.sourceMilestoneId);
        const parsedPreview = parseDetail(transferTarget.detailRaw);
        const isTimeRange = parsedPreview.date.includes('~');
        const isShortDate = parsedPreview.date.length <= 5 && !isTimeRange;
        const displayDate = parsedPreview.date ? parsedPreview.date.replace(/\.$/, '') : '상시';
        const otherMilestones = currentMilestones.filter((m) => m.id !== transferTarget.sourceMilestoneId);

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div 
              className="bg-white rounded-2xl shadow-2xl border-2 border-slate-300 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              aria-labelledby="transfer-modal-title"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
                    <FolderInput className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 id="transfer-modal-title" className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                      세부 과업 카테고리 이동
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">과업을 다른 추진과제 카테고리로 재분류합니다.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseTransferModal}
                  disabled={isTransferring}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="닫기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 overflow-y-auto space-y-4 text-slate-800">
                {/* Section 1: 이동 대상 과업 미리보기 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>이동할 세부 과업</span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      현재 소속: <strong className="text-amber-800 font-black">{sourceMilestone ? `${sourceMilestone.number || '추진과제'}. ${sourceMilestone.title}` : '미확인'}</strong>
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3 shadow-2xs">
                    <div className={`shrink-0 flex flex-col items-center justify-center rounded-lg border overflow-hidden shadow-xs font-mono min-w-[64px] text-center bg-white ${
                      parsedPreview.status === 'done'
                        ? 'border-emerald-500'
                        : parsedPreview.status === 'in-progress'
                        ? 'border-amber-500'
                        : 'border-slate-400'
                    }`}>
                      <span className={`w-full bg-slate-50 text-slate-950 font-black px-1 py-1 text-xs border-b border-slate-200 ${
                        isTimeRange ? 'text-[10px]' : isShortDate ? 'text-xs' : 'text-[11px]'
                      }`}>
                        {displayDate}
                      </span>
                      <span className={`w-full px-1 py-0.5 text-[10px] font-black ${
                        parsedPreview.status === 'done'
                          ? 'bg-emerald-600 text-white'
                          : parsedPreview.status === 'in-progress'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-600 text-white'
                      }`}>
                        {parsedPreview.status === 'done' ? '✓ 완료' : parsedPreview.status === 'in-progress' ? '▶ 진행' : '○ 예정'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5 space-y-1">
                      <div className="text-xs font-bold text-slate-900 leading-snug">
                        {parsedPreview.text}
                      </div>
                      {parsedPreview.attendees && (
                        <div className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>참석자: {parsedPreview.attendees}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 2: 이동할 목표 추진과제 선택 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                      <span>이동할 대상 추진과제 선택</span>
                    </span>
                    <span className="text-[10.5px] font-normal text-slate-500">
                      선택한 과제의 맨 아래로 배치됩니다.
                    </span>
                  </div>

                  {otherMilestones.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      이동할 수 있는 다른 추진과제가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {currentMilestones.map((m) => {
                        const isCurrent = m.id === transferTarget.sourceMilestoneId;
                        const isSelected = selectedTargetMilestoneId === m.id;

                        if (isCurrent) {
                          return (
                            <div
                              key={`transfer-dest-${m.id}`}
                              className="p-2.5 rounded-xl border border-slate-200 bg-slate-100/80 opacity-60 flex items-center justify-between text-xs cursor-not-allowed"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-slate-400 font-mono text-[11px] shrink-0">{m.number || `과제 ${m.id}`}</span>
                                <span className="font-medium text-slate-500 truncate">{m.title}</span>
                              </div>
                              <span className="text-[10.5px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full shrink-0">
                                현재 위치
                              </span>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={`transfer-dest-${m.id}`}
                            type="button"
                            disabled={isTransferring}
                            onClick={() => setSelectedTargetMilestoneId(m.id)}
                            className={`w-full p-2.5 rounded-xl border-2 transition-all flex items-center justify-between text-left cursor-pointer active:scale-[0.99] ${
                              isSelected
                                ? 'border-amber-500 bg-amber-50/80 shadow-xs ring-2 ring-amber-400/30'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-amber-600 bg-amber-500 text-white' : 'border-slate-300 bg-white'
                              }`}>
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                              <span className={`font-mono text-xs font-black shrink-0 ${isSelected ? 'text-amber-900' : 'text-slate-700'}`}>
                                {m.number || `과제 ${m.id}`}
                              </span>
                              <span className={`text-xs font-bold truncate ${isSelected ? 'text-amber-950 font-black' : 'text-slate-900'}`}>
                                {m.title}
                              </span>
                            </div>
                            <span className="text-[11px] font-medium text-slate-500 shrink-0 ml-2">
                              {m.details?.length || 0}개 과업
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseTransferModal}
                  disabled={isTransferring}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleExecuteTransfer}
                  disabled={isTransferring || !selectedTargetMilestoneId || selectedTargetMilestoneId === transferTarget.sourceMilestoneId}
                  className={`px-4 py-1.5 text-xs font-black text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all ${
                    isTransferring || !selectedTargetMilestoneId || selectedTargetMilestoneId === transferTarget.sourceMilestoneId
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-amber-600 hover:bg-amber-500 active:scale-95 cursor-pointer ring-1 ring-amber-700'
                  }`}
                >
                  {isTransferring ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>이동 저장 중...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>과업 이동 실행</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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

