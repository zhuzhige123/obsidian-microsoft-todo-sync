import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import type { SyncIndexEntry } from "../types/sync";
import { cleanupRemoteOnUnlink } from "./remote-unlink-cleanup";
import type { TodoApi } from "../graph/todo-api";

describe("remote-unlink-cleanup", () => {
  it("deletes linked resource and strips backlink body", async () => {
    const deleteLinkedResource = vi.fn().mockResolvedValue(undefined);
    const listLinkedResources = vi.fn().mockResolvedValue([]);
    const getTask = vi.fn().mockResolvedValue({
      id: "task-1",
      body: {
        content: "Note\n\n---\nOpen in Obsidian:\nobsidian://mtd-sync?task=mtd-a",
      },
    });
    const updateTask = vi.fn().mockResolvedValue({ id: "task-1" });

    const todoApi = {
      deleteLinkedResource,
      listLinkedResources,
      getTask,
      updateTask,
    } as unknown as TodoApi;

    const entry: SyncIndexEntry = {
      mtdId: "mtd-a",
      vaultPath: "a.md",
      lineHint: 0,
      graphTaskId: "task-1",
      graphListId: "list-1",
      linkedResourceId: "lr-1",
      steps: {},
      obsidianModified: 0,
    };

    await cleanupRemoteOnUnlink(todoApi, entry, {
      ...DEFAULT_SETTINGS,
      cleanupRemoteOnUnlink: true,
      appendBacklinkToTodo: true,
      createLinkedResource: true,
    });

    expect(deleteLinkedResource).toHaveBeenCalledWith("list-1", "task-1", "lr-1");
    expect(updateTask).toHaveBeenCalledWith("list-1", "task-1", {
      body: { content: "Note", contentType: "text" },
    });
  });

  it("skips remote calls when disabled", async () => {
    const deleteLinkedResource = vi.fn();
    const todoApi = { deleteLinkedResource } as unknown as TodoApi;
    await cleanupRemoteOnUnlink(
      todoApi,
      {
        mtdId: "mtd-a",
        vaultPath: "a.md",
        lineHint: 0,
        graphTaskId: "task-1",
        graphListId: "list-1",
        steps: {},
        obsidianModified: 0,
      },
      { ...DEFAULT_SETTINGS, cleanupRemoteOnUnlink: false }
    );
    expect(deleteLinkedResource).not.toHaveBeenCalled();
  });
});
