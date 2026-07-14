import { expect, test, type Page } from "@playwright/test";

async function expectTutorialTargetAligned(page: Page, targetName: string) {
  await expect.poll(async () => {
    return page.evaluate((expectedTarget) => {
      const target = document.querySelector<HTMLElement>(`[data-tutorial="${expectedTarget}"]`);
      const spotlight = document.querySelector<HTMLElement>(".tutorial-spotlight");
      const tooltip = document.querySelector<HTMLElement>(".tutorial-tooltip");
      if (!target || !spotlight || !tooltip || spotlight.dataset.target !== expectedTarget) {
        return false;
      }

      const targetRect = target.getBoundingClientRect();
      const spotlightRect = spotlight.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      const visibleTarget = {
        left: Math.max(0, targetRect.left),
        right: Math.min(viewportWidth, targetRect.right),
        top: Math.max(0, targetRect.top),
        bottom: Math.min(viewportHeight, targetRect.bottom),
      };
      const visibleArea = Math.max(0, visibleTarget.right - visibleTarget.left) * Math.max(0, visibleTarget.bottom - visibleTarget.top);
      const coveredWidth = Math.max(0, Math.min(spotlightRect.right, visibleTarget.right) - Math.max(spotlightRect.left, visibleTarget.left));
      const coveredHeight = Math.max(0, Math.min(spotlightRect.bottom, visibleTarget.bottom) - Math.max(spotlightRect.top, visibleTarget.top));
      const coverage = visibleArea > 0 ? (coveredWidth * coveredHeight) / visibleArea : 0;
      const overlapsTooltip = !(
        tooltipRect.right <= spotlightRect.left ||
        tooltipRect.left >= spotlightRect.right ||
        tooltipRect.bottom <= spotlightRect.top ||
        tooltipRect.top >= spotlightRect.bottom
      );

      return coverage >= 0.98 && !overlapsTooltip &&
        spotlightRect.left >= 0 && spotlightRect.top >= 0 &&
        spotlightRect.right <= viewportWidth && spotlightRect.bottom <= viewportHeight;
    }, targetName);
  }, { timeout: 3_000 }).toBe(true);
}

async function expectTutorialFieldsInsideSpotlight(page: Page, testIds: string[]) {
  await expect.poll(async () => page.evaluate((ids) => {
    const spotlight = document.querySelector<HTMLElement>(".tutorial-spotlight")?.getBoundingClientRect();
    if (!spotlight) {
      return false;
    }

    return ids.every((testId) => {
      const field = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.getBoundingClientRect();
      return Boolean(field) &&
        field!.left >= spotlight.left - 2 && field!.right <= spotlight.right + 2 &&
        field!.top >= spotlight.top - 2 && field!.bottom <= spotlight.bottom + 2;
    });
  }, testIds), { timeout: 3_000 }).toBe(true);
}

