import { FileUp, Save } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { CATEGORIES } from "../constants";
import { classifyTransaction } from "../services/aiAdapter";
import { parseTransactionsCsvWithValidation } from "../services/csv";
import { formatWon } from "../services/analytics";
import type { Category } from "../types";
import type { MoneyRoutineViewModel } from "./screenTypes";

function parseMoneyInput(value: string) {
  return Number(value.replace(/[^\d]/g, ""));
}

export function AddScreen({ actions, state }: MoneyRoutineViewModel) {
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(state.selectedDate);
  const [category, setCategory] = useState<Category>("식비");
  const [isSubscription, setIsSubscription] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");
  const csvPreview = useMemo(
    () => (csvText ? parseTransactionsCsvWithValidation(csvText) : { transactions: [], errors: [] }),
    [csvText],
  );
  const preview = csvPreview.transactions;
  const subscriptionCount = preview.filter((transaction) => transaction.isSubscription || transaction.category === "구독").length;

  function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = parseMoneyInput(amount);
    if (parsedAmount <= 0) {
      setFormError("금액은 0원보다 크게 입력해주세요.");
      return;
    }

    if (!merchant.trim()) {
      setFormError("사용처를 입력해주세요.");
      return;
    }

    if (!date) {
      setFormError("날짜를 선택해주세요.");
      return;
    }

    setFormError("");
    const classified = classifyTransaction({ merchant, memo, isSubscription });

    actions.addTransaction({
      amount: parsedAmount,
      category,
      classificationReason: `직접 입력됨 · ${classified.reason}`,
      date,
      isSubscription,
      memo,
      merchant: merchant.trim(),
      paymentType: "card",
    });

    setAmount("");
    setMerchant("");
    setMemo("");
    setIsSubscription(false);
    setFormMessage("저장됐어요. 홈과 캘린더가 바로 갱신됩니다.");
  }

  return (
    <>
      <section className="screen-head">
        <span className="eyebrow">직접 입력</span>
        <h1>소비 추가</h1>
      </section>

      <form className="entry-form card" onSubmit={submitTransaction}>
        <label className="amount-field">
          <span>금액</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d,]/g, ""))}
            inputMode="numeric"
            placeholder="0"
            required
          />
        </label>

        <div className="form-grid">
          <label>
            <span>사용처</span>
            <input value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="예: 스타벅스" required />
          </label>
          <label>
            <span>날짜</span>
            <input value={date} onChange={(event) => setDate(event.target.value)} type="date" required />
          </label>
        </div>

        <label>
          <span>메모</span>
          <input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="예: 등교 전 커피" />
        </label>

        <div className="category-pills" aria-label="카테고리">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              className={`category-pill${category === item ? " is-active" : ""}`}
              type="button"
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="switch-row">
          <span>
            <strong>구독 결제</strong>
            <small>월 고정비로 표시</small>
          </span>
          <input checked={isSubscription} onChange={(event) => setIsSubscription(event.target.checked)} type="checkbox" />
        </label>

        <button className="primary-button" type="submit">
          <Save size={18} />
          저장
        </button>
        {formError && <div className="field-error">{formError}</div>}
        {formMessage && !formError && <div className="success-line">{formMessage}</div>}
      </form>

      <section className="upload-card card">
        <div className="upload-head">
          <span className="upload-icon">
            <FileUp size={20} />
          </span>
          <span>
            <strong>CSV 연결</strong>
            <small>
              {preview.length > 0
                ? `${preview.length}건 · 구독 후보 ${subscriptionCount}건`
                : csvPreview.errors[0] ?? "거래 파일을 선택하세요."}
            </small>
          </span>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            file.text().then(setCsvText);
          }}
        />
        <div className="segmented-control" aria-label="CSV 반영 방식">
          <button
            className={importMode === "replace" ? "is-active" : ""}
            type="button"
            onClick={() => setImportMode("replace")}
          >
            교체
          </button>
          <button
            className={importMode === "merge" ? "is-active" : ""}
            type="button"
            onClick={() => setImportMode("merge")}
          >
            병합
          </button>
        </div>
        {csvPreview.errors.length > 0 && (
          <div className="field-error">
            {csvPreview.errors.slice(0, 3).map((error) => (
              <span key={error}>{error}</span>
            ))}
          </div>
        )}
        {preview.length > 0 && (
          <div className="upload-result">
            <span>총 {formatWon(preview.reduce((sum, item) => sum + item.amount, 0))}</span>
            <button className="secondary-button" type="button" onClick={() => actions.importCsv(csvText, importMode)}>
              화면에 반영
            </button>
          </div>
        )}
      </section>
    </>
  );
}
