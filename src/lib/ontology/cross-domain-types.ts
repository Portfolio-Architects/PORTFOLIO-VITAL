/**
 * VITAL Work & Wealth Architecture — 6-Domain Cross-Join Data Model & Types
 * Module: src/lib/ontology/cross-domain-types.ts
 * Standards: Rule O (Working Surface Immunity), Rule R (Zero-Error Budget Math),
 *            Rule Q (PIPA Phone/Name Masking), Rule B (Loud Failures with .catch() Fallbacks)
 */

import { z } from 'zod';
import {
  AdminPolicyEntity,
  AdminOutcomeEntity,
  AdminAuditEntity,
  AdminBudgetPlanEntity,
  AdminWeeklyWorkEntity,
  AdminAuditGap,
} from './admin-types';
import { ArchiveItem } from '@/types/archive';
import { WorkingMemoryMemo } from '@/types';

// ============================================================================
// 1. Canonical Project Metadata & Constants
// ============================================================================

export const CANONICAL_PROJECT_KEYS = [
  '01_양재천_페스티벌',
  '02_사회적_처방_신체활동',
  '03_헬스체크업_바른자세',
  '04_서울체력장_AI메디헬스_메디런',
  '05_어린이_아이뛰움',
  '06_비만예방_합동캠페인',
  '07_손목닥터9988_스마트헬스',
  '08_보건소_기능유지_청사관리',
  '신체활동_건강생활실천',
] as const;

export type CanonicalProjectKey = (typeof CANONICAL_PROJECT_KEYS)[number];

export interface CanonicalProjectMeta {
  projectId: string;
  projectKey: CanonicalProjectKey;
  projectName: string;
  department: string;
  team: string;
  color: string;
  description: string;
}

export const CANONICAL_PROJECT_METADATA: Record<CanonicalProjectKey, CanonicalProjectMeta> = {
  '01_양재천_페스티벌': {
    projectId: 'hchps-p1',
    projectKey: '01_양재천_페스티벌',
    projectName: '01 양재천 건강페스티벌',
    department: '보건행정과',
    team: '건강증진팀',
    color: '#14b8a6',
    description: '강남구보건소와 함께하는 건강 걷기, 찾아가는 보건소 체험 및 민간 협력 부스 운영 페스티벌',
  },
  '02_사회적_처방_신체활동': {
    projectId: 'hchps-p2',
    projectKey: '02_사회적_처방_신체활동',
    projectName: '02 사회적 처방 맞춤형 신체활동(공공PT)',
    department: '보건행정과',
    team: '건강증진팀',
    color: '#10b981',
    description: '취약계층 대상 2:1 또는 4:1 개별 맞춤형 운동 지도 및 자가 운동 실천 계획 수립 지원',
  },
  '03_헬스체크업_바른자세': {
    projectId: 'hchps-p3',
    projectKey: '03_헬스체크업_바른자세',
    projectName: '03 헬스체크업 및 바른자세 체형교정',
    department: '보건행정과',
    team: '건강증진팀',
    color: '#f59e0b',
    description: '체성분·체형 측정 빅데이터 기반 맞춤 운동처방 및 초·중·고 척추측만증 조기검진',
  },
  '04_서울체력장_AI메디헬스_메디런': {
    projectId: 'hchps-p7',
    projectKey: '04_서울체력장_AI메디헬스_메디런',
    projectName: '04 서울체력장·AI 메디헬스·메디런',
    department: '보건행정과',
    team: '건강증진팀',
    color: '#6366f1',
    description: 'KIOSK 6종 체력인증센터 운영, AI 기반 메디헬스 처방 및 메디런 야외 걷기·러닝 연계',
  },
  '05_어린이_아이뛰움': {
    projectId: 'hchps-p4',
    projectKey: '05_어린이_아이뛰움',
    projectName: '05 어린이 신체활동 아이뛰움',
    department: '보건행정과',
    team: '건강증진팀',
    color: '#8b5cf6',
    description: '어린이집 유아 체력 측정, 또래 표준 비교 분석 및 보육교사 놀이형 신체활동 보급',
  },
  '06_비만예방_합동캠페인': {
    projectId: 'hchps-p5',
    projectKey: '06_비만예방_합동캠페인',
    projectName: '06 중년여성 비만예방 및 건강뜀 합동캠페인',
    department: '보건행정과',
    team: '건강증진팀',
    color: '#ef4444',
    description: '50~60대 중년 여성 맞춤 코어·노르딕워킹 프로그램 및 범구민 비만예방 건강뜀 캠페인',
  },
  '07_손목닥터9988_스마트헬스': {
    projectId: 'hchps-p6',
    projectKey: '07_손목닥터9988_스마트헬스',
    projectName: '07 손목닥터9988 스마트 헬스케어',
    department: '보건행정과',
    team: '건강증진팀',
    color: '#0ea5e9',
    description: '서울시 손목닥터9988 스마트밴드·앱 연계 구민 일상 자가 건강관리 및 포인트 인센티브',
  },
  '08_보건소_기능유지_청사관리': {
    projectId: 'hchps-p8',
    projectKey: '08_보건소_기능유지_청사관리',
    projectName: '08 보건소 기능유지 및 청사 시설관리',
    department: '보건행정과',
    team: '보건행정팀',
    color: '#64748b',
    description: '보건소 본청·별관 시설 방호, 냉난방·전기 유지보수 및 일반행정 공공 서비스 지원',
  },
  '신체활동_건강생활실천': {
    projectId: 'hchps-p0',
    projectKey: '신체활동_건강생활실천',
    projectName: '신체활동 및 건강생활실천 총괄기획',
    department: '보건행정과',
    team: '건강증진팀',
    color: '#3b82f6',
    description: '지역보건의료계획 수립, 건강생활실천사업 기획총괄, 행정사무감사 및 차년도 예산편성 총괄',
  },
};

