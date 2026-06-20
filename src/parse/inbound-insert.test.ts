import { describe, expect, it } from "vitest";
import {
  computeInboundInsertLine,
  findHeadingSectionEnd,
  insertInboundTaskBlock,
} from "./inbound-insert";

describe("inbound-insert", () => {
  it("finds heading section end", () => {
    const lines = [
      "# Doc",
      "## 本周待办",
      "- [ ] existing",
      "",
      "## 其它",
      "tail",
    ];
    expect(findHeadingSectionEnd(lines, "本周待办")).toBe(4);
  });

  it("inserts under heading instead of file end", () => {
    const lines = ["## 本周待办", "- [ ] existing", "", "## Next"];
    expect(computeInboundInsertLine(lines, "本周待办")).toBe(2);
  });

  it("inserts inbound block with optional blank separator", () => {
    const existing = ["## 本周待办", "- [ ] existing"];
    const block = ["- [ ] inbound #mtd-sync"];
    const inserted = insertInboundTaskBlock(existing, block, 2);
    expect(inserted.parentLine).toBe(3);
    expect(inserted.lines).toEqual(["## 本周待办", "- [ ] existing", "", "- [ ] inbound #mtd-sync"]);
  });
});
