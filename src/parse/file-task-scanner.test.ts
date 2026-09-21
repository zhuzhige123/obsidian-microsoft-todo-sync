import { describe, expect, it } from "vitest";
import { collectMtdIdsInLines, scanFileForSyncTasks } from "./file-task-scanner";

describe("file-task-scanner", () => {
  it("finds tagged tasks from raw lines without metadata cache", () => {
    const lines = ["- [ ] 测试 #mct", "- [ ] other task"];
    const tasks = scanFileForSyncTasks("note.md", lines, [], "mct");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe("测试");
  });

  it("finds tagged tasks inside callouts", () => {
    const lines = [
      "> [!summary] 今天做了什么",
      "> - [ ] 测试 #msd",
      "- [ ] outside task",
    ];
    const tasks = scanFileForSyncTasks("note.md", lines, [], "msd");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe("测试");
    expect(tasks[0]?.quoteDepth).toBe(1);
  });

  it("merges list-item scan with line scan for callout tasks", () => {
    const lines = ["- [ ] normal #msd", "> - [ ] callout #msd"];
    const listItems = [
      {
        task: " ",
        parent: -1,
        position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 20, offset: 20 } },
      },
    ] as never[];
    const tasks = scanFileForSyncTasks("note.md", lines, listItems, "msd");
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.title)).toEqual(["normal", "callout"]);
  });

  it("assigns target list from sub-tag routes", () => {
    const lines = [
      "- [ ] 基础 #msd/基础任务",
      "- [ ] 学习 #msd/学习任务",
      "- [ ] 默认 #msd",
    ];
    const scope = {
      syncTag: "msd",
      todoListName: "Obsidian Sync",
      defaultInboundVaultPath: "Microsoft To Do/Inbox.md",
      listRoutes: [
        { tagPath: "基础任务", listName: "MSD 基础", vaultPath: "Care/Basic.md" },
        { tagPath: "学习任务", listName: "MSD 学习", vaultPath: "Study/Tasks.md" },
      ],
    };
    const tasks = scanFileForSyncTasks("note.md", lines, [], scope);
    expect(tasks.map((t) => t.targetListName)).toEqual([
      "MSD 基础",
      "MSD 学习",
      "Obsidian Sync",
    ]);
  });

  it("ignores tasks that only have mtd metadata without the sync tag", () => {
    const lines = [
      '- [ ] synced <!-- mtd:id=mtd-old graph=abc -->',
      "- [ ] keep local only",
    ];
    const tasks = scanFileForSyncTasks("note.md", lines, [], "mct");
    expect(tasks).toHaveLength(0);
    expect(collectMtdIdsInLines(lines)).toEqual(new Set(["mtd-old"]));
  });

  it("skips files under excluded folders", () => {
    const lines = ["- [ ] template task #mct"];
    const scope = {
      syncTag: "mct",
      todoListName: "Obsidian Sync",
      defaultInboundVaultPath: "Microsoft To Do/Inbox.md",
      listRoutes: [],
      excludedFolders: ["Templates"],
    };
    expect(scanFileForSyncTasks("Templates/demo.md", lines, [], scope)).toHaveLength(0);
    expect(scanFileForSyncTasks("Notes/demo.md", lines, [], scope)).toHaveLength(1);
  });
});
