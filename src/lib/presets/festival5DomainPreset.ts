import { OntologyNode, OntologyEdge, OntologyGroup, VerificationStatus, NodeOverride } from '@/lib/ontology.types';
import { SimulationEntry } from '@/types';

export interface FestivalDomainChild {
  id: string;
  label: string;
  budget?: number;
  permitKey?: 'municipal_report' | 'police_road' | 'fire_safety' | 'safety_plan';
  verificationStatus?: VerificationStatus;
  story5W1H?: {
    who?: string;
    when?: string;
    where?: string;
    what?: string;
    how?: string;
    why?: string;
    contact?: string;
    department?: string;
    title?: string;
  };
}

export interface FestivalDomainHub {
  id: string;
  label: string;
  group: OntologyGroup;
  color: string;
  fixedX: number;
  fixedY: number;
  children: FestivalDomainChild[];
}

export const FESTIVAL_5DOMAINS: FestivalDomainHub[] = [
  {
    id: 'festival-hub-permits',
    label: '인허가/안전관리',
    group: 'SYSTEM_RISK',
    color: '#FF0044',
    fixedX: 0,
    fixedY: -280,
    children: [
      {
        id: 'fest-p1',
        label: '안전관리계획서 수립/제출',
        budget: 1500000,
        permitKey: 'safety_plan',
        verificationStatus: 'in-progress',
        story5W1H: {
          who: '안전관리 전담자 및 보건행정과 주무관',
          when: 'D-30 (행사 1개월 전)',
          where: '관할 구청 재난안전과',
          what: '5천만원 이상 지역축제 안전관리계획서 수립 및 심의 제출',
          how: '전문 안전 컨설팅 용역 후 심의 서류 제출',
          why: '지역보건법 및 재난안전법 준수 필수 제출 항목',
          department: '인허가/안전관리'
        }
      },
      {
        id: 'fest-p2',
        label: '경찰서 도로점용/교통신고',
        budget: 500000,
        permitKey: 'police_road',
        verificationStatus: 'uncompleted',
        story5W1H: {
          who: '행사 운영팀장',
          when: 'D-20',
          where: '관할 경찰서 교통과',
          what: '축제장 인근 도로 점용 및 교통 통제 협조 요청',
          how: '도로점용 허가 신청서 제출 및 신호수 배치 계획 협의',
          why: '축제 보행자 안전 통로 및 임시 주차구역 확보',
          department: '인허가/안전관리'
        }
      },
      {
        id: 'fest-p3',
        label: '소방서 가설물 안전점검',
        budget: 1000000,
        permitKey: 'fire_safety',
        verificationStatus: 'uncompleted',
        story5W1H: {
          who: '무대/소방 안전책임자',
          when: 'D-3 (무대 완공 시)',
          where: '관할 소방서 예방안전과',
          what: '가설 무대, 트러스, 몽골텐트 소방 안전점검 및 필증 발급',
          how: '현장 소방 점검 및 소화기 20개 설치 확인',
          why: '화재 및 붕괴 위험 사전 차단',
          department: '인허가/안전관리'
        }
      },
      {
        id: 'fest-p4',
        label: '행사 종합배상책임보험',
        budget: 1000000,
        verificationStatus: 'verified',
        story5W1H: {
          who: '행사 기획자',
          when: 'D-15',
          where: '손해보험사',
          what: '관람객 5,000명 규모 행사 종합배상책임보험 가입',
          how: '대인 1인당 1억원 / 대물 1사고당 1억원 조건 가입',
          why: '안전사고 발생 시 피해 보상 보장',
          department: '인허가/안전관리'
        }
      },
      {
        id: 'fest-p5',
        label: '안전요원 배치/비상연락망',
        budget: 1000000,
        verificationStatus: 'in-progress',
        story5W1H: {
          who: '경비/안전요원 팀장 (5명)',
          when: 'D-1 ~ D-Day',
          where: '행사장 전 구역 및 비상 통로',
          what: '안전요원 배치 및 경찰/소방/보건소 비상연락망 차트 게시',
          how: '무전기 지급 및 비상 상황 대피 훈련',
          why: '인파 밀집 및 비상 상황 즉시 대응',
          department: '인허가/안전관리'
        }
      }
    ]
  },
  {
    id: 'festival-hub-stage',
    label: '무대/공연/음향',
    group: 'CORE_PROJECT',
    color: '#0055FF',
    fixedX: 266,
    fixedY: -86,
    children: [
      {
        id: 'fest-s1',
        label: '메인무대/트러스/백드롭',
        budget: 10000000,
        verificationStatus: 'in-progress',
        story5W1H: {
          who: '무대 제작 용역사',
          when: 'D-2 ~ D-1',
          where: '메인 중앙 광장',
          what: '12m x 8m 조립식 무대, 레이어 트러스, 현막 백드롭 시공',
          how: '구조 검토 필증 확인 후 수평 조절 및 고정 앵커 설치',
          why: '축제 대표 개막식 및 공연 무대 확보',
          department: '무대/공연/음향'
        }
      },
      {
        id: 'fest-s2',
        label: '음향 스피커/믹서 렌탈',
        budget: 5000000,
        verificationStatus: 'in-progress',
        story5W1H: {
          who: '음향 감독',
          when: 'D-1',
          where: '메인무대 음향 콘솔',
          what: '라인어레이 스피커 8kW, 믹싱 콘솔 및 무선마이크 8채널 세팅',
          how: '음향 튜닝 및 주파수 혼선 테스트',
          why: '야외 관람객 5,000명 선명한 음향 전달',
          department: '무대/공연/음향'
        }
      },
      {
        id: 'fest-s3',
        label: '조명/발전차(50kW) 임대',
        budget: 4000000,
        verificationStatus: 'in-progress',
        story5W1H: {
          who: '조명/전기 엔지니어',
          when: 'D-1',
          where: '메인무대 및 발전차 주차구역',
          what: '무빙 조명 12대, LED 무대 조명 및 50kW 비상 발전차 1대 임대',
          how: '무대 전용 분전함 연결 및 리허설 조명 큐 세팅',
          why: '야간 공연 연출 및 전력 다운 방지',
          department: '무대/공연/음향'
        }
      },
      {
        id: 'fest-s4',
        label: '초청 가수/공연진 섭외',
        budget: 2000000,
        verificationStatus: 'verified',
        story5W1H: {
          who: '공연 섭외 담당자',
          when: 'D-45',
          where: '메인무대',
          what: '헤드라이너 초청가수 1팀 및 지역 문화예술단 2팀 출연 계약',
          how: '출연 계약서 체결 및 셋리스트/음원 수령',
          why: '축제 하이라이트 흥행 및 대민 집객',
          department: '무대/공연/음향'
        }
      },
      {
        id: 'fest-s5',
        label: '전문 MC 섭외 & 진행대본',
        budget: 1000000,
        verificationStatus: 'verified',
        story5W1H: {
          who: '행사 총괄 디렉터 & 전문 MC',
          when: 'D-10',
          where: '행사장 대기실 & 메인무대',
          what: '개막식/내빈소개/경품추첨 전문 아나운서 섭외 및 대본 최종 확정',
          how: '시나리오 3차 검수 및 동선 리허설 사전 진행',
          why: '원활한 행사 진행 및 내빈 의전',
          department: '무대/공연/음향'
        }
      }
    ]
  },
  {
    id: 'festival-hub-pr',
    label: '홍보/마케팅',
    group: 'DATA_PIPELINE',
    color: '#FF6600',
    fixedX: 164,
    fixedY: 226,
    children: [
      {
        id: 'fest-r1',
        label: '가로등 현수막/포스터 시공',
        budget: 3000000,
        verificationStatus: 'in-progress',
        story5W1H: {
          who: '옥외광고 시공업체',
          when: 'D-14 ~ D-1',
          where: '관내 주요 간선도로 및 공공기관 게시판',
          what: '가로등 현수막 50조 및 홍보 포스터 500매 시공/게시',
          how: '지자체 옥외광고 허가 후 현수막 게시',
          why: '지역 주민 및 방문객 오프라인 인식 제고',
          department: '홍보/마케팅'
        }
      },
      {
        id: 'fest-r2',
        label: 'SNS 카드뉴스/지역맘카페',
        budget: 1500000,
        verificationStatus: 'verified',
        story5W1H: {
          who: 'SNS 마케터',
          when: 'D-21 ~ D-Day',
          where: '인스타그램, 페이스북, 지역 맘카페',
          what: '축제 홍보 카드뉴스 5종 제작 및 인플루언서 커뮤니티 배포',
          how: '타겟 릴리스 발행 및 이벤트 경품 이벤트 집행',
          why: '3040 타깃 가족 단위 관람객 유치',
          department: '홍보/마케팅'
        }
      },
      {
        id: 'fest-r3',
        label: '지자체 보도자료/현장취재',
        budget: 1000000,
        permitKey: 'municipal_report',
        verificationStatus: 'uncompleted',
        story5W1H: {
          who: '구청 공보관 및 담당 주무관',
          when: 'D-10',
          where: '언론사 및 구청 홈페이지',
          what: '지자체 공식 보도자료 작성 및 축제 현장 기자단 취재 지원',
          how: '엠바고 보도자료 배포 및 프레스룸 세팅',
          why: '공공 정책 신뢰도 증대 및 대언론 홍보',
          department: '홍보/마케팅'
        }
      },
      {
        id: 'fest-r4',
        label: '축제 리플릿/팜플렛 제작',
        budget: 1500000,
        verificationStatus: 'verified',
        story5W1H: {
          who: '디자인 전문 인쇄사',
          when: 'D-7',
          where: '축제 안내소 및 종합입구',
          what: '행사장 맵 및 부스 가이드 리플릿 5,000부 디자인 및 인쇄',
          how: '3단 접지 친환경 용지 인쇄 후 안내소 배치',
          why: '관람객 행사장 동선 및 프로그램 가이드 제공',
          department: '홍보/마케팅'
        }
      },
      {
        id: 'fest-r5',
        label: '타겟지역 숏폼 영상광고',
        budget: 1000000,
        verificationStatus: 'in-progress',
        story5W1H: {
          who: '영상 제작 PD',
          when: 'D-15',
          where: '유튜브 쇼츠 & 인스타그램 릴스',
          what: '30초 티저 홍보 영상 2편 제작 및 지정 타깃 지역 위치 기반 광고 집행',
          how: '반경 5km 관람객 타깃 광고 송출',
          why: '모바일 숏폼 트렌드 활용 집객 극대화',
          department: '홍보/마케팅'
        }
      }
    ]
  },
  {
    id: 'festival-hub-food',
    label: '먹거리/부스',
    group: 'MACRO_RESEARCH',
    color: '#00CC44',
    fixedX: -164,
    fixedY: 226,
    children: [
      {
        id: 'fest-f1',
        label: '푸드트럭 모집/위생점검',
        budget: 2000000,
        verificationStatus: 'in-progress',
        story5W1H: {
          who: '먹거리 부스 관리자 & 보건소 위생과',
          when: 'D-20 ~ D-1',
          where: '푸드트럭 존 (10대)',
          what: '우수 푸드트럭 모집, 영업 신고 및 보건소 사전 위생 점검',
          how: '영업 신고증 및 보건증 확인 후 현장 위생 지도',
          why: '식중독 예방 및 다양한 먹거리 제공',
          department: '먹거리/부스'
        }
      },
      {
        id: 'fest-f2',
        label: '체험부스 몽골텐트 20동',
        budget: 4000000,
        verificationStatus: 'verified',
        story5W1H: {
          who: '부스 설치 렌탈 업체',
          when: 'D-2',
          where: '체험/전시 부스 존',
          what: '5m x 5m 몽골텐트 20동 및 듀오 백월 시공',
          how: '텐트 고정 모래주머니(20kg) 동당 4개 배치',
          why: '주민 체험 프로그램 및 홍보 부스 공간 확보',
          department: '먹거리/부스'
        }
      },
      {
        id: 'fest-f3',
        label: '부스 전력배선/용수공급',
        budget: 2000000,
        verificationStatus: 'in-progress',
        story5W1H: {
          who: '전력/설비 기술팀',
          when: 'D-1',
          where: '전 부스 및 푸드트럭 존',
          what: '부스별 차단기 1.5kW 공급, 급수/배수 인프라 설치',
          how: '방수 케이블 몰딩 매립 및 누전차단기 개별 시공',
          why: '부스 조리 및 체험 장비 전력 차단 방지',
          department: '먹거리/부스'
        }
      },
      {
        id: 'fest-f4',
        label: '음식물쓰레기/분리수거장',
        budget: 1000000,
        verificationStatus: 'uncompleted',
        story5W1H: {
          who: '환경 청소팀 (3명)',
          when: 'D-Day',
          where: '에코 클린존 3개소',
          what: '분리수거 거치대, 음식물 쓰레기 수거함 설치 및 상시 청소',
          how: '종량제 봉투 배치 및 수시 쓰레기 회수',
          why: '행사장 쾌적한 환경 유지 및 민원 차단',
          department: '먹거리/부스'
        }
      },
      {
        id: 'fest-f5',
        label: '듀오백 의자/듀오 테이블',
        budget: 1000000,
        verificationStatus: 'verified',
        story5W1H: {
          who: '행사 물자 관리자',
          when: 'D-1',
          where: '관람객 휴게 존 & 체험부스 내',
          what: '접이식 의자 200개 및 듀오 테이블 40개 렌탈 배치',
          how: '부스당 테이블 2, 의자 6 배치',
          why: '관람객 편의 및 식음료 취식 공간 제공',
          department: '먹거리/부스'
        }
      }
    ]
  },
  {
    id: 'festival-hub-budget',
    label: '예산/계약',
    group: 'DCF_MODELING',
    color: '#8800FF',
    fixedX: -266,
    fixedY: -86,
    children: [
      {
        id: 'fest-b1',
        label: '총 예산 6,000만원 편성',
        budget: 60000000,
        verificationStatus: 'verified',
        story5W1H: {
          who: '행사 예산 총괄 책임자',
          when: 'D-60',
          where: '기획예산과',
          what: '지역축제 총 사업예산 6,000만원 지자체/민간 재원 편성',
          how: '세부 항목별 예산 한도 설정 및 과목 적정성 검토',
          why: '축제 지출 50-70M KRW 기준 가이드라인 준수',
          department: '예산/계약'
        }
      },
      {
        id: 'fest-b2',
        label: '무대/음향 용역 계약',
        budget: 22000000,
        verificationStatus: 'verified',
        story5W1H: {
          who: '재무 계약관',
          when: 'D-35',
          where: '지방계약시스템 (G2B)',
          what: '무대, 음향, 조명, 발전차 통합 시스템 22.0M 계약 체결',
          how: '수익계약/경쟁입찰 과업지시서 수립 후 낙찰',
          why: '무대 및 연출 시설 안정적 수주',
          department: '예산/계약'
        }
      },
      {
        id: 'fest-b3',
        label: '공연진 출연료 지급',
        budget: 15000000,
        verificationStatus: 'in-progress',
        story5W1H: {
          who: '지출 원인 행위자',
          when: 'D-5 ~ D+3',
          where: '출연 기획사 계좌',
          what: '초청 가수, MC, 세션 공연진 출연료 15.0M 원천징수 후 지급',
          how: '계약금 30% 선급, 본행사 직후 잔금 70% 입금',
          why: '공연 계약 의무 이행',
          department: '예산/계약'
        }
      },
      {
        id: 'fest-b4',
        label: '홍보물 제작/광고비',
        budget: 8000000,
        verificationStatus: 'verified',
        story5W1H: {
          who: '홍보 집행관',
          when: 'D-20',
          where: '인쇄사 및 대행사 계좌',
          what: '현수막, 리플릿, SNS 숏폼 광고 집행비 8.0M 소요 정산',
          how: '세금계산서 및 과업 완료 보고서 수령 후 집행',
          why: '홍보예산 한도 내 집행',
          department: '예산/계약'
        }
      },
      {
        id: 'fest-b5',
        label: '부스/인프라 임대비',
        budget: 10000000,
        verificationStatus: 'verified',
        story5W1H: {
          who: '인프라 담당관',
          when: 'D-15',
          where: '렌탈 전문 업체',
          what: '몽골텐트 20동, 전력 설비, 테이블/의자 임대비 10.0M 집행',
          how: '검수 납품서 확인 후 지출 결재',
          why: '먹거리 및 체험부스 시설 임대비 정산',
          department: '예산/계약'
        }
      },
      {
        id: 'fest-b6',
        label: '예비비 & 예산 정산',
        budget: 5000000,
        verificationStatus: 'uncompleted',
        story5W1H: {
          who: '회계 정산 담당자',
          when: 'D+7 (행사 종료 후)',
          where: '지출결의 시스템',
          what: '돌발 예비비 5.0M 집행 및 축제 전체 예산 감사 정산',
          how: '영수증 및 지출결의서 전수 감사 후 잔액 반납',
          why: '회계 무결성 확보 및 보조금 정산',
          department: '예산/계약'
        }
      }
    ]
  }
];

