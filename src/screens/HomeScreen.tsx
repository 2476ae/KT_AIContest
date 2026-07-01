import { CalendarClock, FileUp, Plus, Target, WalletCards } from "lucide-react";
import { CalendarGrid } from "../components/CalendarGrid";
import { MissionList } from "../components/MissionList";
import { TransactionList } from "../components/TransactionList";
import { formatWon } from "../services/analytics";
import { formatMonthLabel } from "../services/date";
import { getTransactionUsageCopy } from "../services/transactionCopy";
import type { MoneyRoutineViewModel } from "./screenTypes";

export function HomeScreen({ actions, computed, state }: MoneyRoutineViewModel) {
  const { coachReport, recentTransactions, selectedDay, summary } = computed;
  const hasData = state.transactions.length > 0;
  const progress = Math.min(100, Math.round(summary.progress));
  const isOverBudget = summary.remainingBudget < 0;
  const guideAmountLabel = isOverBudget ? "조정 한도 초과" : summary.isAdjusted ? "현실 조정 한도" : "오늘 권장 한도";
  const guideAmount = isOverBudget ? Math.abs(summary.remainingBudget) : summary.dailyBudget;
  const savingLabel = summary.isAdjusted ? "월수입 기준 저축" : "저축 예상";
  const savingAmount = summary.isAdjusted ? summary.adjustedSavingGoal : summary.savingProjection;
  const goalChipLabel = summary.isAdjusted ? "현실 목표" : "월 목표";
  const goalChipAmount = summary.isAdjusted ? summary.adjustedSpendingLimit : state.goal.spendingLimit;
  const remainingFlowLabel = isOverBudget ? "조정 한도 초과" : summary.isAdjusted ? "현실 조정 여력" : "남은 한도";
  const remainingFlowAmount = isOverBudget ? Math.abs(summary.remainingBudget) : summary.remainingBudget;
  const remainingFlowText = isOverBudget
    ? "필수 지출 위주"
    : summary.isAdjusted
      ? "현실 목표 반영"
      : "여유 있음";
  const subscriptionPressure = state.goal.subscriptionLimit > 0 ? summary.subscriptionTotal / state.goal.subscriptionLimit : 0;
  const subscriptionSpendingRatio = state.goal.spendingLimit > 0 ? summary.subscriptionTotal / state.goal.spendingLimit : 0;
  const subscriptionCardText =
    summary.subscriptionTotal === 0
      ? "아직 없음"
      : subscriptionPressure >= 1 && subscriptionSpendingRatio >= 0.12
        ? "점검 필요"
        : subscriptionPressure >= 0.85 && subscriptionSpendingRatio >= 0.12
          ? "가볍게 점검"
          : "안정적";
  const selectedTransaction = selectedDay?.transactions[0];
  const selectedDayCopy = selectedTransaction
    ? getTransactionUsageCopy(selectedTransaction)
    : "선택한 날짜의 소비 상태를 확인할 수 있어요.";

  return (
    <>
      <section className="hero-card card">
        <div className="hero-head">
          <div>
            <div className="eyebrow">
              {formatMonthLabel(state.calendarMonth)} · 남은 {summary.daysLeft}일
            </div>
            <h1 className="hero-amount">{hasData ? formatWon(summary.totalSpent) : "0원"}</h1>
          </div>
          <button className="goal-chip" type="button" onClick={() => actions.setActiveTab("goals")} data-testid="home-goal-chip">
            {goalChipLabel} {formatWon(goalChipAmount)}
          </button>
        </div>

        {!hasData ? (
          <div className="empty-hero">
            <strong>샘플 소비로 바로 보기</strong>
            <p>금융 인증 없이 예시 데이터로 체험할 수 있어요.</p>
            <button className="primary-button" type="button" onClick={actions.loadSample} data-testid="home-load-sample">
              <WalletCards size={18} />
              샘플 데이터 불러오기
            </button>
          </div>
        ) : (
          <>
            <div className="progress-block" aria-label={`이번 달 소비 진행률 ${progress}%`}>
              <div className="progress-label">
                <span>이번 달 소비 진행률</span>
                <span>{progress}%</span>
              </div>
              <div className="progress-track">
                <span className={`progress-value is-${summary.status}`} style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
            </div>

            <div className="metric-grid">
              <div className={`metric-tile${isOverBudget ? " is-over" : ""}`}>
                <span className="metric-label">{guideAmountLabel}</span>
                <span className="metric-value">{formatWon(guideAmount)}</span>
              </div>
              <div className="metric-tile">
                <span className="metric-label">{savingLabel}</span>
                <span className="metric-value">{formatWon(savingAmount)}</span>
              </div>
              <div className="metric-tile">
                <span className="metric-label">고정 구독비</span>
                <span className="metric-value">{formatWon(summary.subscriptionTotal)}</span>
              </div>
            </div>

            <div className="coach-strip">
              <span className="coach-icon">
                <CalendarClock size={17} />
              </span>
              <span>
                <strong className="coach-title">오늘 가이드</strong>
                <span className="coach-text">{coachReport.todayAction}</span>
              </span>
            </div>
          </>
        )}
      </section>

      <section className="quick-action-grid" aria-label="빠른 실행">
        <button className="quick-action" type="button" onClick={() => actions.setActiveTab("add")} data-testid="quick-add-transaction">
          <span className="quick-action-icon">
            <Plus size={18} />
          </span>
          <span className="quick-action-label">내역 추가</span>
        </button>
        <button className="quick-action" type="button" onClick={() => actions.setActiveTab("add")} data-testid="quick-connect-file">
          <span className="quick-action-icon">
            <FileUp size={18} />
          </span>
          <span className="quick-action-label">파일 연결</span>
        </button>
        <button className="quick-action" type="button" onClick={() => actions.setActiveTab("goals")} data-testid="quick-edit-goal">
          <span className="quick-action-icon">
            <Target size={18} />
          </span>
          <span className="quick-action-label">목표 수정</span>
        </button>
        <button className="quick-action" type="button" onClick={() => actions.setActiveTab("coach")} data-testid="quick-open-coach">
          <span className="quick-action-icon">
            <CalendarClock size={18} />
          </span>
          <span className="quick-action-label">AI 코치</span>
        </button>
      </section>

      <div className="section-title">
        <h2>{formatMonthLabel(state.calendarMonth)} 소비 캘린더</h2>
        <span>선택일 {selectedDay?.day ?? 1}일</span>
      </div>

      <section className="calendar-card card">
        <div className="calendar-head">
          <h3 className="calendar-title">월간 소비달력</h3>
          <div className="legend">
            <span className="legend-item"><span className="legend-dot is-safe" />적정</span>
            <span className="legend-item"><span className="legend-dot is-subscription" />정기 결제</span>
            <span className="legend-item"><span className="legend-dot is-over" />초과</span>
          </div>
        </div>
        <CalendarGrid days={computed.calendarDays} selectedDate={state.selectedDate} onSelectDate={actions.setSelectedDate} />
        <div className="selected-day-note">
          <span>
            <strong>{selectedDay?.amount ? `${selectedDay.day}일 소비 ${formatWon(selectedDay.amount)}` : `${selectedDay?.day ?? ""}일은 지출이 없어요`}</strong>
            <span>{selectedDayCopy}</span>
          </span>
          <strong className="selected-day-amount">{selectedDay?.amount ? `-${formatWon(selectedDay.amount)}` : "0원"}</strong>
        </div>
      </section>

      <div className="section-title">
        <h2>이번 주 조정 미션</h2>
        <span>{summary.isAdjusted ? "조정 후 예상 저축" : "목표 저축"} {formatWon(summary.isAdjusted ? summary.adjustedSavingGoal : state.goal.savingGoal)}</span>
      </div>
      <MissionList missions={coachReport.missions} compact />

      <section className="mini-card-grid">
        <article className="mini-card card">
          <span className="mini-card-title">구독 지출</span>
          <strong className="mini-card-value">{formatWon(summary.subscriptionTotal)}</strong>
          <p className="mini-card-text">{subscriptionCardText}</p>
        </article>
        <article className={`mini-card card${isOverBudget ? " is-over" : ""}`}>
          <span className="mini-card-title">{remainingFlowLabel}</span>
          <strong className="mini-card-value">{formatWon(remainingFlowAmount)}</strong>
          <p className="mini-card-text">{remainingFlowText}</p>
        </article>
      </section>

      <div className="section-title">
        <h2>최근 소비</h2>
        <button className="text-button" type="button" onClick={() => actions.setActiveTab("calendar")} data-testid="home-view-all-transactions">
          전체 보기
        </button>
      </div>
      <TransactionList transactions={recentTransactions.slice(0, 3)} showDate emptyText="샘플 데이터를 불러오면 최근 소비가 표시됩니다." />
    </>
  );
}
