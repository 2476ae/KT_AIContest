import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarGrid } from "../components/CalendarGrid";
import { TransactionList } from "../components/TransactionList";
import { CATEGORIES } from "../constants";
import { formatWon, getTopCategory } from "../services/analytics";
import { formatMonthLabel } from "../services/date";
import type { DayStatus } from "../types";
import type { MoneyRoutineViewModel } from "./screenTypes";

type CalendarFilter = "all" | "over" | "subscription" | "safe";

const filters: Array<{ id: CalendarFilter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "over", label: "초과" },
  { id: "subscription", label: "정기 결제" },
  { id: "safe", label: "적정" },
];

export function CalendarScreen({ actions, computed, state }: MoneyRoutineViewModel) {
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const { calendarDays, selectedDay } = computed;
  const counts = calendarDays.reduce<Record<DayStatus, number>>(
    (record, day) => {
      if (day.isCurrentMonth) {
        record[day.status] += 1;
      }
      return record;
    },
    { empty: 0, over: 0, safe: 0, subscription: 0 },
  );
  const selectedTop = selectedDay ? getTopCategory(selectedDay.transactions) : undefined;

  return (
    <>
      <section className="screen-head">
        <span className="eyebrow">{formatMonthLabel(state.calendarMonth)}</span>
        <h1>소비 캘린더</h1>
      </section>

      <section className="month-switcher card" aria-label="월 이동">
        <button type="button" onClick={() => actions.moveCalendarMonth(-1)} aria-label="이전 달" data-testid="calendar-prev-month">
          <ChevronLeft size={18} />
        </button>
        <strong>{formatMonthLabel(state.calendarMonth)}</strong>
        <button type="button" onClick={() => actions.moveCalendarMonth(1)} aria-label="다음 달" data-testid="calendar-next-month">
          <ChevronRight size={18} />
        </button>
      </section>

      <section className="status-grid">
        <article className="status-card">
          <span>안정일</span>
          <strong>{counts.safe}일</strong>
        </article>
        <article className="status-card">
          <span>과소비일</span>
          <strong>{counts.over}일</strong>
        </article>
        <article className="status-card">
          <span>정기 결제일</span>
          <strong>{counts.subscription}일</strong>
        </article>
      </section>

      <section className="filter-row" aria-label="캘린더 필터">
        {filters.map((item) => (
          <button
            key={item.id}
            className={`filter-chip${filter === item.id ? " is-active" : ""}`}
            type="button"
            onClick={() => setFilter(item.id)}
            data-testid={`calendar-filter-${item.id}`}
          >
            {item.label}
          </button>
        ))}
      </section>

      <section className="calendar-card card">
        <CalendarGrid days={calendarDays} selectedDate={state.selectedDate} onSelectDate={actions.setSelectedDate} filter={filter} />
      </section>

      <section className="detail-panel card">
        <div className="detail-head">
          <span>
            <strong>{selectedDay?.date}</strong>
            <span>{selectedTop ?? "적정"} 흐름</span>
          </span>
          <strong className="detail-amount">{selectedDay?.amount ? `-${formatWon(selectedDay.amount)}` : "0원"}</strong>
        </div>
        <p className="detail-copy">
          {selectedDay?.amount
            ? `${selectedDay.day}일은 ${selectedTop ?? "선택 소비"} 중심의 지출이 있었어요.`
            : "지출이 없는 날은 월말 예산에 작은 여유를 남깁니다."}
        </p>
        <TransactionList
          transactions={selectedDay?.transactions ?? []}
          categories={CATEGORIES}
          onCategoryChange={(transaction, category) => actions.updateTransaction({ ...transaction, category })}
          onDelete={actions.deleteTransaction}
          emptyText="선택한 날짜에 거래가 없습니다."
        />
      </section>
    </>
  );
}
