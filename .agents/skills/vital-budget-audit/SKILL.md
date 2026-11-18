---
name: vital-budget-audit
description: >-
  공공예산·사업설명서의 3중 총액 무결성을 검증하고 e-호조 회계 기준 일반지출·일상경비(daily_expense)·405-01 물품구매(추정가격·계약절차)를 격리 감사하는 스킬.
  예산 편성, 101-04 인건비 원단위·개별 천원 올림 산식, 405-01 물품구매 계약 사전절차, 보조금 가내시 한도, 불용 번다운 시뮬레이션 요구 시 사용
  (산출물 HWPX 조판은 vital-hwpx-docgen, 행사 부스·일정 싱크는 vital-festival-4way-sync, 마일스톤·PIPA·온톨로지 환류는 vital-governance-ops와 연계).
---

# 공공 재정·예산 수리적 정합성 감사 스킬 (vital-budget-audit)

## ▣ 1. 개요 및 목적 함수

### ▢ 1. 시스템 목적 함수 및 SSOT 경계
- 본 스킬은 **$\mathcal{J}_{\text{Budget}}$ (공공 재정·예산 포렌식 정합성 및 시뮬레이션 무결성)**과 `AGENTS.md` `Rule R`을 전담하며 e-호조 회계 기준 **오차 0원**을 보장함.
- **로컬 데이터 SSOT:** `data/BUDGET_CATEGORIES.json`, `data/BUDGET_ENTRIES.json`, `data/BUDGET_SIMULATIONS.json`
- **회계 규칙·서버 검증:** `src/lib/schemas.ts`, `src/lib/budget-rules.ts`, `src/lib/server/budget-validator.ts`, `src/lib/physicalActivityMetrics.ts`
- **시뮬레이션·뮤테이션 훅:** `src/hooks/useBudget.ts`, `src/hooks/useBudgetSimulator.ts`, `src/hooks/usePortfolioAnalytics.ts`, `src/app/api/data/route.ts`

### ▢ 2. 타 스킬 연계 핸드오프 및 $\mathcal{J}_{\text{Ontology}}$ 역방향 환류
- **HWPX 조판 (`vital-hwpx-docgen`):** 검증된 산출표·소요재원·`405-01` 추정가격 수치를 전달해 `Rule F, G` 한글 문서를 빌드함.
- **거버넌스 (`vital-governance-ops`):** `Rule B` Zod 하네스(`run-harness.js`), 계약직 비식별화·G2B `8자리-2자리` 하이픈 오탐 방어(`Rule Q`), 마일스톤 기록(`Rule E`)을 연계함.
- **역방향 환류 (Closed-Loop):** 도출된 법정 기한(일상감사·계약심사 후 14일 이내 집행전말보고, 납품기한, 분기별 정산 일정) 및 재정합의·심사 과업을 `data/SCHEDULES.json`(`scripts/sync-schedules.js`)과 `data/WORKING_MEMORY.json`에 환류함.

---

## ▣ 2. 활성화·비활성화 조건

### ▢ 1. 활성화 발화 패턴
- "예산 정합성·1원 단위 단수·사업설명서 검산", "일상경비·일반지출 잔액 분리 시뮬레이션", "가내시 기준 101-04 인건비·5대 보험 산출식 검증", "405-01 물품구매 추정가격·사전절차 감사".

### ▢ 2. 비활성화 조건
- 행사 타임테이블·부스·인력 분장 편성 (`vital-festival-4way-sync`).
- 순수 HWPX 서식 조판·XML 텍스트 치환 (`vital-hwpx-docgen`).

---

## ▣ 3. 선행 조건 및 런타임 스키마

- **규격·법령:** `AGENTS.md` `Rule R`, ｢공공부문 비정규직 처우개선 가이드라인｣, 서울시 공정수당·건강증진사업비 가내시 통보서, 4대 사회보험법(국민연금·건강·고용·산재·노인장기요양).
- **데이터 모델 (`src/lib/schemas.ts`):**
  - `BudgetCategory`: `id`, `name`, `totalBudget`, `detailedProject`, `statItem`, `fundingSource`, `fundingSplits`, `subItems`
  - `BudgetEntry`: `id`, `categoryId`, `amount`, `date`, `purpose`, `isPlanned`, `isSettled`, `linkedSubItemId`, `actionType` (`'general' | 'issuance' | 'daily_expense' | 'transfer' | 'correction' | 'settle'`), `transferDirection`

---

## ▣ 4. 단계별 실행 런북

