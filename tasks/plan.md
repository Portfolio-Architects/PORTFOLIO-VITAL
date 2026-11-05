# Implementation Plan: 마스터 아카이브(`F:\_Organized_Archive`) 물리적 폴더 재편 및 본문·사진·연계사업 통합 검색 체계 구축

## 󰏚 1. 개요 (Overview)

- ❍ `F:\_Organized_Archive` 내 총 8,664개 파일(사진 4,158개, 행정문서 4,100개 등)의 탐색 병목을 해소하기 위해 ① 최상위 루트 클린업 및 `연도별 → 9대 핵심 단위사업별` 물리적 폴더 통폐합(`scripts/organize_and_index_archive.py --organize`), ② `.hwpx`/`.hwp`/`.pdf`/`.xlsx`/`.pptx` 본문 텍스트 추출 및 사진 문맥 자동 태깅 기반 로컬 고속 색인(`data/ARCHIVE_INDEX.json`), ③ VITAL 웹 대시보드(`localhost:3001`) 내 **「아카이브 탐색기(Archive Explorer)」** 탭, 본문 스니펫·추론 검색, 연관 사업 클러스터(기안문+예산서+보고서+사진 묶음) 뷰어, 사진 썸네일 갤러리 및 원클릭 파일/폴더 실행 브릿지(`/api/archive/*`)를 구축함.

---

## 󰏚 2. 핵심 아키텍처 결정 사항 (Architecture Decisions)

- ❍ **무손실 물리적 폴더 재편 및 100% 롤백 보장**:
  - `F:\_Organized_Archive` 최상위 루트에 흩어진 낱개 파일 237개 및 임시 폴더 30여 개를 생산 연도(`2026년` 등) 및 9대 핵심 단위사업 폴더 하위로 이관하고, `2026년` 내 33개 파편 폴더를 9대 핵심 사업 폴더로 통합함.
  - 기존 `_Duplicates`(78개) 및 `_Legacy_Duplicates`(2,378개)는 `_Archive_Duplicates` 하위로 격리하여 기본 검색에서 제외함.
  - 동명 파일 충돌 시 SHA-256 해시를 비교하여 동일 본문이면 `_Archive_Duplicates`로 이동하고 내용이 다르면 `_v2` 접미사를 부여하며 모든 이동 내역을 `data/ARCHIVE_MIGRATION_LOG.json`에 기록하여 `--rollback` 실행 시 100% 원상 복구되게 함.

- ❍ **본문 전문(Full-Text) 추출 + PIPA 마스킹 + 동의어/사업 추론 색인**:
  - 외부 DB 서버 없이 Python 표준/경량 파서로 `.hwpx`(ZIP XML), `.hwp`(PrvText/BodyText), `.xlsx`(시트·셀), `.pdf`, `.pptx`, `.txt`, `.md` 본문을 추출하고 주민등록번호·휴대전화번호·계좌번호 패턴을 자동 마스킹(`AGENTS.md` Rule Q)한 뒤 `data/ARCHIVE_INDEX.json`에 저장함.
  - 이미지 파일(4,158개)은 소속 폴더, 수정/촬영 일자, 동일 폴더 내 행정 문서의 핵심 키워드를 상속받아 `연도`, `단위사업`, `자료유형(현장사진/포스터·시안/로고)` 태그를 자동 부여함.

- ❍ **VITAL 웹 앱 통합 및 청크·가상화 격리 (`AGENTS.md` Rule H, I, J)**:
  - `ModuleType`에 `'archive'`를 추가하고 상단 네비게이션(`Sidebar.tsx`)에 **「아카이브 탐색기」** 탭을 배치하되, `ProtectedApp.tsx`에서 `dynamic(() => import('@/components/archive/ArchiveExplorerView'), { ssr: false })`로 지연 로딩하여 초기 대시보드 하이드레이션 성능을 보존함.
  - 로컬 전용 API 라우트(`/api/archive`, `/api/archive/image`, `/api/archive/open`)를 통해 색인 조회, 안전한 이미지 썸네일 스트리밍(경로 이탈 검증), 윈도우 기본 프로그램/탐색기 원클릭 실행을 지원함.

---

## 󰏚 3. 의존성 그래프 (Dependency Graph)

