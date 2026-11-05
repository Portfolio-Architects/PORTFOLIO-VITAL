# Task Breakdown (`tasks/todo.md`)

## Task 1: `F:\_Organized_Archive` 물리적 폴더 구조 재편 및 롤백 엔진 구현·실행

**Description:** `F:\_Organized_Archive` 최상위 루트에 흩어진 낱개 파일(237개)과 임시 압축 해제 폴더(30여 개)를 생산 연도(`2026년` 등) 및 9대 핵심 단위사업 폴더 하위로 이관하고, `2026년` 내부의 33개 파편 폴더를 9대 핵심 사업 폴더로 통합하며, 기존 중복 폴더(`_Duplicates`, `_Legacy_Duplicates`)를 `_Archive_Duplicates`로 격리하는 Python 스크립트(`scripts/organize_and_index_archive.py --organize`)를 작성·실행한다. 모든 이동은 SHA-256 해시 충돌 검사와 함께 `data/ARCHIVE_MIGRATION_LOG.json`에 전수 기록되며 `--rollback` 옵션으로 즉시 복구할 수 있다.

**Acceptance criteria:**
- [x] `F:\_Organized_Archive` 최상위 루트에 낱개 파일이 0개이고 연도별 폴더(`2018년`~`2026년`)와 `_Archive_Duplicates`만 존재함.
- [x] `F:\_Organized_Archive\2026년` 하위 폴더가 9대 핵심 단위사업 표준 폴더(`01_기획총괄_주요업무_행감` ~ `09_일반행정_보안_법령_기타`)로 통폐합됨.
- [x] 이동 내역이 `data/ARCHIVE_MIGRATION_LOG.json`에 전수 기록되고 단 1건의 파일 유실도 발생하지 않음 (총 2,507건 무손실 이관).

**Verification:**
- [x] CLI 검증: `python scripts/organize_and_index_archive.py --verify-organization` 실행 시 루트 잔류 낱개 파일 0건 및 전후 총 파일 수 일치 확인.

**Dependencies:** None

**Files likely touched:**
- `scripts/organize_and_index_archive.py`
- `data/ARCHIVE_MIGRATION_LOG.json`

**Estimated scope:** Small (1-2 files)

---

## Task 2: 다중 문서 본문 추출·사진 문맥 태깅 및 PIPA 마스킹 색인기 구현·실행

**Description:** `scripts/organize_and_index_archive.py --index` 명령을 통해 `_Archive_Duplicates`를 제외한 모든 아카이브 파일의 메타데이터와 `.hwpx`, `.hwp`, `.pdf`, `.xlsx`, `.pptx`, `.txt`, `.md` 본문 텍스트·표 내용을 추출하고, 주민등록번호·전화번호·계좌번호를 자동 마스킹(`AGENTS.md` Rule Q)하며, 사진 파일(`.jpg`, `.png`, `.jpeg`)에 소속 사업·연도·자료유형(현장사진/포스터·시안/로고)·동일 폴더 문서 키워드를 자동 태깅하여 `data/ARCHIVE_INDEX.json`을 생성한다.

**Acceptance criteria:**
- [x] `data/ARCHIVE_INDEX.json`에 전체 비중복 파일(총 6,201개)의 경로, 연도, 단위사업, 확장자, 수정일, 크기, 본문 추출 텍스트(문서류 2,805건, 시트류 544건, 발표자료 116건), 문맥 태그(사진류 2,396건)가 생성됨.
- [x] 파일명에 키워드가 없는 문서도 본문 키워드로 검색 매칭되며 개인정보 패턴(주민번호·전화번호)이 마스킹됨.
- [x] 이미지 파일에 `연도`, `단위사업`, `imageCategory`(`photo` | `poster` | `logo`), `keywords`가 태깅됨.

**Verification:**
- [x] CLI 검증: `python scripts/organize_and_index_archive.py --index` 완료 후 샘플 쿼리(`수변문화쉼터`, `KakaoTalk`, `copy_`) 테스트 스크립트 통과.

**Dependencies:** Task 1

**Files likely touched:**
- `scripts/organize_and_index_archive.py`
- `data/ARCHIVE_INDEX.json`

**Estimated scope:** Small (1-2 files)

---

## Checkpoint 1: After Tasks 1-2 (아카이브 물리 정돈 및 색인 검증)
- [x] `F:\_Organized_Archive` 9대 핵심 사업 폴더 구조 및 파일 수 무결성 확인
- [x] `data/ARCHIVE_INDEX.json` 생성 및 본문/사진 태그 정상 추출 확인

---

## Task 3: 로컬 브릿지 API 라우트(`/api/archive/*`) 및 타입 정의 구현

**Description:** VITAL 웹 애플리케이션에서 아카이브 색인을 고속 검색(키워드·동의어 추론·본문 스니펫·연관 사업 클러스터 반환)하고, `F:\_Organized_Archive` 내 사진 썸네일을 안전하게 스트리밍하며, 선택한 파일 또는 폴더를 윈도우 기본 연결 프로그램/탐색기로 즉시 실행하는 Next.js API 라우트 3종을 구현한다.

