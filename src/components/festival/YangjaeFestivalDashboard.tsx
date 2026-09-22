"use client";

import React, { useState, useMemo, useSyncExternalStore, useCallback, useEffect } from 'react';
import { Check, Share2, Edit3, Save, X, Plus, Trash2, Loader2, ChevronDown, ChevronUp, ArrowUpDown, Phone, Smartphone, User, Users, Building2, Tent, FolderInput, ArrowRightLeft, Table, Armchair, Clock, Calendar, Search, Shield, MapPin, Lock } from 'lucide-react';
import { useYangjaeFestival, useSaveYangjaeFestival, YANGJAE_FALLBACK_DATA, FestivalData, MilestoneItem, BoothItem, ScheduleItem, DutyItem } from '@/hooks/useYangjaeFestival';

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

const FESTIVAL_CATEGORIES = ['전체', '보건소 부서', '민간', '운영본부'];
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

/**
 * 전화번호 및 휴대전화 자동 하이픈 포맷터 (Auto-Hyphen)
 * - 02 서울 유선 (9~10자리): 02-XXX-XXXX (9자리) 또는 02-XXXX-XXXX (10자리)
 * - 010 이동통신 (11자리): 010-XXXX-XXXX
 * - 01X 기타 이동통신 및 031/051 등 지역번호, 070, 050: 0XX-XXX-XXXX 또는 0XX-XXXX-XXXX
 * - 1588, 1544 등 전국대표번호 (8자리): 1588-XXXX
 * - 4자리 원내 내선번호: 원형 보존
 */
export function formatAutoHyphen(value: string | undefined | null): string {
  if (!value) return '';
  const str = String(value).trim();
  if (!str) return '';

  const digits = str.replace(/[^0-9]/g, '');
  if (!digits) return str;

  // 4자리 내선번호 (예: 7116, 7031)
  if (digits.length === 4) return digits;

  // 1588 등 대표번호 8자리
  if (digits.length === 8 && (digits.startsWith('15') || digits.startsWith('16') || digits.startsWith('18'))) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  // 서울 02
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.length === 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  // 이동통신 010 (11자리)
  if (digits.startsWith('010')) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  // 기타 이동통신(011 등) 및 지역번호(031, 051 등), 070, 050
  if (digits.startsWith('0')) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length <= 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  return str;
}

export type YangjaeReportTab = 'milestones' | 'booths' | 'schedule' | 'duties';

const YANGJAE_REPORT_TABS: { id: YangjaeReportTab; label: string }[] = [
  { id: 'milestones', label: '1. 추진과제' },
  { id: 'booths', label: '2. 부스현황' },
  { id: 'schedule', label: '3. 행사식순' },
  { id: 'duties', label: '4. 업무분장' },
];

const SCHEDULE_PHASES = ['전체', '식전·준비', '공식행사', '걷기대회', '공연·폐회'];
const DUTY_CATEGORIES = ['전체', '총괄기획', '체육회', '대행용역', '응급안전', '체험부스', '유관부서'];

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

export function getDetailSortKey(raw: string): number {
  if (!raw) return Infinity;
  const parsed = parseDetail(raw);
  const dateStr = parsed.date ? parsed.date.trim() : '';
  if (!dateStr) return Infinity;

  // 1. 당일 시간 형식 (식순): "07:30~08:00" 또는 "07:30" (2026-10-31 행사 당일 시간 매핑)
  const timeMatch = dateStr.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    return new Date(2026, 9, 31, hours, minutes).getTime();
  }

  // 2. 연도 포함 날짜: "26.7.29." 또는 "2026.7.29." 또는 "26.9.10"
  const fullDateMatch = dateStr.match(/^(?:20)?(\d{2})\.(\d{1,2})\.(\d{1,2})\.?/);
  if (fullDateMatch) {
    const year = 2000 + parseInt(fullDateMatch[1], 10);
    const month = parseInt(fullDateMatch[2], 10) - 1;
    const day = parseInt(fullDateMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  // 3. 월.일 단독 형식: "9.3." 또는 "9.3" 또는 "09.03"
  const mdMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.?/);
  if (mdMatch) {
    const month = parseInt(mdMatch[1], 10) - 1;
    const day = parseInt(mdMatch[2], 10);
    return new Date(2026, month, day).getTime();
  }

  // 4. 월 주차 등 텍스트: "9월 1주", "7월 말"
  const monthWordMatch = dateStr.match(/^(\d{1,2})월/);
  if (monthWordMatch) {
    const month = parseInt(monthWordMatch[1], 10) - 1;
    return new Date(2026, month, 1).getTime();
  }

  return Infinity;
}

