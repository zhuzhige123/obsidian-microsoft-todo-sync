import { describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import { AutoSyncScheduler } from "./auto-sync";
import { DEFAULT_SETTINGS } from "../settings/defaults";

describe("AutoSyncScheduler", () => {
  it("debounces idle pushes per file", async () => {
    vi.useFakeTimers();
    const pushFile = vi.fn(async () => undefined);
    const file = { path: "note.md", extension: "md" } as TFile;

    const scheduler = new AutoSyncScheduler({
      app: {} as never,
      getSettings: () => ({ ...DEFAULT_SETTINGS, autoSyncMode: "idle", autoSyncIdleSeconds: 2 }),
      isLoggedIn: () => true,
      isSyncing: () => false,
      isPluginWrite: () => false,
      pushFile,
    });

    scheduler["schedulePush"](file, 2000);
    scheduler["schedulePush"](file, 2000);
    expect(pushFile).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);
    expect(pushFile).toHaveBeenCalledTimes(1);

    scheduler.detach();
    vi.useRealTimers();
  });
});
