# AI 기능 인계 계약

## 2026-06-29 프론트 준비 상태

- `AiProvider`는 동기 결과와 `Promise` 결과를 모두 받을 수 있다.
- 직접 입력 화면은 `classifyTransactionResponseAsync`를 기다린 뒤 저장한다.
- 코치 화면은 `useMoneyRoutine`에서 `loading` 상태를 먼저 표시한 뒤 `ready` 또는 `fallback` 결과로 갱신한다.
- 기존 동기 API(`classifyTransactionResponse`, `createCoachReportResponse`)는 로컬/테스트 호환용으로 유지한다.
- 외부 AI provider가 실패하면 로컬 규칙 기반 결과로 fallback되어 거래 저장과 화면 렌더링이 계속된다.

## 목적

이 문서는 기능 채팅에서 실제 AI provider를 연결할 때 프론트엔드가 기대하는 입력, 출력, 실패 처리 계약을 정리한다.

프론트엔드는 현재 `src/services/aiAdapter.ts`를 단일 연결 지점으로 사용한다. 화면 컴포넌트는 실제 AI API를 직접 호출하지 않고, provider 계약만 바라본다.

## 연결 지점

파일:

- `src/services/aiAdapter.ts`
- `src/hooks/useMoneyRoutine.ts`
- `src/screens/CoachScreen.tsx`
- `src/screens/AddScreen.tsx`

프론트에서 사용하는 공개 함수:

- `setAiProvider(provider, metadata?)`
- `getAiProvider()`
- `getAiProviderMetadata()`
- `classifyTransaction(input)`
- `classifyTransactionResponse(input)`
- `createCoachReport(input)`
- `createCoachReportResponse(input)`

## Provider 인터페이스

```ts
interface AiProvider {
  classifyTransaction(input: ClassificationInput): ClassificationResult;
  createCoachReport(input: CoachReportInput): CoachReport;
}
```

현재 provider는 동기 함수로 정의되어 있다. 실제 API가 비동기라면 기능 채팅에서 다음 중 하나를 선택한다.

1. provider 계약을 `Promise` 기반으로 확장하고 화면에 loading 상태를 연결한다.
2. API 결과를 별도 상태에 저장한 뒤 현재 동기 provider가 마지막 성공 결과를 반환하도록 감싼다.

추천은 1번이다. 이미 화면 상태 타입은 `ready`, `loading`, `fallback`, `error`를 받을 준비가 되어 있다.

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

## 실제 API 연결 시 필요한 작업

1. 비동기 provider 계약 전환 여부 결정
2. API client 파일 추가
3. 환경변수 이름 확정
4. provider metadata 확정
5. `loading` 상태를 `useMoneyRoutine`에 연결
6. 실패 시 `fallback` 또는 `error` 정책 확정
7. 분류/코치 리포트 응답 스키마 검증 추가
8. 테스트에서 성공, 지연, 실패, 잘못된 응답을 모두 확인