export function sortDetailsAscending(details: string[]): string[] {
  if (!Array.isArray(details)) return [];
  return details
    .map((detail, index) => ({ detail, index, sortKey: getDetailSortKey(detail) }))
    .sort((a, b) => {
      if (a.sortKey !== b.sortKey) {
        return a.sortKey - b.sortKey;
      }
      return a.index - b.index;
    })
    .map((item) => item.detail);
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
  // 강남구체육회 (02-3462-7330 / 7330)
  '강남구체육회': { ext: '7330', full: '02-3462-7330', role: '공동주관' },
  '강남구 체육회': { ext: '7330', full: '02-3462-7330', role: '공동주관' },
  '체육회': { ext: '7330', full: '02-3462-7330', role: '공동주관' },
  '체육회(걷기협회)': { ext: '7330', full: '02-3462-7330', role: '공동주관' },
  '강남구체육회(걷기협회)': { ext: '7330', full: '02-3462-7330', role: '공동주관' },
  '이무상': { ext: '7330', full: '02-3462-7330', role: '강남구체육회 지도사' },
  '이무상지도사': { ext: '7330', full: '02-3462-7330', role: '강남구체육회 지도사' },
  '이무상 지도사': { ext: '7330', full: '02-3462-7330', role: '강남구체육회 지도사' },
  '채희경': { ext: '7397', full: '010-7137-7397', role: '강남구체육회 팀장' },
  '채희경팀장': { ext: '7397', full: '010-7137-7397', role: '강남구체육회 팀장' },
  '채희경 팀장': { ext: '7397', full: '010-7137-7397', role: '강남구체육회 팀장' },
  '채희경팀장님': { ext: '7397', full: '010-7137-7397', role: '강남구체육회 팀장' },
  '채희경 팀장님': { ext: '7397', full: '010-7137-7397', role: '강남구체육회 팀장' },
  // 강남구 걷기협회 (010-8762-8260 / 진우복 회장님)
  '강남구 걷기협회': { ext: '8260', full: '010-8762-8260', role: '걷기협회' },
  '강남구걷기협회': { ext: '8260', full: '010-8762-8260', role: '걷기협회' },
  '걷기협회': { ext: '8260', full: '010-8762-8260', role: '걷기협회' },
  '진우복': { ext: '8260', full: '010-8762-8260', role: '걷기협회 회장' },
  '진우복회장': { ext: '8260', full: '010-8762-8260', role: '걷기협회 회장' },
  '진우복 회장': { ext: '8260', full: '010-8762-8260', role: '걷기협회 회장' },
  '진우복회장님': { ext: '8260', full: '010-8762-8260', role: '걷기협회 회장' },
  '진우복 회장님': { ext: '8260', full: '010-8762-8260', role: '걷기협회 회장' },
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
  } else if (clean.includes('체육회')) {
    result = STAFF_PHONE_MAP['강남구체육회'];
  } else if (clean.includes('걷기협회')) {
    result = STAFF_PHONE_MAP['강남구 걷기협회'];
  } else if (clean.includes('이무상')) {
    result = STAFF_PHONE_MAP['이무상'];
  } else if (clean.includes('채희경')) {
    result = STAFF_PHONE_MAP['채희경'];
  } else if (clean.includes('진우복')) {
    result = STAFF_PHONE_MAP['진우복'];
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

  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const latestValuesRef = React.useRef({ date, status, attendees, text, lastEmitted });

  useEffect(() => {
    latestValuesRef.current = { date, status, attendees, text, lastEmitted };
  }, [date, status, attendees, text, lastEmitted]);

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

  const flushChange = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const { date: d, status: s, attendees: a, text: t, lastEmitted: le } = latestValuesRef.current;
    const formatted = formatDetail({ date: d, status: s, attendees: a, text: t });
    if (formatted !== le) {
      setLastEmitted(formatted);
      latestValuesRef.current.lastEmitted = formatted;
      onUpdate(formatted);
    }
  }, [onUpdate]);

  const scheduleEmit = useCallback(
    (newDate: string, newStatus: 'done' | 'in-progress' | 'todo', newAttendees: string, newText: string) => {
      latestValuesRef.current = { date: newDate, status: newStatus, attendees: newAttendees, text: newText, lastEmitted: latestValuesRef.current.lastEmitted };
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        const formatted = formatDetail({ date: newDate, status: newStatus, attendees: newAttendees, text: newText });
        setLastEmitted(formatted);
        latestValuesRef.current.lastEmitted = formatted;
        onUpdate(formatted);
      }, 200);
    },
    [onUpdate]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        const { date: d, status: s, attendees: a, text: t, lastEmitted: le } = latestValuesRef.current;
        const formatted = formatDetail({ date: d, status: s, attendees: a, text: t });
        if (formatted !== le) {
          onUpdate(formatted);
        }
      }
    };
  }, [onUpdate]);

  const handleMoveUpWithFlush = useCallback(() => {
    flushChange();
    onMoveUp?.();
  }, [flushChange, onMoveUp]);

  const handleMoveDownWithFlush = useCallback(() => {
    flushChange();
    onMoveDown?.();
  }, [flushChange, onMoveDown]);

  const handleDeleteWithFlush = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    onDelete();
  }, [onDelete]);

  const handleTransferWithFlush = useCallback(() => {
    flushChange();
    onTransfer?.();
  }, [flushChange, onTransfer]);

  return (
    <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1.5 shadow-2xs">
      <div className="flex items-center gap-1.5">
        {/* 날짜 입력 */}
        <input
          type="text"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            scheduleEmit(e.target.value, status, attendees, text);
          }}
          onBlur={flushChange}
          placeholder="날짜 (7.29)"
          className="w-24 px-2 py-0.5 border border-amber-400 rounded bg-amber-50/40 text-xs font-bold font-mono shrink-0"
        />
        {/* 상태 선택 */}
        <select
          value={status}
          onChange={(e) => {
            const nextStatus = e.target.value as 'done' | 'in-progress' | 'todo';
            setStatus(nextStatus);
            scheduleEmit(date, nextStatus, attendees, text);
          }}
          onBlur={flushChange}
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
            scheduleEmit(date, status, e.target.value, text);
          }}
          onBlur={flushChange}
          placeholder="참석자 (예: 과장님 7010, 오창선 7116, 김지현 7173, 김형종 7250, 강남차병원 0992, 서울대병원 8276, 유디 2210, 한국신체정보 3732, 제이민(김다희) 0544, 지영팀장님 7031, 희선팀장님 7011...)"
          className="flex-1 min-w-0 px-2 py-0.5 border border-slate-300 rounded text-xs font-medium text-slate-800 bg-white"
        />
        {/* 위치(순서) 이동 및 삭제 버튼 그룹 */}
        <div className="flex items-center gap-0.5 shrink-0 bg-slate-100 p-0.5 rounded-md border border-slate-200">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={handleMoveUpWithFlush}
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
            onClick={handleMoveDownWithFlush}
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
                onClick={handleTransferWithFlush}
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
            onClick={handleDeleteWithFlush}
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
          scheduleEmit(date, status, attendees, e.target.value);
        }}
        onBlur={flushChange}
        rows={2}
        placeholder="세부 과업 내용 입력 (엔터로 줄바꿈하여 한 줄씩 개조식 작성 가능)"
        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-900 bg-white leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
    </div>
  );
});

