import { describe, expect, it } from "vitest";
import { resolveNoteBodyOnPull, stripBacklinkFromBody } from "./backlink-writer";

describe("backlink-writer", () => {
  it("strips backlink section from To Do body", () => {
    const body = "用户备注\n\n---\n在 Obsidian 中打开：\nobsidian://mtd-sync?vault=x";
    expect(stripBacklinkFromBody(body)).toBe("用户备注");
  });

  it("pulls user note but keeps local when remote is backlink only", () => {
    const remote = "---\n在 Obsidian 中打开：\nobsidian://mtd-sync?vault=x";
    expect(resolveNoteBodyOnPull("本地备注", remote)).toBe("本地备注");
    expect(resolveNoteBodyOnPull("本地备注", "To Do 新备注\n\n---\n在 Obsidian 中打开：\nobsidian://x")).toBe(
      "To Do 新备注"
    );
  });
});
