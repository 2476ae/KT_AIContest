import type { Goal, Summary } from "../types";

function roundUpToTenThousand(value: number) {
  return Math.ceil(value / 10000) * 10000;
}

export function createAutomaticGoalAdjustment(goal: Goal, summary: Summary): Goal {
  if (summary.totalSpent <= goal.spendingLimit) {
    return goal;
  }

  const rawLimit = Math.max(summary.totalSpent, summary.adjustedSpendingLimit);
  const canStayWithinIncome = goal.monthlyIncome > summary.totalSpent;
  const roundedLimit = roundUpToTenThousand(rawLimit);
  const spendingLimit = canStayWithinIncome
    ? Math.max(summary.totalSpent, Math.min(goal.monthlyIncome, roundedLimit))
    : summary.totalSpent;
  const possibleSaving = Math.max(0, goal.monthlyIncome - spendingLimit);

  return {
    ...goal,
    spendingLimit,
    savingGoal: Math.min(goal.savingGoal, possibleSaving),
  };
}
