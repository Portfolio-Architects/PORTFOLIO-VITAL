import {
  StickyNoteColor,
  WorkingMemoryCategory,
  WorkingMemoryIssueMeta,
  WorkingMemoryIssueSeverity,
  WorkingMemoryMemo,
  WorkingMemorySource,
} from '@/types';

export function resolveStickyNoteColor(memo: Pick<WorkingMemoryMemo, 'color' | 'category'>): StickyNoteColor {
  if (memo.color) return memo.color;
  switch (memo.category) {
    case 'directive':
      return 'pink';
    case 'festival':
      return 'mint';
    case 'audit':
      return 'sky';
    default:
      return 'yellow';
  }
}

export interface WorkingMemoryCategoryMeta {
  id: WorkingMemoryCategory;
  label: string;
  shortLabel: string;
  badgeClass: string;
  postItClass: string;
  accentBarClass: string;
}

export const WORKING_MEMORY_ISSUE_SEVERITY_META: Record<
  WorkingMemoryIssueSeverity,
  { label: string; badgeClass: string }
> = {
  critical: {
    label: '치명',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
  },
  high: {
    label: '높음',
    badgeClass: 'bg-amber-100 text-amber-950 border-amber-300',
  },
  medium: {
    label: '보통',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  low: {
    label: '낮음',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export const WORKING_MEMORY_CATEGORIES: Record<WorkingMemoryCategory, WorkingMemoryCategoryMeta> = {
  budget: {
    id: 'budget',
    label: '[2027 예산편성]',
    shortLabel: '2027 예산편성',
    badgeClass:
      'bg-indigo-50 text-indigo-800 border-indigo-200',
    postItClass:
      'bg-amber-50/75 border-amber-200/90',
    accentBarClass: 'bg-indigo-600',
  },
  directive: {
    id: 'directive',
    label: '[팀장님 지시]',
    shortLabel: '팀장님 지시',
    badgeClass:
      'bg-amber-100 text-amber-900 border-amber-300',
    postItClass:
      'bg-amber-100/65 border-amber-300/90',
    accentBarClass: 'bg-amber-600',
  },
  audit: {
    id: 'audit',
    label: '[행정감사]',
    shortLabel: '행정감사',
    badgeClass:
      'bg-rose-50 text-rose-800 border-rose-200',
    postItClass:
      'bg-rose-50/65 border-rose-200/90',
    accentBarClass: 'bg-rose-600',
  },
  festival: {
    id: 'festival',
    label: '[양재천 행사]',
    shortLabel: '양재천 행사',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200',
    postItClass:
      'bg-emerald-50/65 border-emerald-200/90',
    accentBarClass: 'bg-emerald-600',
  },
  issue_log: {
    id: 'issue_log',
    label: '[이슈로그]',
    shortLabel: '이슈로그',
    badgeClass:
      'bg-violet-50 text-violet-800 border-violet-200',
    postItClass:
      'bg-violet-50/65 border-violet-200/90',
    accentBarClass: 'bg-violet-600',
  },
  general: {
    id: 'general',
    label: '[일반 메모]',
    shortLabel: '일반 메모',
    badgeClass:
      'bg-slate-100 text-slate-700 border-slate-200',
    postItClass:
      'bg-slate-50/90 border-slate-200/90',
    accentBarClass: 'bg-slate-500',
  },
};

export const WORKING_MEMORY_CATEGORY_LIST: WorkingMemoryCategoryMeta[] = [
  WORKING_MEMORY_CATEGORIES.budget,
  WORKING_MEMORY_CATEGORIES.directive,
  WORKING_MEMORY_CATEGORIES.audit,
  WORKING_MEMORY_CATEGORIES.festival,
  WORKING_MEMORY_CATEGORIES.issue_log,
  WORKING_MEMORY_CATEGORIES.general,
];

const CATEGORY_KEYWORDS: Record<Exclude<WorkingMemoryCategory, 'general'>, string[]> = {
  budget: [
    '예산',
    '본예산',
    '가내시',
    '추경',
    '증액',
    '감액',
    '편성',
    '산출내역',
    '산출기초',
    '사업설명서',
    '소요재원',
    '기금',
    '시비',
    '구비',
    '일상경비',
    '사무관리비',
    '행사운영비',
    '기간제',
    '인건비',
    '목·세목',
    '세목',
    '201-01',
    '201-02',
    '201-03',
    '101-04',
    '301-',
    '405-',
    '천원',
    '천 원',
    '만원',
    '만 원',
    '억원',
    '억 원',
    '2027',
  ],
  directive: [
    '팀장님',
    '팀장',
    '과장님',
    '과장',
    '소장님',
    '소장',
    '국장님',
    '부구청장',
    '구청장',
    '지시',
    '지시사항',
    '당부',
    '구두보고',
    '메모보고',
    '컨펌',
    '검토지시',
    '보완지시',
  ],
  audit: [
    '행정감사',
    '행감',
    '감사',
    '구의회',
    '시의회',
    '의원',
    '요구자료',
    '질의',
    '답변서',
    '예상질의',
    '지적사항',
    '시정조치',
    '감사자료',
  ],
  festival: [
    '양재천',
    '페스티벌',
    '건강부스',
    '부스',
    '개막식',
    '식순',
    '걷기',
    '몽골텐트',
    '국민의례',
    '현수막',
    '리플릿',
    '영동4교',
  ],
  issue_log: [
    '[이슈로그]',
    '이슈로그',
    '근접원인',
    '근본원인',
    '기계개선',
    '재발방지',
    '가드레일',
    '이중실행',
    'Double-do',
    'Risk of Ruin',
    '파산위험',
    '원인진단',
    'RP:',
    'RP=',
  ],
};

function parseIssueSeverity(raw?: string): WorkingMemoryIssueSeverity | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (/^(?:치명|긴급|최상|critical|p0)$/.test(v)) return 'critical';
  if (/^(?:상|높음|high|p1)$/.test(v)) return 'high';
  if (/^(?:중|보통|medium|p2)$/.test(v)) return 'medium';
  if (/^(?:하|낮음|low|p3)$/.test(v)) return 'low';
  return undefined;
}

/**
 * Extracts Dalio Principles Issue Log metadata from 1-line or pipe-delimited memo text.
 * Canonical format: "[이슈로그] RP:총괄주무관 | 근접:수기누락 | 근본:단일경로 의존 | 개선:이중실행 스크립트 | 위험:상"
 */
export function extractIssueMeta(text: string): WorkingMemoryIssueMeta | undefined {
  if (!text || !text.trim()) return undefined;

  const stopAhead =
    '(?=\\s*(?:\\||\\n|$|(?:RP|책임당사자|책임|근접원인|근접|근본원인|근본|기계개선|재발방지|가드레일|개선|위험등급|위험|등급|심각도)\\s*[:=]))';

  const extractField = (labels: string[]): string | undefined => {
    const pattern = new RegExp(
      `(?:^|[\\s|\\[\\(])(?:${labels.join('|')})\\s*[:=]\\s*([^|\\n]+?)${stopAhead}`,
      'i'
    );
    const match = text.match(pattern);
    const val = match?.[1]?.trim();
    return val ? val : undefined;
  };

  const responsibleParty = extractField(['RP', '책임당사자', '책임']);
  const proximateCause = extractField(['근접원인', '근접']);
  const rootCause = extractField(['근본원인', '근본']);
  const machineFix = extractField(['기계개선', '재발방지', '가드레일', '개선']);
  const severity = parseIssueSeverity(extractField(['위험등급', '위험', '등급', '심각도']));
  const doubleDoRequired = /(?:이중\s*실행|double-?do)/i.test(text) ? true : undefined;

  if (
    !responsibleParty &&
    !proximateCause &&
    !rootCause &&
    !machineFix &&
    !severity &&
    !doubleDoRequired
  ) {
    return undefined;
  }

  const meta: WorkingMemoryIssueMeta = {};
  if (severity) meta.severity = severity;
  if (responsibleParty) meta.responsibleParty = responsibleParty;
  if (proximateCause) meta.proximateCause = proximateCause;
  if (rootCause) meta.rootCause = rootCause;
  if (machineFix) meta.machineFix = machineFix;
  if (doubleDoRequired) meta.doubleDoRequired = true;
  return meta;
}

/**
 * Extracts numeric/budget transition or figure highlights from administrative memo text.
 * Examples:
 * - "기존 6,500만 원 → 변경 7,800만 원" => "6,500만 원 → 7,800만 원"
 * - "5개 동 → 6개 동" => "5개 동 → 6개 동"
 * - "7,800만 원 증액" => "7,800만 원 증액"
 */
export function extractNumericHighlight(text: string): string | undefined {
  if (!text || !text.trim()) return undefined;

  const unitPattern =
    '(?:억\\s*원|억|천만\\s*원|천만|백만\\s*원|백만|만\\s*원|만원|천\\s*원|천원|원|%|개\\s*동|동|개\\s*부스|부스|명|개|곳|건|회|종)';

  // 1. Transition pattern (A → B, A -> B, A => B) — supports both unit-suffixed and unitless transitions (e.g. "6500 -> 7800")
  const transitionRegex = new RegExp(
    `(?:기존\\s*|당초\\s*)?(\\d[\\d,.]*\\s*${unitPattern}?)\\s*(?:→|->|=>|~>)\\s*(?:변경\\s*|조정\\s*)?(\\d[\\d,.]*\\s*${unitPattern}?)`,
    'i'
  );
  const transitionMatch = text.match(transitionRegex);
  if (transitionMatch) {
    const left = transitionMatch[1].trim().replace(/\s+/g, ' ');
    const right = transitionMatch[2].trim().replace(/\s+/g, ' ');
    return `${left} → ${right}`;
  }

  // 2. Single amount/quantity with unit and optional action suffix (증액, 감액, 반영, 확대, 축소, 추가, 편성, 조정)
  const singleAmountRegex = new RegExp(
    `([+-]?\\d[\\d,.]*\\s*${unitPattern})(?:\\s*(증액|감액|반영|확대|축소|추가|편성|조정|삭감|교부))?`,
    'i'
  );
  const singleMatch = text.match(singleAmountRegex);
  if (singleMatch) {
    const numPart = singleMatch[1].trim().replace(/\s+/g, ' ');
    const actionPart = singleMatch[2]?.trim();
    return actionPart ? `${numPart} ${actionPart}` : numPart;
  }

  // 3. Unitless number with explicit budget delta action (e.g. "7,800 증액")
  const unitlessDeltaMatch = text.match(/(?:^|[^\d/.-])([+-]?\d[\d,]*)\s*(증액|감액|삭감)/);
  if (unitlessDeltaMatch) {
    return `${unitlessDeltaMatch[1].trim()} ${unitlessDeltaMatch[2].trim()}`;
  }

  return undefined;
}

/**
 * Extracts and normalizes date references in administrative format ("9. 21.").
 * Supports Korean dates ("9월 21일"), ISO dates ("2026-09-21"), slash/dot dates ("9/21", "10. 22."),
 * and multi-date strings ("9/21 가내시, 10/15 최종확정" => "9. 21. · 10. 15.", "9/21~9/28" => "9. 21.~9. 28.").
 * Strictly ignores e-Hojo statItem codes ("201-01", "101-04") and decimal quantities ("1.5억", "3.5%").
 */
export function extractDateHighlight(text: string): string | undefined {
  if (!text || !text.trim()) return undefined;

  interface DateCandidate {
    index: number;
    endIndex: number;
    formatted: string;
  }

  const candidates: DateCandidate[] = [];
  const decimalUnitAhead =
    /^\s*(?:억|천만|백만|만|천|백|원|%|배|점|시간|분|초|km|m|cm|mm|kg|g|톤|t|L|동|부스|명|개|곳|건|회|종|세|살|층|호)/i;

  // 1. Korean explicit month/day: "9월 21일", "2026년 10월 5일"
  const koreanDateRegex = /(?:20\d{2}\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
  let m: RegExpExecArray | null;
  while ((m = koreanDateRegex.exec(text)) !== null) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      candidates.push({
        index: m.index,
        endIndex: m.index + m[0].length,
        formatted: `${month}. ${day}.`,
      });
    }
  }

  // 2. ISO / 4-digit year prefixed dates: "2026-09-21", "2026. 9. 21.", "2026/09/21"
  const isoDateRegex = /20\d{2}\s*([-./])\s*(\d{1,2})\s*\1\s*(\d{1,2})(?:\.)?(?!\d)/g;
  while ((m = isoDateRegex.exec(text)) !== null) {
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      candidates.push({
        index: m.index,
        endIndex: m.index + m[0].length,
        formatted: `${month}. ${day}.`,
      });
    }
  }

  // 3. Slash, dot, or hyphen month/day: "9/21", "10. 22.", "9-21" (excluding 3-digit statItem codes like 201-01 and decimals like 1.5억)
  const shortDateRegex = /(?:^|([^\d-]))(\d{1,2})(\s*(?:\/|\.|-)\s*)(\d{1,2})(\.)?(?!\d)/g;
  while ((m = shortDateRegex.exec(text)) !== null) {
    const prefixChar = m[1] || '';
    const matchStart = m.index + prefixChar.length;
    const matchEnd = m.index + m[0].length;

    // Skip if already covered by an earlier Korean or ISO year-prefixed date match
    if (candidates.some((c) => matchStart >= c.index && matchStart < c.endIndex)) {
      continue;
    }

    const sepRaw = m[3];
    const hasTrailingDot = Boolean(m[5]);
    const afterText = text.slice(matchEnd);

    // If dot separator is used without trailing dot and without whitespace (e.g. "1.5" in "1.5억" or "3.5%"),
    // reject if followed by a unit or if it looks like a plain decimal number
    if (sepRaw.includes('.')) {
      if (decimalUnitAhead.test(afterText)) {
        continue;
      }
      if (!hasTrailingDot && !/\s/.test(sepRaw)) {
        continue;
      }
    }

    const month = parseInt(m[2], 10);
    const day = parseInt(m[4], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      candidates.push({
        index: matchStart,
        endIndex: matchEnd,
        formatted: `${month}. ${day}.`,
      });
    }
  }

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => a.index - b.index);
  const uniqueDates: DateCandidate[] = [];
  for (const c of candidates) {
    if (
      !uniqueDates.some(
        (u) => u.formatted === c.formatted || (c.index >= u.index && c.index < u.endIndex)
      )
    ) {
      uniqueDates.push(c);
    }
  }

  if (uniqueDates.length === 1) {
    return uniqueDates[0].formatted;
  }

  const betweenFirstAndSecond = text.slice(uniqueDates[0].endIndex, uniqueDates[1].index);
  if (/^\s*~\s*$/.test(betweenFirstAndSecond)) {
    return `${uniqueDates[0].formatted}~${uniqueDates[1].formatted}`;
  }

  return `${uniqueDates[0].formatted} · ${uniqueDates[1].formatted}`;
}

