import { describe, expect, it } from "vitest";
import { formatFullDate, formatMonthShortLabel } from "./date";

describe("date service", () => {
  it("formats the complete local date for the calendar", () => {
    expect(formatFullDate("2026-07-14")).toBe("2026년 7월 14일 화요일");
  });

  it("formats the month chip without a hard-coded year", () => {
    expect(formatMonthShortLabel("2027-01")).toBe("1월");
  });
});
