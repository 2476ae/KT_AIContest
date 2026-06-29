export interface MonthCursor {
  year: number;
  month: number;
}

export function getMonthId(date: string | Date) {
  const value = typeof date === "string" ? date : formatDate(date);
  return value.slice(0, 7);
}

export function parseMonthId(monthId: string): MonthCursor {
  const [year, month] = monthId.split("-").map(Number);
  return {
    year,
    month: month - 1,
  };
}

export function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatMonthLabel(monthId: string) {
  const { year, month } = parseMonthId(monthId);
  return `${year}년 ${month + 1}월`;
}

export function addMonths(monthId: string, amount: number) {
  const { year, month } = parseMonthId(monthId);
  const date = new Date(year, month + amount, 1);
  return getMonthId(date);
}

export function firstDateOfMonth(monthId: string) {
  const { year, month } = parseMonthId(monthId);
  return formatDate(new Date(year, month, 1));
}

export function lastDateOfMonth(monthId: string) {
  const { year, month } = parseMonthId(monthId);
  return formatDate(new Date(year, month + 1, 0));
}
