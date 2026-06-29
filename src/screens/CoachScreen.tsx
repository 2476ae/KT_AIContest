import { AlertTriangle, CheckCircle2, ClipboardList, WalletCards } from "lucide-react";
import { MissionList } from "../components/MissionList";
import { formatWon } from "../services/analytics";
import type { BudgetStatus } from "../types";
import type { MoneyRoutineViewModel } from "./screenTypes";

function statusCopy(status: BudgetStatus) {
  if (status === "over") {
    return "초과";
  }
  if (status === "watch") {
    return "점검";
  }
  return "안정";
}

export function CoachScreen({ computed }: MoneyRoutineViewModel) {
  const { categorySummaries, coachReport, subscriptionCandidates } = computed;

  return (
    <>
      <section className="screen-head">
        <span className="eyebrow">목표 코치</span>
        <h1>오늘의 조정</h1>
      </section>

      <section className={`coach-hero card is-${coachReport.status}`}>
        <span className="coach-status">{statusCopy(coachReport.status)}</span>
        <h2>{coachReport.headline}</h2>
        <p>{coachReport.todayAction}</p>
        <strong>{formatWon(coachReport.dailyBudget)}</strong>
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
    </>
  );
}
