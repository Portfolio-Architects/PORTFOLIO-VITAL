---
name: vital-hwpx-docgen
description: >-
  당해연도 실무 공문서와 전사 아카이브 RAG 검색을 결합하여 공공기관 표준 서식에 부합하는 한글(HWPX) 문서를 비파괴 방식으로 신규 빌드하는 스킬.
  공문서 기안서 초안 작성, 사업계획서 한글 변환, 법정 공문서 위계 및 행정 문장부호 표기, 보고서 한글 조판 요구 시 사용.
---

# 한글(HWPX) 공문서 자동 생성 및 서식 컴파일 스킬 (vital-hwpx-docgen)

## 󰏚 1. 개요 및 목적 함수 (Overview & Objective Function)

### ▢ 1. 시스템 목적 함수 매핑

- ❍ 본 스킬은 시스템 5대 목적 함수 중 **$\mathcal{J}_{\text{DocAuto}}$ (법령·아카이브 RAG 기반 HWPX 공문서 및 공공 디자인 자동화)**를 주관함.
- ❍ 공공 행정 실무관 수준의 품격 있는 개조식 공문서 문체를 구현하고, 템플릿 비파괴 복제 및 XML 텍스트 인플레이스 치환을 통해 한컴오피스 한글 문서 생성을 100% 자동화함.

### ▢ 2. 도메인 경계 및 단일 진실 공급원(SSOT)

- ❍ **서식 및 조판 표준 SSOT:** `docs/HWP_GENERATION_GUIDELINES.md`
- ❍ **HWPX 무손실 컴파일러:** `scratch/generate_new_hwpx.py`
- ❍ **행정 문체 및 문장부호 정규화 모듈:** `src/lib/administrativeFormatter.ts`
- ❍ **개인정보 비식별화 가드:** `scripts/privacy_guard.py`

---

## 󰏚 2. 활성화 조건 및 트리거 (Triggers & Activation Scenarios)

### ▢ 1. 사용자 대표 발화 패턴

- ❍ "공문서 초안 작성해줘", "기안서 마크다운으로 뽑아줘", "사업계획서 한글(HWPX)로 변환해줘"
- ❍ "작년 양재천 행사 결과보고서 참고해서 2026년 기획서 만들어줘"
- ❍ "지침 서식에 맞게 딩뱃 기호랑 2타 띄기 교정해서 출력해줘"

### ▢ 2. 비활성화 조건

- ❍ 예산의 단수 산출 및 5대 보험료 수리적 정합성 감사 (`vital-budget-audit` 호출).
- ❍ 16:9 가로형 포스터 및 코스도 이미지 시각 렌더링 (`vital-public-infographic` 호출).

---

## 󰏚 3. 선행 조건 및 의존성 (Prerequisites & Dependencies)

### ▢ 1. 데이터 소스 및 아카이브 경로

- ❍ **현행 실무 워크스페이스:** `D:\Desktop\공공문서 폴더\2026년` (현행 견적서, 기본계획, 공문)
- ❍ **전사 마스터 아카이브:** `F:\_Organized_Archive` (2015년~2026년 누적 실무 공문서)
- ❍ **국가법령 및 자치법규 RAG:** `src/app/api/law/route.ts` 및 국가법령정보센터 표준 조문

### ▢ 2. 기본 HWPX 원본 서식 템플릿

- ❍ `scratch/template.hwpx` (표준 용지 여백, 헤더/푸터 스타일, 문단 모양 내장)

---

## 󰏚 4. 단계별 실행 런북 (Step-by-Step Execution Runbook)

### ▢ Phase 1. 실무 아카이브 스캔 및 법적 근거 RAG 정립 (Fact & Statutory Grounding)

- ❍ **아카이브 팩트 수집:** 임의의 가상 시나리오 작성을 엄격히 금지하고, `D:\Desktop\공공문서 폴더\2026년` 및 `F:\_Organized_Archive` 내 유사 사업의 직전 연도 결과보고서, 지출결의서, 과업내역서를 검색하여 실측 수치와 세부 사업명을 확보함.
- ❍ **상위 법령 및 자치법규 조항 명시:** 모호한 "관련 법령에 따라" 서술을 배제하고, 반드시 현행 법조문 번호와 항·호·목을 특정함 (예: ｢지역보건법｣ 제11조 제1항 제5호 가목, ｢강남구 구민체육진흥 조례｣ 제4조).

