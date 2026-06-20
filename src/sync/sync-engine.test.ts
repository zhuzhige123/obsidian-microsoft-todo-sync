import { describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import { en } from "../i18n/en";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { createEmptyPluginData } from "./plugin-data";
import { SyncEngine } from "./sync-engine";

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

    const outbound = (engine as unknown as { outbound: { pushFile: typeof runOp } }).outbound;
    const delta = (engine as unknown as { delta: { pullDelta: typeof runOp } }).delta;
    vi.spyOn(outbound, "pushFile").mockImplementation(runOp);
    vi.spyOn(delta, "pullDelta").mockImplementation(runOp);

    const file = { path: "note.md" } as TFile;
    await Promise.all([engine.pushFile(file), engine.pullDelta({ silent: true })]);
    expect(maxActive).toBe(1);
  });

  it("accepts injected TodoApi", async () => {
    const ensureTaskList = vi.fn();
    const engine = new SyncEngine(
      {
        app: {
          vault: {
            read: vi.fn(async () => "- [ ] task #mtd-sync <!-- mtd:id=mtd-1 -->"),
            modify: vi.fn(),
          },
          metadataCache: { getFileCache: vi.fn(() => ({ listItems: [] })) },
        } as never,
        getSettings: () => DEFAULT_SETTINGS,
        getStrings: () => en,
        loadData: async () => createEmptyPluginData(DEFAULT_SETTINGS),
        saveData: vi.fn(async () => undefined),
        auth: { isLoggedIn: true } as never,
        graph: {} as never,
      },
      { ensureTaskList } as never
    );

    expect(engine).toBeDefined();
    expect(ensureTaskList).not.toHaveBeenCalled();
  });

  it("exposes live index during queued sync work", async () => {
    let sawLiveIndex = false;
    const engine = new SyncEngine({
      app: {} as never,
      getSettings: () => DEFAULT_SETTINGS,
      getStrings: () => en,
      loadData: async () => createEmptyPluginData(DEFAULT_SETTINGS),
      saveData: vi.fn(async () => undefined),
      auth: { isLoggedIn: true } as never,
      graph: {} as never,
    });
    const outbound = (engine as unknown as { outbound: { pushFile: () => Promise<number> } })
      .outbound;
    vi.spyOn(outbound, "pushFile").mockImplementation(async () => {
      sawLiveIndex = engine.getLiveIndex() !== null;
      return 0;
    });

    await engine.pushFile({ path: "note.md" } as TFile);

    expect(sawLiveIndex).toBe(true);
    expect(engine.getLiveIndex()).toBeNull();
  });
});
