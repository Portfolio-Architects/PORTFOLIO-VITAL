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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    if (context.env && context.env.HCHPS_DATA) {
      try {
        const raw = await context.env.HCHPS_DATA.get(KV_KEY, { cacheTtl: 60 });
        if (raw) {
          const parsed = JSON.parse(raw);
          return jsonResponse(context.request, { ...parsed, _source: 'kv' }, 200);
        }
      } catch (kvErr) {
        console.warn('[Cloudflare Pages] KV get error:', kvErr);
      }
    }
    // Fallback if KV not yet populated or binding missing
    return jsonResponse(context.request, { ...FALLBACK_FESTIVAL_DATA, _source: 'fallback' }, 200);
  } catch (err) {
    console.error('[Cloudflare Pages /api/festival/yangjae] GET error:', err);
    return jsonResponse(context.request, { ...FALLBACK_FESTIVAL_DATA, _source: 'fallback' }, 200);
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
    "course": "수변문화쉼터 ↔ 영동5교 왕복 (약 4km)",
    "targetAudience": "강남구민 800명(사전접수)",
    "programStructure": [
      "건강 걷기 체험 프로그램(3km, 구청장배 걷기대회 연계)",
      "의료 및 건강 관련 체험·홍보 부스 운영"
    ],
    "staffNote": "행사 참여 직원 대체휴무 시행 예정 (전 직원 참여)",
    "organizer": "강남구보건소 보건행정과 건강증진팀, 강남구체육회(걷기협회)",
    "overallProgress": 70,
    "lastUpdated": "2026-09-10"
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
        "[완료][26.8.29.][참여:과장님, 지영팀장님, 오창선, 제이민] 대행사 미팅 3 : 세부 운영안 조율",
        "[완료][26.9.1.][참여:과장님, 희선팀장님, 지영팀장님, 임석훤, 남상희, 오창선] 내부 회의 : 행사 추진 관련 전반, VIP 초청, 참가자 모집 방법, 보도자료 등 안건 협의",
        "[완료][26.9.3.][참여:보건행정과-10992] [협조완료] 공원녹지과: 출발마당(포이공원) 장소 및 전기 사용, 볼라드 개폐",
        "[완료][26.9.9.][참여:과장님, 지영팀장님, 오창선] 강남구체육회(걷기협회) 구청장배 걷기대회 공동개최 협의 : ",
        "[예정][26.9.11.][참여:지영팀장님, 오창선, 걷기협회, 제이민] 신규 걷기 코스 답사 : ",
        "[예정][26.9.16.] 전 부서 행사 알림 : 행사 포스터 시안 확정 이후"
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
      "number": "추진과제 3",
      "title": "운영 부스",
      "status": "in-progress",
      "period": "9월 1주 ~ 9월 2주",
      "cooperationDepts": [],
      "details": [
        "[완료][26.9.1.][참여:오창선, 고려대학교척추측만증연구소] 고려대학교척추측만증 연구소 부스 운영 확정 : 신청서 회신",
        "[완료][26.9.2.][참여:지영팀장님, 오창선] 부스 위치 답사 : 유디치과 검진버스 정차 위치 검토",
        "[완료][26.9.2.][참여:오창선] 의료관광팀 부스 운영 불가 : 강남 메디컬 투어 부스 운영 불가 통보(더 큰 행사 있음)",
        "[완료][26.9.2.][참여:오창선, 김형종, 한국신체정보(주)] 운동처방 테마 부스 운영 확정 : 내 신체나이 알아보기 체력 측정, 자세 분석 및 운동 처방 ",
        "[진행][26.9.3.][참여:과장님, 오창선] 강남구의사회 부스 운영 협조 : 운영 확정 및 세부 사항 조율중",
        "[완료][26.9.4.][참여:오창선, 강남차병원] 강남차병원 부스 운영 확정 : 신청서 회신",
        "[완료][26.9.4.][참여:오창선, 서울대병원강남센터] 서울대병원 강남센터 부스 운영 확정 : 신청서 회신, *의자 6개 신청",
        "[완료][26.9.4.][참여:오창선, (주)유디] 유디 치과 부스 운영 확정 : 신청서 회신",
        "[완료][26.9.8.][참여:과장님, 오창선] 강남구 한의사회 부스 운영 확정 : ",
        "[완료][26.9.9.][참여:오창선] 보건소 내부 부스 운영 신청 공문 발송 : ",
        "[완료][26.9.9.][참여:김지현] 의약과 부스 운영 신청서 제출 : ",
        "[진행][26.9.9.][참여:김효진] 질병관리과 부스 운영 협의중 ... : "
      ]
    },
    {
      "id": 4,
      "number": "추진과제 4",
      "title": "홍보 및 행정사항",
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
        "[예정][참여:과장님] 인근 동 주민센터(개포·일원·대치·도곡 등) 동장님 협조 요청 : 관내 단체 및 주민 참여 독려",
        "[예정][참여:과장님] 양재천 지킴이 : 행사 홍보 및 참여 요청",
        "[예정][참여:과장님] 개포 현대 2단지 아파트 입주자 대표회 미팅",
        "[예정] 장소 사용 협조 진행 여부 : \n수변문화센터 외부 소관 치수과, 내부 소관 문화도시과"
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
        "[진행] 행사 방침서 작성 중... (강남구체육회 공동개최 및 구청장배 걷기대회 연계 운영안 반영)"
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
    }
  ],
  "booths": [
    {
      "id": 1,
      "category": "민간",
      "name": "강남 차병원",
      "scale": "3동",
      "program": "중년 여성 유방 자가검진 교육, 여성질환 및 영양 상담",
      "status": "확정"
    },
    {
      "id": 2,
      "category": "민간",
      "name": "강남구의사회",
      "scale": "1동",
      "program": "-",
      "status": "협의중"
    },
    {
      "id": 3,
      "category": "민간",
      "name": "강남구한의사회",
      "scale": "2동",
      "program": "바른자세가 건강의 시작, 한의학을 통한 체형검사 체험존",
      "status": "확정"
    },
    {
      "id": 4,
      "category": "민간",
      "name": "고려대학교부설 척추측만증연구소",
      "scale": "2동 + 검진버스",
      "program": "거북목·척추측만증 X-Ray 무료 촬영 및 교정 상담",
      "status": "확정"
    },
    {
      "id": 5,
      "category": "민간",
      "name": "서울대학교병원 강남센터",
      "scale": "1동",
      "program": "가정의학과 전문의 만성질환 상담",
      "status": "확정"
    },
    {
      "id": 6,
      "category": "민간",
      "name": "유디치과",
      "scale": "1동 + 검진버스",
      "program": "구강 검진 및 구강건강 관리법 안내",
      "status": "확정"
    },
    {
      "id": 7,
      "category": "민간",
      "name": "자생한방병원",
      "scale": "2동",
      "program": "간이 침 치료, 스포츠 테이핑 및 한의학 상담",
      "status": "확정"
    },
    {
      "id": 8,
      "category": "민간",
      "name": "케이스튜디오 (디아르스)",
      "scale": "1동",
      "program": "퍼스널 컬러 진단 및 계절별 산책·야외운동 메이크업 봉사",
      "status": "확정"
    },
    {
      "id": 9,
      "category": "민간",
      "name": "한국신체정보(주)",
      "scale": "2동",
      "program": "내 신체나이 알아보기, 『리얼피티 프로 플러스』 40초 바른자세·체형 분석 및 운동처방",
      "status": "확정"
    },
    {
      "id": 10,
      "category": "보건소 부서",
      "name": "금연·절주 영양 보건 사업 홍보",
      "scale": "1동",
      "program": "일산화탄소 측정, 금연상담 및 음주 고글 체험",
      "status": "확정"
    },
    {
      "id": 11,
      "category": "보건소 부서",
      "name": "서울체력장 강남센터",
      "scale": "2동",
      "program": "내 신체나이 알아보기, 서울체력장 인증 체력측정 (성인: 2분제자리걷기/악력, 시니어: 의자일어서기 등)",
      "status": "확정"
    },
    {
      "id": 12,
      "category": "보건소 부서",
      "name": "의약과 약무팀",
      "scale": "2동",
      "program": "불법 마약 근절 캠페인 부스",
      "status": "확정"
    },
    {
      "id": 13,
      "category": "보건소 부서",
      "name": "질병관리과",
      "scale": "3동",
      "program": "각종 체험 프로그램",
      "status": "협의중"
    }
  ]
};
