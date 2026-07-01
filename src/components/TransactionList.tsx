import {
  Bus,
  Coffee,
  CreditCard,
  GraduationCap,
  HeartPulse,
  Home,
  MoreHorizontal,
  Pencil,
  ShoppingBag,
  Ticket,
  Trash2,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatWon } from "../services/analytics";
import type { Category, Transaction } from "../types";

interface TransactionListProps {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
  onCategoryChange?: (transaction: Transaction, category: Category) => void;
  categories?: Category[];
  emptyText?: string;
  showDate?: boolean;
}

const categoryIcons: Record<Category, LucideIcon> = {
  식비: Utensils,
  "카페/간식": Coffee,
  교통: Bus,
  쇼핑: ShoppingBag,
  여가: Ticket,
  구독: CreditCard,
  교육: GraduationCap,
  의료: HeartPulse,
  생활: Home,
  기타: MoreHorizontal,
};

const categoryTones: Record<Category, string> = {
  식비: "food",
  "카페/간식": "cafe",
  교통: "transport",
  쇼핑: "shopping",
  여가: "leisure",
  구독: "subscription",
  교육: "education",
  의료: "medical",
  생활: "life",
  기타: "etc",
};

function formatShortDate(date: string) {
  const [, month, day] = date.split("-");
  if (!month || !day) {
    return date;
  }

  return `${Number(month)}월 ${Number(day)}일`;
}

export function TransactionList({
  categories = [],
  emptyText = "거래가 없습니다.",
  onCategoryChange,
  onDelete,
  showDate = false,
  transactions,
}: TransactionListProps) {
  if (transactions.length === 0) {
    return <div className="empty-line">{emptyText}</div>;
  }

  return (
    <section className="transaction-list">
      {transactions.map((transaction) => {
        const CategoryIcon = categoryIcons[transaction.category] ?? MoreHorizontal;
        const tone = categoryTones[transaction.category] ?? "etc";
        const metaText = showDate ? `${transaction.category} · ${formatShortDate(transaction.date)}` : transaction.category;

        return (
          <article className="transaction-row" key={transaction.id} data-testid={`transaction-row-${transaction.id}`}>
            <span className={`tx-avatar is-${tone}`} role="img" aria-label={`${transaction.category} 카테고리`}>
              <CategoryIcon size={18} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span className="tx-main">
              <strong>{transaction.merchant}</strong>
              <span>{metaText}</span>
            </span>
            <span className="tx-side">
              <strong>-{formatWon(transaction.amount)}</strong>
              {(onDelete || onCategoryChange) && (
                <span className="tx-actions">
                  {onCategoryChange && (
                    <label className="mini-select">
                      <Pencil size={13} />
                      <select
                        value={transaction.category}
                        onChange={(event) =>
                          onCategoryChange(transaction, event.target.value as Category)
                        }
                        aria-label={`${transaction.merchant} 카테고리`}
                        data-testid={`transaction-category-${transaction.id}`}
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {onDelete && (
                    <button
                      className="ghost-icon"
                      type="button"
                      onClick={() => onDelete(transaction.id)}
                      aria-label={`${transaction.merchant} 삭제`}
                      data-testid={`transaction-delete-${transaction.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </span>
              )}
            </span>
          </article>
        );
      })}
    </section>
  );
}
