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
      buildSavedRows([{ tagPath: "study", listName: "Study" }], "mtd-sync")
    ).toEqual([
      {
        id: "saved-0-study",
        displayTag: "#mtd-sync/study",
        listName: "Study",
        saved: true,
      },
    ]);
  });

  it("validates namespace-only tags", () => {
    const row: RouteRow = {
      id: "draft-1",
      displayTag: "#mtd-sync",
      listName: "Study",
      saved: false,
    };
    expect(validateRouteRow(row, [row], "mtd-sync")).toBe("namespace");
  });

  it("commits a valid row", () => {
    const row: RouteRow = {
      id: "draft-1",
      displayTag: "#mtd-sync/study",
      listName: " Study ",
      saved: false,
    };
    expect(commitRouteRow(row, "mtd-sync")).toEqual({
      id: "draft-1",
      displayTag: "#mtd-sync/study",
      listName: "Study",
      saved: true,
    });
  });

  it("collects saved entries and rejects duplicates", () => {
    const rows: RouteRow[] = [
      {
        id: "saved-1",
        displayTag: "#mtd-sync/study",
        listName: "Study",
        saved: true,
      },
      {
        id: "saved-2",
        displayTag: "#mtd-sync/work",
        listName: "Work",
        saved: true,
      },
    ];
    expect(entriesFromRows(rows, "mtd-sync")).toEqual([
      { tagPath: "study", listName: "Study" },
      { tagPath: "work", listName: "Work" },
    ]);

    const duplicateRows: RouteRow[] = [
      ...rows,
      {
        id: "saved-3",
        displayTag: "#mtd-sync/STUDY",
        listName: "Duplicate",
        saved: true,
      },
    ];
    expect(entriesFromRows(duplicateRows, "mtd-sync")).toBeNull();
  });

  it("creates a default draft tag", () => {
    expect(defaultRouteDisplayTag("#mtd-sync")).toBe("#mtd-sync/");
    expect(defaultRouteDisplayTag("")).toBe("#mtd-sync/");
  });
});
