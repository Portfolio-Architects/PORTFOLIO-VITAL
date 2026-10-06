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
  staffCount?: number;
  tables?: number;
  chairs?: number;
  manager?: string;
  phone?: string;
  adminPhone?: string;
  mobilePhone?: string;
  zone?: string;
  electricity?: string;
  electricityDetail?: string;
  bannerText?: string;
  remarks?: string;
}

export interface WeeklyReportItem {
  weekTitle: string;
  period: string;
  items: string[];
}

export interface ScheduleItem {
  id: number;
  phase: string;
  time: string;
  duration?: string;
  title: string;
  lead?: string;
  status: 'done' | 'in-progress' | 'todo' | string;
  note?: string;
}

export interface DutyStaffMember {
  name: string;
  adminPhone?: string;
  mobilePhone?: string;
  role?: string;
}

export interface DutyItem {
  id: number | string;
  category: string;
  deptOrOrg: string;
  role?: string;
  manager: string;
  phone?: string;
  adminPhone?: string;
  mobilePhone?: string;
  tasks: string[];
  remarks?: string;
  staffMembers?: DutyStaffMember[];
  headcount?: {
    bogun?: number;
    sports?: number;
    agency?: number;
  };
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
  schedule?: ScheduleItem[];
  duties?: DutyItem[];
  departmentsCooperation?: {
    dept: string;
    task: string;
    status: string;
  }[];
}

