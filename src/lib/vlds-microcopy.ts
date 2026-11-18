/**
 * VLDS (VITAL Localhost Design System) — Zero-Verbosity & Particle-Free Microcopy Contract
 *
 * Enforces scannable, telegraphic Korean UI microcopy across VITAL:
 * 1. Noun-phrase & metric-first (no explanatory prose endings like ~합니다/~됩니다/~보세요).
 * 2. Particle-free telegraphic composition (replace 을/를/에서/으로/와/과/및 with '·', '→', '-').
 * 3. Strict per-role character budgets to guarantee <0.5s visual comprehension.
 */

export type VldsCopyRole = 'title' | 'subtitle' | 'cta' | 'helper' | 'placeholder';

export const VLDS_COPY_BUDGET: Record<VldsCopyRole, number> = {
  title: 18,
  subtitle: 36,
  cta: 12,
  helper: 32,
  placeholder: 42,
};

export const FORBIDDEN_PROSE_ENDINGS_RE =
  /(?:합니다|입니다|됩니다|있습니다|없습니다|했습니다|됐습니다|되었습니다|바랍니다|주십시오|십시오|하세요|주세요|보세요|하시겠습니까|중입니다)(?:[.!?…]+|\s*\([^)]*\))?$/u;

export const FORBIDDEN_INLINE_PROSE_RE =
  /(?:합니다|입니다|됩니다|있습니다|없습니다|했습니다|하세요|주세요|보세요|바랍니다|주십시오)[.!?]\s+[가-힣A-Za-z0-9\[]/u;

const NON_CONJUNCTIVE_GWA_STEMS = new Set([
  '행정',
  '증진',
  '의약',
  '위생',
  '재무',
  '기획',
  '체육',
  '건축',
  '주택',
  '환경',
  '안전',
  '보건',
  '감사',
  '세무',
  '민원',
  '교통',
  '문화',
  '경제',
  '복지',
  '총무',
  '홍보',
]);

const NON_CONJUNCTIVE_GWA_NOUNS_RE =
  /(?:결과|성과|경과|인과|분과|통과|일과|학과|초과|효과|부과|교과|내과|외과|치과|안과|피부과)$/u;

function hasHangulBatchim(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function hasConjunctiveGwaParticle(text: string): boolean {
  const re = /([가-힣]{2,})과(?=\s+[가-힣]{2,})/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const stem = match[1];
    const fullToken = `${stem}과`;
    if (NON_CONJUNCTIVE_GWA_NOUNS_RE.test(fullToken)) {
      continue;
    }
    const lastTwo = stem.slice(-2);
    if (NON_CONJUNCTIVE_GWA_STEMS.has(lastTwo)) {
      continue;
    }
    const lastChar = stem[stem.length - 1];
    // Korean conjunctive particle '과' only attaches after a final consonant (받침); vowel stems take '와'.
    if (!hasHangulBatchim(lastChar)) {
      continue;
    }
    return true;
  }
  return false;
}

export const UNNECESSARY_PARTICLE_PATTERNS: ReadonlyArray<{
  id: string;
  label: string;
  pattern: RegExp;
  testFn?: (text: string) => boolean;
}> = [
  {
    id: 'object-particle',
    label: '목적격 조사(을/를) 사용',
    pattern:
      /(?<=[가-힣0-9)])(?<!^(?:가|마|노|갑|고)|[\s·(](?:가|마|노|갑|고))을\s+[가-힣]|[가-힣0-9)]+를\s+[가-힣]/u,
  },
  {
    id: 'locative-instrumental-particle',
    label: '부사격 조사(에서/으로/로 이동) 사용',
    pattern: /[가-힣0-9)]+(?:에서|으로)\s+[가-힣]|[가-힣0-9)]+로\s+(?:이동|전환)(?:\s|$|\()/u,
  },
  {
    id: 'conjunctive-particle',
    label: '접속 조사(와/과/및/그리고) 나열 — 가운뎃점(·) 권장',
    pattern: /[가-힣0-9)]+\s+및\s+[가-힣]|(?<!기|치와)[가-힣]{2,}와\s+[가-힣]{2,}|[가-힣0-9)]+,?\s+그리고\s+[가-힣]/u,
    testFn: (text: string) =>
      /[가-힣0-9)]+\s+및\s+[가-힣]|(?<!기|치와)[가-힣]{2,}와\s+[가-힣]{2,}|[가-힣0-9)]+,?\s+그리고\s+[가-힣]/u.test(
        text
      ) || hasConjunctiveGwaParticle(text),
  },
  {
    id: 'bureaucratic-particle-chain',
    label: '관료적 조사구(에 대한/에 따른/을 위해/을 통해) 사용',
    pattern:
      /[가-힣0-9)]+(?:에\s+대한|에\s+따른|에\s+의거|을\s+위해|를\s+위해|을\s+통해|를\s+통해|에\s+일치하는|과\s+일치하는|와\s+일치하는)\s+[가-힣]/u,
  },
  {
    id: 'subject-topic-prose-particle',
    label: '서술형 주격·보조사(이/가/은/는 + 서술어) 사용',
    pattern:
      /[가-힣0-9)]+(?:이|가|은|는)\s+(?:없습니다|있습니다|필요합니다|부족합니다|발생합니다|다릅니다|일치하지|아닙니다|빠를|늦어야)/u,
  },
];

