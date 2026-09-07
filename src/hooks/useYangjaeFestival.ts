'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface MilestoneItem {
  id: number;
  number: string;
  title: string;
  status: 'done' | 'in-progress' | 'todo';
  period: string;
  cooperationDepts?: string[];
  details: string[];
}

export interface BoothItem {
  id: number;
  category: string;
  name: string;
  scale: string;
  program: string;
  status: string;
}

export interface WeeklyReportItem {
  weekTitle: string;
  period: string;
  items: string[];
}

export interface FestivalData {
  meta: {
    title: string;
    shortTitle: string;
    eventDate: string;
    eventTime: string;
    location: string;
    course: string;
    targetAudience: string;
    programStructure?: string[];
    staffNote?: string;
    organizer: string;
    overallProgress: number;
    lastUpdated: string;
  };
  budget: {
    total: number;
    allocated: {
      agencyService: number;
      suppliesAndRental: number;
      refreshments: number;
      volunteerSupport: number;
    };
    agencyQuotation: number;
    agencyCompany: string;
  };
  weeklyReport?: WeeklyReportItem;
  milestones: MilestoneItem[];
  booths: BoothItem[];
  departmentsCooperation?: {
    dept: string;
    task: string;
    status: string;
  }[];
}

export const YANGJAE_FALLBACK_DATA: FestivalData = {
  "meta": {
    "title": "2026 양재천 걷자! 건강 페스티벌",
    "shortTitle": "2026 양재천 건강 페스티벌",
    "eventDate": "2026-10-31(토)",
    "eventTime": "09:00 ~ 14:00",
    "location": "양재천 수변문화쉼터 및 출발마당 (개포동 1279 일원)",
    "course": "수변문화쉼터 ↔ 영동5교 왕복 (약 4km)",
    "targetAudience": "강남구민 800명 (사전 접수)",
    "programStructure": [
      "건강 걷기 체험 프로그램(4km)",
      "의료 및 건강 관련 체험·홍보 부스 운영"
    ],
    "staffNote": "행사 참여 직원 대체휴무 시행 예정",
    "organizer": "강남구보건소 보건행정과 건강증진팀",
    "overallProgress": 65,
    "lastUpdated": "2026-09-04"
  },
  "budget": {
    "total": 49900000,
    "allocated": {
      "agencyService": 36950000,
      "suppliesAndRental": 9300000,
      "refreshments": 2450000,
      "volunteerSupport": 1200000
    },
    "agencyQuotation": 50215000,
    "agencyCompany": "제이민 커뮤니케이션"
  },
  "weeklyReport": {
    "weekTitle": "주간 추진실적 보고",
    "period": "8. 31. ~ 9. 4.",
    "items": [
      "1. [홍보] 행사 포스터 시안 제작 및 대구민 홍보 채널 구축 진행중 (지영팀장님, 오창선)\n   - 내용: 메인 포스터 디자인 감수 및 구청·보건소 홈페이지 배너·통합예약 연계 준비",
      "2. [기획/회의] 9. 1. 행사 추진 총괄 및 현안 실무회의 완료\n   - 참석: 과장님, 희선팀장님, 지영팀장님, 임석훤, 남상희, 오창선\n   - 안건: 행사 추진 관련 전반, VIP 초청, 참가자 모집 방법(800명), 보도자료 배포 등",
      "3. [장소/현장] 9. 2. 양재천 현장답사 및 유관기관 합동점검 실시\n   - 참석: 지영팀장님, 오창선, 유디치과 관계자\n   - 내용: 유디치과 이동 검진버스 진입 동선 및 건강체험 추가 부스 설치 구역 현장 실측",
      "4. [의전] 구청장님 행사 참석 관련 구청 비서실 사전 협의 완료\n   - 내용: 행사 개회식 및 걷기대회 구청장님 참석 확정 조율 (지영팀장님)",
      "5. [부스] 9. 3. 유관 의료단체(강남구의사회·한의사회) 부스 운영 협조 회의\n   - 참석: 과장님, 오창선\n   - 내용: 전문 의료진 건강상담 부스 운영 확정 및 세부 프로그램 운영안 협의 조율중"
    ]
  },
  "milestones": [
    {
      "id": 1,
      "number": "추진과제 1",
      "title": "장소 및 일시 확정",
      "status": "in-progress",
      "period": "7월 말 ~ 8.31. (완료)",
      "cooperationDepts": [
        "건설관리과(부지 소유자)",
        "공원녹지과",
        "치수과",
        "문화도시과"
      ],
      "details": [
        "[완료][26.7.29.][참여:오창선] 사전답사 1 : 행사장소 '수변문화쉼터' 검토",
        "[완료][26.8.11.][참여:과장님, 지영팀장님, 서승오, 오창선] 사전답사 2 :걷기 코스 및 장소 확정",
        "[완료][26.8.13.][참여:지영팀장님, 오창선, 제이민(대행사)] 대행사 현장 미팅 1 : 제이민(여성기업)",
        "[완료][26.8.19.][참여:과장님, 지영팀장님, 오창선, 제이민(대행사)] 대행사 현장 미팅 2 : 세부 운영안 조율",
        "[완료][26.8.27.][참여:보건행정과-10515] [허가완료] 건설관리과: 행사장소 하천점용허가 신청 및 승인 완료 (개포동 1279 일원)",
        "[완료][26.9.1.][참여:과장님, 희선팀장님, 지영팀장님, 임석훤, 남상희, 오창선] 내부 회의 : 행사 추진 관련 전반, VIP 초청, 참가자 모집 방법, 보도자료 등 안건 협의",
        "[완료][26.9.3.][참여:보건행정과-10992] [협조완료] 공원녹지과: 출발마당(포이공원) 장소 및 전기 사용, 볼라드 개폐",
        "[예정][9.7.(월)] 전 부서 행사 알림 : 행사 포스터 시안 확정 이후",
        "[예정] 장소 사용 협조 진행 여부 : 수변문화센터 외부 소관 치수과, 내부 소관 문화도시과 "
      ]
    },
    {
      "id": 2,
      "number": "추진과제 2",
      "title": "행사 식순",
      "status": "in-progress",
      "period": "9월 1주 ~ 9월 3주",
      "cooperationDepts": [],
      "details": [
        "[예정][07:30~08:00] 직원 출근 : ",
        "[예정][08:00~08:30] 행사준비 (30분) : BGM 송출 및 현장 점검, 참여 접수 시작",
        "[예정][08:40~13:00] 부스 운영 시작 : ",
        "[예정][08:40~09:00] 식전 축하공연 (30분) : K-POP공연팀 무대",
        "[예정][09:00~09:02] 오프닝 (2분) : 사회자 공식 인사(김연태 MC)",
        "[예정][09:02~09:04] 국민의례 (2분) : 국기에 대한 경례(약식)",
        "[예정][09:04~09:08] 내빈소개 (8분) : 주요 참석 내빈 소개",
        "[예정][09:08~09:15] 인사말씀 & 축사 (7분) : 구청장님 인사말씀 및 내빈 축사",
        "[예정][09:15~09:20] 레크레이션 (5분) : 바르게 걷기 운동 레크레이션",
        "[예정][09:20~09:30] 공연 & 준비운동 (10분) : 치어리더 '팜팜' 준비 체조",
        "[예정][09:30~09:40] 이동 (10분) : START 지점으로 이동",
        "[예정][09:45~09:45] 기념촬영 (5분) : START 아치에서 단체 기념촬영",
        "[예정][09:45~13:00] 걷기 출발 : ",
        "[예정][10:30~10:50] 축하공연 (20분) : 미정",
        "[예정][11:00~11:30] 축하공연 (30분) : 미정",
        "[예정][11:40~12:00] 레크레이션 (20분) : 스틱잡기챌린지",
        "[예정][13:00~14:00] 마무리 : 행사 마무리 및 행사장 환경 정비"
      ]
    },
    {
      "id": 3,
      "number": "추진과제 3",
      "title": "운영 부스",
      "status": "in-progress",
      "period": "9월 1주 ~ 9월 2주",
      "cooperationDepts": [],
      "details": [
        "[완료][9.1.][참여:오창선, 고려대학교척추측만증연구소] 고려대학교척추측만증 연구소 부스 운영 확정 : 신청서 회신",
        "[완료][9.2.][참여:지영팀장님, 오창선] 부스 위치 답사 : 유디치과 검진버스 정차 위치 검토",
        "[완료][9.2.][참여:오창선] 의료관광팀 부스 운영 불가 : 의료관광 부스 운영 불가 통보(더 큰 행사 있음)",
        "[완료][9.2.][참여:오창선, 김형종, 한국신체정보(주)] 운동처방 테마 부스 운영 확정 : 내 신체나이 알아보기 체력 측정, 자세 분석 및 운동 처방 ",
        "[진행][9.3.][참여:과장님, 오창선] 강남구의사회·한의사회 부스 운영 협조: 운영 확정 및 세부 사항 조율중",
        "[완료][9.4.][참여:오창선, 강남차병원] 강남차병원 부스 운영 확정 : 신청서 회신",
        "[완료][9.4.][참여:오창선, 서울대병원강남센터] 서울대병원 강남센터 부스 운영 확정 : 신청서 회신, *의자 6개 신청",
        "[완료][9.4.][참여:오창선, (주)유디] 유디 치과 부스 운영 확정 : 신청서 회신"
      ]
    },
    {
      "id": 4,
      "number": "추진과제 4",
      "title": "행사 홍보",
      "status": "in-progress",
      "period": "9월 1주 ~ 10월 2주",
      "cooperationDepts": [
        "도시계획과",
        "정책홍보실",
        "주민자치과"
      ],
      "details": [
        "[진행] 행사 포스터 제작 진행중... : ",
        "[진행][9.2.][참여:오창선] 온라인 사전접수 시스템 오픈 : 보건소 통합예약 시스템 활용, 10.1. 부터 접수 시작",
        "[예정] [협조예정] 도시계획과: 양재천 교량 및 산책로 현수막 게첨",
        "[진행] [협조진행] 정책홍보실: 구청 홈페이지, SNS, 카카오 알림톡, 보도자료 배포",
        "[예정] [협조예정] 주민자치과: 정례반상회 홍보자료 제출 및 행정복지센터 홍보 포스터 부착 협조",
        "[예정][참여:과장님] 양재천 지킴이 : 행사 홍보 및 참여 요청"
      ]
    },
    {
      "id": 5,
      "number": "추진과제 5",
      "title": "방침 및 계약",
      "status": "todo",
      "period": "9월 1주 ~ 9월 3주",
      "cooperationDepts": [],
      "details": [
        "[진행] 행사 방침서 작성 중..."
      ]
    },
    {
      "id": 6,
      "number": "추진과제 6",
      "title": "VIP 초청 관련",
      "status": "in-progress",
      "period": "9월 1주 ~ 10월 3주",
      "cooperationDepts": [
        "비서실"
      ],
      "details": [
        "[완료][9.3.][참여:지영팀장님] 구청장님 참석 비서실 협의: 참석 확정",
        "[예정] 의원 VIP 초청 진행 예정 : ",
        "[예정][참여:오창선] 남부혈액원 주차 5대 협조 공문 발송: "
      ]
    },
    {
      "id": 7,
      "number": "추진과제 7",
      "title": "안전관리",
      "status": "todo",
      "period": "",
      "cooperationDepts": [],
      "details": []
    },
    {
      "id": 8,
      "number": "추진과제 8",
      "title": "기타사항",
      "status": "todo",
      "period": "",
      "cooperationDepts": [],
      "details": [
        "[예정][참여:과장님] 개포현대2단지 아파트 입주자 대표회 : 행사 알림"
      ]
    }
  ],
  "booths": [
    {
      "id": 1,
      "category": "의료·검진",
      "name": "강남 차병원",
      "scale": "3동",
      "program": "중년 여성 유방 자가검진 교육, 여성질환 및 영양 상담",
      "status": "확정"
    },
    {
      "id": 2,
      "category": "의료 검진",
      "name": "강남구의사회",
      "scale": "1동",
      "program": "-",
      "status": "협의중"
    },
    {
      "id": 3,
      "category": "의료 검진",
      "name": "강남구한의사회",
      "scale": "1동",
      "program": "-",
      "status": "협의중"
    },
    {
      "id": 4,
      "category": "의료·검진",
      "name": "고려대학교부설 척추측만증연구소",
      "scale": "2동 + 검진버스",
      "program": "거북목·척추측만증 X-Ray 무료 촬영 및 교정 상담",
      "status": "확정"
    },
    {
      "id": 5,
      "category": "의료·검진",
      "name": "서울대학교병원 강남센터",
      "scale": "1동",
      "program": "가정의학과 전문의 만성질환 상담",
      "status": "확정"
    },
    {
      "id": 6,
      "category": "의료·검진",
      "name": "서울시 간호조무사회",
      "scale": "2동",
      "program": "혈당 및 혈압 측정, 만성질환 1:1 상담",
      "status": "협의중"
    },
    {
      "id": 7,
      "category": "의료·검진",
      "name": "유디치과",
      "scale": "1동 + 검진버스",
      "program": "구강 검진 및 구강건강 관리법 안내",
      "status": "확정"
    },
    {
      "id": 8,
      "category": "의료·검진",
      "name": "자생한방병원",
      "scale": "2동",
      "program": "간이 침 치료, 스포츠 테이핑 및 한의학 상담",
      "status": "확정"
    },
    {
      "id": 9,
      "category": "민간 헬스케어",
      "name": "케이스튜디오 (디아르스)",
      "scale": "1동",
      "program": "퍼스널 컬러 진단 및 계절별 산책·야외운동 메이크업 봉사",
      "status": "확정"
    },
    {
      "id": 10,
      "category": "민간 헬스케어",
      "name": "한국신체정보(주)",
      "scale": "2동",
      "program": "내 신체나이 알아보기, 『리얼피티 프로 플러스』 40초 바른자세·체형 분석 및 운동처방",
      "status": "확정"
    },
    {
      "id": 11,
      "category": "보건소 사업",
      "name": "금연·절주 영양 보건 사업 홍보",
      "scale": "1동",
      "program": "일산화탄소 측정, 금연상담 및 음주 고글 체험",
      "status": "확정"
    },
    {
      "id": 12,
      "category": "보건소 사업",
      "name": "서울체력장 강남센터",
      "scale": "2동",
      "program": "내 신체나이 알아보기, 서울체력장 인증 체력측정 (성인: 2분제자리걷기/악력, 시니어: 의자일어서기 등)",
      "status": "확정"
    }
  ]
};