### ▢ Phase 1. 3중 총액 일치성 및 보조금 상한 검산
- **수학적 불변식 ($\Delta = 0\text{ KRW}$):**
  $$\text{총사업비 (사업개요)} \equiv \sum \text{소요재원 (국고기금 + 시비 + 구비)} \equiv \sum \text{산출내역 목·세목 실합계}$$
- **가내시 보조금 상한:** 시비 보조금 통보액(예: 시비 `51,320천원` 상한 고정) 초과를 금지하며, 하위 `2)` 개별 천원 올림 합산으로 발생한 단수 증액분(예: 구비 `51,323천원`, 인건비 총 `102,643천원`)은 전액 자체재원(구비)으로 흡수함.

### ▢ Phase 2. 하위 `2)` 개별 천원 올림 후 상위 `1)` 합산 공리 (`101-04` 인건비)
- 하위 `2)` 부기에는 1원 단위 산출식을 표기하되, 상위 `1)` 편성액은 단순합 1회 올림을 금지하고 **각 하위 `2)` 항목별 개별 천원 올림($\lceil \text{원단위}/1,000 \rceil \times 1,000$) 후 합산**함:
  $$\text{상위 } 1)\text{ 편성액} \equiv \sum_{k=1}^{n} \left( \left\lceil \frac{\text{하위 } 2)_k\text{ 원단위 산출액}}{1,000} \right\rceil \times 1,000 \right) \ge \sum \text{하위 } 2)\text{ 원단위}$$
- **`101-04` 기간제근로자등보수 산출 기준 (`102,643천원`, 2명·월 기본급 `3,439,598원` / 209시간 $\to$ 통상시급 `16,457.4원`, 1일 통상임금 `131,659원`):**
  - `1)` **월 기본급 (`82,551,000원`):** $3,439,598 \times 2 \times 12 = 82,550,352\text{원} \xrightarrow{\text{올림}} 82,551,000\text{원}$
  - `1)` **퇴직금 및 연차수당 (`9,514,000원`):** `2)` 퇴직적립금($3,439,598 \times 2 = 6,879,196\text{원} \to 6,880,000\text{원}$) + `2)` 연차수당($131,659 \times 10 \times 2 = 2,633,180\text{원} \to 2,634,000\text{원}$) (※ 단순합 1회 올림 `9,513,000원` 금지).
  - `1)` **복지수당·명절상여 (`600,000원`):** `1)` 복지수당($20,000 \times 2 \times 12 = 480,000\text{원}$) + `1)` 명절상여($30,000 \times 2 \times 2 = 120,000\text{원}$).
  - `1)` **기관부담 5대 사회보험료 (`9,798,000원` — 기준보수 `6,879,196원` × 12월):**
    - `2)` 국민연금(`5.0%`): $4,127,518\text{원} \to 4,128,000\text{원}$
    - `2)` 건강보험(`3.595%`): $2,967,685\text{원} \to 2,968,000\text{원}$
    - `2)` 장기요양보험(`13.14%`): 건강보험 원단위($2,967,685\text{원}$) 기준 $389,954\text{원} \to 390,000\text{원}$
    - `2)` 고용보험(`1.75%`): $1,444,631\text{원} \to 1,445,000\text{원}$
    - `2)` 산재보험(`1.05%`): $866,779\text{원} \to 867,000\text{원}$ (※ 단순합 1회 올림 `9,797,000원` 금지).
  - `1)` **근로자 근무복 (`180,000원`):** `2)` 하계 근무복($35,000 \times 4 = 140,000\text{원}$) + `2)` 명찰($10,000 \times 4 = 40,000\text{원}$).

### ▢ Phase 3. e-호조 일상경비(`daily_expense`) 듀얼 파이프라인 무충돌 검증
- 일상경비 교부액(`dailyExpenseIssued`)은 교부 시점에 본청 일반지출 `spent`에 기산입되므로, 시뮬레이터 최종 잔액은 다음과 같이 격리 연산함:
  $$\text{currentRemaining} = \text{totalBudget} - \text{spent}, \quad \text{finalExpectedBalance} = \text{currentRemaining} - \text{simulatedGeneralExpenditure}$$
- `simulatedDailyExpenditure`는 `dailyExpenseRemaining` 내에서만 소진하며 `finalExpectedBalance`에서 중복 차감하지 않음.
- `isPlanned: true` 항목은 적자 예측(`[⚠️ 초과 예정]`)을 위해 HTTP 409 차단을 바이패스함.

