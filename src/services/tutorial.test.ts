import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readTutorialStatus, TUTORIAL_STORAGE_KEY, TUTORIAL_VERSION, writeTutorialStatus } from "./tutorial";

describe("tutorial state", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("starts pending when no current tutorial state exists", () => {
    expect(readTutorialStatus()).toBe("pending");

    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ version: TUTORIAL_VERSION - 1, status: "completed" }));
    expect(readTutorialStatus()).toBe("pending");
  });

  it("stores completed and skipped states independently", () => {
    writeTutorialStatus("completed");
    expect(readTutorialStatus()).toBe("completed");

    writeTutorialStatus("skipped");
    expect(readTutorialStatus()).toBe("skipped");
  });

  it("recovers from invalid storage", () => {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "not-json");
    expect(readTutorialStatus()).toBe("pending");
  });
});