export const PROJECT_ALIASES_MAP: Record<CanonicalProjectKey, string[]> = {
  '01_양재천_페스티벌': [
    '01_양재천_페스티벌',
    'hchps-p1',
    '03_양재천_건강페스티벌',
    '양재천_건강축제_페스티벌',
    '양재천 건강 페스티벌',
    '양재천페스티벌',
    '양재천',
    '양재천 걷자! 건강 페스티벌',
    '양재천 건강걷기',
  ],
  '02_사회적_처방_신체활동': [
    '02_사회적_처방_신체활동',
    'hchps-p2',
    '사회적 처방',
    '사회적처방',
    '공공PT',
    '공공 pt',
    '취약계층 신체활동',
    '사회적처방_신체활동',
    '취약계층 공공 pt',
  ],
  '03_헬스체크업_바른자세': [
    '03_헬스체크업_바른자세',
    'hchps-p3',
    '헬스체크업',
    '바른자세',
    '바른자세 개선',
    '바른자세_체형교정',
    '척추측만증',
    '05_어린이_아이뛰움_바른자세',
    '체형교정',
  ],
  '04_서울체력장_AI메디헬스_메디런': [
    '04_서울체력장_AI메디헬스_메디런',
    'hchps-p7',
    'mrtzykb56mp2l66nv',
    '서울체력장',
    'AI메디헬스',
    '메디런',
    '서울체력장_체력인증센터',
    '체력인증센터',
    '강남 AI 메디헬스 센터',
    '강남체력인증센터 운영',
    'AI_메디헬스_스마트케어',
    '강남체력인증센터',
  ],
  '05_어린이_아이뛰움': [
    '05_어린이_아이뛰움',
    'hchps-p4',
    '아이뛰움',
    '어린이신체활동',
    '어린이_아이뛰움',
    '어린이신체활동_아이뛰움',
    '어린이 신체활동',
  ],
  '06_비만예방_합동캠페인': [
    '06_비만예방_합동캠페인',
    'hchps-p5',
    '비만예방',
    '중년여성 비만예방',
    '건강뜀',
    '06_비만예방_건강뜀_합동캠페인',
    '비만예방_합동캠페인',
    '비만예방_건강뜀',
    '건강 뜀',
  ],
  '07_손목닥터9988_스마트헬스': [
    '07_손목닥터9988_스마트헬스',
    'hchps-p6',
    '손목닥터',
    '손목닥터9988',
    '스마트헬스',
    '9988',
    '스마트 헬스케어',
    '모바일 헬스케어',
  ],
  '08_보건소_기능유지_청사관리': [
    '08_보건소_기능유지_청사관리',
    'hchps-p8',
    '09_일반행정_보안_법령_기타',
    '청사관리',
    '기능유지',
    '보건소 기능유지',
    '보건소 기능유지 청사관리',
    '청사 시설관리',
  ],
  '신체활동_건강생활실천': [
    '신체활동_건강생활실천',
    'hchps-p0',
    '01_기획총괄_주요업무_행감',
    '건강생활실천',
    '건강생활실천사업',
    '신체활동 공통',
    '기획총괄',
    '신체활동',
    '08_통합건강증진_지역보건의료계획',
    '02_예산회계_보조금_일상경비',
  ],
};

