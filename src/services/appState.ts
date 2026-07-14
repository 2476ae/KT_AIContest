import { CATEGORIES, DEFAULT_GOAL } from "../constants";
import type { AppState, Category, Goal, PaymentType, TabId, Transaction } from "../types";
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
export const APP_STATE_STORAGE_VERSION = 2;
const PAYMENT_TYPES: PaymentType[] = ["card", "transport", "cash", "transfer"];

interface StoredAppStateEnvelope {
  version: number;
  state: AppState;
}

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

function isValidStoredDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return formatDate(parsed) === value;
}

function normalizeStoredTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const transactions = value.flatMap<Transaction>((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return [];
    }

    const item = candidate as Partial<Transaction>;
    if (
      typeof item.id !== "string" ||
      !item.id.trim() ||
      !isValidStoredDate(item.date) ||
      typeof item.merchant !== "string" ||
      !item.merchant.trim() ||
      !Number.isFinite(item.amount) ||
      Number(item.amount) <= 0 ||
      !CATEGORIES.includes(item.category as Category) ||
      !PAYMENT_TYPES.includes(item.paymentType as PaymentType)
    ) {
      return [];
    }

    return [{
      id: item.id.slice(0, 120),
      date: item.date,
      merchant: item.merchant.trim().slice(0, 120),
      amount: Math.round(Number(item.amount)),
      memo: typeof item.memo === "string" ? item.memo.slice(0, 240) : "",
      paymentType: item.paymentType as PaymentType,
      category: item.category as Category,
      isSubscription: Boolean(item.isSubscription),
      classificationReason: typeof item.classificationReason === "string" ? item.classificationReason.slice(0, 240) : undefined,
    }];
  });

  return keepLatestTransactions(transactions);
}

function normalizeStoredGoal(value: unknown): Goal {
  if (!value || typeof value !== "object") {
    return DEFAULT_GOAL;
  }

  const candidate = value as Partial<Goal>;
  const positiveNumber = (amount: unknown, fallback: number) =>
    Number.isFinite(Number(amount)) && Number(amount) >= 0 ? Math.round(Number(amount)) : fallback;
  const focusCategories = Array.isArray(candidate.focusCategories)
    ? Array.from(new Set(candidate.focusCategories.filter((category): category is Category => CATEGORIES.includes(category as Category)))).slice(0, 5)
    : DEFAULT_GOAL.focusCategories;

  return {
    monthlyIncome: positiveNumber(candidate.monthlyIncome, DEFAULT_GOAL.monthlyIncome),
    spendingLimit: positiveNumber(candidate.spendingLimit, DEFAULT_GOAL.spendingLimit),
    savingGoal: positiveNumber(candidate.savingGoal, DEFAULT_GOAL.savingGoal),
    subscriptionLimit: positiveNumber(candidate.subscriptionLimit, DEFAULT_GOAL.subscriptionLimit),
    focusCategories,
  };
}

export function mergeStoredState(stored: unknown, referenceDate = new Date()): AppState {
  const initialState = createInitialAppState(referenceDate);

  if (!stored || typeof stored !== "object") {
    return initialState;
  }

  const storedState = stored as Partial<AppState>;
  const transactions = normalizeStoredTransactions(storedState.transactions);

  return {
    ...initialState,
    transactions,
    goal: normalizeStoredGoal(storedState.goal),
    hasLoadedSample: Boolean(storedState.hasLoadedSample) || transactions.length > 0,
  };
}

export function restoreStoredState(stored: unknown, referenceDate = new Date()): AppState {
  if (stored && typeof stored === "object" && "version" in stored && "state" in stored) {
    return mergeStoredState((stored as Partial<StoredAppStateEnvelope>).state, referenceDate);
  }

  return mergeStoredState(stored, referenceDate);
}

export function serializeAppState(state: AppState) {
  const envelope: StoredAppStateEnvelope = {
    version: APP_STATE_STORAGE_VERSION,
    state,
  };

  return JSON.stringify(envelope);
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
