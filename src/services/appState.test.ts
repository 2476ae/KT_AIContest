import { describe, expect, it } from "vitest";
import { CATEGORIES, DEFAULT_GOAL, DEMO_MONTH } from "../constants";
import { loadSampleTransactions } from "../data";
import type { Transaction } from "../types";
import { getSummary } from "./analytics";
import {
  addTransactionState,
  applyImportedTransactionsState,
  deleteTransactionState,
  importCsvState,
  INITIAL_APP_STATE,
  loadSampleState,
  mergeStoredState,
  moveCalendarMonthState,
  parseImportCsv,
  resetGoalState,
  setActiveTabState,
  setSelectedDateState,
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
  it("creates and restores the initial demo state", () => {
    expect(INITIAL_APP_STATE).toMatchObject({
      activeTab: "home",
      calendarMonth: DEMO_MONTH.id,
      hasLoadedSample: false,
      selectedDate: "2026-06-29",
      transactions: [],
    });

    expect(mergeStoredState({ activeTab: "coach", hasLoadedSample: true })).toMatchObject({
      activeTab: "home",
      hasLoadedSample: true,
    });
    expect(mergeStoredState(null)).toBe(INITIAL_APP_STATE);
  });

  it("loads sample transactions into the June demo calendar", () => {
    const state = loadSampleState(INITIAL_APP_STATE, loadSampleTransactions());
    const summary = getSummary(state.transactions, state.goal, state.calendarMonth);

    expect(state.transactions).toHaveLength(35);
    expect(state.calendarMonth).toBe(DEMO_MONTH.id);
    expect(state.selectedDate).toBe("2026-06-29");
    expect(state.hasLoadedSample).toBe(true);
    expect(summary.totalSpent).toBe(397790);
    expect(summary.subscriptionTotal).toBe(63690);
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
  });
});
