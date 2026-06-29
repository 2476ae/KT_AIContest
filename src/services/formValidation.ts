import type { Goal } from "../types";

export interface TransactionDraft {
  amount: string;
  date: string;
  merchant: string;
  memo?: string;
}

export interface GoalValidationResult {
  errors: string[];
  warnings: string[];
}

export function parseMoneyInput(value: string) {
  const normalized = value.replace(/[^\d]/g, "");
  return normalized ? Number(normalized) : 0;
}

export function formatMoneyInput(value: string | number) {
  const amount = typeof value === "number" ? value : parseMoneyInput(value);
  return amount > 0 ? amount.toLocaleString("ko-KR") : "";
}

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateTransactionDraft(draft: TransactionDraft) {
  const errors: string[] = [];
  const amount = parseMoneyInput(draft.amount);
  const merchant = draft.merchant.trim();
  const memo = draft.memo?.trim() ?? "";

  if (amount <= 0) {
    errors.push("금액은 0원보다 크게 입력해주세요.");
  }

  if (amount > 99999999) {
    errors.push("금액은 99,999,999원 이하로 입력해주세요.");
  }

  if (!merchant) {
    errors.push("사용처를 입력해주세요.");
  }

  if (merchant.length > 40) {
    errors.push("사용처는 40자 이하로 입력해주세요.");
  }

  if (!draft.date) {
    errors.push("날짜를 선택해주세요.");
  } else if (!isValidIsoDate(draft.date)) {
    errors.push("날짜는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.");
  }

  if (memo.length > 80) {
    errors.push("메모는 80자 이하로 입력해주세요.");
  }

  return errors;
}

export function validateGoal(goal: Goal): GoalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (goal.monthlyIncome <= 0) {
    errors.push("월 수입은 0원보다 커야 합니다.");
  }

  if (goal.spendingLimit <= 0) {
    errors.push("목표 소비액은 0원보다 커야 합니다.");
  }

  if (goal.savingGoal < 0) {
    errors.push("목표 저축액은 0원 이상이어야 합니다.");
  }

  if (goal.subscriptionLimit < 0) {
    errors.push("구독 지출 상한은 0원 이상이어야 합니다.");
  }

  if (goal.monthlyIncome > 0 && goal.spendingLimit > goal.monthlyIncome) {
    warnings.push("목표 소비액이 월 수입보다 큽니다. 제출 데모에서는 저장할 수 있지만 현실성이 낮아집니다.");
  }

  if (goal.monthlyIncome - goal.spendingLimit < goal.savingGoal) {
    warnings.push("목표 저축액이 수입과 소비 목표 대비 빡빡합니다.");
  }

  return {
    errors,
    warnings,
  };
}
