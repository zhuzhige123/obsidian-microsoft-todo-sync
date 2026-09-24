import { describe, expect, it } from "vitest";
import { applyGraphPatchToTaskLine, rebuildFileSection } from "./vault-task-writer";
import type { ParsedSyncTask } from "../types/sync";

function baseTask(overrides: Partial<ParsedSyncTask> = {}): ParsedSyncTask {
  return {
    filePath: "note.md",
    line: 0,
    rawLine: '- [ ] Task #mtd-sync <!-- mtd:id=abc123 -->',
    checkbox: " ",
    title: "Task",
    priority: null,
    mtd: { id: "abc123" },
    noteBody: "",
    subtasks: [],
    taskIndent: 0,
    quoteDepth: 0,
    eligible: true,
    targetListName: "Obsidian Sync",
    ...overrides,
  };
}

describe("vault-task-writer", () => {
  it("applies graph patch while preserving mtd comment", () => {
    const line = '- [ ] Old title #mtd-sync <!-- mtd:id=abc123 -->';
    const patched = applyGraphPatchToTaskLine(line, {
      checkbox: "x",
      title: "New title",
      dueDate: "2026-06-10",
    });
    expect(patched).toContain("[x]");
    expect(patched).toContain("New title");
    expect(patched).toContain("mtd:id=abc123");
    expect(patched).toContain("📅 2026-06-10");
  });

  it("rebuilds task block with subtasks and note body", () => {
    const lines = [
      "- [ ] Task #mtd-sync <!-- mtd:id=abc123 -->",
      "  - [ ] Child <!-- mtd:step=s1 -->",
      "  Note line",
    ];
    const task = baseTask({
      line: 0,
      title: "Task",
      noteBody: "Synced note",
      subtasks: [
        {
          line: 1,
          rawLine: "  - [ ] Child",
          title: "Child",
          checked: false,
          mtd: { step: "s1" },
        },
      ],
    });

    const rebuilt = rebuildFileSection(lines, task, "mtd-sync", "Synced note", task.subtasks);
    expect(rebuilt[0]).toContain("Task");
    expect(rebuilt[1]).toContain("Child");
    expect(rebuilt.join("\n")).toContain("Synced note");
  });

  it("preserves blank lines after a task block (e.g. before kanban settings)", () => {
    const lines = [
      "- [ ] 控制论与科学方法论 📅 2026-09-24 #mtd-sync <!-- mtd:id=abc123 -->",
      "",
      "",
      "",
      "%% kanban:settings",
      "```",
      '{"kanban-plugin":"board"}',
      "```",
      "%%",
    ];
    const task = baseTask({
      line: 0,
      title: "控制论与科学方法论",
      rawLine: lines[0] ?? "",
      dueDate: "2026-09-24",
    });

    const rebuilt = rebuildFileSection(lines, task, "mtd-sync", "", []);
    expect(rebuilt).toEqual([
      expect.stringContaining("控制论与科学方法论"),
      "",
      "",
      "",
      "%% kanban:settings",
      "```",
      '{"kanban-plugin":"board"}',
      "```",
      "%%",
    ]);
  });
});
