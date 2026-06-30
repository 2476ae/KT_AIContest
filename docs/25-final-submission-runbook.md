# 최종 제출 런북

이 문서는 머니루틴 캘린더를 제출 직전에 순서대로 점검하기 위한 운영 문서다. 기능 구현 채팅에서는 이 문서를 기준으로 프론트엔드 완성 상태, 배포 상태, 데모 흐름을 확인한다.

## 1. 현재 제출 URL

- Vercel Production: `https://kt-ai-contest.vercel.app/`
- GitHub repository: `https://github.com/2476ae/KT_AIContest`
- 배포 방식: Vercel Git integration
- 백업 URL: `https://2476ae.github.io/KT_AIContest/`
- GitHub Pages workflow: `.github/workflows/deploy-github-pages.yml`

제출 전 확인 기준:

- URL이 `200 OK`로 열린다.
- 첫 화면에 `머니루틴`과 현재 소비 캘린더가 보인다.
- 새로고침해도 앱이 정상 렌더링된다.
- GitHub Actions 최신 run의 `build`, `deploy` job이 모두 성공 상태다.

## 2. 순차 진행 순서

### 1단계. 디자인 채팅

목표는 기능을 바꾸는 것이 아니라 최종 시각 완성도와 화면 밀도를 다듬는 것이다.

확인할 화면:

- 홈: 상단 소비 카드, 빠른 실행, 캘린더, 미션, 최근 소비
- 캘린더: 월 이동, 필터, 선택일 상세, 거래 목록
- 추가: 직접 입력, CSV 업로드, 오류/성공 피드백
- 목표: 목표 수정, 미리보기 카드, 저장 피드백
- AI 코치: 오늘의 소비 가이드, 미션, 정기 결제 점검, AI 상태 카드
- 설정: 샘플 데이터, CSV 내보내기, 개인정보 미수집 안내

디자인 채팅에 넘길 핵심 기준:

- v4 스크린샷을 그대로 복제하지 않는다.
- 밝은 개인 금융 코치형 소비 캘린더 톤을 유지한다.
- PC와 모바일 모두 가로 스크롤이 없어야 한다.
- AI는 챗봇보다 `오늘의 소비 가이드`, `이번 주 미션`, `정기 결제 점검`처럼 행동 중심으로 보인다.

참고 문서:

- `docs/10-design-implementation-handoff.md`
- `docs/13-design-tokens-components.md`
- `docs/14-mobile-accessibility-qa.md`
- `docs/18-v4-functional-design-guide.md`

### 2단계. AI 기능 채팅

목표는 프론트 화면을 직접 바꾸기보다 `src/services/aiAdapter.ts`의 provider 계약에 실제 AI provider를 연결하는 것이다.

AI 채팅에 넘길 핵심 기준:

- 프론트 컴포넌트가 OpenAI API를 직접 호출하지 않는다.
- 연결 지점은 `src/services/aiAdapter.ts`로 유지한다.
- OpenAI API key는 `api/ai/classify.js`, `api/ai/coach.js`가 실행되는 서버 프록시 환경에만 둔다.
- 프론트는 `VITE_AI_PROVIDER=openai-proxy` 설정 시 OpenAI 프록시 provider를 사용한다. Vercel 전체 배포에서는 `VITE_AI_PROXY_BASE_URL`을 비워 같은 도메인의 `/api/ai/*`를 호출하고, GitHub Pages 백업 배포에서만 Vercel 프록시 URL을 지정한다.
- 프론트는 `Promise` 기반 provider, `loading`, `ready`, `fallback`, `error` 표시 흐름을 이미 받을 수 있다.
- 초기 렌더와 홈/목표/설정/AI 코치 탭 진입만으로는 외부 AI를 호출하지 않고, AI 코치 화면의 `OpenAI 분석 업데이트` 버튼을 눌렀을 때만 debounce/cache 정책으로 리포트를 요청한다.
- 실패 시 화면 전체가 깨지면 안 된다.
- `ready`, `loading`, `fallback`, `error` 상태가 AI 코치 화면에 자연스럽게 표시되어야 한다.
- 거래 저장은 AI 실패와 독립적으로 완료되어야 한다.
- 개인정보, 계좌, 카드 인증정보를 요구하지 않는다.

