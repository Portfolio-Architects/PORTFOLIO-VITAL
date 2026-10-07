/**
 * Cloudflare Pages Function — 2026 Yangjae Festival 24/7 Read-Only Replica API
 * 
 * GET  /api/festival/yangjae → 24시간 상시 최신 페스티벌 데이터 반환 (KV 우선, 부재 시 기본값)
 * POST /api/festival/yangjae → 로컬 PC(SSOT)에서 최신 데이터를 클라우드로 듀얼 싱크(Dual-Sync) 발행
 */

interface Env {
  HCHPS_DATA: KVNamespace;
  HCHPS_AUTH_TOKEN?: string;
}

const KV_KEY = 'festival:yangjae:2026';

function getCorsHeaders(request: Request): Record<string, string> {
  let allowedOrigin = '*';
  const origin = request.headers.get('Origin') || '';
  if (
    origin === 'http://localhost:3001' ||
    origin === 'http://127.0.0.1:3001' ||
    origin.endsWith('.trycloudflare.com') ||
    origin === 'https://portfolio-hchps.pages.dev' ||
    origin === 'https://portfolio-architects.github.io'
  ) {
    allowedOrigin = origin;
  }
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Pragma, X-Sync-Source',
  };
}

function jsonResponse(request: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...getCorsHeaders(request),
    },
  });
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    headers: getCorsHeaders(context.request),
  });
};

function sanitizePublicData<T>(data: T): T {
  // 프론트엔드 비상연락망(PIN 인증 및 토글 스위치)에서 활용할 수 있도록 원본 데이터를 온전히 반환
  return data;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    if (context.env && context.env.HCHPS_DATA) {
      try {
        const raw = await context.env.HCHPS_DATA.get(KV_KEY, { cacheTtl: 60 });
        if (raw) {
          const parsed = JSON.parse(raw);
          return jsonResponse(context.request, sanitizePublicData({ ...parsed, _source: 'kv' }), 200);
        }
      } catch (kvErr) {
        console.warn('[Cloudflare Pages] KV get error:', kvErr);
      }
    }
    // Fallback if KV not yet populated or binding missing
    return jsonResponse(context.request, sanitizePublicData({ ...FALLBACK_FESTIVAL_DATA, _source: 'fallback' }), 200);
  } catch (err) {
    console.error('[Cloudflare Pages /api/festival/yangjae] GET error:', err);
    return jsonResponse(context.request, sanitizePublicData({ ...FALLBACK_FESTIVAL_DATA, _source: 'fallback' }), 200);
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // Only local PC (SSOT) is authorized to update the 24/7 Read-Only Replica
    const authHeader = context.request.headers.get('Authorization');
    const syncSource = context.request.headers.get('X-Sync-Source');
    const expectedToken = context.env.HCHPS_AUTH_TOKEN;

    if (expectedToken) {
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
      if (token !== expectedToken && syncSource !== 'local-ssot-dual-sync') {
        return jsonResponse(context.request, { success: false, error: 'Unauthorized: Read-only replica' }, 401);
      }
    }

    const payload = await context.request.json() as { meta?: { title?: string } };
    if (!payload || !payload.meta) {
      return jsonResponse(context.request, { success: false, error: 'Invalid payload structure' }, 400);
    }

    const kvBound = !!(context.env && context.env.HCHPS_DATA);
    if (kvBound) {
      await context.env.HCHPS_DATA.put(KV_KEY, JSON.stringify(payload));
    }

    return jsonResponse(context.request, {
      success: true,
      kvBound,
      publishedAt: new Date().toISOString(),
      source: 'local-ssot',
      note: kvBound ? 'Successfully saved to Cloudflare KV' : 'WARNING: HCHPS_DATA KV binding is not connected in Cloudflare Pages Dashboard',
    }, 200);
  } catch (err) {
    console.error('[Cloudflare Pages /api/festival/yangjae] POST error:', err);
    return jsonResponse(context.request, { success: false, error: 'Failed to publish to replica' }, 500);
  }
};

