import { describe, expect, it } from "vitest";
import { SyncIndex } from "./sync-index";
import type { SyncIndexEntry } from "../types/sync";

function entry(partial: Partial<SyncIndexEntry> & Pick<SyncIndexEntry, "mtdId">): SyncIndexEntry {
  return {
    vaultPath: "note.md",
    lineHint: 0,
    graphTaskId: "graph-1",
    graphListId: "list-1",
    steps: {},
    obsidianModified: 0,
    ...partial,
  };
}

describe("SyncIndex", () => {
  it("looks up entries by graph task id in O(1)", () => {
    const index = SyncIndex.fromRecord({
      "mtd-a": entry({ mtdId: "mtd-a", graphTaskId: "graph-a" }),
      "mtd-b": entry({ mtdId: "mtd-b", graphTaskId: "graph-b" }),
    });
    expect(index.getByGraphId("graph-b")?.mtdId).toBe("mtd-b");
  });

  it("maintains reverse index on upsert and remove", () => {
    const index = SyncIndex.fromRecord({});
    index.upsert(entry({ mtdId: "mtd-1", graphTaskId: "graph-1" }));
    expect(index.getByGraphId("graph-1")?.mtdId).toBe("mtd-1");

    index.upsert(entry({ mtdId: "mtd-1", graphTaskId: "graph-2" }));
    expect(index.getByGraphId("graph-1")).toBeUndefined();
    expect(index.getByGraphId("graph-2")?.mtdId).toBe("mtd-1");

    index.removeByMtdId("mtd-1");
    expect(index.getByGraphId("graph-2")).toBeUndefined();
  });

  it("replaces duplicate graph task mapping on upsert", () => {
    const index = SyncIndex.fromRecord({});
    index.upsert(entry({ mtdId: "mtd-a", graphTaskId: "graph-shared" }));
    index.upsert(entry({ mtdId: "mtd-b", graphTaskId: "graph-shared" }));
    expect(index.getByGraphId("graph-shared")?.mtdId).toBe("mtd-b");
    expect(index.getByMtdId("mtd-a")).toBeUndefined();
  });
});