참고 문서:

- `docs/03-ai-design.md`
- `docs/23-ai-integration-contract.md`

### 3단계. 프론트 최종 QA

로컬 검증:

```bash
npm run verify
npm run build:github-pages
```

2026-06-30 현재 검증 기준:

- `npm run verify`: Vitest 9개 파일, 42개 테스트와 Vite production build 통과
- `npm run build:github-pages`: `/KT_AIContest/` base path 기준 production build 통과
- 핵심 상태 흐름은 `src/services/appState.test.ts`에서 브라우저 없이 검증한다.

브라우저 QA:

- PC 폭에서 홈, 캘린더, 추가, 목표, AI 코치, 설정 탭을 확인한다.
- 390px 모바일 폭에서 주요 탭이 가로로 넘치지 않는지 확인한다.
- 360px 모바일 폭에서 하단 네비가 버튼이나 입력 영역을 가리지 않는지 확인한다.
- 콘솔 오류가 없어야 한다.
- 390px 모바일 기준 캘린더 날짜 버튼 최소 폭 46px 이상을 유지한다.

자동 QA용 selector:

- 샘플 데이터: `home-load-sample`, `settings-load-sample`
- 하단 탭: `nav-home`, `nav-calendar`, `nav-add`, `nav-coach`, `nav-settings`
- 직접 입력: `transaction-amount-input`, `transaction-merchant-input`, `transaction-date-input`, `transaction-save-button`
- 목표 수정: `goal-spending-limit-input`, `goal-saving-input`, `goal-save-button`
- 캘린더: `calendar-day-YYYY-MM-DD`, `calendar-filter-over`, `calendar-filter-subscription`, `calendar-filter-safe`

기능 QA:

1. 설정 또는 홈에서 샘플 데이터를 불러온다.
2. 홈에서 총 지출 `397,790원`, 진행률 `55%`, 구독비 `63,690원` 기준 값이 보이는지 확인한다.
3. 목표 화면에서 목표 소비액과 목표 저축액을 바꾸고 저장한다.
4. 홈의 월 목표, 진행률, 오늘 가능예산이 즉시 바뀌는지 확인한다.
5. 추가 화면에서 직접 거래를 저장한다.
6. 홈과 캘린더 선택일, 최근 소비에 새 거래가 반영되는지 확인한다.
7. CSV 업로드에서 정상 CSV, 빈 CSV, 필수 헤더 누락 CSV를 확인한다.
8. AI 코치 화면에서 오늘의 소비 가이드, 미션, 정기 결제 점검, AI 상태 카드가 비어 있지 않은지 확인한다.
9. 설정 화면에서 금융 인증정보 미수집 안내가 보이는지 확인한다.
10. CSV 내보내기 버튼이 거래가 있을 때 동작하는지 확인한다.

### 4단계. 제출 자료 정리

제출 페이지에 넣을 기본 문구:

```text
머니루틴 캘린더는 대학생과 사회초년생이 소비 내역과 구독 지출을 한눈에 보고, AI의 목표 기반 코칭으로 월말 예산 초과를 줄이는 소비 캘린더 웹앱입니다.
```

핵심 기능 요약:

- 샘플 데이터, 직접 입력, CSV 업로드 기반 소비 기록
- 소비 유형 자동 분류
- 월간 소비 캘린더와 과소비일, 적정 소비일, 정기 결제일 표시
- 목표 소비액과 목표 저축액 기반 하루 예산 계산
- 오늘의 소비 가이드, 이번 주 미션, 정기 결제 점검 제안
- 금융 인증정보 미수집 안내

AI 활용 설명:

```text
AI는 사용처명, 금액, 날짜, 메모를 바탕으로 소비 유형을 분류하고, 월 목표 소비액과 목표 저축액을 기준으로 남은 기간의 하루 사용 가능 금액과 절약 미션을 제안합니다. 제출 버전은 금융 인증정보를 요구하지 않고 샘플 데이터, 직접 입력, CSV 업로드만 사용합니다.
```

