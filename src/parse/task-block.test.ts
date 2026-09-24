import { describe, expect, it } from "vitest";
import { computeTaskBlockEnd, parseTaskBlockBounds } from "./task-block";

describe("task-block", () => {
  it("bounds parent, subtasks, and fenced note", () => {
    const lines = [
      "- [ ] Parent #mct",
      "  - [ ] Child",
      "  - [x] Child 2",
      "```",
      "note line",
      "```",
      "- [ ] Sibling",
    ];
    const bounds = parseTaskBlockBounds(lines, 0, 0);
    expect(bounds.noteBody).toBe("note line");
    expect(bounds.blockEnd).toBe(6);
    expect(computeTaskBlockEnd(lines, 0, 0)).toBe(6);
  });

  it("stops before sibling task without note fence", () => {
    const lines = ["- [ ] A #mct", "  - [ ] sub", "- [ ] B"];
    expect(computeTaskBlockEnd(lines, 0, 0)).toBe(2);
  });

  it("bounds callout task with subtasks and fenced note", () => {
    const lines = [
      "> [!todo] section",
      "> - [ ] Parent #msd",
      ">   - [ ] Child",
      "> ```",
      "> note",
      "> ```",
      "- [ ] outside",
    ];
    const bounds = parseTaskBlockBounds(lines, 1, 0);
    expect(bounds.noteBody).toBe("note");
    expect(bounds.blockEnd).toBe(6);
  });

  it("does not claim blank lines before kanban settings footer", () => {
    const lines = [
      "- [ ] 控制论与科学方法论 📅 2026-09-24 #mtd-sync <!-- mtd:id=mtd-3a55c338 -->",
      "",
      "",
      "",
      "%% kanban:settings",
      "```",
      '{"kanban-plugin":"board"}',
      "```",
      "%%",
    ];
    expect(computeTaskBlockEnd(lines, 0, 0)).toBe(1);
  });

  it("does not claim blank lines between sibling tasks", () => {
    const lines = ["- [ ] A #mtd-sync", "", "", "- [ ] B #mtd-sync"];
    expect(computeTaskBlockEnd(lines, 0, 0)).toBe(1);
  });

  it("still allows blank lines between subtasks and fenced note", () => {
    const lines = [
      "- [ ] Parent #mtd-sync",
      "  - [ ] Child",
      "",
      "```",
      "note",
      "```",
    ];
    const bounds = parseTaskBlockBounds(lines, 0, 0);
    expect(bounds.noteBody).toBe("note");
    expect(bounds.blockEnd).toBe(6);
  });
});