export const initialFallbackData = YANGJAE_FALLBACK_DATA;

export function useYangjaeFestival() {
  return useQuery<FestivalData>({
    queryKey: ['festival', 'yangjae'],
    queryFn: async () => {
      const res = await fetch('/api/festival/yangjae?t=' + Date.now(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch festival data');
      }
      return res.json();
    },
    placeholderData: initialFallbackData,
    staleTime: 1000,
    gcTime: 1000 * 60 * 30,
    refetchInterval: 2500,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useSaveYangjaeFestival() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updatedData: FestivalData) => {
      const res = await fetch('/api/festival/yangjae', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) {
        throw new Error('Failed to save festival data to disk');
      }
      const json = await res.json();
      return (json && json.data) ? (json.data as FestivalData) : updatedData;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['festival', 'yangjae'] });
    },
    onSuccess: (savedData: FestivalData) => {
      queryClient.setQueryData(['festival', 'yangjae'], savedData);
      queryClient.invalidateQueries({ queryKey: ['festival', 'yangjae'] });
    },
  });
}

export function calculateFestivalBudgetSummary(budget?: FestivalData['budget']) {
  if (!budget) {
    return {
      total: 0,
      allocatedTotal: 0,
      balance: 0,
      executionRate: 0,
    };
  }

  const total = Number(budget.total);
  const safeTotal = Number.isFinite(total) && total >= 0 ? total : 0;

  const allocated = budget.allocated || ({} as Record<string, number>);
  const agencyService = Number(allocated.agencyService);
  const suppliesAndRental = Number(allocated.suppliesAndRental);
  const refreshments = Number(allocated.refreshments);
  const volunteerSupport = Number(allocated.volunteerSupport);

  const safeAgencyService = Number.isFinite(agencyService) && agencyService >= 0 ? agencyService : 0;
  const safeSuppliesAndRental = Number.isFinite(suppliesAndRental) && suppliesAndRental >= 0 ? suppliesAndRental : 0;
  const safeRefreshments = Number.isFinite(refreshments) && refreshments >= 0 ? refreshments : 0;
  const safeVolunteerSupport = Number.isFinite(volunteerSupport) && volunteerSupport >= 0 ? volunteerSupport : 0;

  const allocatedTotal = safeAgencyService + safeSuppliesAndRental + safeRefreshments + safeVolunteerSupport;
  const balance = safeTotal - allocatedTotal;
  const executionRate = safeTotal > 0 ? Math.round((allocatedTotal / safeTotal) * 100) : 0;

  return {
    total: safeTotal,
    allocatedTotal,
    balance,
    executionRate,
  };
}
