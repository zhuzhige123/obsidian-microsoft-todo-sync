import { describe, expect, it } from "vitest";
import { selectionTouchesRange } from "./mtd-comment-cursor";

describe("selectionTouchesRange", () => {
  it("detects overlap when cursor is inside range", () => {
    expect(selectionTouchesRange([{ from: 10, to: 10 }], 5, 20)).toBe(true);
  });

  it("detects overlap when selection spans range", () => {
    expect(selectionTouchesRange([{ from: 0, to: 50 }], 20, 40)).toBe(true);
  });

  it("returns false when cursor is outside range", () => {
    expect(selectionTouchesRange([{ from: 0, to: 5 }], 20, 40)).toBe(false);
    expect(selectionTouchesRange([{ from: 50, to: 50 }], 20, 40)).toBe(false);
  });
});
