import { describe, expect, it } from "vitest";
import { CATEGORIES, DEFAULT_GOAL } from "../constants";
import { isSampleTransactionId, loadCurrentSampleTransactions } from "../data";
import type { Transaction } from "../types";
import { getSummary } from "./analytics";
import {
  addTransactionState,
  alignSampleTransactionsState,
  applyImportedTransactionsState,
  createInitialAppState,
  deleteTransactionState,
  importCsvState,
  INITIAL_APP_STATE,
  loadSampleState,
  mergeStoredState,
  moveCalendarMonthState,
  parseImportCsv,
  resetGoalState,
  restoreStoredState,
  rollCurrentDateState,
  serializeAppState,
  setActiveTabState,
  setSelectedDateState,
  syncFinancialFeedState,
  updateGoalState,
  updateTransactionState,
} from "./appState";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-existing",
    date: "2026-06-01",
    merchant: "테스트 카페",
    amount: 4300,
    memo: "커피",
    paymentType: "card",
    category: CATEGORIES[1],
    isSubscription: false,
    ...overrides,
  };
}

describe("app state service", () => {
  const referenceDate = new Date(2026, 6, 14);

  it("creates and restores the initial state on the actual date", () => {
    const initialState = createInitialAppState(referenceDate);

    expect(initialState).toMatchObject({
      activeTab: "home",
      calendarMonth: "2026-07",
      hasLoadedSample: false,
      selectedDate: "2026-07-14",
      transactions: [],
    });

    expect(mergeStoredState({ activeTab: "coach", hasLoadedSample: true }, referenceDate)).toMatchObject({
      activeTab: "home",
      calendarMonth: "2026-07",
      hasLoadedSample: true,
      selectedDate: "2026-07-14",
    });
    expect(mergeStoredState(null, referenceDate)).toEqual(initialState);
  });

  it("migrates legacy state and rejects malformed stored transactions", () => {
    const legacyState = {
      ...createInitialAppState(referenceDate),
      activeTab: "coach",
      goal: { ...DEFAULT_GOAL, spendingLimit: 640000 },
      transactions: [
        transaction({ date: "2026-07-12" }),
        transaction({ id: "bad-date", date: "2026-02-31" }),
        transaction({ id: "bad-amount", amount: -1 }),
      ],
    };
    const restoredLegacy = restoreStoredState(legacyState, referenceDate);
    const restoredVersioned = restoreStoredState(JSON.parse(serializeAppState(restoredLegacy)), referenceDate);

    expect(restoredLegacy.activeTab).toBe("home");
    expect(restoredLegacy.transactions).toHaveLength(1);
    expect(restoredLegacy.goal.spendingLimit).toBe(640000);
    expect(restoredVersioned).toEqual(restoredLegacy);
  });

  it("moves sample transactions to the current and previous month without future spending", () => {
    const initialState = createInitialAppState(referenceDate);
    const state = loadSampleState(initialState, loadCurrentSampleTransactions(referenceDate), referenceDate);
    const monthTransactions = state.transactions.filter((transaction) => transaction.date.startsWith("2026-07"));
    const summary = getSummary(monthTransactions, state.goal, state.calendarMonth);

    expect(state.transactions).toHaveLength(50);
    expect(monthTransactions).toHaveLength(19);
    expect(monthTransactions.every((transaction) => transaction.date <= "2026-07-14")).toBe(true);
    expect(state.calendarMonth).toBe("2026-07");
    expect(state.selectedDate).toBe("2026-07-14");
    expect(state.hasLoadedSample).toBe(true);
    expect(summary.totalSpent).toBe(243490);
    expect(summary.subscriptionTotal).toBe(47190);
  });

  it("moves between tabs, selected dates, and months", () => {
    const calendarState = setActiveTabState(INITIAL_APP_STATE, "calendar");
    expect(calendarState.activeTab).toBe("calendar");

    const selected = setSelectedDateState(calendarState, "2026-07-04");
    expect(selected.calendarMonth).toBe("2026-07");
    expect(selected.selectedDate).toBe("2026-07-04");

    const previousMonth = moveCalendarMonthState(selected, -1);
    expect(previousMonth.calendarMonth).toBe("2026-06");
    expect(previousMonth.selectedDate).toBe("2026-06-01");
  });

  it("rolls an open current-month view into the new day and month", () => {
    const juneState = createInitialAppState(new Date(2026, 5, 30));
    const julyState = rollCurrentDateState(juneState, "2026-06-30", "2026-07-01");

    expect(julyState.calendarMonth).toBe("2026-07");
    expect(julyState.selectedDate).toBe("2026-07-01");

    const browsingMay = { ...juneState, calendarMonth: "2026-05", selectedDate: "2026-05-12" };
    expect(rollCurrentDateState(browsingMay, "2026-06-30", "2026-07-01")).toBe(browsingMay);
  });

  it("adds, updates, and deletes a manual transaction", () => {
    const added = addTransactionState(
      INITIAL_APP_STATE,
      {
        date: "2026-07-04",
        merchant: "테스트 서점",
        amount: 12000,
        memo: "문구",
        paymentType: "card",
        category: CATEGORIES[4],
        isSubscription: false,
      },
      "tx-user-fixed",
    );

    expect(added.transactions[0]).toMatchObject({
      id: "tx-user-fixed",
      merchant: "테스트 서점",
    });
    expect(added.calendarMonth).toBe("2026-07");
    expect(added.selectedDate).toBe("2026-07-04");
    expect(added.hasLoadedSample).toBe(true);

    const updated = updateTransactionState(added, {
      ...added.transactions[0],
      category: CATEGORIES[0],
    });
    expect(updated.transactions[0].category).toBe(CATEGORIES[0]);

    const deleted = deleteTransactionState(updated, "tx-user-fixed");
    expect(deleted.transactions).toHaveLength(0);
  });

  it("keeps a changed sample category when sample dates are realigned", () => {
    const referenceDate = new Date(2026, 6, 15);
    const samples = loadCurrentSampleTransactions(referenceDate);
    const loaded = loadSampleState(createInitialAppState(referenceDate), samples, referenceDate);
    const target = loaded.transactions.find((item) => item.id === "tx-003");

    expect(target).toBeDefined();
    const changed = updateTransactionState(loaded, {
      ...target!,
      category: "식비",
      classificationReason: "식비로 직접 변경했어요.",
    });
    const aligned = alignSampleTransactionsState(
      changed,
      loadCurrentSampleTransactions(referenceDate),
      isSampleTransactionId,
    );

    expect(aligned.transactions.find((item) => item.id === "tx-003")).toMatchObject({
      category: "식비",
      classificationReason: "식비로 직접 변경했어요.",
    });
  });

  it("updates and resets goal settings", () => {
    const customGoal = {
      ...DEFAULT_GOAL,
      spendingLimit: 650000,
      savingGoal: 260000,
    };
    const updated = updateGoalState(INITIAL_APP_STATE, customGoal);

    expect(updated.goal.spendingLimit).toBe(650000);
    expect(resetGoalState(updated).goal).toEqual(DEFAULT_GOAL);
  });

  it("imports CSV data in replace and merge modes", () => {
    const csv = [
      "id,date,merchant,amount,memo,paymentType,category,isSubscription",
      "tx-existing,2026-06-02,수정된 카페,5000,아침,card,카페/간식,false",
      "tx-new,2026-06-03,테스트 OTT,13500,구독,card,구독,true",
    ].join("\n");

    const replaced = importCsvState(INITIAL_APP_STATE, csv, "replace");
    expect(replaced.imported).toHaveLength(2);
    expect(replaced.state.transactions.map((item) => item.id)).toEqual(["tx-existing", "tx-new"]);
    expect(replaced.state.selectedDate).toBe("2026-06-03");
    expect(replaced.state.hasLoadedSample).toBe(true);

    const currentWithExisting = {
      ...INITIAL_APP_STATE,
      transactions: [transaction()],
    };
    const imported = parseImportCsv(csv);
    const merged = applyImportedTransactionsState(currentWithExisting, imported, "merge");

    expect(merged.transactions).toHaveLength(2);
    expect(merged.transactions.find((item) => item.id === "tx-existing")?.amount).toBe(5000);
    expect(merged.transactions.find((item) => item.id === "tx-new")?.isSubscription).toBe(true);

    const duplicateWithNewId = {
      ...imported.find((item) => item.id === "tx-new")!,
      id: "tx-new-copy",
    };
    const duplicateMerge = applyImportedTransactionsState(merged, [duplicateWithNewId], "merge");
    expect(duplicateMerge).toBe(merged);
    expect(duplicateMerge.transactions).toHaveLength(2);

    const categoryUpdate = {
      ...imported.find((item) => item.id === "tx-new")!,
      category: CATEGORIES[0],
    };
    const updatedById = applyImportedTransactionsState(merged, [categoryUpdate], "merge");
    expect(updatedById.transactions.find((item) => item.id === "tx-new")?.category).toBe(CATEGORIES[0]);
  });

  it("syncs real-time financial feed transactions without duplicates", () => {
    const firstSync = syncFinancialFeedState(
      INITIAL_APP_STATE,
      [
        {
          externalId: "card-001",
          postedAt: "2026-06-30T09:20:00+09:00",
          merchant: "테스트 카페",
          amount: -5200,
          accountName: "국민카드",
        },
        {
          externalId: "salary-001",
          postedAt: "2026-06-30",
          merchant: "월급",
          amount: 1200000,
          direction: "credit",
        },
      ],
      "mock-card",
    );

    expect(firstSync.imported).toHaveLength(1);
    expect(firstSync.skipped).toHaveLength(1);
    expect(firstSync.state.transactions).toHaveLength(1);
    expect(firstSync.state.transactions[0]).toMatchObject({
      id: "tx-feed-mock-card-card-001",
      date: "2026-06-30",
      merchant: "테스트 카페",
      amount: 5200,
    });
    expect(firstSync.state.calendarMonth).toBe("2026-06");
    expect(firstSync.state.selectedDate).toBe("2026-06-30");

    const secondSync = syncFinancialFeedState(
      firstSync.state,
      [
        {
          externalId: "card-001",
          postedAt: "2026-06-30T09:20:00+09:00",
          merchant: "테스트 카페",
          amount: -6200,
          accountName: "국민카드",
        },
        {
          externalId: "card-002",
          postedAt: "2026-07-01T11:00:00+09:00",
          merchant: "테스트 편의점",
          amount: 4300,
          direction: "debit",
          category: "생활",
        },
      ],
      "mock-card",
    );

    expect(secondSync.state.transactions).toHaveLength(2);
    expect(secondSync.state.transactions.find((item) => item.id === "tx-feed-mock-card-card-001")?.amount).toBe(6200);
    expect(secondSync.state.transactions.find((item) => item.id === "tx-feed-mock-card-card-002")?.category).toBe("생활");
    expect(secondSync.state.calendarMonth).toBe("2026-07");
    expect(secondSync.state.selectedDate).toBe("2026-07-01");
  });
});
