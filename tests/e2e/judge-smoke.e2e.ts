import { expect, test } from "@playwright/test";

test.describe("judge demo smoke flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.clear();
      window.localStorage.setItem(
        "money-routine-tutorial:v1",
        JSON.stringify({ version: 1, status: "completed" }),
      );
    });
    await page.reload();
  });

  test("guides a first-time user without calling the AI API and can be replayed", async ({ page }) => {
    let aiRequestCount = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/ai/coach")) {
        aiRequestCount += 1;
      }
    });

    await page.evaluate(() => window.localStorage.removeItem("money-routine-tutorial:v1"));
    await page.reload();

    const welcome = page.getByTestId("tutorial-welcome");
    await expect(welcome).toBeVisible();
    await expect(welcome).toContainText("현재 베타 버전은 실제 은행·카드 앱과 연결하지 않아요");
    await expect(welcome).toContainText("체험용 임시 데이터");

    await page.getByTestId("tutorial-start-sample").click();
    const stepIds = ["sample-home", "sample-calendar", "sample-coach", "sample-notifications"];
    await expect(page.locator(".tutorial-tooltip-head")).toContainText("샘플 체험");
    await expect(page.locator(".hero-amount")).not.toHaveText("0원");
    for (const [index, stepId] of stepIds.entries()) {
      await expect(page.getByTestId(`tutorial-step-${stepId}`)).toBeVisible();
      await expect(page.getByTestId(`tutorial-step-${stepId}`)).toContainText(`${index + 1} / ${stepIds.length}`);
      await expect.poll(async () => {
        return page.evaluate(() => {
          const spotlight = document.querySelector<HTMLElement>(".tutorial-spotlight")?.getBoundingClientRect();
          const tooltip = document.querySelector<HTMLElement>(".tutorial-tooltip")?.getBoundingClientRect();
          if (!spotlight || !tooltip) {
            return true;
          }
          return !(
            tooltip.right <= spotlight.left ||
            tooltip.left >= spotlight.right ||
            tooltip.bottom <= spotlight.top ||
            tooltip.top >= spotlight.bottom
          );
        });
      }).toBe(false);
      await page.getByTestId("tutorial-next").click();
    }

    await expect(page.getByTestId("tutorial-tour")).toHaveCount(0);
    await expect(page.getByTestId("nav-home")).toHaveAttribute("aria-current", "page");
    expect(aiRequestCount).toBe(0);

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);

    await page.reload();
    await page.waitForTimeout(1600);
    await expect(page.getByTestId("tutorial-welcome")).toHaveCount(0);

    await page.getByTestId("nav-settings").click();
    await page.getByTestId("settings-start-tutorial").click();
    await expect(page.getByTestId("tutorial-welcome")).toBeVisible();
    await page.getByTestId("tutorial-skip-welcome").click();
    await expect(page.getByTestId("nav-home")).toHaveAttribute("aria-current", "page");
    expect(aiRequestCount).toBe(0);
  });

  test("keeps the full feature guide separate and does not load sample data", async ({ page }) => {
    let aiRequestCount = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/ai/")) {
        aiRequestCount += 1;
      }
    });

    await page.evaluate(() => window.localStorage.removeItem("money-routine-tutorial:v1"));
    await page.reload();
    await page.getByTestId("tutorial-start-features").click();

    const stepIds = ["home", "goal", "add", "calendar", "coach", "ai", "notifications", "settings"];
    await expect(page.locator(".tutorial-tooltip-head")).toContainText("기능 안내");
    for (const [index, stepId] of stepIds.entries()) {
      await expect(page.getByTestId(`tutorial-step-${stepId}`)).toBeVisible();
      await expect(page.getByTestId(`tutorial-step-${stepId}`)).toContainText(`${index + 1} / ${stepIds.length}`);
      await page.getByTestId("tutorial-next").click();
    }

    await expect(page.getByTestId("tutorial-tour")).toHaveCount(0);
    await expect(page.locator(".hero-amount")).toHaveText("0원");
    const storedTransactionCount = await page.evaluate(() => {
      const stored = JSON.parse(window.localStorage.getItem("money-routine-calendar:v2") ?? "null");
      return stored?.state?.transactions?.length ?? 0;
    });
    expect(storedTransactionCount).toBe(0);
    expect(aiRequestCount).toBe(0);
  });

  test("loads sample data, updates goals, adds a transaction, and shows coach output", async ({ page }) => {
    const { fullDateLabel, isoDate } = await page.evaluate(() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

      return {
        fullDateLabel: `${year}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${weekdays[now.getDay()]}요일`,
        isoDate: `${year}-${month}-${day}`,
      };
    });

    await page.getByTestId("home-load-sample").click();
    await expect(page.locator(".hero-amount")).not.toHaveText("0원");
    await expect(page.getByText(fullDateLabel, { exact: false })).toHaveCount(0);

    await page.getByTestId("top-goal-button").click();
    await page.getByTestId("goal-spending-limit-input").fill("650000");
    await page.getByTestId("goal-saving-input").fill("250000");
    await page.getByTestId("goal-save-button").click();
    await expect(page.getByText("목표를 저장했어요.")).toBeVisible();

    await page.getByTestId("nav-add").click();
    await page.getByTestId("transaction-amount-input").fill("12500");
    await page.getByTestId("transaction-merchant-input").fill("심사 테스트 카페");
    await page.getByTestId("transaction-date-input").fill(isoDate);
    await page.getByRole("button", { name: "카페/간식" }).click();
    await page.getByTestId("transaction-save-button").click();
    await expect(page.getByTestId("entry-save-success")).toContainText("저장했어요");
    await expect(page.getByTestId("entry-save-success")).toContainText("12,500원 내역이 홈과 캘린더에 반영됐어요.");
    await expect(page.getByTestId("entry-add-another")).toBeVisible();
    await expect(page.getByTestId("entry-go-home")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

    await page.getByTestId("nav-calendar").click();
    await expect(page.getByText(`오늘 · ${fullDateLabel}`)).toBeVisible();
    await expect(page.getByTestId(`calendar-day-${isoDate}`)).toHaveClass(/is-today/);
    await page.getByTestId(`calendar-day-${isoDate}`).click();
    await expect(page.getByText("심사 테스트 카페")).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);

    await page.getByTestId("nav-coach").click();
    await expect(page.getByRole("heading", { name: "오늘의 소비 가이드" })).toBeVisible();
    await expect(page.getByText("AI 상태")).toBeVisible();
    await expect(page.getByText("분야별 소비 계획")).toBeVisible();
  });

  test("trust notice and settings clarify storage, AI transmission, and reset scope", async ({ page }) => {
    await page.getByTestId("top-trust-button").click();
    await expect(page.getByTestId("top-trust-panel")).toContainText("금융 인증정보를 받지 않아요");
    await expect(page.getByTestId("top-trust-panel")).toContainText("거래·목표는 브라우저에 저장");
    await expect(page.getByTestId("top-trust-panel")).toContainText("자동 분류는 사용처·메모");

    await page.getByTestId("nav-settings").click();
    await expect(page.getByText("샘플·직접 입력·CSV 전용 데모")).toBeVisible();
    await expect(page.getByText("데이터 사용 범위")).toBeVisible();
    await expect(page.getByText("AI 요청: 사용처·메모 또는 소비 요약 전송")).toBeVisible();
    await expect(page.getByText("앱 초기화: 거래·목표 기록 삭제")).toBeVisible();
  });

  test("shows empty-month actions and reports an invalid CSV date only once", async ({ page }) => {
    await page.getByTestId("nav-calendar").click();
    await expect(page.getByTestId("calendar-empty-state")).toContainText("이 달에는 기록이 없어요");
    await expect(page.getByTestId("calendar-filter-empty")).toBeVisible();
    await expect(page.locator(".status-card").filter({ hasText: "기록 없음" })).toBeVisible();

    await page.getByRole("button", { name: "CSV 연결" }).click();
    await page.getByTestId("csv-file-input").setInputFiles({
      name: "invalid-date.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("date,merchant,amount\n2026-02-31,테스트 카페,4300", "utf8"),
    });

    const dateError = "2행: 날짜는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.";
    await expect(page.getByTestId("csv-validation-errors")).toContainText(dateError);
    await expect(page.getByText(dateError, { exact: true })).toHaveCount(1);

    await page.getByTestId("csv-file-input").setInputFiles({
      name: "valid.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("date,merchant,amount\n2026-02-28,테스트 카페,4300", "utf8"),
    });
    await expect(page.getByTestId("csv-mode-summary")).toContainText("기존 내역 교체");
    await expect(page.getByRole("button", { name: "교체해서 반영" })).toBeVisible();
    await page.getByTestId("csv-mode-merge").click();
    await expect(page.getByTestId("csv-mode-summary")).toContainText("기존 내역과 병합");
    await expect(page.getByRole("button", { name: "병합해서 반영" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });

  test("keeps sample classification local and calls external classification once for an explicit auto save", async ({ page }) => {
    let classifyRequestCount = 0;
    await page.route("**/api/ai/classify", async (route) => {
      classifyRequestCount += 1;
      await route.fulfill({
        json: {
          category: "카페/간식",
          reason: "사용처와 메모를 기준으로 분류했어요.",
        },
      });
    });

    await page.getByTestId("home-load-sample").click();
    expect(classifyRequestCount).toBe(0);

    const isoDate = await page.evaluate(() => {
      const now = new Date();
      return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    });
    await page.getByTestId("nav-add").click();
    await page.getByTestId("transaction-amount-input").fill("4500");
    await page.getByTestId("transaction-merchant-input").fill("자동 분류 테스트 카페");
    await page.getByTestId("transaction-date-input").fill(isoDate);
    await page.getByTestId("transaction-save-button").click();

    await expect(page.getByTestId("entry-save-success")).toContainText("4,500원");
    expect(classifyRequestCount).toBe(1);
  });

  test("shows a matching goal warning instead of an optimistic saving status", async ({ page }) => {
    await page.getByTestId("home-load-sample").click();
    await page.getByTestId("top-goal-button").click();
    await page.getByTestId("goal-income-input").fill("500000");
    await page.getByTestId("goal-spending-limit-input").fill("650000");

    await expect(page.getByTestId("goal-summary-title")).toHaveText("목표 조정이 필요해요");
    await expect(page.locator(".goal-summary")).toContainText("월 수입과 소비·저축 목표의 균형을 다시 확인해주세요.");
    await expect(page.getByTestId("goal-warning")).toContainText("목표 소비액이 월 수입보다 커요.");
    await expect(page.getByText("저축 가능성은 좋아요")).toHaveCount(0);

    await page.getByTestId("goal-save-button").click();
    await expect(page.getByTestId("goal-summary-title")).toHaveText("목표 조정이 필요해요");
  });

  test("falls back within eight seconds and keeps one coach request in flight", async ({ page }) => {
    let coachRequestCount = 0;
    await page.route("**/api/ai/coach", async (route) => {
      coachRequestCount += 1;
      if (coachRequestCount === 1) {
        await new Promise((resolve) => setTimeout(resolve, 9000));
        await route.fulfill({ json: {} }).catch(() => undefined);
        return;
      }
      await route.fulfill({ json: {} });
    });

    await page.getByTestId("home-load-sample").click();
    await page.getByTestId("nav-coach").click();
    await page.getByTestId("coach-request-ai-button").click();
    await expect(page.getByText("AI 분석을 불러오는 중이에요")).toBeVisible();
    await expect(page.getByText("8초 안에 응답이 없으면 기본 분석으로 돌아갑니다.")).toBeVisible();

    await page.getByTestId("nav-home").click();
    await page.getByTestId("nav-coach").click();
    await expect(page.getByText("기본 분석으로 전환", { exact: true })).toBeVisible({ timeout: 9500 });
    expect(coachRequestCount).toBe(1);

    await expect(page.getByText("AI 상태")).toBeVisible();
    await expect(page.getByText("분석 중", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("coach-request-ai-button")).toHaveText(/다시 시도/);
    await expect(page.getByTestId("coach-use-default-button")).toBeVisible();

    await page.getByTestId("coach-use-default-button").click();
    await expect(page.getByText("기본 분석 표시", { exact: true })).toBeVisible();

    await page.getByTestId("coach-request-ai-button").click();
    await expect(page.getByText("OpenAI 분석 완료", { exact: true })).toBeVisible();
    expect(coachRequestCount).toBe(2);

    await page.getByTestId("nav-home").click();
    await page.getByTestId("nav-coach").click();
    await expect(page.getByText("저장된 AI 분석", { exact: true })).toBeVisible();
    await expect(page.getByTestId("coach-request-ai-button")).toHaveText(/저장된 분석/);
    expect(coachRequestCount).toBe(2);
  });

  test("shows an over-goal choice on launch and on the next screen transition", async ({ page }) => {
    await page.getByTestId("home-load-sample").click();
    await page.getByTestId("top-goal-button").click();
    await page.getByTestId("goal-spending-limit-input").fill("100000");
    await page.getByTestId("goal-save-button").click();

    await page.reload();
    await expect(page.getByTestId("budget-overrun-dialog")).toBeVisible();
    await expect(page.getByTestId("budget-overrun-dialog")).toContainText("이번 달 소비 목표를 넘었어요");
    await expect(page.getByTestId("budget-overrun-dialog")).toContainText("자동 조정 목표");

    await page.getByTestId("budget-overrun-manual").click();
    await expect(page.getByTestId("goal-spending-limit-input")).toBeVisible();
    await expect(page.getByTestId("goal-spending-limit-input")).toBeFocused();
    await expect(page.getByTestId("goal-overrun-input-guide")).toBeVisible();

    await page.getByTestId("goal-spending-limit-input").fill("300000");
    await page.getByTestId("goal-save-button").click();
    await page.getByTestId("nav-home").click();
    await expect(page.getByTestId("budget-overrun-dialog")).toHaveCount(0);

    await page.getByTestId("top-goal-button").click();
    await page.getByTestId("goal-spending-limit-input").fill("100000");
    await page.getByTestId("goal-save-button").click();
    await page.getByTestId("nav-home").click();
    await expect(page.getByTestId("budget-overrun-dialog")).toBeVisible();
    await page.getByTestId("budget-overrun-auto").click();

    await expect(page.getByTestId("budget-overrun-dialog")).toHaveCount(0);
    await expect(page.getByTestId("home-goal-chip")).not.toContainText("100,000원");

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });
});
