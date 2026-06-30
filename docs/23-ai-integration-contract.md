# AI 기능 인계 계약

## 2026-06-30 프론트 준비 상태

- `AiProvider`는 동기 결과와 `Promise` 결과를 모두 받을 수 있다.
- OpenAI API는 서버 프록시에서만 호출하고, 브라우저에는 API key를 넣지 않는다.
- 프론트는 `VITE_AI_PROVIDER=openai-proxy` 또는 `VITE_AI_PROXY_BASE_URL`이 있을 때 `openAiProxyProvider`를 등록한다.
- 직접 입력 화면은 자동 분류를 선택한 저장에서만 `classifyTransactionResponseAsync`를 기다린 뒤 저장한다.
- AI 코치 리포트는 AI 코치 화면의 `AI 분석 업데이트` 버튼을 눌렀을 때만 `createCoachReportResponseAsync`로 호출한다.
- 관리자 테스트 편의를 위해 브라우저와 서버 프록시의 일일 횟수 제한은 기본 비활성화 상태다. 필요할 때만 `VITE_AI_CLIENT_RATE_LIMIT_ENABLED=true`, `AI_RATE_LIMIT_ENABLED=true`로 다시 켠다.
- 홈/목표/설정 화면은 `createCoachReportPreviewResponse`의 로컬 미리보기 결과를 사용해 초기 렌더 외부 호출을 막는다.
- AI 코치 화면은 `useMoneyRoutine`에서 debounce와 cache를 적용하고 `loading` 상태를 먼저 표시한 뒤 `ready` 또는 `fallback` 결과로 갱신한다.
- 월 목표 소비액을 초과해도 하루 권장 한도를 즉시 0원으로 고정하지 않는다. `getSummary`가 월수입, 목표 저축액, 남은 일수를 기준으로 `현실 조정 목표`와 `조정 후 예상 저축`을 계산하고, 이 로컬 계산값이 OpenAI 문구보다 우선한다.
- AI 코치 리포트는 `categoryPlans`로 분야별 소비 계획 카드를 최대 4개 제공한다. 현재 달 거래와 `previousMonthTransactions`의 지난달 분야별 비중을 비교해 늘어난 분야를 우선하되, 후보가 적으면 실제 지출 상위 분야를 함께 채워 한 분야만 반복되지 않도록 한다. 긴 문장은 provider 검증 단계에서 잘라 카드 UI를 보호한다.
- 정기 결제 조언은 `subscriptionLimit`만 보지 않고 전체 소비 목표 대비 비중도 함께 본다. 전체 예산에서 부담이 낮으면 구독 해지/점검을 핵심 미션으로 강조하지 않는다.
- 기존 동기 API(`classifyTransactionResponse`, `createCoachReportResponse`)는 로컬/테스트 호환용으로 유지한다.
- 외부 AI provider가 실패하면 로컬 규칙 기반 결과로 fallback되어 거래 저장과 화면 렌더링이 계속된다.

## 목적

이 문서는 기능 채팅에서 실제 AI provider를 연결할 때 프론트엔드가 기대하는 입력, 출력, 실패 처리 계약을 정리한다.

프론트엔드는 현재 `src/services/aiAdapter.ts`를 단일 연결 지점으로 사용한다. 화면 컴포넌트는 실제 AI API를 직접 호출하지 않고, provider 계약만 바라본다.

## 연결 지점

파일:

- `src/services/aiAdapter.ts`
- `src/services/openAiProxyProvider.ts`
- `src/services/registerAiProvider.ts`
- `src/hooks/useMoneyRoutine.ts`
- `src/screens/CoachScreen.tsx`
- `src/screens/AddScreen.tsx`
- `api/ai/classify.js`
- `api/ai/coach.js`

프론트에서 사용하는 공개 함수:

- `setAiProvider(provider, metadata?)`
- `getAiProvider()`
- `getAiProviderMetadata()`
- `classifyTransactionResponse(input)`
- `classifyTransactionResponseAsync(input)`
- `createCoachReportResponse(input)`
- `createCoachReportResponseAsync(input)`
- `createCoachReportLoadingResponse(input, previousReport?)`
- `createCoachReportPreviewResponse(input)`
- `classifyTransaction(input)`
- `createCoachReport(input)`

## OpenAI 프록시 연결

프론트는 다음 두 endpoint를 호출한다.

- `POST /api/ai/classify`
- `POST /api/ai/coach`

Vercel 전체 배포처럼 같은 origin에 `/api`가 있는 경우 `VITE_AI_PROXY_BASE_URL`은 비워둘 수 있다. GitHub Pages처럼 정적 호스팅만 사용하는 경우 같은 origin에 `/api`를 둘 수 없으므로, `VITE_AI_PROXY_BASE_URL`에 별도 Vercel/Node 프록시 URL을 넣는다.

