import { describe, expect, it } from "vitest";
import { clampInt, parseBoundedInt } from "./settings-bounds";

describe("settings-bounds", () => {
  it("clamps integers with fallback", () => {
    expect(clampInt(0, 1, 60, 5)).toBe(1);
    expect(clampInt(99, 1, 60, 5)).toBe(60);
    expect(clampInt(Number.NaN, 1, 60, 5)).toBe(5);
  });

  it("parses bounded integers from strings", () => {
    expect(parseBoundedInt("12", 3, 120, 8)).toBe(12);
    expect(parseBoundedInt("bad", 3, 120, 8)).toBe(8);
  });
});
