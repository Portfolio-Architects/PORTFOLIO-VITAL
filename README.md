# PORTFOLIO VITAL — Work & Wealth Architecture

공공 재정·예산 수리적 정합성 검증, 대규모 현장 행사 448px 모바일 관제(24/7 Cloudflare Pages·KV 레플리카), 법령·아카이브 RAG 기반 한글(HWPX) 공문서 자동화, 그리고 시맨틱 행정 온톨로지·스케줄 환류를 통합한 하이브리드 공공 행정 플랫폼.

## 아키텍처 개요 (Modified FSD + M-V-C + Hybrid Edge)

| 계층 | 구성 경로 | 핵심 역할 |
|:---|:---|:---|
| **모델 (SSOT)** | `src/app/api/` (16개 라우트 + `/llm/chat`), `data/*.json` | 12대 도메인 + 축제 SSOT Zod 검증, 20버전 순환 백업, 글로벌 툼스톤, 원자적 쓰기 |
| **뷰 (UI & VLDS)** | `src/components/`, `src/components/ui/` | React 19.2.7 + Tailwind v4 단일 라이트(`color-scheme: light`)·무조사 마이크로카피 UI |
| **컨트롤러 (Hooks)** | `src/hooks/` (28개 커스텀 훅) | 모든 API 페칭·예산 시뮬레이션(`useBudgetSimulator`)·행사 동기화(`useYangjaeFestival`) 격리 |
| **클라우드 엣지** | `functions/` (6개 Edge 모듈), Cloudflare KV(`HCHPS_DATA`) | `watch-and-sync-cloud.js` 300ms 무인 4-Way 싱크 기반 24/7 모바일 현장 관제 |
| **자동화 CLI** | `scripts/`, `scratch/generate_new_hwpx.py` | 3단 방침서·공문서 HWPX 비파괴 빌드, PIPA 비식별화, 9대 거버넌스·하네스 검증 |

## 로컬 실행 및 핵심 검증 CLI

```bash
# 1. 로컬 개발 서버 실행 (http://localhost:3001)
npm run dev

# 2. 정적 타입 · 12대 도메인 + 축제 SSOT Zod 하네스 검증
npx tsc --noEmit
node scripts/run-harness.js --quick

# 3. 마일스톤 3-Way 동기화 및 9대 거버넌스·스킬·지침 문서 감사
node scripts/sync-rules.js

# 4. PIPA 개인정보 사전 스캔 및 Jest 테스트 스위트 실행
python scripts/privacy_guard.py --scan AGENTS.md
npm test
```

## 핵심 거버넌스 및 영구 지침 문서

- **최상위 매니페스트:** [`AGENTS.md`](AGENTS.md) (`Rule A~S` 및 온디맨드 스킬 라우팅)
- **엔지니어링 리포트:** [`PORTFOLIO VITAL - Engineering Report.md`](PORTFOLIO%20VITAL%20-%20Engineering%20Report.md)
- **도메인 스킬셋:** [`.agents/skills/`](.agents/skills/) (`vital-budget-audit`, `vital-hwpx-docgen`, `vital-festival-4way-sync`, `vital-public-infographic`, `vital-governance-ops`)
- **영구 지침 SSOT:** [`docs/HWP_GENERATION_GUIDELINES.md`](docs/HWP_GENERATION_GUIDELINES.md) · [`docs/VLDS_DESIGN_SYSTEM.md`](docs/VLDS_DESIGN_SYSTEM.md) · [`docs/PERSONAL_INFO_PROTECTION_GUIDE.md`](docs/PERSONAL_INFO_PROTECTION_GUIDE.md)