프론트 빌드 env:

```env
VITE_AI_PROVIDER=openai-proxy
# Vercel 전체 배포에서는 비워둘 수 있음
VITE_AI_PROXY_BASE_URL=
VITE_AI_PROXY_TIMEOUT_MS=45000
```

서버 프록시 env:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
OPENAI_MAX_OUTPUT_TOKENS=900
AI_ALLOWED_ORIGINS=https://kt-ai-contest.vercel.app,http://localhost:5173
AI_RATE_LIMIT_ENABLED=false
AI_DAILY_REQUEST_LIMIT=60
AI_CLASSIFY_DAILY_LIMIT=40
AI_COACH_DAILY_LIMIT=20
```

서버 프록시는 OpenAI Responses API의 structured output을 사용해 `ClassificationResult`와 `CoachReport` JSON을 반환한다. 비용 관리의 1차 방어선은 명시 호출, 캐시, 서버 key 비공개이며, 횟수 제한은 테스트가 끝난 뒤 env로 다시 켤 수 있다.

## Provider 인터페이스

```ts
type MaybePromise<T> = T | Promise<T>;

interface AiProvider {
  classifyTransaction(input: ClassificationInput): MaybePromise<ClassificationResult>;
  createCoachReport(input: CoachReportInput): MaybePromise<CoachReport>;
}
```

현재 provider 계약은 동기 결과와 `Promise` 결과를 모두 허용한다. 실제 API 연결 시에는 `classifyTransactionResponseAsync`와 `createCoachReportResponseAsync` 경로를 사용한다.

주의:

- 기존 동기 래퍼인 `classifyTransactionResponse`, `createCoachReportResponse`는 로컬 provider와 테스트 호환용이다.
- 비동기 provider를 연결한 상태에서 동기 래퍼를 직접 호출하면 fallback 응답이 반환될 수 있다.
- 직접 입력 저장은 자동 분류 선택 시에만 async 래퍼를 사용한다.
- AI 코치 리포트의 외부 AI 호출은 `src/services/aiRequestPolicy.ts` 기준으로 AI 코치 탭에서 사용자가 명시적으로 요청했을 때만 실행된다.

## 실시간 금융 데이터 수신 계약

실제 금융 API, 마이데이터, 카드 승인 웹훅이 붙는 경우 프론트에는 다음 브라우저 이벤트로 지출 거래를 전달한다.

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

수신 경로:

- `src/hooks/useMoneyRoutine.ts`가 `money-routine:financial-transactions` 이벤트를 듣는다.
- `src/services/financialFeed.ts`가 외부 거래를 내부 `Transaction`으로 정규화한다.
- `src/services/appState.ts`의 `syncFinancialFeedState`가 `source + externalId` 기반 안정 ID로 병합한다.
- 같은 거래가 다시 들어오면 중복 추가가 아니라 기존 거래 업데이트로 처리한다.
- 입금 거래(`direction: "credit"`)는 소비 내역에 반영하지 않는다.
- 단일 거래는 `detail.transaction`, 여러 거래는 `detail.transactions`로 받을 수 있다.
- 한 이벤트는 최대 200건까지 처리하고, 잘못된 날짜/금액/사용처와 과도한 단일 금액은 건너뛴다.
- 브라우저 저장소 과부하를 막기 위해 병합 후 최근 1,200건 중심으로 유지한다.
- 반영 후 홈, 캘린더, 알림, AI 코치 로컬 미리보기 계산이 즉시 갱신된다.
- 실시간 거래 반영만으로는 OpenAI API를 자동 호출하지 않는다. AI 코치 외부 분석은 여전히 사용자의 `AI 분석 업데이트` 클릭에서만 실행된다.

## 호출 정책

- 초기 렌더, 홈, 캘린더, 목표, 설정 탭에서는 외부 AI 코치를 호출하지 않는다.
- AI 코치 탭 진입만으로는 외부 AI를 호출하지 않는다. 사용자가 `AI 분석 업데이트` 버튼을 누르면 250ms debounce 후 현재 월/목표/거래 입력값으로 리포트를 요청한다.
- 같은 provider와 같은 입력값이면 cache된 응답을 재사용한다.
- 거래 자동 분류는 직접 입력에서 `자동 분류`를 선택한 상태로 저장 버튼을 눌렀을 때만 호출한다. 사용자가 카테고리를 직접 선택하면 외부 분류를 호출하지 않는다.
- CSV import는 거래별 외부 분류를 추가로 호출하지 않고, AI 코치 리포트 요청 대상 데이터만 갱신한다.

## 분류 입력

```ts
interface ClassificationInput {
  merchant: string;
  memo: string;
  isSubscription: boolean;
}
```

사용 위치:

- 추가 화면 직접 입력
- CSV 파서에서 카테고리가 비어 있는 거래

## 분류 출력

```ts
interface ClassificationResult {
  category: Category;
  reason: string;
}
```

허용 카테고리:

- 식비
- 카페/간식
- 교통
- 쇼핑
- 여가
- 구독
- 교육
- 의료
- 생활
- 기타

주의:

- 출력 카테고리는 반드시 위 목록 중 하나여야 한다.
- 모호한 거래는 `기타`로 보내고 `reason`에 짧은 근거를 쓴다.
- 반복 결제, OTT, 멤버십, 클라우드, 앱스토어형 사용처는 `구독` 우선이다.

## AI 코치 리포트 입력

```ts
interface CoachReportInput {
  transactions: Transaction[];
  goal: Goal;
  monthId: string;
}
```

`transactions`는 현재 선택된 월의 거래를, `previousMonthTransactions`는 바로 이전 달 거래를 전달한다.

## AI 코치 리포트 출력

```ts
interface CoachReport {
  headline: string;
  status: "stable" | "watch" | "over";
  dailyBudget: number;
  savingPossibility: "높음" | "보통" | "낮음";
  todayAction: string;
  insights: string[];
  categoryPlans: CategoryPlan[];
  missions: CoachMission[];
  subscriptionAdvice: string[];
  basis: string;
  basisItems: CoachBasisItem[];
}
```

분석 기준 출력:

```ts
interface CoachBasisItem {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: "primary" | "stable" | "watch" | "over";
}
```

분야별 계획 출력:

```ts
interface CategoryPlan {
  category: Category;
  status: "stable" | "watch" | "over";
  currentAmount: number;
  plannedAmount: number;
  expectedSaving: number;
  reason: string;
  action: string;
}
```

미션 출력:

```ts
interface CoachMission {
  id: string;
  title: string;
  reason: string;
  expectedSaving: number;
  action: string;
  completed: boolean;
}
```

출력 원칙:

- `headline`은 한 문장으로 작성한다.
- `todayAction`은 사용자가 오늘 실행할 행동 하나를 제시한다.
- `dailyBudget`, `expectedSaving`은 숫자 원 단위로 반환한다.
- `missions`는 2~4개가 적당하다.
- 대출, 투자, 보험 상품 추천은 하지 않는다.
- 개인정보, 계좌, 카드 인증정보 입력을 요구하지 않는다.

## 응답 래퍼

프론트는 다음 응답 형태를 받을 준비가 되어 있다.

```ts
interface AiResponse<T> {
  data: T;
  error?: string;
  generatedAt: string;
  provider: AiProviderMetadata;
  status: "ready" | "loading" | "fallback" | "error";
}
```

Provider metadata:

```ts
interface AiProviderMetadata {
  id: string;
  label: string;
  mode: "local" | "external";
}
```

화면 표시:

- `ready`: provider 결과 표시
- `loading`: AI 분석 중 문구 표시
- `fallback`: 외부 AI 실패 후 로컬 분석 결과 표시
- `error`: 결과 표시 불가 또는 대체 준비 상태

## 실패 처리

현재 구현은 provider 호출 중 예외가 발생하면 로컬 규칙 provider로 fallback한다.

기능 채팅에서 실제 API를 붙일 때도 다음 기준을 유지한다.

- API 실패가 화면 전체 실패로 이어지지 않아야 한다.
- 사용자가 거래를 저장하는 흐름은 AI 실패와 독립적으로 완료되어야 한다.
- 실패 문구는 짧고 비난 없이 표시한다.
- 이전 성공 결과 또는 로컬 규칙 결과를 사용할 수 있으면 fallback으로 표시한다.

## 실제 API 연결 체크리스트

1. 서버 프록시 배포 환경에 `OPENAI_API_KEY`를 등록한다.
2. Vercel 배포에서는 `VITE_AI_PROVIDER=openai-proxy`를 등록하고, GitHub Pages 백업 빌드에서만 `VITE_AI_PROXY_BASE_URL`을 등록한다.
3. `AI_ALLOWED_ORIGINS`에 실제 제출 origin을 포함한다.
4. AI 코치 화면에서 `AI 분석 업데이트` 버튼을 눌렀을 때만 OpenAI provider 상태가 표시되는지 확인한다.
5. API 실패 시 로컬 규칙 fallback이 표시되는지 확인한다.

이미 준비된 항목:

- `MaybePromise` 기반 provider 계약
- `loading`, `ready`, `fallback`, `error` 상태 표시
- 직접 입력 자동 분류 저장의 async 분류 대기
- AI 코치 화면 버튼 기반 async 리포트 갱신
- provider 실패 시 로컬 규칙 fallback
