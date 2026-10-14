---
name: vital-festival-4way-sync
description: >-
  대규모 공공행사(양재천 페스티벌 등)의 448px 모바일 퍼스트 관제 UI 유지보수 및 로컬 SSOT, React 뷰, 정적 템플릿, Cloudflare KV 간 4-Way 무인 듀얼 싱크를 수행하는 스킬.
  행사 부스·추진과제·식순 수정, 모바일 뷰포트 가로 잘림 보정, 국민의례 의전 규정 검토, 24/7 엣지 배포 시 사용.
---

# 행사 모바일 관제 및 4-Way 엣지 동기화 스킬 (vital-festival-4way-sync)

## 󰏚 1. 개요 및 목적 함수 (Overview & Objective Function)

### ▢ 1. 시스템 목적 함수 매핑
  ❍ 본 스킬은 시스템 5대 목적 함수 중 **$\mathcal{J}_{\text{FieldSync}}$ (현장 행사 모바일 퍼스트 관제 및 24/7 하이브리드 엣지 복원력)**을 총괄함.
  ❍ ｢2026 양재천 건강 페스티벌｣ 등 대규모 공공행사 현장에서 공무원 및 현장 운영요원이 스마트폰 448px(`max-w-md`) 뷰포트로 식순, 부스, 업무분장을 무결점으로 관제하도록 지원함.
  ❍ 로컬 PC 전원이 차단된 상태에서도 Cloudflare Pages 정적 템플릿과 Cloudflare KV 분산 레플리카를 통해 24시간 중단 없는 읽기 전용 서비스를 제공함.

### ▢ 2. 도메인 경계 및 단일 진실 공급원(SSOT)
  ❍ **로컬 디스크 SSOT:** `data/FESTIVAL_YANGJAE_2026.json`
  ❍ **행정 마스터 엑셀:** `2026_양재천_걷자_건강페스티벌_종합현황_ver *.xlsx`
  ❍ **모바일 배포 템플릿:** `scripts/pages-template.html` $\to$ `out/festival/yangjae/index.html`
  ❍ **클라우드 분산 KV:** Cloudflare KV 네임스페이스 `HCHPS_DATA` (키: `festival_yangjae_2026`)

---

## 󰏚 2. 활성화 조건 및 트리거 (Triggers & Activation Scenarios)

### ▢ 1. 사용자 대표 발화 패턴
  ❍ "양재천 행사 식순/부스/업무분장 엑셀 반영해서 동기화해줘"
  ❍ "모바일 화면에서 카드나 배지 잘리는지 확인해줘"
  ❍ "Cloudflare에 최신 축제 데이터 배포해줘"
  ❍ "국민의례 식순이랑 사회자 대본 규정 맞게 수정해줘"

### ▢ 2. 비활성화 조건
  ❍ 행사 소요 예산 1원 단위 감사 및 일상경비 검증 (`vital-budget-audit` 호출).
  ❍ 인포그래픽 포스터 16:9 조판 및 순수 QR 합성 (`vital-public-infographic` 호출).

---

## 󰏚 3. 선행 조건 및 의존성 (Prerequisites & Dependencies)

### ▢ 1. 필수 파일 및 환경
  ❍ `AGENTS.md` Rule S (하이브리드 클라우드 4-Way 동기화 및 448px 모바일 뷰포트 표준)
  ❍ `AGENTS.md` Rule L (공공 행사 의전 및 국민의례 진행 규정 - 대통령훈령 제438호)
  ❍ 동기화 파이프라인 스크립트:
    - `scripts/sync_festival_excel.py` (엑셀 $\leftrightarrow$ JSON)
    - `scripts/prepare-pages-output.js` (JSON $\to$ 정적 HTML 렌더링)
    - `scripts/sync-festival-to-cloud.js` (KV 클라우드 업로드)
    - `scripts/watch-and-sync-cloud.js` (300ms 디바운스 실시간 와처 데몬)

---

## 󰏚 4. 단계별 실행 런북 (Step-by-Step Execution Runbook)

### ▢ Phase 1. 4-Way 동기화 토폴로지 실행 (Quad-Sync Execution)
```text
[Layer 1: 행정 마스터 엑셀] (사용자 수정)
  │ ▲
  │ │ python scripts/sync_festival_excel.py
  ▼ │
[Layer 2: 로컬 디스크 SSOT] (data/FESTIVAL_YANGJAE_2026.json)
  │
  ├─────────────────────────────────────────┐
  │ (300ms 무인 자동 감시 데몬: watch-and-sync-cloud.js)
  ▼                                         ▼
[Layer 3: Cloudflare 정적 템플릿]         [Layer 4: Cloudflare KV 분산 레플리카]
(scripts/pages-template.html             (HCHPS_DATA / festival_yangjae_2026)
 -> out/festival/yangjae/index.html)     -> 24/7 전원 오프 시 무인 현장 관제판
```
1. **엑셀 수집 및 정규화:**
   - 사용자 또는 주무관이 수정한 마스터 엑셀을 감지하여 `python scripts/sync_festival_excel.py`로 수집.
2. **로컬 SSOT 및 React 컴포넌트 동기화:**
   - `data/FESTIVAL_YANGJAE_2026.json`에 원자적 쓰기 수행.
   - `src/components/festival/YangjaeFestivalDashboard.tsx` 뷰 리렌더링.
3. **정적 템플릿 컴파일:**
   - `node scripts/prepare-pages-output.js`를 실행하여 4대 탭 데이터가 바인딩된 단일 파일 정적 HTML 생성.
