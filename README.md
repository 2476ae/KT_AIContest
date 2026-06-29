# 머니루틴 캘린더

K-AI Contents Award Track B 솔루션 부문 제출을 목표로 하는 AI 소비 캘린더 웹앱 프론트엔드입니다.

## 프론트엔드 실행

현재 저장소에는 제출용 웹앱의 프론트엔드 MVP가 포함되어 있습니다.

```bash
npm install
npm run dev
```

개발 서버 기본 주소는 `http://127.0.0.1:5173/`입니다. 포트가 사용 중이면 Vite가 다음 포트로 자동 이동합니다.

검증 명령:

```bash
npm run test:run
npm run build
npm run build:github-pages
npm run verify
```

2026-06-30 기준 `npm run verify`는 Vitest 8개 파일, 36개 테스트와 Vite production build를 통과합니다. GitHub Pages 백업 번들은 `npm run build:github-pages`로 확인합니다.

## 배포

이 저장소는 Vercel을 주 제출 URL로 사용하고, GitHub Pages와 Netlify 설정을 백업 경로로 유지합니다.

- Vercel: `https://kt-ai-contest.vercel.app/`, `vercel.json`, `npm run build`, output `dist`
- Netlify: `netlify.toml`, `npm run build`, publish `dist`
- GitHub Pages: `.github/workflows/deploy-github-pages.yml`, `npm run build:github-pages`

GitHub Pages 백업 URL은 `https://2476ae.github.io/KT_AIContest/`입니다. 저장소 Settings > Pages에서 Source를 GitHub Actions로 설정하면 `master` 푸시 후 workflow가 배포합니다.

## OpenAI API 연결

브라우저에는 OpenAI API key를 넣지 않습니다. 프론트는 `src/services/openAiProxyProvider.ts`를 통해 서버 프록시만 호출하고, 서버 프록시는 `api/ai/classify.js`, `api/ai/coach.js`에서 OpenAI Responses API를 호출합니다.

프론트 활성화 env:

- `VITE_AI_PROVIDER=openai-proxy`
- `VITE_AI_PROXY_BASE_URL`은 선택 사항입니다. Vercel 전체 배포처럼 같은 도메인에서 `/api/ai/*`를 호출하는 경우 비워둘 수 있습니다.

서버 프록시 env:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` 기본값 `gpt-4.1-mini`
- `AI_ALLOWED_ORIGINS` 예: `https://kt-ai-contest.vercel.app,http://localhost:5173`

GitHub Pages를 제출 URL로 유지하는 경우 `VITE_AI_PROXY_BASE_URL`은 별도 Vercel/Node 프록시 배포 URL을 바라보게 설정합니다.

비용 보호를 위해 OpenAI 호출은 명시 행동에만 연결되어 있습니다. AI 코치 탭 진입만으로는 호출하지 않고, `OpenAI 분석 업데이트` 버튼을 눌렀을 때만 AI 코치 리포트를 요청합니다. 직접 입력 화면도 `자동 분류` 상태로 저장할 때만 분류 API를 호출하고, 카테고리를 직접 선택하면 외부 분류를 호출하지 않습니다.

예산 계산은 월 목표를 초과했더라도 바로 하루 권장 한도를 0원으로 고정하지 않습니다. 월수입과 저축 목표를 함께 고려해 `현실 조정 목표`와 `조정 저축 목표`를 계산하고, 남은 일수 기준 하루 한도를 다시 제안합니다.

## 프론트엔드 구현 범위

- 홈: 이번 달 지출, 목표 진행률, 하루 가능예산, 구독비, 최근 소비 표시
- 캘린더: 날짜별 지출, 과소비일, 적정 소비일, 정기 결제일, 선택일 상세 표시
- 추가: 직접 입력, CSV 업로드 미리보기, 교체/병합 반영
- 목표: 월 수입, 목표 소비액, 목표 저축액, 구독 상한, 집중 카테고리 설정
- AI 코치: AI 결과 표시 계약에 맞춘 오늘의 소비 가이드, 미션, 정기 결제 점검, 카테고리 코멘트
- 설정: 샘플 데이터 로딩, 초기화, CSV 내보내기, 금융 인증정보 미수집, 실시간 반영 준비 상태 안내

AI 기능은 OpenAI 프록시 provider로 연결되어 있으며, 프론트엔드는 `src/services/aiAdapter.ts`의 provider 계약을 통해 결과를 받아 표시합니다.

자동 QA 안정화를 위해 주요 버튼과 입력에는 `data-testid`가 부여되어 있고, 핵심 상태 흐름은 `src/services/appState.ts`와 `src/services/appState.test.ts`에서 브라우저 없이 검증합니다.

## 실시간 금융 데이터 반영

실제 금융 API가 연결되면 앱은 `money-routine:financial-transactions` 브라우저 이벤트로 들어온 지출 거래를 정규화해 반영합니다. 같은 `source + externalId` 거래가 다시 들어오면 중복 추가가 아니라 기존 거래 업데이트로 처리하고, 반영 즉시 홈, 캘린더, 알림, AI 코치 계산이 다시 갱신됩니다.

```ts
window.dispatchEvent(new CustomEvent("money-routine:financial-transactions", {
  detail: {
    source: "connected-card",
    transactions: [
      {
        externalId: "card-transaction-id",
        postedAt: "2026-06-30T09:20:00+09:00",
        merchant: "테스트 카페",
        amount: -5200,
        accountName: "연결 카드",
      },
    ],
  },
}));
```

