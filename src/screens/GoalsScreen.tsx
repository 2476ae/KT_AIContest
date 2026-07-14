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
  const currentGoalValidation = useMemo(() => validateGoal(state.goal), [state.goal]);
  const draftSummary = useMemo(
    () => getSummary(computed.monthTransactions, draftGoal, state.calendarMonth),
    [computed.monthTransactions, draftGoal, state.calendarMonth],
  );
  const isDraftOverBudget = draftSummary.remainingBudget < 0;
  const draftGuideAmountLabel = isDraftOverBudget ? "조정 한도 초과" : draftSummary.isAdjusted ? "조정 한도" : "오늘 권장 한도";
  const draftGuideAmount = isDraftOverBudget ? Math.abs(draftSummary.remainingBudget) : draftSummary.dailyBudget;
  const isDirty = !hasSameGoal(draftGoal, state.goal);
  const visibleErrors = saveAttempted ? validation.errors : [];
  const activeGoalWarning = (isDirty ? validation : currentGoalValidation).warnings[0];
  const currentSummary = computed.summary;
  const isCurrentGoalExceeded = currentSummary.totalSpent > state.goal.spendingLimit;
  const goalSummaryTitle = isDirty
    ? activeGoalWarning
      ? "목표 조정이 필요해요"
      : "저장 전 미리보기"
    : activeGoalWarning
      ? "목표 조정이 필요해요"
    : currentSummary.remainingBudget < 0
      ? "소비 목표를 다시 맞추는 중이에요"
      : currentSummary.isAdjusted
        ? "소비 목표는 조정 중이에요"
        : coachReport.savingPossibility === "높음"
          ? "저축 가능성은 좋아요"
          : "목표를 보며 조정해요";
  const goalSummaryDescription = isDirty
    ? activeGoalWarning
      ? "월 수입과 소비·저축 목표의 균형을 다시 확인해주세요."
      : "아래 수치는 아직 저장되지 않은 목표 기준입니다."
    : activeGoalWarning
      ? "월 수입과 소비·저축 목표의 균형을 다시 확인해주세요."
    : currentSummary.remainingBudget < 0
      ? `초과분 ${formatWon(Math.abs(currentSummary.remainingBudget))}을 반영해 한도를 다시 확인해요.`
      : currentSummary.isAdjusted
        ? `조정 한도 ${formatWon(currentSummary.dailyBudget)} 안에서 소비를 이어가요.`
        : coachReport.headline;

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
    setGoalMessage("목표를 저장했어요. 홈과 AI 코치에 바로 반영돼요.");
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
          <strong data-testid="goal-summary-title">{goalSummaryTitle}</strong>
          <small>{goalSummaryDescription}</small>
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
            autoFocus={isCurrentGoalExceeded}
            aria-describedby={isCurrentGoalExceeded ? "goal-overrun-input-guide" : undefined}
            data-testid="goal-spending-limit-input"
          />
          {isCurrentGoalExceeded && (
            <small className="goal-overrun-input-guide" id="goal-overrun-input-guide" data-testid="goal-overrun-input-guide">
              현재 {formatWon(currentSummary.totalSpent)} 사용 · 앞으로 쓸 금액까지 포함해 입력하세요.
            </small>
          )}
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
          <div className="goal-feedback is-watch" data-testid="goal-warning">{validation.warnings[0]}</div>
        )}
        {validation.warnings.length === 0 && visibleErrors.length === 0 && (
          <div className="goal-feedback">저장 후 홈과 AI 코치에 바로 반영돼요.</div>
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
          <span>{draftSummary.isAdjusted ? "월수입 기준 저축" : "저축 예상"}</span>
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
