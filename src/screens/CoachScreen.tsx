import { AlertTriangle, Bot, CheckCircle2, ClipboardList, Loader2, RefreshCw, Target, WalletCards } from "lucide-react";
import { MissionList } from "../components/MissionList";
import { formatWon } from "../services/analytics";
import type { BudgetStatus } from "../types";
import type { MoneyRoutineViewModel } from "./screenTypes";

function statusCopy(status: BudgetStatus) {
  if (status === "over") {
    return "초과 주의";
  }
  if (status === "watch") {
    return "조정 필요";
  }
  return "안정";
}

export function CoachScreen({ actions, computed }: MoneyRoutineViewModel) {
  const { coachReport, coachResponse, subscriptionCandidates, summary } = computed;
  const isOverBudget = summary.remainingBudget < 0;
  const guideAmountLabel = isOverBudget ? "초과 금액" : summary.isAdjusted ? "현실 한도" : "오늘 한도";
  const guideAmount = isOverBudget ? Math.abs(summary.remainingBudget) : coachReport.dailyBudget;
  const guideHint = isOverBudget
    ? "필수 지출만"
    : summary.isAdjusted
      ? "조정 목표 반영"
      : `남은 ${summary.daysLeft}일 기준`;
  const isAiLoading = coachResponse.status === "loading";
  const attentionSubscriptions = subscriptionCandidates.filter((item) => item.recommendation !== "유지").slice(0, 2);
  const aiStatusCopy = {
    error: "로컬 분석으로 대체",
    fallback: "로컬 분석으로 대체",
    loading: "분석 중",
    ready:
      coachResponse.provider.mode === "external"
        ? `${coachResponse.provider.label} 연결됨`
        : "로컬 미리보기",
  }[coachResponse.status];

  return (
    <>
      <section className="screen-head">
        <div>
          <span className="eyebrow">AI 코치</span>
          <h1>오늘의 소비 가이드</h1>
        </div>
        <button className="screen-head-action" type="button" onClick={() => actions.setActiveTab("goals")} data-testid="coach-edit-goal">
          <Target size={16} />
          목표 수정
        </button>
      </section>

      <section className={`coach-analysis-shell${isAiLoading ? " is-loading" : ""}`} aria-busy={isAiLoading}>
        {isAiLoading && (
          <div className="coach-loading-overlay" role="status" aria-live="polite">
            <span className="coach-loading-icon">
              <Loader2 className="spin-icon" size={21} />
            </span>
            <strong>AI 분석 중</strong>
            <small>결과가 도착하면 자동 반영됩니다.</small>
          </div>
        )}

        <div className="coach-analysis-content">
          <section className={`coach-hero card is-${coachReport.status}`}>
            <span className="coach-status">{statusCopy(coachReport.status)}</span>
            <h2>{coachReport.headline}</h2>
            <p>{coachReport.todayAction}</p>
            <div className={`coach-budget-callout${isOverBudget ? " is-over" : ""}`}>
              <span>{guideAmountLabel}</span>
              <strong>{formatWon(guideAmount)}</strong>
              <small>{guideHint}</small>
            </div>
          </section>

          <section className={`ai-state-card card is-${coachResponse.status}`}>
            <span className="ai-state-icon">
              <Bot size={19} />
            </span>
            <span className="ai-state-copy">
              <strong>AI 상태</strong>
              <small>{aiStatusCopy}</small>
              {coachResponse.error && <small>{coachResponse.error}</small>}
            </span>
            <button
              className="ai-refresh-button"
              type="button"
              onClick={actions.requestCoachReport}
              disabled={isAiLoading}
              data-testid="coach-request-ai-button"
            >
              {isAiLoading ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
              {isAiLoading ? "분석 중" : "OpenAI 분석 업데이트"}
            </button>
          </section>

          <div className="section-title">
            <h2>이번 주 미션</h2>
            <span>7일 안에 실행</span>
          </div>
          <MissionList missions={coachReport.missions} />

          <section className="coach-section card">
            <div className="coach-section-head">
              <ClipboardList size={19} />
              <strong>분야별 소비 계획</strong>
            </div>
            <div className="category-plan-grid">
              {coachReport.categoryPlans.length === 0 ? (
                <div className="empty-line">소비 데이터가 들어오면 분야별 계획을 제안합니다.</div>
              ) : (
                coachReport.categoryPlans.map((plan) => {
                  const planDelta = plan.plannedAmount - plan.currentAmount;
                  const meterValue = plan.plannedAmount > 0 ? Math.min(100, Math.round((plan.currentAmount / plan.plannedAmount) * 100)) : 0;
                  const deltaLabel = planDelta >= 0 ? "남은 여유" : "초과분";
                  const hasPattern = typeof plan.previousRatio === "number" && typeof plan.currentRatio === "number" && typeof plan.guideRatio === "number";

                  return (
                    <article className={`category-plan-card is-${plan.status}`} key={plan.category}>
                      <div className="category-plan-head">
                        <strong>{plan.category}</strong>
                        <span>{statusCopy(plan.status)}</span>
                      </div>
                      {hasPattern && (
                        <div className="category-plan-trend" aria-label={`${plan.category} 지난달 ${Math.round(plan.previousRatio ?? 0)}%, 이번달 ${Math.round(plan.currentRatio ?? 0)}%, 가이드 ${Math.round(plan.guideRatio ?? 0)}%`}>
                          <span>지난달 {Math.round(plan.previousRatio ?? 0)}%</span>
                          <span>이번달 {Math.round(plan.currentRatio ?? 0)}%</span>
                          <span>가이드 {Math.round(plan.guideRatio ?? 0)}%</span>
                        </div>
                      )}
                      <div className={`category-plan-meter${planDelta < 0 ? " is-over" : ""}`} aria-label={`${plan.category} 월 가이드 대비 현재 ${meterValue}%`}>
                        <span style={{ width: `${meterValue}%` }} />
                      </div>
                      <div className="category-plan-amounts">
                        <span>
                          <small>현재</small>
                          <strong>{formatWon(plan.currentAmount)}</strong>
                        </span>
                        <span>
                          <small>월 가이드</small>
                          <strong>{formatWon(plan.plannedAmount)}</strong>
                        </span>
                        <span>
                          <small>{deltaLabel}</small>
                          <strong>{formatWon(Math.abs(planDelta))}</strong>
                        </span>
                      </div>
                      <em>{plan.action}</em>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="coach-section card">
            <div className="coach-section-head">
              <WalletCards size={19} />
              <strong>정기 결제 점검</strong>
            </div>
            <div className="subscription-list">
              {subscriptionCandidates.length === 0 ? (
                <div className="empty-line">구독 후보가 없습니다.</div>
              ) : attentionSubscriptions.length === 0 ? (
                <div className="empty-line">정기 결제는 현재 상한 안에서 안정적입니다.</div>
              ) : (
                attentionSubscriptions.map((item) => (
                  <article className="subscription-row" key={item.merchant}>
                    <span>
                      <strong>{item.merchant}</strong>
                      <small>{item.paymentDay}일 결제 · {item.reason}</small>
                    </span>
                    <span className="subscription-side">
                      <strong>{formatWon(item.monthlyAmount)}</strong>
                      <small>{item.recommendation}</small>
                    </span>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="coach-section card">
            <div className="coach-section-head">
              {coachReport.status === "stable" ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
              <strong>분석 기준</strong>
            </div>
            <div className="basis-grid">
              {coachReport.basisItems.map((item) => (
                <article className={`basis-card is-${item.tone}`} key={item.id}>
                  <span>{item.title}</span>
                  <strong>{item.value}</strong>
                  <small>{item.detail}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