async function expectInputsInsideTransactionForm(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const form = document.querySelector<HTMLElement>("[data-testid='transaction-form']")?.getBoundingClientRect();
    const merchant = document.querySelector<HTMLInputElement>("[data-testid='transaction-merchant-input']")?.getBoundingClientRect();
    const date = document.querySelector<HTMLInputElement>("[data-testid='transaction-date-input']")?.getBoundingClientRect();
    const dateShell = document.querySelector<HTMLElement>("[data-testid='transaction-date-shell']")?.getBoundingClientRect();
    const dateText = document.querySelector<HTMLElement>("[data-testid='transaction-date-shell'] strong")?.getBoundingClientRect();
    if (!form || !merchant || !date || !dateShell || !dateText) {
      return false;
    }

    const isInside = (field: DOMRect) => field.left >= form.left && field.right <= form.right;
    const isStackedOnMobile = window.innerWidth >= 900 || merchant.bottom <= date.top;
    const shellCenter = dateShell.top + dateShell.height / 2;
    const textCenter = dateText.top + dateText.height / 2;
    const isDateCentered = Math.abs(shellCenter - textCenter) <= 2;
    return isInside(merchant) && isInside(date) && isInside(dateShell) && isStackedOnMobile && isDateCentered &&
      document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  })).toBe(true);
}

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

  test("guides a first-time user through one complete tutorial without calling the AI API", async ({ page }) => {
    let aiRequestCount = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/ai/")) {
        aiRequestCount += 1;
      }
    });

    await page.evaluate(() => window.localStorage.removeItem("money-routine-tutorial:v1"));
    await page.reload();

    const welcome = page.getByTestId("tutorial-welcome");
    await expect(welcome).toBeVisible();
    await expect(welcome).toContainText("베타 버전은 실제 은행·카드 앱과 연결하지 않아요");
    await expect(welcome).toContainText("체험용 임시 데이터");
    await expect(page.getByTestId("tutorial-start")).toBeVisible();
    await expect(page.getByTestId("tutorial-start-sample")).toHaveCount(0);
    await expect(page.getByTestId("tutorial-start-features")).toHaveCount(0);

    await page.getByTestId("tutorial-start").click();
    const steps = [
      ["home", "home-summary"],
      ["goal", "goal-button"],
      ["add", "add-entry"],
      ["csv", "csv-import"],
      ["calendar", "calendar-main"],
      ["coach", "coach-overview"],
      ["ai", "coach-ai-update"],
      ["trust", "trust"],
      ["notifications", "notifications"],
      ["settings", "settings-tools"],
    ] as const;
    await expect(page.locator(".tutorial-tooltip-head")).toContainText("사용 가이드");
    await expect(page.locator(".hero-amount")).not.toHaveText("0원");
    await expect(page.locator(".tutorial-spotlight")).toBeVisible();
    await page.evaluate(() => {
      const spotlight = document.querySelector<HTMLElement>(".tutorial-spotlight");
      const tooltip = document.querySelector<HTMLElement>(".tutorial-tooltip");
      const layer = document.querySelector<HTMLElement>(".tutorial-layer");
      const audit = { spotlightRemoved: false, tooltipRemoved: false };
      const observer = new MutationObserver(() => {
        audit.spotlightRemoved ||= Boolean(spotlight && !spotlight.isConnected);
        audit.tooltipRemoved ||= Boolean(tooltip && !tooltip.isConnected);
      });
      if (layer) {
        observer.observe(layer, { childList: true, subtree: true });
      }
      (window as typeof window & { __tutorialTransitionAudit?: { audit: typeof audit; observer: MutationObserver } })
        .__tutorialTransitionAudit = { audit, observer };
    });
    for (const [index, [stepId, targetName]] of steps.entries()) {
      await expect(page.getByTestId(`tutorial-step-${stepId}`)).toBeVisible();
      await expect(page.getByTestId(`tutorial-step-${stepId}`)).toContainText(`${index + 1} / ${steps.length}`);
      await expectTutorialTargetAligned(page, targetName);
      if (stepId === "add") {
        await expectTutorialFieldsInsideSpotlight(page, [
          "transaction-amount-input",
          "transaction-merchant-input",
          "transaction-date-input",
        ]);
      }
      await page.getByTestId("tutorial-next").click();
      if (index < steps.length - 1) {
        await expect(page.getByTestId(`tutorial-step-${stepId}`)).toHaveCount(0);
        await expect(page.getByTestId(`tutorial-step-${steps[index + 1][0]}`)).toBeVisible();
      }
    }

    const transitionAudit = await page.evaluate(() => {
      const state = (window as typeof window & {
        __tutorialTransitionAudit?: {
          audit: { spotlightRemoved: boolean; tooltipRemoved: boolean };
          observer: MutationObserver;
        };
      }).__tutorialTransitionAudit;
      state?.observer.disconnect();
      return state?.audit;
    });
    expect(transitionAudit).toEqual({ spotlightRemoved: false, tooltipRemoved: false });
    await expect(page.getByTestId("tutorial-tour")).toHaveCount(0);
    await expect(page.getByTestId("nav-home")).toHaveAttribute("aria-current", "page");
    expect(aiRequestCount).toBe(0);

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);

    await page.reload();
    await page.waitForTimeout(1600);
    await expect(page.getByTestId("tutorial-welcome")).toHaveCount(0);
  });

  test("skips without loading sample data and preserves user data when the tutorial is replayed", async ({ page }) => {
    let aiRequestCount = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/ai/")) {
        aiRequestCount += 1;
      }
    });

    await page.evaluate(() => window.localStorage.removeItem("money-routine-tutorial:v1"));
    await page.reload();
    await expect(page.getByTestId("tutorial-welcome")).toBeVisible();
    await page.getByTestId("tutorial-skip-welcome").click();
    await expect(page.locator(".hero-amount")).toHaveText("0원");
    const storedTransactionCount = await page.evaluate(() => {
      const stored = JSON.parse(window.localStorage.getItem("money-routine-calendar:v2") ?? "null");
      return stored?.state?.transactions?.length ?? 0;
    });
    expect(storedTransactionCount).toBe(0);

    const isoDate = await page.evaluate(() => {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${now.getFullYear()}-${month}-${day}`;
    });
    await page.getByTestId("nav-add").click();
    await page.getByTestId("transaction-amount-input").fill("1000");
    await page.getByTestId("transaction-merchant-input").fill("튜토리얼 보존 테스트");
    await page.getByTestId("transaction-date-input").fill(isoDate);
    await page.getByRole("button", { name: "생활" }).click();
    await page.getByTestId("transaction-save-button").click();
    await expect(page.getByTestId("entry-save-success")).toBeVisible();

    await page.getByTestId("nav-settings").click();
    await page.getByTestId("settings-start-tutorial").click();
    await expect(page.getByTestId("tutorial-welcome")).toBeVisible();
    await expect(page.getByTestId("tutorial-welcome")).toContainText("현재 저장된 내역을 유지");
    await page.getByTestId("tutorial-start").click();
    await expect(page.getByTestId("tutorial-step-home")).toBeVisible();
    await expect(page.locator(".hero-amount")).toHaveText("1,000원");
    await expectTutorialTargetAligned(page, "home-summary");
    const replayedTransactionCount = await page.evaluate(() => {
      const stored = JSON.parse(window.localStorage.getItem("money-routine-calendar:v2") ?? "null");
      return stored?.state?.transactions?.length ?? 0;
    });
    expect(replayedTransactionCount).toBe(1);
    await page.getByTestId("tutorial-skip-tour").click();
    await expect(page.getByTestId("nav-home")).toHaveAttribute("aria-current", "page");
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

  test("keeps mobile form actions reachable while an input has keyboard focus", async ({ page }) => {
    await page.getByTestId("nav-add").click();
    const amountInput = page.getByTestId("transaction-amount-input");
    const bottomNav = page.locator(".bottom-nav");
    const viewport = page.viewportSize();

    if (viewport && viewport.width <= 430) {
      for (const width of [280, 300, 320, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        await expectInputsInsideTransactionForm(page);
      }
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    } else {
      await expectInputsInsideTransactionForm(page);
    }

    await expect(page.getByTestId("transaction-date-input")).toHaveCSS("appearance", "none");
    await expect(page.getByTestId("transaction-date-shell")).toContainText(/\d{4}\. \d{1,2}\. \d{1,2}\./);

    await amountInput.focus();
    if (viewport && viewport.width <= 430) {
      await page.setViewportSize({ width: viewport.width, height: 500 });
      await expect(bottomNav).toHaveCSS("opacity", "0");
      await expect(bottomNav).toHaveCSS("pointer-events", "none");

      await page.getByTestId("transaction-amount-input").fill("5000");
      await page.getByTestId("transaction-merchant-input").fill("모바일 키보드 테스트");
      const isoDate = await page.evaluate(() => {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${now.getFullYear()}-${month}-${day}`;
      });
      await page.getByTestId("transaction-date-input").fill(isoDate);
      await page.getByRole("button", { name: "생활" }).click();
      const saveButton = page.getByTestId("transaction-save-button");
      await saveButton.scrollIntoViewIfNeeded();
      const saveBox = await saveButton.boundingBox();
      expect(saveBox).not.toBeNull();
      expect((saveBox?.y ?? 0) + (saveBox?.height ?? 0)).toBeLessThanOrEqual(500);

      await page.locator("body").click({ position: { x: 4, y: 4 } });
      await expect(bottomNav).toHaveCSS("opacity", "1");
    } else {
      await expect(bottomNav).toHaveCSS("opacity", "1");
    }
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
