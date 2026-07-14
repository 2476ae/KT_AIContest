import sampleCsv from "../data/sample_transactions.csv?raw";
import { DEMO_MONTH } from "./constants";
import { parseTransactionsCsv } from "./services/csv";
import { addMonths, formatDate, getMonthId, parseMonthId } from "./services/date";

const sampleTemplate = parseTransactionsCsv(sampleCsv);
const sampleTransactionIds = new Set(sampleTemplate.map((transaction) => transaction.id));

export function loadSampleTransactions() {
  return sampleTemplate.map((transaction) => ({ ...transaction }));
}

function getMonthOffset(monthId: string, baseMonthId: string) {
  const month = parseMonthId(monthId);
  const baseMonth = parseMonthId(baseMonthId);
  return (month.year - baseMonth.year) * 12 + month.month - baseMonth.month;
}

function moveTransactionDate(date: string, targetMonthId: string) {
  const { year, month } = parseMonthId(targetMonthId);
  const day = Number(date.slice(8, 10));
  const lastDay = new Date(year, month + 1, 0).getDate();
  return formatDate(new Date(year, month, Math.min(day, lastDay)));
}

export function loadCurrentSampleTransactions(referenceDate = new Date()) {
  const targetMonthId = getMonthId(referenceDate);
  const currentDay = referenceDate.getDate();

  return sampleTemplate.flatMap((transaction) => {
    const sourceMonthId = getMonthId(transaction.date);
    const monthOffset = getMonthOffset(sourceMonthId, DEMO_MONTH.id);
    const sourceDay = Number(transaction.date.slice(8, 10));

    if (monthOffset === 0 && sourceDay > currentDay) {
      return [];
    }

    return [
      {
        ...transaction,
        date: moveTransactionDate(transaction.date, addMonths(targetMonthId, monthOffset)),
      },
    ];
  });
}

export function isSampleTransactionId(id: string) {
  return sampleTransactionIds.has(id);
}