### ▢ Phase 2. 공공 표준 개조식 마크다운 초안 작성 (Draft Formulation)

- ❍ **행정 개조식 문체 및 종결어미 의무 준수 (Rule M & Rule P):**
  - 구어체 종결어미("~하겠습니다", "~인 것 같습니다") 및 불필요한 친근감 표명을 전면 배제함.
  - 명사형 또는 간결한 개조식 종결어미를 적용함 (`-조치 완료함`, `-반영함`, `-구현함`, `-추진 예정임`, `-으로 확인됨`).
  - **Zero Psychological Ventriloquism (Rule P):** 사용자의 내면 심리(예: "주무관님이 화가 난", "답답한 심정")나 협상 상대방의 심리를 소설화하여 서술하는 감정적 표현을 전면 차단하고, 오직 객관적 계약 조항과 사실관계만을 기술함.
- ❍ **다단계 항목 기호 및 위계 체계 준수:**
  - 기획서/보고서 딩뱃: `󰏚` (U+F03DA) $\to$ `▢` (U+25A2) $\to$ `❍` (U+274D) $\to$ `-` $\to$ `•` (U+2022) $\to$ `※` (U+203B).
  - 법정 공문서 위계: `1.` $\to$ `가.` $\to$ `1)` $\to$ `가)` $\to$ `⑴` $\to$ `㈎` $\to$ `①` $\to$ `㉮`.
- ❍ **문장별 강제 엔터(개행) 및 단락 분리:**
  - 마크다운 초안 및 채팅 응답에서 비표준 기호(`󰏚`, `▢`, `❍`, `가.`, `1)`)가 한 줄로 병합되지 않도록 반드시 마크다운 리스트 불릿 결합(`- ❍ `, `  - `) 또는 줄 끝 스페이스 2칸(`  \n`) / 빈 줄(`\n\n`)을 적용하여 **1문장 = 1줄(Enter)**로 분리함.

### ▢ Phase 3. 비파괴 HWPX 복제 및 XML 텍스트 인플레이스 컴파일

- ❍ **비파괴 복제 실행:** 원본 템플릿(`scratch/template.hwpx`)을 직접 수정하지 않고 신규 출력 경로로 복제함.
- ❍ **Python 컴파일러 가동:**
  ```bash
  python scratch/generate_new_hwpx.py \
    --template "scratch/template.hwpx" \
    --output "d:/Desktop/공공문서 폴더/2026년/2026_신규공문서.hwpx" \
    --markdown "scratch/draft.md"
  ```
- ❍ **XML 제어 객체 격리 및 ZIP 헤더 패치:**
  - 표(`hp:tbl`), 글상자(`hp:box`), 이미지, 수식 등의 제어 노드를 파괴하지 않고 순수 본문 `hp:t` 텍스트만 치환함.
  - `struct.pack_into`를 통해 ZIP 압축 플래그 비트(Bit 2 Fast Deflating, value 4)를 바이너리 복원하여 한컴오피스 100% 호환성을 확보함.

### ▢ Phase 4. 한글 표준 준거 지침 최종 검증 (Compliance Audit)

- ❍ `docs/HWP_GENERATION_GUIDELINES.md` 8대 항목 전수 대조:
  - 용지 여백(상하 15.0mm, 좌우 20.0mm, 머리말/꼬리말 10.0mm).
  - 서체 크기(대제목 22pt, 중간제목 16~18pt, 본문 15pt, 세부 13pt).
  - 2타 띄기(기호 뒤 1~2타, 들여쓰기 2타, 붙임 뒤 2타, 문서 끝 `  끝.`).
  - 문장부호(날짜 마침표+공백 `2026. 9. 14.`, 24시각제 `14:00`, 금액 병기 `금10,000,000원(금일천만원)`, 홑낫표 `｢ ｣`).

---

## 󰏚 5. 전용 스크립트 및 검증 CLI (Utility Scripts & Verification Commands)