/**
 * Splits raw input into individual memo lines for multi-line paste batch capture.
 */
export function splitWorkingMemoryLines(rawText: string): string[] {
  if (!rawText) return [];
  const rawLines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rawLines.length <= 1) {
    return rawLines;
  }

  return rawLines
    .map((line) => line.replace(/^(?:[-•*❍▢▣■󰏚]|\d+[.)])\s+/, '').trim())
    .filter((line) => line.length > 0);
}

/**
 * Generates a monotonically increasing ISO timestamp that is always strictly greater than
 * any previous timestamps on the same memo, preventing causal inversions when device clocks are skewed.
 */
export function nextMonotonicIso(
  prevIso?: string,
  secondPrevIso?: string,
  nowMs: number = Date.now()
): string {
  const p1 = prevIso ? Date.parse(prevIso) || 0 : 0;
  const p2 = secondPrevIso ? Date.parse(secondPrevIso) || 0 : 0;
  const maxPrev = Math.max(p1, p2);
  return new Date(Math.max(nowMs, maxPrev + 1)).toISOString();
}

export interface ParsedWorkingMemoryResult {
  category: WorkingMemoryCategory;
  tags: string[];
  numericHighlight?: string;
  dateHighlight?: string;
  issueMeta?: WorkingMemoryIssueMeta;
}

