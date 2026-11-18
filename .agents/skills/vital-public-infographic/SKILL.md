---
name: vital-public-infographic
description: >-
  16:9 및 2:3 비율의 공공 캠페인 인포그래픽 포스터·걷기 코스도·행사 키비주얼·간판·공문서 삽입용 다중 품목 격자 화보를 수학적 좌표 기반으로 생성·감수하는 스킬.
  캠페인 포스터 기획, 5대 코스 수직 그리드 0.1px 정렬, AI 오탈자 감수, HY견고딕 2톤·캘리그래피 서체, 순수 2D QR 매트릭스 및 HWPX BinData용 품목 화보 합성 시 사용
  (행사 현장 운영·식순 연동은 vital-festival-4way-sync, HWPX 보고서·구매계획 화보 BinData 3중 매핑은 vital-hwpx-docgen, 마일스톤 기록은 vital-governance-ops 연계).
---

# 공공 캠페인 인포그래픽 및 시각 디자인 설계 스킬 (vital-public-infographic)

## ▣ 1. 개요 및 목적 함수

### ▢ 1. 시스템 목적 함수 및 SSOT 경계
- 본 스킬은 **$\mathcal{J}_{\text{DocAuto}}$ (공공 디자인·무오탈자 포스터 산출)** 및 `AGENTS.md` `Rule N`을 전담하며 행사 현장 시각물(`Rule L, S`)과 연계함.
- **캠페인 지표·기획 SSOT:** `src/lib/physicalActivityMetrics.ts`, `scratch/2027_gangnam_physical_activity_plan.md`, `scratch/2026_yangjae_incentive_spec.md`
- **키비주얼·간판 스크립트:** `scratch/build_yangjae_keyvisuals.py` (백월·현수막·캘리그래피), `scratch/add_signboards_modern_seamless.py`, `scratch/test_blend_widescreen.py` (센터 표지판)
- **산출물 규격:** `<산출_포스터_16x9>.png`, `<산출_포스터_2x3>.png` (아티팩트 디렉토리 또는 지정 경로 저장)

### ▢ 2. 타 스킬 연계 핸드오프 및 $\mathcal{J}_{\text{Ontology}}$ 역방향 환류
- **행사 4-Way 싱크 (`vital-festival-4way-sync`):** 행사 일시·장소·부스·공동주관 로고·QR 연결 URL을 `vital-festival-4way-sync` SSOT와 동기화함.
- **화보 `BinData` 3중 매핑 (`vital-hwpx-docgen`):** 포스터·다중 품목 격자 화보(`Pillow` 합성 이미지) HWPX 첨부 시 `BinData/imageN.png` + `Contents/content.hpf` + `Contents/section0.xml` `<hp:pic treatAsChar="1">` `px×75` HWPUnits 3중 매핑 규격을 연계함.
- **거버넌스·역방향 환류 (`vital-governance-ops`):** 스크립트 개선 시 마일스톤 기록·`sync-rules.js`·연락처/QR 개인정보 스캔을 수행하고, 확정 운영 기간·리워드 지급 일정을 `data/SCHEDULES.json`·`data/WORKING_MEMORY.json`에 환류함.

---

## ▣ 2. 활성화·비활성화 조건

### ▢ 1. 활성화 발화 패턴
- "손목닥터9988 걷기 챌린지 16:9·2:3 포스터 제작", "오탈자·5대 코스 쿼터(4,500명) 검수", "순수 2D QR 우상단 무테 배치", "HY견고딕 적용·0.1px 수직 그리드 정렬·다중 품목 격자 화보 합성".

### ▢ 2. 비활성화 조건
- HWPX 공문서 본문 표 변환 및 XML 치환 (`vital-hwpx-docgen`).
- 축제 당일 현장 타임테이블 및 4-Way 클라우드 배포 (`vital-festival-4way-sync`).

---

## ▣ 3. 선행 조건 및 디자인 환경

- **디자인 헌장:** `AGENTS.md` `Rule N`, 공식 3단 슬로건 원형 `"강남을 힘차게! / 구민을 신나게! / 강남 대전환!!"`.
- **서체 및 라이브러리:** Windows `HY견고딕`(`C:\Windows\Fonts\H2GTRE.TTF`), Python `Pillow` (PIL), `qrcode`, `numpy`.

---

## ▣ 4. 단계별 실행 런북

### ▢ Phase 1. 듀얼 포맷 조판 아키텍처
- **16:9 가로형 (사이니지/웹용):** 상단 좌측 2~3줄 메인 헤드라인+기간 뱃지(`(9.16~12.31)`), 상단 중앙 3대 리워드 캡슐 카드(선착순·총 규모·건당 지급액), 상단 우측 공식 3단 붓글씨 슬로건, 하단 5대 릴레이 코스 수평 1열 배치.
- **2:3 세로형 (공공게시판/모바일용):** 상단 슬로건+메인 헤드라인+3대 캡슐 수직 집약, 중앙 S자 산책로 리본 Z-패턴(1→5), 우측 상단 순수 2D QR 매트릭스 순백색 여백 무테 조판.

