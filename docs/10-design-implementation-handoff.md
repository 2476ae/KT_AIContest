# v4 구현 전달 명세

이 문서는 디자인 설계 채팅에서 기능 구현 채팅으로 넘길 최종 가이드다. 기능을 붙일 때 v4 구상도의 분위기, 정보 위계, 컴포넌트 언어를 유지하되, 스크린샷을 픽셀 단위로 그대로 재현하지 않는다.

## 최종 참고 파일

구현 채팅에서는 아래 파일을 우선순위대로 참고한다.

1. `mockups/mobile-v4-reference-synthesis.png`: 모바일 첫인상과 분위기 참고
2. `mockups/mobile-v4-reference-synthesis.html`: v4 화면 구조와 CSS 예시
3. `design/v4-ui-system.css`: 구현용 공통 디자인 토큰과 클래스
4. `design/v4-home-skeleton.html`: 기능 구현을 시작하기 위한 홈 화면 출발점
5. `docs/13-design-tokens-components.md`: v4 토큰, 컴포넌트, 카피 기준
6. `docs/18-v4-functional-design-guide.md`: 기능별 화면 적용 가이드
7. `docs/14-mobile-accessibility-qa.md`: 모바일/접근성/QA 기준

이전 목업인 `mockups/full-flow-prototype.html`, `mockups/main-dashboard.html`, `mockups/mobile-v2-finance-concept.html`, `mockups/mobile-v3-bright-finance-concept.html`은 발전 과정 확인용으로만 사용한다. 구현의 디자인 방향은 v4를 따른다.

## 구현 해석 원칙

- v4 스크린샷은 그대로 복제할 화면이 아니라 디자인 방향을 보여주는 기준 이미지다.
- 실제 구현에서는 기능 흐름, 데이터 상태, 반응형 조건에 맞게 배치와 세부 요소를 조정한다.
- 유지해야 할 것은 밝은 금융 코치 톤, 큰 금액 중심 위계, 밝은 소비 캘린더, 조정 미션, 하단 탭의 구조다.
- 바꿔도 되는 것은 세부 카드 개수, 문구 길이, 아이콘, 캘린더 표시 범위, 화면별 세부 배치다.
- 특정 금융앱의 화면을 그대로 재현하지 않는다.

## 구현 목표

첫 기능 구현 목표는 **모바일 첫 화면만 봐도 소비 캘린더 서비스의 가치가 보이는 것**이다.

핵심 경험:

1. 사용자가 샘플 소비 데이터를 불러온다.
2. 이번 달 소비 금액과 목표 진행률을 본다.
3. 캘린더에서 날짜별 소비 상태와 구독 결제일을 확인한다.
4. 선택한 날짜의 소비 이유를 확인한다.
5. 코치 미션을 통해 오늘 조정할 행동을 받는다.

## 디자인 방향

서비스 톤:

- 밝은 개인 금융 코치
- 실제 배포 가능한 모바일 금융앱
- 캘린더 중심 소비 관리
- AI가 앞에 나서는 앱이 아니라, 사용자의 소비 방향을 조정해주는 앱

금지:

- 보라색 AI SaaS 대시보드
- 랜딩페이지형 hero
- 광고 배너와 캐릭터 중심 화면
- 캘린더만 다크모드로 분리
- 카드 안에 카드가 반복되는 구조
- 긴 AI 설명문

## 첫 구현 화면: 홈

모바일 홈 순서:

1. TopBar: 브랜드, 월 선택, 알림
2. HeroSpendingCard: 이번 달 소비, 목표 진행률, 오늘 가능예산, 저축 예상, 고정 구독비
3. CoachStrip: 오늘의 조정 한 문장
4. QuickActionGrid: 내역 추가, 파일 연결, 목표 수정, 코치 보기
5. SpendingCalendar: 밝은 소비 캘린더
6. SelectedDayNote: 선택한 날짜의 소비 해석
7. MissionList: 이번 주 조정 미션 2개
8. MiniInsightCard: 구독 지출, 잔액 흐름
9. TransactionList: 최근 소비 2건
10. BottomNavigation: 홈, 캘린더, 추가, 코치, 설정

권장 DOM 구조:

```text
.app-phone
  .app-page
    .app-topbar
    .hero-card.card
      .hero-head
      .progress-block
      .metric-grid
      .coach-strip
    .quick-action-grid
    .section-title
    .calendar-card.card
      .calendar-head
      .weekdays
      .calendar-grid
      .selected-day-note
    .mission-list
    .mini-card-grid
    .transaction-list
  .bottom-nav
```

## 화면별 구현 기준

### 홈 화면

홈은 심사위원이 처음 보는 화면이다. 기능 수를 많이 보여주기보다 "이 앱이 무엇을 해결하는지"를 10초 안에 이해하게 만들어야 한다.

필수 데이터:

- 이번 달 총 소비
- 월 목표 소비액
- 목표 진행률
- 오늘 가능예산
- 목표 저축 예상액
- 구독 월 지출
- 오늘의 조정 문장
- 날짜별 소비 상태
- 최근 거래 2건

### 캘린더 화면

캘린더 화면은 홈의 캘린더를 확장한다.

추가 요소:

- 월 이동
- 카테고리 필터
- 구독만 보기
- 과소비일만 보기
- 선택일 상세 거래 목록
- 선택일 코치 코멘트

디자인 규칙:

- 홈과 같은 밝은 캘린더 셀을 사용한다.
- 필터는 칩 형태로 둔다.
- 날짜 셀 안에는 짧은 금액 또는 짧은 라벨만 둔다.

### 입력 화면

입력 화면은 금융앱의 송금/충전 화면처럼 단순해야 한다.

순서:

