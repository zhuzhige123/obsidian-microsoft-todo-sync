import { describe, expect, it } from "vitest";
import type { MtdPluginData, SyncIndexEntry } from "../types/sync";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { persistPluginData } from "./index-persistence";
import { SyncIndex } from "./sync-index";

function entry(mtdId: string): SyncIndexEntry {
  return {
    mtdId,
    vaultPath: "note.md",
    lineHint: 0,
    graphTaskId: `g-${mtdId}`,
    graphListId: "list-1",
    steps: {},
    obsidianModified: 1,
  };
}

describe("persistPluginData", () => {
  it("persists removals (replace, not merge-only upsert)", async () => {
    let stored: MtdPluginData = {
      settings: DEFAULT_SETTINGS,
      index: {
        keep: entry("keep"),
        gone: entry("gone"),
      },
      syncMeta: { deltaLinks: {} },
    };

    const working = SyncIndex.fromRecord(stored.index);
    working.removeByMtdId("gone");

    await persistPluginData(
      async () => stored,
      async (data) => {
        stored = data;
      },
      working
    );

    expect(stored.index.keep).toBeDefined();
    expect(stored.index.gone).toBeUndefined();
  });
});
