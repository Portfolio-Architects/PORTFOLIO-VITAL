---
name: vital-governance-ops
description: >-
  엔지니어링 마일스톤 패치 로깅, 3-Way 규칙 동기화(sync-rules.js), PIPA 개인정보 비식별화, Zod 런타임 하네스 및 무결성 게이트키퍼를 총괄 운영하는 스킬.
  신규 마일스톤 등록, AGENTS.md 및 리포트 최신화, 개인정보 사전 스캔(--scan) 및 마스킹(--sanitize), 전체 하네스 테스트 구동 시 사용.
---

# 시스템 거버넌스 및 제로트러스트 하네스 운영 스킬 (vital-governance-ops)

## 󰏚 1. 개요 및 목적 함수 (Overview & Objective Function)

### ▢ 1. 시스템 목적 함수 매핑
  ❍ 본 스킬은 시스템 5대 목적 함수 중 **$\mathcal{J}_{\text{Security}}$ (개인정보 보호법 가드레일 및 Zero-Trust 하네스 무결성)**과 **$\mathcal{J}_{\text{Ontology}}$ (자연어 스케줄러 및 암묵지 자산화)**를 지원함.
  ❍ 코드 및 아키텍처 변경 시 엔지니어링 마일스톤을 실시간 기록하고, `scripts/sync-rules.js`를 통해 3개 핵심 거버넌스 문서 간 정합성을 유지하며, PIPA 개인정보 비식별화 가드레일과 RFC 5545 표준 iCal 캘린더 동기화를 총괄함.

### ▢ 2. 도메인 경계 및 단일 진실 공급원(SSOT)
  ❍ **엔지니어링 리포트 마스터:** `PORTFOLIO VITAL - Engineering Report.md`
  ❍ **엔지니어링 마일스톤 미러:** `PORTFOLIO VITAL - Engineering Milestones.md`
  ❍ **에이전트 거버넌스 매니페스트:** `AGENTS.md`
  ❍ **개인정보 비식별화 CLI:** `scripts/privacy_guard.py`
  ❍ **3-Way 규칙 동기화 CLI:** `scripts/sync-rules.js`
  ❍ **일정 스토리지 및 iCal 피드:** `SCHEDULE.md`, `data/SCHEDULES.json`, `src/app/api/calendar/feed.ics/route.ts`

---

## 󰏚 2. 활성화 조건 및 트리거 (Triggers & Activation Scenarios)

### ▢ 1. 사용자 대표 발화 패턴
  ❍ "신규 패치 내역 엔지니어링 리포트랑 AGENTS.md에 동기화해줘"
  ❍ "외부 자료 첨부하기 전에 개인정보 포함되어 있는지 스캔해줘"
  ❍ "내일 오후 2시 보건소 회의 일정 등록하고 구글 캘린더 링크 줘"
  ❍ "전체 하네스 및 Zod 스키마 검증 돌려줘"

### ▢ 2. 비활성화 조건
  ❍ 공공예산 1원 단위 정합성 감사 (`vital-budget-audit` 호출).
  ❍ HWPX 공문서 서식 빌드 (`vital-hwpx-docgen` 호출).
  ❍ 축제 448px 모바일 관제 및 KV 동기화 (`vital-festival-4way-sync` 호출).

---

## 󰏚 3. 선행 조건 및 의존성 (Prerequisites & Dependencies)

### ▢ 1. 핵심 거버넌스 조항
  ❍ `AGENTS.md` Rule E (패치 기록 및 규칙 동기화)
  ❍ `AGENTS.md` Rule K (자연어 스케줄러 & 구글 캘린더 연동 파이프라인)
  ❍ `AGENTS.md` Rule O (바탕화면 및 전사 아카이브 파일 절대 불가침 헌장)
  ❍ `AGENTS.md` Rule Q (개인정보 보호법 준거 비식별화 가드레일)
  ❍ `AGENTS.md` Rule B (시끄러운 실패 - Zod Loud-Failure)

---

## 󰏚 4. 단계별 실행 런북 (Step-by-Step Execution Runbook)

### ▢ Phase 1. 엔지니어링 패치 로깅 및 3-Way 동기화 (`scripts/sync-rules.js`)
1. **리포트에 신규 마일스톤 기록 (Rule E):**
   - `PORTFOLIO VITAL - Engineering Report.md` 제8장 최상단에 표준 마일스톤 블록 작성:
     ```markdown
     ### [Milestone <N>: <제목>] <한 줄 영문 요약> (<YYYY-MM-DD>)
     * **개요 및 목적**:
       - 세부 내용 1
       - 세부 내용 2
     ```
2. **3-Way 규칙 동기화 스크립트 실행:**
   ```bash
   node scripts/sync-rules.js
   ```
   - 엔진이 `Engineering Report.md`에서 마일스톤 블록을 파싱하여, `Engineering Milestones.md`에 미러링하고, `AGENTS.md` 제4장 상위 12개 마일스톤 및 과거 누적 요약 로그를 원자적으로 동기화함.