### ▢ Phase 4. `405-01` 자산및물품취득비 추정가격·부가세 및 계약 사전절차 공리
- **단가·수량·추정가격 분리:** $\sum(\text{단가}\times\text{수량}) \equiv \text{총 소요예산(부가세 포함)}$, $\text{추정가격} = \lfloor \text{총액} / 1.1 \rfloor$, $\text{부가세} = \text{총액} - \text{추정가격}$ (예: `28,630,000원` $\to$ `26,027,273원`+`2,602,727원`; 거점형 `22,000,000원` $\to$ `20,000,000원`+`2,000,000원`; 출장형 8종 `6,630,000원` $\to$ `6,027,273원`+`602,727원`).
- **금액 구간별 사전절차:**
  - **계약금액 `1,000만원` 초과:** 재무과 재정합의(｢지방자치단체 회계관리에 관한 훈령｣) 및 G2B·구 홈페이지 발주계획 사전공개(평일 3일 이상).
  - **추정가격 `2,000만원` 이상:** 감사담당관 일상감사(｢강남구 일상감사 규정｣ 제4조) 및 계약심사(｢지방자치단체 입찰 및 계약 집행기준｣ 제3장), 심사결과 통보 후 **14일 이내 집행전말보고**.
  - **추정가격 `2,000만원` 이하:** ｢지방계약법 시행령｣ 제25조 제1항 제5호·제30조 1인 견적 수의계약(G2B 종합쇼핑몰 구매 포함).
  - **물품수급관리계획:** 단가 `1,000만원` 이상 반영 대상 / 미만 다수 품목 미대상 구분.

---

## ▣ 5. 전용 스크립트 및 검증 CLI

```bash
# 1. 빠른 런타임 Zod 스키마 및 예산 데이터 무결성 검증
node scripts/run-harness.js --quick

# 2. 예산 검증 엔진·통계 모달·시뮬레이터 단위 테스트
npx jest __tests__/budget-validator.test.ts __tests__/stat-item-detail-modal.test.tsx

# 3. 1원 단위 예산 정합성·적대적 오라클 파이썬 검증
python scratch/audit_budget_math.py
python scratch/adversarial_budget_oracle.py
```

---

## ▣ 6. 금지 패턴 및 안티패턴 체크리스트

| 구분 | 안티패턴 (Strictly Prohibited) | 정상 표준 대응책 (Compliant Standard) |
|:---:|:---|:---|
| **AP-B1** | 하위 `2)` 원단위 단순합 후 1회만 천원 올림 또는 절사 | **하위 `2)` 항목별 개별 천원 올림(`ceil`) 후 합산**하여 상위 `1)` 확정 (`9,514천원`, `9,798천원`) |
| **AP-B2** | 장기요양보험 원단위 계산 시 올림된 건강보험액(`2,968,000원`) 대입 | 건강보험 실산출액($2,967,685\text{원}$) × $13.14\%$($389,954\text{원}$) 표기 후 올림($390,000\text{원}$) |
| **AP-B3** | 일상경비 교부액이 본청·일상경비 잔액에서 이중 차감됨 | 일반지출과 일상경비 듀얼 파이프라인 격리 연산 |
| **AP-B4** | 단수 증액 발생 시 시비 보조금 상한을 상향 조정 | 시비(`51,320천원`) 고정, 단수 증액분 전액 구비(`51,323천원`) 흡수 |
| **AP-B5** | `isPlanned: true` 시뮬레이션 저장 시 HTTP 409 차단 | `isPlanned: true` 플래그 감지 시 409 바이패스 및 뱃지 시각화 |
| **AP-B6** | `405-01` 부가세 포함 총액을 추정가격으로 오인·차수 합계 불일치 | 추정가격($\lfloor\text{총액}/1.1\rfloor$) 분리, `1,000만원`/`2,000만원` 사전절차 대조 및 0원 오차 검산 |

---

## ▣ 7. 출력 기준 및 사후 검증 게이트

- **공통 출력·평어체 SSOT 위임:** 채팅 출력·표 우측 정렬(`---:`)·`Rule M`·`Rule P`·4대 자가 점검 게이트는 `AGENTS.md`를 준수함.
- **도메인 사후 검증 게이트:**
  - 총사업비 = 소요재원 = 산출내역 합계 차액 0원, `101-04` 개별 천원 올림 및 `405-01` 추정가격·계약절차 정합성을 전수 확인함.
  - `node scripts/run-harness.js --quick`·`npx jest __tests__/budget-validator.test.ts` 오류 0건 및 법정 기한·과업의 `SCHEDULES.json`·`WORKING_MEMORY.json` 환류를 확인함.
