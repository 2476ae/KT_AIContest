# AI 기능 인계 계약

## 2026-06-29 프론트 준비 상태

- `AiProvider`는 동기 결과와 `Promise` 결과를 모두 받을 수 있다.
- OpenAI API는 서버 프록시에서만 호출하고, 브라우저에는 API key를 넣지 않는다.
- 프론트는 `VITE_AI_PROVIDER=openai-proxy` 또는 `VITE_AI_PROXY_BASE_URL`이 있을 때 `openAiProxyProvider`를 등록한다.
- 직접 입력 화면은 `classifyTransactionResponseAsync`를 기다린 뒤 저장한다.
- 코치 AI 리포트는 코치 탭에 진입했을 때만 `createCoachReportResponseAsync`로 호출한다.
- 홈/목표/설정 화면은 `createCoachReportPreviewResponse`의 로컬 미리보기 결과를 사용해 초기 렌더 외부 호출을 막는다.
- 코치 화면은 `useMoneyRoutine`에서 debounce와 cache를 적용하고 `loading` 상태를 먼저 표시한 뒤 `ready` 또는 `fallback` 결과로 갱신한다.
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

GitHub Pages처럼 정적 호스팅만 사용하는 경우 같은 origin에 `/api`를 둘 수 없으므로, `VITE_AI_PROXY_BASE_URL`에 별도 Vercel/Node 프록시 URL을 넣는다.

프론트 빌드 env:

```env
VITE_AI_PROVIDER=openai-proxy
VITE_AI_PROXY_BASE_URL=https://your-openai-proxy.example.com
```

서버 프록시 env:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
AI_ALLOWED_ORIGINS=https://2476ae.github.io,http://localhost:5173
```

서버 프록시는 OpenAI Responses API의 structured output을 사용해 `ClassificationResult`와 `CoachReport` JSON을 반환한다.

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
- 직접 입력 저장은 async 래퍼를 사용한다.
- 코치 리포트의 외부 AI 호출은 `src/services/aiRequestPolicy.ts` 기준으로 코치 탭에서만 실행된다.

## 호출 정책

- 초기 렌더, 홈, 캘린더, 목표, 설정 탭에서는 외부 코치 AI를 호출하지 않는다.
- 코치 탭에 진입하면 250ms debounce 후 현재 월/목표/거래 입력값으로 리포트를 요청한다.
- 같은 provider와 같은 입력값이면 cache된 응답을 재사용한다.
- 거래 자동 분류는 직접 입력 저장 버튼을 눌렀을 때만 호출한다.
- CSV import는 거래별 외부 분류를 추가로 호출하지 않고, 코치 탭 진입 시 리포트 요청 대상 데이터만 갱신한다.

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

## 코치 리포트 입력

```ts
interface CoachReportInput {
  transactions: Transaction[];
  goal: Goal;
  monthId: string;
}
```

`transactions`는 현재 선택된 월의 거래만 전달된다.

## 코치 리포트 출력

```ts
interface CoachReport {
  headline: string;
  status: "stable" | "watch" | "over";
  dailyBudget: number;
  savingPossibility: "높음" | "보통" | "낮음";
  todayAction: string;
  insights: string[];
  missions: CoachMission[];
  subscriptionAdvice: string[];
  basis: string;
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
2. GitHub Pages 빌드 변수에 `VITE_AI_PROVIDER`, `VITE_AI_PROXY_BASE_URL`을 등록한다.
3. `AI_ALLOWED_ORIGINS`에 실제 제출 origin을 포함한다.
4. 코치 탭 진입 시 `OpenAI 분석` provider 상태가 표시되는지 확인한다.
5. API 실패 시 로컬 규칙 fallback이 표시되는지 확인한다.

이미 준비된 항목:

- `MaybePromise` 기반 provider 계약
- `loading`, `ready`, `fallback`, `error` 상태 표시
- 직접 입력 저장의 async 분류 대기
- 코치 화면의 async 리포트 갱신
- provider 실패 시 로컬 규칙 fallback
