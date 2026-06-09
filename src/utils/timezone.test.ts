import { describe, expect, it } from "vitest";
import { normalizeGraphLocalDateTime } from "./timezone";

describe("timezone", () => {
  it("normalizes date and time for Graph", () => {
    expect(normalizeGraphLocalDateTime("2026-06-10T12:00")).toBe(
      "2026-06-10T12:00:00.0000000"
    );
    expect(normalizeGraphLocalDateTime("2026-06-10")).toBe("2026-06-10T09:00:00.0000000");
  });
});