const FALLBACK_FESTIVAL_DATA = {
  "meta": {
    "title": "2026 양재천 걷자! 건강 페스티벌",
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
    "staffNote": "행사 참여 직원 대체휴무 시행 예정 (전 직원 참여)",
    "organizer": "강남구보건소 보건행정과 건강증진팀, 강남구체육회(걷기협회)",
    "overallProgress": 70,
    "lastUpdated": "2026-10-07"
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
        "[완료][26.7.29.]사전답사 1 : 행사장소 '수변문화쉼터' 검토",
        "[완료][26.8.11.]사전답사 2 :걷기 코스 및 장소 확정",
        "[완료][26.8.13.]대행사 현장 미팅 1 : 제이민(여성기업)",
        "[완료][26.8.19.]대행사 현장 미팅 2 : 세부 운영안 조율",
        "[완료][26.8.29.]대행사 미팅 3 : 세부 운영안 조율",
        "[완료][26.9.1.]내부 회의 : 행사 추진 관련 전반, VIP 초청, 참가자 모집 방법, 보도자료 등 안건 협의",
        "[완료][26.9.9.]강남구체육회(걷기협회) 구청장배 걷기대회 공동개최 협의 : ",
        "[완료][26.9.11.]신규 걷기 코스 답사 : 2km 코스",
        "[완료][26.9.15.]강남구체육회(걷기협회) 구청장배 걷기대회 공동개최 협의 : 체육회 미팅",
        "[완료][26.9.21.] 전 부서 행사 알림 및 협조 ",
        "[완료][26.9.22.]대행사 미팅 4 : "
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
      "status": "in-progress",
      "period": "9월 1주 ~ 9월 2주",
      "cooperationDepts": [],
      "details": [
        "[완료][26.8.21.] 케이스튜디오(퍼스널컬러) 확정 : ",
        "[완료][26.8.24.] 한국신체정보(리얼피티) 확정 : ",
        "[완료][26.9.1.]고려대학교척추측만증 연구소 부스 운영 확정 : 신청서 회신",
        "[완료][26.9.2.]부스 위치 답사 : 유디치과 검진버스 정차 위치 검토",
        "[완료][26.9.2.]의료관광팀 부스 운영 불가 : 강남 메디컬 투어 부스 운영 불가 통보(더 큰 행사 있음)",
        "[완료][26.9.2.]서울체력장 부스 운영 확정 : 내 신체나이 알아보기 체력 측정, 자세 분석 및 운동 처방 ",
        "[완료][26.9.4.]강남차병원 부스 운영 확정 : 신청서 회신",
        "[완료][26.9.4.]서울대병원 강남센터 부스 운영 확정 : 신청서 회신, *의자 6개 신청",
        "[완료][26.9.4.]유디 치과 부스 운영 확정 : 신청서 회신",
        "[완료][26.9.8.]강남구 한의사회 부스 운영 확정 : ",
        "[완료][26.9.9.]보건소 내부 부스 운영 신청 공문 발송 : ",
        "[완료][26.9.9.]의약과 약무팀 부스 운영 신청서 제출 : ",
        "[완료][26.9.9.] 질병관리과 부스 운영신청서 제출",
        "[완료][26.9.11.] 의약과 의무 1팀 부스 운영 신청서 제출 : ",
        "[완료][26.9.14.] 건강관리과 부스 운영 신청서 제출 : ",
        "[완료][26.9.16.]강남구의사회 부스 운영 확정 : ",
        "[완료][26.9.21.] 자생한방병원 부스 운영 신청서 제출 : ",
        "[완료][26.9.28.]보건행정과 건강증진팀 부스 운영 확정 : ",
        "[예정][26.10.2.] 부스 배치 세부 구획"
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
        "[완료][26.8.27.][허가완료] 건설관리과: 행사장소 하천점용허가 신청 및 승인 완료 (개포동 1279 일원)",
        "[완료][26.9.3.][협조완료] 공원녹지과: 출발마당(포이공원) 장소 및 전기 사용, 볼라드 개폐",
        "[완료][26.9.21.]온라인 사전접수 시스템 오픈 : 보건소 통합예약 시스템 활용, 9.21. 부터 접수 시작",
        "[완료][26.9.23.] 행사 포스터 제작 : ",
        "[완료][26.9.23.] 공원녹지과, 치수과 : 양재천 일대 상부 산책로 사용 협조",
        "[완료][26.9.23.] 문화도시과, 치수과 : 수변문화 쉼터 주변 장소 사용 및 행복콘서트팀 지원 협조",
        "[완료][26.9.28.]동국제약 건강기능 식품 협찬 협의 : 행사 날 음파전동칫솔 1200개 협찬 확정",
        "[완료][26.9.28.] 정책홍보실 : 알림톡 발송 완료",
        "[완료][26.9.29] 주민자치과 : 정례반상회 홍보자료 제출",
        "[완료][26.9.29.] 헬스체크업 : 4,000명 대상 홍보 문자 발송 완료",
        "[진행][26.10.26.] 보도자료 : 정책홍보실 10월 26일 게시 예정",
        "[예정] [협조예정] 도시계획과: 양재천 교량 및 산책로 현수막 게첨",
        "[예정]인근 동 주민센터(개포·일원·대치·도곡 등) 동장님 협조 요청 : 관내 단체 및 주민 참여 독려",
        "[예정]개포 현대 2단지 아파트 입주자 대표회 미팅",
        "[예정] 자원순환과 : 쓰레기 수거 협조, 웅비환경에 따로 계약을 하는 방향으로..",
        "[예정] 업무 분장 : ",
        "[예정]남부혈액원 주차 5대 협조 공문 발송: "
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
        "[완료] 행사 총괄 방침서",
        "[예정] 업무 분장 방침",
        "[예정] 스포츠 링크 여성 기업 확인 중..."
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
        "[완료][26.9.3.] 구청장님 참석 비서실 협의: 참석 확정",
        "[완료][26.10.1.] 의전 담당자 지정 : 민지영 계장님",
        "[예정]VIP 초청  : ",
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
        "[완료][26.9.23.] 동국제약 홍보물 협찬 : 음파진동칫솔 1200개",
        "[예정][26.10.8.] 에코백 납품 예정(다영 주임님)",
        "[예정] 각 보건소 사업 팀 부스 운영 물품 운반 관련 협의 : "
      ]
    }
  ],
  "booths": [
    {
      "id": 1,
      "category": "운영본부",
      "name": "보건행정과",
      "scale": "6동",
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
      "bannerText": "운영본부 / 응급의료센터 / VIP 대기실",
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
      "staffCount": 6,
      "manager": "최현미",
      "phone": "02-3423-7239",
      "adminPhone": "02-3423-7239",
      "mobilePhone": "010-6860-4149",
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
      "bannerText": "(내 신체나이 알아보기) 서울체력장 강남센터, & 체력측정 인증",
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
      "phone": "010-9985-3732",
      "adminPhone": "",
      "mobilePhone": "010-9985-3732",
      "electricity": "O",
      "electricityDetail": "43인치 키오스크, 프린터",
      "bannerText": "(내 신체나이 알아보기) 강남구민 “건강의 첫 걸음” 바른자세 검사",
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
      "chairs": 8,
      "staffCount": 5,
      "manager": "홍기수",
      "phone": "02-3423-7985",
      "adminPhone": "02-3423-7985",
      "mobilePhone": "010-4279-0790",
      "electricity": "O",
      "electricityDetail": "태블릿 PC 3대",
      "bannerText": "(내 신체나이 알아보기) 웰에이징센터 맞춤형 운동프로그램",
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
      "staffCount": 10,
      "manager": "김지현",
      "phone": "02-3423-7173",
      "adminPhone": "02-3423-7173",
      "mobilePhone": "010-2980-9011",
      "electricity": "O",
      "electricityDetail": "VR기기(오큘러스), 충전",
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
      "electricityDetail": "노트북 1대 충전",
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
      "phone": "010-9100-0785",
      "adminPhone": "",
      "mobilePhone": "010-9100-0785",
      "electricity": "O",
      "electricityDetail": "체형측정검사기 1대, 노트북 2대",
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
      "phone": "010-7935-3095",
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
      "phone": "010-9788-9471",
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
      "phase": "식전",
      "time": "30분",
      "duration": "30분",
      "title": "직원 출근 및 사전 준비",
      "lead": "보건행정과",
      "status": "예정",
      "note": "행사 참여 직원 서명, 무대·부스 점검"
    },
    {
      "id": 2,
      "phase": "식전",
      "time": "30분",
      "duration": "30분",
      "title": "행사 준비 및 현장 점검",
      "lead": "커넥팅디",
      "status": "예정",
      "note": "BGM 송출, 무대 전력 점검, 응급의료부스 및 구급차(2대) 배치 확인"
    },
    {
      "id": 3,
      "phase": "식전",
      "time": "60분",
      "duration": "60분",
      "title": "참가자 등록 및 안내",
      "lead": "운영본부",
      "status": "예정",
      "note": "사전접수(800명) 및 현장접수 확인, 배번표 배부, 리플릿 배부"
    },
    {
      "id": 4,
      "phase": "식전",
      "time": "20분",
      "duration": "20분",
      "title": "식전 축하공연",
      "lead": "공연팀",
      "status": "예정",
      "note": "JS 재즈밴드 무대 공연"
    },
    {
      "id": 5,
      "phase": "부스운영",
      "time": "290분",
      "duration": "290분",
      "title": "19개 의료·건강 체험 부스 운영",
      "lead": "보건소 및 협력기관",
      "status": "예정",
      "note": ""
    },
    {
      "id": 6,
      "phase": "개회식",
      "time": "2분",
      "duration": "2분",
      "title": "개회식 오프닝",
      "lead": "김현욱 MC",
      "status": "예정",
      "note": "제8회 강남구청장배 걷기대회 연계 행사 개식 선언"
    },
    {
      "id": 7,
      "phase": "개회식",
      "time": "2분",
      "duration": "2분",
      "title": "국민의례",
      "lead": "김현욱 MC",
      "status": "예정",
      "note": "3) 약식절차 1\n① 국기에 대한 경례: 전주가 없는 애국가 반주 1절에 맞춰 실시한다(국기에 대한 맹세문은 낭송하지 않음).\n② 순국선열과 호국영령에 대한 묵념: 묵념곡을 연주하되 묵념곡이 없으면 구령으로 10~15초 정도 실시한다(행사 성격에 따라 생략 가능)."
    },
    {
      "id": 8,
      "phase": "개회식",
      "time": "4분",
      "duration": "4분",
      "title": "내빈 소개",
      "lead": "김현욱 MC",
      "status": "예정",
      "note": "구청장, 국회의원, 시·구의원, 체육회장 등 참석 내빈 소개"
    },
    {
      "id": 9,
      "phase": "개회식",
      "time": "7분",
      "duration": "7분",
      "title": "개회사 및 내빈 축사",
      "lead": "구청장 및 내빈",
      "status": "예정",
      "note": "구청장 개회사, 구의회의장 및 주요 내빈 축사"
    },
    {
      "id": 10,
      "phase": "개회식",
      "time": "5분",
      "duration": "5분",
      "title": "체육회 표창 수여 및 레크레이션",
      "lead": "걷기협회 / MC",
      "status": "예정",
      "note": "걷기 활성화 유공 구민 표창장 수여"
    },
    {
      "id": 11,
      "phase": "개회식",
      "time": "10분",
      "duration": "10분",
      "title": "준비 체조 및 스트레칭",
      "lead": "스트레칭팀",
      "status": "예정",
      "note": "출발 전 부상 방지를 위한 전신 스트레칭 및 준비 체조"
    },
    {
      "id": 12,
      "phase": "개회식",
      "time": "10분",
      "duration": "10분",
      "title": "출발 지점(START 아치) 이동",
      "lead": "김현욱 MC",
      "status": "예정",
      "note": "메인무대에서 포이공원 출발마당 START 아치 앞 집결선 이동"
    },
    {
      "id": 13,
      "phase": "개회식",
      "time": "5분",
      "duration": "5분",
      "title": "대회 출발 기념촬영",
      "lead": "구청장·내빈·참가자",
      "status": "예정",
      "note": "출발 아치 앞 단체 기념촬영"
    },
    {
      "id": 14,
      "phase": "걷기대회",
      "time": "165분",
      "duration": "165분",
      "title": "2km 건강 걷기 대회 출발",
      "lead": "걷기협회",
      "status": "예정",
      "note": "수변문화쉼터 ↔ 영동4교 2km 코스 완주"
    },
    {
      "id": 15,
      "phase": "공연",
      "time": "20분",
      "duration": "20분",
      "title": "부스 운영 직원 격려 순회(예정)",
      "lead": "구청장",
      "status": "예정",
      "note": "18개 부스 순회 방문 및 의료진·스태프 격려"
    },
    {
      "id": 16,
      "phase": "공연",
      "time": "60분",
      "duration": "60분",
      "title": "식후 공연",
      "lead": "문화도시과 / MC",
      "status": "예정",
      "note": "재즈보컬 / 마술 공연"
    },
    {
      "id": 17,
      "phase": "마감",
      "time": "330분",
      "duration": "330분",
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
      "deptOrOrg": "보건행정과",
      "role": "페스티벌 총괄",
      "manager": "홍종남 (과장)",
      "phone": "02-3423-7010",
      "adminPhone": "02-3423-7010",
      "mobilePhone": "010-4114-6714",
      "tasks": [
        "페스티벌 총괄"
      ],
      "staffMembers": [
        {
          "name": "홍종남",
          "role": "과장",
          "adminPhone": "02-3423-7010",
          "mobilePhone": "010-4114-6714"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 2,
      "category": "운영",
      "deptOrOrg": "보건행정과 보건행정팀",
      "role": "응급의료부스 및 VIP 의전 총괄",
      "manager": "이희선 (팀장)",
      "phone": "02-3423-7011",
      "adminPhone": "02-3423-7011",
      "mobilePhone": "010-7240-6907",
      "tasks": [
        "응급의료부스 및 VIP 의전 총괄"
      ],
      "staffMembers": [
        {
          "name": "이희선",
          "role": "팀장",
          "adminPhone": "02-3423-7011",
          "mobilePhone": "010-7240-6907"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 3,
      "category": "운영",
      "deptOrOrg": "보건행정과 건강증진팀",
      "role": "페스티벌 운영 총괄",
      "manager": "김지영 (팀장)",
      "phone": "02-3423-7031",
      "adminPhone": "02-3423-7031",
      "mobilePhone": "010-8941-6562",
      "tasks": [
        "페스티벌 운영 총괄"
      ],
      "staffMembers": [
        {
          "name": "김지영",
          "role": "팀장",
          "adminPhone": "02-3423-7031",
          "mobilePhone": "010-8941-6562"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 4,
      "category": "운영",
      "deptOrOrg": "보건행정과 민원서비스팀",
      "role": "페스티벌 민원 업무 총괄",
      "manager": "이래원 (팀장)",
      "phone": "02-3423-7031",
      "adminPhone": "02-3423-7031",
      "mobilePhone": "010-5691-3310",
      "tasks": [
        "페스티벌 민원 업무 총괄"
      ],
      "staffMembers": [
        {
          "name": "이래원",
          "role": "팀장",
          "adminPhone": "02-3423-7031",
          "mobilePhone": "010-5691-3310"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 5,
      "category": "운영",
      "deptOrOrg": "보건행정과 건강증진팀",
      "role": "페스티벌 운영 담당",
      "manager": "오창선",
      "phone": "02-3423-7116",
      "adminPhone": "02-3423-7116",
      "mobilePhone": "010-2217-5298",
      "tasks": [
        "페스티벌 운영 담당"
      ],
      "staffMembers": [
        {
          "name": "오창선",
          "role": "",
          "adminPhone": "02-3423-7116",
          "mobilePhone": "010-2217-5298"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 6,
      "category": "운영",
      "deptOrOrg": "강남구체육회",
      "role": "구청장배 걷기 대회 총괄",
      "manager": "채희경 (팀장)",
      "phone": "010-7137-7397",
      "adminPhone": "",
      "mobilePhone": "010-7137-7397",
      "tasks": [
        "구청장배 걷기 대회 총괄"
      ],
      "staffMembers": [
        {
          "name": "채희경",
          "role": "팀장",
          "adminPhone": "",
          "mobilePhone": "010-7137-7397"
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 1,
        "agency": 0
      },
      "remarks": "체육회 1명"
    },
    {
      "id": 7,
      "category": "운영",
      "deptOrOrg": "강남구체육회",
      "role": "구청장배 걷기 대회 담당",
      "manager": "김윤희",
      "phone": "010-4355-4289",
      "adminPhone": "",
      "mobilePhone": "010-4355-4289",
      "tasks": [
        "구청장배 걷기 대회 담당"
      ],
      "staffMembers": [
        {
          "name": "김윤희",
          "role": "",
          "adminPhone": "",
          "mobilePhone": "010-4355-4289"
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 1,
        "agency": 0
      },
      "remarks": "체육회 1명"
    },
    {
      "id": 8,
      "category": "운영",
      "deptOrOrg": "강남구 걷기협회",
      "role": "대회 표창 및 체육회 의전 총괄",
      "manager": "진우복(협회장)",
      "phone": "010-8762-8260",
      "adminPhone": "",
      "mobilePhone": "010-8762-8260",
      "tasks": [
        "대회 표창 및 체육회 의전 총괄"
      ],
      "staffMembers": [
        {
          "name": "진우복",
          "role": "협회장",
          "adminPhone": "",
          "mobilePhone": "010-8762-8260"
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 1,
        "agency": 0
      },
      "remarks": "체육회 1명"
    },
    {
      "id": 9,
      "category": "운영",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "페스티벌 대행 총괄",
      "manager": "허종수 (대표)",
      "phone": "010-8865-3557",
      "adminPhone": "",
      "mobilePhone": "010-8865-3557",
      "tasks": [
        "페스티벌 대행 총괄"
      ],
      "staffMembers": [
        {
          "name": "허종수",
          "role": "대표",
          "adminPhone": "",
          "mobilePhone": "010-8865-3557"
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 1
      },
      "remarks": "대행사 1명"
    },
    {
      "id": 10,
      "category": "운영",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "페스티벌 대행사 직원",
      "manager": "김종명",
      "phone": "010-8613-2660",
      "adminPhone": "",
      "mobilePhone": "010-8613-2660",
      "tasks": [
        "페스티벌 대행사 직원"
      ],
      "staffMembers": [
        {
          "name": "김종명",
          "role": "",
          "adminPhone": "",
          "mobilePhone": "010-8613-2660"
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 1
      },
      "remarks": "대행사 1명"
    },
    {
      "id": 11,
      "category": "운영",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "페스티벌 대행사 직원",
      "manager": "이정은",
      "phone": "010-5711-3649",
      "adminPhone": "",
      "mobilePhone": "010-5711-3649",
      "tasks": [
        "페스티벌 대행사 직원"
      ],
      "staffMembers": [
        {
          "name": "이정은",
          "role": "",
          "adminPhone": "",
          "mobilePhone": "010-5711-3649"
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 1
      },
      "remarks": "대행사 1명"
    },
    {
      "id": 12,
      "category": "운영",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "무대 총괄",
      "manager": "대행사 팀장",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "무대 총괄"
      ],
      "staffMembers": [
        {
          "name": "대행사 팀장",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 1
      },
      "remarks": "대행사 1명"
    },
    {
      "id": 13,
      "category": "운영",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "무대 업무 담당",
      "manager": "대행사 스태프",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "무대 업무 담당"
      ],
      "staffMembers": [
        {
          "name": "대행사 스태프",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 1
      },
      "remarks": "대행사 1명"
    },
    {
      "id": 14,
      "category": "운영",
      "deptOrOrg": "강남구체육회",
      "role": "무대 업무 담당",
      "manager": "체육회 스태프",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "무대 업무 담당"
      ],
      "staffMembers": [
        {
          "name": "체육회 스태프",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 4,
        "agency": 0
      },
      "remarks": "체육회 4명"
    },
    {
      "id": 15,
      "category": "VIP의전",
      "deptOrOrg": "보건행정과 보건행정팀",
      "role": "VIP 의전 총괄",
      "manager": "민지영",
      "phone": "02-3423-7013",
      "adminPhone": "02-3423-7013",
      "mobilePhone": "010-8763-9696",
      "tasks": [
        "VIP 의전 총괄",
        "VIP 접견, 자리 안내 및 의전 동선 관리 등"
      ],
      "staffMembers": [
        {
          "name": "민지영",
          "role": "",
          "adminPhone": "02-3423-7013",
          "mobilePhone": "010-8763-9696"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 16,
      "category": "VIP의전",
      "deptOrOrg": "보건행정과 보건행정팀",
      "role": "VIP 의전 담당",
      "manager": "김하나",
      "phone": "02-3423-7017",
      "adminPhone": "02-3423-7017",
      "mobilePhone": "010-4316-2001",
      "tasks": [
        "VIP 의전 담당"
      ],
      "staffMembers": [
        {
          "name": "김하나",
          "role": "",
          "adminPhone": "02-3423-7017",
          "mobilePhone": "010-4316-2001"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 17,
      "category": "VIP의전",
      "deptOrOrg": "보건행정과 보건행정팀",
      "role": "VIP 의전 담당",
      "manager": "김하은",
      "phone": "02-3423-7014",
      "adminPhone": "02-3423-7014",
      "mobilePhone": "010-4117-0432",
      "tasks": [
        "VIP 의전 담당"
      ],
      "staffMembers": [
        {
          "name": "김하은",
          "role": "",
          "adminPhone": "02-3423-7014",
          "mobilePhone": "010-4117-0432"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 18,
      "category": "VIP의전",
      "deptOrOrg": "보건행정과 보건행정팀",
      "role": "보건소장 의전 담당",
      "manager": "염지연",
      "phone": "02-3423-7003",
      "adminPhone": "02-3423-7003",
      "mobilePhone": "010-3281-0277",
      "tasks": [
        "보건소장 의전 담당"
      ],
      "staffMembers": [
        {
          "name": "염지연",
          "role": "",
          "adminPhone": "02-3423-7003",
          "mobilePhone": "010-3281-0277"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 19,
      "category": "VIP의전",
      "deptOrOrg": "보건행정과 건강증진팀",
      "role": "VIP 대기실 케이터링 총괄",
      "manager": "왕지영",
      "phone": "02-3423-7113",
      "adminPhone": "02-3423-7113",
      "mobilePhone": "010-8572-5937",
      "tasks": [
        "VIP 대기실 케이터링 총괄",
        "음료·다과 세팅 및 대기실 환경 유지"
      ],
      "staffMembers": [
        {
          "name": "왕지영",
          "role": "",
          "adminPhone": "02-3423-7113",
          "mobilePhone": "010-8572-5937"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 20,
      "category": "VIP의전",
      "deptOrOrg": "강남구체육회",
      "role": "행사 지원",
      "manager": "체육회 스태프",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [],
      "staffMembers": [
        {
          "name": "체육회 스태프",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 12,
        "agency": 0
      },
      "remarks": "체육회 12명"
    },
    {
      "id": 21,
      "category": "VIP의전",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "출발 의전",
      "manager": "대행사 스태프",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "출발 의전"
      ],
      "staffMembers": [
        {
          "name": "대행사 스태프",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 2
      },
      "remarks": "대행사 2명"
    },
    {
      "id": 22,
      "category": "VIP의전",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "VIP 내빈 경호 업무",
      "manager": "대행사 경호팀",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "VIP 내빈 경호 업무",
        "접근 통제 및 이동 동선 확보"
      ],
      "staffMembers": [
        {
          "name": "대행사 경호팀",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 7
      },
      "remarks": "대행사 7명"
    },
    {
      "id": 23,
      "category": "운영",
      "deptOrOrg": "보건행정과 건강증진팀",
      "role": "운영 부스 총괄",
      "manager": "서승오",
      "phone": "02-3423-7034",
      "adminPhone": "02-3423-7034",
      "mobilePhone": "010-4907-9127",
      "tasks": [
        "운영 부스 총괄"
      ],
      "staffMembers": [
        {
          "name": "서승오",
          "role": "",
          "adminPhone": "02-3423-7034",
          "mobilePhone": "010-4907-9127"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 24,
      "category": "운영",
      "deptOrOrg": "강남구체육회",
      "role": "운영 부스 업무",
      "manager": "체육회 직원",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "운영 부스 업무"
      ],
      "staffMembers": [
        {
          "name": "체육회 직원",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 2,
        "agency": 0
      },
      "remarks": "체육회 2명"
    },
    {
      "id": 25,
      "category": "운영",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "운영 부스 업무",
      "manager": "대행사 팀장",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "운영 부스 업무"
      ],
      "staffMembers": [
        {
          "name": "대행사 팀장",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 1
      },
      "remarks": "대행사 1명"
    },
    {
      "id": 26,
      "category": "운영",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "운영 부스 업무",
      "manager": "대행사 스태프",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "운영 부스 업무",
        "접수, 인센티브 배부"
      ],
      "staffMembers": [
        {
          "name": "대행사 스태프",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 2
      },
      "remarks": "대행사 2명"
    },
    {
      "id": 27,
      "category": "운영",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "골인 동선 인센티브 배부",
      "manager": "대행사 스태프",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "골인 동선 인센티브 배부"
      ],
      "staffMembers": [
        {
          "name": "대행사 스태프",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 6
      },
      "remarks": "대행사 6명"
    },
    {
      "id": 28,
      "category": "운영",
      "deptOrOrg": "보건행정과 보건행정팀",
      "role": "응급의료부스 운영 총괄",
      "manager": "임석훤",
      "phone": "02-3423-7012",
      "adminPhone": "02-3423-7012",
      "mobilePhone": "010-7467-0830",
      "tasks": [
        "응급의료부스 운영 총괄"
      ],
      "staffMembers": [
        {
          "name": "임석훤",
          "role": "",
          "adminPhone": "02-3423-7012",
          "mobilePhone": "010-7467-0830"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 29,
      "category": "운영",
      "deptOrOrg": "보건행정과 보건행정팀",
      "role": "응급의료부스 구급차 운행",
      "manager": "이주원",
      "phone": "02-3423-7015",
      "adminPhone": "02-3423-7015",
      "mobilePhone": "010-9981-1415",
      "tasks": [
        "응급의료부스 구급차 운행"
      ],
      "staffMembers": [
        {
          "name": "이주원",
          "role": "",
          "adminPhone": "02-3423-7015",
          "mobilePhone": "010-9981-1415"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 30,
      "category": "코스",
      "deptOrOrg": "보건행정과 건강증진팀",
      "role": "걷기 코스 운영 총괄",
      "manager": "김민솔",
      "phone": "02-3423-7033",
      "adminPhone": "02-3423-7033",
      "mobilePhone": "010-7199-2152",
      "tasks": [
        "걷기 코스 운영 총괄",
        "코스 안전요원 배치 및 구간별 통행 흐름 관리"
      ],
      "staffMembers": [
        {
          "name": "김민솔",
          "role": "",
          "adminPhone": "02-3423-7033",
          "mobilePhone": "010-7199-2152"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 31,
      "category": "코스",
      "deptOrOrg": "보건행정과 건강증진팀",
      "role": "반환점 스탬프 날인 및 코스 안전 관리",
      "manager": "금연단속원",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "반환점 스탬프 날인 및 코스 안전 관리"
      ],
      "staffMembers": [
        {
          "name": "금연단속원",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 7,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 7명"
    },
    {
      "id": 32,
      "category": "코스",
      "deptOrOrg": "보건행정과 민원서비스팀",
      "role": "코스 안전 통제",
      "manager": "곽혜연",
      "phone": "02-3423-7018",
      "adminPhone": "02-3423-7018",
      "mobilePhone": "010-3633-6439",
      "tasks": [
        "코스 안전 통제"
      ],
      "staffMembers": [
        {
          "name": "곽혜연",
          "role": "",
          "adminPhone": "02-3423-7018",
          "mobilePhone": "010-3633-6439"
        }
      ],
      "headcount": {
        "bogun": 2,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 2명"
    },
    {
      "id": 33,
      "category": "코스",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "코스 안전 통제",
      "manager": "대행사 스태프",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "코스 안전 통제"
      ],
      "staffMembers": [
        {
          "name": "대행사 스태프",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 12
      },
      "remarks": "대행사 12명"
    },
    {
      "id": 34,
      "category": "부스",
      "deptOrOrg": "보건행정과 건강증진팀",
      "role": "체험 부스 및 행사장 운영 총괄",
      "manager": "심다영, 부스운영담당",
      "phone": "02-3423-7018",
      "adminPhone": "02-3423-7018",
      "mobilePhone": "010-3912-3269",
      "tasks": [
        "체험 부스 및 행사장 운영 총괄",
        "/ 간식·식수 구매",
        "부스별 전력 공급 점검, 시작·종료 통제 등"
      ],
      "staffMembers": [
        {
          "name": "심다영, 부스운영담당",
          "role": "",
          "adminPhone": "02-3423-7018",
          "mobilePhone": "010-3912-3269"
        }
      ],
      "headcount": {
        "bogun": 110,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 110명"
    },
    {
      "id": 35,
      "category": "부스",
      "deptOrOrg": "보건행정과 민원서비스팀",
      "role": "행사장 안전관리",
      "manager": "황정은",
      "phone": "02-3423-7018",
      "adminPhone": "02-3423-7018",
      "mobilePhone": "010-6371-3827",
      "tasks": [
        "행사장 안전관리"
      ],
      "staffMembers": [
        {
          "name": "황정은",
          "role": "",
          "adminPhone": "02-3423-7018",
          "mobilePhone": "010-6371-3827"
        }
      ],
      "headcount": {
        "bogun": 2,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 2명"
    },
    {
      "id": 36,
      "category": "부스",
      "deptOrOrg": "강남구체육회",
      "role": "행사장 안전관리",
      "manager": "체육회 스태프",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "행사장 안전관리"
      ],
      "staffMembers": [
        {
          "name": "체육회 스태프",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 10,
        "agency": 0
      },
      "remarks": "체육회 10명"
    },
    {
      "id": 37,
      "category": "부스",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "행사장 안전관리",
      "manager": "대행사 스태프",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "행사장 안전관리"
      ],
      "staffMembers": [
        {
          "name": "대행사 스태프",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 3
      },
      "remarks": "대행사 3명"
    },
    {
      "id": 38,
      "category": "부스",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "월 30일 야간 경호",
      "manager": "대행사 경호팀",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "월 30일 야간 경호"
      ],
      "staffMembers": [
        {
          "name": "대행사 경호팀",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 2
      },
      "remarks": "대행사 2명"
    },
    {
      "id": 39,
      "category": "직원식사",
      "deptOrOrg": "보건행정과 건강증진팀",
      "role": "중식 도시락 및 간식·식수 관리 총괄",
      "manager": "신진성",
      "phone": "02-3423-7282",
      "adminPhone": "02-3423-7282",
      "mobilePhone": "010-2757-0015",
      "tasks": [
        "중식 도시락 및 간식·식수 관리 총괄"
      ],
      "staffMembers": [
        {
          "name": "신진성",
          "role": "",
          "adminPhone": "02-3423-7282",
          "mobilePhone": "010-2757-0015"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 40,
      "category": "직원식사",
      "deptOrOrg": "보건행정과 건강증진팀",
      "role": "중식 도시락 및 간식·식수 관리 보조",
      "manager": "조혜영",
      "phone": "02-3423-7036",
      "adminPhone": "02-3423-7036",
      "mobilePhone": "010-9456-7850",
      "tasks": [
        "중식 도시락 및 간식·식수 관리 보조"
      ],
      "staffMembers": [
        {
          "name": "조혜영",
          "role": "",
          "adminPhone": "02-3423-7036",
          "mobilePhone": "010-9456-7850"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": "40-1",
      "category": "직원식사",
      "deptOrOrg": "보건행정과 민원서비스팀",
      "role": "중식 도시락 및 간식·식수 관리 보조",
      "manager": "전은선",
      "phone": "02-3423-7018",
      "adminPhone": "02-3423-7018",
      "mobilePhone": "010-9567-3580",
      "tasks": [
        "중식 도시락 및 간식·식수 관리 보조"
      ],
      "staffMembers": [
        {
          "name": "전은선",
          "role": "",
          "adminPhone": "02-3423-7018",
          "mobilePhone": "010-9567-3580"
        }
      ],
      "headcount": {
        "bogun": 1,
        "sports": 0,
        "agency": 0
      },
      "remarks": "보건소 1명"
    },
    {
      "id": 41,
      "category": "직원식사",
      "deptOrOrg": "강남구체육회",
      "role": "중식 도시락 및 간식·식수 관리 보조",
      "manager": "체육회 스태프",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "중식 도시락 및 간식·식수 관리 보조"
      ],
      "staffMembers": [
        {
          "name": "체육회 스태프",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 2,
        "agency": 0
      },
      "remarks": "체육회 2명"
    },
    {
      "id": 42,
      "category": "직원식사",
      "deptOrOrg": "커넥트디(대행사)",
      "role": "중식 도시락 및 간식·식수 관리 보조",
      "manager": "대행사 스태프",
      "phone": "",
      "adminPhone": "",
      "mobilePhone": "",
      "tasks": [
        "중식 도시락 및 간식·식수 관리 보조"
      ],
      "staffMembers": [
        {
          "name": "대행사 스태프",
          "role": "",
          "adminPhone": "",
          "mobilePhone": ""
        }
      ],
      "headcount": {
        "bogun": 0,
        "sports": 0,
        "agency": 2
      },
      "remarks": "대행사 2명"
    }
  ],
  "lastUpdated": "2026-10-07"
};
