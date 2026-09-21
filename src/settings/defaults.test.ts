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
          { tagPath: "study", listName: "Study", vaultPath: "Study.md" },
          { tagPath: "", listName: "Bad", vaultPath: "" },
        ],
      }).listRoutes
    ).toEqual([{ tagPath: "study", listName: "Study", vaultPath: "Study.md" }]);
  });

  it("coerces invalid boolean settings on load", () => {
    expect(
      normalizeSettings({ appendBacklinkToTodo: "yes" as unknown as boolean }).appendBacklinkToTodo
    ).toBe(true);
    expect(
      normalizeSettings({ createLinkedResource: null as unknown as boolean }).createLinkedResource
    ).toBe(true);
  });

  it("normalizes excluded folders", () => {
    expect(
      normalizeSettings({
        excludedFolders: [" Templates/ ", "templates", "", "Archive"] as unknown as string[],
      }).excludedFolders
    ).toEqual(["Templates", "Archive"]);
  });
});
