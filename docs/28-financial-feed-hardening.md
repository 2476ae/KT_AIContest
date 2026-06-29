# 실시간 금융 연동 안정성 보강

## 목적

실제 카드, 계좌, 마이데이터 연동 후에도 앱이 멈추지 않고 홈, 캘린더, 알림, AI 코치 계산을 계속 갱신하도록 금융 거래 수신 경로를 방어한다.

## 수신 이벤트

앱은 브라우저 이벤트 `money-routine:financial-transactions`를 듣는다. 금융 연동 모듈은 여러 건을 한 번에 보내거나 단일 거래를 보낼 수 있다.

```ts
window.dispatchEvent(
  new CustomEvent("money-routine:financial-transactions", {
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
  }),
);
```

단일 거래는 `detail.transaction`으로도 받을 수 있다.

## 방어 기준

- 한 이벤트에서 최대 200건만 처리한다. 초과분은 다음 동기화 이벤트로 나누어 보내야 한다.
- 같은 `source + externalId`가 다시 들어오면 중복 추가하지 않고 최신 값으로 갱신한다.
- `direction: "credit"`인 입금 거래는 소비 내역에 반영하지 않는다.
- 날짜, 사용처, 금액, 외부 ID가 비어 있거나 잘못된 거래는 건너뛴다.
- 0원 거래와 5,000만 원 초과 단일 거래는 실수 가능성이 크므로 자동 반영하지 않는다.
- 긴 사용처, 메모, 계좌명, 외부 ID는 저장 전에 잘라 브라우저 저장소와 UI를 보호한다.
- 병합 후 저장 거래가 너무 커지지 않도록 최근 1,200건 중심으로 유지한다.

## AI 호출 정책

실시간 거래가 들어와도 OpenAI API는 자동 호출하지 않는다. 홈, 캘린더, 알림, AI 코치의 로컬 미리보기 계산만 즉시 갱신하고, 외부 AI 분석은 사용자가 AI 코치 화면에서 `OpenAI 분석 업데이트`를 눌렀을 때만 실행한다.

## 테스트 범위

- 중복 거래 정산 업데이트
- 입금 거래 제외
- 잘못된 날짜와 이상 금액 제외
- 대용량 배치 상한 처리
- 기존 거래와 신규 금융 거래 병합