// ============================================================================
// 2. Helper Functions (Rule Q - PIPA Sanitization)
// ============================================================================

/**
 * Helper to mask a single telephone or mobile number (Rule Q compliant).
 * - 02 (Seoul landline): '02-***-XXXX' (3 asterisks per privacy_guard.py)
 * - 3-digit middle (e.g. 02-123-4567, 031-123-4567): '***'
 * - 4-digit middle (e.g. 010-1234-5678, 031-1234-5678): '****'
 * - Trailing extensions preserved (e.g. '02-796-1907~9' -> '02-***-1907~9')
 */
export function maskSinglePhoneNumber(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';

  // Preserve trailing range/extension suffixes (e.g. ~9, ~12)
  let base = trimmed;
  let suffix = '';
  const rangeMatch = trimmed.match(/^(.*?)(~[0-9]+)$/);
  if (rangeMatch) {
    base = rangeMatch[1].trim();
    suffix = rangeMatch[2];
  }

  // 1. Standard 3-cluster formats separated by hyphen, dot, or space
  // e.g., '010-1234-5678', '02-6224-9040', '02-123-4567', '031-1234-5678'
  const clusterMatch = base.match(/^(\d{2,3})[-. ]+(\d{3,4})[-. ]+(\d{4})$/);
  if (clusterMatch) {
    const [, prefix, middle, last] = clusterMatch;
    const mask = prefix === '02' ? '***' : (middle.length === 3 ? '***' : '****');
    return `${prefix}-${mask}-${last}${suffix}`;
  }

  // 2. Continuous raw digits or non-standard separations (e.g., '01012345678', '0221337517')
  const digits = base.replace(/\D/g, '');
  let maskedBase = '';

  if (digits.length === 11) {
    // 010-XXXX-XXXX, 031-XXXX-XXXX
    const prefix = digits.slice(0, 3);
    const last = digits.slice(7);
    maskedBase = `${prefix}-****-${last}`;
  } else if (digits.length === 10) {
    if (digits.startsWith('02')) {
      // 02-XXXX-XXXX (Seoul 10-digit landline)
      const prefix = '02';
      const last = digits.slice(6);
      maskedBase = `${prefix}-***-${last}`;
    } else {
      // 031-XXX-XXXX, 011-XXX-XXXX (3-3-4 10-digit)
      const prefix = digits.slice(0, 3);
      const last = digits.slice(6);
      maskedBase = `${prefix}-***-${last}`;
    }
  } else if (digits.length === 9 && digits.startsWith('02')) {
    // 02-XXX-XXXX (Seoul 9-digit landline)
    const prefix = '02';
    const last = digits.slice(5);
    maskedBase = `${prefix}-***-${last}`;
  } else if (digits.length >= 7) {
    // General fallback for unusual lengths (>= 7 digits)
    const start = digits.slice(0, 3);
    const end = digits.slice(-4);
    maskedBase = `${start}-****-${end}`;
  } else {
    // Short strings (e.g. '000', '112', '119')
    maskedBase = trimmed;
  }

  return `${maskedBase}${suffix}`;
}

