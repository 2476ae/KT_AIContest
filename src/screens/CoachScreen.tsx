import { AlertTriangle, Bot, CheckCircle2, ClipboardList, Loader2, WalletCards } from "lucide-react";
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

export function CoachScreen({ computed }: MoneyRoutineViewModel) {
  const { categorySummaries, coachReport, coachResponse, subscriptionCandidates, summary } = computed;
  const isOverBudget = summary.remainingBudget < 0;
  const guideAmountLabel = isOverBudget ? "목표 초과 금액" : "오늘 권장 사용 한도";
  const guideAmount = isOverBudget ? Math.abs(summary.remainingBudget) : coachReport.dailyBudget;
  const guideHelpText = isOverBudget
    ? "이미 월 목표를 넘겼어요. 오늘은 필수 지출만 남기고 추가 소비를 멈추는 게 좋아요."
    : "월 목표를 지키기 위해 오늘 안에서 쓰면 좋은 최대 금액";
  const isAiLoading = coachResponse.status === "loading";
  const aiStatusCopy = {
    error: "AI 응답을 표시하지 못했습니다. 안전한 대체 결과를 준비합니다.",
    fallback: "외부 AI 응답 실패 시 로컬 분석으로 대체했습니다.",
    loading: "AI 분석 결과를 불러오는 중입니다.",
    ready: `${coachResponse.provider.label} 결과를 표시하고 있습니다.`,
  }[coachResponse.status];

  return (
    <>
      <section className="screen-head">
        <span className="eyebrow">AI 목표 코치</span>
        <h1>오늘의 소비 가이드</h1>
      </section>

      <section className={`coach-analysis-shell${isAiLoading ? " is-loading" : ""}`} aria-busy={isAiLoading}>
        {isAiLoading && (
          <div className="coach-loading-overlay" role="status" aria-live="polite">
            <span className="coach-loading-icon">
              <Loader2 className="spin-icon" size={21} />
            </span>
            <strong>AI 분석 결과를 불러오는 중입니다...</strong>
            <small>임시 금액과 미션은 잠시 가려둘게요. 최종 분석이 준비될 때까지 기다려주세요.</small>
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
              <small>{guideHelpText}</small>
            </div>
          </section>

          <section className={`ai-state-card card is-${coachResponse.status}`}>
            <span className="ai-state-icon">
              <Bot size={19} />
            </span>
            <span>
              <strong>AI 분석 연결 상태</strong>
              <small>{aiStatusCopy}</small>
              {coachResponse.error && <small>{coachResponse.error}</small>}
            </span>
          </section>

          <div className="section-title">
            <h2>이번 주 미션</h2>
            <span>7일 안에 실행</span>
          </div>
          <MissionList missions={coachReport.missions} />

          <section className="coach-section card">
            <div className="coach-section-head">
              <ClipboardList size={19} />
              <strong>카테고리 코멘트</strong>
            </div>
            <div className="category-bars">
              {categorySummaries.length === 0 ? (
                <div className="empty-line">소비 데이터가 들어오면 카테고리 흐름이 표시됩니다.</div>
              ) : (
                categorySummaries.slice(0, 5).map((item) => (
                  <div className="category-bar" key={item.category}>
                    <span>
                      <strong>{item.category}</strong>
                      <small>{Math.round(item.ratio)}%</small>
                    </span>
                    <div className="bar-track">
                      <span className={`bar-fill is-${item.status}`} style={{ width: `${Math.min(100, item.ratio)}%` }} />
                    </div>
                    <strong>{formatWon(item.amount)}</strong>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="coach-section card">
            <div className="coach-section-head">
              <WalletCards size={19} />
              <strong>구독 점검</strong>
            </div>
            <div className="subscription-list">
              {subscriptionCandidates.length === 0 ? (
                <div className="empty-line">구독 후보가 없습니다.</div>
              ) : (
                subscriptionCandidates.map((item) => (
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
            <p className="basis-copy">{coachReport.basis}</p>
          </section>
        </div>
      </section>
    </>
  );
}
