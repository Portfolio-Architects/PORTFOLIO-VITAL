---
name: vital-budget-audit
description: >-
  공공예산·사업설명서의 수리적 무결성을 전수 검증하고 e-호조 회계 기준 일반지출과 일상경비(daily_expense) 듀얼 파이프라인을 격리 감사하는 스킬.
  예산 편성, 사업설명서(신체활동 등) 검토, 원단위 산출 부기와 천원단위 편성액 절상·절사 대조, 보조금 가내시 한도 준수, 불용 위험 번다운 시뮬레이션 요구 시 사용.
---

# 공공 재정·예산 수리적 정합성 감사 스킬 (vital-budget-audit)

## 󰏚 1. 개요 및 목적 함수 (Overview & Objective Function)

### ▢ 1. 시스템 목적 함수 매핑
  ❍ 본 스킬은 시스템 5대 목적 함수 중 **$\mathcal{J}_{\text{Budget}}$ (공공 재정·예산 수리적 정합성 및 시뮬레이션 무결성)**을 단독으로 책임짐.
  ❍ 지방자치단체(보건소·구청)의 재정 구조와 e-호조(e-Hojo) 공공회계 시스템 기준을 완벽히 모사하여, 예산 요구서·사업설명서·집행 시뮬레이터 전반에서 **오차 0원(단 1원의 단수 불일치도 불용)**을 달성함.

### ▢ 2. 도메인 경계 및 단일 진실 공급원(SSOT)
  ❍ **로컬 스토리지 SSOT:** `data/BUDGET_CATEGORIES.json`, `data/BUDGET_ENTRIES.json`
  ❍ **시뮬레이션 및 뮤테이션 컨트롤러:** `src/hooks/useBudget.ts`, `src/hooks/useBudgetSimulator.ts`
  ❍ **백엔드 무결성 게이트키퍼:** `src/app/api/data/route.ts`

---

## 󰏚 2. 활성화 조건 및 트리거 (Triggers & Activation Scenarios)

### ▢ 1. 사용자 대표 발화 패턴
  ❍ "예산 정합성 검증해줘", "1원 단위 단수 맞아?", "사업설명서 예산내역 검토해줘"
  ❍ "일상경비랑 일반지출 잔액 분리해서 시뮬레이션 돌려줘"
  ❍ "가내시 지침 기준으로 인건비 및 5대 보험 산출식 재계산해줘"
  ❍ "신체활동 사업설명서 HWPX 예산 테이블 검수해줘"

### ▢ 2. 비활성화 조건
  ❍ 행사 현장의 타임테이블, 부스 배치, 인력 분장 편성 (`vital-festival-4way-sync` 호출).
  ❍ 순수 HWPX 공문서 서식 레이아웃 및 텍스트 빌드 (`vital-hwpx-docgen` 호출).

---

## 󰏚 3. 선행 조건 및 의존성 (Prerequisites & Dependencies)

### ▢ 1. 필수 참조 규격 및 법령
  ❍ `AGENTS.md` Rule R (공공예산·사업설명서 수리적 정합성 및 e-호조 회계 검증 규격)
  ❍ 관계부처 합동 ｢공공부문 비정규직(기간제) 처우개선 가이드라인｣
  ❍ 서울시 당해연도 공정수당 및 건강증진사업비 가내시 통보서
  ❍ 4대 사회보험법(국민연금법, 국민건강보험법, 고용보험법, 산업재해보상보험법, 노인장기요양보험법)

### ▢ 2. 런타임 데이터 구조
  ❍ `BudgetCategory`: `id`, `name`, `code`, `allocatedAmount`, `expenseType` ('general' | 'daily_expense')
  ❍ `BudgetEntry`: `id`, `categoryId`, `amount`, `spentDate`, `isPlanned`, `actionType`

---

## 󰏚 4. 단계별 실행 런북 (Step-by-Step Execution Runbook)

### ▢ Phase 1. 공공예산 3중 총액 일치성 전수 검산 (3-Tier Total Alignment)
1. **수학적 불변식 검증:**
   $$\text{총사업비 (사업개요)} \equiv \sum \text{소요재원 (국고기금 + 시비 + 구비)} \equiv \sum \text{산출내역 목·세목 실합계}$$
2. **단수 허용 오차:** $\Delta = 0\text{ KRW}$ (단 1원의 차이도 오류로 판정).
3. **가내시 보조금 매칭비율 검증:**
   - 시비와 구비의 매칭 한도 통보액(예: 시비 51,320천원, 구비 51,321천원, 총 102,641천원)을 절대 초과할 수 없음.
   - 편성 과정에서 발생하는 천원단위 절상 단수는 전액 자치구 자체재원(구비)으로 흡수 편성함.

