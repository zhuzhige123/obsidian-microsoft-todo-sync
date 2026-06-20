import { describe, expect, it } from "vitest";
import { removeSyncTagFromLine } from "./tags";

describe("removeSyncTagFromLine", () => {
  it("removes configured sync tag and route subtags", () => {
    const line = "- [ ] Buy milk #mtd-sync #mtd-sync/work #other";
    expect(removeSyncTagFromLine(line, "mtd-sync")).toBe("- [ ] Buy milk #other");
  });
});
