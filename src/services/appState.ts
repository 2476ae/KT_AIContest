import { DEFAULT_GOAL } from "../constants";
import type { AppState, Goal, TabId, Transaction } from "../types";
import { parseTransactionsCsvWithValidation } from "./csv";
import { addMonths, firstDateOfMonth, formatDate, getMonthId } from "./date";
import { normalizeFinancialFeedTransactions, type FinancialFeedTransactionInput } from "./financialFeed";

export function createInitialAppState(referenceDate = new Date()): AppState {
  const selectedDate = formatDate(referenceDate);

  return {
    transactions: [],
    goal: DEFAULT_GOAL,
    calendarMonth: getMonthId(selectedDate),
    selectedDate,
    activeTab: "home",
    hasLoadedSample: false,
  };
}

export const INITIAL_APP_STATE: AppState = createInitialAppState();

const MAX_STORED_TRANSACTIONS = 1200;

function sortTransactionsByDate(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => a.date.localeCompare(b.date));
}

function keepLatestTransactions(transactions: Transaction[]) {
  const sorted = sortTransactionsByDate(transactions);

  if (sorted.length <= MAX_STORED_TRANSACTIONS) {
    return sorted;
  }

  return sorted.slice(sorted.length - MAX_STORED_TRANSACTIONS);
}

export function mergeStoredState(stored: unknown, referenceDate = new Date()): AppState {
  const initialState = createInitialAppState(referenceDate);

  if (!stored || typeof stored !== "object") {
    return initialState;
  }

  const { activeTab: _storedActiveTab, ...storedState } = stored as Partial<AppState>;

  return {
    ...initialState,
    ...storedState,
    calendarMonth: initialState.calendarMonth,
    selectedDate: initialState.selectedDate,
    activeTab: "home",
  };
}

export function loadSampleState(current: AppState, transactions: Transaction[], referenceDate = new Date()): AppState {
  const selectedDate = formatDate(referenceDate);

  return {
    ...current,
    transactions,
    calendarMonth: getMonthId(selectedDate),
    selectedDate,
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

export function rollCurrentDateState(current: AppState, previousDate: string, currentDate: string): AppState {
  if (current.calendarMonth !== getMonthId(previousDate)) {
    return current;
  }

  return {
    ...current,
    calendarMonth: getMonthId(currentDate),
    selectedDate: currentDate,
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

function mergeTransactions(current: Transaction[], incoming: Transaction[]) {
  const mergedById = new Map<string, Transaction>();

  current.forEach((transaction) => {
    mergedById.set(transaction.id, transaction);
  });

  incoming.forEach((transaction) => {
    mergedById.set(transaction.id, transaction);
  });

  return keepLatestTransactions([...mergedById.values()]);
}

export function applyFinancialFeedTransactionsState(
  current: AppState,
  incoming: Transaction[],
): AppState {
  if (incoming.length === 0) {
    return current;
  }

  const latest = [...incoming].sort((a, b) => b.date.localeCompare(a.date))[0];

  return {
    ...current,
    transactions: mergeTransactions(current.transactions, incoming),
    calendarMonth: getMonthId(latest.date),
    selectedDate: latest.date,
    hasLoadedSample: true,
  };
}

export function syncFinancialFeedState(
  current: AppState,
  inputs: FinancialFeedTransactionInput[],
  source = "financial-feed",
) {
  const result = normalizeFinancialFeedTransactions(inputs, source);

  return {
    imported: result.transactions,
    skipped: result.skipped,
    state: applyFinancialFeedTransactionsState(current, result.transactions),
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