/**
 * Automatically classifies a 1-line memo into a primary category, multi-context tags,
 * numeric/budget change highlight, date highlight, and structured Issue Log metadata.
 */
export function parseWorkingMemoryInput(
  rawText: string,
  explicitCategory?: WorkingMemoryCategory
): ParsedWorkingMemoryResult {
  const text = (rawText || '').trim();
  const numericHighlight = extractNumericHighlight(text);
  const dateHighlight = extractDateHighlight(text);
  const issueMeta = extractIssueMeta(text);

  const scores: Record<Exclude<WorkingMemoryCategory, 'general'>, number> = {
    budget: 0,
    directive: 0,
    audit: 0,
    festival: 0,
    issue_log: 0,
  };

  const matchedCategories = new Set<WorkingMemoryCategory>();

  (Object.keys(CATEGORY_KEYWORDS) as Array<Exclude<WorkingMemoryCategory, 'general'>>).forEach(
    (cat) => {
      for (const kw of CATEGORY_KEYWORDS[cat]) {
        if (text.includes(kw)) {
          // Strong domain anchors get weight 2
          const isStrong =
            kw === '예산' ||
            kw === '본예산' ||
            kw === '가내시' ||
            kw === '증액' ||
            kw === '감액' ||
            kw === '행정감사' ||
            kw === '행감' ||
            kw === '요구자료' ||
            kw === '양재천' ||
            kw === '페스티벌' ||
            kw === '팀장님' ||
            kw === '과장님' ||
            kw === '소장님' ||
            kw === '지시' ||
            kw === '[이슈로그]' ||
            kw === '이슈로그' ||
            kw === '근접원인' ||
            kw === '근본원인' ||
            kw === '기계개선' ||
            kw === '재발방지';
          scores[cat] += isStrong ? 2 : 1;
          matchedCategories.add(cat);
        }
      }
    }
  );

  if (issueMeta) {
    const fieldHits = [
      issueMeta.responsibleParty,
      issueMeta.proximateCause,
      issueMeta.rootCause,
      issueMeta.machineFix,
      issueMeta.severity,
    ].filter(Boolean).length;
    scores.issue_log += Math.max(2, fieldHits * 2);
    matchedCategories.add('issue_log');
  }

  // If numeric highlight contains currency units (원/만원/천원/억원), boost budget score
  if (numericHighlight && /(?:원|만원|천원|억원)/.test(numericHighlight)) {
    scores.budget += 2;
    matchedCategories.add('budget');
  }

  let primaryCategory: WorkingMemoryCategory = explicitCategory || 'general';

  if (!explicitCategory) {
    const orderedCandidates: Array<Exclude<WorkingMemoryCategory, 'general'>> = [
      'issue_log',
      'budget',
      'directive',
      'audit',
      'festival',
    ];
    let bestCat: WorkingMemoryCategory = 'general';
    let bestScore = 0;

    for (const cat of orderedCandidates) {
      if (scores[cat] > bestScore) {
        bestScore = scores[cat];
        bestCat = cat;
      }
    }
    primaryCategory = bestCat;
  } else {
    matchedCategories.add(explicitCategory);
  }

  const tags: string[] = [];
  const primaryLabel = WORKING_MEMORY_CATEGORIES[primaryCategory].label;
  tags.push(primaryLabel);

  for (const cat of ['issue_log', 'budget', 'directive', 'audit', 'festival'] as const) {
    if (matchedCategories.has(cat)) {
      const label = WORKING_MEMORY_CATEGORIES[cat].label;
      if (!tags.includes(label)) {
        tags.push(label);
      }
    }
  }

  return {
    category: primaryCategory,
    tags,
    numericHighlight,
    dateHighlight,
    issueMeta,
  };
}