export const REDUNDANT_ENGLISH_GLOSS_RE = /\([A-Z][a-z]{2,}(?:[\s&-]+[A-Za-z-]+)*\)/u;

export const FORBIDDEN_LEGACY_JARGON: ReadonlyArray<string> = [
  '마인드맵 공약제안',
  '사이버네틱스 환류',
  'Commitment Balance Engine',
  '(Working Memory Post-it)',
  '초개인화 행정 인텔리전스',
  '하이브리드 공공 인텔리전스',
  '다중 필터링 & 실시간 대조 시스템',
];

export interface VldsCopyAuditResult {
  valid: boolean;
  role: VldsCopyRole;
  length: number;
  maxChars: number;
  violations: string[];
}

/**
 * Audits a UI string against VLDS Zero-Verbosity & Particle-Free rules.
 * Empty strings are valid because omitting redundant subtitles/helpers is preferred.
 */
export function auditVldsCopy(text: string | null | undefined, role: VldsCopyRole): VldsCopyAuditResult {
  const normalized = (text ?? '').trim();
  const maxChars = VLDS_COPY_BUDGET[role];

  if (!normalized) {
    return {
      valid: true,
      role,
      length: 0,
      maxChars,
      violations: [],
    };
  }

  const violations: string[] = [];

  if (normalized.length > maxChars) {
    violations.push(`글자 수 초과 (${normalized.length}자 > 상한 ${maxChars}자)`);
  }

  if (FORBIDDEN_PROSE_ENDINGS_RE.test(normalized) || FORBIDDEN_INLINE_PROSE_RE.test(normalized)) {
    violations.push('서술형 문장 종결어미 사용 금지 (명사구·수치 종결 필수)');
  }

  for (const rule of UNNECESSARY_PARTICLE_PATTERNS) {
    const matched = rule.testFn ? rule.testFn(normalized) : rule.pattern.test(normalized);
    if (matched) {
      violations.push(rule.label);
    }
  }

  if ((role === 'title' || role === 'cta') && REDUNDANT_ENGLISH_GLOSS_RE.test(normalized)) {
    violations.push('중복 영문 병기 금지 (한글 명사구 단독 표기)');
  }

  for (const jargon of FORBIDDEN_LEGACY_JARGON) {
    if (normalized.includes(jargon)) {
      violations.push(`금지 레거시·수식어 포함: "${jargon}"`);
    }
  }

  return {
    valid: violations.length === 0,
    role,
    length: normalized.length,
    maxChars,
    violations,
  };
}

/**
 * Joins non-empty telegraphic tokens with middle-dot (' · ') without particles.
 */
export function joinTelegraphic(
  tokens: ReadonlyArray<string | null | undefined | false>,
  separator = ' · '
): string {
  return tokens
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => t.length > 0)
    .join(separator);
}
