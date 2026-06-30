export type TabId = "home" | "calendar" | "add" | "goals" | "coach" | "settings";

export type Category =
  | "식비"
  | "카페/간식"
  | "교통"
  | "쇼핑"
  | "여가"
  | "구독"
  | "교육"
  | "의료"
  | "생활"
  | "기타";

export type PaymentType = "card" | "transport" | "cash" | "transfer";

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  memo: string;
  paymentType: PaymentType;
  category: Category;
  isSubscription: boolean;
  classificationReason?: string;
}

export interface Goal {
  monthlyIncome: number;
  spendingLimit: number;
  savingGoal: number;
  subscriptionLimit: number;
  focusCategories: Category[];
}

export type BudgetStatus = "stable" | "watch" | "over";
export type DayStatus = "empty" | "safe" | "subscription" | "over";

export interface DaySummary {
  date: string;
  day: number;
  amount: number;
  status: DayStatus;
  isCurrentMonth: boolean;
  transactions: Transaction[];
}

export interface CategorySummary {
  category: Category;
  amount: number;
  ratio: number;
  status: BudgetStatus;
}

export interface SubscriptionCandidate {
  merchant: string;
  monthlyAmount: number;
  paymentDay: number;
  recommendation: "유지" | "점검" | "해지 검토";
  reason: string;
}

export interface CoachMission {
  id: string;
  title: string;
  reason: string;
  expectedSaving: number;
  impactLabel?: string;
  impactText?: string;
  action: string;
  completed: boolean;
}

export interface CategoryPlan {
  category: Category;
  status: BudgetStatus;
  currentAmount: number;
  plannedAmount: number;
  expectedSaving: number;
  previousRatio?: number;
  currentRatio?: number;
  guideRatio?: number;
  reason: string;
  action: string;
}

export interface CoachBasisItem {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: BudgetStatus | "primary";
}

export interface CoachReport {
  headline: string;
  status: BudgetStatus;
  dailyBudget: number;
  savingPossibility: "높음" | "보통" | "낮음";
  todayAction: string;
  insights: string[];
  categoryPlans: CategoryPlan[];
  missions: CoachMission[];
  subscriptionAdvice: string[];
  basis: string;
  basisItems: CoachBasisItem[];
}

export interface Summary {
  totalSpent: number;
  progress: number;
  remainingBudget: number;
  daysLeft: number;
  dailyBudget: number;
  savingProjection: number;
  subscriptionTotal: number;
  status: BudgetStatus;
  isAdjusted: boolean;
  adjustedSpendingLimit: number;
  adjustedSavingGoal: number;
  originalRemainingBudget: number;
  originalDailyBudget: number;
}

export interface AppState {
  transactions: Transaction[];
  goal: Goal;
  calendarMonth: string;
  selectedDate: string;
  activeTab: TabId;
  hasLoadedSample: boolean;
}