### ▢ Phase 2. 수치 쿼터 100% 정합성 검증
$$\sum_{i=1}^{5} \text{CourseQuota}_i = 1,000\text{명} + 1,000\text{명} + 500\text{명} + 1,000\text{명} + 1,000\text{명} = 4,500\text{명}$$
- 상단 공식 캡슐 배지(**선착순 4,500명 / 총 900만P**)와 단 1명 오차 없이 일치시킴.

### ▢ Phase 3. 순수 2D 매트릭스 QR 정밀 조판
- 스캔 유도 안내 문구·박스·배지 등 시각 노이즈를 전면 소거하고 순수 2D QR(세로형 `85×85px`, 가로형 `105×105px`)만 우측 상단 순백색 여백에 서브픽셀 알파 블렌딩으로 단독 배치함(라우팅: 손목닥터9988 앱 공식 스토어 URI).

### ▢ Phase 4. 타이포그래피 정렬 및 오탈자 0건 감수
- 각 코스 중심축($X_n$)에 [순번 마커]-[코스명]-[일러스트]-[하단 배지]를 `0.1px` 수직 1열 정렬함.
- AI 이미지 내 긴 한글 렌더링을 금지하고 `Pillow` + `HY견고딕`으로 직접 합성해 글리프 왜곡('3산 트로케킹' → ｢3대 명산 트레킹｣, 월차 `9월`, `10월 ①`, `10월 ②`, `11월`, `12월`) 및 무단 지자체 CI 삽입을 차단함.

### ▢ Phase 5. 공문서용 다중 품목 격자 화보(`Pillow`) 및 HWPX `BinData` 3중 매핑
- 다수 장비·소모품 참고 사진은 `Pillow`로 2열×N행 또는 3열×N행 균등 카드 격자(다크네이비 헤더 + 품목 번호 + 규격·수량·단가 라벨 + 실물 사진, `1500px` 폭) 단일 고해상도 PNG로 합성함.
- HWPX 삽입 시 ① `BinData/imageN.png` 물리 저장 + ② `Contents/content.hpf` `<opf:item id="imageN" href="BinData/imageN.png" media-type="image/png" isEmbeded="1"/>` 등록 + ③ `Contents/section0.xml` `<hp:pic treatAsChar="1">` (`orgSz`/`imgRect`/`imgClip`/`imgDim`=`px×75` HWPUnits, `curSz`=`42,000~42,500`, `scaMatrix`=`curSz/orgSz`) 및 호스트 `<hp:lineseg vertsize>`를 3중 일치시킴.

---

## ▣ 5. 전용 스크립트 및 검증 CLI

```bash
# 1. 키비주얼·간판 합성 스크립트 구문 점검
python -m py_compile scratch/build_yangjae_keyvisuals.py scratch/add_signboards_modern_seamless.py scratch/test_blend_widescreen.py

# 2. HY견고딕 폰트 실존 점검
python -c "import os; print('H2GTRE:', os.path.exists(r'C:\Windows\Fonts\H2GTRE.TTF'))"
```

---

## ▣ 6. 금지 패턴 및 안티패턴 체크리스트

| 구분 | 안티패턴 (Strictly Prohibited) | 정상 표준 대응책 (Compliant Standard) |
|:---:|:---|:---|
| **AP-N1** | AI 생성 모델에 긴 한글 텍스트 렌더링 직접 위임 | 배경 그래픽만 생성 후 `Pillow` + `HY견고딕` 직접 합성 |
| **AP-N2** | 상단 캡슐(4,500명)과 5개 코스 정원 합계 불일치 | $1,000+1,000+500+1,000+1,000 = 4,500$ 수학적 일치 강제 |
| **AP-N3** | QR 주변 안내 문구·네모 박스·화살표 등 노이즈 배치 | 우측 상단 순백색 여백에 순수 2D QR만 무테 단독 배치 |
| **AP-N4** | 미승인 지자체 CI 로고 무단 삽입 | 공식 3단 붓글씨 슬로건 원형 배치 및 무단 CI 배제 |
| **AP-N5** | 코스 마커·텍스트 중심축 비대칭 | 중심 X좌표 기준 0.1px 수직 칼정렬 적용 |
| **AP-N6** | HWPX 화보 `BinData` 단독 복사 또는 `px×75` 기하학 불일치 | `Pillow` 격자 합성 후 `BinData`+`content.hpf`+`<hp:pic>` 3중 매핑 |

---

## ▣ 7. 출력 기준 및 사후 검증 게이트

- **공통 출력·평어체 SSOT 위임:** 채팅 출력·표 우선·1문장 1줄·`Rule M`·`Rule P`·4대 자가 점검 게이트는 `AGENTS.md`를 준수함.
- **도메인 사후 검증 게이트:**
  - `16:9`·`2:3` 해상도·여백·공식 3단 슬로건 배치 및 순수 2D QR 단독 배치·0.1초 인식을 확인함.
  - 5대 코스 정원(4,500명 / 총 900만P), 기간 표기, 한글 오탈자 0건을 전수 검수함.
