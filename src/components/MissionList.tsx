import { CheckCircle2, Circle, Repeat2 } from "lucide-react";
import { formatShortWon } from "../services/analytics";
import type { CoachMission } from "../types";

interface MissionListProps {
  missions: CoachMission[];
  compact?: boolean;
}

export function MissionList({ missions, compact = false }: MissionListProps) {
  return (
    <section className="mission-list">
      {missions.slice(0, compact ? 2 : missions.length).map((mission, index) => {
        const impactLabel = mission.impactLabel ?? "예상 절감";
        const impactText = mission.impactText ?? `+${formatShortWon(mission.expectedSaving)}`;

        return (
          <article className="mission-card" key={mission.id}>
            <span className={`mission-icon${index % 2 === 0 ? " is-saving" : " is-primary"}`}>
              {mission.completed ? <CheckCircle2 size={19} /> : index % 2 === 0 ? <Circle size={18} /> : <Repeat2 size={18} />}
            </span>
            <span>
              <strong className="mission-title">{mission.title}</strong>
              <span className="mission-meta">{mission.reason}</span>
            </span>
            <span className="mission-saving">
              <small>{impactLabel}</small>
              <strong>{impactText}</strong>
            </span>
          </article>
        );
      })}
    </section>
  );
}