interface EditableDetailItemProps {
  draft: DetailDraft;
  dIdx: number;
  totalCount: number;
  milestoneId: number;
  onUpdate: (index: number, newDetailStr: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onTransfer: (milestoneId: number, index: number, raw: string) => void;
  onDelete: (index: number) => void;
}

const EditableDetailItem = React.memo(function EditableDetailItem({
  draft,
  dIdx,
  totalCount,
  milestoneId,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onTransfer,
  onDelete,
}: EditableDetailItemProps) {
  const handleMoveUp = useCallback(() => onMoveUp(dIdx), [onMoveUp, dIdx]);
  const handleMoveDown = useCallback(() => onMoveDown(dIdx), [onMoveDown, dIdx]);
  const handleTransfer = useCallback(() => onTransfer(milestoneId, dIdx, draft.raw), [onTransfer, milestoneId, dIdx, draft.raw]);
  const handleUpdate = useCallback((newRaw: string) => onUpdate(dIdx, newRaw), [onUpdate, dIdx]);
  const handleDelete = useCallback(() => onDelete(dIdx), [onDelete, dIdx]);

  return (
    <DetailEditRow
      initialDetail={draft.raw}
      canMoveUp={dIdx > 0}
      canMoveDown={dIdx < totalCount - 1}
      onMoveUp={handleMoveUp}
      onMoveDown={handleMoveDown}
      onTransfer={handleTransfer}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
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

export interface YangjaeFestivalDashboardProps {
  isActive?: boolean;
}

function YangjaeFestivalDashboardComponent({ isActive = true }: YangjaeFestivalDashboardProps = {}) {
  const { data = YANGJAE_FALLBACK_DATA } = useYangjaeFestival(isActive);
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
  const [editingBoothId, setEditingBoothId] = useState<number | null>(null);
  const [editSingleBoothData, setEditSingleBoothData] = useState<BoothItem | null>(null);

  const [saveToast, setSaveToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('수정 사항이 저장되었습니다!');
  const [showPrivateMobile, setShowPrivateMobile] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState<boolean>(false);

  const VALID_PINS = useMemo(() => ['1031', '0000', '7116', '2026', 'gangnam'], []);

  // 프론트엔드 비상연락망 모드 로컬 스토리지 동기화 (행사 당일 모바일/현장 접속 시 설정 유지)
  useEffect(() => {
    try {
      const savedAuth = localStorage.getItem('yangjae_contact_authed') === 'true';
      const savedMobile = localStorage.getItem('yangjae_festival_show_mobile') === 'true';
      if (savedAuth) {
        setIsAuthed(true);
        if (savedMobile) setShowPrivateMobile(true);
      }
    } catch {}
  }, []);

  const handleSwitchToggle = useCallback(() => {
    if (showPrivateMobile) {
      // ON -> OFF (비밀번호 없이 즉시 끄기)
      setShowPrivateMobile(false);
      try {
        localStorage.setItem('yangjae_festival_show_mobile', 'false');
      } catch {}
    } else {
      // OFF -> ON (이미 인증된 경우 바로 켜기, 미인증 시 모달 호출)
      let alreadyAuthed = isAuthed;
      if (!alreadyAuthed) {
        try {
          alreadyAuthed = localStorage.getItem('yangjae_contact_authed') === 'true';
        } catch {}
      }
      if (alreadyAuthed) {
        setShowPrivateMobile(true);
        try {
          localStorage.setItem('yangjae_festival_show_mobile', 'true');
        } catch {}
      } else {
        setPinInput('');
        setPinError(null);
        setShowPinModal(true);
      }
    }
  }, [showPrivateMobile, isAuthed]);

  const handlePinSubmit = useCallback(() => {
    const clean = pinInput.trim();
    if (VALID_PINS.includes(clean)) {
      setIsAuthed(true);
      setShowPrivateMobile(true);
      setShowPinModal(false);
      setPinError(null);
      setPinInput('');
      try {
        localStorage.setItem('yangjae_contact_authed', 'true');
        localStorage.setItem('yangjae_festival_show_mobile', 'true');
      } catch {}
    } else {
      setPinError('비밀번호가 올바르지 않습니다. (행사일: 1031)');
    }
  }, [pinInput, VALID_PINS]);

  // 세부 과업 다른 추진과제 카테고리로 이동(Transfer) 상태
  const [transferTarget, setTransferTarget] = useState<{
    sourceMilestoneId: number;
    detailIndex: number;
    detailRaw: string;
  } | null>(null);
  const [selectedTargetMilestoneId, setSelectedTargetMilestoneId] = useState<number | null>(null);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  const [selectedTab, setSelectedTab] = useState<YangjaeReportTab>('milestones');
  const [visitedFestivalTabs, setVisitedFestivalTabs] = useState<Record<YangjaeReportTab, boolean>>({
    milestones: true,
    booths: false,
    schedule: false,
    duties: false,
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [selectedSchedulePhase, setSelectedSchedulePhase] = useState<string>('전체');
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState<string>('');
  const [selectedDutyCategory, setSelectedDutyCategory] = useState<string>('전체');
  const [dutySearchQuery, setDutySearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isLargeFont, setIsLargeFont] = useState<boolean>(false);

  // DetailEditRow memoized stable handlers
  const handleUpdateDetailRow = useCallback((dIdx: number, newDetailStr: string) => {
    setDetailDrafts((prev) => {
      const next = [...prev];
      if (next[dIdx]) {
        next[dIdx] = { ...next[dIdx], raw: newDetailStr };
      }
      return next;
    });
    setEditMilestoneData((prev) => (prev ? { ...prev, details: (prev.details || []).map((d, i) => (i === dIdx ? newDetailStr : d)) } : null));
  }, []);

  const handleMoveUpDetailRow = useCallback((dIdx: number) => {
    if (dIdx <= 0) return;
    setDetailDrafts((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dIdx, 1);
      next.splice(dIdx - 1, 0, moved);
      setEditMilestoneData((mPrev) => (mPrev ? { ...mPrev, details: next.map((d) => d.raw) } : null));
      return next;
    });
  }, []);

  const handleMoveDownDetailRow = useCallback((dIdx: number) => {
    setDetailDrafts((prev) => {
      if (dIdx >= prev.length - 1) return prev;
      const next = [...prev];
      const [moved] = next.splice(dIdx, 1);
      next.splice(dIdx + 1, 0, moved);
      setEditMilestoneData((mPrev) => (mPrev ? { ...mPrev, details: next.map((d) => d.raw) } : null));
      return next;
    });
  }, []);

  const handleDeleteDetailRow = useCallback((dIdx: number) => {
    setDetailDrafts((prev) => {
      const next = prev.filter((_, i) => i !== dIdx);
      setEditMilestoneData((mPrev) => (mPrev ? { ...mPrev, details: next.map((d) => d.raw) } : null));
      return next;
    });
  }, []);

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
      if (list[i]?.id !== undefined && list[i].id !== 2) {
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


  const boothMetrics = useMemo(() => {
    const list = activeBooths || [];
    let operatingEntitiesCount = 0;
    let confirmedEntities = 0;
    let pendingEntities = 0;
    let hqEntities = 0;
    let totalDong = 0;
    let confirmedDong = 0;
    let pendingDong = 0;
    let totalBus = 0;
    let confirmedBus = 0;
    let totalTables = 0;
    let confirmedTables = 0;
    let totalChairs = 0;
    let confirmedChairs = 0;

    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b) continue;

      const isHQ = b.category === '운영본부' || b.category === '운영주체' || (typeof b.name === 'string' && b.name.includes('보건행정팀'));
      const isConfirmed = b.status === '확정';

      if (isHQ) {
        hqEntities++;
      } else {
        operatingEntitiesCount++;
        if (isConfirmed) {
          confirmedEntities++;
        } else {
          pendingEntities++;
        }
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

      const tablesCount = typeof b.tables === 'number' ? b.tables : (Number(b.tables) || 0);
      const chairsCount = typeof b.chairs === 'number' ? b.chairs : (Number(b.chairs) || 0);

      totalTables += tablesCount;
      totalChairs += chairsCount;
      if (isConfirmed) {
        confirmedTables += tablesCount;
        confirmedChairs += chairsCount;
      }
    }

    return {
      totalEntities: operatingEntitiesCount,
      confirmedEntities,
      pendingEntities,
      hqEntities,
      totalDong,
      confirmedDong,
      pendingDong,
      totalBus,
      confirmedBus,
      totalTables,
      confirmedTables,
      totalChairs,
      confirmedChairs,
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

      // Alias support for '운영본부' and '운영주체'
      if (cat === '운영본부' || cat === '운영주체' || cat === '본부') {
        const hqAliases = ['운영본부', '운영주체', '본부'];
        for (const alias of hqAliases) {
          if (!map.has(alias)) map.set(alias, []);
          if (alias !== cat) map.get(alias)!.push(b);
        }
      }
    }
    return map;
  }, [activeBooths]);

  const handleSelectTab = useCallback((tabId: YangjaeReportTab) => {
    setVisitedFestivalTabs((prev) => (prev[tabId] ? prev : { ...prev, [tabId]: true }));
    setSelectedTab(tabId);
  }, []);

  const activeSchedule = useMemo(() => {
    return (data?.schedule || YANGJAE_FALLBACK_DATA.schedule || []) as ScheduleItem[];
  }, [data?.schedule]);

  const filteredSchedule = useMemo(() => {
    let list = activeSchedule;
    if (selectedSchedulePhase !== '전체') {
      list = list.filter((item) => item.phase === selectedSchedulePhase);
    }
    if (scheduleSearchQuery.trim()) {
      const q = scheduleSearchQuery.trim().toLowerCase();
      list = list.filter((item) =>
        item.title.toLowerCase().includes(q) ||
        (item.lead && item.lead.toLowerCase().includes(q)) ||
        (item.note && item.note.toLowerCase().includes(q)) ||
        (item.time && item.time.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeSchedule, selectedSchedulePhase, scheduleSearchQuery]);

  const activeDuties = useMemo(() => {
    return (data?.duties || YANGJAE_FALLBACK_DATA.duties || []) as DutyItem[];
  }, [data?.duties]);

  const filteredDuties = useMemo(() => {
    let list = activeDuties;
    if (selectedDutyCategory !== '전체') {
      list = list.filter((d) => d.category === selectedDutyCategory);
    }
    if (dutySearchQuery.trim()) {
      const q = dutySearchQuery.trim().toLowerCase();
      list = list.filter((d) =>
        d.deptOrOrg.toLowerCase().includes(q) ||
        d.role.toLowerCase().includes(q) ||
        d.manager.toLowerCase().includes(q) ||
        d.phone.toLowerCase().includes(q) ||
        d.tasks.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeDuties, selectedDutyCategory, dutySearchQuery]);

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
    const sortedDetails = sortDetailsAscending(m.details || []);
    const sortedMilestone = { ...safeClone(m), details: sortedDetails };
    setEditMilestoneData(sortedMilestone);
    setEditingMilestoneId(m.id);
    setExpandedTaskIds((prev) => new Set([...prev, m.id]));
    const drafts: DetailDraft[] = sortedDetails.map((detail, idx) => ({
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
      const rawDetails = detailDrafts.length > 0
        ? detailDrafts.map((d) => d.raw)
        : (editMilestoneData.details || []);
      const finalDetails = sortDetailsAscending(rawDetails);
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

  const handleTransferDetailRow = useCallback((targetItemId: number, dIdx: number, raw: string) => {
    handleOpenTransferModal(targetItemId, dIdx, raw);
  }, [handleOpenTransferModal]);

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
            details: sortDetailsAscending(nextDetails),
          };
        }
        if (m.id === selectedTargetMilestoneId) {
          return {
            ...m,
            details: sortDetailsAscending([...(m.details || []), detailRaw]),
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
          return { ...prev, details: sortDetailsAscending(nextDetails) };
        });
      }

      // 대상 과제를 편집 중이었던 경우 드래프트 목록에 추가 및 오름차순 정렬 반영
      if (editingMilestoneId === selectedTargetMilestoneId) {
        const sortedTargetDetails = sortDetailsAscending([...(editMilestoneData?.details || []), detailRaw]);
        setDetailDrafts(sortedTargetDetails.map((detail, idx) => ({
          uid: `m-${selectedTargetMilestoneId}-detail-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          raw: detail,
        })));
        setEditMilestoneData((prev) => {
          if (!prev) return null;
          return { ...prev, details: sortedTargetDetails };
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
    setEditingBoothId(null);
    setEditSingleBoothData(null);
    setEditBoothsData(safeClone(data.booths || []));
    setEditingBooths(true);
  };
  const handleCancelEditBooths = () => {
    setEditBoothsData(safeClone(data.booths || []));
    setEditingBooths(false);
  };

  // 단일 부스 개별 편집 핸들러
  const handleStartEditSingleBooth = (booth: BoothItem) => {
    if (editingBooths) {
      setEditingBooths(false);
    }
    setEditingBoothId(booth.id);
    setEditSingleBoothData(safeClone(booth));
  };

  const handleCancelEditSingleBooth = () => {
    setEditingBoothId(null);
    setEditSingleBoothData(null);
  };

  const handleSaveSingleBooth = async () => {
    if (!editSingleBoothData || editingBoothId === null) return;
    try {
      const adminFormatted = formatAutoHyphen((editSingleBoothData.adminPhone || '').trim());
      const mobileFormatted = formatAutoHyphen((editSingleBoothData.mobilePhone || '').trim());
      const phoneFormatted = formatAutoHyphen(adminFormatted || mobileFormatted || (editSingleBoothData.phone || '').trim());

      const updatedBooth: BoothItem = {
        ...editSingleBoothData,
        tables: Math.max(0, Number(editSingleBoothData.tables) || 0),
        chairs: Math.max(0, Number(editSingleBoothData.chairs) || 0),
        manager: (editSingleBoothData.manager || '').trim(),
        adminPhone: adminFormatted,
        mobilePhone: mobileFormatted,
        phone: phoneFormatted,
      };
      const currentBooths = data?.booths || YANGJAE_FALLBACK_DATA.booths || [];
      const nextBooths = currentBooths.map((b) => (b.id === editingBoothId ? updatedBooth : b));
      await saveMutation.mutateAsync({
        ...data,
        booths: nextBooths,
      });
      setEditingBoothId(null);
      setEditSingleBoothData(null);
      setToastMessage(`[${updatedBooth.name}] 부스 정보가 저장되었습니다!`);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('부스 정보 저장에 실패했습니다.');
    }
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
      // 변경된 순서에 맞춰 No.1~No.N ID 순차 정규화 및 테이블/의자 수치 보정 후 저장
      const normalizedBooths = editBoothsData.map((b, idx) => {
        const adminFormatted = formatAutoHyphen((b.adminPhone || '').trim());
        const mobileFormatted = formatAutoHyphen((b.mobilePhone || '').trim());
        const phoneFormatted = formatAutoHyphen(adminFormatted || mobileFormatted || (b.phone || '').trim());
        return {
          ...b,
          id: idx + 1,
          tables: Math.max(0, Number(b.tables) || 0),
          chairs: Math.max(0, Number(b.chairs) || 0),
          manager: (b.manager || '').trim(),
          adminPhone: adminFormatted,
          mobilePhone: mobileFormatted,
          phone: phoneFormatted,
        };
      });
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

    // 1. First attempt clipboard copy of only the link URL
    const copiedSuccess = await copyToClipboardSafe(targetUrl);

    // 2. Mobile/Tablet or Native Web Share support
    let sharedSuccess = false;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const shareData = {
          title: title,
          text: targetUrl,
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
      window.prompt('아래 링크 주소를 복사(Ctrl+C 또는 길게 터치)하세요:', targetUrl);
    }
  }, [PUBLIC_SHARE_URL, data?.meta?.title]);

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
            <div className="font-bold text-sm">페스티벌 대시보드 링크가 복사되었습니다!</div>
            <div className="text-xs text-slate-300">원하는 곳(카카오톡·문자 등)에 바로 붙여넣기(Ctrl+V) 하세요.</div>
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
              title="대시보드 링크 공유"
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

          {/* Section 2: Tab Navigation (Clean Public Report Tabs - 4 Cols) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-200 p-1.5 rounded-xl border border-slate-300">
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
          {visitedFestivalTabs.milestones && (
            <div className={selectedTab === 'milestones' ? 'block space-y-3.5' : 'hidden'}>
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

                // 과제 2(행사 식순)는 상단 [3. 행사식순] 전용 탭으로 승격되었으므로 1번 탭(추진과제)에서는 노출하지 않음
                if (item.id === 2) return null;

                return (
                  <div 
                    key={`milestone-card-${item.id}`}
                    className={`p-3.5 rounded-xl border-2 transition-all shadow-2xs ${
                      targetItem.status === 'in-progress'
                        ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-300'
                        : targetItem.status === 'done'
                        ? 'bg-emerald-50/35 border-emerald-300 ring-1 ring-emerald-200/60'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {/* Milestone Card Top: Number, Title, Status, Edit Buttons, Accordion Toggle */}
                    <div className={`flex items-center justify-between pb-2 mb-2 border-b gap-1.5 ${
                      targetItem.status === 'done' ? 'border-emerald-200/80' : 'border-slate-200'
                    }`}>
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
                              <span className={`font-black text-[11px] shrink-0 ${
                                item.status === 'done' ? 'text-emerald-400' : 'text-amber-300'
                              }`}>
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
                              <option value="done">✓ 완료</option>
                              <option value="in-progress">▶ 진행중</option>
                              <option value="todo">○ 예정</option>
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
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-black shadow-3xs'
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
                                <span className="flex items-center gap-1.5 text-amber-900 font-extrabold">
                                  <span>세부 실행 과업</span>
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300/80">
                                    날짜 오름차순 자동 정렬
                                  </span>
                                </span>
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
                                      <EditableDetailItem
                                        key={draft.uid}
                                        draft={draft}
                                        dIdx={dIdx}
                                        totalCount={activeDetailItems.length}
                                        milestoneId={targetItem.id}
                                        onMoveUp={handleMoveUpDetailRow}
                                        onMoveDown={handleMoveDownDetailRow}
                                        onTransfer={handleTransferDetailRow}
                                        onUpdate={handleUpdateDetailRow}
                                        onDelete={handleDeleteDetailRow}
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
                                {sortDetailsAscending(item.details || []).map((detail: string, dIdx: number) => {
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
          {visitedFestivalTabs.booths && (
            <div className={selectedTab === 'booths' ? 'block space-y-3.5' : 'hidden'}>
              <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-2 px-1">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <h3 className={`${isLargeFont ? 'text-base' : 'text-sm'} font-extrabold text-slate-900 flex items-center gap-1.5 whitespace-nowrap shrink-0`}>
                    <span className={`inline-block ${isLargeFont ? 'w-3.5 h-3.5 border-2' : 'w-3 h-3 border-[1.5px]'} border-slate-900 rounded-[1px] shrink-0`} />
                    <span>부스 배치 계획</span>
                  </h3>
                  <span className={`inline-flex items-center gap-1 ${isLargeFont ? 'text-xs' : 'text-[11px] sm:text-xs'} font-bold text-slate-700 bg-slate-100 border border-slate-200/90 px-2.5 py-1 rounded-full whitespace-nowrap shadow-3xs shrink-0`}>
                    <span>확정 <strong className="font-black text-slate-900">{boothMetrics.confirmedEntities}</strong> / 총 <strong className="font-black text-slate-900">{boothMetrics.totalEntities}개</strong></span>
                    <span className="text-slate-400 mx-0.5">·</span>
                    <span className="font-black text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] border border-emerald-300/60">
                      필요 {boothMetrics.totalDong}동
                    </span>
                  </span>
                </div>

                {editingBooths ? (
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
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
                            tables: 2,
                            chairs: 4,
                            manager: '',
                            phone: '',
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
                ) : (
                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    <button
                      type="button"
                      onClick={handleSwitchToggle}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-300 bg-slate-100 hover:bg-slate-200/80 transition-all cursor-pointer shadow-3xs select-none"
                      title={showPrivateMobile ? "비상연락망 켜짐 (클릭 시 끄기)" : "비상연락망 꺼짐 (클릭 시 비밀번호 인증 후 켜기)"}
                    >
                      <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                        <span>비상연락망</span>
                      </span>
                      {/* Toggle Track */}
                      <span className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out inline-flex items-center ${showPrivateMobile ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        {/* Toggle Knob */}
                        <span className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${showPrivateMobile ? 'translate-x-3.5' : 'translate-x-0'}`} />
                      </span>
                      <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${showPrivateMobile ? 'bg-emerald-100 text-emerald-800 border-emerald-300/80' : 'bg-slate-200 text-slate-600 border-slate-300/80'}`}>
                        {showPrivateMobile ? 'ON (보임)' : 'OFF (숨김)'}
                      </span>
                    </button>
                    {isLocalAdmin && (
                      <button
                        type="button"
                        onClick={handleStartEditBooths}
                        className="px-2.5 py-1 text-xs font-extrabold bg-amber-50 hover:bg-amber-100 text-amber-950 rounded-lg border border-amber-300 flex items-center gap-1 cursor-pointer transition-colors shadow-3xs whitespace-nowrap shrink-0"
                        title="부스 순서 변경 및 현황 수정"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>순서 변경 / 편집</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Booth Summary Metrics Card (행렬 정렬 & 프리미엄 다크 카드) */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white rounded-xl shadow-xs border border-slate-700 p-3 sm:p-3.5 space-y-3">
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
                      {boothMetrics.pendingEntities > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-slate-800/90 text-slate-300 border border-slate-700 whitespace-nowrap">
                          협의 {boothMetrics.pendingEntities}
                        </span>
                      )}
                      {boothMetrics.hqEntities > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-extrabold bg-amber-950/80 text-amber-300 border border-amber-700/60 whitespace-nowrap" title="보건행정팀 운영본부 1개소">
                          본부 {boothMetrics.hqEntities}
                        </span>
                      )}
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
                  const isHQ = booth.category === '운영본부' || booth.category === '운영주체' || (typeof booth.name === 'string' && booth.name.includes('보건행정팀'));
                  const operatingBooths = activeBooths.filter(
                    (b) => b.category !== '운영본부' && b.category !== '운영주체' && !(typeof b.name === 'string' && b.name.includes('보건행정팀'))
                  );
                  const opIdx = operatingBooths.findIndex((b) => b.id === booth.id);
                  const displayNo = opIdx !== -1 ? opIdx + 1 : booth.id;
                  const canMoveUp = fIdx > 0;
                  const canMoveDown = fIdx < filteredBooths.length - 1;

                  const isEditingSingle = editingBoothId === booth.id;
                  const isEditingThis = editingBooths || isEditingSingle;
                  const targetBooth = (isEditingSingle ? editSingleBoothData : (editingBooths ? editBoothsData.find((b) => b.id === booth.id) : booth)) || booth;

                  const updateBoothField = <K extends keyof BoothItem>(field: K, value: BoothItem[K]) => {
                    const formattedVal = (field === 'adminPhone' || field === 'mobilePhone' || field === 'phone') && typeof value === 'string'
                      ? (formatAutoHyphen(value) as BoothItem[K])
                      : value;

                    if (isEditingSingle) {
                      setEditSingleBoothData((prev) => {
                        if (!prev) return prev;
                        const updated = { ...prev, [field]: formattedVal };
                        if (field === 'adminPhone' && !prev.mobilePhone) {
                          updated.phone = String(formattedVal);
                        } else if (field === 'mobilePhone' && !prev.adminPhone) {
                          updated.phone = String(formattedVal);
                        }
                        return updated;
                      });
                    } else if (editingBooths) {
                      setEditBoothsData((prev) => {
                        const next = [...prev];
                        const targetIdx = next.findIndex((b) => b.id === booth.id);
                        if (targetIdx !== -1) {
                          const updated = { ...next[targetIdx], [field]: formattedVal };
                          if (field === 'adminPhone' && !next[targetIdx].mobilePhone) {
                            updated.phone = String(formattedVal);
                          } else if (field === 'mobilePhone' && !next[targetIdx].adminPhone) {
                            updated.phone = String(formattedVal);
                          }
                          next[targetIdx] = updated;
                        }
                        return next;
                      });
                    }
                  };

                  return (
                    <div 
                      key={`booth-card-${booth.id}`}
                      className={`p-3.5 bg-white border-2 rounded-xl transition-all ${
                        isHQ
                          ? 'border-amber-400 bg-amber-50/20'
                          : isEditingSingle
                          ? 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50/10 shadow-md'
                          : editingBooths
                          ? 'border-amber-300 ring-1 ring-amber-200 shadow-2xs'
                          : 'border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200">
                        <div className="flex items-center gap-1.5">
                          {isHQ ? (
                            <span className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 shadow-3xs`}>
                              운영본부
                            </span>
                          ) : (
                            <span className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-mono font-black text-slate-700`}>
                              No.{displayNo}
                            </span>
                          )}
                          {isEditingThis && (
                            <input
                              type="text"
                              value={targetBooth.category}
                              onChange={(e) => updateBoothField('category', e.target.value)}
                              className="px-1.5 py-0.5 border border-amber-400 rounded bg-white text-xs font-bold w-24"
                              placeholder="카테고리"
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isEditingSingle ? (
                            <div className="flex items-center gap-1">
                              <select
                                value={targetBooth.status}
                                onChange={(e) => updateBoothField('status', e.target.value)}
                                className="px-1.5 py-0.5 text-xs font-bold border border-emerald-400 rounded bg-white cursor-pointer"
                              >
                                <option value="확정">확정</option>
                                <option value="협의중">협의중</option>
                                <option value="신청완료">신청완료</option>
                              </select>
                              <button
                                type="button"
                                onClick={handleSaveSingleBooth}
                                disabled={saveMutation.isPending}
                                className="px-2 py-0.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-0.5 cursor-pointer shadow-3xs transition-all active:scale-95"
                                title="부스 저장"
                              >
                                {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                <span>저장</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditSingleBooth}
                                className="px-1.5 py-0.5 text-xs font-bold bg-slate-600 hover:bg-slate-500 text-white rounded flex items-center gap-0.5 cursor-pointer shadow-3xs transition-all active:scale-95"
                                title="취소"
                              >
                                <X className="w-3 h-3" />
                                <span>취소</span>
                              </button>
                            </div>
                          ) : editingBooths ? (
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
                                value={targetBooth.status}
                                onChange={(e) => updateBoothField('status', e.target.value)}
                                className="px-1.5 py-0.5 text-xs font-bold border border-amber-400 rounded bg-white cursor-pointer"
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
                            <div className="flex items-center gap-1.5">
                              <span className={`${isLargeFont ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5'} font-bold rounded border ${
                                booth.status === '확정'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}>
                                {booth.status}
                              </span>
                              {isLocalAdmin && !editingBooths && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditSingleBooth(booth)}
                                  className="px-2 py-0.5 text-xs font-bold bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-300 hover:border-amber-300 rounded-md flex items-center gap-1 cursor-pointer transition-colors shadow-3xs"
                                  title="부스 정보 수정"
                                >
                                  <Edit3 className="w-3 h-3 text-slate-600" />
                                  <span>수정</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                    {isEditingThis ? (
                      <>
                        <input
                          type="text"
                          value={targetBooth.name}
                          onChange={(e) => updateBoothField('name', e.target.value)}
                          className="w-full px-2 py-1 border border-amber-400 rounded bg-white text-sm font-extrabold mb-1.5"
                          placeholder="부스 이름"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-amber-50/60 p-2 rounded-lg border border-amber-200/80 mb-2">
                          {/* 1. 담당자 */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <User className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            <span className="text-xs font-bold text-slate-700 whitespace-nowrap shrink-0">담당자:</span>
                            <input
                              type="text"
                              value={targetBooth.manager ?? ''}
                              onChange={(e) => updateBoothField('manager', e.target.value)}
                              className="px-2 py-0.5 border border-amber-400 rounded bg-white text-xs flex-1 font-bold text-slate-900 min-w-0"
                              placeholder="예: 오창선 주무관"
                            />
                          </div>

                          {/* 2. 행정번호 (유선) */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Phone className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            <span className="text-xs font-bold text-blue-900 whitespace-nowrap shrink-0">행정번호:</span>
                            <input
                              type="text"
                              value={targetBooth.adminPhone ?? (!targetBooth.phone?.startsWith('010') ? targetBooth.phone : '') ?? ''}
                              onChange={(e) => updateBoothField('adminPhone', e.target.value)}
                              className="px-2 py-0.5 border border-amber-400 rounded bg-white text-xs flex-1 font-mono font-bold text-slate-900 min-w-0"
                              placeholder="예: 02-3423-7116"
                            />
                          </div>

                          {/* 3. 폰번호 (휴대전화) */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Smartphone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span className="text-xs font-bold text-emerald-900 whitespace-nowrap shrink-0">폰번호:</span>
                            <input
                              type="text"
                              value={targetBooth.mobilePhone ?? (targetBooth.phone?.startsWith('010') ? targetBooth.phone : '') ?? ''}
                              onChange={(e) => updateBoothField('mobilePhone', e.target.value)}
                              className="px-2 py-0.5 border border-amber-400 rounded bg-white text-xs flex-1 font-mono font-bold text-slate-900 min-w-0"
                              placeholder="예: 010-8494-0544"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={`${isLargeFont ? 'text-base' : 'text-sm'} font-extrabold text-slate-900 mb-1`}>
                          {booth.name}
                        </div>
                        {(() => {
                          const adminNo = formatAutoHyphen((booth.adminPhone || (!booth.phone?.startsWith('010') ? booth.phone : '') || '').trim());
                          const mobileNo = formatAutoHyphen((booth.mobilePhone || (booth.phone?.startsWith('010') ? booth.phone : '') || '').trim());

                          const isMobileVisible = showPrivateMobile && !!mobileNo;
                          if (!booth.manager && !adminNo && !isMobileVisible) return null;

                          return (
                            <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap overflow-x-auto no-scrollbar mb-2 whitespace-nowrap py-0.5">
                              {/* 담당자 뱃지 */}
                              {booth.manager && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 ${isLargeFont ? 'text-xs' : 'text-[10.5px] sm:text-[11px]'} font-bold shrink-0 shadow-3xs`}>
                                  <User className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span>담당: {booth.manager}</span>
                                </span>
                              )}

                              {/* 행정번호 뱃지 (유선) */}
                              {adminNo && (
                                <a
                                  href={`tel:${adminNo.replace(/[^0-9]/g, '')}`}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${isLargeFont ? 'text-xs' : 'text-[10.5px] sm:text-[11px]'} font-bold bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-200 shadow-3xs transition-all cursor-pointer active:scale-95 shrink-0`}
                                  title={`행정전화 걸기: ${adminNo}`}
                                >
                                  <Phone className="w-2.5 h-2.5 text-blue-700 shrink-0" />
                                  <span className="font-extrabold text-blue-900">행정:</span>
                                  <span className="font-mono font-bold tracking-tight text-blue-950">
                                    {adminNo}
                                  </span>
                                </a>
                              )}

                              {/* 폰번호 뱃지 (휴대전화 - 비상연락망 원클릭 통화 발신) */}
                              {isMobileVisible && (
                                <a
                                  href={`tel:${mobileNo.replace(/[^0-9]/g, '')}`}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${isLargeFont ? 'text-xs' : 'text-[10.5px] sm:text-[11px]'} font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 shadow-3xs transition-all cursor-pointer active:scale-95 shrink-0`}
                                  title={`휴대전화 걸기: ${mobileNo}`}
                                >
                                  <Smartphone className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                                  <span className="font-extrabold text-emerald-900">폰:</span>
                                  <span className="font-mono font-bold tracking-tight text-emerald-950">
                                    {mobileNo}
                                  </span>
                                </a>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}

                    {isEditingThis ? (
                      <div className="space-y-1 bg-slate-50 p-2.5 rounded border border-slate-200 mb-1.5">
                        <span className="font-bold text-xs text-slate-600">내용:</span>
                        <textarea
                          value={targetBooth.program}
                          onChange={(e) => updateBoothField('program', e.target.value)}
                          className="w-full px-2 py-1 border border-amber-400 rounded bg-white text-xs leading-relaxed"
                          rows={2}
                        />
                      </div>
                    ) : (
                      <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed mb-1.5`}>
                        <span className="font-bold text-slate-600">내용: </span>{booth.program}
                      </div>
                    )}

                    {isEditingThis ? (
                      <div className="space-y-2 pt-1.5 border-t border-dashed border-amber-200">
                        <div className="flex items-center gap-1.5 w-full">
                          <span className="text-xs font-bold text-slate-700 whitespace-nowrap shrink-0">부스규모:</span>
                          <input
                            type="text"
                            value={targetBooth.scale}
                            onChange={(e) => updateBoothField('scale', e.target.value)}
                            className="px-2 py-0.5 border border-amber-400 rounded bg-white text-xs flex-1 font-bold"
                            placeholder="예: 2동, 1동 + 검진버스"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2 bg-amber-50/70 p-2 rounded-lg border border-amber-300/80">
                          <div className="flex items-center gap-1.5">
                            <Table className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                            <span className="text-xs font-bold text-slate-800 whitespace-nowrap shrink-0">테이블:</span>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={targetBooth.tables ?? 0}
                              onChange={(e) => updateBoothField('tables', Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="w-16 px-1.5 py-0.5 border border-amber-400 rounded bg-white text-xs font-black text-amber-950 text-right"
                            />
                            <span className="text-xs font-bold text-slate-600">개</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Armchair className="w-3.5 h-3.5 text-sky-800 shrink-0" />
                            <span className="text-xs font-bold text-slate-800 whitespace-nowrap shrink-0">의자:</span>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={targetBooth.chairs ?? 0}
                              onChange={(e) => updateBoothField('chairs', Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="w-16 px-1.5 py-0.5 border border-amber-400 rounded bg-white text-xs font-black text-sky-950 text-right"
                            />
                            <span className="text-xs font-bold text-slate-600">개</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-600 font-medium flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 pt-1 border-t border-slate-100`}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>부스규모: <strong className="text-slate-900">{booth.scale}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200/90 shadow-3xs">
                            <Table className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>테이블 <strong>{booth.tables ?? 0}</strong>개</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold bg-sky-50 text-sky-900 border border-sky-200/90 shadow-3xs">
                            <Armchair className="w-3 h-3 text-sky-700 shrink-0" />
                            <span>의자 <strong>{booth.chairs ?? 0}</strong>개</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )})}
              </div>
            </div>
          )}

          {/* TAB 3: 행사식순 (당일 17개 세부 타임테이블) */}
          {visitedFestivalTabs.schedule && (
            <div className={selectedTab === 'schedule' ? 'block space-y-3.5' : 'hidden'}>
              {/* Header Stats Bar */}
              <div className="bg-white border-2 border-slate-300 rounded-xl p-3 sm:p-4 shadow-2xs space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className={`${isLargeFont ? 'text-base font-black' : 'text-sm font-extrabold'} text-slate-900 flex items-center gap-1.5`}>
                        <span>행사 식순</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">17개 식순</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">07:30 직원 출근부터 14:30 환경 정비까지 진행 순서 및 의전 규정</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>2026. 10. 31.(토) 08:00~14:00</span>
                  </div>
                </div>

                {/* Quick Phase Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                  {SCHEDULE_PHASES.map((ph) => {
                    const count = ph === '전체' 
                      ? activeSchedule.length 
                      : activeSchedule.filter((s) => s.phase === ph).length;
                    const isSelected = selectedSchedulePhase === ph;
                    return (
                      <button
                        key={`phase-pill-${ph}`}
                        type="button"
                        onClick={() => setSelectedSchedulePhase(ph)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <span>{ph}</span>
                        <span className={`ml-1 text-[10.5px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={scheduleSearchQuery}
                    onChange={(e) => setScheduleSearchQuery(e.target.value)}
                    placeholder="식순명, 담당자, 내용 검색 (예: 국민의례, 걷기대회, 축하공연...)"
                    className="w-full pl-9 pr-8 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900"
                  />
                  {scheduleSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setScheduleSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Timetable Table Grid (칼정렬 행열 고도화) */}
              <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                {filteredSchedule.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 font-medium">
                    검색 조건과 일치하는 행사 식순이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[720px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 text-xs font-extrabold">
                          <th className="py-2.5 px-3 text-center w-14 shrink-0">순번</th>
                          <th className="py-2.5 px-3 text-center w-36 shrink-0">시간 (소요)</th>
                          <th className="py-2.5 px-3 text-center w-24 shrink-0">구분</th>
                          <th className="py-2.5 px-3 text-left">식순명 및 세부 내용</th>
                          <th className="py-2.5 px-3 text-center w-36 shrink-0">주관 / 담당</th>
                          <th className="py-2.5 px-3 text-center w-20 shrink-0">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredSchedule.map((item) => {
                          const isCeremony = item.id === 7 || item.title.includes('국민의례');
                          const isWalkingStart = item.id === 14 || item.title.includes('걷기');
                          const isDone = item.status === '완료' || item.status === 'done';
                          const isInProgress = item.status === '진행중' || item.status === 'in-progress';

                          return (
                            <tr
                              key={`schedule-row-${item.id}`}
                              className={`transition-colors align-top ${
                                isCeremony
                                  ? 'bg-blue-50/50 hover:bg-blue-50/80'
                                  : isWalkingStart
                                  ? 'bg-emerald-50/50 hover:bg-emerald-50/80'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              {/* 순번 */}
                              <td className="py-3 px-3 text-center font-mono text-xs font-extrabold text-slate-700">
                                #{item.id}
                              </td>

                              {/* 시간 및 소요 */}
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-900">
                                  <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span>{item.time}</span>
                                </div>
                                {item.duration && (
                                  <div className="text-[11px] font-semibold text-blue-700 mt-0.5">
                                    {item.duration}
                                  </div>
                                )}
                              </td>

                              {/* 구분 */}
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {item.phase}
                                </span>
                              </td>

                              {/* 식순명 및 세부 내용 */}
                              <td className="py-3 px-3">
                                <div className="space-y-1">
                                  <div className={`${isLargeFont ? 'text-base font-black' : 'text-sm font-extrabold'} text-slate-900 leading-snug`}>
                                    {item.title}
                                  </div>
                                  {item.note && (
                                    <p className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-600 font-medium leading-relaxed`}>
                                      {item.note}
                                    </p>
                                  )}
                                  {/* 국민의례 의전 규정 안내 */}
                                  {isCeremony && (
                                    <div className="mt-2 p-2.5 bg-white/95 border border-blue-200 rounded-lg space-y-1 text-xs text-blue-950 shadow-3xs">
                                      <div className="flex items-center gap-1.5 font-bold text-blue-900 text-[11.5px]">
                                        <Shield className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                                        <span>대통령훈령 제438호(국민의례 규정) 약식절차 1 준용</span>
                                      </div>
                                      <div className="space-y-0.5 text-[11px] text-slate-700 pl-5 leading-relaxed font-medium">
                                        <div>• <strong>국기에 대한 경례</strong>: 전주 없는 애국가 반주 1절에 맞춰 실시 (맹세문 미낭송)</div>
                                        <div>• <strong>순국선열과 호국영령에 대한 묵념</strong>: 묵념곡 10~15초 연주</div>
                                        <div className="text-red-600 font-bold bg-red-50 p-1.5 rounded border border-red-200 mt-1">
                                          ※ 의전 금지 멘트 수칙: 사회자가 &ldquo;애국가 제창 등 이하 생략하겠습니다&rdquo; 멘트를 발언하는 것은 국가상징 품격을 저해하므로 규정상 엄격히 금지함.
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {/* 걷기대회 코스 안내 */}
                                  {isWalkingStart && (
                                    <div className="mt-2 p-2 bg-white/95 border border-emerald-200 rounded-lg text-xs text-emerald-950 shadow-3xs flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-1.5 font-bold">
                                        <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                        <span>코스: 수변문화쉼터 ↔ 영동4교 (2km 왕복 수변 산책로)</span>
                                      </div>
                                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                        완주 인센티브 마감: 12:30
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* 주관 / 담당 */}
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                {item.lead ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                    <User className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>{item.lead}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </td>

                              {/* 상태 */}
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  isDone
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isInProgress
                                    ? 'bg-amber-100 text-amber-900 animate-pulse'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {isDone ? '✓ 완료' : isInProgress ? '▶ 진행' : '○ 예정'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: 업무분장 (실무 과업 및 비상연락망) */}
          {visitedFestivalTabs.duties && (
            <div className={selectedTab === 'duties' ? 'block space-y-3.5' : 'hidden'}>
              {/* Header Stats Bar */}
              <div className="bg-white border-2 border-slate-300 rounded-xl p-3 sm:p-4 shadow-2xs space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className={`${isLargeFont ? 'text-base font-black' : 'text-sm font-extrabold'} text-slate-900 flex items-center gap-1.5`}>
                        <span>업무분장 및 비상연락망</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">22개 부서·기관</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">보건소·체육회·대행사 및 협조부서 배정 과업 일람</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSwitchToggle}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-300 bg-slate-100 hover:bg-slate-200/80 transition-all cursor-pointer shadow-3xs select-none"
                      title={showPrivateMobile ? "비상연락망 켜짐 (클릭 시 끄기)" : "비상연락망 꺼짐 (클릭 시 비밀번호 인증 후 켜기)"}
                    >
                      <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                        <span>비상연락망</span>
                      </span>
                      {/* Toggle Track */}
                      <span className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out inline-flex items-center ${showPrivateMobile ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        {/* Toggle Knob */}
                        <span className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${showPrivateMobile ? 'translate-x-3.5' : 'translate-x-0'}`} />
                      </span>
                      <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${showPrivateMobile ? 'bg-emerald-100 text-emerald-800 border-emerald-300/80' : 'bg-slate-200 text-slate-600 border-slate-300/80'}`}>
                        {showPrivateMobile ? 'ON (보임)' : 'OFF (숨김)'}
                      </span>
                    </button>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <Users className="w-3.5 h-3.5 text-emerald-700" />
                      <span>행사 운영단</span>
                    </div>
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                  {DUTY_CATEGORIES.map((cat) => {
                    const count = cat === '전체'
                      ? activeDuties.length
                      : activeDuties.filter((d) => d.category === cat).length;
                    const isSelected = selectedDutyCategory === cat;
                    return (
                      <button
                        key={`duty-cat-${cat}`}
                        type="button"
                        onClick={() => setSelectedDutyCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <span>{cat}</span>
                        <span className={`ml-1 text-[10.5px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={dutySearchQuery}
                    onChange={(e) => setDutySearchQuery(e.target.value)}
                    placeholder="부서명, 담당자, 전화번호, 과업 내용 검색 (예: 오창선, 체육회, 구급차, 제이민...)"
                    className="w-full pl-9 pr-8 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900"
                  />
                  {dutySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDutySearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Roster Table Grid (칼정렬 행열 고도화) */}
              <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                {filteredDuties.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 font-medium">
                    검색 조건과 일치하는 업무분장 항목이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[780px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 text-xs font-extrabold">
                          <th className="py-2.5 px-3 text-center w-24 shrink-0">구분</th>
                          <th className="py-2.5 px-3 text-left w-44 shrink-0">부서·기관명</th>
                          <th className="py-2.5 px-3 text-left w-48 shrink-0">담당 역할</th>
                          <th className="py-2.5 px-3 text-left w-48 shrink-0">담당자 / 연락처</th>
                          <th className="py-2.5 px-3 text-left">배정 과업</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredDuties.map((duty) => {
                          const isHQ = duty.category === '총괄기획';
                          const isSports = duty.category === '체육회';
                          const isSafety = duty.category === '응급안전';
                          const isAgency = duty.category === '대행용역';

                          return (
                            <tr
                              key={`duty-row-${duty.id}`}
                              className={`transition-colors align-top ${
                                isHQ
                                  ? 'hover:bg-blue-50/40'
                                  : isSports
                                  ? 'hover:bg-indigo-50/40'
                                  : isSafety
                                  ? 'hover:bg-red-50/40'
                                  : isAgency
                                  ? 'hover:bg-amber-50/40'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              {/* 구분 */}
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${
                                  isHQ
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : isSports
                                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                    : isSafety
                                    ? 'bg-red-100 text-red-800 border border-red-200'
                                    : isAgency
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}>
                                  {duty.category}
                                </span>
                              </td>

                              {/* 부서·기관명 */}
                              <td className="py-3 px-3">
                                <div className="font-extrabold text-xs text-slate-900 leading-snug">
                                  {duty.deptOrOrg}
                                </div>
                              </td>

                              {/* 담당 역할 */}
                              <td className="py-3 px-3">
                                <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} font-bold text-slate-800 leading-snug`}>
                                  {duty.role}
                                </div>
                              </td>

                              {/* 담당자 / 연락처 (행정번호 & 폰번호 구분) */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="space-y-1">
                                  {duty.manager && (
                                    <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                      <User className="w-3 h-3 text-slate-500 shrink-0" />
                                      <span>{duty.manager}</span>
                                    </div>
                                  )}
                                  {(() => {
                                    const adminNo = formatAutoHyphen((duty.adminPhone || (!duty.phone?.startsWith('010') ? duty.phone : '') || '').trim());
                                    const mobileNo = formatAutoHyphen((duty.mobilePhone || (duty.phone?.startsWith('010') ? duty.phone : '') || '').trim());

                                    return (
                                      <div className="flex flex-col gap-1">
                                        {adminNo && (
                                          <div>
                                            <a
                                              href={`tel:${adminNo.replace(/[^0-9]/g, '')}`}
                                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 shadow-3xs transition-all active:scale-95 cursor-pointer"
                                              title={`행정전화 걸기: ${adminNo}`}
                                            >
                                              <Phone className="w-3 h-3 text-blue-700 shrink-0" />
                                              <span className="text-[10.5px] font-extrabold text-blue-800">행정:</span>
                                              <span className="font-mono">{adminNo}</span>
                                            </a>
                                          </div>
                                        )}
                                        {showPrivateMobile && mobileNo && (
                                          <div>
                                            <a
                                              href={`tel:${mobileNo.replace(/[^0-9]/g, '')}`}
                                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 shadow-3xs transition-all active:scale-95 cursor-pointer"
                                              title={`휴대전화 걸기: ${mobileNo}`}
                                            >
                                              <Smartphone className="w-3 h-3 text-emerald-700 shrink-0" />
                                              <span className="text-[10.5px] font-extrabold text-emerald-800">폰:</span>
                                              <span className="font-mono">{mobileNo}</span>
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>

                              {/* 배정 과업 */}
                              <td className="py-3 px-3">
                                <ul className="space-y-1">
                                  {duty.tasks.map((task, tIdx) => (
                                    <li
                                      key={`duty-${duty.id}-task-${tIdx}`}
                                      className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-700 font-medium flex items-start gap-1.5 leading-relaxed`}
                                    >
                                      <span className="text-slate-400 font-bold select-none shrink-0">•</span>
                                      <span>{task}</span>
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
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

      {/* Emergency Contact PIN Verification Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-300 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">비상연락망 보안 인증</h3>
                <p className="text-xs text-slate-500 font-medium">행사 관계자 및 근무자 확인 비밀번호 입력</p>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handlePinSubmit(); }} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">인증 비밀번호</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={10}
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value); setPinError(null); }}
                  placeholder="비밀번호 4자리 (예: 행사일)"
                  className="w-full px-3.5 py-2.5 text-sm font-mono font-bold tracking-widest text-center border-2 border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 text-slate-900"
                  autoFocus
                />
                {pinError && (
                  <div className="text-xs font-bold text-red-600 text-center">
                    ✕ {pinError}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(null); }}
                  className="flex-1 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer active:scale-95"
                >
                  인증 및 ON
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

