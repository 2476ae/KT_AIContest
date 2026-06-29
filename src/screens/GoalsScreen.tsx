import { RotateCcw, Save, Target, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, DEFAULT_GOAL } from "../constants";
import { formatWon, getSummary } from "../services/analytics";
import { validateGoal } from "../services/formValidation";
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

function hasSameGoal(left: Goal, right: Goal) {
  return (
    left.monthlyIncome === right.monthlyIncome &&
    left.spendingLimit === right.spendingLimit &&
    left.savingGoal === right.savingGoal &&
    left.subscriptionLimit === right.subscriptionLimit &&
    left.focusCategories.length === right.focusCategories.length &&
    left.focusCategories.every((category, index) => category === right.focusCategories[index])
  );
}

export function GoalsScreen({ actions, computed, state }: MoneyRoutineViewModel) {
  const { coachReport } = computed;
  const [draftGoal, setDraftGoal] = useState<Goal>(state.goal);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [goalMessage, setGoalMessage] = useState("");

  useEffect(() => {
    setDraftGoal(state.goal);
  }, [state.goal]);

  const validation = useMemo(() => validateGoal(draftGoal), [draftGoal]);
  const draftSummary = useMemo(
    () => getSummary(computed.monthTransactions, draftGoal, state.calendarMonth),
    [computed.monthTransactions, draftGoal, state.calendarMonth],
  );
  const isDraftOverBudget = draftSummary.remainingBudget < 0;
  const draftGuideAmountLabel = isDraftOverBudget ? "조정 한도 초과" : draftSummary.isAdjusted ? "현실 조정 한도" : "오늘 권장 한도";
  const draftGuideAmount = isDraftOverBudget ? Math.abs(draftSummary.remainingBudget) : draftSummary.dailyBudget;
  const isDirty = !hasSameGoal(draftGoal, state.goal);
  const visibleErrors = saveAttempted ? validation.errors : [];

  function toggleFocus(category: Category) {
    const exists = draftGoal.focusCategories.includes(category);
    const focusCategories = exists
      ? draftGoal.focusCategories.filter((item) => item !== category)
      : [...draftGoal.focusCategories, category];

    setDraftGoal({
      ...draftGoal,
      focusCategories,
    });
    setGoalMessage("");
  }

  function saveGoal() {
    setSaveAttempted(true);
    if (validation.errors.length > 0) {
      setGoalMessage("");
      return;
    }

    actions.updateGoal(draftGoal);
    setGoalMessage("목표를 저장했어요. 홈, 캘린더, 코치 화면이 같은 기준으로 다시 계산됩니다.");
    setSaveAttempted(false);
  }

  function discardGoal() {
    setDraftGoal(state.goal);
    setGoalMessage("저장 전 변경을 되돌렸어요.");
    setSaveAttempted(false);
  }

  function resetGoal() {
    actions.resetGoal();
    setGoalMessage("기본 목표로 초기화했어요.");
    setSaveAttempted(false);
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
          <strong>{isDirty ? "저장 전 미리보기" : coachReport.savingPossibility === "높음" ? "달성 가능성이 좋아요" : "목표를 보며 조정해요"}</strong>
          <small>{isDirty ? "아래 수치는 아직 저장되지 않은 목표 기준입니다." : coachReport.headline}</small>
        </span>
      </section>

      <section className="settings-form card">
        <label>
          <span>월 수입</span>
          <input
            value={formatNumberInput(draftGoal.monthlyIncome)}
            onChange={(event) => {
              setDraftGoal(updateNumber(draftGoal, "monthlyIncome", event.target.value));
              setGoalMessage("");
            }}
            inputMode="numeric"
            data-testid="goal-income-input"
          />
        </label>
        <label>
          <span>목표 소비액</span>
          <input
            value={formatNumberInput(draftGoal.spendingLimit)}
            onChange={(event) => {
              setDraftGoal(updateNumber(draftGoal, "spendingLimit", event.target.value));
              setGoalMessage("");
            }}
            inputMode="numeric"
            data-testid="goal-spending-limit-input"
          />
        </label>
        <label>
          <span>목표 저축액</span>
          <input
            value={formatNumberInput(draftGoal.savingGoal)}
            onChange={(event) => {
              setDraftGoal(updateNumber(draftGoal, "savingGoal", event.target.value));
              setGoalMessage("");
            }}
            inputMode="numeric"
            data-testid="goal-saving-input"
          />
        </label>
        <label>
          <span>구독 지출 상한</span>
          <input
            value={formatNumberInput(draftGoal.subscriptionLimit)}
            onChange={(event) => {
              setDraftGoal(updateNumber(draftGoal, "subscriptionLimit", event.target.value));
              setGoalMessage("");
            }}
            inputMode="numeric"
            data-testid="goal-subscription-limit-input"
          />
        </label>
        {visibleErrors.length > 0 && (
          <div className="field-error">
            {visibleErrors.map((error) => (
              <span key={error}>{error}</span>
            ))}
          </div>
        )}
        {validation.warnings.length > 0 && visibleErrors.length === 0 && (
          <div className="goal-feedback is-watch">{validation.warnings[0]}</div>
        )}
        {validation.warnings.length === 0 && visibleErrors.length === 0 && (
          <div className="goal-feedback">저장하면 모든 화면이 이 목표 기준으로 다시 계산됩니다.</div>
        )}
        {goalMessage && <div className="success-line">{goalMessage}</div>}
        <div className="form-actions">
          <button
            className="primary-button"
            type="button"
            onClick={saveGoal}
            disabled={!isDirty && validation.errors.length === 0}
            data-testid="goal-save-button"
          >
            <Save size={18} />
            목표 저장
          </button>
          <button className="secondary-button" type="button" onClick={discardGoal} disabled={!isDirty} data-testid="goal-discard-button">
            <Undo2 size={16} />
            되돌리기
          </button>
          <button className="secondary-button" type="button" onClick={resetGoal} data-testid="goal-reset-button">
            <RotateCcw size={16} />
            기본값
          </button>
        </div>
      </section>

      <div className="section-title">
        <h2>집중 관리 항목</h2>
        <span>{draftGoal.focusCategories.length}개 선택</span>
      </div>
      <section className="category-pills">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            className={`category-pill${draftGoal.focusCategories.includes(category) ? " is-active" : ""}`}
            type="button"
            onClick={() => toggleFocus(category)}
          >
            {category}
          </button>
        ))}
      </section>

      <section className="preview-grid">
        <article className={`preview-card card${isDraftOverBudget ? " is-over" : ""}`}>
          <span>{draftGuideAmountLabel}</span>
          <strong>{formatWon(draftGuideAmount)}</strong>
        </article>
        <article className="preview-card card">
          <span>목표 진행률</span>
          <strong>{Math.round(draftSummary.progress)}%</strong>
        </article>
        <article className="preview-card card">
          <span>{draftSummary.isAdjusted ? "조정 저축 목표" : "저축 예상"}</span>
          <strong>{formatWon(draftSummary.isAdjusted ? draftSummary.adjustedSavingGoal : draftSummary.savingProjection)}</strong>
        </article>
        <article className="preview-card card">
          <span>구독 지출</span>
          <strong>{formatWon(draftSummary.subscriptionTotal)}</strong>
        </article>
      </section>
    </>
  );
}
