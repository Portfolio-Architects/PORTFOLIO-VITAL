export type PhysicalActivityDomain = 'ALL' | 'walking' | 'measurement' | 'lifecycle';

export interface PhysicalActivitySubMetric {
  id: string;
  name: string;
  categoryLabel: string;
  count: number;
  unit: string;
}

export interface PhysicalActivityProjectMetric {
  id: string;
  projectId: string;
  name: string;
  shortName: string;
  domainCategory: 'walking' | 'measurement' | 'lifecycle';
  domainLabel: string;
  badgeText: string;
  actualCount: number;
  targetCount: number;
  unit: string;
  secondaryMetricLabel: string;
  sourceDoc: string;
  updatedDate: string;
  subMetrics: PhysicalActivitySubMetric[];
}

export const PHYSICAL_ACTIVITY_DOMAIN_TABS: Array<{
  id: PhysicalActivityDomain;
  label: string;
  shortLabel: string;
}> = [
  { id: 'ALL', label: '전체 사업 (8대 핵심)', shortLabel: '전체 실적' },
  { id: 'walking', label: '걷기·캠페인 (3)', shortLabel: '걷기·캠페인' },
  { id: 'measurement', label: '측정·운동처방 (2)', shortLabel: '측정·운동처방' },
  { id: 'lifecycle', label: '생애주기·형평성 (3)', shortLabel: '생애주기·형평성' },
];

