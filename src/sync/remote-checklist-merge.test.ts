import { describe, expect, it } from "vitest";
import { mergeRemoteChecklistIntoSubtasks } from "./remote-checklist-merge";
import type { ParsedSyncTask } from "../types/sync";

function task(overrides: Partial<ParsedSyncTask> = {}): ParsedSyncTask {
  return {
    filePath: "a.md",
    line: 0,
    rawLine: "- [ ] parent #mtd-sync",
    checkbox: " ",
    title: "parent",
    priority: null,
    mtd: { id: "mtd-1" },
    noteBody: "",
    subtasks: [],
    taskIndent: 0,
    quoteDepth: 0,
    eligible: true,
    targetListName: "Obsidian Sync",
    ...overrides,
  };
}

describe("mergeRemoteChecklistIntoSubtasks", () => {
  it("updates existing subtasks and appends new remote checklist items", () => {
    const merged = mergeRemoteChecklistIntoSubtasks(
      task({
        subtasks: [
          {
            line: 1,
            rawLine: "- [ ] one",
            title: "one",
            checked: false,
            mtd: { step: "step-1" },
          },
        ],
      }),
      [
        { id: "graph-step-1", displayName: "One updated", isChecked: true },
        { id: "graph-step-2", displayName: "Two", isChecked: false },
      ],
      { "step-1": "graph-step-1" }
    );

    expect(merged.subtasks).toHaveLength(2);
    expect(merged.subtasks[0]?.title).toBe("One updated");
    expect(merged.subtasks[0]?.checked).toBe(true);
    expect(merged.subtasks[1]?.title).toBe("Two");
    expect(merged.steps["step-2"]).toBe("graph-step-2");
  });
});
