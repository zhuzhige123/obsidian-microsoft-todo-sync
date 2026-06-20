import { describe, expect, it } from "vitest";
import { appendInboundTaskBlock } from "../parse/inbound-insert";
import {
  buildInboundTaskBlock,
  ensureVaultParentFolders,
} from "./inbound-task-writer";
import type { MtdPluginSettings } from "../settings/types";
import type { GraphChecklistItem, GraphTodoTask } from "../types/graph";
import { DEFAULT_SETTINGS } from "../settings/defaults";

const settings: MtdPluginSettings = {
  ...DEFAULT_SETTINGS,
  syncTag: "mtd-sync",
};

describe("inbound-task-writer", () => {
  it("strips inbound route header from note body", () => {
    const remote: GraphTodoTask = {
      id: "task-route",
      title: "Routed task",
      status: "notStarted",
      body: { content: "page: [[周会笔记#本周待办]]\n---\nOnly user text" },
    };

    const block = buildInboundTaskBlock(
      remote,
      [],
      settings,
      { vaultPath: "Microsoft To Do/Inbox.md" },
      0
    );

    expect(block.lines.join("\n")).toContain("Only user text");
    expect(block.lines.join("\n")).not.toContain("[[周会笔记");
  });

  it("uses base sync tag on default inbound route", () => {
    const block = buildInboundTaskBlock(
      { id: "t", title: "Captured", status: "notStarted" },
      [],
      settings,
      { vaultPath: "Microsoft To Do/Inbox.md" },
      0
    );
    expect(block.lines[0]).toContain("#mtd-sync");
    expect(block.lines[0]).not.toMatch(/#mtd-sync\//);
  });

  it("builds parent line with sync tag and subtasks", () => {
    const remote: GraphTodoTask = {
      id: "task-1",
      title: "Phone capture",
      status: "notStarted",
      body: { content: "User note\n\n---\n在 Obsidian 中打开：\nobsidian://mtd-sync?task=mtd-old" },
    };
    const checklist: GraphChecklistItem[] = [
      { id: "step-a", displayName: "Step A", isChecked: false },
      { id: "step-b", displayName: "Step B", isChecked: true },
    ];

    const block = buildInboundTaskBlock(
      remote,
      checklist,
      settings,
      {
        vaultPath: "Microsoft To Do/Inbox.md",
        tagPath: "capture",
      },
      0
    );

    expect(block.lines[0]).toContain("- [ ] Phone capture");
    expect(block.lines[0]).toContain("#mtd-sync/capture");
    expect(block.lines[0]).toMatch(/<!-- mtd:id=mtd-[0-9a-f]{8} -->/);
    expect(block.lines[1]).toContain("- [ ] Step A");
    expect(block.lines[1]).toContain("<!-- mtd:step=step-1 -->");
    expect(block.lines[2]).toContain("- [x] Step B");
    expect(block.steps["step-1"]).toBe("step-a");
    expect(block.steps["step-2"]).toBe("step-b");
    expect(block.lines.join("\n")).toContain("User note");
    expect(block.lines.join("\n")).not.toContain("obsidian://mtd-sync");
  });

  it("appends inbound block at file end", () => {
    const existing = ["# Inbox", "- [ ] existing"];
    const block = buildInboundTaskBlock(
      { id: "t", title: "New", status: "notStarted" },
      [],
      settings,
      { vaultPath: "Microsoft To Do/Inbox.md" },
      3
    );
    const appended = appendInboundTaskBlock(existing, block.lines);
    expect(appended.parentLine).toBe(3);
    expect(appended.lines[2]).toBe("");
    expect(appended.lines[3]).toContain("New");
  });

  it("creates missing parent folders before inbound file creation", async () => {
    const createdFolders: string[] = [];
    const files = new Map<string, { path: string; extension: string }>();
    const folders = new Set<string>();

    const vault = {
      getAbstractFileByPath(path: string) {
        if (files.has(path)) {
          return files.get(path);
        }
        if (folders.has(path)) {
          return { path, children: {} };
        }
        return null;
      },
      createFolder: async (path: string) => {
        createdFolders.push(path);
        folders.add(path);
        return { path, children: {} };
      },
      create: async (path: string, _content: string) => {
        const file = { path, extension: "md" };
        files.set(path, file);
        return file;
      },
    };

    await ensureVaultParentFolders(vault as never, "Microsoft To Do/Inbox.md");
    expect(createdFolders).toEqual(["Microsoft To Do"]);
  });
});
