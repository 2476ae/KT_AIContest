import { Download, RotateCcw, ShieldCheck, WalletCards } from "lucide-react";
import { useState } from "react";
import type { MoneyRoutineViewModel } from "./screenTypes";

export function SettingsScreen({ actions, computed, state }: MoneyRoutineViewModel) {
  const [settingsMessage, setSettingsMessage] = useState("");

  function loadSample() {
    actions.loadSample();
    setSettingsMessage("샘플 데이터를 불러왔어요.");
  }

  function downloadCsv() {
    const blob = new Blob([actions.exportCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "money-routine-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
    setSettingsMessage("CSV를 저장했어요.");
  }

  function confirmResetAll() {
    if (window.confirm("현재 목표와 소비 내역을 기본 상태로 되돌릴까요?")) {
      actions.resetAll();
      setSettingsMessage("기본 상태로 되돌렸어요.");
    }
  }

  return (
    <>
      <section className="screen-head">
        <span className="eyebrow">앱 관리</span>
        <h1>설정</h1>
      </section>

      <section className="settings-actions">
        <button className="action-row card" type="button" onClick={loadSample} data-testid="settings-load-sample">
          <span className="action-icon">
            <WalletCards size={20} />
          </span>
          <span>
            <strong>샘플 데이터 불러오기</strong>
            <small>{state.transactions.length}건 · 현재 지출 {computed.summary.totalSpent.toLocaleString("ko-KR")}원</small>
          </span>
        </button>
        <button
          className="action-row card"
          type="button"
          onClick={downloadCsv}
          disabled={state.transactions.length === 0}
          data-testid="settings-export-csv"
        >
          <span className="action-icon">
            <Download size={20} />
          </span>
          <span>
            <strong>CSV 내보내기</strong>
            <small>현재 화면 데이터를 파일로 저장</small>
          </span>
        </button>
        <button className="action-row card" type="button" onClick={confirmResetAll} data-testid="settings-reset-all">
          <span className="action-icon">
            <RotateCcw size={20} />
          </span>
          <span>
            <strong>초기화</strong>
            <small>확인 후 기본 상태로 복원</small>
          </span>
        </button>
      </section>
      {settingsMessage && <div className="success-line">{settingsMessage}</div>}

      <section className="trust-panel card">
        <span className="trust-icon">
          <ShieldCheck size={22} />
        </span>
        <span>
          <strong>금융 인증정보 미수집</strong>
          <small>현재 데모는 샘플 데이터, 직접 입력, CSV 파일만 사용합니다.</small>
        </span>
      </section>

      <section className="trust-panel card">
        <span className="trust-icon">
          <WalletCards size={22} />
        </span>
        <span>
          <strong>실시간 반영 준비</strong>
          <small>새 소비는 홈, 캘린더, AI 코치와 알림에 함께 반영됩니다.</small>
        </span>
      </section>
    </>
  );
}
