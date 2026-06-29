# 배포 활성화 가이드

## 현재 상태

코드 기준 배포 준비는 완료되어 있다.

- Vercel 설정: `vercel.json`
- Netlify 설정: `netlify.toml`
- GitHub Pages workflow: `.github/workflows/deploy-github-pages.yml`
- 일반 빌드: `npm run build`
- GitHub Pages 빌드: `npm run build:github-pages`

2026-06-29 기준 저장소 이름은 `2476ae/KT_AIContest`이고, GitHub Pages Source는 GitHub Actions로 설정되어 있다. 배포 workflow가 성공하면 `https://2476ae.github.io/KT_AIContest/`에서 확인한다.

## 1. GitHub Pages 활성화

1. GitHub에서 `2476ae/KT_AIContest` 저장소로 이동한다.
2. `Settings` 탭을 연다.
3. 왼쪽 메뉴에서 `Pages`를 선택한다.
4. `Build and deployment`의 `Source`를 `GitHub Actions`로 변경한다.
5. 저장 후 `Actions` 탭에서 `Deploy Frontend To GitHub Pages` workflow를 실행하거나 `master`에 새 커밋을 push한다.
6. workflow가 성공하면 아래 URL을 확인한다.

```text
https://2476ae.github.io/KT_AIContest/
```

확인 기준:

- 404가 아니어야 한다.
- 첫 화면에 `머니루틴`이 보여야 한다.
- 새로고침 후에도 앱이 렌더링되어야 한다.

## 2. Vercel 배포

1. Vercel에 로그인한다.
2. `Add New Project`를 선택한다.
3. GitHub 저장소 `2476ae/KT_AIContest`를 import한다.
4. Framework Preset은 `Vite`로 둔다.
5. Build Command는 아래와 같이 둔다.

```bash
npm run build
```

6. Output Directory는 아래와 같이 둔다.

```text
dist
```

7. Deploy를 누른다.

확인 기준:

- HTTPS URL이 생성된다.
- 홈, 추가, 목표, 캘린더, 코치, 설정 화면이 열린다.
- 새로고침 시 404가 나지 않는다.

## 3. Netlify 배포

1. Netlify에 로그인한다.
2. `Add new site`에서 GitHub 저장소 `2476ae/KT_AIContest`를 연결한다.
3. Build command는 아래와 같이 둔다.

```bash
npm run build
```

4. Publish directory는 아래와 같이 둔다.

```text
dist
```

5. Deploy를 누른다.

확인 기준:

- HTTPS URL이 생성된다.
- 새로고침 시 `netlify.toml`의 redirect 설정으로 앱이 유지된다.

## 4. 배포 후 필수 QA

배포 URL이 생성되면 시크릿 창과 모바일 브라우저에서 아래를 확인한다.

1. 홈 화면 첫 렌더링
2. 설정 화면의 `샘플 데이터 불러오기`
3. 목표 화면의 `목표 저장`
4. 추가 화면의 직접 거래 저장
5. 캘린더의 거래 반영
6. 코치 화면의 `AI 분석 연결 상태`
7. 설정 화면의 CSV 내보내기
8. 새로고침 후 앱 유지

## 권장 제출 URL

현재 실제로 활성화와 QA가 확인된 제출 URL은 GitHub Pages다.

```text
https://2476ae.github.io/KT_AIContest/
```

Vercel과 Netlify 설정도 유지되어 있으므로 대체 URL이 필요하면 같은 저장소를 연결해 사용할 수 있다. 다만 제출 직전에는 실제 제출 URL 하나를 기준으로 `npm run verify`, `npm run build:github-pages`, GitHub Actions 최신 run, 모바일 접속을 다시 확인한다.
