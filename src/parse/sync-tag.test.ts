import { describe, expect, it } from "vitest";
import {
  extractTags,
  formatListRoutesText,
  formatRouteDisplayTag,
  hasSyncTag,
  normalizeInboundVaultPath,
  parseListRoutesText,
  parseRouteDisplayInput,
  resolveInboundRoute,
  resolveTargetListName,
  stripHashTags,
} from "./sync-tag";

const scope = {
  syncTag: "msd",
  todoListName: "Obsidian Sync",
  defaultInboundVaultPath: "Microsoft To Do/Inbox.md",
  listRoutes: [
    { tagPath: "基础任务", listName: "MSD 基础", vaultPath: "Care/Basic.md" },
    { tagPath: "学习任务", listName: "MSD 学习", vaultPath: "Study/Tasks.md" },
  ],
};

describe("sync-tag", () => {
  it("extracts unicode nested tags", () => {
    expect(extractTags("- [ ] 任务 #msd/基础任务")).toEqual(["msd/基础任务"]);
  });

  it("detects namespace and sub-tags without false positives", () => {
    expect(hasSyncTag("- [ ] a #msd", "msd")).toBe(true);
    expect(hasSyncTag("- [ ] a #msd/基础任务", "msd")).toBe(true);
    expect(hasSyncTag("- [ ] a #msdfoo", "msd")).toBe(false);
    expect(hasSyncTag("- [ ] a #other", "msd")).toBe(false);
  });

  it("routes sub-tags to configured lists", () => {
    expect(resolveTargetListName("- [ ] a #msd/基础任务", scope)).toBe("MSD 基础");
    expect(resolveTargetListName("- [ ] a #msd/学习任务", scope)).toBe("MSD 学习");
    expect(resolveTargetListName("- [ ] a #msd", scope)).toBe("Obsidian Sync");
  });

  it("prefers the longest matching route", () => {
    const routes = {
      ...scope,
      listRoutes: [
        { tagPath: "基础", listName: "Short", vaultPath: "A.md" },
        { tagPath: "基础任务", listName: "Long", vaultPath: "B.md" },
      ],
    };
    expect(resolveTargetListName("- [ ] a #msd/基础任务", routes)).toBe("Long");
  });

  it("strips hash tags from titles including unicode", () => {
    expect(stripHashTags("任务 #msd/基础任务 继续")).toBe("任务  继续");
  });

  it("formats and parses display tags for the routes table", () => {
    expect(formatRouteDisplayTag("msd", "基础护理")).toBe("#msd/基础护理");
    expect(parseRouteDisplayInput("#msd/基础护理", "msd")).toEqual({ tagPath: "基础护理" });
    expect(parseRouteDisplayInput("基础护理", "msd")).toEqual({ tagPath: "基础护理" });
    expect(parseRouteDisplayInput("#msd", "msd").error).toBe("namespace_only");
  });

  it("parses mixed-case route prefixes case-insensitively", () => {
    expect(parseRouteDisplayInput("#MSD/基础护理", "msd")).toEqual({ tagPath: "基础护理" });
    expect(parseRouteDisplayInput("#msd/基础护理", "MSD")).toEqual({ tagPath: "基础护理" });
    expect(resolveTargetListName("- [ ] a #MSD/基础任务", scope)).toBe("MSD 基础");
  });

  it("parses and formats list route text", () => {
    const text = "基础任务 | MSD 基础 | Care/Basic.md\n学习任务 | MSD 学习 | Study/Tasks.md";
    expect(parseListRoutesText(text)).toEqual([
      { tagPath: "基础任务", listName: "MSD 基础", vaultPath: "Care/Basic.md" },
      { tagPath: "学习任务", listName: "MSD 学习", vaultPath: "Study/Tasks.md" },
    ]);
    expect(formatListRoutesText(parseListRoutesText(text))).toBe(
      "基础任务 | MSD 基础 | Care/Basic.md\n学习任务 | MSD 学习 | Study/Tasks.md"
    );
  });

  it("resolves inbound routes from list names", () => {
    expect(resolveInboundRoute("MSD 基础", scope)).toEqual({
      vaultPath: "Care/Basic.md",
      tagPath: "基础任务",
    });
    expect(resolveInboundRoute("Obsidian Sync", scope)).toEqual({
      vaultPath: "Microsoft To Do/Inbox.md",
    });
  });

  it("normalizes inbound vault paths", () => {
    expect(normalizeInboundVaultPath("folder/note")).toBe("folder/note.md");
    expect(normalizeInboundVaultPath("folder/note.md")).toBe("folder/note.md");
  });
});