### ▢ Phase 2. 원단위 산출 부기(`2)`) vs 천원단위 편성액(`1)`) 위계 대조
1. **101-04 기간제근로자보수 법정 산출식 체계:**
   - **월 기본급:** 209시간 단가 적용 ($3,439,598\text{원}$).
     $$\text{기본급 연간 소요액} = 3,439,598\text{원} \times 2\text{명} \times 12\text{개월} = 82,550,352\text{원} \implies \text{상위 } 82,551,000\text{원 (천원 올림)}$$
   - **통상시급 및 1일 통상임금:**
     $$\text{통상시급} = \frac{3,439,598\text{원}}{209\text{시간}} = 16,457.4\text{원} \implies \text{1일 통상임금(8시간)} = 131,659\text{원}$$
   - **법정 퇴직적립금 (12개월 만근 기준):**
     $$\text{퇴직금 소요액} = 3,439,598\text{원} \times 2\text{명} \times 1\text{개월} = 6,879,196\text{원} \implies \text{상위 } 6,879,000\text{원}$$
   - **연차유급휴가 미사용수당 (10일 기준):**
     $$\text{연차수당} = 131,659\text{원} \times 10\text{일} \times 2\text{명} = 2,633,180\text{원} \implies \text{상위 } 2,634,000\text{원}$$
   - **5대 기관부담 사회보험료 원단위 정밀식:**
     * 국민연금 ($4.5\%$): $3,439,598 \times 4.5\% \times 2 \times 12 = 3,714,765\text{원}$
     * 건강보험 ($3.545\%$): $3,439,598 \times 3.545\% \times 2 \times 12 = 2,926,409\text{원}$
     * 장기요양보험 ($13.14\%$): **반드시 실제 건강보험 산출액을 피승수로 곱함.**
       $$2,926,409\text{원} \times 13.14\% = 384,529\text{원} \quad (\text{올림액 2,927천원을 곱할 시 단수 오탈자 발생})$$
     * 고용보험 ($1.15\%$): $3,439,598 \times 1.15\% \times 2 \times 12 = 949,329\text{원}$
     * 산재보험 ($0.85\%$): $3,439,598 \times 0.85\% \times 2 \times 12 = 701,677\text{원}$
     * 원단위 실합계: $3,714,765 + 2,926,409 + 384,529 + 949,329 + 701,677 = 8,676,709\text{원} \implies \text{상위 } 8,677,000\text{원}$
2. **정합성 공리:** 상위 편성액 $\ge \sum \text{하위 산출부기 합계}$. 초과된 잉여 단수는 예비 유보분으로 산출내역서에 명기함.

### ▢ Phase 3. e-호조 일상경비(`daily_expense`) 듀얼 파이프라인 무충돌 검증
1. **회계 흐름 원칙:**
   - 지자체 e-호조 시스템에서 일상경비 교부액(`dailyExpenseIssued`)은 교부 완료 시점에 본청 일반지출 `spent`에 기산입됨.
2. **시뮬레이터 최종 잔액 산출 수식:**
   $$\text{currentRemaining} = \text{totalBudget} - \text{spent}$$
   $$\text{finalExpectedBalance} = \text{currentRemaining} - \text{simulatedGeneralExpenditure}$$
3. **이중 차감 방지 (Anti-Double-Deduction):**
   - 일상경비 예정 지출액(`simulatedDailyExpenditure`)은 오직 이미 교부된 `dailyExpenseRemaining` 범위 내에서만 소진되며, 본청 가용잔액(`finalExpectedBalance`)에서 절대로 중복 차감하지 않음.
4. **시뮬레이션 예외 허용:**
   - `isPlanned: true` 항목은 적자 발생 예측(`[⚠️ 초과 예정]`)을 위해 백엔드 HTTP 409 잔액 초과 차단을 바이패스하고 영속화함.

---

## 󰏚 5. 전용 스크립트 및 검증 CLI (Utility Scripts & Verification Commands)

```bash
# 1. 빠른 런타임 Zod 스키마 및 예산 데이터 무결성 검증
node scripts/run-harness.js --quick

# 2. 예산 통계 모달 및 정합성 단위 테스트 실행
npm test -- __tests__/stat-item-detail-modal.test.tsx

# 3. 신규 예산 HWPX 문서 내 1원 단위 정합성 파이썬 감사 실행
python scratch/parse_budget_hwpx.py --input "data/budget_sample.hwpx"
```

---

## 󰏚 6. 금지 패턴 및 안티패턴 체크리스트 (Anti-Patterns & Quality Guard)

| 구분 | 안티패턴 (Strictly Prohibited) | 정상 표준 대응책 (Compliant Standard) |
|:---:|:---|:---|
| **AP-B1** | 상위 천원 올림액과 하위 1원 산출식 합계의 차이를 무시하고 임의 절사 | 상위 천원 올림 예산액 $\ge$ 하위 부기 실산출식 합계 증명 |
| **AP-B2** | 장기요양보험료 계산 시 천원 단위로 올림된 건강보험액을 피승수로 대입 | 원단위 건강보험 실산출액($2,926,409\text{원}$)에 $13.14\%$ 적용 |
| **AP-B3** | 일상경비 교부액이 본청 잔액과 일상경비 잔액에서 이중 차감되도록 연산 | 일반지출과 일상경비 듀얼 파이프라인 분리 연산 |
| **AP-B4** | 시비·구비 매칭 비율에서 1천원의 단수가 발생하자 시비 보조금 통보액을 상향 | 시비 통보액은 고정(상한), 단수 발생분은 전액 구비(자체재원)로 흡수 |
| **AP-B5** | 시뮬레이터에서 초과 지출 예정을 테스트하려는데 HTTP 409로 데이터 저장 거부 | `isPlanned: true` 플래그 감지 시 409 에러 바이패스 및 뱃지 시각화 |

---

## 󰏚 7. 자가 점검 및 사후 확인 프로토콜 (Self-Verification Protocol)

예산 데이터를 수정하거나 사업설명서를 생성한 에이전트는 다음 단계를 거쳐야 함:
1. 총사업비 = 소요재원 합계 = 산출내역 목별 합계 간 차액이 정확히 0원인지 계산기로 전수 대조함.
2. 모든 법정 인건비의 1인당 월 기본급, 통상임금, 퇴직금, 4대보험 요율이 법령 규격과 일치하는지 확인.
3. `node scripts/run-harness.js --quick`을 실행하여 Zod 유효성 검증 실패(`[HARNESS ZOD ERROR]`)가 0건임을 입증함.