4. **Cloudflare KV 동기화:**
   - `node scripts/sync-festival-to-cloud.js`를 실행하여 원격 KV에 JSON 페이로드 업로드.

### ▢ Phase 2. 모바일 448px(`max-w-md`) 무결점 인체공학 관제 표준
1. **뷰포트 엄수:**
   - 모바일 컨테이너는 오직 `max-w-md mx-auto` (최대 448px)로 고정하며 가로 스크롤(`overflow-x-hidden`)을 영구 방어함.
2. **상단 4대 탭 위계 영구 동결 (Milestones 243/247):**
   ```text
   1. 추진과제  ->  2. 부스현황  ->  3. 업무분장  ->  4. 행사식순
   ```
   (어떠한 경우에도 업무분장과 행사식순의 순서를 임의로 역전하지 않음).
3. **6대 업무 구획 퀵 필터 캡슐:**
   - `1. 운영`, `2. 코스`, `3. 부스`, `4. VIP의전`, `5. 직원식사`, `6. 쓰레기처리`.
4. **일자별 다채널 배지 색상 표준:**
   - 사전준비 (`10.17~10.24`): 인디고 배지 (`bg-indigo-50 text-indigo-700`).
   - 행사전날 (`10.30`): 앰버/보라 배지 (`bg-amber-50 text-amber-700`).
   - 행사당일 (`10.31`): 스카이/슬레이트 배지 (`bg-sky-50 text-sky-700`).
5. **헤더 2행 분리 및 전폭 카드 스택:**
   - 좁은 화면에서 뱃지가 잘리는 현상을 방지하기 위해 헤더 행 분리(`flex flex-wrap gap-y-2`) 및 카드 100% 폭 유지.

### ▢ Phase 3. 공공 의전 및 국민의례 진행 규정 (대통령훈령 제438호)
1. **약식절차 1 공식 적용:**
   - ① **국기에 대한 경례:** 전주가 없는 애국가 반주 1절에 맞춰 실시함 (맹세문 낭송 없음).
   - ② **순국선열과 호국영령에 대한 묵념:** 묵념곡 연주 (10~15초).
   - ③ **자연스러운 착석 전환:** 묵념 종료 후 곧바로 "모두 자리에 정돈해 주시기 바랍니다." 안내.
2. **생략 멘트 절대 발언 금지 (Rule L.3):**
   - 사회자가 *"애국가 제창 및 순국선열에 대한 묵념은 생략하겠습니다"* 등의 생략 표현을 발언하는 것은 국가상징의 품격을 저해하므로 **사회자 대본 및 진행에서 절대 금지**함.

---

## 󰏚 5. 전용 스크립트 및 검증 CLI (Utility Scripts & Verification Commands)

```bash
# 1. 축제 실시간 동기화 및 탭 접힘(Collapsed) 단위 테스트 검증
npm test -- __tests__/yangjae-festival-realtime-collapsed-sync.test.tsx

# 2. 정적 모바일 템플릿 단독 컴파일 빌드
node scripts/prepare-pages-output.js

# 3. Cloudflare KV 원격 수동 동기화 실행
node scripts/sync-festival-to-cloud.js

# 4. 300ms 디바운스 무인 실시간 동기화 감시 데몬 실행
npm run watch:cloud
```

---

## 󰏚 6. 금지 패턴 및 안티패턴 체크리스트 (Anti-Patterns & Quality Guard)

| 구분 | 안티패턴 (Strictly Prohibited) | 정상 표준 대응책 (Compliant Standard) |
|:---:|:---|:---|
| **AP-F1** | 상단 네비게이션 탭에서 행사식순을 3번, 업무분장을 4번으로 배치 | 3. 업무분장 $\to$ 4. 행사식순 위계 영구 고정 |
| **AP-F2** | 로컬 JSON만 수정하고 정적 HTML 템플릿 및 Cloudflare KV 동기화 누락 | 4-Way 동기화 파이프라인 동시 구동 (`node scripts/prepare-pages-output.js`) |
| **AP-F3** | 모바일 테이블 뷰에서 가로 스크롤바가 발생하거나 우측 뱃지 글자가 잘림 | `max-w-md`, 전폭 카드 스택 및 헤더 2행 분리 적용 |
| **AP-F4** | 사회자 대본에 "애국가 제창 등은 생략하겠습니다" 생략 멘트 삽입 | 전주 없는 애국가 1절에 맞춘 경례 후 자연스러운 착석 전환 |
| **AP-F5** | 행사 마스터 엑셀의 컬럼 구조를 임의 변경하여 JSON 파서 역방향 수집 실패 | `DutyItem.headcount` 등 스키마 계약 100% 보존 |

---

## 󰏚 7. 자가 점검 및 사후 확인 프로토콜 (Self-Verification Protocol)

행사 데이터를 갱신하거나 UI를 조정한 에이전트는 다음을 검증해야 함:
1. `npm test -- __tests__/yangjae-festival-realtime-collapsed-sync.test.tsx`가 100% 통과함을 확인.
2. `node scripts/prepare-pages-output.js` 실행 후 `out/festival/yangjae/index.html` 파일이 최신 타임스탬프로 갱신되었는지 확인.
3. 448px 모바일 뷰포트에서 상단 4대 탭 순서(추진과제 $\to$ 부스현황 $\to$ 업무분장 $\to$ 행사식순)가 올바르게 렌더링되는지 확인.
