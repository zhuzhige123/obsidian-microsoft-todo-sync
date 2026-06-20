import { describe, expect, it } from "vitest";
import { isInboundAllowedList } from "./inbound-policy";

const settings = {
  syncTag: "mtd-sync",
  todoListName: "Obsidian Sync",
  defaultInboundVaultPath: "Microsoft To Do/Inbox.md",
  listRoutes: [{ tagPath: "work", listName: "Obsidian Work", vaultPath: "Work.md" }],
};

describe("inbound-policy", () => {
  it("allows only dedicated sync lists", () => {
    expect(isInboundAllowedList("Obsidian Sync", settings)).toBe(true);
    expect(isInboundAllowedList("Obsidian Work", settings)).toBe(true);
    expect(isInboundAllowedList("Shopping", settings)).toBe(false);
    expect(isInboundAllowedList("", settings)).toBe(false);
  });
});