/**
 * PIPA Masking utility for phone numbers (Rule Q compliant)
 * Handles multi-phone strings separated by commas, semicolons, slashes, or newlines.
 * e.g., '02-6224-9040, 010-4911-6899' -> '02-***-9040, 010-****-6899'
 * e.g., '01012345678' -> '010-****-5678'
 * e.g., '02-123-4567' -> '02-***-4567'
 * e.g., '031-1234-5678' -> '031-****-5678'
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';

  // Multi-phone string handling: split by delimiter [,;\/\n|]
  if (/[,;\/\n|]/.test(trimmed)) {
    const parts = trimmed.split(/\s*[,;\/\n|]+\s*/).filter(Boolean);
    return parts.map(maskSinglePhoneNumber).join(', ');
  }

  return maskSinglePhoneNumber(trimmed);
}

/**
 * PIPA Masking utility for personal Korean names (Rule Q compliant)
 * e.g., '홍길동' -> '홍*동', '김철' -> '김*'
 */
export function maskPersonalName(name?: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  if (trimmed.length === 3) return `${trimmed[0]}*${trimmed[2]}`;
  if (trimmed.length === 4) return `${trimmed[0]}**${trimmed[3]}`;
  return trimmed;
}

// ============================================================================
// 3. 6-Domain TypeScript Interfaces
// ============================================================================

/**
 * Domain 1: 4단계 행정문서 온톨로지
 */
export interface CrossDomainOntologyData {
  policies: AdminPolicyEntity[];
  outcomes: AdminOutcomeEntity[];
  audits: AdminAuditEntity[];
  budgetPlans: AdminBudgetPlanEntity[];
  weeklyWorks: AdminWeeklyWorkEntity[];
  totalNodes: number;
  lifecycleComplete: boolean; // 4단계 전과정(방침->결과->감사->예산) 존재 여부
  auditGaps: AdminAuditGap[];  // 미조치 감사 지적사항
}

/**
 * Domain 2: 마스터 아카이브 (공문서·사진·스프레드시트)
 */
export interface CrossDomainArchiveData {
  totalDocuments: number;
  totalPhotos: number;
  totalSheets: number;
  recentDocuments: ArchiveItem[];
  recentPhotos: ArchiveItem[];
}

/**
 * Domain 3: 작업기억 (포스트잇 미반영 메모 및 긴급 지시사항)
 */
export interface CrossDomainWorkingMemoryData {
  pendingMemos: WorkingMemoryMemo[];
  pendingCount: number;
  reflectedCount: number;
  urgentDirectives: WorkingMemoryMemo[];
}

/**
 * Domain 4: e-호조 예산 및 시뮬레이터 번다운 (Rule R 엄수)
 */
export interface CrossDomainBudgetData {
  totalBudget: number;         // 원 단위 총 편성액
  spentBudget: number;         // 실집행액 (일반지출 + 일상경비교부액)
  remainingBudget: number;     // 집행 잔액 (totalBudget - spentBudget)
  executionRate: number;       // 집행률 (%)
  generalSpent?: number;       // 본청 일반지출
  dailyExpenseIssued: number;  // 일상경비 교부액
  dailyExpenseSpent: number;   // 일상경비 실지출액
  dailyExpenseRemaining: number;// 일상경비 미집행 잔액 (dailyExpenseIssued - dailyExpenseSpent)
  simulatedExpenditure: number;// 시뮬레이터 예정 지출액 합계
  finalExpectedBalance: number;// 최종 예상 잔액 (remainingBudget - simulatedExpenditure)
  isDeficit: boolean;          // finalExpectedBalance < 0
  categories: Array<{
    id: string;
    name: string;
    totalBudget: number;
    spent?: number;
    remaining?: number;
  }>;
}

