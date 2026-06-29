import { useCallback, useMemo, useState } from "react";
import { DEFAULT_GOAL, DEMO_MONTH } from "../constants";
import { loadSampleTransactions } from "../data";
import { getCalendarDays, getCategorySummaries, getSummary, getSubscriptionCandidates } from "../services/analytics";
import { createCoachReportResponse } from "../services/aiAdapter";
import { addMonths, firstDateOfMonth, getMonthId } from "../services/date";
import { parseTransactionsCsvWithValidation, transactionsToCsv } from "../services/csv";
import type { AppState, Goal, TabId, Transaction } from "../types";

const initialState: AppState = {
  transactions: [],
  goal: DEFAULT_GOAL,
  calendarMonth: DEMO_MONTH.id,
  selectedDate: "2026-06-29",
  activeTab: "home",
  hasLoadedSample: false,
};

function readStoredState(): AppState {
  const stored = window.localStorage.getItem(DEMO_MONTH.storageKey);
  if (!stored) {
    return initialState;
  }

  try {
    return {
      ...initialState,
      ...JSON.parse(stored),
    };
  } catch {
    return initialState;
  }
}

function persistState(state: AppState) {
  window.localStorage.setItem(DEMO_MONTH.storageKey, JSON.stringify(state));
}

export function useMoneyRoutine() {
  const [state, setState] = useState<AppState>(() => readStoredState());

  const updateState = useCallback((updater: (current: AppState) => AppState) => {
    setState((current) => {
      const next = updater(current);
      persistState(next);
      return next;
    });
  }, []);

  const loadSample = useCallback(() => {
    updateState((current) => ({
      ...current,
      transactions: loadSampleTransactions(),
      calendarMonth: DEMO_MONTH.id,
      selectedDate: "2026-06-29",
      hasLoadedSample: true,
    }));
  }, [updateState]);

  const resetAll = useCallback(() => {
    window.localStorage.removeItem(DEMO_MONTH.storageKey);
    setState(initialState);
  }, []);

  const setActiveTab = useCallback(
    (activeTab: TabId) => {
      updateState((current) => ({
        ...current,
        activeTab,
      }));
    },
    [updateState],
  );

  const setSelectedDate = useCallback(
    (selectedDate: string) => {
      updateState((current) => ({
        ...current,
        calendarMonth: getMonthId(selectedDate),
        selectedDate,
      }));
    },
    [updateState],
  );

  const updateGoal = useCallback(
    (goal: Goal) => {
      updateState((current) => ({
        ...current,
        goal,
      }));
    },
    [updateState],
  );

  const resetGoal = useCallback(() => {
    updateState((current) => ({
      ...current,
      goal: DEFAULT_GOAL,
    }));
  }, [updateState]);

  const moveCalendarMonth = useCallback(
    (amount: number) => {
      updateState((current) => {
        const calendarMonth = addMonths(current.calendarMonth, amount);
        return {
          ...current,
          calendarMonth,
          selectedDate: firstDateOfMonth(calendarMonth),
        };
      });
    },
    [updateState],
  );

  const addTransaction = useCallback(
    (transaction: Omit<Transaction, "id">) => {
      updateState((current) => ({
        ...current,
        transactions: [
          {
            ...transaction,
            id: `tx-user-${Date.now()}`,
          },
          ...current.transactions,
        ].sort((a, b) => a.date.localeCompare(b.date)),
        calendarMonth: getMonthId(transaction.date),
        selectedDate: transaction.date,
        hasLoadedSample: true,
      }));
    },
    [updateState],
  );

  const updateTransaction = useCallback(
    (transaction: Transaction) => {
      updateState((current) => ({
        ...current,
        transactions: current.transactions.map((item) => (item.id === transaction.id ? transaction : item)),
      }));
    },
    [updateState],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      updateState((current) => ({
        ...current,
        transactions: current.transactions.filter((transaction) => transaction.id !== id),
      }));
    },
    [updateState],
  );

  const importCsv = useCallback(
    (csvText: string, mode: "replace" | "merge" = "replace") => {
      const result = parseTransactionsCsvWithValidation(csvText);
      if (result.errors.length > 0) {
        throw new Error(result.errors[0]);
      }

      const imported = result.transactions;
      if (imported.length === 0) {
        throw new Error("반영할 거래가 없습니다.");
      }

      updateState((current) => ({
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
      }));
      return imported;
    },
    [updateState],
  );

  const exportCsv = useCallback(() => transactionsToCsv(state.transactions), [state.transactions]);

  const computed = useMemo(() => {
    const monthTransactions = state.transactions.filter((transaction) => getMonthId(transaction.date) === state.calendarMonth);
    const summary = getSummary(monthTransactions, state.goal, state.calendarMonth);
    const calendarDays = getCalendarDays(monthTransactions, state.goal, state.calendarMonth);
    const categorySummaries = getCategorySummaries(monthTransactions);
    const subscriptionCandidates = getSubscriptionCandidates(monthTransactions);
    const coachResponse = createCoachReportResponse({ transactions: monthTransactions, goal: state.goal, monthId: state.calendarMonth });
    const coachReport = coachResponse.data;
    const selectedDay = calendarDays.find((day) => day.date === state.selectedDate) ?? calendarDays.find((day) => day.isCurrentMonth);
    const recentTransactions = [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

    return {
      summary,
      monthTransactions,
      calendarDays,
      selectedDay,
      categorySummaries,
      subscriptionCandidates,
      coachResponse,
      coachReport,
      recentTransactions,
    };
  }, [state.calendarMonth, state.goal, state.selectedDate, state.transactions]);

  return {
    state,
    computed,
    actions: {
      addTransaction,
      deleteTransaction,
      exportCsv,
      importCsv,
      loadSample,
      moveCalendarMonth,
      resetAll,
      resetGoal,
      setActiveTab,
      setSelectedDate,
      updateGoal,
      updateTransaction,
    },
  };
}
