import { describe, expect, it } from "vitest";
import {
  formatTodoBodyAfterInbound,
  resolveNoteBodyOnPull,
} from "./backlink-writer";

describe("backlink-writer inbound route", () => {
  it("strips route header and backlink on pull", () => {
    const remote = [
      "[[周会笔记#本周待办]]",
      "---",
      "用户真实备注",
      "",
      "---",
      "在 Obsidian 中打开：",
      "obsidian://mtd-sync?task=mtd-1",
    ].join("\n");

    expect(resolveNoteBodyOnPull("", remote)).toBe("用户真实备注");
  });

  it("rebuilds To Do body after inbound", () => {
    const remote = "page: [[Note.md]]\n---\n正文";
    const rebuilt = formatTodoBodyAfterInbound(remote, {
      stripRouteHeader: true,
      appendBacklink: true,
      backlinkUri: "obsidian://mtd-sync?task=mtd-1",
      backlinkHeader: "在 Obsidian 中打开：",
    });
    expect(rebuilt).not.toContain("[[Note.md]]");
    expect(rebuilt).toContain("正文");
    expect(rebuilt).toContain("obsidian://mtd-sync?task=mtd-1");
  });
});
