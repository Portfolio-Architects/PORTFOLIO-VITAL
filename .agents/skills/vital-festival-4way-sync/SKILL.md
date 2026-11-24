---
name: vital-festival-4way-sync
description: >-
  대규모 공공행사(양재천 페스티벌 등)의 448px 모바일 퍼스트 관제 UI 유지보수 및 로컬 SSOT, React 모듈 뷰, 정적 템플릿, Cloudflare KV 간 4-Way 무인 듀얼 싱크를 수행하는 스킬.
  행사 부스·추진과제·업무분장·식순 수정, 모바일 뷰포트 가로 잘림 보정, 대통령훈령 제438호 국민의례 의전 검토, 24/7 엣지 배포 시 사용
  (무대 키비주얼·포스터는 vital-public-infographic, 행사 예산은 vital-budget-audit, 결과보고·시나리오 HWPX는 vital-hwpx-docgen, 마일스톤 싱크는 vital-governance-ops 연계).
---

# 행사 모바일 관제 및 4-Way 엣지 동기화 스킬 (vital-festival-4way-sync)

## ▣ 1. 개요 및 목적 함수

### ▢ 1. 시스템 목적 함수 및 SSOT 경계
- 본 스킬은 **$\mathcal{J}_{\text{FieldSync}}$ (현장 행사 모바일 퍼스트 관제 및 24/7 엣지 복원력)**과 `AGENTS.md` `Rule L, S`를 전담하며 `448px`(`max-w-md`) 뷰포트 무결점 관제와 24/7 Cloudflare Pages·KV 무중단 제공을 보장함.
- **로컬 SSOT·폴백·스키마:** `data/FESTIVAL_YANGJAE_2026.json`, `src/lib/constants/yangjaeFestivalFallback.ts`, `src/lib/schemas.ts`, `scripts/sync-festival-fallbacks.py`
- **행정 마스터 엑셀:** `2026_양재천_걷자_건강페스티벌_종합현황_ver 261012_SSOT.xlsx` (`scripts/sync_festival_excel.py`)
- **모듈형 React 뷰·훅·API:** `src/components/festival/YangjaeFestivalDashboard.tsx`, `src/components/festival/yangjae/` (`types.ts`, `festivalUtils.ts`, `MilestonesTab.tsx`, `BoothsTab.tsx`, `DutiesTab.tsx`, `ScheduleTab.tsx`, `SecurityPinModal.tsx`, `SubTaskTransferModal.tsx`), `src/hooks/useYangjaeFestival.ts`, `src/app/api/festival/yangjae/route.ts`, `src/app/api/festival/yangjae/sync-excel/route.ts`
- **정적 템플릿·클라우드 엣지:** `scripts/pages-template.html`, `scripts/prepare-pages-output.js`, `functions/api/festival/yangjae.ts`, Cloudflare KV `HCHPS_DATA` (`festival_yangjae_2026`)

### ▢ 2. 타 스킬 연계 핸드오프 및 $\mathcal{J}_{\text{Ontology}}$ 역방향 환류
- **현장 시각물 (`vital-public-infographic`):** 무대 백월·현수막·포스터 그래픽·QR 연결 URL을 동기화함.
- **시나리오·예산 (`vital-hwpx-docgen`, `vital-budget-audit`):** 사회자 카드·방침서 HWPX 빌드는 `vital-hwpx-docgen`, 행사 예산 검산은 `vital-budget-audit`으로 위임함.
- **거버넌스·하네스·역방향 환류 (`vital-governance-ops`):** `run-harness.js`(`validateFestivalSSOT`)로 스키마·예산·행수 일치성을 검증하고 마일스톤(`sync-rules.js`)을 기록하며, 확정된 행사 일정(`milestones`·`schedule`)·결과보고를 `data/SCHEDULES.json`·`data/ADMIN_DOC_INDEX.json`·`data/WORKING_MEMORY.json`에 환류함.

---

## ▣ 2. 활성화·비활성화 조건

### ▢ 1. 활성화 발화 패턴
- "양재천 식순·부스·업무분장 엑셀 반영 및 동기화", "448px 모바일 카드/배지 가로 잘림 보정", "Cloudflare KV 최신 축제 데이터 배포", "국민의례 식순·사회자 대본 의전 검토".

### ▢ 2. 비활성화 조건
- 행사 예산 1원 단위 감사·일상경비 검증 (`vital-budget-audit`).
- 16:9·2:3 포스터 조판 및 순수 QR 합성 (`vital-public-infographic`).

---

## ▣ 3. 선행 조건 및 동기화 파이프라인

- **규격:** `AGENTS.md` `Rule S` (4-Way 동기화·448px 뷰포트), `Rule L` (대통령훈령 제438호 국민의례).
- **파이프라인 스크립트:** `scripts/sync_festival_excel.py` (엑셀↔JSON), `scripts/sync-festival-fallbacks.py` (JSON→TS 폴백), `scripts/prepare-pages-output.js` (JSON→정적 HTML), `scripts/sync-festival-to-cloud.js` (KV 업로드), `scripts/watch-and-sync-cloud.js` (300ms 디바운스 데몬).

---

## ▣ 4. 단계별 실행 런북

