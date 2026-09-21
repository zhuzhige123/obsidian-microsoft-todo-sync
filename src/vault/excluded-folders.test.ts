import { describe, expect, it } from "vitest";
import {
  commitExcludedFolder,
  isVaultPathExcluded,
  normalizeExcludedFolderPath,
  normalizeExcludedFolders,
} from "./excluded-folders";

describe("excluded-folders", () => {
  it("normalizes folder paths", () => {
    expect(normalizeExcludedFolderPath("  Templates/ ")).toBe("Templates");
    expect(normalizeExcludedFolderPath("/Templates\\sub/")).toBe("Templates/sub");
    expect(normalizeExcludedFolderPath("   ")).toBe("");
  });

  it("dedupes folders case-insensitively", () => {
    expect(normalizeExcludedFolders(["Templates", "templates/", "", "Other"])).toEqual([
      "Templates",
      "Other",
    ]);
  });

  it("adds a folder and drops nested exclusions", () => {
    expect(commitExcludedFolder(["Templates/sub", "Archive"], "Templates")).toEqual({
      status: "added",
      folders: ["Archive", "Templates"],
    });
  });

  it("rejects duplicates and paths already covered by a parent", () => {
    expect(commitExcludedFolder(["Templates"], "templates/")).toEqual({ status: "duplicate" });
    expect(commitExcludedFolder(["Templates"], "Templates/sub")).toEqual({
      status: "covered",
      by: "Templates",
    });
    expect(commitExcludedFolder([], "   ")).toEqual({ status: "empty" });
  });

  it("matches files under excluded folders only", () => {
    const folders = ["Templates", "Archive/Old"];
    expect(isVaultPathExcluded("Templates/todo.md", folders)).toBe(true);
    expect(isVaultPathExcluded("Templates/nested/a.md", folders)).toBe(true);
    expect(isVaultPathExcluded("Archive/Old/x.md", folders)).toBe(true);
    expect(isVaultPathExcluded("TemplatesExtra/todo.md", folders)).toBe(false);
    expect(isVaultPathExcluded("Notes/todo.md", folders)).toBe(false);
    expect(isVaultPathExcluded("Archive/other.md", folders)).toBe(false);
  });
});