1. 금액 입력
2. 사용처 입력
3. 날짜 선택
4. 카테고리 선택
5. 구독 여부
6. 저장

디자인 규칙:

- 금액 입력을 화면 상단의 가장 큰 요소로 둔다.
- 카테고리는 색상 pill 또는 segmented control로 둔다.
- 저장 버튼은 파란색 primary 버튼 하나만 강하게 둔다.
- CSV 업로드는 별도 카드로 분리한다.

### 목표 화면

목표 화면은 숫자 설정이 중심이다.

필수 입력:

- 월 목표 소비액
- 목표 저축액
- 집중 관리 카테고리
- 구독 지출 목표

디자인 규칙:

- 숫자 입력은 stepper 또는 직접 입력을 함께 제공한다.
- 변경 후 예상 결과를 바로 보여준다.
- 목표 달성 가능성은 `안정`, `점검`, `초과 위험`처럼 짧게 표시한다.

### 코치 화면

코치 화면은 AI 채팅방처럼 만들지 않는다. 사용자의 소비 목표에 연결된 미션 피드로 구성한다.

섹션:

- 오늘의 조정
- 이번 주 미션
- 구독 점검
- 카테고리별 코멘트
- 다음 결제일 알림

디자인 규칙:

- 메시지 말풍선보다 카드형 피드를 쓴다.
- 각 카드에는 행동, 이유, 예상 절약액이 있어야 한다.
- 긴 설명은 접힘 영역으로 보낸다.

## 데이터와 UI 매핑

### Summary

| 데이터 | UI 위치 |
| --- | --- |
| `totalSpent` | HeroSpendingCard 메인 금액 |
| `monthlyLimit` | GoalChip |
| `spendingProgress` | ProgressBar |
| `dailyBudgetLeft` | MetricTile: 오늘 가능예산 |
| `savingProjection` | MetricTile: 저축 예상 |
| `subscriptionTotal` | MetricTile: 고정 구독비, MiniInsightCard |

### Calendar

| 데이터 | UI 위치 |
| --- | --- |
| `day.date` | CalendarDay number |
| `day.amount` | CalendarDay meta |
| `day.status === "safe"` | 민트 셀 |
| `day.status === "subscription"` | 앰버 셀 |
| `day.status === "over"` | 코랄 셀 |
| `selectedDay.reason` | SelectedDayNote 제목/문장 |
| `selectedDay.amount` | SelectedDayNote 오른쪽 금액 |

### Coach

| 데이터 | UI 위치 |
| --- | --- |
| `coach.todayAction` | CoachStrip |
| `mission.title` | MissionCard 제목 |
| `mission.reason` | MissionCard 설명 |
| `mission.expectedSaving` | MissionCard 오른쪽 금액 |

### Transactions

| 데이터 | UI 위치 |
| --- | --- |
| `merchant` | TransactionList 제목 |
| `category` | TransactionList 보조 |
| `time` | TransactionList 보조 |
| `amount` | 오른쪽 금액 |
| `type` | 입금은 민트, 지출은 코랄 |

## 기본 데이터

개발 초기에는 `data/sample_transactions.csv`를 사용한다.

기본 목표값:

```text
monthlyIncome: 1200000
spendingLimit: 720000
savingGoal: 200000
focusCategories: 카페, 배달, 구독
```

## 계산 규칙

### 이번 달 총 지출

지출 거래만 합산한다. 입금과 계좌이체는 제외한다.

### 목표 진행률

```text
현재 지출 / 목표 소비액 * 100
```

### 오늘 가능예산

```text
(목표 소비액 - 현재 지출) / 남은 일수
```

음수가 되면 0원으로 표시하고 상태를 `over`로 둔다.

### 구독 월 지출

`isSubscription`이 true인 거래를 합산한다. 서비스명이 매월 반복되는 항목은 구독 후보로 표시할 수 있다.

### 선택일 상태

```text
safe: 하루 예산의 50% 이하 또는 무지출
normal: 하루 예산 이내
subscription: 구독 결제가 포함된 날
over: 하루 예산 초과
```

## 카피 예시

앱 보조 문구:

> 소비 캘린더 · 목표 코치

오늘의 조정:

> 카페를 이번 주 2회만 유지하면 목표 저축액에 12,000원 더 가까워져요.

선택일 설명:

> 14일은 평소보다 카페 지출이 큰 날

미션:

> 목요일 무지출 하루 만들기

구독:

> 이번 달 고정비의 58%가 25일 전 결제돼요.

## 구현 순서

1. `design/v4-ui-system.css`를 앱 전역 CSS로 추가한다.
2. `design/v4-home-skeleton.html`의 구조를 출발점으로 삼아 앱 컴포넌트로 나눈다.
3. 모바일 홈 레이아웃을 먼저 구현한다.
4. 샘플 데이터를 카드와 캘린더에 연결한다.
5. 선택 날짜 상태와 상세 패널을 연결한다.
6. 미션 카드와 구독 카드를 연결한다.
7. 캘린더/입력/목표/코치 화면을 같은 컴포넌트로 확장한다.

## 디자인 QA 체크리스트

- 첫 화면이 실제 앱 화면인가?
- 서비스명, 이번 달 소비, 목표 진행률이 화면 상단에 보이는가?
- 캘린더가 밝은 카드 안에서 중심 기능처럼 보이는가?
- 파란색, 민트, 코랄, 앰버의 역할이 섞이지 않는가?
- AI가 긴 문단으로 설명하지 않고 조정 행동으로 제안되는가?
- 버튼과 카드의 radius가 8px 기준으로 맞는가?
- 하단 탭이 콘텐츠를 가리지 않는가?
- 360px 모바일 폭에서도 텍스트가 넘치지 않는가?