**Acceptance criteria:**
- [x] `GET /api/archive`: 검색어(`q`), 연도(`year`), 단위사업(`project`), 유형(`category`), 선택 파일 기준 연관 클러스터(`clusterFor`) 쿼리를 처리하여 본문 하이라이트 스니펫 및 연관 묶음 자료를 반환함.
- [x] `GET /api/archive/image?path=...`: `F:\_Organized_Archive` 내부 경로인지 정규화 검증 후 이미지 바이너리를 적절한 `Content-Type` 및 `Cache-Control` 헤더와 함께 반환함.
- [x] `POST /api/archive/open`: `{ path, mode: 'file' | 'folder' | 'reindex' }` 요청 시 경로 이탈을 차단하고 로컬 파일을 열거나 탐색기 폴더에서 선택 실행함.

**Verification:**
- [x] 단위 테스트 및 API 핸들러 검증 통과.
- [x] `npx tsc --noEmit` 정적 타입 검사 에러 0건.

**Dependencies:** Task 2

**Files likely touched:**
- `src/types/archive.ts`
- `src/types/index.ts`
- `src/hooks/useArchiveExplorer.ts`
- `src/app/api/archive/route.ts`
- `src/app/api/archive/image/route.ts`
- `src/app/api/archive/open/route.ts`

**Estimated scope:** Medium (3-5 files)

---

## Task 4: VITAL 아카이브 통합 탐색기 UI (`ArchiveExplorerView.tsx`) 및 네비게이션 연동

**Description:** VITAL 웹 대시보드 상단 네비게이션(`Sidebar.tsx`) 및 `ProtectedApp.tsx`에 **「아카이브 탐색기」** 모듈(`archive`)을 추가하고, ① 본문 일치 스니펫 및 동의어·약칭 추론 검색창, ② 연도별·9대 핵심사업별·파일유형별 원클릭 필터 바, ③ 선택한 자료와 연계된 **동일 사업 기안문(HWPX) + 예산서(XLSX) + 보고서(PDF) + 현장 사진(JPG) 묶음(Cluster) 패널**, ④ 사진 전용 **고속 썸네일 그리드 갤러리 및 미리보기 모달**, ⑤ **[파일 열기] / [폴더 열기]** 원클릭 버튼을 갖춘 `ArchiveExplorerView.tsx`를 구현한다.

**Acceptance criteria:**
- [x] 상단 네비게이션 바에서 `아카이브 탐색기` 탭 클릭 시 지연 로딩(`dynamic`)을 통해 화면이 전환됨.
- [x] 파일명에 키워드가 없더라도 본문 내용으로 검색되어 일치 문장(스니펫)이 하이라이트 표시됨.
- [x] 특정 문서/사진 선택 시 우측(또는 하단) 연관 자료 묶음 패널에 동일 단위사업의 관련 문서·예산서·사진이 함께 표시됨.
- [x] 사진 갤러리 모드에서 썸네일 그리드 조회, 이미지 확대 모달, `[파일 열기]`/`[폴더 열기]` 버튼이 정상 동작함.

**Verification:**
- [x] `npx tsc --noEmit` 통과.
- [x] 기존 대시보드·네비게이션 테스트(`__tests__/main-and-festival-minimalist-design.test.tsx`, `__tests__/archive-explorer.test.tsx`) 통과.

**Dependencies:** Task 3

**Files likely touched:**
- `src/components/archive/ArchiveExplorerView.tsx`
- `src/components/Sidebar.tsx`
- `src/components/ProtectedApp.tsx`

**Estimated scope:** Medium (3-4 files)

---

## Task 5: 통합 테스트 작성, 9대 도메인 하네스 검증 및 거버넌스 문서 동기화

**Description:** 아카이브 탐색기 API 및 UI 컴포넌트에 대한 Jest 테스트(`__tests__/archive-explorer.test.tsx`)를 작성하여 전체 테스트 스위트와 9대 도메인 Zod 하네스(`scripts/run-harness.js`)를 통과시키고, `PORTFOLIO VITAL - Engineering Report.md`에 신규 마일스톤을 기록한 뒤 `node scripts/sync-rules.js`로 3-Way 동기화를 완료한다.

**Acceptance criteria:**
- [x] `__tests__/archive-explorer.test.tsx` 신규 테스트 및 기존 테스트 스위트 100% 통과.
- [x] `node scripts/run-harness.js` 9대 도메인 무결성 검증 통과.
- [x] `PORTFOLIO VITAL - Engineering Report.md` 기록 및 `node scripts/sync-rules.js` 실행 완료(AGENTS.md 24KB 이하 유지).

**Verification:**
- [x] `npx jest __tests__/archive-explorer.test.tsx` 통과.
- [x] `node scripts/run-harness.js` 및 `node scripts/sync-rules.js` 정상 종료.

**Dependencies:** Task 4

**Files likely touched:**
- `__tests__/archive-explorer.test.tsx`
- `PORTFOLIO VITAL - Engineering Report.md`
- `AGENTS.md`

**Estimated scope:** Medium (3 files)

---

## Checkpoint 2: Final Complete Verification
- [x] 모든 체크리스트 항목 완료 및 물리적 아카이브·웹 탐색기 종단간 동작 확인
- [x] 정적 타입 검사, Jest 테스트, 하네스, 규칙 동기화 스크립트 100% 통과
