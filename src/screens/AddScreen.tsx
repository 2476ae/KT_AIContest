import { CheckCircle2, FileUp, Home, Loader2, Plus, Save, Wand2 } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { CATEGORIES } from "../constants";
import { formatWon } from "../services/analytics";
import { classifyTransactionResponseAsync } from "../services/aiAdapter";
import { parseTransactionsCsvWithValidation } from "../services/csv";
import { formatMoneyInput, parseMoneyInput, validateTransactionDraft } from "../services/formValidation";
import { getManualCategoryCopy } from "../services/transactionCopy";
import type { Category } from "../types";
import type { MoneyRoutineViewModel } from "./screenTypes";

type CategoryChoice = Category | "auto";

function isCsvFile(file: File) {
  return file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
}

export function AddScreen({ actions, state }: MoneyRoutineViewModel) {
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(state.selectedDate);
  const [category, setCategory] = useState<CategoryChoice>("auto");
  const [isSubscription, setIsSubscription] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const [formMessage, setFormMessage] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [formWarnings, setFormWarnings] = useState<string[]>([]);
  const [csvMessage, setCsvMessage] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isReadingCsv, setIsReadingCsv] = useState(false);

  const csvPreview = useMemo(
    () => (csvText ? parseTransactionsCsvWithValidation(csvText) : { transactions: [], errors: [] }),
    [csvText],
  );
  const preview = csvPreview.transactions;
  const displayedCsvErrors = csvErrors.length > 0 ? csvErrors : csvPreview.errors;
  const subscriptionCount = preview.filter((transaction) => transaction.isSubscription || transaction.category === "구독").length;
  const canImportCsv = preview.length > 0 && displayedCsvErrors.length === 0 && !isReadingCsv;

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");
    setFormWarnings([]);

    const validationErrors = validateTransactionDraft({ amount, date, merchant, memo });
    if (validationErrors.length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    setFormErrors([]);

    const parsedAmount = parseMoneyInput(amount);
    let resolvedCategory: Category;
    let classificationReason: string;

    if (category === "auto") {
      const response = await classifyTransactionResponseAsync({ merchant, memo, isSubscription });
      const classified = response.data;
      resolvedCategory = classified.category;
      classificationReason = classified.reason;
      if (response.status === "fallback" || response.status === "error") {
        setFormWarnings([
          "외부 AI 분류 응답이 지연되어 로컬 규칙으로 저장했어요. 거래 저장과 캘린더 반영은 정상 처리됐습니다.",
        ]);
      }
    } else {
      resolvedCategory = category;
      classificationReason = getManualCategoryCopy(category);
    }

    actions.addTransaction({
      amount: parsedAmount,
      category: resolvedCategory,
      classificationReason,
      date,
      isSubscription,
      memo: memo.trim(),
      merchant: merchant.trim(),
      paymentType: "card",
    });

    setAmount("");
    setMerchant("");
    setMemo("");
    setCategory("auto");
    setIsSubscription(false);
    setFormMessage(`${formatWon(parsedAmount)} 내역이 홈과 캘린더에 반영됐어요.`);
    setIsSaving(false);
  }

  function prepareAnotherEntry() {
    setFormMessage("");
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('[data-testid="transaction-amount-input"]')?.focus();
    });
  }

  async function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setCsvText("");
    setCsvFileName("");
    setCsvMessage("");
    setCsvErrors([]);

    if (!file) {
      return;
    }

    if (!isCsvFile(file)) {
      setCsvErrors(["CSV 파일만 연결할 수 있습니다."]);
      return;
    }

    setIsReadingCsv(true);
    try {
      const text = await file.text();
      if (!text.trim()) {
        setCsvErrors(["CSV 파일이 비어 있습니다."]);
        return;
      }

      setCsvText(text);
      setCsvFileName(file.name);
      setCsvMessage(`${file.name} 미리보기를 준비했어요.`);
    } catch {
      setCsvErrors(["파일을 읽지 못했습니다. 다시 선택해주세요."]);
    } finally {
      setIsReadingCsv(false);
    }
  }

  function applyCsv() {
    setCsvMessage("");
    setCsvErrors([]);

    if (csvPreview.errors.length > 0) {
      setCsvErrors(csvPreview.errors);
      return;
    }

    if (preview.length === 0) {
      setCsvErrors(["반영할 거래가 없습니다."]);
      return;
    }

    try {
      const imported = actions.importCsv(csvText, importMode);
      setCsvMessage(
        `${imported.length}건을 ${importMode === "replace" ? "교체" : "병합"}했어요. 캘린더와 AI 코치 화면이 다시 계산됩니다.`,
      );
    } catch (error) {
      setCsvErrors([error instanceof Error ? error.message : "CSV를 반영하지 못했습니다."]);
    }
  }

  return (
    <>
      <section className="screen-head">
        <span className="eyebrow">직접 입력</span>
        <h1>소비 추가</h1>
      </section>

      <form className="entry-form card" onSubmit={submitTransaction} data-testid="transaction-form">
        <label className="amount-field" data-tutorial="add-entry">
          <span>금액</span>
          <input
            value={amount}
            onChange={(event) => {
              setAmount(formatMoneyInput(event.target.value));
              setFormErrors([]);
              setFormWarnings([]);
              setFormMessage("");
            }}
            inputMode="numeric"
            placeholder="0"
            required
            data-testid="transaction-amount-input"
          />
        </label>

        <div className="form-grid">
          <label>
            <span>사용처</span>
            <input
              value={merchant}
              onChange={(event) => {
                setMerchant(event.target.value);
                setFormErrors([]);
                setFormWarnings([]);
              }}
              placeholder="예: 스타벅스"
              required
              data-testid="transaction-merchant-input"
            />
          </label>
          <label>
            <span>날짜</span>
            <input
              value={date}
              onInput={(event) => {
                setDate(event.currentTarget.value);
                setFormErrors([]);
                setFormWarnings([]);
              }}
              onChange={(event) => {
                setDate(event.target.value);
                setFormErrors([]);
                setFormWarnings([]);
              }}
              type="date"
              required
              data-testid="transaction-date-input"
            />
          </label>
        </div>

        <label>
          <span>메모</span>
          <input
            value={memo}
            onChange={(event) => {
              setMemo(event.target.value);
              setFormErrors([]);
              setFormWarnings([]);
            }}
            placeholder="예: 등교 전 커피"
            data-testid="transaction-memo-input"
          />
        </label>

        <div className="category-pills" aria-label="카테고리">
          <button
            className={`category-pill${category === "auto" ? " is-active" : ""}`}
            type="button"
            onClick={() => {
              setCategory("auto");
              setFormWarnings([]);
            }}
          >
            <Wand2 size={14} />
            자동 분류
          </button>
          {CATEGORIES.map((item) => (
            <button
              key={item}
            className={`category-pill${category === item ? " is-active" : ""}`}
            type="button"
            onClick={() => {
              setCategory(item);
              setFormWarnings([]);
            }}
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
          <input
            checked={isSubscription}
            onChange={(event) => setIsSubscription(event.target.checked)}
            type="checkbox"
            data-testid="transaction-subscription-checkbox"
          />
        </label>

        <button className="primary-button" type="submit" disabled={isSaving} data-testid="transaction-save-button">
          {isSaving ? <Loader2 className="spin-icon" size={18} /> : <Save size={18} />}
          저장
        </button>
        {formErrors.length > 0 && (
          <div className="field-error">
            {formErrors.slice(0, 3).map((error) => (
              <span key={error}>{error}</span>
            ))}
          </div>
        )}
        {formWarnings.length > 0 && formErrors.length === 0 && (
          <div className="warning-line" data-testid="transaction-ai-warning">
            {formWarnings.map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        )}
      </form>

      {formMessage && formErrors.length === 0 && (
        <section className="entry-success card" role="status" aria-live="polite" data-testid="entry-save-success">
          <span className="entry-success-icon"><CheckCircle2 size={21} /></span>
          <span className="entry-success-copy">
            <strong>저장했어요</strong>
            <small>{formMessage}</small>
          </span>
          <div className="entry-success-actions">
            <button className="secondary-button" type="button" onClick={prepareAnotherEntry} data-testid="entry-add-another">
              <Plus size={16} /> 하나 더 입력
            </button>
            <button className="primary-button" type="button" onClick={() => actions.setActiveTab("home")} data-testid="entry-go-home">
              <Home size={16} /> 홈에서 확인
            </button>
          </div>
        </section>
      )}

      <section className="upload-card card">
        <div className="upload-head">
          <span className="upload-icon">
            <FileUp size={20} />
          </span>
          <span>
            <strong>CSV 연결</strong>
            <small>
              {isReadingCsv
                ? "파일을 읽는 중입니다."
                : preview.length > 0
                  ? `${preview.length}건 · 구독 후보 ${subscriptionCount}건`
                  : displayedCsvErrors[0] ?? "거래 파일을 선택하세요."}
            </small>
          </span>
        </div>
        <input type="file" accept=".csv,text/csv" onChange={handleCsvFileChange} data-testid="csv-file-input" />
        <div className="input-help">필수 열은 date, merchant, amount이며 금액 콤마와 선택 열 category, memo, isSubscription을 지원합니다.</div>
        {csvFileName && <div className="file-name-line">{csvFileName}</div>}
        <div className="segmented-control" aria-label="CSV 반영 방식">
          <button
            className={importMode === "replace" ? "is-active" : ""}
            type="button"
            onClick={() => setImportMode("replace")}
            data-testid="csv-mode-replace"
          >
            교체
          </button>
          <button
            className={importMode === "merge" ? "is-active" : ""}
            type="button"
            onClick={() => setImportMode("merge")}
            data-testid="csv-mode-merge"
          >
            병합
          </button>
        </div>
        {displayedCsvErrors.length > 0 && (
          <div className="field-error">
            {displayedCsvErrors.slice(0, 3).map((error) => (
              <span key={error}>{error}</span>
            ))}
          </div>
        )}
        {preview.length > 0 && (
          <div className="upload-preview" aria-label="CSV 미리보기">
            {preview.slice(0, 3).map((transaction) => (
              <span key={transaction.id}>
                <strong>{transaction.merchant}</strong>
                {transaction.date} · {transaction.category} · {formatWon(transaction.amount)}
              </span>
            ))}
            {preview.length > 3 && <em>외 {preview.length - 3}건 더 있음</em>}
          </div>
        )}
        {csvMessage && displayedCsvErrors.length === 0 && <div className="success-line">{csvMessage}</div>}
        {preview.length > 0 && (
          <div className="upload-result">
            <span>총 {formatWon(preview.reduce((sum, item) => sum + item.amount, 0))}</span>
            <button className="secondary-button" type="button" onClick={applyCsv} disabled={!canImportCsv} data-testid="csv-apply-button">
              화면에 반영
            </button>
          </div>
        )}
      </section>
    </>
  );
}