```
[Task 1: 물리적 폴더 재편 및 롤백 엔진 (organize_and_index_archive.py --organize)]
       │
       ▼
[Task 2: 문서 본문 추출·사진 문맥 태깅 및 PIPA 마스킹 색인기 (--index → data/ARCHIVE_INDEX.json)]
       │
       ▼
[Task 3: 로컬 브릿지 API 라우트 (/api/archive, /api/archive/image, /api/archive/open) 및 타입 정의]
       │
       ▼
[Task 4: VITAL 아카이브 탐색기 UI (본문·추론 검색 + 연관 사업 묶음 패널 + 사진 썸네일 갤러리)]
       │
       ▼
[Task 5: Jest 통합 테스트 작성, 9대 도메인 하네스 검증 및 마일스톤 동기화 (sync-rules.js)]
```

---

## 󰏚 4. 단계별 과업 목록 요약 (Task List Summary)

### ▢ Phase 1: 물리적 아카이브 재편 및 본문·사진 색인 파이프라인 (Foundation)
- [ ] **Task 1**: `F:\_Organized_Archive` 무손실 폴더 통폐합 스크립트 구현 및 실행 (`scripts/organize_and_index_archive.py --organize`)
- [ ] **Task 2**: 다중 문서(`.hwpx`/`.hwp`/`.pdf`/`.xlsx`/`.pptx`) 본문 추출·PIPA 마스킹 및 사진 문맥 태깅 색인기 구현·실행 (`data/ARCHIVE_INDEX.json`)

### ▢ Checkpoint 1: 아카이브 정돈 및 색인 검증
- [ ] `F:\_Organized_Archive` 루트 낱개 파일 0건 및 `2026년` 9대 핵심 사업 폴더 통합 확인
- [ ] `data/ARCHIVE_MIGRATION_LOG.json` 및 `data/ARCHIVE_INDEX.json` 생성·무결성 확인

### ▢ Phase 2: VITAL 로컬 API 브릿지 및 아카이브 탐색기 UI (Core Features)
- [ ] **Task 3**: 아카이브 검색·이미지 스트리밍·윈도우 파일/폴더 열기 API 라우트 구현 (`src/app/api/archive/*`)
- [ ] **Task 4**: `ArchiveExplorerView.tsx` 컴포넌트(본문 스니펫 검색, 연관 사업 클러스터, 사진 갤러리) 및 `Sidebar.tsx` / `ProtectedApp.tsx` 연동

### ▢ Checkpoint 2: 종단간(End-to-End) 기능 및 거버넌스 검증
- [ ] **Task 5**: Jest 단위·통합 테스트 추가(`__tests__/archive-explorer.test.tsx`), 전체 테스트·하네스 통과 및 `Engineering Report.md` / `AGENTS.md` 동기화(`node scripts/sync-rules.js`)

---

## 󰏚 5. 위험 요인 및 완화 전략 (Risks and Mitigations)

| 위험 요인 | 영향도 | 완화 전략 |
|:---|:---:|:---|
| 폴더 이동 중 동명 파일 덮어쓰기 또는 유실 | High | 이동 전 SHA-256 해시 대조(동일 파일은 `_Archive_Duplicates` 이동, 상이 파일은 `_v2` 접미사 부여) 및 `ARCHIVE_MIGRATION_LOG.json` 전수 기록 |
| 손상되었거나 암호화된 `.hwp`/`.pdf` 파싱 예외 | Medium | 파일별 `try-except` 격리 및 파일명·경로·메타데이터 폴백 색인으로 전체 인덱싱 중단 원천 방지 |
| 4,158개 이미지 썸네일 렌더링 시 브라우저 메모리 과부하 | Medium | 페이지네이션/윈도잉(1회 60개 노출 + 더보기/가상 스크롤) 및 `loading="lazy"` 적용 |
| 경로 조작(Path Traversal) 보안 취약점 | High | `/api/archive/image` 및 `/api/archive/open`에서 대상 경로가 `F:\_Organized_Archive` 내부에 속하는지 `path.resolve` 정규화 검증 강제 |

---

## 󰏚 6. 미결 질문 (Open Questions)

- ❍ 없음 (설계 명세서 Builder Check 및 사용자 최종 승인 완료됨).
  끝.
