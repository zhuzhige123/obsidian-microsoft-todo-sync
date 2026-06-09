import { describe, expect, it } from "vitest";
import { normalizeSettings } from "./defaults";

describe("normalizeSettings", () => {
  it("strips leading # from sync tag", () => {
    expect(normalizeSettings({ syncTag: "#mtd-sync" }).syncTag).toBe("mtd-sync");
  });

  it("clamps delta interval", () => {
    expect(normalizeSettings({ deltaIntervalMinutes: 0 }).deltaIntervalMinutes).toBe(1);
    expect(normalizeSettings({ deltaIntervalMinutes: 99 }).deltaIntervalMinutes).toBe(60);
  });

  it("clears stored account display name", () => {
    expect(normalizeSettings({ accountDisplayName: "Real Name" }).accountDisplayName).toBe("");
  });

  it("normalizes list routes", () => {
    expect(
      normalizeSettings({
        listRoutes: [
          { tagPath: "study", listName: "Study" },
          { tagPath: "", listName: "Bad" },
        ],
      }).listRoutes
    ).toEqual([{ tagPath: "study", listName: "Study" }]);
  });
});
