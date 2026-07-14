import { AlertTriangle, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatWon } from "../services/analytics";
import { getMonthId } from "../services/date";
import type { MoneyRoutineViewModel } from "../screens/screenTypes";

interface BudgetOverrunDialogProps extends MoneyRoutineViewModel {
  enabled: boolean;
}

export function BudgetOverrunDialog({ actions, computed, enabled, state }: BudgetOverrunDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const skipNextTabCheck = useRef(false);
  const latestShouldOpen = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const autoButtonRef = useRef<HTMLButtonElement>(null);
  const isCurrentMonth = state.calendarMonth === getMonthId(computed.today);
  const isOverGoal = computed.summary.totalSpent > state.goal.spendingLimit;
  const shouldOpen = enabled && isCurrentMonth && isOverGoal;
  const exceededAmount = Math.max(0, computed.summary.totalSpent - state.goal.spendingLimit);

  latestShouldOpen.current = shouldOpen;

  useEffect(() => {
    if (!enabled) {
      setIsOpen(false);
      return;
    }

    if (skipNextTabCheck.current) {
      skipNextTabCheck.current = false;
      return;
    }

    setIsOpen(latestShouldOpen.current);
  }, [computed.today, enabled, state.activeTab]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    autoButtonRef.current?.focus();

    function keepFocusInside(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const buttons = [...dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", keepFocusInside);

    return () => {
      document.removeEventListener("keydown", keepFocusInside);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  function editGoalManually() {
    setIsOpen(false);
    if (state.activeTab !== "goals") {
      skipNextTabCheck.current = true;
      actions.setActiveTab("goals");
    }
  }

  function adjustGoalAutomatically() {
    actions.applyAutomaticGoalAdjustment();
    setIsOpen(false);
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="budget-overrun-backdrop" data-testid="budget-overrun-backdrop">
      <div
        className="budget-overrun-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-overrun-title"
        aria-describedby="budget-overrun-description"
        data-testid="budget-overrun-dialog"
      >
        <span className="budget-overrun-icon" aria-hidden="true">
          <AlertTriangle size={22} />
        </span>
        <h2 id="budget-overrun-title">이번 달 소비 목표를 넘었어요</h2>
        <p id="budget-overrun-description">목표보다 {formatWon(exceededAmount)} 더 사용했어요.</p>
        <div className="budget-overrun-suggestion">
          <span>자동 조정 목표</span>
          <strong>{formatWon(computed.automaticAdjustedGoal.spendingLimit)}</strong>
        </div>
        <div className="budget-overrun-actions">
          <button className="secondary-button" type="button" onClick={editGoalManually} data-testid="budget-overrun-manual">
            <SlidersHorizontal size={17} />
            직접 목표 수정
          </button>
          <button
            className="primary-button"
            type="button"
            ref={autoButtonRef}
            onClick={adjustGoalAutomatically}
            data-testid="budget-overrun-auto"
          >
            <Sparkles size={17} />
            자동으로 재설정
          </button>
        </div>
      </div>
    </div>
  );
}
