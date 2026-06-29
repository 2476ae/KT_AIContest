import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { AddScreen } from "./screens/AddScreen";
import { CalendarScreen } from "./screens/CalendarScreen";
import { CoachScreen } from "./screens/CoachScreen";
import { GoalsScreen } from "./screens/GoalsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { useMoneyRoutine } from "./hooks/useMoneyRoutine";

const introIconSrc = `${import.meta.env.BASE_URL}money-routine-icon-v2-192.png`;
const INTRO_HOLD_MS = 1050;
const INTRO_EXIT_MS = 420;

export default function App() {
  const moneyRoutine = useMoneyRoutine();
  const { activeTab } = moneyRoutine.state;
  const [introPhase, setIntroPhase] = useState<"visible" | "leaving" | "done">("visible");

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setIntroPhase("leaving"), INTRO_HOLD_MS);
    const doneTimer = window.setTimeout(() => setIntroPhase("done"), INTRO_HOLD_MS + INTRO_EXIT_MS);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  return (
    <>
      <AppShell state={moneyRoutine.state} actions={moneyRoutine.actions}>
        {activeTab === "home" && <HomeScreen {...moneyRoutine} />}
        {activeTab === "calendar" && <CalendarScreen {...moneyRoutine} />}
        {activeTab === "add" && <AddScreen {...moneyRoutine} />}
        {activeTab === "goals" && <GoalsScreen {...moneyRoutine} />}
        {activeTab === "coach" && <CoachScreen {...moneyRoutine} />}
        {activeTab === "settings" && <SettingsScreen {...moneyRoutine} />}
      </AppShell>

      {introPhase !== "done" && (
        <section className={`app-intro is-${introPhase}`} aria-label="머니루틴 실행 중">
          <div className="app-intro-mark">
            <img src={introIconSrc} alt="" aria-hidden="true" />
          </div>
          <strong>머니루틴</strong>
          <div className="app-intro-loader" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      )}
    </>
  );
}
