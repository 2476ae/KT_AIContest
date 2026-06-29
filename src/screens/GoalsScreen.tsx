import { Target } from "lucide-react";
import { CATEGORIES } from "../constants";
import { formatWon } from "../services/analytics";
import type { Category, Goal } from "../types";
import type { MoneyRoutineViewModel } from "./screenTypes";

function parseNumberInput(value: string) {
  return Number(value.replace(/[^\d]/g, "")) || 0;
}

function formatNumberInput(value: number) {
  return value.toLocaleString("ko-KR");
}

function updateNumber(goal: Goal, key: keyof Pick<Goal, "monthlyIncome" | "savingGoal" | "spendingLimit" | "subscriptionLimit">, value: string): Goal {
  return {
    ...goal,
    [key]: parseNumberInput(value),
  };
}

export function GoalsScreen({ actions, computed, state }: MoneyRoutineViewModel) {
  const { coachReport, summary } = computed;
  const isAggressiveGoal = state.goal.monthlyIncome - state.goal.spendingLimit < state.goal.savingGoal;

  function toggleFocus(category: Category) {
    const exists = state.goal.focusCategories.includes(category);
    const focusCategories = exists
      ? state.goal.focusCategories.filter((item) => item !== category)
      : [...state.goal.focusCategories, category];

    actions.updateGoal({
      ...state.goal,
      focusCategories,
    });
  }

  return (
    <>
      <section className="screen-head">
        <span className="eyebrow">목표 기준</span>
        <h1>목표 설정</h1>
      </section>

      <section className="goal-summary card">
        <span className="summary-icon">
          <Target size={20} />
        </span>
        <span>
          <strong>{coachReport.savingPossibility === "높음" ? "달성 가능성이 좋아요" : "목표를 보며 조정해요"}</strong>
          <small>{coachReport.headline}</small>
        </span>
      </section>

      <section className="settings-form card">
        <label>
          <span>월 수입</span>
          <input
            value={formatNumberInput(state.goal.monthlyIncome)}
            onChange={(event) => actions.updateGoal(updateNumber(state.goal, "monthlyIncome", event.target.value))}
            inputMode="numeric"
          />
        </label>
        <label>
          <span>목표 소비액</span>
          <input
            value={formatNumberInput(state.goal.spendingLimit)}
            onChange={(event) => actions.updateGoal(updateNumber(state.goal, "spendingLimit", event.target.value))}
            inputMode="numeric"
          />
        </label>
        <label>
          <span>목표 저축액</span>
          <input
            value={formatNumberInput(state.goal.savingGoal)}
            onChange={(event) => actions.updateGoal(updateNumber(state.goal, "savingGoal", event.target.value))}
            inputMode="numeric"
          />
        </label>
        <label>
          <span>구독 지출 상한</span>
          <input
            value={formatNumberInput(state.goal.subscriptionLimit)}
            onChange={(event) => actions.updateGoal(updateNumber(state.goal, "subscriptionLimit", event.target.value))}
            inputMode="numeric"
          />
        </label>
        <div className={`goal-feedback${isAggressiveGoal ? " is-watch" : ""}`}>
          {isAggressiveGoal
            ? "목표 저축액이 현재 수입/소비 목표 대비 빡빡해요. 소비 목표를 조금 낮추거나 저축 목표를 나눠보세요."
            : "목표를 바꾸면 홈, 캘린더, 코치 화면이 같은 기준으로 다시 계산됩니다."}
        </div>
      </section>

      <div className="section-title">
        <h2>집중 관리 항목</h2>
        <span>{state.goal.focusCategories.length}개 선택</span>
      </div>
      <section className="category-pills">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            className={`category-pill${state.goal.focusCategories.includes(category) ? " is-active" : ""}`}
            type="button"
            onClick={() => toggleFocus(category)}
          >
            {category}
          </button>
        ))}
      </section>

      <section className="preview-grid">
        <article className="preview-card card">
          <span>오늘 가능예산</span>
          <strong>{formatWon(summary.dailyBudget)}</strong>
        </article>
        <article className="preview-card card">
          <span>목표 진행률</span>
          <strong>{Math.round(summary.progress)}%</strong>
        </article>
        <article className="preview-card card">
          <span>저축 예상</span>
          <strong>{formatWon(summary.savingProjection)}</strong>
        </article>
        <article className="preview-card card">
          <span>구독 지출</span>
          <strong>{formatWon(summary.subscriptionTotal)}</strong>
        </article>
      </section>
    </>
  );
}
