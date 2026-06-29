import { classifyTransaction } from "./aiAdapter";
import type { Category, PaymentType, Transaction } from "../types";

export interface CsvValidationResult {
  transactions: Transaction[];
  errors: string[];
}

const requiredHeaders = ["date", "merchant", "amount"];

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, ""));
}

function asPaymentType(value: string): PaymentType {
  if (value === "transport" || value === "cash" || value === "transfer") {
    return value;
  }

  return "card";
}

function asCategory(value: string | undefined): Category | undefined {
  const categories: Category[] = [
    "식비",
    "카페/간식",
    "교통",
    "쇼핑",
    "여가",
    "구독",
    "교육",
    "의료",
    "생활",
    "기타",
  ];

  return categories.find((category) => category === value);
}

export function parseTransactionsCsv(csvText: string): Transaction[] {
  return parseTransactionsCsvWithValidation(csvText).transactions;
}

export function parseTransactionsCsvWithValidation(csvText: string): CsvValidationResult {
  const rows = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const [headerLine, ...dataLines] = rows;
  if (!headerLine) {
    return {
      transactions: [],
      errors: ["CSV 파일이 비어 있습니다."],
    };
  }

  const headers = splitCsvLine(headerLine);
  const errors: string[] = [];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    return {
      transactions: [],
      errors: [`필수 필드가 없습니다: ${missingHeaders.join(", ")}`],
    };
  }

  if (dataLines.length === 0) {
    return {
      transactions: [],
      errors: ["CSV에 거래 데이터가 없습니다."],
    };
  }

  const transactions = dataLines.flatMap((line, index) => {
    const values = splitCsvLine(line);
    const row = headers.reduce<Record<string, string>>((record, header, valueIndex) => {
      record[header] = values[valueIndex] ?? "";
      return record;
    }, {});
    const rowNumber = index + 2;
    const amount = Number(row.amount.replace(/[,\s]/g, ""));

    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      errors.push(`${rowNumber}행: 날짜는 YYYY-MM-DD 형식이어야 합니다.`);
      return [];
    }

    if (!row.merchant.trim()) {
      errors.push(`${rowNumber}행: 사용처가 비어 있습니다.`);
      return [];
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`${rowNumber}행: 금액은 0보다 큰 숫자여야 합니다.`);
      return [];
    }

    const isSubscription = (row.isSubscription ?? "").toLowerCase() === "true";
    const classified = classifyTransaction({
      merchant: row.merchant,
      memo: row.memo,
      isSubscription,
    });
    const category = asCategory(row.category) ?? classified.category;

    return {
      id: row.id || `tx-${Date.now()}-${index}`,
      date: row.date,
      merchant: row.merchant.trim(),
      amount,
      memo: row.memo,
      paymentType: asPaymentType(row.paymentType),
      category,
      isSubscription,
      classificationReason: row.category ? "사용자 지정 카테고리입니다." : classified.reason,
    };
  });

  return {
    transactions,
    errors,
  };
}

export function transactionsToCsv(transactions: Transaction[]) {
  const header = "id,date,merchant,amount,memo,paymentType,category,isSubscription";
  const lines = transactions.map((transaction) =>
    [
      transaction.id,
      transaction.date,
      transaction.merchant,
      transaction.amount,
      transaction.memo,
      transaction.paymentType,
      transaction.category,
      transaction.isSubscription,
    ]
      .map((value) => `"${String(value).replace(/"/g, "\"\"")}"`)
      .join(","),
  );

  return [header, ...lines].join("\n");
}