export const FESTIVAL_PRESET_SIMULATION_ENTRIES: Omit<SimulationEntry, 'id' | 'createdAt'>[] = [
  // 1. 인허가/안전관리 (5.0M)
  {
    name: '안전관리계획서 수립 및 구청 제출',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-01 사무관리비',
    unitPrice: 1500000,
    quantity: 1,
    amount: 1500000,
    memo: '안전관리계획서 전문 용역 수립 및 구청 제출비'
  },
  {
    name: '경찰서 도로점용 및 교통통제 신고',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-01 사무관리비',
    unitPrice: 500000,
    quantity: 1,
    amount: 500000,
    memo: '관할 경찰서 도로점용 허가 및 신호수 관련 경비'
  },
  {
    name: '소방서 가설물 안전점검 수수료',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-02 공공운영비',
    unitPrice: 1000000,
    quantity: 1,
    amount: 1000000,
    memo: '소방서 가설 건축물/전기시설 안전점검 필증 발급'
  },
  {
    name: '행사 종합배상책임보험 가입',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-01 사무관리비',
    unitPrice: 1000000,
    quantity: 1,
    amount: 1000000,
    memo: '행사 관람객 5,000명 기준 종합배상책임보험'
  },
  {
    name: '전문 안전요원 배치 및 비상연락망 구축',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-03 행사운영비',
    unitPrice: 200000,
    quantity: 5,
    amount: 1000000,
    memo: '안전요원 5명 배치 및 현장 통제'
  },
  // 2. 무대/공연/음향 (22.0M)
  {
    name: '메인무대 트러스 및 백드롭 설치 용역',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-03 행사운영비',
    unitPrice: 10000000,
    quantity: 1,
    amount: 10000000,
    memo: '12m x 8m 메인무대, 조명 트러스 및 디자인 백드롭'
  },
  {
    name: '야외 고출력 음향 스피커 및 믹서 렌탈',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-03 행사운영비',
    unitPrice: 5000000,
    quantity: 1,
    amount: 5000000,
    memo: '라인어레이 스피커 8kw, 무선 마이크 8채널'
  },
  {
    name: '무대 조명 연출 및 50kW 발전차 임대',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-03 행사운영비',
    unitPrice: 4000000,
    quantity: 1,
    amount: 4000000,
    memo: '무대 무빙 조명 및 비상 발전차 50kW 1대'
  },
  {
    name: '초청 가수 및 지역 문화공연진 섭외비',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-03 행사운영비',
    unitPrice: 2000000,
    quantity: 1,
    amount: 2000000,
    memo: '헤드라이너 초청가수 및 축하 공연 2팀'
  },
  {
    name: '전문 MC 섭외 및 행사 진행 대본',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-03 행사운영비',
    unitPrice: 1000000,
    quantity: 1,
    amount: 1000000,
    memo: '개막식 및 본행사 전문 아나운서/MC 섭외'
  },
  // 3. 홍보/마케팅 (8.0M)
  {
    name: '가로등 현수막 및 홍보 포스터 시공',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-01 사무관리비',
    unitPrice: 3000000,
    quantity: 1,
    amount: 3000000,
    memo: '관내 주요 도로 가로등 현수막 50조 및 포스터 500매'
  },
  {
    name: 'SNS 카드뉴스 제작 및 지역 맘카페 타깃 홍보',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-01 사무관리비',
    unitPrice: 1500000,
    quantity: 1,
    amount: 1500000,
    memo: '카드뉴스 5종 제작 및 인스타그램/지역 커뮤니티 배포'
  },
  {
    name: '지자체 보도자료 작성 및 현장 취재 지원',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-01 사무관리비',
    unitPrice: 1000000,
    quantity: 1,
    amount: 1000000,
    memo: '사전 보도자료 배포 및 프레스 키트 준비'
  },
  {
    name: '축제 안내 리플릿 및 팜플렛 5,000부 제작',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-01 사무관리비',
    unitPrice: 300,
    quantity: 5000,
    amount: 1500000,
    memo: '행사장 맵 및 부스 프로그램 안내 팜플렛'
  },
  {
    name: '타깃 지역 SNS 숏폼 영상 광고 집행',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-01 사무관리비',
    unitPrice: 1000000,
    quantity: 1,
    amount: 1000000,
    memo: '릴스/쇼츠 홍보 영상 30초 2편 제작 및 광고'
  },
  // 4. 먹거리/부스 (10.0M)
  {
    name: '푸드트럭 모집 및 보건소 위생점검',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-01 사무관리비',
    unitPrice: 2000000,
    quantity: 1,
    amount: 2000000,
    memo: '푸드트럭 8대 모집/운영 및 보건 위생 지도'
  },
  {
    name: '체험부스 몽골텐트(5x5m) 20동 임대',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-03 행사운영비',
    unitPrice: 200000,
    quantity: 20,
    amount: 4000000,
    memo: '체험 및 먹거리 부스용 몽골텐트 20동 렌탈'
  },
  {
    name: '부스 간이 전력배선 및 임시 용수 공급',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-02 공공운영비',
    unitPrice: 2000000,
    quantity: 1,
    amount: 2000000,
    memo: '부스별 분전함 시공 및 급수/배수 설비'
  },
  {
    name: '음식물 쓰레기 수거함 및 분리수거장 설치',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-02 공공운영비',
    unitPrice: 1000000,
    quantity: 1,
    amount: 1000000,
    memo: '에코 재활용 존 3개소 운영 및 청소 인력'
  },
  {
    name: '관람객용 의자 200개 및 접이식 테이블 40개',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-03 행사운영비',
    unitPrice: 1000000,
    quantity: 1,
    amount: 1000000,
    memo: '듀오백 의자 및 테이블 렌탈'
  },
  // 5. 예산/계약 (15.0M)
  {
    name: '공연진 출연료 및 무대 보조 인력 집행',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-03 행사운영비',
    unitPrice: 10000000,
    quantity: 1,
    amount: 10000000,
    memo: '메인 출연진 계약금 및 무대 세션 출연료'
  },
  {
    name: '축제 예비비 및 비상 지출 정산금',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-01 사무관리비',
    unitPrice: 5000000,
    quantity: 1,
    amount: 5000000,
    memo: '우천/돌발 상황 대응 예비비 및 예산 정산'
  }
];

