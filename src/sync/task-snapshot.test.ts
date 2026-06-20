import { describe, expect, it } from "vitest";
import {
  computeTaskSnapshot,
  decideSyncDirection,
  decideTaskSyncPlan,
  splitLocalDirty,
  splitRemoteDirty,
} from "./task-snapshot";
import type { ParsedSyncTask, SyncIndexEntry } from "../types/sync";
import type { GraphTodoTask } from "../types/graph";

function baseTask(overrides: Partial<ParsedSyncTask> = {}): ParsedSyncTask {
  return {
    filePath: "a.md",
    line: 0,
    rawLine: "- [ ] Task #mct",
    checkbox: " ",
    title: "Task",
    priority: null,
    mtd: {},
    noteBody: "",
    subtasks: [],
    taskIndent: 0,
    quoteDepth: 0,
    eligible: true,
    targetListName: "Obsidian Sync",
    ...overrides,
  };
}

describe("task-snapshot", () => {
  it("detects checkbox changes", () => {
    const before = computeTaskSnapshot(baseTask());
    const after = computeTaskSnapshot(baseTask({ checkbox: "x" }));
    expect(before).not.toBe(after);
  });

  it("chooses push when only local changed", () => {
    expect(
      decideSyncDirection({
        localDirty: true,
        remoteDirty: false,
        localMs: 100,
        remoteMs: 200,
      })
    ).toBe("push");
  });

  it("chooses pull when only remote changed", () => {
    expect(
      decideSyncDirection({
        localDirty: false,
        remoteDirty: true,
        localMs: 300,
        remoteMs: 200,
      })
    ).toBe("pull");
  });

  it("breaks ties by newer timestamp when both changed", () => {
    expect(
      decideSyncDirection({
        localDirty: true,
        remoteDirty: true,
        localMs: 300,
        remoteMs: 200,
      })
    ).toBe("push");
    expect(
      decideSyncDirection({
        localDirty: true,
        remoteDirty: true,
        localMs: 100,
        remoteMs: 200,
      })
    ).toBe("pull");
  });

  it("pushes note-only local edits", () => {
    const entry: SyncIndexEntry = {
      mtdId: "mtd-a",
      vaultPath: "a.md",
      lineHint: 0,
      graphTaskId: "g1",
      graphListId: "l1",
      steps: {},
      obsidianModified: 0,
      graphModified: "2026-06-01T10:00:00Z",
      graphBodyModified: "2026-06-01T10:00:00Z",
      taskSnapshot: computeTaskSnapshot(baseTask({ noteBody: "old" })),
    };
    const local = splitLocalDirty(entry, baseTask({ noteBody: "new" }));
    const remote = splitRemoteDirty(entry, {
      id: "g1",
      title: "Task",
      lastModifiedDateTime: "2026-06-01T10:00:00Z",
      bodyLastModifiedDateTime: "2026-06-01T10:00:00Z",
    });
    const plan = decideTaskSyncPlan({
      ...local,
      ...remote,
      localMs: 100,
      remoteMs: 100,
    });
    expect(plan.action).toBe("push");
    expect(plan.useRemoteNoteOnPush).toBe(false);
  });

  it("pulls remote note when only body changed remotely", () => {
    const entry: SyncIndexEntry = {
      mtdId: "mtd-a",
      vaultPath: "a.md",
      lineHint: 0,
      graphTaskId: "g1",
      graphListId: "l1",
      steps: {},
      obsidianModified: 0,
      graphModified: "2026-06-01T10:00:00Z",
      graphBodyModified: "2026-06-01T09:00:00Z",
      taskSnapshot: computeTaskSnapshot(baseTask({ noteBody: "local" })),
    };
    const remote: GraphTodoTask = {
      id: "g1",
      title: "Task",
      lastModifiedDateTime: "2026-06-01T10:00:00Z",
      bodyLastModifiedDateTime: "2026-06-01T11:00:00Z",
    };
    const plan = decideTaskSyncPlan({
      ...splitLocalDirty(entry, baseTask({ noteBody: "local" })),
      ...splitRemoteDirty(entry, remote),
      localMs: 100,
      remoteMs: 100,
    });
    expect(plan.action).toBe("pull");
    expect(plan.preserveLocalNote).toBe(false);
  });

  it("preserves local note on pull when Obsidian note changed too", () => {
    const entry: SyncIndexEntry = {
      mtdId: "mtd-a",
      vaultPath: "a.md",
      lineHint: 0,
      graphTaskId: "g1",
      graphListId: "l1",
      steps: {},
      obsidianModified: 0,
      graphModified: "2026-06-01T09:00:00Z",
      graphBodyModified: "2026-06-01T09:00:00Z",
      taskSnapshot: computeTaskSnapshot(baseTask({ noteBody: "local-old", title: "Old" })),
    };
    const plan = decideTaskSyncPlan({
      ...splitLocalDirty(entry, baseTask({ noteBody: "local-new", title: "New" })),
      ...splitRemoteDirty(entry, {
        id: "g1",
        title: "Remote",
        lastModifiedDateTime: "2026-06-01T12:00:00Z",
        bodyLastModifiedDateTime: "2026-06-01T11:00:00Z",
      }),
      localMs: 200,
      remoteMs: 300,
    });
    expect(plan.action).toBe("pull");
    expect(plan.preserveLocalNote).toBe(true);
  });

  it("detects remote field changes without Graph timestamps via taskSnapshot", () => {
    const entry: SyncIndexEntry = {
      mtdId: "mtd-a",
      vaultPath: "a.md",
      lineHint: 0,
      graphTaskId: "g1",
      graphListId: "l1",
      steps: {},
      obsidianModified: 0,
      graphModified: "2026-06-01T10:00:00Z",
      taskSnapshot: computeTaskSnapshot(baseTask({ title: "Old title" })),
    };
    const remote = splitRemoteDirty(entry, {
      id: "g1",
      title: "New title",
      status: "notStarted",
    });
    expect(remote.remoteFieldsDirty).toBe(true);
    expect(remote.remoteNoteDirty).toBe(false);
  });
});
