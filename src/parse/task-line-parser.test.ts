import { describe, expect, it } from "vitest";
import { hasSyncTag, parseTaskLine } from "./task-line-parser";

describe("task-line-parser", () => {
  it("parses tasks emoji dates and priority", () => {
    const parsed = parseTaskLine("- [ ] Buy milk #mtd-sync 📅 2026-06-10 ⏫");
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe("Buy milk");
    expect(parsed?.dueDate).toBe("2026-06-10");
    expect(parsed?.priority).toBe("high");
  });

  it("parses due date with inline time", () => {
    const parsed = parseTaskLine("- [ ] Meet #mct 📅 2026-06-10 14:00");
    expect(parsed?.dueDate).toBe("2026-06-10");
    expect(parsed?.dueTime).toBe("14:00");
    expect(parsed?.title).toBe("Meet");
  });

  it("parses tasks inside callout blockquotes", () => {
    const parsed = parseTaskLine("> - [ ] 测试 #msd");
    expect(parsed).not.toBeNull();
    expect(parsed?.quoteDepth).toBe(1);
    expect(parsed?.indent).toBe(0);
    expect(parsed?.title).toBe("测试");
  });

  it("parses nested callout quote depth", () => {
    const parsed = parseTaskLine("> > - [ ] nested #msd");
    expect(parsed?.quoteDepth).toBe(2);
    expect(parsed?.title).toBe("nested");
  });

  it("detects sync tag with or without hash", () => {
    const line = "- [ ] Sync me #mtd-sync";
    expect(hasSyncTag(line, "mtd-sync")).toBe(true);
    expect(hasSyncTag(line, "#mtd-sync")).toBe(true);
    expect(hasSyncTag(line, "other")).toBe(false);
  });

  it("parses chinese sub-tags in title", () => {
    const parsed = parseTaskLine("- [ ] 这一条任务 #msd/基础任务");
    expect(parsed?.title).toBe("这一条任务");
  });
});