### ▢ Phase 2. PIPA 개인정보 사전 비식별화 가드레일 (Rule Q & `privacy_guard.py`)
1. **정밀 사전 스캔 (Pre-Scan):**
   - 외부 문서를 인입하거나 공문서/데이터를 생성하기 전 반드시 실행:
     ```bash
     python scripts/privacy_guard.py --scan <대상문서>
     ```
   - 고유식별정보(주민등록번호, 외국인등록번호, 카드번호, 계좌번호) 및 휴대전화번호, 일반전화번호 검출.
2. **자동 마스킹 비식별화 (Sanitize):**
   - 검출 시 즉각 마스킹 사본 생성:
     ```bash
     python scripts/privacy_guard.py --sanitize <대상문서> --output <비식별사본>
     ```
   - 주민등록번호 `880101-1******`, 휴대전화 `010-****-1234` 표준 마스킹 적용. 원본 문서는 변조 없이 안전하게 보존.

### ▢ Phase 3. 자연어 스케줄러 및 RFC 5545 iCal 피드 연동 (Rule K)
1. **자연어 파싱 및 듀얼 스토리지 반영:**
   - 대화창의 자연어("내일 14시 보건소 회의")에서 일시, 제목, 담당자, 범주(`security`|`meeting`|`education`|`other`)를 자동 추출.
   - `SCHEDULE.md` 및 `data/SCHEDULES.json`에 즉시 동시 저장.
2. **구글 캘린더 원클릭 추가 링크 제공:**
   - URL 인코딩된 Google Calendar Event 생성 링크(`[📅 구글 캘린더에 추가]`)를 사용자 응답에 포함.
3. **iCal 실시간 구독 피드 제공:**
   - `/api/calendar/feed.ics` 엔드포인트를 통해 스마트폰 및 웹 캘린더 실시간 양방향 구독 지원.

### ▢ Phase 4. 바탕화면 절대 면역 및 제로트러스트 하네스 검증 (Rule O & Rule B)
1. **바탕화면 절대 불가침 (Rule O):**
   - 사용자의 명시적 지시 없는 한 `D:\Desktop`의 작업 파일 및 `F:\_Organized_Archive` 파일을 이동, 정리, 삭제하는 행위를 영구 차단함.
2. **런타임 Zod 스키마 및 정적 타입 게이트키퍼 가동:**
   ```bash
   node scripts/run-harness.js
   npx tsc --noEmit
   ```
   - `[HARNESS ZOD ERROR]` 발생 시 오류 페이로드를 즉각 분석하여 데이터 생성 소스를 수정하며 오류를 절대로 억압(suppress)하지 않음.

---

## 󰏚 5. 전용 스크립트 및 검증 CLI (Utility Scripts & Verification Commands)

```bash
# 1. 3-Way 마일스톤 및 매니페스트 동기화 실행
node scripts/sync-rules.js

# 2. PIPA 개인정보 보호법 준거 정밀 스캔
python scripts/privacy_guard.py --scan AGENTS.md

# 3. Zod 스키마, ESLint, TypeScript 종합 하네스 테스트
node scripts/run-harness.js

# 4. 정적 타입 무결점 검증
npx tsc --noEmit
```

---

## 󰏚 6. 금지 패턴 및 안티패턴 체크리스트 (Anti-Patterns & Quality Guard)

| 구분 | 안티패턴 (Strictly Prohibited) | 정상 표준 대응책 (Compliant Standard) |
|:---:|:---|:---|
| **AP-G1** | `Engineering Report.md`에 마일스톤을 기록한 후 `sync-rules.js` 실행 생략 | 마일스톤 추가 즉시 `node scripts/sync-rules.js` 구동 |
| **AP-G2** | 주민등록번호나 전화번호가 평문으로 포함된 파일을 AI 대화 또는 커밋에 노출 | `privacy_guard.py --scan`으로 사전 검출 후 `--sanitize` 처리 |
| **AP-G3** | 정리를 목적으로 `D:\Desktop`이나 `F:\_Organized_Archive`의 파일을 임의 이동/삭제 | 사용자 명시적 명령 없는 한 100% 면제(Immunity) 준수 (Rule O) |
| **AP-G4** | Zod 스키마 검증 에러 발생 시 catch나 fallback으로 오류를 은폐 | Loud-Failure 원칙에 따라 데이터 생성 원천 로직 즉시 수정 |
| **AP-G5** | `AGENTS.md` 내의 필수 규칙 조항(Rule A~S)을 임의로 축소하거나 누락 | 전사 거버넌스 헌장 보존 및 정합성 유지 |

---

## 󰏚 7. 자가 점검 및 사후 확인 프로토콜 (Self-Verification Protocol)

거버넌스 작업을 수행한 에이전트는 다음 단계를 순서대로 완결해야 함:
1. `node scripts/sync-rules.js` 실행 후 `Engineering Milestones.md` 및 `AGENTS.md`의 동기화가 오류 없이 완료되었는지 확인.
2. `python scripts/privacy_guard.py --scan <문서>` 실행으로 식별정보 노출이 0건임을 입증.
3. `npx tsc --noEmit`을 실행하여 TypeScript 타입 오류가 0건(PASS)임을 확인.
