import { describe, expect, it } from "vitest";
import { getDeltaLink, normalizeSyncMeta, setDeltaLink } from "./sync-meta";

describe("sync-meta", () => {
  it("migrates legacy single-list delta into deltaLinks", () => {
    expect(
      normalizeSyncMeta({
        todoListId: "list-1",
        deltaLink: "https://delta",
      })
    ).toEqual({
      deltaLinks: { "list-1": "https://delta" },
    });
  });

  it("reads and writes per-list delta links", () => {
    const meta = setDeltaLink({ deltaLinks: {} }, "list-a", "https://a");
    expect(getDeltaLink(meta, "list-a")).toBe("https://a");
    expect(getDeltaLink(setDeltaLink(meta, "list-a", undefined), "list-a")).toBeUndefined();
  });
});
