import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_MONTH } from "../constants";
import { isSampleTransactionId, loadCurrentSampleTransactions } from "../data";
import { alignCoachReportBudgetFields, getCalendarDays, getCategorySummaries, getSummary, getSubscriptionCandidates, toDate } from "../services/analytics";
import {
  applyFinancialFeedTransactionsState,
  applyImportedTransactionsState,
  addTransactionState,
  createInitialAppState,
  deleteTransactionState,
  INITIAL_APP_STATE,
  loadSampleState,
  restoreStoredState,
  moveCalendarMonthState,
  parseImportCsv,
  resetGoalState,
  rollCurrentDateState,
  serializeAppState,
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
import { addMonths, formatDate, getMonthId } from "../services/date";
import { createAutomaticGoalAdjustment } from "../services/budgetAdjustment";
import { normalizeFinancialFeedTransactions, type FinancialFeedTransactionInput } from "../services/financialFeed";
import type { AppState, CoachReport, Goal, TabId, Transaction } from "../types";

interface FinancialFeedEventDetail {
  source?: string;
  transaction?: FinancialFeedTransactionInput;
  transactions?: FinancialFeedTransactionInput[];
}

function alignStoredSampleTransactions(state: AppState, referenceDate: Date) {
  if (!state.transactions.some((transaction) => isSampleTransactionId(transaction.id))) {
    return state;
  }

  const userTransactions = state.transactions.filter((transaction) => !isSampleTransactionId(transaction.id));
  const sampleTransactions = loadCurrentSampleTransactions(referenceDate);

  return {
    ...state,
    transactions: [...userTransactions, ...sampleTransactions].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function readStoredState(): AppState {
  const referenceDate = new Date();

  try {
    const stored = window.localStorage.getItem(DEMO_MONTH.storageKey)
      ?? DEMO_MONTH.legacyStorageKeys.map((key) => window.localStorage.getItem(key)).find(Boolean);
    if (!stored) {
      return createInitialAppState(referenceDate);
    }

    return alignStoredSampleTransactions(restoreStoredState(JSON.parse(stored), referenceDate), referenceDate);
  } catch {
    return createInitialAppState(referenceDate);
  }
}

function persistState(state: AppState) {
  try {
    window.localStorage.setItem(DEMO_MONTH.storageKey, serializeAppState(state));
    DEMO_MONTH.legacyStorageKeys.forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    console.warn("머니루틴 상태를 브라우저 저장소에 저장하지 못했습니다.", error);
  }
}

export function useMoneyRoutine() {
  const [state, setState] = useState<AppState>(() => readStoredState());
  const [today, setToday] = useState(() => formatDate(new Date()));
  const previousToday = useRef(today);
  const coachResponseCache = useRef(new Map<string, AiResponse<CoachReport>>());
  const coachRequestsInFlight = useRef(new Map<string, Promise<AiResponse<CoachReport>>>());
  const [coachResponse, setCoachResponse] = useState(() =>
    createCoachReportPreviewResponse({
      transactions: [],
      goal: INITIAL_APP_STATE.goal,
      monthId: INITIAL_APP_STATE.calendarMonth,
    }),
  );
  const [coachRequestKey, setCoachRequestKey] = useState<string | null>(null);
  const [coachRequestAttempt, setCoachRequestAttempt] = useState(0);

  const updateState = useCallback((updater: (current: AppState) => AppState) => {
    setState((current) => {
      const next = updater(current);
      persistState(next);
      return next;
    });
  }, []);

  const loadSample = useCallback(() => {
    const referenceDate = toDate(today);
    updateState((current) => loadSampleState(current, loadCurrentSampleTransactions(referenceDate), referenceDate));
  }, [today, updateState]);

  const resetAll = useCallback(() => {
    try {
      window.localStorage.removeItem(DEMO_MONTH.storageKey);
      DEMO_MONTH.legacyStorageKeys.forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
      console.warn("머니루틴 저장 상태를 삭제하지 못했습니다.", error);
    }

    setState(createInitialAppState(toDate(today)));
  }, [today]);

  useEffect(() => {
    function refreshToday() {
      setToday((current) => {
        const next = formatDate(new Date());
        return current === next ? current : next;
      });
    }

    const intervalId = window.setInterval(refreshToday, 60_000);
    document.addEventListener("visibilitychange", refreshToday);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshToday);
    };
  }, []);

  useEffect(() => {
    const previousDate = previousToday.current;
    if (previousDate === today) {
      return;
    }

    const referenceDate = toDate(today);
    setState((current) => {
      const aligned = alignStoredSampleTransactions(current, referenceDate);
      const next = rollCurrentDateState(aligned, previousDate, today);

      persistState(next);
      return next;
    });
    previousToday.current = today;
  }, [today]);

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

  const applyAutomaticGoalAdjustment = useCallback(() => {
    updateState((current) => {
      const monthTransactions = current.transactions.filter((transaction) => getMonthId(transaction.date) === current.calendarMonth);
      const summary = getSummary(monthTransactions, current.goal, current.calendarMonth, toDate(today));
      return updateGoalState(current, createAutomaticGoalAdjustment(current.goal, summary));
    });
  }, [today, updateState]);

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

  const syncFinancialFeed = useCallback((transactions: FinancialFeedTransactionInput[], source = "financial-feed") => {
    const result = normalizeFinancialFeedTransactions(transactions, source);
    setState((current) => {
      const next = applyFinancialFeedTransactionsState(current, result.transactions);
      persistState(next);
      return next;
    });

    return result;
  }, []);

  const exportCsv = useCallback(() => transactionsToCsv(state.transactions), [state.transactions]);

  useEffect(() => {
    function handleFinancialFeedEvent(event: Event) {
      const detail = (event as CustomEvent<FinancialFeedEventDetail>).detail;

      const transactions = Array.isArray(detail?.transactions) ? detail.transactions : detail?.transaction ? [detail.transaction] : [];

      if (transactions.length === 0) {
        return;
      }

      syncFinancialFeed(transactions, detail?.source);
    }

    window.addEventListener("money-routine:financial-transactions", handleFinancialFeedEvent);

    return () => {
      window.removeEventListener("money-routine:financial-transactions", handleFinancialFeedEvent);
    };
  }, [syncFinancialFeed]);

  const baseComputed = useMemo(() => {
    const monthTransactions = state.transactions.filter((transaction) => getMonthId(transaction.date) === state.calendarMonth);
    const previousMonthId = addMonths(state.calendarMonth, -1);
    const previousMonthTransactions = state.transactions.filter((transaction) => getMonthId(transaction.date) === previousMonthId);
    const summary = getSummary(monthTransactions, state.goal, state.calendarMonth, toDate(today));
    const calendarDays = getCalendarDays(monthTransactions, state.goal, state.calendarMonth);
    const categorySummaries = getCategorySummaries(monthTransactions);
    const subscriptionCandidates = getSubscriptionCandidates(monthTransactions, state.goal);
    const selectedDay = calendarDays.find((day) => day.date === state.selectedDate) ?? calendarDays.find((day) => day.isCurrentMonth);
    const recentTransactions = [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    const automaticAdjustedGoal = createAutomaticGoalAdjustment(state.goal, summary);

    return {
      summary,
      monthTransactions,
      previousMonthTransactions,
      calendarDays,
      selectedDay,
      categorySummaries,
      subscriptionCandidates,
      recentTransactions,
      today,
      automaticAdjustedGoal,
    };
  }, [state.calendarMonth, state.goal, state.selectedDate, state.transactions, today]);

  const coachInput: CoachReportInput = useMemo(() => {
    const baseInput: CoachReportInput = {
      transactions: baseComputed.monthTransactions,
      previousMonthTransactions: baseComputed.previousMonthTransactions,
      goal: state.goal,
      monthId: state.calendarMonth,
      currentDate: today,
    };

    return {
      ...baseInput,
      baseReport: createCoachReportPreviewResponse(baseInput).data,
    };
  }, [baseComputed.monthTransactions, baseComputed.previousMonthTransactions, state.calendarMonth, state.goal, today]);

  const coachCacheKey = useMemo(
    () => createCoachReportCacheKey(coachInput, getAiProviderMetadata().id),
    [coachInput],
  );

  const requestCoachReport = useCallback(() => {
    const cachedResponse = coachResponseCache.current.get(coachCacheKey);
    if (cachedResponse?.status === "ready" && cachedResponse.provider.mode === "external") {
      setCoachResponse({ ...cachedResponse, status: "cached" });
      return;
    }
    if (cachedResponse?.status === "fallback" || cachedResponse?.status === "error") {
      coachResponseCache.current.delete(coachCacheKey);
    }
    setCoachResponse((previous) => createCoachReportLoadingResponse(coachInput, previous.data));
    setCoachRequestKey(coachCacheKey);
    setCoachRequestAttempt((current) => current + 1);
  }, [coachCacheKey, coachInput]);

  const useDefaultCoachReport = useCallback(() => {
    coachResponseCache.current.delete(coachCacheKey);
    setCoachRequestKey(null);
    setCoachResponse(createCoachReportPreviewResponse(coachInput));
  }, [coachCacheKey, coachInput]);

  useEffect(() => {
    const cachedResponse = coachResponseCache.current.get(coachCacheKey);
    const isUserRequested = coachRequestKey === coachCacheKey;

    if (!shouldRequestCoachReportAi(state.activeTab, isUserRequested)) {
      setCoachResponse(
        cachedResponse?.status === "ready" && cachedResponse.provider.mode === "external"
          ? { ...cachedResponse, status: "cached" }
          : cachedResponse ?? createCoachReportPreviewResponse(coachInput),
      );
      return;
    }

    if (cachedResponse) {
      setCoachResponse(
        cachedResponse.status === "ready" && cachedResponse.provider.mode === "external"
          ? { ...cachedResponse, status: "cached" }
          : cachedResponse,
      );
      return;
    }

    let isCurrent = true;
    const timeoutId = window.setTimeout(() => {
      let request = coachRequestsInFlight.current.get(coachCacheKey);
      if (!request) {
        request = createCoachReportResponseAsync(coachInput).finally(() => {
          coachRequestsInFlight.current.delete(coachCacheKey);
        });
        coachRequestsInFlight.current.set(coachCacheKey, request);
      }

      void request.then((response) => {
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
  }, [coachCacheKey, coachInput, coachRequestAttempt, coachRequestKey, state.activeTab]);

  const computed = useMemo(
    () => ({
      ...baseComputed,
      coachResponse,
      coachReport: alignCoachReportBudgetFields(
        coachResponse.data,
        baseComputed.monthTransactions,
        state.goal,
        state.calendarMonth,
        baseComputed.previousMonthTransactions,
        toDate(today),
      ),
    }),
    [baseComputed, coachResponse, state.calendarMonth, state.goal, today],
  );

  return {
    state,
    computed,
    actions: {
      addTransaction,
      applyAutomaticGoalAdjustment,
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
      syncFinancialFeed,
      updateGoal,
      updateTransaction,
      useDefaultCoachReport,
    },
  };
}
