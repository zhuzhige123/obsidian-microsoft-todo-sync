import { describe, expect, it } from "vitest";
import {
  extractFencedNoteBlock,
  extractLegacyIndentedNote,
  extractNoteAfterSubtasks,
  formatFencedNoteBlock,
} from "./note-block-parser";

describe("note-block-parser", () => {
  it("extracts fenced note after task line", () => {
    const lines = [
      "- [ ] Parent #mct",
      "```",
      "这是一条批注笔记的内容",
      "第二行",
      "```",
      "- [ ] Next",
    ];
    const { noteBody, endIndex } = extractFencedNoteBlock(lines, 1);
    expect(noteBody).toBe("这是一条批注笔记的内容\n第二行");
    expect(endIndex).toBe(5);
  });

  it("reads note after subtasks", () => {
    const lines = [
      "- [ ] Parent #mct",
      "  - [ ] Child",
      "```",
      "备注",
      "```",
      "- [ ] Sibling",
    ];
    expect(extractNoteAfterSubtasks(lines, 0, 0, 1)).toBe("备注");
  });

  it("formats fenced note without extra blank lines", () => {
    expect(formatFencedNoteBlock("hello\nworld")).toEqual(["```", "hello", "world", "```"]);
  });

  it("extracts and formats fenced note inside callouts", () => {
    const lines = [
      "> - [ ] Parent #msd",
      "> ```",
      "> note line",
      "> ```",
    ];
    expect(extractFencedNoteBlock(lines, 1).noteBody).toBe("note line");
    expect(formatFencedNoteBlock("note line", 1)).toEqual([
      "> ```",
      "> note line",
      "> ```",
    ]);
  });

  it("does not treat blank lines before non-note content as legacy note bounds", () => {
    const lines = [
      "- [ ] Task #mtd-sync",
      "",
      "",
      "%% kanban:settings",
    ];
    const legacy = extractLegacyIndentedNote(lines, 1, 0);
    expect(legacy.noteLines).toEqual([]);
    expect(legacy.endIndex).toBe(1);
  });
});