제출 전 필수 첨부 또는 기입 항목:

- 제출 URL
- GitHub repository URL
- 서비스 한 줄 소개
- 핵심 기능 5개
- AI 활용 방식
- 개인정보 미수집/데모 데이터 안내
- 팀원/작성자 정보

## 3. 심사위원 3분 데모 스크립트

### 0초-20초: 첫 화면

말할 내용:

```text
머니루틴 캘린더는 소비 내역을 달력으로 보고, 목표 저축을 위해 오늘 무엇을 줄이면 되는지 알려주는 AI 소비 코치입니다.
```

보여줄 것:

- 첫 화면이 랜딩페이지가 아니라 실제 앱 화면으로 시작한다.
- 샘플 데이터 버튼이 보인다.
- 금융 인증 없이 체험 가능하다는 점을 언급한다.

### 20초-50초: 샘플 데이터 로드

행동:

1. `샘플 데이터 불러오기`를 누른다.
2. 홈의 총 지출, 진행률, 오늘 가능예산, 구독비를 보여준다.

말할 내용:

```text
심사 환경에서는 실제 금융 인증을 요구하지 않고 예시 소비 데이터로 바로 체험할 수 있습니다.
```

### 50초-90초: 캘린더 확인

행동:

1. 캘린더 화면으로 이동한다.
2. 초과, 정기 결제, 적정 필터를 보여준다.
3. 특정 날짜를 선택해 거래 목록과 분류를 보여준다.

말할 내용:

```text
날짜별 소비 상태를 색으로 구분하고, 정기 결제일과 과소비일을 빠르게 찾을 수 있습니다.
```

### 90초-130초: 목표 수정

행동:

1. 목표 화면으로 이동한다.
2. 목표 소비액 또는 목표 저축액을 바꾼다.
3. 오늘 가능예산과 진행률 미리보기가 바뀌는 것을 보여준다.
4. 저장한다.

말할 내용:

```text
AI 코치 기준은 사용자의 목표에서 시작합니다. 목표를 바꾸면 홈과 AI 코치 화면의 계산도 같은 기준으로 다시 바뀝니다.
```

### 130초-165초: 직접 입력

행동:

1. 추가 화면에서 금액, 사용처, 날짜, 메모를 입력한다.
2. 자동 분류를 유지하고 저장한다.
3. 홈 또는 캘린더에서 새 거래 반영을 확인한다.

말할 내용:

```text
사용자가 직접 입력한 소비도 즉시 캘린더와 AI 코치 계산에 반영됩니다.
```

### 165초-180초: AI 코치 확인

행동:

1. AI 코치 화면으로 이동한다.
2. 오늘의 소비 가이드, 이번 주 미션, 정기 결제 점검, AI 상태 카드를 보여준다.

말할 내용:

```text
AI는 긴 리포트보다 오늘 줄일 항목, 이유, 예상 절약액처럼 바로 행동할 수 있는 형태로 결과를 보여줍니다.
```

## 4. 제출 전 최종 게이트

아래 항목이 모두 충족되면 프론트 기준 제출 가능 상태로 본다.

- [ ] `npm run verify` 통과
- [ ] `npm run build:github-pages` 통과
- [ ] Vitest 9개 파일, 42개 테스트 통과
- [ ] GitHub Actions 최신 run 성공
- [ ] `https://kt-ai-contest.vercel.app/` 접속 성공
- [ ] PC 브라우저에서 가로 스크롤 없음
- [ ] 390px 모바일에서 주요 탭 가로 스크롤 없음
- [ ] 360px 모바일에서 하단 네비가 핵심 버튼을 가리지 않음
- [ ] 샘플 데이터 로드 가능
- [ ] 목표 저장 후 홈/AI 코치 재계산
- [ ] 직접 입력 후 캘린더/최근 소비 반영
- [ ] CSV 업로드 정상/오류 상태 확인
- [ ] 설정 화면에 금융 인증정보 미수집 안내 표시
- [ ] 제출용 소개 문구와 AI 활용 설명 준비
