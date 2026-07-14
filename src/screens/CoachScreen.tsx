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

function planStatusCopy(status: BudgetStatus) {
  if (status === "over") {
    return "월 가이드 초과";
  }
  if (status === "watch") {
    return "비중 상승 확인";
  }
  return "계획 범위";
}

export function CoachScreen({ actions, computed }: MoneyRoutineViewModel) {
  const { coachReport, coachResponse, subscriptionCandidates, summary } = computed;
  const isOverBudget = summary.remainingBudget < 0;
  const guideAmountLabel = isOverBudget ? "조정 필요 금액" : summary.isAdjusted ? "조정 한도" : "오늘 한도";
  const guideAmount = isOverBudget ? Math.abs(summary.remainingBudget) : coachReport.dailyBudget;
  const guideHint = isOverBudget
    ? "필수 지출 위주"
    : summary.isAdjusted
      ? "조정 목표 반영"
      : `남은 ${summary.daysLeft}일 기준`;
  const formattedGuideAmount = formatWon(guideAmount);
  const shouldShowBudgetCallout = !(guideAmountLabel === "오늘 한도" && coachReport.headline.includes(formattedGuideAmount));
  const isAiLoading = coachResponse.status === "loading";
  const isAiFallback = coachResponse.status === "fallback" || coachResponse.status === "error";
  const isExternalComplete = coachResponse.status === "ready" && coachResponse.provider.mode === "external";
  const attentionSubscriptions = subscriptionCandidates.filter((item) => item.recommendation !== "유지").slice(0, 2);
  const aiStatusCopy = {
    cached: "저장된 AI 분석",
    error: "기본 분석으로 전환",
    fallback: "기본 분석으로 전환",
    loading: "응답 대기",
    ready:
      coachResponse.provider.mode === "external"
        ? "OpenAI 분석 완료"
        : "기본 분석 표시",
  }[coachResponse.status];
  const aiStatusDetail =
    coachResponse.status === "fallback" || coachResponse.status === "error"
      ? coachResponse.error
        ? coachResponse.error.includes("8초") || coachResponse.error.includes("timed out") || coachResponse.error.includes("504")
          ? "응답이 늦어 기본 분석을 표시했어요. 잠시 후 다시 눌러 재시도할 수 있어요."
          : "연결에 실패해 기본 분석을 표시했어요. 잠시 후 다시 눌러 재시도할 수 있어요."
        : "기본 분석은 앱이 목표와 소비 내역으로 직접 계산한 결과예요."
      : coachResponse.status === "loading"
        ? "최대 8초 안에 완료하거나 기본 분석으로 돌아옵니다."
        : coachResponse.status === "cached"
          ? "거래와 목표가 같아 마지막 OpenAI 결과를 다시 보여드려요."
        : coachResponse.provider.mode === "external"
          ? "OpenAI가 기본 계산을 참고해 분야별 계획과 문장을 보완했어요."
          : "기본 분석은 목표와 소비 내역을 앱 안에서 계산하며, OpenAI는 문장만 보완해요.";

  return (
    <>
      <section className="screen-head screen-head-with-action">
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
            <strong>AI 분석을 불러오는 중이에요</strong>
            <small>8초 안에 응답이 없으면 기본 분석으로 돌아갑니다.</small>
          </div>
        )}

        <div className="coach-analysis-content">
          <section className={`coach-hero card is-${coachReport.status}`} data-tutorial="coach-overview">
            <span className="coach-status">{statusCopy(coachReport.status)}</span>
            <h2>{coachReport.headline}</h2>
            <p>{coachReport.todayAction}</p>
            {shouldShowBudgetCallout && (
              <div className={`coach-budget-callout${isOverBudget ? " is-over" : ""}`}>
                <span>{guideAmountLabel}</span>
                <strong>{formattedGuideAmount}</strong>
                <small>{guideHint}</small>
              </div>
            )}
          </section>

          <section className={`ai-state-card card is-${coachResponse.status}`}>
            <span className="ai-state-icon">
              <Bot size={19} />
            </span>
            <span className="ai-state-copy">
              <strong>{isAiLoading ? "AI 요청" : "AI 상태"}</strong>
              <small>{aiStatusCopy}</small>
              <small className="ai-state-detail" data-testid="coach-ai-detail">{aiStatusDetail}</small>
            </span>
            <div className="ai-state-actions">
              <button
                className="ai-refresh-button"
                type="button"
                onClick={actions.requestCoachReport}
                disabled={isAiLoading || isExternalComplete || coachResponse.status === "cached"}
                data-testid="coach-request-ai-button"
                data-tutorial="coach-ai-update"
              >
                {isAiLoading ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
                {isAiLoading
                  ? "업데이트 중"
                  : isExternalComplete
                    ? "분석 완료"
                    : coachResponse.status === "cached"
                      ? "저장된 분석"
                      : isAiFallback
                        ? "다시 시도"
                        : "AI 분석 업데이트"}
              </button>
              {isAiFallback && (
                <button className="ai-default-button" type="button" onClick={actions.useDefaultCoachReport} data-testid="coach-use-default-button">
                  기본 분석 유지
                </button>
              )}
            </div>
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
                        <span>{planStatusCopy(plan.status)}</span>
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