```bash
# 1. 초안 마크다운 문서 내 개인정보(주민등록번호, 전화번호 등) 정밀 스캔
python scripts/privacy_guard.py --scan scratch/draft.md

# 2. HWPX 무손실 자동 생성 실행
python scratch/generate_new_hwpx.py --template scratch/template.hwpx --output scratch/output.hwpx --markdown scratch/draft.md

# 3. 행정 문체 포매터 단위 테스트 검증
npm test -- __tests__/administrative-formatter.test.ts
```

---

## 󰏚 6. 금지 패턴 및 안티패턴 체크리스트 (Anti-Patterns & Quality Guard)

| 구분 | 안티패턴 (Strictly Prohibited) | 정상 표준 대응책 (Compliant Standard) |
|:---:|:---|:---|
| **AP-H1** | 원본 `scratch/template.hwpx`를 직접 열어 수정하거나 덮어쓰기 | 항상 신규 출력 경로를 지정하여 복제 빌드 |
| **AP-H2** | "주무관님이 답답해하시는", "업체의 무책임한 태도에 화가 났다" 등 심리 대변 | 탈감정적 객관 사실 및 계약서 조항 명시 (Rule P) |
| **AP-H3** | "관련 법령에 의거하여" 등 법조문 번호가 누락된 추상적 서술 | ｢지역보건법｣ 제11조 등 조항·호·목 정확히 인용 |
| **AP-H4** | 연월일 표기 시 끝 마침표 누락(`2026. 9. 14`) 또는 일 뒤 공백 누락 | `2026. 9. 14.` (일 뒤 마침표 찍고 1공백 필수) |
| **AP-H5** | 문서 종결 시 공백 없이 `끝.` 표기하거나 붙임 뒤 1공백만 띄움 | 붙임 뒤 2공백(`붙임  `), 문서 마감 시 2공백 후 `  끝.` |
| **AP-H6** | 마크다운에서 `❍ 문장1\n❍ 문장2`를 단일 개행만 하여 한 줄로 병합됨 | `- ❍ 문장` 리스트 결합 또는 문단 간 빈 줄(`\n\n`)로 1문장 1줄 엔터 강제 |

---

## 󰏚 7. 응답 출력 포맷 및 자가 점검 프로토콜 (Output Formatting & Self-Verification Protocol)

### ▢ 1. 개조식 문단 분리 및 문장별 강제 엔터(줄바꿈) 규칙 (Mandatory Line-Break Standard)

- ❍ **단일 문단 줄글 병합 절대 금지:** 마크다운 파서가 `󰏚`, `▢`, `❍`, `•`, `※`, `가.`, `1)` 등 비표준 기호의 단일 개행(`\n`)을 한 줄로 합쳐버리는 현상을 막기 위해, 반드시 마크다운 헤딩(`## 󰏚`, `### ▢`) 또는 마크다운 리스트 불릿 결합(`- ❍ `, `  - `, `    - • `) 및 문단 간 **빈 줄(`\n\n`, Double Enter)**을 삽입하여 줄바꿈을 강제함.
- ❍ **1문장 1줄(1-Sentence-Per-Line) 원칙:** 하나의 항목 줄에 마침표(`.`)로 끝나는 문장을 2개 이상 이어 쓰지 않으며, 문장이 끝날 때마다 반드시 엔터(줄바꿈)하여 다음 줄의 하위 항목으로 분리함.
- ❍ **종결어미 엄수:** 모든 문장은 개조식 명사형 종결(`-함`, `-됨`, `-임`, `-음`)로 끝맺으며 문서 말미에 `  끝.`을 표기함.

### ▢ 2. 사후 검증 체크리스트

- ❍ `python scripts/privacy_guard.py --scan <초안.md>`를 실행하여 주민등록번호 및 개인식별정보 노출이 0건인지 입증함.
- ❍ `python scratch/generate_new_hwpx.py` 실행 로그에서 `Successfully built HWPX with 100% identical ZIP headers`를 확인함.
- ❍ 생성된 HWPX의 텍스트가 깨지거나 표 서식이 밀리지 않았는지 문서 구조를 최종 승인함.
