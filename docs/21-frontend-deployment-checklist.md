# 프론트엔드 배포 체크리스트

## 배포 전

- `npm install`로 의존성을 설치한다.
- `npm run verify`가 통과하는지 확인한다.
- 2026-07-01 기준 `npm run verify`는 Vitest 9개 파일, 43개 테스트와 production build를 포함한다.
- Vercel 제출 번들은 `npm run build`로 확인한다. GitHub Pages 백업 번들은 `npm run build:github-pages`로 확인한다.
- 시크릿 창 기준으로 샘플 데이터 체험 흐름을 확인한다.
- 실제 금융 인증정보를 요구하는 화면이 없는지 확인한다.

## 권장 데모 흐름

1. 홈에서 샘플 데이터를 불러온다.
2. 목표 화면에서 목표 소비액 또는 목표 저축액을 바꾼다.
3. 홈의 총 지출, 진행률, 오늘 가능예산 변화를 확인한다.
4. 캘린더에서 과소비일과 정기 결제일을 누른다.
5. 코치 화면에서 오늘의 소비 가이드, 미션, 정기 결제 점검을 확인한다.
6. 추가 화면에서 직접 거래를 하나 저장하고 홈 갱신을 확인한다.

## Vercel

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- 설정 파일: `vercel.json`
- 제출 URL: `https://kt-ai-contest.vercel.app/`

## Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- 설정 파일: `netlify.toml`

## GitHub Pages

- Workflow: `.github/workflows/deploy-github-pages.yml`
- Build command: `npm run build:github-pages`
- 백업 URL: `https://2476ae.github.io/KT_AIContest/`
- GitHub 저장소 Settings > Pages에서 Source를 GitHub Actions로 둔다.

## 제출 QA 리포트

- [배포와 제출 데모 QA 리포트](22-deployment-demo-qa.md)
- [AI 기능 인계 계약](23-ai-integration-contract.md)
- [배포 활성화 가이드](24-deployment-activation-guide.md)

## AI 기능 연결 시

- 프론트는 `src/services/aiAdapter.ts`의 `AiProvider` 계약을 기준으로 결과를 받는다.
- 실제 API 연결 후에도 화면 컴포넌트는 provider 구현을 직접 알지 않게 유지한다.
- 실패 시에는 로컬 provider 또는 이전 분석 결과로 graceful fallback을 제공한다.
