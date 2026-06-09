import { describe, expect, it } from "vitest";
import { computeTaskSnapshot, decideSyncDirection } from "./task-snapshot";
import type { ParsedSyncTask } from "../types/sync";

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
});
