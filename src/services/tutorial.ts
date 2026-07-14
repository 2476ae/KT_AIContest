export const TUTORIAL_STORAGE_KEY = "money-routine-tutorial:v1";
export const TUTORIAL_VERSION = 1;

export type TutorialStatus = "pending" | "completed" | "skipped";

interface StoredTutorialState {
  version: number;
  status: TutorialStatus;
}

function isTutorialStatus(value: unknown): value is TutorialStatus {
  return value === "pending" || value === "completed" || value === "skipped";
}

export function readTutorialStatus(): TutorialStatus {
  if (typeof window === "undefined") {
    return "pending";
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(TUTORIAL_STORAGE_KEY) ?? "null") as Partial<StoredTutorialState> | null;
    if (parsed?.version === TUTORIAL_VERSION && isTutorialStatus(parsed.status)) {
      return parsed.status;
    }
  } catch {
    // Invalid or older tutorial state should show the current guide again.
  }

  return "pending";
}

export function writeTutorialStatus(status: TutorialStatus) {
  if (typeof window === "undefined") {
    return;
  }

  const value: StoredTutorialState = {
    version: TUTORIAL_VERSION,
    status,
  };
  window.localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(value));
}
