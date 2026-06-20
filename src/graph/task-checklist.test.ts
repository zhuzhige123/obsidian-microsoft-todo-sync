import { describe, expect, it, vi } from "vitest";
import { resolveTaskChecklist } from "./task-checklist";
import type { TodoApi } from "./todo-api";

describe("resolveTaskChecklist", () => {
  it("returns expanded checklist without fetching", async () => {
    const listChecklistItems = vi.fn();
    const todoApi = { listChecklistItems } as unknown as TodoApi;
    const items = [{ id: "s1", displayName: "A", isChecked: false }];
    const result = await resolveTaskChecklist(todoApi, "list-1", {
      id: "task-1",
      title: "T",
      checklistItems: items,
    });
    expect(result).toEqual(items);
    expect(listChecklistItems).not.toHaveBeenCalled();
  });

  it("fetches checklist when expand payload is absent", async () => {
    const listChecklistItems = vi.fn().mockResolvedValue([
      { id: "s2", displayName: "B", isChecked: true },
    ]);
    const todoApi = { listChecklistItems } as unknown as TodoApi;
    const result = await resolveTaskChecklist(todoApi, "list-1", {
      id: "task-1",
      title: "T",
    });
    expect(listChecklistItems).toHaveBeenCalledWith("list-1", "task-1");
    expect(result).toHaveLength(1);
  });
});
