# 배포와 제출 데모 QA 리포트

## 목적

심사위원이 URL로 접속했을 때 별도 설명 없이 머니루틴 캘린더의 핵심 흐름을 체험할 수 있는지 확인한다.

## 배포 경로

### 1. Vercel

- 설정 파일: `vercel.json`
- Build Command: `npm run build`
- Output Directory: `dist`
- 권장 사용: 공모전 제출용 기본 URL
- 제출 URL: `https://kt-ai-contest.vercel.app/`

### 2. Netlify

- 설정 파일: `netlify.toml`
- Build command: `npm run build`
- Publish directory: `dist`
- SPA 새로고침 대응: `/* -> /index.html`

### 3. GitHub Pages

- 설정 파일: `.github/workflows/deploy-github-pages.yml`
- Build command: `npm run build:github-pages`
- 백업 URL: `https://2476ae.github.io/KT_AIContest/`
- 전제: GitHub 저장소 Settings > Pages의 Source가 GitHub Actions로 설정되어 있어야 한다.
- 활성화 절차: [배포 활성화 가이드](24-deployment-activation-guide.md)

## 로컬 검증 결과

2026-06-30 기준으로 아래 명령을 통과했다.

```bash
npm run verify
npm run build:github-pages
```

검증 범위:

- Vitest: 9개 파일, 45개 테스트
- TypeScript build
- Vite production build
- GitHub Pages base path build
- 핵심 상태 흐름 테스트: 샘플 로드, 탭/월 이동, 직접 거래 추가/수정/삭제, 목표 수정/초기화, CSV 교체/병합

자동 QA 보조 기준:

- 주요 버튼과 입력에는 `data-testid`가 있다.
- 하단 내비: `nav-home`, `nav-calendar`, `nav-add`, `nav-coach`, `nav-settings`
- 샘플 로드: `home-load-sample`, `settings-load-sample`
- 거래 입력: `transaction-amount-input`, `transaction-merchant-input`, `transaction-date-input`, `transaction-save-button`
- 목표 저장: `goal-spending-limit-input`, `goal-saving-input`, `goal-save-button`
- 캘린더: `calendar-day-YYYY-MM-DD`, `calendar-filter-over`, `calendar-filter-subscription`, `calendar-filter-safe`

## 심사위원 3분 체험 플로우

1. 홈 화면에서 서비스명과 월 지출 요약을 확인한다.
2. 설정 화면에서 `샘플 데이터 불러오기`를 눌러 35건 샘플 데이터를 복원한다.
3. 목표 화면에서 목표 소비액을 바꾸고 `목표 저장`을 누른다.
4. 홈 화면에서 월 목표 금액, 진행률, 오늘 가능예산이 바뀌는지 확인한다.
5. 추가 화면에서 거래를 직접 입력하고 저장 성공 메시지를 확인한다.
6. 캘린더 화면에서 방금 입력한 거래가 선택일 상세에 반영되는지 확인한다.
7. 코치 화면에서 오늘의 소비 가이드, 미션, 정기 결제 점검, AI 분석 연결 상태를 확인한다.
8. 설정 화면에서 CSV 내보내기와 초기화/샘플 복원을 확인한다.

성공 기준:

- 모든 기능이 한 화면 안에서 끊기지 않고 이어진다.
- 실제 금융 인증정보나 계좌 연동을 요구하지 않는다.
- 목표 변경과 소비 추가가 홈, 캘린더, 코치 화면에 즉시 반영된다.
- PC와 모바일에서 가로 스크롤, 제목/카드 분리, 하단 내비 가림이 없다.

## CSV QA 체크리스트

### 정상 파일

- 파일: `data/sample_transactions.csv`
- 기대 결과:
  - 35건 거래를 읽는다.
  - 구독 후보가 포함된다.
  - 총 지출은 397,790원이다.
  - 교체/병합 반영 버튼이 활성화된다.

### 빈 파일

- 기대 결과:
  - `CSV 파일이 비어 있습니다.` 또는 `CSV에 거래 데이터가 없습니다.` 오류를 보여준다.
  - 반영 버튼이 비활성화된다.

### 필수 헤더 누락

- 필수 헤더: `date`, `merchant`, `amount`
- 기대 결과:
  - 누락된 필드를 오류로 보여준다.
  - 유효한 거래가 없으면 반영하지 않는다.

### 금액 콤마 포함

예시:

```csv
date,merchant,amount
2026-06-01,카페,"4,300"
```

기대 결과:

- 금액을 4,300원으로 파싱한다.
- 자동 분류 결과가 카페/간식으로 반영된다.

## 반응형 QA 결과

브라우저 자동 점검으로 아래 폭을 확인했다.

- PC: 1440x900
- 모바일: 390x844
- 작은 모바일: 360px 계열 보완 대상 확인 후 모바일 캘린더 탭 영역을 재조정했다.

확인 결과:

- 전체 주요 화면 가로 넘침 없음
- 섹션 제목과 콘텐츠 오정렬 없음
- 콘솔 에러 0개
- 하단 내비가 핵심 버튼을 가리지 않음
- 모바일 390x844 기준 캘린더 날짜 버튼 최소 폭 46px
- 모바일 390x844 기준 44px 미만 주요 버튼 0개

## 제출 전 마지막 확인

배포 URL이 생성되면 아래를 시크릿 창에서 다시 확인한다.

- HTTPS 접속
- 새로고침 후 정상 렌더링
- 모바일 브라우저 접속
- 샘플 데이터 불러오기
- 목표 저장
- 직접 거래 추가
- 코치 화면 AI 상태 카드 표시
- CSV 내보내기