export const DEFAULT_PHYSICAL_ACTIVITY_METRICS_2026: PhysicalActivityProjectMetric[] = [
  {
    id: 'pa-wristdoctor',
    projectId: 'mrtzykb56mp2l66nv',
    name: '손목닥터9988 걷기 챌린지',
    shortName: '손목닥터9988 챌린지',
    domainCategory: 'walking',
    domainLabel: '스마트헬스 · 걷기 캠페인',
    badgeText: '4개 챌린지 · 달성 2,203명',
    actualCount: 5748,
    targetCount: 5000,
    unit: '명',
    secondaryMetricLabel: '미션 달성 2,203명 (38.3%) · 11월 3대 명산 트레킹 운영',
    sourceDoc: '2026 보건소 행정사무감사 참고자료 · 주간업무보고(11.4.)',
    updatedDate: '2026. 11. 6.',
    subMetrics: [
      {
        id: 'sub-wd-1',
        name: '챌린지 미션 완주·포인트 달성',
        categoryLabel: '선정릉 · 강남페스티벌 · 양재천 5km 완주',
        count: 2203,
        unit: '명',
      },
      {
        id: 'sub-wd-2',
        name: '커뮤니티 가입·진행 참여 구민',
        categoryLabel: '전통시장 · 3대 명산(매봉·대모·구룡산) 트레킹',
        count: 3545,
        unit: '명',
      },
    ],
  },
  {
    id: 'pa-posture',
    projectId: 'hchps-p3',
    name: '바른자세 개선 사업',
    shortName: '바른자세 개선(청소년)',
    domainCategory: 'lifecycle',
    domainLabel: '아동·청소년 · 조기검진',
    badgeText: '관내 17개교 출장 검진 완료',
    actualCount: 4543,
    targetCount: 4500,
    unit: '명',
    secondaryMetricLabel: '초·중·고 17개교 검진 완료 (척추측만 3,278 · 거북목 613 · 척추건강 652)',
    sourceDoc: '주요업무보고(건생2) · 행정사무감사 보충자료(연번16)',
    updatedDate: '2026. 10. 31.',
    subMetrics: [
      {
        id: 'sub-pos-1',
        name: '초·중학생 척추측만증 검진',
        categoryLabel: '관내 15개교 · 전방굴곡검사 및 X-ray 촬영',
        count: 3278,
        unit: '명',
      },
      {
        id: 'sub-pos-2',
        name: '척추 건강 정밀 검사',
        categoryLabel: '체형 불균형 판독 및 바른자세 상담',
        count: 652,
        unit: '명',
      },
      {
        id: 'sub-pos-3',
        name: '고등학생 거북목증후군 검진',
        categoryLabel: '관내 2개교 · 폼체커 경추 변위 진단',
        count: 613,
        unit: '명',
      },
    ],
  },
  {
    id: 'pa-healthcheckup',
    projectId: 'hchps-p1',
    name: '강남구 헬스체크업 운영',
    shortName: '강남구 헬스체크업',
    domainCategory: 'measurement',
    domainLabel: '체력·체형 측정 · 맞춤처방',
    badgeText: '처방 2,538건 · 사후관리 48회',
    actualCount: 2636,
    targetCount: 2500,
    unit: '명',
    secondaryMetricLabel: '정규 1,237명 + 현장 1,252명 + 사후관리 147명 (상담·처방 2,538건)',
    sourceDoc: '주요업무보고(건생2) · 9월 사후관리 결과보고',
    updatedDate: '2026. 10. 31.',
    subMetrics: [
      {
        id: 'sub-hc-1',
        name: '현장 방문 신체상태 측정',
        categoryLabel: '체성분(체지방·근육량) · 혈압 계측',
        count: 1252,
        unit: '명',
      },
      {
        id: 'sub-hc-2',
        name: 'PHIS 정규 등록·1:1 운동처방',
        categoryLabel: '정적 자세 평가 및 전문가 맞춤 실습 (2,538건)',
        count: 1237,
        unit: '명',
      },
      {
        id: 'sub-hc-3',
        name: '사후관리 근골격 컨디셔닝',
        categoryLabel: '별관 지하교육장 6차시 48회 (연인원 553건)',
        count: 147,
        unit: '명',
      },
    ],
  },
  {
    id: 'pa-kidsjump',
    projectId: 'hchps-p5',
    name: '서울시 아이뛰움 사업',
    shortName: '서울시 아이뛰움(유아)',
    domainCategory: 'lifecycle',
    domainLabel: '영유아 · 성장발달 체력측정',
    badgeText: '어린이집 30개소 · 교사 78명',
    actualCount: 1932,
    targetCount: 1800,
    unit: '명',
    secondaryMetricLabel: '유아 체력측정 1,854건(103.0%) + 동남권 보육교사 실습교육 78명',
    sourceDoc: '주요업무보고(건생2) · 행정사무감사 보충자료',
    updatedDate: '2026. 10. 31.',
    subMetrics: [
      {
        id: 'sub-kj-1',
        name: '어린이집 30개소 유아 체력측정',
        categoryLabel: '순발력·민첩성·근지구력·유연성·평형성 (연 2회)',
        count: 1854,
        unit: '명',
      },
      {
        id: 'sub-kj-2',
        name: '보육교사 신체활동 역량강화 교육',
        categoryLabel: '동남권 통합 유아 체육 수업 실습 보급',
        count: 78,
        unit: '명',
      },
    ],
  },
  {
    id: 'pa-yangjae',
    projectId: 'hchps-p6',
    name: '2026 양재천 걷자! 건강 페스티벌',
    shortName: '양재천 건강 페스티벌',
    domainCategory: 'walking',
    domainLabel: '대구민 수변 걷기 · 건강부스',
    badgeText: '사전 532 · 현장 292 · 19개 기관',
    actualCount: 824,
    targetCount: 800,
    unit: '명',
    secondaryMetricLabel: '참여구민 824명 완주 (사전 532·현장 292 / 내빈 27명·19개 부스 37동)',
    sourceDoc: '2026 양재천 걷자! 건강 페스티벌 개최 결과 보고서(11.6.)',
    updatedDate: '2026. 11. 6.',
    subMetrics: [
      {
        id: 'sub-yj-1',
        name: '보건소 통합예약 사전접수 완주',
        categoryLabel: '수변문화쉼터↔영동4교 2km 완주 및 스탬프북 달성',
        count: 532,
        unit: '명',
      },
      {
        id: 'sub-yj-2',
        name: '당일 현장접수 걷기·부스 참여',
        categoryLabel: '강남구체육회 공동주관 걷기 및 19개 의료부스 체험',
        count: 292,
        unit: '명',
      },
    ],
  },
  {
    id: 'pa-obesity',
    projectId: 'hchps-p4',
    name: '중년여성 비만예방 프로그램',
    shortName: '중년여성 비만예방(건강뜀)',
    domainCategory: 'walking',
    domainLabel: '중강도 서킷 · 숲길 트레킹',
    badgeText: '총 67회 운영 · 매봉산 트레킹',
    actualCount: 592,
    targetCount: 400,
    unit: '명',
    secondaryMetricLabel: '10월 말 65회 578명 + 11월 1주 매봉산 트레킹 2회 14명 (달성률 148.0%)',
    sourceDoc: '보건소 주간업무보고(11.4.) · 주요업무보고(건생2)',
    updatedDate: '2026. 11. 6.',
    subMetrics: [
      {
        id: 'sub-ob-1',
        name: '상·하반기 근력·서킷·노르딕워킹',
        categoryLabel: '삼성해맞이공원 · 양재천 · 청담평생학습관 (65회)',
        count: 578,
        unit: '명',
      },
      {
        id: 'sub-ob-2',
        name: '11월 매봉산 둘레길 중강도 트레킹',
        categoryLabel: '도곡동 매봉산 둘레길 (11.3. 6명 · 11.5. 8명)',
        count: 14,
        unit: '명',
      },
    ],
  },
  {
    id: 'pa-publicpt',
    projectId: 'hchps-p2',
    name: '취약계층 공공 PT 프로그램',
    shortName: '취약계층 공공 PT',
    domainCategory: 'lifecycle',
    domainLabel: '건강 형평성 · 2:1 맞춤 운동',
    badgeText: '실인원 137명 · 누적 800회',
    actualCount: 137,
    targetCount: 130,
    unit: '명',
    secondaryMetricLabel: '고령자 40·경력단절 38·1인가구 21·수급자 11·장기실업 11·차상위 등 16명 (800회)',
    sourceDoc: '보건소 주간업무보고(11.4.) · 주요업무보고(건생2)',
    updatedDate: '2026. 11. 6.',
    subMetrics: [
      {
        id: 'sub-pt-1',
        name: '고령자 근력·낙상예방 맞춤 지도',
        categoryLabel: '만 65세 이상 취약 어르신 소그룹 PT',
        count: 40,
        unit: '명',
      },
      {
        id: 'sub-pt-2',
        name: '경력단절여성 체력 증진 지도',
        categoryLabel: '사회적 특성 취약계층 순환 트레이닝',
        count: 38,
        unit: '명',
      },
      {
        id: 'sub-pt-3',
        name: '1인가구 맞춤형 신체활동 교육',
        categoryLabel: '만성질환 고위험 1인가구 건강관리',
        count: 21,
        unit: '명',
      },
      {
        id: 'sub-pt-4',
        name: '기초생활수급자 및 장기실업자',
        categoryLabel: '기초수급자 11명 · 장기실업자 11명',
        count: 22,
        unit: '명',
      },
      {
        id: 'sub-pt-5',
        name: '차상위계층·저소득근로자·한부모',
        categoryLabel: '차상위 8명 · 저소득근로 7명 · 한부모 1명',
        count: 16,
        unit: '명',
      },
    ],
  },
  {
    id: 'pa-seoulfitness',
    projectId: 'hchps-p7',
    name: '서울체력장 강남센터 운영',
    shortName: '서울체력장 강남센터',
    domainCategory: 'measurement',
    domainLabel: 'AI 체력인증 · 운동처방',
    badgeText: '26. 11. 2. 개소 · AI 6종 측정',
    actualCount: 30,
    targetCount: 30,
    unit: '명',
    secondaryMetricLabel: '2026. 11. 2. 정식 개소 · 1주차 신규측정 30명 (성인 18명 · 어르신 12명)',
    sourceDoc: '보건소 주간업무보고(11.4. 항목15) · 체력장 검수보고',
    updatedDate: '2026. 11. 6.',
    subMetrics: [
      {
        id: 'sub-sf-1',
        name: '성인기 6종 체력측정·처방',
        categoryLabel: '근력·근지구력·심폐지구력·유연성·순발력·민첩성',
        count: 18,
        unit: '명',
      },
      {
        id: 'sub-sf-2',
        name: '어르신기 체력측정·운동처방',
        categoryLabel: '하지근력·평형성·협응력·보행기능 및 인증서 발급',
        count: 12,
        unit: '명',
      },
    ],
  },
];

export const PHYSICAL_ACTIVITY_STORAGE_KEY = 'vital-physical-activity-metrics-2026-v1';

export function loadPhysicalActivityMetrics(): PhysicalActivityProjectMetric[] {
  if (typeof window === 'undefined') {
    return DEFAULT_PHYSICAL_ACTIVITY_METRICS_2026;
  }
  try {
    const raw = window.localStorage.getItem(PHYSICAL_ACTIVITY_STORAGE_KEY);
    if (!raw) return DEFAULT_PHYSICAL_ACTIVITY_METRICS_2026;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_PHYSICAL_ACTIVITY_METRICS_2026;
    }
    return parsed;
  } catch {
    return DEFAULT_PHYSICAL_ACTIVITY_METRICS_2026;
  }
}

export function savePhysicalActivityMetrics(metrics: PhysicalActivityProjectMetric[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PHYSICAL_ACTIVITY_STORAGE_KEY, JSON.stringify(metrics));
  } catch {}
}
