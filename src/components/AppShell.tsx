import { Bell, Bot, CalendarDays, Home, Plus, Settings, ShieldCheck, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
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
  return (
    <main className="app-shell">
      <div className="app-page">
        <header className="topbar">
          <button className="brand-lockup" type="button" onClick={() => actions.setActiveTab("home")}>
            <img className="brand-mark" src={appIconSrc} alt="" aria-hidden="true" />
            <span className="brand-copy">
              <span className="brand-title">머니루틴</span>
              <span className="brand-subtitle">소비 캘린더 · 목표 코치</span>
            </span>
          </button>

          <div className="top-actions">
            <button className="chip-button" type="button" onClick={() => actions.setActiveTab("goals")}>
              <Target size={15} />
              <span>{formatMonthLabel(state.calendarMonth).replace("2026년 ", "")}</span>
            </button>
            <button className="icon-button" type="button" onClick={() => actions.setActiveTab("settings")} aria-label="신뢰 안내">
              <ShieldCheck size={17} />
            </button>
            <button className="icon-button" type="button" aria-label="알림">
              <Bell size={17} />
              {state.hasLoadedSample && <span className="notification-dot" />}
            </button>
          </div>
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
