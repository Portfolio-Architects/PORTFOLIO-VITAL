import React from 'react';
import type { YangjaeReportTab, ParsedDetail, BoothScaleParsed } from './types';
export { DUTY_CATEGORIES, SCHEDULE_PHASES, CHECKLIST_PHASES, CHECKLIST_DOMAINS } from './types';

// Universal Robust Clipboard Copy (Works on all mobile/desktop browsers, webviews, and sandboxes)
export async function copyToClipboardSafe(text: string): Promise<boolean> {
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

export function fallbackCopy(text: string): boolean {
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

export const FESTIVAL_CATEGORIES = ['전체', '보건소 부서', '민간', '운영본부'];
export const FESTIVAL_TARGET_TIMESTAMP = new Date("2026-10-31T09:00:00").getTime();

export const LARGE_FONT_STYLES = `
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

export function safeClone<T>(data: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
}

/**
 * 전화번호 및 휴대전화 자동 하이픈 포맷터 (Auto-Hyphen)
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

/**
 * 개인정보 보호를 위해 비상연락망(폰번호) 숨김 상태에서 담당자 성명의 가운데 글자를 'O'로 마스킹합니다.
 */
export function maskPersonName(raw: string | undefined | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  // 기관/부서/구분자 포함 명칭 보존
  if (
    trimmed.includes('/') ||
    trimmed.includes('·') ||
    trimmed.includes('(주)') ||
    trimmed.endsWith('연구소') ||
    trimmed.endsWith('병원') ||
    trimmed.endsWith('의사회') ||
    trimmed.endsWith('센터') ||
    trimmed.endsWith('담당')
  ) {
    return trimmed;
  }

  const parts = trimmed.split(/\s+/);
  const first = parts[0];

  // 단체/팀명 어미 검사 (팀, 과, 단, 소, 회, 원) - 뒤에 팀장/주무관 등 직급이 없는 경우
  if (/(팀|과|단|소|회|원)$/.test(first) && !/^(팀장|주무관|주임|협회장|과장)/.test(parts[1] || '')) {
    return trimmed;
  }

  // 2~4음절 한글 인명 검사
  const hangulRegex = /^[가-힣]{2,4}$/;
  if (hangulRegex.test(first)) {
    // 2단어 이상일 경우 직급/직책 또는 괄호 부가설명 여부 확인
    if (parts.length > 1) {
      const second = parts[1];
      const isTitleOrParen = /^(팀장|주무관|주임|협회장|과장|국장|팀원|대표|센터장|사무관|서기관|주사|\()/.test(second);
      if (!isTitleOrParen) {
        return trimmed;
      }
    }

    let masked = first;
    if (first.length === 2) {
      masked = first[0] + 'O';
    } else if (first.length === 3) {
      masked = first[0] + 'O' + first[2];
    } else if (first.length === 4) {
      masked = first[0] + 'OO' + first[3];
    }

    if (parts.length > 1) {
      return masked + ' ' + parts.slice(1).join(' ');
    }
    return masked;
  }

  return trimmed;
}

export const YANGJAE_REPORT_TABS: { id: YangjaeReportTab; label: string }[] = [
  { id: 'playbook', label: '1. 히스토리·체크리스트' },
  { id: 'milestones', label: '2. 추진과제' },
  { id: 'booths', label: '3. 부스현황' },
  { id: 'duties', label: '4. 업무분장' },
  { id: 'schedule', label: '5. 행사식순' },
];

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
  '김지현': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '김지현주무관': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '김지현 주무관': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '김지현주무관님': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '김지현 주무관님': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '지현': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '김지현담당자': { ext: '7173', full: '02-3423-7173', role: '보건소 담당자' },
  '서울대병원 강남센터': { ext: '8276', full: '010-5663-8276', role: '민간 의료기관 부스' },
  '서울대병원강남센터': { ext: '8276', full: '010-5663-8276', role: '민간 의료기관 부스' },
  '서울대학교병원 강남센터': { ext: '8276', full: '010-5663-8276', role: '민간 의료기관 부스' },
  '서울대학교병원강남센터': { ext: '8276', full: '010-5663-8276', role: '민간 의료기관 부스' },
  '서울대병원': { ext: '8276', full: '010-5663-8276', role: '민간 의료기관 부스' },
  '서울대학교병원': { ext: '8276', full: '010-5663-8276', role: '민간 의료기관 부스' },
  '(주)유디': { ext: '2210', full: '010-5192-2210', role: '민간 의료기관 부스' },
  '주식회사 유디': { ext: '2210', full: '010-5192-2210', role: '민간 의료기관 부스' },
  '유디': { ext: '2210', full: '010-5192-2210', role: '민간 의료기관 부스' },
  '유디치과': { ext: '2210', full: '010-5192-2210', role: '민간 의료기관 부스' },
  '(주)유디치과': { ext: '2210', full: '010-5192-2210', role: '민간 의료기관 부스' },
  '유디 치과': { ext: '2210', full: '010-5192-2210', role: '민간 의료기관 부스' },
  '강남차병원': { ext: '0992', full: '010-2698-0992', role: '민간 의료기관 부스' },
  '강남 차병원': { ext: '0992', full: '010-2698-0992', role: '민간 의료기관 부스' },
  '차병원': { ext: '0992', full: '010-2698-0992', role: '민간 의료기관 부스' },
  '한국신체정보': { ext: '3732', full: '010-9985-3732', role: '민간 헬스케어 부스' },
  '한국신체정보(주)': { ext: '3732', full: '010-9985-3732', role: '민간 헬스케어 부스' },
  '한국신체정보 (주)': { ext: '3732', full: '010-9985-3732', role: '민간 헬스케어 부스' },
  '한국신체정보주식회사': { ext: '3732', full: '010-9985-3732', role: '민간 헬스케어 부스' },
  '한국신체': { ext: '3732', full: '010-9985-3732', role: '민간 헬스케어 부스' },
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
  '과장님': { ext: '7010', full: '02-3423-7010', role: '과장' },
  '과장': { ext: '7010', full: '02-3423-7010', role: '과장' },
  '보건행정과장': { ext: '7010', full: '02-3423-7010', role: '과장' },
  '제이민': { ext: '0544', full: '010-8494-0544', role: '대행사(김다희 팀장)' },
  '제이민(대행사)': { ext: '0544', full: '010-8494-0544', role: '대행사(김다희 팀장)' },
  '제이민 커뮤니케이션': { ext: '0544', full: '010-8494-0544', role: '대행사(김다희 팀장)' },
  '김다희': { ext: '0544', full: '010-8494-0544', role: '대행사 팀장' },
  '김다희팀장': { ext: '0544', full: '010-8494-0544', role: '대행사 팀장' },
  '김다희 팀장': { ext: '0544', full: '010-8494-0544', role: '대행사 팀장' },
  '김다희팀장님': { ext: '0544', full: '010-8494-0544', role: '대행사 팀장' },
  '김다희 팀장님': { ext: '0544', full: '010-8494-0544', role: '대행사 팀장' },
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
    return React.createElement(
      'div',
      { className: 'space-y-1' },
      rawLines.map((line, idx) => {
        const cleanLine = line.replace(/^[-•*·]\s*/, '');
        const isHeading = idx === 0 && !line.startsWith('-') && !line.startsWith('•') && !line.startsWith('*');
        return React.createElement(
          'div',
          { key: `${idx}-${cleanLine.slice(0, 16)}`, className: 'flex items-start gap-1.5' },
          React.createElement(
            'span',
            { className: 'text-slate-400 font-bold shrink-0 text-xs select-none mt-0.5' },
            isHeading ? '▪' : '-'
          ),
          React.createElement(
            'span',
            { className: `${isLargeFont ? 'text-sm' : 'text-xs'} ${isHeading ? 'font-bold text-slate-900' : 'font-medium text-slate-800'} leading-relaxed break-keep` },
            cleanLine
          )
        );
      })
    );
  }

  // 2. 콜론(:)이 포함된 경우: "제목"과 "개조식 내용"으로 2줄 분리
  if (text.includes(':')) {
    const colonIdx = text.indexOf(':');
    const titlePart = text.substring(0, colonIdx).trim();
    const bodyPart = text.substring(colonIdx + 1).trim();

    return React.createElement(
      'div',
      { className: 'space-y-1' },
      titlePart ? React.createElement(
        'div',
        { className: `${isLargeFont ? 'text-sm' : 'text-[13px] sm:text-[13.5px]'} font-extrabold text-slate-900 tracking-tight leading-snug break-keep flex items-center gap-1.5` },
        React.createElement('span', null, titlePart)
      ) : null,
      bodyPart ? React.createElement(
        'div',
        { className: 'mt-1 pl-2.5 border-l-2 border-slate-300/90 py-0.5' },
        React.createElement(
          'span',
          { className: `${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-700 font-medium leading-relaxed break-keep` },
          bodyPart
        )
      ) : null
    );
  }

  // 3. 일반 단일 라인
  return React.createElement(
    'div',
    { className: 'flex items-start gap-1.5' },
    React.createElement(
      'span',
      { className: `${isLargeFont ? 'text-sm' : 'text-[13px] sm:text-[13.5px]'} text-slate-900 font-bold leading-relaxed break-keep` },
      text
    )
  );
}