## 심사위원 1분 체험 시나리오

1. 설정에서 `샘플 데이터 불러오기`를 눌러 35건의 소비 데이터를 복원합니다.
2. 홈에서 월 지출, 목표 진행률, 오늘 가능예산을 확인합니다.
3. 목표 화면에서 목표 소비액을 바꾸고 저장해 홈/AI 코치 재계산을 확인합니다.
4. 추가 화면에서 직접 소비를 하나 저장하고 캘린더 반영을 확인합니다.
5. AI 코치 화면에서 오늘의 소비 가이드, 미션, 정기 결제 점검, AI 분석 연결 상태를 확인합니다.

제출 직전 QA 기준은 [배포와 제출 데모 QA 리포트](docs/22-deployment-demo-qa.md)에 정리되어 있습니다. 실제 AI 연결 계약은 [AI 기능 인계 계약](docs/23-ai-integration-contract.md)을 기준으로 합니다.
배포 서비스에서 URL을 활성화하는 절차는 [배포 활성화 가이드](docs/24-deployment-activation-guide.md)를 따르면 됩니다.

## 확정 방향

**서비스명:** 머니루틴 캘린더  
**핵심 주제:** 대학생과 사회초년생을 위한 목표 기반 AI 소비 코칭 웹앱  
**목표 상:** AX 핀테크상  
**제출 형태:** 구동 가능한 웹앱 URL

## 한 문장 정의

대학생과 사회초년생이 소비 내역과 구독 지출을 한눈에 보고, AI의 목표 기반 코칭으로 월말 예산 초과를 줄이는 소비 캘린더 웹앱입니다.

## 기능 구현 시 우선 참고할 v4 방향

- [레퍼런스 종합 v4 콘셉트](mockups/mobile-v4-reference-synthesis.html)
- [레퍼런스 종합 v4 스크린샷](mockups/mobile-v4-reference-synthesis.png)
- [v4 구현용 CSS 시스템](design/v4-ui-system.css)
- [v4 홈 구현 스켈레톤](design/v4-home-skeleton.html)
- [v4 구현 전달 명세](docs/10-design-implementation-handoff.md)
- [v4 전체 화면 상세 명세](docs/12-complete-screen-specs.md)
- [v4 디자인 토큰과 컴포넌트 시스템](docs/13-design-tokens-components.md)
- [v4 모바일/접근성/QA 체크리스트](docs/14-mobile-accessibility-qa.md)
- [외부 레퍼런스 기반 v4 디자인 정리](docs/17-external-design-reference-study.md)
- [v4 기능 구현용 디자인 적용 가이드](docs/18-v4-functional-design-guide.md)
- [우리은행 유사성 리스크 점검](docs/19-originality-risk-check.md)

## 기획 기준 문서

- [공모전 연결 전략](docs/01-contest-alignment.md)
- [MVP 범위와 화면 흐름](docs/02-mvp-scope.md)
- [AI 기능 설계와 프롬프트](docs/03-ai-design.md)
- [지원서 작성 초안](docs/04-submission-draft.md)
- [개발 로드맵](docs/05-development-roadmap.md)
- [디자인 목표와 UX 원칙](docs/06-design-goals.md)
- [심사위원 체험 흐름](docs/07-judge-experience-flow.md)
- [화면 구조와 와이어프레임](docs/08-screen-architecture-wireframes.md)
- [캘린더, AI UX, 비주얼 시스템](docs/09-calendar-ai-visual-system.md)
- [메인 대시보드 상세 시안 명세](docs/11-main-dashboard-screen-spec.md)
- [디자인 완료 감사표](docs/15-design-completion-audit.md)
- [샘플 소비 데이터](data/sample_transactions.csv)

## 이전 참고 자료

아래 자료는 디자인 발전 과정 확인용입니다. 기능 구현의 디자인 방향은 v4 파일을 우선하되, 스크린샷을 그대로 복제하지 않습니다.

- [레퍼런스 기반 v2 디자인 방향](docs/16-reference-based-v2-design.md)
- [메인 대시보드 정적 목업](mockups/main-dashboard.html)
- [전체 화면 정적 프로토타입](mockups/full-flow-prototype.html)
- [모바일 금융앱형 v2 콘셉트](mockups/mobile-v2-finance-concept.html)
- [밝은 생활 금융앱형 v3 콘셉트](mockups/mobile-v3-bright-finance-concept.html)

## 이번 제출작에서 완성할 핵심 경험

1. 사용자가 샘플 소비 데이터를 불러옵니다.
2. 월 목표 소비액과 목표 저축액을 입력합니다.
3. AI가 소비 내역을 식비, 교통, 카페, 쇼핑, 여가, 구독 등으로 분류합니다.
4. 월간 소비 캘린더에서 과소비일, 적정 소비일, 정기 결제일을 확인합니다.
5. AI가 남은 기간의 하루 예산과 절약 전략을 제안합니다.

## 이번 제출작에서 제외할 기능

- 실제 은행 앱 연동
- 카드사 자동 연동
- 본인인증
- 실시간 계좌 잔액 조회
- 구독 서비스 자동 해지

위 기능은 수상 후 고도화 단계에서 오픈뱅킹 또는 금융 마이데이터 연동으로 확장하는 로드맵으로 제시합니다.

## 최종 제출 런북

제출 직전에는 [최종 제출 런북](docs/25-final-submission-runbook.md)을 순서대로 확인합니다.
