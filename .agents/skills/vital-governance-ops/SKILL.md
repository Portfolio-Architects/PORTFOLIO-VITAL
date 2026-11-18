---
name: vital-governance-ops
description: >-
  엔지니어링 마일스톤 기록, 3-Way 규칙 동기화·9대 문서 자동 감사(sync-rules.js), PIPA 개인정보 비식별화·G2B 오탐 방어(privacy_guard.py),
  RSI 평어체·VLDS 감사, 도메인 산출물 역방향 온톨로지 환류(일정·문서색인·작업기억) 및 12대 시트+축제 SSOT Zod 하네스를 총괄 운영하는 허브 스킬.
  신규 마일스톤 등록, AGENTS.md·SKILL.md·docs/*.md 감사, 개인정보 사전 스캔(--scan/--sanitize), 하네스 구동 시 사용
  (예산·405-01 산식은 vital-budget-audit, HWPX 빌드는 vital-hwpx-docgen, 행사 UI는 vital-festival-4way-sync, 포스터·화보는 vital-public-infographic에 위임).
---

# 시스템 거버넌스 및 제로트러스트 하네스 운영 스킬 (vital-governance-ops)

## ▣ 1. 개요 및 목적 함수

### ▢ 1. 시스템 목적 함수 및 SSOT 경계
- 본 스킬은 **$\mathcal{J}_{\text{Security}}$ (PIPA 가드레일·Zero-Trust 무결성)**과 **$\mathcal{J}_{\text{Ontology}}$ (스케줄·암묵지 자산화)**를 주관하며 전 스킬의 거버넌스 허브(`Rule A~E, H, I, J, K, O~Q`)를 수행함.
- **3-Way SSOT:** `PORTFOLIO VITAL - Engineering Report.md`, `PORTFOLIO VITAL - Engineering Milestones.md`, `AGENTS.md`, `scripts/sync-rules.js`
- **PIPA·문체·VLDS SSOT:** `docs/PERSONAL_INFO_PROTECTION_GUIDE.md`, `docs/VLDS_DESIGN_SYSTEM.md`, `src/lib/vlds-microcopy.ts`, `src/lib/administrativeFormatter.ts`
- **CLI·하네스·아카이브:** `scripts/privacy_guard.py`, `scripts/run-harness.js`, `scripts/rsi_evaluator.js`, `scripts/curate_admin_archive.py`, `scripts/organize_and_index_archive.py`
- **일정·작업기억 SSOT:** `SCHEDULE.md`, `data/SCHEDULES.json`, `scripts/sync-schedules.js`, `src/app/api/calendar/feed.ics/route.ts`, `data/WORKING_MEMORY.json`

### ▢ 2. 타 스킬 연계 핸드오프
- **예산·회계 (`vital-budget-audit`):** 세출 산식·일상경비·`405-01` 감사 위임 후 Zod 하네스(`run-harness.js`)로 마무리함.
- **문서·포스터 (`vital-hwpx-docgen`, `vital-public-infographic`):** 산출물 전후 `privacy_guard.py --scan`·`rsi_evaluator.js` 감사를 수행함.
- **행사 4-Way 싱크 (`vital-festival-4way-sync`):** 동기화 완료 후 마일스톤 기록 및 규칙 동기화를 수행함.

---

## ▣ 2. 활성화·비활성화 조건

### ▢ 1. 활성화 발화 패턴
- "패치 내역 리포트·AGENTS.md 동기화", "개인정보 포함 여부 스캔·마스킹", "자연어 일정 등록·구글 캘린더 링크", "전체 하네스·Zod·9대 문서 감사 실행".

### ▢ 2. 비활성화 조건
- 예산 1원 단위 감사 (`vital-budget-audit`), HWPX 조판 (`vital-hwpx-docgen`), 축제 448px 모바일·KV 동기화 (`vital-festival-4way-sync`).

---

## ▣ 3. 핵심 거버넌스 준거 규칙

- `Rule B` (Zod Loud-Failure), `Rule D` (로컬 서버 기동·내장 브라우저 실행 금지), `Rule E` (패치 기록·3-Way·9대 문서 감사), `Rule K` (자연어 스케줄·역방향 환류), `Rule M & P` (개조식·1문장 1줄·평어체), `Rule O` (바탕화면·아카이브 불변 보존), `Rule Q` (PIPA 비식별화·G2B 오탐 방어).

---

## ▣ 4. 단계별 실행 런북

### ▢ Phase 1. 패치 로깅, 3-Way 동기화 및 9대 문서 자동 감사 (`scripts/sync-rules.js`)
- `PORTFOLIO VITAL - Engineering Report.md` 제8장 최상단에 표준 마일스톤 블록을 작성함:
  ```markdown
  ### [Milestone <N>: <제목>] <한 줄 영문 요약> (<YYYY-MM-DD>)
  * **개요 및 목적**:
    - 세부 내용 1
  ```
- `node scripts/sync-rules.js` 구동으로 `Engineering Milestones.md` 미러링 및 `AGENTS.md` 제4장 경량 동기화(`23,800B` 한도)를 수행하고, 내장 `auditGovernanceAndSkillDocs()`로 9대 문서(`AGENTS.md` + 5대 `SKILL.md` + 3대 `docs/*.md`)의 PUA(`U+F03DA`)·이중 불릿·`rsi_evaluator.js` 위반·데드링크·`docs/*.md` 말미 `  끝.` 표기를 자동 감사함.

### ▢ Phase 2. PIPA 사전 비식별화 및 G2B 오탐 방어 (`scripts/privacy_guard.py`)
- 외부 문서 인입·공문서 생성 전 `python scripts/privacy_guard.py --scan <대상>`으로 고유식별·민감정보·연락처·계좌를 검출하며, 조달청 G2B 10자리 코드는 `세부품명번호 60109399-01`(`8자리-2자리`) 하이픈 표준으로 계좌(`ACCOUNT`) 오탐을 방어함.
- 검출 시 `python scripts/privacy_guard.py --sanitize <대상> --output <사본>`으로 표준 마스킹(`880101-1******`, `900512-5******`, `010-****-1234`) 사본을 생성하며 원본을 보존함.

### ▢ Phase 3. 자연어 스케줄러 · iCal 피드 및 $\mathcal{J}_{\text{Ontology}}$ 역방향 환류
- 자연어 일정에서 일시·제목·담당자·유형(`security`|`meeting`|`education`|`other`)을 추출해 `SCHEDULE.md`·`data/SCHEDULES.json`(`node scripts/sync-schedules.js`)에 동시 반영하고 `[📅 구글 캘린더에 추가]` 링크 및 `/api/calendar/feed.ics` 구독 피드를 제공함.
- **역방향 환류 (Closed-Loop):** `vital-hwpx-docgen`·`vital-budget-audit`·`vital-festival-4way-sync`에서 확정된 법정 기한·행사 일정은 `SCHEDULES.json`, 신규 공문 메타데이터는 `data/ADMIN_DOC_INDEX.json`(`scripts/curate_admin_archive.py`), 부서 협조·후속 과업은 `data/WORKING_MEMORY.json`에 환류함.

### ▢ Phase 4. 바탕화면 면역 및 12대 시트 + 축제 SSOT Zod 하네스 검증
- 사용자 명시 지시 없는 `D:\Desktop` 및 `F:\_Organized_Archive` 파일 이동·정리·삭제를 영구 차단함(`Rule O`).
- `node scripts/run-harness.js` 및 `npx tsc --noEmit`으로 12대 시트와 `validateFestivalSSOT`(`data/FESTIVAL_YANGJAE_2026.json`·`src/lib/constants/yangjaeFestivalFallback.ts`의 `StrictFestivalDataSchema`·예산·행수 일치)를 검증하며 `[HARNESS ZOD ERROR]` 은폐를 금지함.

---

## ▣ 5. 전용 스크립트 및 검증 CLI

```bash
# 1. 3-Way 마일스톤·매니페스트 동기화 및 9대 문서 자동 감사
node scripts/sync-rules.js

# 2. PIPA 개인정보 보호법 준거 정밀 스캔
python scripts/privacy_guard.py --scan AGENTS.md

# 3. Zod 스키마·축제 SSOT·ESLint 종합 하네스 (빠른 검증: --quick)
node scripts/run-harness.js

# 4. 일정 동기화 · 핵심 거버넌스/문체/VLDS 테스트 · 타입 검사
node scripts/sync-schedules.js
npx jest __tests__/harness-schema-parity.test.ts __tests__/administrative-formatter.test.ts __tests__/vlds-concise-microcopy.test.tsx
npx tsc --noEmit
```

---

## ▣ 6. 금지 패턴 및 안티패턴 체크리스트

| 구분 | 안티패턴 (Strictly Prohibited) | 정상 표준 대응책 (Compliant Standard) |
|:---:|:---|:---|
| **AP-G1** | `Engineering Report.md` 기록 후 `sync-rules.js` 생략 | 마일스톤 추가 즉시 `node scripts/sync-rules.js` 구동 |
| **AP-G2** | 주민번호·전화번호 평문 파일 대화창·커밋 노출 | `privacy_guard.py --scan` 사전 검출 후 `--sanitize` 처리 |
| **AP-G3** | 정리 목적의 `D:\Desktop`·`F:\_Organized_Archive` 임의 이동/삭제 | 사용자 명시 지시 없는 100% 면역 준수 (Rule O) |
| **AP-G4** | Zod 스키마 검증 에러 catch/fallback 은폐 | Loud-Failure 원칙에 따라 데이터 생성 원천 즉시 수정 |
| **AP-G5** | `AGENTS.md` 용량 `23,800B` 초과로 프롬프트 절단 유발 | `23,800B` 이하 유지로 `Rule A~S` 무손실 주입 보장 |
| **AP-G6** | 로컬호스트 오픈 시 내장 브라우저(`browser` 서브에이전트) 실행 | 백그라운드 서버 기동 및 `[http://localhost:3001](http://localhost:3001)` 링크 출력 (Rule D) |
| **AP-G7** | `AGENTS.md`·`SKILL.md` 간 규칙·경로·심볼 불일치 방치 | 9대 문서 실존·라우팅 대조 및 자동 감사 통과 유지 |
| **AP-G8** | G2B 10자리 코드 무하이픈 계좌 오탐·산출물 일정/색인 환류 누락 | G2B `8자리-2자리`(`60109399-01`) 표기 및 `SCHEDULES`·`ADMIN_DOC_INDEX`·`WORKING_MEMORY` 환류 |

---

## ▣ 7. 출력 기준 및 사후 검증 게이트

- **공통 출력·평어체 SSOT 위임:** 채팅 출력·표 우선·1문장 1줄·`Rule M`·`Rule P`·4대 자가 점검 게이트는 `AGENTS.md`를 준수함.
- **도메인 사후 검증 게이트:**
  - `node scripts/sync-rules.js` 3-Way 동기화, 9대 문서 감사(`0` errors) 및 `AGENTS.md` 용량 `23,800B` 이하를 확인함.
  - `python scripts/privacy_guard.py --scan`, `scripts/rsi_evaluator.js` 위반 0건, `npx tsc --noEmit` 및 `node scripts/run-harness.js --quick` 통과를 확인함.
