# v4 디자인 완료 감사표

## 목적

이 문서는 기능 구현 단계에서 v4 디자인 기준이 충분히 준비되었는지 확인하기 위한 감사표다.

## 단계별 완료 증거

| 단계 | 완료 기준 | 증거 파일 | 상태 |
| --- | --- | --- | --- |
| 1. 공모전/서비스 방향 | Track B, AX 핀테크, 소비 캘린더 주제가 정리됨 | `docs/01-contest-alignment.md`, `docs/02-mvp-scope.md` | 완료 |
| 2. AI 기능 설계 | 소비 분류, 목표 기반 코칭, 구독 점검 프롬프트가 있음 | `docs/03-ai-design.md` | 완료 |
| 3. 외부 디자인 레퍼런스 | Toss, TravelWallet, Notion Calendar 등 참고 방향이 정리됨 | `docs/17-external-design-reference-study.md` | 완료 |
| 4. v4 디자인 방향 | 밝은 개인 금융 코치형 모바일 참고 화면이 있음 | `mockups/mobile-v4-reference-synthesis.html`, `mockups/mobile-v4-reference-synthesis.png` | 완료 |
| 5. 구현용 CSS 시스템 | 색상, 카드, 캘린더, 하단 탭 클래스가 있음 | `design/v4-ui-system.css` | 완료 |
| 6. 구현용 홈 스켈레톤 | CSS 클래스 기반으로 구현 출발점이 되는 홈 골격이 있음 | `design/v4-home-skeleton.html` | 완료 |
| 7. 디자인 토큰/컴포넌트 | v4 토큰, 컴포넌트, 카피 기준이 있음 | `docs/13-design-tokens-components.md` | 완료 |
| 8. 전체 화면 명세 | 홈, 캘린더, 입력, 목표, 코치, 설정 화면 기준이 있음 | `docs/12-complete-screen-specs.md` | 완료 |
| 9. 기능별 적용 가이드 | 기능 데이터를 어떤 UI에 매핑할지 정리됨 | `docs/18-v4-functional-design-guide.md` | 완료 |
| 10. 구현 전달 명세 | 구현 우선순위, 데이터 매핑, QA 기준이 정리됨 | `docs/10-design-implementation-handoff.md` | 완료 |
| 11. 모바일/접근성 QA | 뷰포트, 금지 사항, 접근성 기준이 있음 | `docs/14-mobile-accessibility-qa.md` | 완료 |

## 현재 최종 디자인 방향

기능 구현의 1순위 디자인 참고:

- `mockups/mobile-v4-reference-synthesis.png`
- `mockups/mobile-v4-reference-synthesis.html`
- `design/v4-ui-system.css`
- `design/v4-home-skeleton.html`

이전 목업:

- `mockups/main-dashboard.html`
- `mockups/full-flow-prototype.html`
- `mockups/mobile-v2-finance-concept.html`
- `mockups/mobile-v3-bright-finance-concept.html`

위 이전 목업들은 발전 과정 확인용이다. 실제 구현의 디자인 방향은 v4를 우선하되, v4 화면을 그대로 복제하지 않는다.

## 기능 구현 채팅으로 넘길 핵심 기준

- 첫 화면은 랜딩페이지가 아니라 실제 모바일 앱 홈이다.
- 전체 톤은 밝은 개인 금융 코치형이다.
- 캘린더는 밝은 카드 안에서 중심 기능처럼 보인다.
- AI는 챗봇이나 긴 리포트가 아니라 `오늘의 조정`, `이번 주 미션`, `구독 점검`으로 보인다.
- 구독 지출은 홈에서 반드시 한 번 이상 보인다.
- 하단 탭은 `홈`, `캘린더`, `추가`, `코치`, `설정`이다.
- 기능을 추가할 때는 `design/v4-ui-system.css`의 토큰과 클래스를 우선 사용한다.

## 구현 전 최종 확인 질문

기능 구현을 시작하기 전에 아래 질문에 모두 `예`라고 답할 수 있어야 한다.

1. 홈 첫 화면에서 이번 달 소비 금액과 목표 진행률이 가장 먼저 보이는가?
2. 캘린더가 앱의 핵심 기능처럼 보이는가?
3. AI 기능이 사용자의 다음 행동으로 번역되어 있는가?
4. 색상 역할이 파란색, 민트, 코랄, 앰버로 명확히 나뉘는가?
5. 하단 탭이 콘텐츠를 가리지 않는가?
6. 360px 모바일 폭에서도 텍스트가 넘치지 않는가?

## 남은 일

디자인 구현 방향은 v4로 정리되었다. 다음 단계는 실제 웹앱 구현 채팅에서 이 문서와 CSS 시스템을 출발점으로 삼아 React/Vite 또는 선택한 프론트엔드 구조에 맞게 적용하는 것이다.