### ▢ Phase 1. 4-Way 동기화 토폴로지 실행
```text
[Layer 1: 행정 마스터 엑셀] ──(sync_festival_excel.py)──▶ [Layer 2: data/FESTIVAL_YANGJAE_2026.json]
                                                                 │ (watch-and-sync-cloud.js 300ms)
                              ┌──────────────────────────────────┴──────────────────────────────────┐
                              ▼                                                                     ▼
[Layer 3: scripts/pages-template.html -> out/festival/yangjae/index.html]    [Layer 4: Cloudflare KV (HCHPS_DATA)]
```
- 마스터 엑셀 수집(`sync_festival_excel.py`) $\to$ 로컬 JSON·TS 폴백(`sync-festival-fallbacks.py`) 및 `YangjaeFestivalDashboard` 9개 하위 모듈 반영 $\to$ 정적 HTML 빌드(`prepare-pages-output.js`) $\to$ KV 업로드(`sync-festival-to-cloud.js`)를 동시 동기화함.

### ▢ Phase 2. VLDS 와이드뷰 플레이북 및 정적 모바일 호환 표준
- **와이드뷰 5대 탭 위계 (VITAL 앱 · `/festival/yangjae`):** `max-w-[1800px]` 와이드 컨테이너, 4열 KPI 요약 스트립 및 5탭(`1. 히스토리·체크리스트` $\to$ `2. 추진과제` $\to$ `3. 부스현황` $\to$ `4. 업무분장` $\to$ `5. 행사식순`) 구성을 유지하며, 2026 추진 히스토리·핵심 교훈·32개 차년도 체크리스트(`ChecklistPlaybookTab`)와 다단 반응형 그리드를 적용함.
- **정적 모바일 레플리카 (`scripts/pages-template.html`):** 외부 현장 공유용 정적 HTML(`out/festival/yangjae/index.html`)은 `max-w-md` 모바일 1열 가독성과 `overflow-x-hidden` 가로 클리핑 0건을 유지함.
- **6대 퀵 필터:** `1. 운영`, `2. 코스`, `3. 부스`, `4. VIP의전`, `5. 직원식사`, `6. 쓰레기처리`.
- **일자별 배지·카드 레이아웃:** 사전준비(`10.17~10.24`: `bg-indigo-50 text-indigo-700`), 행사전날(`10.30`: `bg-amber-50 text-amber-700`), 행사당일(`10.31`: `bg-sky-50 text-sky-700`) 및 헤더 2행 분리(`flex flex-wrap gap-y-2`)를 적용함.

### ▢ Phase 3. 공공 의전 및 국민의례 규정 (대통령훈령 제438호)
- **약식절차 1 공식 적용:** ① 국기에 대한 경례(무전주 애국가 반주 1절, 맹세문 없음) $\to$ ② 순국선열·호국영령 묵념(10~15초) $\to$ ③ 착석 전환 안내 순으로 진행함.
- **생략 멘트 절대 금지:** 애국가 제창·묵념 생략 안내 멘트는 국가상징 품격 저해로 엄격 금지함.

---

## ▣ 5. 전용 스크립트 및 검증 CLI

```bash
# 1. 축제 SSOT Zod 스키마·폴백·예산 일치 하네스 및 실시간 동기화 테스트
node scripts/run-harness.js --quick
npx jest __tests__/yangjae-festival-realtime-collapsed-sync.test.tsx

# 2. 폴백 상수 동기화 및 정적 모바일 템플릿 빌드
python scripts/sync-festival-fallbacks.py
node scripts/prepare-pages-output.js

# 3. Cloudflare KV 수동 동기화 및 300ms 감시 데몬
node scripts/sync-festival-to-cloud.js
npm run watch:cloud
```

---

## ▣ 6. 금지 패턴 및 안티패턴 체크리스트

| 구분 | 안티패턴 (Strictly Prohibited) | 정상 표준 대응책 (Compliant Standard) |
|:---:|:---|:---|
| **AP-F1** | 상단 탭에서 행사식순을 3번, 업무분장을 4번으로 배치 | `3. 업무분장` $\to$ `4. 행사식순` 위계 영구 고정 |
| **AP-F2** | 로컬 JSON만 수정하고 정적 HTML·폴백·KV 동기화 누락 | 4-Way 동기화 파이프라인 동시 구동 |
| **AP-F3** | 모바일 테이블 가로 스크롤 발생·우측 뱃지 잘림 | `max-w-md`, 전폭 카드 스택 및 헤더 2행 분리 적용 |
| **AP-F4** | 사회자 대본에 애국가 제창·묵념 생략 안내 멘트 삽입 | 무전주 애국가 1절 경례 후 자연스러운 착석 전환 |
| **AP-F5** | 마스터 엑셀 컬럼 임의 변경으로 JSON 역방향 수집 실패 | `DutyItem.headcount` 등 스키마 계약 100% 보존 |

---

## ▣ 7. 출력 기준 및 사후 검증 게이트

- **공통 출력·평어체 SSOT 위임:** 채팅 출력·표 우선·1문장 1줄·`Rule M`·`Rule P`·4대 자가 점검 게이트는 `AGENTS.md`를 준수함.
- **도메인 사후 검증 게이트:**
  - `node scripts/run-harness.js --quick`(`validateFestivalSSOT`) 및 `npx jest __tests__/yangjae-festival-realtime-collapsed-sync.test.tsx` 100% 통과를 확인함.
  - `out/festival/yangjae/index.html`·Cloudflare KV 동기화, `SCHEDULES.json` 환류 및 448px 뷰포트 가로 클리핑 0건을 확인함.
