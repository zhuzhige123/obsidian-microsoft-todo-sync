import { describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import { en } from "../i18n/en";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { createEmptyPluginData, readLegacyAuthState, SyncEngine } from "./sync-engine";

describe("readLegacyAuthState", () => {
  it("reads refresh token from legacy data.json auth blob", () => {
    expect(readLegacyAuthState({ refreshToken: "rt", accessToken: "at", expiresAt: 1 })).toEqual({
      refreshToken: "rt",
      accessToken: "at",
      expiresAt: 1,
    });
  });

  it("returns undefined when refresh token is missing", () => {
    expect(readLegacyAuthState({ accessToken: "at" })).toBeUndefined();
  });
});

describe("SyncEngine", () => {
  it("skips push when not signed in", async () => {
    const saveData = vi.fn(async () => undefined);
    const engine = new SyncEngine({
      app: { vault: { read: vi.fn() } } as never,
      getSettings: () => DEFAULT_SETTINGS,
      getStrings: () => en,
      loadData: async () => createEmptyPluginData(DEFAULT_SETTINGS),
      saveData,
      auth: { isLoggedIn: false } as never,
      graph: {} as never,
    });

    const file = { path: "note.md" } as TFile;
    const changed = await engine.pushFile(file);
    expect(changed).toBe(0);
    expect(saveData).not.toHaveBeenCalled();
  });

  it("serializes concurrent push and pull operations", async () => {
    let active = 0;
    let maxActive = 0;

    const runOp = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
      active -= 1;
      return 0;
    };

    const engine = new SyncEngine({
      app: {} as never,
      getSettings: () => DEFAULT_SETTINGS,
      getStrings: () => en,
      loadData: async () => createEmptyPluginData(DEFAULT_SETTINGS),
      saveData: async () => undefined,
      auth: { isLoggedIn: true } as never,
      graph: {} as never,
    });

    vi.spyOn(engine as never, "pushFileInner").mockImplementation(runOp);
    vi.spyOn(engine as never, "pullDeltaInner").mockImplementation(runOp);

    const file = { path: "note.md" } as TFile;
    await Promise.all([engine.pushFile(file), engine.pullDelta({ silent: true })]);
    expect(maxActive).toBe(1);
  });
});