export function getFestivalPresetGraphData(): {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
  overrides: Record<string, NodeOverride>;
} {
  const nodes: OntologyNode[] = [];
  const edges: OntologyEdge[] = [];
  const overrides: Record<string, NodeOverride> = {
    'root-HCHPS': { hideDefaultGraph: true }
  };

  const hubAngles = [-90, -18, 54, 126, 198]; // angles for 5 hubs in degrees
  const sectorRadius = 110;

  FESTIVAL_5DOMAINS.forEach((hub, hubIdx) => {
    // 1. Add Domain Hub Node
    const hubNode: OntologyNode = {
      id: hub.id,
      label: hub.label,
      group: hub.group,
      baseValue: 120,
      fixedX: hub.fixedX,
      fixedY: hub.fixedY,
      customColor: hub.color,
      centralityScore: 500,
      layerId: 2
    };
    nodes.push(hubNode);

    overrides[hub.id] = {
      fixedX: hub.fixedX,
      fixedY: hub.fixedY,
      customColor: hub.color,
      customGroup: hub.group,
      customOrbitIndex: 1,
      verificationStatus: 'in-progress'
    };

    // 2. Compute sector arc positions for children
    const N = hub.children.length;
    const baseAngleDeg = hubAngles[hubIdx];
    const spreadDeg = 70; // 70 degrees total spread

    hub.children.forEach((child, childIdx) => {
      const offsetDeg = N > 1 ? (childIdx - (N - 1) / 2) * (spreadDeg / (N - 1)) : 0;
      const angleRad = ((baseAngleDeg + offsetDeg) * Math.PI) / 180;
      const childX = Math.round(hub.fixedX + sectorRadius * Math.cos(angleRad) * 1.3);
      const childY = Math.round(hub.fixedY + sectorRadius * Math.sin(angleRad));

      const childNode: OntologyNode = {
        id: child.id,
        label: child.label,
        group: hub.group,
        baseValue: 80,
        parentId: hub.id,
        fixedX: childX,
        fixedY: childY,
        customColor: hub.color,
        centralityScore: 100,
        layerId: 2
      };
      nodes.push(childNode);

      overrides[child.id] = {
        fixedX: childX,
        fixedY: childY,
        customColor: hub.color,
        customGroup: hub.group,
        customParent: hub.id,
        customOrbitIndex: 2,
        verificationStatus: child.verificationStatus || 'uncompleted',
        story5W1H: child.story5W1H || {
          what: child.label,
          department: hub.label
        }
      };

      // Connect hub to child
      edges.push({
        source: hub.id,
        target: child.id,
        type: 'DEPENDENCY',
        weight: 1.0
      });
    });
  });

  // 3. Add Cross-Domain Edges for Inter-Domain Workflow Dependencies
  const crossDomainEdges: OntologyEdge[] = [
    { source: 'fest-b2', target: 'fest-s1', type: 'CAUSAL_DRIVE', weight: 1.2 },
    { source: 'fest-b3', target: 'fest-s4', type: 'CAUSAL_DRIVE', weight: 1.2 },
    { source: 'fest-b4', target: 'fest-r1', type: 'CAUSAL_DRIVE', weight: 1.2 },
    { source: 'fest-b5', target: 'fest-f2', type: 'CAUSAL_DRIVE', weight: 1.2 },
    { source: 'fest-p1', target: 'fest-p3', type: 'DEPENDENCY', weight: 1.0 },
    { source: 'fest-p1', target: 'fest-p2', type: 'DEPENDENCY', weight: 1.0 },
    { source: 'fest-r3', target: 'fest-p1', type: 'BOTTLENECK', weight: 1.1 }
  ];

  edges.push(...crossDomainEdges);

  return { nodes, edges, overrides };
}