/**
 * Builds a complete WorkingMemoryMemo record from raw text.
 */
export function createWorkingMemoryMemo(params: {
  content: string;
  explicitCategory?: WorkingMemoryCategory;
  source?: WorkingMemorySource;
  color?: StickyNoteColor;
  pinned?: boolean;
  id?: string;
  nowIso?: string;
}): WorkingMemoryMemo {
  const now = params.nowIso || new Date().toISOString();
  const parsed = parseWorkingMemoryInput(params.content, params.explicitCategory);

  const memo: WorkingMemoryMemo = {
    id: params.id || `wm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    content: params.content.trim(),
    category: parsed.category,
    tags: parsed.tags,
    numericHighlight: parsed.numericHighlight,
    dateHighlight: parsed.dateHighlight,
    status: 'pending',
    pinned:
      params.pinned !== undefined
        ? params.pinned
        : parsed.category === 'budget' ||
          parsed.category === 'directive' ||
          parsed.category === 'issue_log',
    source: params.source || 'pc',
    createdAt: now,
    updatedAt: now,
  };
  if (params.color) {
    memo.color = params.color;
  }
  if (parsed.issueMeta) {
    memo.issueMeta = parsed.issueMeta;
  }
  return memo;
}

/**
 * Splits single-line or multi-line pasted text into one or more WorkingMemoryMemo records.
 */
export function createWorkingMemoryMemosFromText(params: {
  content: string;
  explicitCategory?: WorkingMemoryCategory;
  source?: WorkingMemorySource;
  color?: StickyNoteColor;
  pinned?: boolean;
  nowIso?: string;
}): WorkingMemoryMemo[] {
  const lines = splitWorkingMemoryLines(params.content);
  if (lines.length === 0) return [];

  const baseMs = params.nowIso ? Date.parse(params.nowIso) || Date.now() : Date.now();
  return lines.map((line, idx) =>
    createWorkingMemoryMemo({
      content: line,
      explicitCategory: params.explicitCategory,
      source: params.source,
      color: params.color,
      pinned: params.pinned,
      nowIso: new Date(baseMs + idx).toISOString(),
    })
  );
}

/**
 * Merges base and incoming WorkingMemoryMemo arrays deterministically while:
 * 1. Filtering out deleted memo IDs (Tombstone anti-zombie protection per Rule A.2).
 * 2. Resolving concurrent edits to the same memo ID even under client/server clock skew.
 */
export function mergeWorkingMemoryMemos(
  baseMemos: WorkingMemoryMemo[],
  incomingMemos: WorkingMemoryMemo[],
  deletedIds?: Iterable<string>
): WorkingMemoryMemo[] {
  const tombstoneSet = new Set<string>(deletedIds ? Array.from(deletedIds) : []);
  const map = new Map<string, WorkingMemoryMemo>();

  for (const m of baseMemos) {
    if (m && m.id && !tombstoneSet.has(m.id)) {
      map.set(m.id, m);
    }
  }

  for (const incoming of incomingMemos) {
    if (!incoming || !incoming.id || tombstoneSet.has(incoming.id)) continue;
    const existing = map.get(incoming.id);
    if (!existing) {
      map.set(incoming.id, incoming);
      continue;
    }

    const existingUpdatedMs = Date.parse(existing.updatedAt || existing.createdAt || '') || 0;
    const incomingUpdatedMs = Date.parse(incoming.updatedAt || incoming.createdAt || '') || 0;
    const existingCreatedMs = Date.parse(existing.createdAt || '') || 0;
    const incomingCreatedMs = Date.parse(incoming.createdAt || '') || 0;

    // Clock-skew safeguard: if one side marked a newly created memo as 'reflected' while the other side
    // still holds the untouched initial 'pending' state (updatedAt === createdAt), preserve the 'reflected' transition
    // even if the reflecting device's wall clock was behind the creating device's wall clock.
    const existingIsUntouchedPending =
      existing.status === 'pending' &&
      !existing.reflectedAt &&
      existingUpdatedMs === existingCreatedMs;
    const incomingIsUntouchedPending =
      incoming.status === 'pending' &&
      !incoming.reflectedAt &&
      incomingUpdatedMs === incomingCreatedMs;

    if (incoming.status === 'reflected' && existingIsUntouchedPending) {
      const safeUpdatedAt = nextMonotonicIso(existing.updatedAt, incoming.updatedAt);
      map.set(incoming.id, { ...incoming, updatedAt: safeUpdatedAt });
      continue;
    }

    if (existing.status === 'reflected' && incomingIsUntouchedPending) {
      const safeUpdatedAt = nextMonotonicIso(existing.updatedAt, incoming.updatedAt);
      map.set(existing.id, { ...existing, updatedAt: safeUpdatedAt });
      continue;
    }

    if (incomingUpdatedMs > existingUpdatedMs) {
      map.set(incoming.id, incoming);
    } else if (incomingUpdatedMs === existingUpdatedMs) {
      // Deterministic tie-breaker when timestamps are identical
      const preferIncoming =
        (incoming.status === 'reflected' && existing.status !== 'reflected') ||
        (incoming.status === existing.status &&
          (incoming.content || '').length >= (existing.content || '').length);
      const winner = preferIncoming ? incoming : existing;
      const mergedTags = Array.from(
        new Set([...(existing.tags || []), ...(incoming.tags || [])])
      );
      map.set(incoming.id, {
        ...winner,
        tags: mergedTags.length > 0 ? mergedTags : winner.tags,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

export type WorkingMemoryContextModule =
  | 'workspace'
  | 'simulator'
  | 'festival'
  | 'project'
  | 'dashboard';

/**
 * Filters pending working-memory memos relevant to a specific module view
 * so they can be auto-pinned at the top of that view until marked reflected.
 */
export function getContextRelevantMemos(
  memos: WorkingMemoryMemo[],
  contextModule: WorkingMemoryContextModule
): WorkingMemoryMemo[] {
  const pending = memos.filter((m) => m.status === 'pending');

  const filtered = pending.filter((memo) => {
    const tags = memo.tags || [];
    const isBudget =
      memo.category === 'budget' ||
      tags.includes('[2027 예산편성]') ||
      tags.includes('2027 예산편성');
    const isDirective =
      memo.category === 'directive' ||
      tags.includes('[팀장님 지시]') ||
      tags.includes('팀장님 지시');
    const isAudit =
      memo.category === 'audit' || tags.includes('[행정감사]') || tags.includes('행정감사');
    const isFestival =
      memo.category === 'festival' ||
      tags.includes('[양재천 행사]') ||
      tags.includes('양재천 행사');
    const isIssueLog =
      memo.category === 'issue_log' ||
      tags.includes('[이슈로그]') ||
      tags.includes('이슈로그');

    switch (contextModule) {
      case 'workspace':
      case 'simulator':
        return isBudget || isDirective;
      case 'festival':
        return isFestival || isDirective;
      case 'project':
        return isAudit || isDirective || isBudget || isIssueLog;
      case 'dashboard':
      default:
        return true;
    }
  });

  return [...filtered].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

export const DEFAULT_WORKING_MEMORY_MEMOS: WorkingMemoryMemo[] = [
  {
    id: 'wm-seed-budget-2027',
    content:
      '9/21 통합건강증진사업 가내시 메모보고: 2027 건강생활실천사업 본예산 증액 반영 필요 (기존 6,500만 원 → 변경 7,800만 원)',
    category: 'budget',
    tags: ['[2027 예산편성]', '[팀장님 지시]'],
    numericHighlight: '6,500만 원 → 7,800만 원',
    dateHighlight: '9. 21.',
    status: 'pending',
    pinned: true,
    source: 'pc',
    createdAt: '2026-09-21T14:20:00.000Z',
    updatedAt: '2026-09-21T14:20:00.000Z',
  },
  {
    id: 'wm-seed-directive-audit',
    content:
      '팀장님 지시: 2026 행정사무감사 대비 걷기 마일리지 자치구 비교표 및 예산 집행률 증빙 최신화 (기존 5개 동 → 변경 6개 동 확대 근거 명시)',
    category: 'directive',
    tags: ['[팀장님 지시]', '[행정감사]', '[2027 예산편성]'],
    numericHighlight: '5개 동 → 6개 동',
    dateHighlight: undefined,
    status: 'pending',
    pinned: true,
    source: 'mobile',
    createdAt: '2026-10-18T09:30:00.000Z',
    updatedAt: '2026-10-18T09:30:00.000Z',
  },
  {
    id: 'wm-seed-audit-qna',
    content:
      '10/22 구의회 행정감사 요구자료 제출 전 일반지출·일상경비(daily_expense) 이중차감 0건 검증표 첨부 확인',
    category: 'audit',
    tags: ['[행정감사]', '[2027 예산편성]'],
    numericHighlight: '0건',
    dateHighlight: '10. 22.',
    status: 'pending',
    pinned: false,
    source: 'pc',
    createdAt: '2026-10-22T11:15:00.000Z',
    updatedAt: '2026-10-22T11:15:00.000Z',
  },
  {
    id: 'wm-seed-festival-yangjae',
    content:
      '양재천 건강 페스티벌 부스 배치도 최종본 개막식 국민의례 약식절차 1(애국가 1절+묵념) 사회자 대본 반영 확인',
    category: 'festival',
    tags: ['[양재천 행사]'],
    numericHighlight: undefined,
    dateHighlight: undefined,
    status: 'reflected',
    pinned: false,
    source: 'mobile',
    reflectedAt: '2026-10-20T17:00:00.000Z',
    createdAt: '2026-10-15T16:40:00.000Z',
    updatedAt: '2026-10-20T17:00:00.000Z',
  },
];
