import { describe, expect, it } from "vitest";
import {
  buildSavedRows,
  commitRouteRow,
  defaultRouteDisplayTag,
  entriesFromRows,
  validateRouteRow,
  type RouteRow,
} from "./list-route-rows";

describe("list-route-rows", () => {
  it("builds saved rows with formatted tags", () => {
    expect(
      buildSavedRows(
        [{ tagPath: "study", listName: "Study", vaultPath: "Study/Tasks.md" }],
        "mtd-sync"
      )
    ).toEqual([
      {
        id: "saved-0-study",
        displayTag: "#mtd-sync/study",
        listName: "Study",
        vaultPath: "Study/Tasks.md",
        saved: true,
      },
    ]);
  });

  it("validates namespace-only tags", () => {
    const row: RouteRow = {
      id: "draft-1",
      displayTag: "#mtd-sync",
      listName: "Study",
      vaultPath: "Study/Tasks.md",
      saved: false,
    };
    expect(validateRouteRow(row, [row], "mtd-sync")).toBe("namespace");
  });

  it("commits a valid row", () => {
    const row: RouteRow = {
      id: "draft-1",
      displayTag: "#mtd-sync/study",
      listName: " Study ",
      vaultPath: " Study/Tasks.md ",
      saved: false,
    };
    expect(commitRouteRow(row, "mtd-sync")).toEqual({
      id: "draft-1",
      displayTag: "#mtd-sync/study",
      listName: "Study",
      vaultPath: "Study/Tasks.md",
      saved: true,
    });
  });

  it("collects saved entries and rejects duplicates", () => {
    const rows: RouteRow[] = [
      {
        id: "saved-1",
        displayTag: "#mtd-sync/study",
        listName: "Study",
        vaultPath: "Study/Tasks.md",
        saved: true,
      },
      {
        id: "saved-2",
        displayTag: "#mtd-sync/work",
        listName: "Work",
        vaultPath: "Work/Tasks.md",
        saved: true,
      },
    ];
    expect(entriesFromRows(rows, "mtd-sync")).toEqual([
      { tagPath: "study", listName: "Study", vaultPath: "Study/Tasks.md" },
      { tagPath: "work", listName: "Work", vaultPath: "Work/Tasks.md" },
    ]);

    const duplicateRows: RouteRow[] = [
      ...rows,
      {
        id: "saved-3",
        displayTag: "#mtd-sync/STUDY",
        listName: "Duplicate",
        vaultPath: "Other.md",
        saved: true,
      },
    ];
    expect(entriesFromRows(duplicateRows, "mtd-sync")).toBeNull();
  });

  it("rejects the same list mapped to different files", () => {
    const rows: RouteRow[] = [
      {
        id: "saved-1",
        displayTag: "#mtd-sync/study",
        listName: "Study",
        vaultPath: "Study/A.md",
        saved: true,
      },
      {
        id: "saved-2",
        displayTag: "#mtd-sync/work",
        listName: "Study",
        vaultPath: "Study/B.md",
        saved: true,
      },
    ];
    expect(entriesFromRows(rows, "mtd-sync")).toBeNull();
    expect(
      validateRouteRow(rows[1]!, rows, "mtd-sync")
    ).toBe("list_conflict");
  });

  it("creates a default draft tag", () => {
    expect(defaultRouteDisplayTag("#mtd-sync")).toBe("#mtd-sync/");
    expect(defaultRouteDisplayTag("")).toBe("#mtd-sync/");
  });
});
