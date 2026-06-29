import { Bell, Bot, CalendarDays, CheckCircle2, CreditCard, Home, Plus, RefreshCw, Settings, ShieldCheck, Target, WalletCards, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { formatWon } from "../services/analytics";
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
const READ_NOTIFICATION_IDS_KEY = "money-routine-read-notification-ids";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  meta: string;
  icon: LucideIcon;
  tone: "primary" | "subscription" | "danger" | "saving";
}

function formatAlertDate(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}월 ${day}일`;
}

function paymentSource(paymentType: string) {
  if (paymentType === "transport") {
    return "교통카드";
  }
  if (paymentType === "cash") {
    return "현금 입력";
  }
  if (paymentType === "transfer") {
    return "계좌 이체";
  }
  return "카드 앱";
}

function buildNotifications(state: AppState): NotificationItem[] {
  const sortedTransactions = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date));

  if (sortedTransactions.length === 0) {
    return [];
  }

  const notifications: NotificationItem[] = [
    {
      id: "sync-summary",
      title: "소비 내역 동기화 완료",
      body: `${formatMonthLabel(state.calendarMonth)} 소비 ${state.transactions.length}건이 업데이트됐어요.`,
      meta: "방금 전",
      icon: RefreshCw,
      tone: "primary",
    },
  ];

  const subscription = sortedTransactions.find((transaction) => transaction.isSubscription);
  if (subscription) {
    notifications.push({
      id: `subscription-${subscription.id}`,
      title: "정기 결제 감지",
      body: `${subscription.merchant} ${formatWon(subscription.amount)} 결제가 반영됐어요.`,
      meta: formatAlertDate(subscription.date),
      icon: WalletCards,
      tone: "subscription",
    });
  }

  sortedTransactions.slice(0, 5).forEach((transaction) => {
    notifications.push({
      id: `transaction-${transaction.id}`,
      title: `${transaction.merchant} 소비 반영`,
      body: `${paymentSource(transaction.paymentType)} · ${transaction.category} · ${formatWon(transaction.amount)}`,
      meta: formatAlertDate(transaction.date),
      icon: CreditCard,
      tone: transaction.amount >= 30000 ? "danger" : "saving",
    });
  });

  return notifications.slice(0, 7);
}

function readStoredNotificationIds() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const stored = window.localStorage.getItem(READ_NOTIFICATION_IDS_KEY);
    const parsed = JSON.parse(stored ?? "[]");
    return new Set<string>(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function storeNotificationIds(ids: Set<string>) {
  window.localStorage.setItem(READ_NOTIFICATION_IDS_KEY, JSON.stringify([...ids]));
}

export function AppShell({ children, state, actions }: AppShellProps) {
  const [openPanel, setOpenPanel] = useState<"alerts" | "trust" | null>(null);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => readStoredNotificationIds());
  const notifications = useMemo(() => buildNotifications(state), [state]);
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !readNotificationIds.has(notification.id)),
    [notifications, readNotificationIds],
  );
  const hasNotifications = notifications.length > 0;
  const hasUnreadNotifications = unreadNotifications.length > 0;
  const notificationCountLabel = unreadNotifications.length > 9 ? "9+" : String(unreadNotifications.length);

  useEffect(() => {
    if (openPanel !== "alerts" || notifications.length === 0) {
      return;
    }

    setReadNotificationIds((current) => {
      const next = new Set(current);
      let changed = false;

      notifications.forEach((notification) => {
        if (!next.has(notification.id)) {
          next.add(notification.id);
          changed = true;
        }
      });

      if (changed) {
        storeNotificationIds(next);
      }

      return changed ? next : current;
    });
  }, [notifications, openPanel]);

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
              aria-label="알림 내역"
              aria-controls="notification-panel"
              aria-expanded={openPanel === "alerts"}
              data-testid="top-notification-button"
            >
              <Bell size={17} />
              {hasUnreadNotifications && <span className="notification-badge">{notificationCountLabel}</span>}
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

        </header>

        {children}
      </div>

      {openPanel === "alerts" && (
        <>
          <button className="notification-backdrop" type="button" aria-label="알림 닫기" onClick={() => setOpenPanel(null)} />
          <aside className="notification-panel" id="notification-panel" aria-label="알림 내역" data-testid="notification-panel">
            <div className="notification-panel-head">
              <span>
                <strong>알림 내역</strong>
                <small>연결된 금융앱에서 반영된 소비 업데이트</small>
              </span>
              <button className="notification-close" type="button" onClick={() => setOpenPanel(null)} aria-label="알림 닫기">
                <X size={18} />
              </button>
            </div>

            {hasNotifications ? (
              <>
                <div className="notification-summary">
                  <span className="notification-summary-icon">
                    <CheckCircle2 size={18} />
                  </span>
                  <span>
                    <strong>{unreadNotifications.length > 0 ? `${unreadNotifications.length}개 새 알림이 있어요` : "모든 알림을 확인했어요"}</strong>
                    <small>새 소비가 들어오면 목표와 코치 분석에 자동 반영됩니다.</small>
                  </span>
                </div>

                <div className="notification-list">
                  {notifications.map(({ id, title, body, meta, icon: Icon, tone }) => (
                    <article className={`notification-item is-${tone}`} key={id}>
                      <span className="notification-item-icon">
                        <Icon size={17} />
                      </span>
                      <span className="notification-item-copy">
                        <strong>{title}</strong>
                        <small>{body}</small>
                      </span>
                      <time>{meta}</time>
                    </article>
                  ))}
                </div>

                <div className="notification-actions">
                  <button className="secondary-button" type="button" onClick={() => moveFromPanel("calendar")}>
                    캘린더 보기
                  </button>
                  <button className="primary-button" type="button" onClick={() => moveFromPanel("coach")}>
                    코치 확인
                  </button>
                </div>
              </>
            ) : (
              <div className="notification-empty">
                <span className="notification-empty-icon">
                  <Bell size={22} />
                </span>
                <strong>아직 확인할 알림이 없어요</strong>
                <small>금융앱 연결 또는 소비 내역 추가 후 업데이트 알림이 여기에 표시됩니다.</small>
                <button className="primary-button" type="button" onClick={() => moveFromPanel("add")}>
                  내역 추가
                </button>
              </div>
            )}
          </aside>
        </>
      )}

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
