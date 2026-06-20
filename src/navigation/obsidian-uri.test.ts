import { describe, expect, it } from "vitest";
import {
  buildObsidianTaskUri,
  decodeObsidianUriParam,
  parseMtdIdFromUriParam,
  parseTaskLinkParams,
  vaultMatchesUriTarget,
} from "./obsidian-uri";

describe("obsidian-uri", () => {
  it("builds id-only links by default", () => {
    const uri = buildObsidianTaskUri({
      mtdId: "mtd-9f8513a9",
      vaultIdentifier: "462303086c39cdfb",
    });
    expect(uri).toBe("obsidian://mtd-sync?vault=462303086c39cdfb&task=mtd-9f8513a9");
  });

  it("encodes full legacy links with file and line", () => {
    const uri = buildObsidianTaskUri({
      format: "full",
      vaultIdentifier: "plugin testing library",
      filePath: "20-领域/日记/2026-06-10.md",
      mtdId: "mtd-9f8513a9",
      lineNumber: 18,
    });
    expect(uri).toContain("vault=plugin%20testing%20library");
    expect(uri).not.toContain("vault=plugin+testing");
    expect(uri).toContain("task=mtd-9f8513a9");
    expect(uri).toContain("line=19");
  });

  it("prefers vault id tokens without encoding issues", () => {
    const uri = buildObsidianTaskUri({
      format: "full",
      vaultIdentifier: "462303086c39cdfb",
      filePath: "note.md",
      mtdId: "mtd-abc12345",
    });
    expect(uri).toBe(
      "obsidian://mtd-sync?vault=462303086c39cdfb&file=note&task=mtd-abc12345"
    );
  });

  it("parses id-only task link params", () => {
    expect(
      parseTaskLinkParams({
        task: "mtd-abc12345",
        vault: "462303086c39cdfb",
      })
    ).toEqual({
      mtdId: "mtd-abc12345",
      vaultParam: "462303086c39cdfb",
      filePath: undefined,
      lineHint: undefined,
    });
  });

  it("ignores invalid line hints", () => {
    expect(parseTaskLinkParams({ task: "mtd-abc", line: "0" })?.lineHint).toBeUndefined();
    expect(parseTaskLinkParams({ task: "mtd-abc", line: "-1" })?.lineHint).toBeUndefined();
    expect(parseTaskLinkParams({ task: "mtd-abc", line: "5" })?.lineHint).toBe(5);
  });

  it("decodes + as space for legacy links", () => {
    expect(decodeObsidianUriParam("plugin+testing+library")).toBe("plugin testing library");
    expect(decodeObsidianUriParam("plugin%20testing%20library")).toBe("plugin testing library");
  });

  it("matches vault by id or display name", () => {
    const app = {
      vault: { getName: () => "plugin testing library" },
      appId: "462303086c39cdfb",
    } as unknown as Parameters<typeof vaultMatchesUriTarget>[0];

    expect(vaultMatchesUriTarget(app, "462303086c39cdfb")).toBe(true);
    expect(vaultMatchesUriTarget(app, "plugin+testing+library")).toBe(true);
    expect(vaultMatchesUriTarget(app, "other")).toBe(false);
  });

  it("extracts mtd id prefix when link text was corrupted", () => {
    expect(parseMtdIdFromUriParam("mtd-9f8513a9+recur%3Dqd")).toBe("mtd-9f8513a9");
    expect(parseMtdIdFromUriParam("mtd-9f8513a9")).toBe("mtd-9f8513a9");
  });
});
