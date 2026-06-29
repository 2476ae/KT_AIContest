import { Download, RotateCcw, ShieldCheck, WalletCards } from "lucide-react";
import type { MoneyRoutineViewModel } from "./screenTypes";

export function SettingsScreen({ actions, computed, state }: MoneyRoutineViewModel) {
  function downloadCsv() {
    const blob = new Blob([actions.exportCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "money-routine-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="screen-head">
        <span className="eyebrow">데모 안정화</span>
        <h1>설정</h1>
      </section>

      <section className="settings-actions">
        <button className="action-row card" type="button" onClick={actions.loadSample}>
          <span className="action-icon">
            <WalletCards size={20} />
          </span>
          <span>
            <strong>샘플 데이터 불러오기</strong>
            <small>{state.transactions.length}건 · 현재 지출 {computed.summary.totalSpent.toLocaleString("ko-KR")}원</small>
          </span>
        </button>
        <button className="action-row card" type="button" onClick={downloadCsv} disabled={state.transactions.length === 0}>
          <span className="action-icon">
            <Download size={20} />
          </span>
          <span>
            <strong>CSV 내보내기</strong>
            <small>현재 화면 데이터를 파일로 저장</small>
          </span>
        </button>
        <button className="action-row card" type="button" onClick={actions.resetAll}>
          <span className="action-icon">
            <RotateCcw size={20} />
          </span>
          <span>
            <strong>초기화</strong>
            <small>목표와 거래를 기본 상태로 복원</small>
          </span>
        </button>
      </section>

      <section className="trust-panel card">
        <span className="trust-icon">
          <ShieldCheck size={22} />
        </span>
        <span>
          <strong>금융 인증정보 미수집</strong>
          <small>이 데모는 샘플 데이터, 직접 입력, CSV 파일만 사용합니다.</small>
        </span>
      </section>
    </>
  );
}
