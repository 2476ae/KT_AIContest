import { DEFAULT_GOAL, DEMO_MONTH } from "../constants";
import type { AppState, Goal, TabId, Transaction } from "../types";
import { parseTransactionsCsvWithValidation } from "./csv";
import { addMonths, firstDateOfMonth, getMonthId } from "./date";

export const INITIAL_APP_STATE: AppState = {
  transactions: [],
  goal: DEFAULT_GOAL,
  calendarMonth: DEMO_MONTH.id,
  selectedDate: "2026-06-29",
  activeTab: "home",
  hasLoadedSample: false,
};

export function mergeStoredState(stored: unknown): AppState {
  if (!stored || typeof stored !== "object") {
    return INITIAL_APP_STATE;
  }

  return {
    ...INITIAL_APP_STATE,
    ...stored,
  };
}

export function loadSampleState(current: AppState, transactions: Transaction[]): AppState {
  return {
    ...current,
    transactions,
    calendarMonth: DEMO_MONTH.id,
    selectedDate: "2026-06-29",
    hasLoadedSample: true,
  };
}

export function setActiveTabState(current: AppState, activeTab: TabId): AppState {
  return {
    ...current,
    activeTab,
  };
}

export function setSelectedDateState(current: AppState, selectedDate: string): AppState {
  return {
    ...current,
    calendarMonth: getMonthId(selectedDate),
    selectedDate,
  };
}

export function updateGoalState(current: AppState, goal: Goal): AppState {
  return {
    ...current,
    goal,
  };
}

export function resetGoalState(current: AppState): AppState {
  return {
    ...current,
    goal: DEFAULT_GOAL,
  };
}

export function moveCalendarMonthState(current: AppState, amount: number): AppState {
  const calendarMonth = addMonths(current.calendarMonth, amount);
  return {
    ...current,
    calendarMonth,
    selectedDate: firstDateOfMonth(calendarMonth),
  };
}

export function addTransactionState(current: AppState, transaction: Omit<Transaction, "id">, id: string): AppState {
  return {
    ...current,
    transactions: [
      {
        ...transaction,
        id,
      },
      ...current.transactions,
    ].sort((a, b) => a.date.localeCompare(b.date)),
    calendarMonth: getMonthId(transaction.date),
    selectedDate: transaction.date,
    hasLoadedSample: true,
  };
}

export function updateTransactionState(current: AppState, transaction: Transaction): AppState {
  return {
    ...current,
    transactions: current.transactions.map((item) => (item.id === transaction.id ? transaction : item)),
  };
}

export function deleteTransactionState(current: AppState, id: string): AppState {
  return {
    ...current,
    transactions: current.transactions.filter((transaction) => transaction.id !== id),
  };
}

export function parseImportCsv(csvText: string): Transaction[] {
  const result = parseTransactionsCsvWithValidation(csvText);
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]);
  }

  const imported = result.transactions;
  if (imported.length === 0) {
    throw new Error("반영할 거래가 없습니다.");
  }

  return imported;
}

export function applyImportedTransactionsState(
  current: AppState,
  imported: Transaction[],
  mode: "replace" | "merge" = "replace",
): AppState {
  return {
    ...current,
    transactions:
      mode === "merge"
        ? [...current.transactions.filter((item) => !imported.some((incoming) => incoming.id === item.id)), ...imported].sort((a, b) =>
            a.date.localeCompare(b.date),
          )
        : imported,
    calendarMonth: imported[imported.length - 1]?.date ? getMonthId(imported[imported.length - 1].date) : current.calendarMonth,
    selectedDate: imported[imported.length - 1]?.date ?? current.selectedDate,
    hasLoadedSample: imported.length > 0,
  };
}

export function importCsvState(
  current: AppState,
  csvText: string,
  mode: "replace" | "merge" = "replace",
): { state: AppState; imported: Transaction[] } {
  const imported = parseImportCsv(csvText);

  return {
    imported,
    state: applyImportedTransactionsState(current, imported, mode),
  };
}
