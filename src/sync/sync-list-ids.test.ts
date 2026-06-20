import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { SyncIndex } from "./sync-index";
import { collectPollListIds } from "./sync-list-ids";
import type { TodoApi } from "../graph/todo-api";

describe("collectPollListIds", () => {
  it("does not create missing managed lists during delta poll", async () => {
    const ensureTaskList = vi.fn();
    const listTaskLists = vi.fn(async () => [{ id: "list-existing", displayName: "Obsidian Sync" }]);
    const todoApi = { ensureTaskList, listTaskLists } as unknown as TodoApi;
    const index = SyncIndex.fromRecord({});
    const cache = new Map<string, string>();

    const ids = await collectPollListIds(todoApi, DEFAULT_SETTINGS, index, cache);

    expect(ids).toEqual(["list-existing"]);
    expect(ensureTaskList).not.toHaveBeenCalled();
  });

  it("includes graph list ids from index entries", async () => {
    const listTaskLists = vi.fn(async () => []);
    const todoApi = { listTaskLists } as unknown as TodoApi;
    const index = SyncIndex.fromRecord({
      "mtd-1": {
        mtdId: "mtd-1",
        vaultPath: "a.md",
        lineHint: 0,
        graphTaskId: "task-1",
        graphListId: "orphan-list",
        steps: {},
        obsidianModified: 0,
      },
    });

    const ids = await collectPollListIds(todoApi, DEFAULT_SETTINGS, index, new Map());

    expect(ids).toEqual(["orphan-list"]);
  });
});
