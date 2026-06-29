import { Bell, Bot, CalendarDays, Home, Plus, Settings, ShieldCheck, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { formatMonthLabel } from "../services/date";
import type { AppState, TabId } from "../types";

interface AppShellProps {
  children: ReactNode;
  state: AppState;
  actions: {
    setActiveTab: (tab: TabId) => void;
  };
}

const bottomTabs: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "home", label: "홈", icon: Home },
  { id: "calendar", label: "캘린더", icon: CalendarDays },
  { id: "add", label: "추가", icon: Plus },
  { id: "coach", label: "코치", icon: Bot },
  { id: "settings", label: "설정", icon: Settings },
];

const appIconSrc = `${import.meta.env.BASE_URL}money-routine-icon-v2-192.png`;

export function AppShell({ children, state, actions }: AppShellProps) {
  const [openPanel, setOpenPanel] = useState<"alerts" | "trust" | null>(null);
  const hasMonthlyAlerts = state.hasLoadedSample || state.transactions.length > 0;

  function togglePanel(panel: "alerts" | "trust") {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  function moveFromPanel(tab: TabId) {
    actions.setActiveTab(tab);
    setOpenPanel(null);
  }

  return (
    <main className="app-shell">
      <div className="app-page">
        <header className="topbar">
          <button className="brand-lockup" type="button" onClick={() => actions.setActiveTab("home")} data-testid="brand-home-button">
            <img className="brand-mark" src={appIconSrc} alt="" aria-hidden="true" />
            <span className="brand-copy">
              <span className="brand-title">머니루틴</span>
              <span className="brand-subtitle">소비 캘린더 · 목표 코치</span>
            </span>
          </button>

          <div className="top-actions">
            <button className="chip-button" type="button" onClick={() => actions.setActiveTab("goals")} data-testid="top-goal-button">
              <Target size={15} />
              <span>{formatMonthLabel(state.calendarMonth).replace("2026년 ", "")}</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => togglePanel("trust")}
              aria-label="신뢰 안내"
              aria-controls="top-trust-panel"
              aria-expanded={openPanel === "trust"}
              data-testid="top-trust-button"
            >
              <ShieldCheck size={17} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => togglePanel("alerts")}
              aria-label="월간 알림"
              aria-controls="top-alerts-panel"
              aria-expanded={openPanel === "alerts"}
              data-testid="top-notification-button"
            >
              <Bell size={17} />
              {hasMonthlyAlerts && <span className="notification-dot" />}
            </button>
          </div>

          {openPanel === "trust" && (
            <section className="top-popover" id="top-trust-panel" aria-live="polite" data-testid="top-trust-panel">
              <span className="top-popover-icon">
                <ShieldCheck size={19} />
              </span>
              <span className="top-popover-copy">
                <strong>금융 인증정보 미수집</strong>
                <small>샘플 데이터, 직접 입력, CSV 파일만 사용하며 계좌나 카드 인증을 요청하지 않습니다.</small>
              </span>
              <button className="top-popover-action" type="button" onClick={() => moveFromPanel("settings")}>
                설정
              </button>
            </section>
          )}

          {openPanel === "alerts" && (
            <section className="top-popover" id="top-alerts-panel" aria-live="polite" data-testid="top-alerts-panel">
              <span className="top-popover-icon">
                <Bell size={19} />
              </span>
              <span className="top-popover-copy">
                <strong>{hasMonthlyAlerts ? "월간 소비 알림" : "확인할 알림 없음"}</strong>
                <small>
                  {hasMonthlyAlerts
                    ? `${formatMonthLabel(state.calendarMonth)} 데이터 ${state.transactions.length}건이 반영되어 코치 분석을 확인할 수 있습니다.`
                    : "거래를 추가하거나 샘플 데이터를 불러오면 목표 진행 알림이 표시됩니다."}
                </small>
              </span>
              <button className="top-popover-action" type="button" onClick={() => moveFromPanel(hasMonthlyAlerts ? "coach" : "add")}>
                {hasMonthlyAlerts ? "코치" : "추가"}
              </button>
            </section>
          )}
        </header>

        {children}
      </div>

      <nav className="bottom-nav" aria-label="하단 내비게이션">
        {bottomTabs.map(({ id, label, icon: Icon }) => {
          const isActive = state.activeTab === id;
          return (
            <button
              key={id}
              className={`bottom-nav-item${isActive ? " is-active" : ""}${id === "add" ? " is-add" : ""}`}
              type="button"
              onClick={() => actions.setActiveTab(id)}
              aria-current={isActive ? "page" : undefined}
              data-testid={`nav-${id}`}
            >
              <span className="bottom-nav-icon">
                <Icon size={18} />
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}