export const YANGJAE_FALLBACK_DATA: FestivalData = {
  "meta": {
    "title": "제8회 강남구청장배 걷기 대회 연계 2026 양재천 걷자! 건강 페스티벌",
    "shortTitle": "2026 양재천 건강 페스티벌",
    "eventDate": "2026-10-31(토)",
    "eventTime": "08:00 ~ 14:00",
    "location": "양재천 수변문화쉼터 및 출발마당 (개포동 1279 일원)",
    "course": "수변문화쉼터 ↔ 영동4교 왕복",
    "targetAudience": "강남구민 800명(사전접수)",
    "programStructure": [
      "건강 걷기 체험 프로그램(구청장배 걷기대회 연계)",
      "의료 및 건강 관련 체험·홍보 부스 운영"
    ],
    "staffNote": "행사 참여 직원 대체휴무 시행 예정 (전 직원 참여, 금연단속원 포함)",
    "organizer": "강남구보건소 보건행정과 건강증진팀, 강남구체육회(걷기협회)",
    "overallProgress": 70,
    "lastUpdated": "2026-10-06"
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
    "period": "9. 7. ~ 9. 11.",
    "items": [
      "1. [체육회/공동개최] 9. 7. 강남구체육회(걷기협회) 구청장배 걷기대회 공동 개최 협의 (과장님, 지영팀장님, 오창선)\n   - 내용: 당초 영동3교 분산 추진 건(체육회 11.21. 연기안)을 10. 31.(토) 우리 행사와 전격 통합·공동 개최 협의\n   - 효과: 체육회 참가 인원(200~250명) 합류로 총 1,000명 이상 대규모 축제 외연 확장 및 행사 시너지 극대화",
      "2. [기획/방침] 공동 개최 연계에 따른 행사 기본계획 방침서 수정 및 식순 보완\n   - 내용: 체육회 공동 주관 명기, 개회식 식순 연계(내빈 의전 및 준비운동), 걷기 코스 및 참가자 통합 운영안 조율",
      "3. [부스/의료] 12개 전문 건강체험 부스 최종 확정 및 협력 기관 세부 조율 완료\n   - 내용: 대학병원·의사회·민간 헬스케어 등 12개 부스(검진버스 2대 포함) 배치도 확정 및 기관별 체험 프로그램 조율",
      "4. [홍보/접수] 행사 메인 포스터 최종 감수 및 대구민 사전접수 시스템 연계 준비\n   - 내용: 공동개최 기관 표기 포스터 최종 감수, 10. 1. 보건소 통합예약시스템(800명 선착순) 접수 페이지 등록 사전 점검",
      "5. [현장/안전] 행사장 시설 사용 협조 및 1,000명 인파 대비 안전관리 대책 수립\n   - 내용: 수변문화센터 외부(치수과)·내부(문화도시과) 시설 사용 조율, 남부혈액원 주차 협조(5대) 및 응급 안전 동선 구축"
    ]
  },
  "milestones": [
    {
      "id": 1,
      "number": "추진과제 1",
      "title": "장소 및 일시 확정",
      "status": "done",
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
        "[완료][26.8.29.][참여:과장님, 지영팀장님, 오창선, 제이민] 대행사 미팅 3 : 세부 운영안 조율",
        "[완료][26.9.1.][참여:과장님, 희선팀장님, 지영팀장님, 임석훤, 남상희, 오창선] 내부 회의 : 행사 추진 관련 전반, VIP 초청, 참가자 모집 방법, 보도자료 등 안건 협의",
        "[완료][26.9.9.][참여:과장님, 지영팀장님, 오창선] 강남구체육회(걷기협회) 구청장배 걷기대회 공동개최 협의 : ",
        "[완료][26.9.11.][참여:지영팀장님, 오창선, 걷기협회, 제이민] 신규 걷기 코스 답사 : 2km 코스",
        "[완료][26.9.15.][참여:과장님, 지영팀장님, 오창선, 강남구체육회, 강남구 걷기협회] 강남구체육회(걷기협회) 구청장배 걷기대회 공동개최 협의 : 체육회 미팅",
        "[완료][26.9.21.] 전 부서 행사 알림 및 협조 "
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
        "[예정][08:40~13:30] 부스 운영 시작 : ",
        "[예정][08:40~09:00] 식전 축하공연 (20분) : K-POP공연팀 무대",
        "[예정][09:00~09:02] 오프닝 (2분) : 사회자 공식 인사(김연태 MC)",
        "[예정][09:02~09:04] 국민의례 (2분) : 약식절차 1 준용 ① 국기에 대한 경례(전주 없는 애국가 반주 1절에 맞춰 실시, 맹세문 낭송 없음) ② 순국선열과 호국영령에 대한 묵념(묵념곡 10~15초 연주) ※ 의전주의: '애국가 제창 등 이하 생략' 멘트 절대 금지",
        "[예정][09:04~09:08] 내빈소개 (4분) : 주요 참석 내빈 소개",
        "[예정][09:08~09:15] 인사말씀 & 축사 (7분) : 구청장님 인사말씀 및 내빈 축사",
        "[예정][09:15~09:20] 레크레이션 (5분) : 바르게 걷기 운동 레크레이션",
        "[예정][09:20~09:30] 공연 & 준비운동 (10분) : 치어리더 '팜팜' 준비 체조",
        "[예정][09:30~09:40] 이동 (10분) : START 지점으로 이동",
        "[예정][09:45~09:45] 기념촬영 (5분) : START 아치에서 단체 기념촬영",
        "[예정][09:45~12:30] 걷기 출발 : 12시 30분 인센티브 배부 마감(예정)",
        "[예정][10:30~10:50] 축하공연 (20분) : 미정",
        "[예정][11:00~11:30] 축하공연 (30분) : 미정",
        "[예정][11:40~12:00] 레크레이션 (20분) : 스틱잡기챌린지",
        "[예정][13:30~14:30] 마무리 : 행사 마무리 및 행사장 환경 정비"
      ]
    },
    {
      "id": 3,
      "number": "추진과제 2",
      "title": "부스 운영",
      "status": "done",
      "period": "9월 1주 ~ 9월 2주",
      "cooperationDepts": [],
      "details": [
        "[완료][26.8.21.] 케이스튜디오(퍼스널컬러) 확정 : ",
        "[완료][26.8.24.] 한국신체정보(리얼피티) 확정 : ",
        "[완료][26.9.1.][참여:오창선, 고려대학교척추측만증연구소] 고려대학교척추측만증 연구소 부스 운영 확정 : 신청서 회신",
        "[완료][26.9.2.][참여:지영팀장님, 오창선] 부스 위치 답사 : 유디치과 검진버스 정차 위치 검토",
        "[완료][26.9.2.][참여:오창선] 의료관광팀 부스 운영 불가 : 강남 메디컬 투어 부스 운영 불가 통보(더 큰 행사 있음)",
        "[완료][26.9.2.][참여:오창선, 김형종, 한국신체정보(주)] 서울체력장 부스 운영 확정 : 내 신체나이 알아보기 체력 측정, 자세 분석 및 운동 처방 ",
        "[완료][26.9.4.][참여:오창선, 강남차병원] 강남차병원 부스 운영 확정 : 신청서 회신",
        "[완료][26.9.4.][참여:오창선, 서울대병원강남센터] 서울대병원 강남센터 부스 운영 확정 : 신청서 회신, *의자 6개 신청",
        "[완료][26.9.4.][참여:오창선, (주)유디] 유디 치과 부스 운영 확정 : 신청서 회신",
        "[완료][26.9.8.][참여:과장님, 오창선] 강남구 한의사회 부스 운영 확정 : ",
        "[완료][26.9.9.][참여:오창선] 보건소 내부 부스 운영 신청 공문 발송 : ",
        "[완료][26.9.9.][참여:김지현] 의약과 약무팀 부스 운영 신청서 제출 : ",
        "[완료][26.9.9.] 질병관리과 부스 운영신청서 제출",
        "[완료][26.9.11.] 의약과 의무 1팀 부스 운영 신청서 제출 : ",
        "[완료][26.9.14.] 건강관리과 부스 운영 신청서 제출 : ",
        "[완료][26.9.16.][참여:과장님, 오창선] 강남구의사회 부스 운영 확정 : ",
        "[완료][26.9.21.] 자생한방병원 부스 운영 신청서 제출 : "
      ]
    },
    {
      "id": 4,
      "number": "추진과제 3",
      "title": "홍보 및 행정사항",
      "status": "in-progress",
      "period": "9월 1주 ~ 10월 2주",
      "cooperationDepts": [
        "도시계획과",
        "정책홍보실",
        "주민자치과"
      ],
      "details": [
        "[완료][26.8.27.][참여:보건행정과-10515] [허가완료] 건설관리과: 행사장소 하천점용허가 신청 및 승인 완료 (개포동 1279 일원)",
        "[완료][26.9.3.][참여:보건행정과-10992] [협조완료] 공원녹지과: 출발마당(포이공원) 장소 및 전기 사용, 볼라드 개폐",
        "[완료][26.9.10][참여:과장님, 지영팀장님, 오창선] 동국제약 건강기능 식품 협찬 협의 : 행사 날 500만원 상당 건기식 협찬 협의",
        "[완료][26.9.21.][참여:오창선] 온라인 사전접수 시스템 오픈 : 보건소 통합예약 시스템 활용, 9.21. 부터 접수 시작",
        "[완료][26.9.21.] 보도자료 : 정책홍보실 10월 26일 게시 예정",
        "[예정][26.9.22.] 행사 포스터 제작 : ",
        "[예정] [협조예정] 도시계획과: 양재천 교량 및 산책로 현수막 게첨",
        "[예정] [협조예정] 주민자치과: 정례반상회 홍보자료 제출 및 행정복지센터 홍보 포스터 부착 협조",
        "[예정][참여:과장님] 인근 동 주민센터(개포·일원·대치·도곡 등) 동장님 협조 요청 : 관내 단체 및 주민 참여 독려",
        "[예정][참여:과장님] 개포 현대 2단지 아파트 입주자 대표회 미팅",
        "[예정][참여:오창선] 자원순환과 : 쓰레기 수거 협조",
        "[예정] 업무 분장 : ",
        "[예정] 수변문화쉼터 사용 및 행복콘서트 지원 협조 : 문화도시과",
        "[예정][참여:오창선] 남부혈액원 주차 5대 협조 공문 발송: "
      ]
    },
    {
      "id": 5,
      "number": "추진과제 4",
      "title": "방침 및 계약",
      "status": "in-progress",
      "period": "9월 1주 ~ 9월 3주",
      "cooperationDepts": [],
      "details": [
        "[진행] 행사 방침서 작성 중 : ",
        "[예정] 계약 방침",
        "[예정] 업무 분장 방침"
      ]
    },
    {
      "id": 6,
      "number": "추진과제 5",
      "title": "VIP 초청 관련",
      "status": "in-progress",
      "period": "9월 1주 ~ 10월 3주",
      "cooperationDepts": [
        "비서실"
      ],
      "details": [
        "[완료][9.3.][참여:지영팀장님] 구청장님 참석 비서실 협의: 참석 확정",
        "[예정] 의원 VIP 초청 진행 예정 : ",
        "[예정] 체육회 VIP..."
      ]
    },
    {
      "id": 7,
      "number": "추진과제 6",
      "title": "홍보물",
      "status": "todo",
      "period": "",
      "cooperationDepts": [],
      "details": [
        "[완료][26.9.16.] 동국제약 홍보물 : "
      ]
    }
  ],
  "booths": [
      {
            "id": 1,
            "category": "운영본부",
            "name": "보건행정과",
            "scale": "5동",
            "program": "운영본부(2동), 응급의료부스(1동), VIP 대기실(2동)",
            "status": "확정",
            "tables": 10,
            "chairs": 20,
            "staffCount": 0,
            "manager": "오창선",
            "phone": "02-3423-7116",
            "adminPhone": "02-3423-7116",
            "mobilePhone": "010-2217-5298",
            "electricity": "O",
            "electricityDetail": "케이터링(VIP)",
            "bannerText": "운영본부 / 응급의료센터 / 귀빈대기실",
            "remarks": ""
      },
      {
            "id": 2,
            "category": "보건소 부서",
            "name": "보건행정과 건강증진팀",
            "scale": "1동",
            "program": "금연 · 절주 · 영양 보건 사업 홍보 부스 및 건강생활실천 1:1 상담",
            "status": "확정",
            "tables": 2,
            "chairs": 6,
            "staffCount": 5,
            "manager": "심다영",
            "phone": "02-3423-7018",
            "adminPhone": "02-3423-7018",
            "mobilePhone": "010-3912-3269",
            "electricity": "X",
            "electricityDetail": "",
            "bannerText": "일상 속 건강생활실천! 금연·절주·영양 홍보",
            "remarks": ""
      },
      {
            "id": 3,
            "category": "보건소 부서",
            "name": "보건행정과 서울체력장",
            "scale": "2동",
            "program": "내 신체나이 알아보기, 서울체력장 인증 체력측정 (성인: 2분제자리걷기·악력, 시니어: 의자일어서기)",
            "status": "확정",
            "tables": 1,
            "chairs": 4,
            "staffCount": 3,
            "manager": "김형종",
            "phone": "02-3423-7250",
            "adminPhone": "02-3423-7250",
            "mobilePhone": "010-7567-8168",
            "electricity": "X",
            "electricityDetail": "",
            "bannerText": "서울체력장 강남센터, 내 신체나이 알아보기 & 체력측정 인증",
            "remarks": ""
      },
      {
            "id": 4,
            "category": "민간",
            "name": "한국신체정보(주)",
            "scale": "2동",
            "program": "내 신체나이 알아보기, 『리얼피티 프로 플러스』 40초 바른자세·체형 정밀 분석 및 AI 맞춤 운동처방",
            "status": "확정",
            "tables": 1,
            "chairs": 4,
            "staffCount": 2,
            "manager": "박준홍",
            "phone": "-",
            "adminPhone": "",
            "mobilePhone": "010-9985-3732",
            "electricity": "O",
            "electricityDetail": "43인치 키오스크, 프린터",
            "bannerText": "강남구민 “건강의 첫 걸음” 바른자세 검사",
            "remarks": ""
      },
      {
            "id": 5,
            "category": "보건소 부서",
            "name": "건강관리과 어르신건강팀",
            "scale": "2동",
            "program": "내 신체나이 알아보기 - 웰에이징센터 맞춤형 신체나이·근력 운동 실습 및 상담",
            "status": "확정",
            "tables": 4,
            "chairs": 7,
            "staffCount": 3,
            "manager": "홍기수",
            "phone": "02-3423-7985",
            "adminPhone": "02-3423-7985",
            "mobilePhone": "010-4279-0790",
            "electricity": "O",
            "electricityDetail": "태블릿 PC 2대",
            "bannerText": "내 신체나이 알아보기 - 웰에이징센터 맞춤형 운동프로그램",
            "remarks": ""
      },
      {
            "id": 6,
            "category": "보건소 부서",
            "name": "질병관리과 감염병예방팀",
            "scale": "2동",
            "program": "‘강남’구가 알려주고 ‘도’움되는 ‘감’염병 예방지식(강남도감) 퀴즈 및 수인성 감염병 예방 홍보",
            "status": "확정",
            "tables": 2,
            "chairs": 5,
            "staffCount": 6,
            "manager": "구채연",
            "phone": "02-3423-7106",
            "adminPhone": "02-3423-7106",
            "mobilePhone": "010-3071-9606",
            "electricity": "X",
            "electricityDetail": "",
            "bannerText": "‘강남’구가 알려주고 ‘도’움되는 ‘감’염병 예방지식(강남도감)",
            "remarks": ""
      },
      {
            "id": 7,
            "category": "보건소 부서",
            "name": "질병관리과 감염병대응팀",
            "scale": "1동",
            "program": "손은 깨끗하게, 진드기는 멀리! 건강한 강남 ON (뷰박스 손씻기 형광 체험, 진드기 기피제 배부)",
            "status": "확정",
            "tables": 2,
            "chairs": 10,
            "staffCount": 9,
            "manager": "이희경",
            "phone": "02-3423-7129",
            "adminPhone": "02-3423-7129",
            "mobilePhone": "02-3423-7129",
            "electricity": "X",
            "electricityDetail": "",
            "bannerText": "손은 깨끗하게, 진드기는 멀리! 건강한 강남 ON",
            "remarks": ""
      },
      {
            "id": 8,
            "category": "보건소 부서",
            "name": "질병관리과 만성질환관리팀",
            "scale": "1동",
            "program": "평생 건강의 지름길, 만성질환 관리로부터! (혈압·혈당 무료 측정 및 대사증후군 1:1 상담)",
            "status": "확정",
            "tables": 2,
            "chairs": 10,
            "staffCount": 5,
            "manager": "김영희",
            "phone": "02-3423-7112",
            "adminPhone": "02-3423-7112",
            "mobilePhone": "010-3455-4057",
            "electricity": "X",
            "electricityDetail": "",
            "bannerText": "평생 건강의 지름길, 만성질환 관리로부터!",
            "remarks": ""
      },
      {
            "id": 9,
            "category": "보건소 부서",
            "name": "의약과 의무1팀",
            "scale": "2동",
            "program": "생명을 살리는 4분의 기적, 두근두근 CPR 심폐소생술 및 자동심장충격기(AED) 실습 체험존",
            "status": "확정",
            "tables": 4,
            "chairs": 8,
            "staffCount": 3,
            "manager": "이상화",
            "phone": "02-3423-7158",
            "adminPhone": "02-3423-7158",
            "mobilePhone": "010-2613-3091",
            "electricity": "X",
            "electricityDetail": "",
            "bannerText": "두근두근 CPR 체험존",
            "remarks": ""
      },
      {
            "id": 10,
            "category": "보건소 부서",
            "name": "의약과 약무팀",
            "scale": "2동",
            "program": "불법 마약 근절 및 가정 내 폐의약품 안심 수거 캠페인 (마약류 모형 전시 및 OX 퀴즈, VR 체험)",
            "status": "확정",
            "tables": 4,
            "chairs": 8,
            "staffCount": 0,
            "manager": "김지현",
            "phone": "02-3423-7173",
            "adminPhone": "02-3423-7173",
            "mobilePhone": "010-2980-9011",
            "electricity": "O",
            "electricityDetail": "VR기기(오큘러스), 충전용 콘센트 필요",
            "bannerText": "호기심이 중독으로, 마약 접근 금지! - 불법 마약 근절 캠페인 부스 -",
            "remarks": ""
      },
      {
            "id": 11,
            "category": "보건소 부서",
            "name": "건강관리과 정신건강팀",
            "scale": "1동",
            "program": "마음건강 충전소 (우울·스트레스 선별검사, 마음안심버스 사업 홍보, 전문 정신건강 상담)",
            "status": "확정",
            "tables": 2,
            "chairs": 10,
            "staffCount": 4,
            "manager": "안세연",
            "phone": "02-3423-8796",
            "adminPhone": "02-3423-8796",
            "mobilePhone": "010-9147-8924",
            "electricity": "X",
            "electricityDetail": "",
            "bannerText": "마음건강 충전소",
            "remarks": ""
      },
      {
            "id": 12,
            "category": "보건소 부서",
            "name": "건강관리과 어르신건강팀",
            "scale": "1동",
            "program": "강남구치매안심센터 행복한 기억찾기 캠페인 (치매 선별검사 및 인지강화 프로그램)",
            "status": "확정",
            "tables": 4,
            "chairs": 7,
            "staffCount": 2,
            "manager": "이유리",
            "phone": "02-6380-5609",
            "adminPhone": "02-6380-5609",
            "mobilePhone": "",
            "electricity": "O",
            "electricityDetail": "태블릿 PC 1대",
            "bannerText": "강남구치매안심센터 행복한 기억찾기 캠페인",
            "remarks": ""
      },
      {
            "id": 13,
            "category": "민간",
            "name": "강남구의사회",
            "scale": "1동",
            "program": "강남구의사회 & 메드렉스병원 ‘머리부터 발끝까지 안전하게 걷자’ (관절·척추 정형외과 전문의 상담)",
            "status": "확정",
            "tables": 2,
            "chairs": 4,
            "staffCount": 8,
            "manager": "이지영",
            "phone": "02-549-0971",
            "adminPhone": "02-549-0971",
            "mobilePhone": "010-2279-5982",
            "electricity": "O",
            "electricityDetail": "노트북 충전",
            "bannerText": "강남구의사회·메드렉스병원이 함께하는 '머리부터 발끝까지 안전하게 걷자'",
            "remarks": ""
      },
      {
            "id": 14,
            "category": "민간",
            "name": "강남구한의사회",
            "scale": "2동",
            "program": "바른자세가 건강의 시작, 한의학을 통한 체형검사 체험존 (체형 균형 및 경락 건강 상담)",
            "status": "확정",
            "tables": 4,
            "chairs": 12,
            "staffCount": 6,
            "manager": "김명주",
            "phone": "-",
            "adminPhone": "",
            "mobilePhone": "010-9100-0785",
            "electricity": "",
            "electricityDetail": "",
            "bannerText": "바른자세가 건강의 시작 한의학을 통한 체형검사 체험존",
            "remarks": ""
      },
      {
            "id": 15,
            "category": "민간",
            "name": "서울대학교병원 강남센터",
            "scale": "1동",
            "program": "가정의학과 전문의 1:1 맞춤형 문진 및 만성질환 예방 생활습관 의학 전문 심층 상담",
            "status": "확정",
            "tables": 2,
            "chairs": 7,
            "staffCount": 5,
            "manager": "임동은",
            "phone": "02-2112-5487",
            "adminPhone": "02-2112-5487",
            "mobilePhone": "010-5663-8276",
            "electricity": "O",
            "electricityDetail": "노트북1, 혈압계3",
            "bannerText": "서울대학교병원 강남센터와 함께하는 맞춤형 문진 및 건강 상담",
            "remarks": ""
      },
      {
            "id": 16,
            "category": "민간",
            "name": "강남 차병원",
            "scale": "3동",
            "program": "중년 여성 유방 자가검진 촉지 교육, 부인과 여성질환 및 맞춤 영양 상담",
            "status": "확정",
            "tables": 6,
            "chairs": 16,
            "staffCount": 10,
            "manager": "김규리",
            "phone": "02-3468-3226",
            "adminPhone": "02-3468-3226",
            "mobilePhone": "010-2698-0992",
            "electricity": "O",
            "electricityDetail": "미량영양소 측정기기2대\n태블릿 2대 충전용 콘센트",
            "bannerText": "CHA의과학대학교 강남차병원, 여성 건강 지킴이",
            "remarks": ""
      },
      {
            "id": 17,
            "category": "민간",
            "name": "자생한방병원",
            "scale": "2동",
            "program": "척추·관절 간이 침 치료, 근육 테이핑 요법 시연 및 척추 건강 1:1 한방 상담",
            "status": "확정",
            "tables": 4,
            "chairs": 10,
            "staffCount": 7,
            "manager": "김봉진",
            "phone": "1577-0007",
            "adminPhone": "1577-0007",
            "mobilePhone": "010-9931-0994",
            "electricity": "X",
            "electricityDetail": "",
            "bannerText": "한방척추전문병원 자생한방병원 의료지원",
            "remarks": ""
      },
      {
            "id": 18,
            "category": "민간",
            "name": "유디치과",
            "scale": "1동",
            "program": "이동형 대형 치과검진버스 연계 구강 검진 및 구강건강 관리법 안내, 칫솔질 실습",
            "status": "확정",
            "tables": 2,
            "chairs": 4,
            "staffCount": 12,
            "manager": "유규열",
            "phone": "02-6268-5339",
            "adminPhone": "02-6268-5339",
            "mobilePhone": "010-5192-2210",
            "electricity": "O",
            "electricityDetail": "부스 TV 설치, 버스(자가발전)",
            "bannerText": "유디치과와 함께하는 건강관리",
            "remarks": ""
      },
      {
            "id": 19,
            "category": "민간",
            "name": "고려대학교 척추측만증연구소",
            "scale": "2동",
            "program": "거북목·척추측만증 X-Ray 무료 방사선 촬영 및 척추교정 전문의 1:1 상담",
            "status": "확정",
            "tables": 4,
            "chairs": 8,
            "staffCount": 4,
            "manager": "전예진",
            "phone": "-",
            "adminPhone": "",
            "mobilePhone": "010-7935-3095",
            "electricity": "O",
            "electricityDetail": "X-ray 버스(220v 가능)",
            "bannerText": "고려대학교 척추측만증연구소, 척추 건강 체크존",
            "remarks": ""
      },
      {
            "id": 20,
            "category": "민간",
            "name": "케이스튜디오 (디아르스)",
            "scale": "1동",
            "program": "1:1 퍼스널 컬러 진단 및 계절별 산책·야외운동 맞춤 메이크업 재능기부 봉사",
            "status": "확정",
            "tables": 2,
            "chairs": 6,
            "staffCount": 4,
            "manager": "고명규",
            "phone": "-",
            "adminPhone": "",
            "mobilePhone": "010-9788-9471",
            "electricity": "X",
            "electricityDetail": "",
            "bannerText": "디아르스, 퍼스널 컬러 진단 및 산책을 위한 메이크업",
            "remarks": ""
      }
],
  "schedule": [
    {
      "id": 1,
      "phase": "식전·준비",
      "time": "07:30 ~ 08:00",
      "duration": "30분",
      "title": "직원 출근 및 사전 준비",
      "lead": "보건행정과",
      "status": "예정",
      "note": "행사 참여 직원 현장 도착, 출석 확인 및 명찰 배부, 무대·부스 점검"
    },
    {
      "id": 2,
      "phase": "식전·준비",
      "time": "08:00 ~ 08:30",
      "duration": "30분",
      "title": "행사 준비 및 현장 점검",
      "lead": "(주)제이민",
      "status": "예정",
      "note": "음향 BGM 송출, 무대 전력망 점검, 응급의료부스 및 구급차(2대) 배치 확인"
    },
    {
      "id": 3,
      "phase": "식전·준비",
      "time": "08:00 ~ 09:00",
      "duration": "60분",
      "title": "참가자 등록 및 안내",
      "lead": "운영본부",
      "status": "예정",
      "note": "사전접수(800명) 및 현장접수 확인, 배번호표 배부, 코스 리플릿 안내"
    },
    {
      "id": 4,
      "phase": "식전·준비",
      "time": "08:40 ~ 09:00",
      "duration": "20분",
      "title": "식전 축하공연",
      "lead": "공연팀",
      "status": "예정",
      "note": "K-POP 커버댄스 무대 공연"
    },
    {
      "id": 5,
      "phase": "공식행사",
      "time": "08:40 ~ 13:30",
      "duration": "290분",
      "title": "18개 의료·건강 체험 부스 운영",
      "lead": "보건소 및 협력기관",
      "status": "예정",
      "note": "수변문화쉼터 부스(18동) 가동 (서울체력장, CPR, 한방·치과·정형·척추 검진)"
    },
    {
      "id": 6,
      "phase": "공식행사",
      "time": "09:00 ~ 09:02",
      "duration": "2분",
      "title": "개회식 오프닝",
      "lead": "김연태 MC",
      "status": "예정",
      "note": "제8회 강남구청장배 걷기대회 연계 행사 개식 선언"
    },
    {
      "id": 7,
      "phase": "공식행사",
      "time": "09:02 ~ 09:04",
      "duration": "2분",
      "title": "국민의례",
      "lead": "사회자",
      "status": "예정",
      "note": "대통령훈령 제438호 약식절차 1 준용: ① 국기에 대한 경례(애국가 1절 반주, 맹세문 미낭송) ② 묵념(묵념곡 10~15초) ※ '애국가 제창 등 생략' 멘트 사용 금지"
    },
    {
      "id": 8,
      "phase": "공식행사",
      "time": "09:04 ~ 09:08",
      "duration": "4분",
      "title": "내빈 소개",
      "lead": "김연태 MC",
      "status": "예정",
      "note": "구청장, 국회의원, 시·구의원, 체육회장 등 참석 내빈 소개"
    },
    {
      "id": 9,
      "phase": "공식행사",
      "time": "09:08 ~ 09:15",
      "duration": "7분",
      "title": "개회사 및 내빈 축사",
      "lead": "구청장 및 내빈",
      "status": "예정",
      "note": "구청장 개회사, 구의회의장 및 주요 내빈 축사"
    },
    {
      "id": 10,
      "phase": "공식행사",
      "time": "09:15 ~ 09:20",
      "duration": "5분",
      "title": "체육회 표창 수여 및 레크레이션",
      "lead": "걷기협회 / MC",
      "status": "예정",
      "note": "걷기 활성화 유공 구민 표창장 수여 및 바르게 걷기 레크레이션"
    },
    {
      "id": 11,
      "phase": "공식행사",
      "time": "09:20 ~ 09:30",
      "duration": "10분",
      "title": "준비 체조 및 스트레칭",
      "lead": "치어리더팀",
      "status": "예정",
      "note": "출발 전 부상 방지를 위한 전신 스트레칭 및 준비 체조"
    },
    {
      "id": 12,
      "phase": "걷기대회",
      "time": "09:30 ~ 09:40",
      "duration": "10분",
      "title": "출발 지점(START 아치) 이동",
      "lead": "진행요원",
      "status": "예정",
      "note": "메인무대에서 포이공원 출발마당 START 아치 앞 집결선 이동"
    },
    {
      "id": 13,
      "phase": "걷기대회",
      "time": "09:40 ~ 09:45",
      "duration": "5분",
      "title": "대회 출발 기념촬영",
      "lead": "구청장·내빈·참가자",
      "status": "예정",
      "note": "출발 아치 앞 단체 기념촬영"
    },
    {
      "id": 14,
      "phase": "걷기대회",
      "time": "09:45 ~ 12:30",
      "duration": "165분",
      "title": "2km 건강 걷기 대회 출발",
      "lead": "걷기협회",
      "status": "예정",
      "note": "수변문화쉼터 ↔ 영동4교 2km 코스 완주 (12:30 인센티브 배부 마감)"
    },
    {
      "id": 15,
      "phase": "공연·폐회",
      "time": "10:15 ~ 10:35",
      "duration": "20분",
      "title": "부스 운영 직원 격려 순회",
      "lead": "구청장",
      "status": "예정",
      "note": "18개 부스 순회 방문 및 의료진·스태프 격려"
    },
    {
      "id": 16,
      "phase": "공연·폐회",
      "time": "10:30 ~ 12:00",
      "duration": "90분",
      "title": "수변 버스킹 공연 및 레크레이션",
      "lead": "문화도시과 / MC",
      "status": "예정",
      "note": "행복콘서트 버스킹 공연(2회) 및 스틱잡기 챌린지"
    },
    {
      "id": 17,
      "phase": "공연·폐회",
      "time": "13:30 ~ 14:30",
      "duration": "60분",
      "title": "행사 종료 및 행사장 환경 정비",
      "lead": "보건행정과 / 자원순환과",
      "status": "예정",
      "note": "부스 철거, 시설물 원상복구 및 쓰레기 수거 정비"
    }
  ],
  "duties": [
      {
            "id": 1,
            "category": "운영",
            "deptOrOrg": "보건행정과 건강증진팀",
            "role": "행사 총괄기획 및 운영본부 총괄",
            "manager": "오창선",
            "phone": "02-3423-7116",
            "adminPhone": "02-3423-7116",
            "mobilePhone": "010-2217-5298",
            "tasks": [
                  "행사 기본계획 수립 및 전체 운영본부(2동) 총괄 지휘",
                  "보건소 전 직원 출근 등록 및 진행요원 명찰 배부",
                  "참가자(800명) 안내데스크 접수 및 완주 확인증 등록",
                  "비상상황실 운영 및 유관기관 협조 핫라인 총괄"
            ],
            "staffMembers": [
                  {
                        "name": "오창선",
                        "role": "총괄",
                        "adminPhone": "02-3423-7116",
                        "mobilePhone": "010-2217-5298"
                  }
            ]
      },
      {
            "id": 2,
            "category": "운영",
            "deptOrOrg": "(주)제이민 커뮤니케이션",
            "role": "행사 연출 및 무대·음향 총괄",
            "manager": "김다희 팀장",
            "phone": "010-8494-0544",
            "adminPhone": "",
            "mobilePhone": "010-8494-0544",
            "tasks": [
                  "메인 무대 설치, 150kW 전력망 구축 및 음향 설비 총괄",
                  "출발·도착 에어아치 및 안전 펜스 시공",
                  "전문 MC(김연태) 진행 보조, 식전 공연팀 및 음향 BGM 운영",
                  "참가자 기념품 및 완보 배번호표 배부처 운영 지원"
            ],
            "staffMembers": [
                  {
                        "name": "김다희",
                        "role": "팀장",
                        "adminPhone": "",
                        "mobilePhone": "010-8494-0544"
                  }
            ]
      },
      {
            "id": 3,
            "category": "코스",
            "deptOrOrg": "강남구체육회(걷기협회)",
            "role": "걷기대회 공동 주관 및 코스 인솔",
            "manager": "진우복 / 채희경",
            "phone": "02-3462-7330",
            "adminPhone": "02-3462-7330",
            "mobilePhone": "010-7137-7397",
            "tasks": [
                  "제8회 강남구청장배 걷기대회 공동 주관 및 참가자(250명) 리드",
                  "2km 걷기 코스(수변문화쉼터 ↔ 영동4교) 주로 구간별 안전 관리",
                  "영동3교 하부 등 병목구간 안전요원 배치 및 보행자 우측통행 유도",
                  "자전거 도로 진입 차단선 통제 및 낙상 사고 예방"
            ],
            "staffMembers": [
                  {
                        "name": "진우복",
                        "role": "회장",
                        "adminPhone": "02-3462-7330",
                        "mobilePhone": "010-7137-7397"
                  },
                  {
                        "name": "채희경",
                        "role": "사무국장",
                        "adminPhone": "02-3462-7330",
                        "mobilePhone": "010-7137-7397"
                  }
            ]
      },
      {
            "id": 4,
            "category": "코스",
            "deptOrOrg": "의약과 의무1팀 및 협력병원",
            "role": "현장 응급의료 및 코스 구급 대책",
            "manager": "이상화",
            "phone": "02-3423-7158",
            "adminPhone": "02-3423-7158",
            "mobilePhone": "010-2613-3091",
            "tasks": [
                  "응급의료부스 설치 및 간호사·응급구조사 상시 대기",
                  "행사장 및 주로 내 전용 특수구급차 2대 현장 배치",
                  "코스 내 부상자 발생 시 신속 응급처치 및 이송",
                  "강남세브란스병원·삼성서울병원 응급실 후송 핫라인 유지"
            ],
            "staffMembers": [
                  {
                        "name": "이상화",
                        "role": "의무총괄",
                        "adminPhone": "02-3423-7158",
                        "mobilePhone": "010-2613-3091"
                  }
            ]
      },
      {
            "id": 5,
            "category": "부스",
            "deptOrOrg": "보건소 10개 부서 및 민간의료 9개 기관",
            "role": "36동 건강체험부스 및 검진버스 운영 총괄",
            "manager": "김지영 팀장 / 심다영",
            "phone": "02-3423-7018",
            "adminPhone": "02-3423-7018",
            "mobilePhone": "010-3912-3269",
            "tasks": [
                  "19개 운영단위 36동 MQ 부스 집기(테이블 64, 의자 166) 배분 완료",
                  "이동형 검진버스 2대(유디치과 45인승, 고대 척추 X-ray 25인승) 안전 정차 및 전력 직결",
                  "부스별 상주인력(총 98명) 복무 관리 및 체험 프로그램 진행",
                  "3m×0.6m 공식 현수막 부착 상태 점검 및 안전 수칙 준수"
            ],
            "staffMembers": [
                  {
                        "name": "김지영",
                        "role": "팀장",
                        "adminPhone": "02-3423-7018",
                        "mobilePhone": "010-3912-3269"
                  },
                  {
                        "name": "심다영",
                        "role": "주무관",
                        "adminPhone": "02-3423-7018",
                        "mobilePhone": "010-3912-3269"
                  }
            ]
      },
      {
            "id": 6,
            "category": "VIP의전",
            "deptOrOrg": "보건행정과",
            "role": "주요 내빈 의전 및 개회식 진행",
            "manager": "민지영 계장",
            "phone": "02-3423-7116",
            "adminPhone": "02-3423-7116",
            "mobilePhone": "",
            "tasks": [
                  "구청장님, 구의장님, 국회의원, 시·구의원 등 주요 내빈 맞이 및 안내",
                  "VIP 귀빈대기실(2동) 다과 케이터링 및 티타임 운영",
                  "개회식 식순 및 국민의례(대통령훈령 약식절차 1 준수, 맹세문 낭송 없음)",
                  "내빈 기념촬영(START 아치) 및 걷기 출발 징 타종 의전"
            ],
            "staffMembers": [
                  {
                        "name": "민지영",
                        "role": "계장",
                        "adminPhone": "02-3423-7116",
                        "mobilePhone": ""
                  }
            ]
      },
      {
            "id": 7,
            "category": "직원식사",
            "deptOrOrg": "보건행정과 운영지원반",
            "role": "행사 참여 직원 급식 및 복무 관리",
            "manager": "운영지원 담당",
            "phone": "02-3423-7116",
            "adminPhone": "02-3423-7116",
            "mobilePhone": "",
            "tasks": [
                  "행사 참여 전 직원(약 90여 명) 김밥·도시락 수령 및 보관",
                  "영동5교 남단 식사처 운영 및 부스 상주인력 2개 조 교대 식사(11:00~12:00)",
                  "운영본부 및 각 부스별 생수(얼음물), 간식 상시 공급",
                  "토요 행사 참여 직원 대체휴무(보건행정과 일괄) 복무 처리 지원"
            ],
            "staffMembers": [
                  {
                        "name": "운영지원 담당",
                        "role": "담당",
                        "adminPhone": "02-3423-7116",
                        "mobilePhone": ""
                  }
            ]
      },
      {
            "id": 8,
            "category": "쓰레기처리",
            "deptOrOrg": "자원순환과 및 (주)웅비환경",
            "role": "행사장 환경정비 및 쓰레기 수거·반출",
            "manager": "환경정비 담당",
            "phone": "02-3423-7116",
            "adminPhone": "02-3423-7116",
            "mobilePhone": "",
            "tasks": [
                  "행사장 6개 주요 구역 분리수거함 및 종량제 거치대 설치",
                  "행사 진행 중 인파 밀집지 쓰레기 상시 순회 수거",
                  "부스별 발생 의료폐기물 및 일반쓰레기 분리 반출 감독",
                  "14:00~14:30 행사 종료 즉시 행사장 및 수변쉼터 일대 원상복구 클린업"
            ],
            "staffMembers": [
                  {
                        "name": "환경정비 담당",
                        "role": "담당",
                        "adminPhone": "02-3423-7116",
                        "mobilePhone": ""
                  }
            ]
      }
]
};

export const initialFallbackData = YANGJAE_FALLBACK_DATA;

export function useYangjaeFestival(isActive: boolean = true) {
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
    refetchInterval: isActive ? 2500 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: isActive,
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
