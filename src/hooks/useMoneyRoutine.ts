import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_MONTH } from "../constants";
import { loadSampleTransactions } from "../data";
import { alignCoachReportBudgetFields, getCalendarDays, getCategorySummaries, getSummary, getSubscriptionCandidates } from "../services/analytics";
import {
  applyImportedTransactionsState,
  addTransactionState,
  deleteTransactionState,
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
} from "../services/appState";
import {
  type AiResponse,
  type CoachReportInput,
  createCoachReportLoadingResponse,
  createCoachReportResponseAsync,
  createCoachReportPreviewResponse,
  getAiProviderMetadata,
} from "../services/aiAdapter";
import { COACH_AI_DEBOUNCE_MS, createCoachReportCacheKey, shouldRequestCoachReportAi } from "../services/aiRequestPolicy";
import { transactionsToCsv } from "../services/csv";
import { getMonthId } from "../services/date";
import type { AppState, CoachReport, Goal, TabId, Transaction } from "../types";

function readStoredState(): AppState {
  const stored = window.localStorage.getItem(DEMO_MONTH.storageKey);
  if (!stored) {
    return INITIAL_APP_STATE;
  }

  try {
    return mergeStoredState(JSON.parse(stored));
  } catch {
    return INITIAL_APP_STATE;
  }
}

function persistState(state: AppState) {
  window.localStorage.setItem(DEMO_MONTH.storageKey, JSON.stringify(state));
}

export function useMoneyRoutine() {
  const [state, setState] = useState<AppState>(() => readStoredState());
  const coachResponseCache = useRef(new Map<string, AiResponse<CoachReport>>());
  const [coachResponse, setCoachResponse] = useState(() =>
    createCoachReportPreviewResponse({
      transactions: [],
      goal: INITIAL_APP_STATE.goal,
      monthId: INITIAL_APP_STATE.calendarMonth,
    }),
  );
  const [coachRequestKey, setCoachRequestKey] = useState<string | null>(null);

  const updateState = useCallback((updater: (current: AppState) => AppState) => {
    setState((current) => {
      const next = updater(current);
      persistState(next);
      return next;
    });
  }, []);

  const loadSample = useCallback(() => {
    updateState((current) => loadSampleState(current, loadSampleTransactions()));
  }, [updateState]);

  const resetAll = useCallback(() => {
    window.localStorage.removeItem(DEMO_MONTH.storageKey);
    setState(INITIAL_APP_STATE);
  }, []);

  const setActiveTab = useCallback(
    (activeTab: TabId) => {
      updateState((current) => setActiveTabState(current, activeTab));
    },
    [updateState],
  );

  const setSelectedDate = useCallback(
    (selectedDate: string) => {
      updateState((current) => setSelectedDateState(current, selectedDate));
    },
    [updateState],
  );

  const updateGoal = useCallback(
    (goal: Goal) => {
      updateState((current) => updateGoalState(current, goal));
    },
    [updateState],
  );

  const resetGoal = useCallback(() => {
    updateState(resetGoalState);
  }, [updateState]);

  const moveCalendarMonth = useCallback(
    (amount: number) => {
      updateState((current) => moveCalendarMonthState(current, amount));
    },
    [updateState],
  );

  const addTransaction = useCallback(
    (transaction: Omit<Transaction, "id">) => {
      updateState((current) => addTransactionState(current, transaction, `tx-user-${Date.now()}`));
    },
    [updateState],
  );

  const updateTransaction = useCallback(
    (transaction: Transaction) => {
      updateState((current) => updateTransactionState(current, transaction));
    },
    [updateState],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      updateState((current) => deleteTransactionState(current, id));
    },
    [updateState],
  );

  const importCsv = useCallback(
    (csvText: string, mode: "replace" | "merge" = "replace") => {
      const imported = parseImportCsv(csvText);
      updateState((current) => applyImportedTransactionsState(current, imported, mode));

      return imported;
    },
    [updateState],
  );

  const exportCsv = useCallback(() => transactionsToCsv(state.transactions), [state.transactions]);

  const baseComputed = useMemo(() => {
    const monthTransactions = state.transactions.filter((transaction) => getMonthId(transaction.date) === state.calendarMonth);
    const summary = getSummary(monthTransactions, state.goal, state.calendarMonth);
    const calendarDays = getCalendarDays(monthTransactions, state.goal, state.calendarMonth);
    const categorySummaries = getCategorySummaries(monthTransactions);
    const subscriptionCandidates = getSubscriptionCandidates(monthTransactions, state.goal);
    const selectedDay = calendarDays.find((day) => day.date === state.selectedDate) ?? calendarDays.find((day) => day.isCurrentMonth);
    const recentTransactions = [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

    return {
      summary,
      monthTransactions,
      calendarDays,
      selectedDay,
      categorySummaries,
      subscriptionCandidates,
      recentTransactions,
    };
  }, [state.calendarMonth, state.goal, state.selectedDate, state.transactions]);

  const coachInput: CoachReportInput = useMemo(
    () => ({
      transactions: baseComputed.monthTransactions,
      goal: state.goal,
      monthId: state.calendarMonth,
    }),
    [baseComputed.monthTransactions, state.calendarMonth, state.goal],
  );

  const coachCacheKey = useMemo(
    () => createCoachReportCacheKey(coachInput, getAiProviderMetadata().id),
    [coachInput],
  );

  const requestCoachReport = useCallback(() => {
    setCoachRequestKey(coachCacheKey);
  }, [coachCacheKey]);

  useEffect(() => {
    const cachedResponse = coachResponseCache.current.get(coachCacheKey);
    const isUserRequested = coachRequestKey === coachCacheKey;

    if (!shouldRequestCoachReportAi(state.activeTab, isUserRequested)) {
      setCoachResponse(cachedResponse ?? createCoachReportPreviewResponse(coachInput));
      return;
    }

    if (cachedResponse) {
      setCoachResponse(cachedResponse);
      return;
    }

    let isCurrent = true;
    const timeoutId = window.setTimeout(() => {
      setCoachResponse((previous) => createCoachReportLoadingResponse(coachInput, previous.data));

      void createCoachReportResponseAsync(coachInput).then((response) => {
        if (!isCurrent) {
          return;
        }

        coachResponseCache.current.set(coachCacheKey, response);
        setCoachResponse(response);
      });
    }, COACH_AI_DEBOUNCE_MS);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [coachCacheKey, coachInput, coachRequestKey, state.activeTab]);

  const computed = useMemo(
    () => ({
      ...baseComputed,
      coachResponse,
      coachReport: alignCoachReportBudgetFields(coachResponse.data, baseComputed.monthTransactions, state.goal, state.calendarMonth),
    }),
    [baseComputed, coachResponse, state.calendarMonth, state.goal],
  );

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
      requestCoachReport,
      resetAll,
      resetGoal,
      setActiveTab,
      setSelectedDate,
      updateGoal,
      updateTransaction,
    },
  };
}
