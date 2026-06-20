import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { SyncIndex } from "./sync-index";
import {
  findUntaggedIndexEntries,
  localTaskModifiedMs,
  removeUntaggedIndexEntriesForFile,
  touchLocalTaskModified,
} from "./sync-local-state";
import type { SyncIndexEntry } from "../types/sync";

function entry(partial: Partial<SyncIndexEntry> & Pick<SyncIndexEntry, "mtdId">): SyncIndexEntry {
  return {
    vaultPath: "note.md",
    lineHint: 0,
    graphTaskId: "graph-1",
    graphListId: "list-1",
    steps: {},
    obsidianModified: 100,
    ...partial,
  };
}

describe("sync-local-state", () => {
  it("finds index rows kept after sync tag removal", () => {
    const index = SyncIndex.fromRecord({
      "mtd-a": entry({ mtdId: "mtd-a" }),
      "mtd-b": entry({ mtdId: "mtd-b" }),
    });
    const inFile = new Set(["mtd-a", "mtd-b"]);
    const eligible = new Set(["mtd-a"]);
    expect(findUntaggedIndexEntries(index, "note.md", inFile, eligible).map((row) => row.mtdId)).toEqual([
      "mtd-b",
    ]);
  });

  it("bumps obsidianModified only when the task is locally dirty", () => {
    const row = entry({ mtdId: "mtd-a", obsidianModified: 100 });
    touchLocalTaskModified(row, 500, false, false);
    expect(row.obsidianModified).toBe(100);
    touchLocalTaskModified(row, 500, true, false);
    expect(row.obsidianModified).toBe(500);
    expect(localTaskModifiedMs(row, 999)).toBe(500);
  });

  it("removes index rows when sync tag is stripped from a line", () => {
    const index = SyncIndex.fromRecord({
      "mtd-a": entry({ mtdId: "mtd-a" }),
    });
    const lines = ['- [ ] Task <!-- mtd:id=mtd-a -->'];
    const removed = removeUntaggedIndexEntriesForFile(index, "note.md", lines, [], DEFAULT_SETTINGS);
    expect(removed).toBe(1);
    expect(index.getByMtdId("mtd-a")).toBeUndefined();
  });
});
