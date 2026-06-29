import { Pencil, Trash2 } from "lucide-react";
import { formatWon } from "../services/analytics";
import type { Category, Transaction } from "../types";

interface TransactionListProps {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
  onCategoryChange?: (transaction: Transaction, category: Category) => void;
  categories?: Category[];
  emptyText?: string;
}

export function TransactionList({
  categories = [],
  emptyText = "거래가 없습니다.",
  onCategoryChange,
  onDelete,
  transactions,
}: TransactionListProps) {
  if (transactions.length === 0) {
    return <div className="empty-line">{emptyText}</div>;
  }

  return (
    <section className="transaction-list">
      {transactions.map((transaction) => (
        <article className="transaction-row" key={transaction.id} data-testid={`transaction-row-${transaction.id}`}>
          <span className="tx-avatar">{transaction.merchant.slice(0, 1)}</span>
          <span className="tx-main">
            <strong>{transaction.merchant}</strong>
            <span>
              {transaction.category} · {transaction.memo || transaction.date}
            </span>
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
      ))}
    </section>
  );
}
