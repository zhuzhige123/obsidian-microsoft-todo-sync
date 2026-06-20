import { describe, expect, it } from "vitest";
import {
  applyReminderToTaskLine,
  applyTodayToTaskLine,
  parseReminderInput,
} from "./task-line-edit";
import type { ParsedSyncTask } from "../types/sync";

function task(overrides: Partial<ParsedSyncTask> = {}): ParsedSyncTask {
  return {
    filePath: "a.md",
    line: 0,
    rawLine: '- [ ] Buy milk #mtd-sync <!-- mtd:id=mtd-abc -->',
    checkbox: " ",
    title: "Buy milk",
    priority: null,
    mtd: { id: "mtd-abc" },
    noteBody: "",
    subtasks: [],
    taskIndent: 0,
    quoteDepth: 0,
    eligible: true,
    targetListName: "Obsidian Sync",
    ...overrides,
  };
}

describe("task-line-edit", () => {
  it("applies today due date and myday marker", () => {
    const line = applyTodayToTaskLine(task(), "mtd-sync");
    expect(line).toContain("📅");
    expect(line).toContain("myday");
    expect(line).toContain("#mtd-sync");
  });

  it("parses reminder input formats", () => {
    expect(parseReminderInput("14:30", "2026-06-12")).toEqual({
      reminderIso: "2026-06-12T14:30",
      reminderDate: "2026-06-12",
      reminderTime: "14:30",
    });
    expect(parseReminderInput("2026-06-15 09:00")).toEqual({
      reminderIso: "2026-06-15T09:00",
      reminderDate: "2026-06-15",
      reminderTime: "09:00",
    });
  });

  it("writes reminder into line body and mtd comment", () => {
    const line = applyReminderToTaskLine(task(), "mtd-sync", {
      reminderIso: "2026-06-12T14:00",
      reminderDate: "2026-06-12",
      reminderTime: "14:00",
    });
    expect(line).toContain("⏰");
    expect(line).toContain("reminder=2026-06-12T14:00");
  });
});
