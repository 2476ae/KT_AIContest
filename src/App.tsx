import { AppShell } from "./components/AppShell";
import { AddScreen } from "./screens/AddScreen";
import { CalendarScreen } from "./screens/CalendarScreen";
import { CoachScreen } from "./screens/CoachScreen";
import { GoalsScreen } from "./screens/GoalsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { useMoneyRoutine } from "./hooks/useMoneyRoutine";

export default function App() {
  const moneyRoutine = useMoneyRoutine();
  const { activeTab } = moneyRoutine.state;

  return (
    <AppShell state={moneyRoutine.state} actions={moneyRoutine.actions}>
      {activeTab === "home" && <HomeScreen {...moneyRoutine} />}
      {activeTab === "calendar" && <CalendarScreen {...moneyRoutine} />}
      {activeTab === "add" && <AddScreen {...moneyRoutine} />}
      {activeTab === "goals" && <GoalsScreen {...moneyRoutine} />}
      {activeTab === "coach" && <CoachScreen {...moneyRoutine} />}
      {activeTab === "settings" && <SettingsScreen {...moneyRoutine} />}
    </AppShell>
  );
}
