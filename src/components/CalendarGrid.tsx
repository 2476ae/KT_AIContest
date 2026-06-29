import { formatShortWon, formatWon, getTopCategory } from "../services/analytics";
import type { DaySummary } from "../types";

interface CalendarGridProps {
  days: DaySummary[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  filter?: "all" | "over" | "subscription" | "safe";
}

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

export function CalendarGrid({ days, selectedDate, onSelectDate, filter = "all" }: CalendarGridProps) {
  const visibleDays = days.map((day) => ({
    ...day,
    isDimmed:
      filter !== "all" &&
      !(
        (filter === "over" && day.status === "over") ||
        (filter === "subscription" && day.status === "subscription") ||
        (filter === "safe" && (day.status === "safe" || day.amount === 0))
      ),
  }));

  return (
    <>
      <div className="weekdays" aria-hidden="true">
        {weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {visibleDays.map((day) => {
          const topCategory = getTopCategory(day.transactions);
          const label =
            day.transactions.find((transaction) => transaction.isSubscription)?.merchant.slice(0, 3) ??
            (day.amount > 0 ? formatShortWon(day.amount) : "0원");

          return (
            <button
              key={day.date}
              className={[
                "calendar-day",
                `is-${day.status}`,
                !day.isCurrentMonth ? "is-muted" : "",
                day.date === selectedDate ? "is-selected" : "",
                day.isDimmed ? "is-dimmed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              onClick={() => onSelectDate(day.date)}
              aria-pressed={day.date === selectedDate}
              aria-label={`${day.date} ${formatWon(day.amount)} ${topCategory ?? ""}`}
              data-testid={`calendar-day-${day.date}`}
            >
              <span className="calendar-day-number">{day.day}</span>
              <span className="calendar-day-meta">{day.isCurrentMonth ? label : ""}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