/**
 * Domain 5: 수요일 주간업무 HWPX
 */
export interface CrossDomainWeeklyWorkData {
  reportsCount: number;
  recentItems: Array<{
    reportDate: string;
    projectName: string;
    status: 'performance' | 'plan';
    contents: string[];
    metrics?: string;
    target?: string;
    location?: string;
  }>;
  latestReportDate?: string;
  latestHwpxAvailable: boolean;
}

/**
 * Domain 6: 페스티벌 및 담당자 연락처 (Rule Q 엄수: 전화번호 마스킹)
 */
export interface CrossDomainFestivalSummary {
  title: string;
  eventDate: string;
  eventTime?: string;
  location: string;
  progress: number;
  boothsCount: number;
  dutiesCount: number;
  budgetTotal: number;
}

export interface CrossDomainAssignedContact {
  id?: string;
  name: string;
  phone: string; // Rule Q: 010-****-1234
  email?: string;
  role?: string;
  organization?: string;
  notes?: string;
}

export interface CrossDomainFestivalAndContactsData {
  isFestivalProject: boolean;
  festivalSummary?: CrossDomainFestivalSummary;
  assignedContacts: CrossDomainAssignedContact[];
}

/**
 * 단위사업별 6대 도메인 크로스 조인 통합 번들
 */
export interface CrossDomainProjectBundle {
  projectId: string;          // e.g., 'hchps-p1'
  projectKey: string;         // e.g., '01_양재천_페스티벌'
  projectName: string;        // e.g., '01 양재천 건강페스티벌'
  department: string;         // '보건행정과'
  team: string;               // '건강증진팀'
  color: string;              // 테마 색상 (e.g., '#14b8a6')

  // 6대 도메인 속성
  ontology: CrossDomainOntologyData;
  archive: CrossDomainArchiveData;
  workingMemory: CrossDomainWorkingMemoryData;
  budget: CrossDomainBudgetData;
  weeklyWork: CrossDomainWeeklyWorkData;
  festivalAndContacts: CrossDomainFestivalAndContactsData;
}

/**
 * 9대 단위사업 전체 레지스트리 맵
 */
export type CrossDomainRegistry = Record<string, CrossDomainProjectBundle>;

export interface CrossDomainResponse {
  success: boolean;
  timestamp?: string;
  durationMs?: number;
  totalProjects?: number;
  data: CrossDomainRegistry | CrossDomainProjectBundle;
}

// ============================================================================
// 4. Zod Schemas for Runtime Gatekeeper & Testing
// ============================================================================

export const CrossDomainOntologySchema = z.object({
  policies: z.array(z.any()).catch([]),
  outcomes: z.array(z.any()).catch([]),
  audits: z.array(z.any()).catch([]),
  budgetPlans: z.array(z.any()).catch([]),
  weeklyWorks: z.array(z.any()).catch([]),
  totalNodes: z.number().int().nonnegative().catch(0),
  lifecycleComplete: z.boolean().catch(false),
  auditGaps: z.array(z.any()).catch([]),
});

export const CrossDomainArchiveSchema = z.object({
  totalDocuments: z.number().int().nonnegative().catch(0),
  totalPhotos: z.number().int().nonnegative().catch(0),
  totalSheets: z.number().int().nonnegative().catch(0),
  recentDocuments: z.array(z.any()).catch([]),
  recentPhotos: z.array(z.any()).catch([]),
});

export const CrossDomainWorkingMemorySchema = z.object({
  pendingMemos: z.array(z.any()).catch([]),
  pendingCount: z.number().int().nonnegative().catch(0),
  reflectedCount: z.number().int().nonnegative().catch(0),
  urgentDirectives: z.array(z.any()).catch([]),
});

