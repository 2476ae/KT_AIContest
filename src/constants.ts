import type { Category, Goal } from "./types";

export const CATEGORIES: Category[] = [
  "식비",
  "카페/간식",
  "교통",
  "쇼핑",
  "여가",
  "구독",
  "교육",
  "의료",
  "생활",
  "기타",
];

export const DEFAULT_GOAL: Goal = {
  monthlyIncome: 1200000,
  spendingLimit: 720000,
  savingGoal: 200000,
  subscriptionLimit: 65000,
  focusCategories: ["카페/간식", "식비", "구독"],
};

export const DEMO_MONTH = {
  year: 2026,
  month: 5,
  label: "2026년 6월",
  id: "2026-06",
  storageKey: "money-routine-calendar:v2",
  legacyStorageKeys: ["money-routine-calendar:v1"],
};