export const CrossDomainBudgetCategorySchema = z.object({
  id: z.string().catch('unknown-cat'),
  name: z.string().catch('기타 예산'),
  totalBudget: z.number().catch(0),
  spent: z.number().optional().catch(0),
  remaining: z.number().optional().catch(0),
});

export const CrossDomainBudgetSchema = z.object({
  totalBudget: z.number().catch(0),
  spentBudget: z.number().catch(0),
  remainingBudget: z.number().catch(0),
  executionRate: z.number().catch(0),
  generalSpent: z.number().optional().catch(0),
  dailyExpenseIssued: z.number().catch(0),
  dailyExpenseSpent: z.number().catch(0),
  dailyExpenseRemaining: z.number().catch(0),
  simulatedExpenditure: z.number().catch(0),
  finalExpectedBalance: z.number().catch(0),
  isDeficit: z.boolean().catch(false),
  categories: z.array(CrossDomainBudgetCategorySchema).catch([]),
});

export const CrossDomainWeeklyWorkItemSchema = z.object({
  reportDate: z.string().catch(''),
  projectName: z.string().catch(''),
  status: z.enum(['performance', 'plan']).catch('performance'),
  contents: z.array(z.string()).default([]).catch([]),
  metrics: z.string().optional().catch(undefined),
  target: z.string().optional().catch(undefined),
  location: z.string().optional().catch(undefined),
});

export const CrossDomainWeeklyWorkSchema = z.object({
  reportsCount: z.number().int().nonnegative().catch(0),
  recentItems: z.array(CrossDomainWeeklyWorkItemSchema).catch([]),
  latestReportDate: z.string().optional().catch(undefined),
  latestHwpxAvailable: z.boolean().catch(false),
});

export const CrossDomainFestivalSummarySchema = z.object({
  title: z.string().catch('2026 양재천 건강 페스티벌'),
  eventDate: z.string().catch('2026-10-31(토)'),
  eventTime: z.string().optional().catch(undefined),
  location: z.string().catch('양재천 수변문화쉼터'),
  progress: z.number().catch(85),
  boothsCount: z.number().catch(20),
  dutiesCount: z.number().catch(41),
  budgetTotal: z.number().catch(49900000),
});

export const CrossDomainAssignedContactSchema = z.object({
  id: z.string().optional().catch(undefined),
  name: z.string().catch('담당자'),
  phone: z.string().catch(''),
  email: z.string().optional().catch(undefined),
  role: z.string().optional().catch(undefined),
  organization: z.string().optional().catch(undefined),
  notes: z.string().optional().catch(undefined),
});

export const CrossDomainFestivalAndContactsSchema = z.object({
  isFestivalProject: z.boolean().catch(false),
  festivalSummary: CrossDomainFestivalSummarySchema.optional().catch(undefined),
  assignedContacts: z.array(CrossDomainAssignedContactSchema).catch([]),
});

export const CrossDomainProjectBundleSchema = z.object({
  projectId: z.string().catch('unknown-project'),
  projectKey: z.string().catch('기타'),
  projectName: z.string().catch('미지정 사업'),
  department: z.string().catch('보건행정과'),
  team: z.string().catch('건강증진팀'),
  color: z.string().catch('#3b82f6'),
  ontology: CrossDomainOntologySchema,
  archive: CrossDomainArchiveSchema,
  workingMemory: CrossDomainWorkingMemorySchema,
  budget: CrossDomainBudgetSchema,
  weeklyWork: CrossDomainWeeklyWorkSchema,
  festivalAndContacts: CrossDomainFestivalAndContactsSchema,
});

export const CrossDomainRegistrySchema = z.record(z.string(), CrossDomainProjectBundleSchema);

export type CrossDomainProjectBundleDto = z.infer<typeof CrossDomainProjectBundleSchema>;
export type CrossDomainRegistryDto = z.infer<typeof CrossDomainRegistrySchema>;
