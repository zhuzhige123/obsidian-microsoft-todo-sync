import type { TodoApi } from "./todo-api";
import type { GraphChecklistItem, GraphTodoTask } from "../types/graph";

/** Prefer checklistItems from an expanded delta/get payload; fetch only when absent. */
export async function resolveTaskChecklist(
  todoApi: TodoApi,
  listId: string,
  task: GraphTodoTask
): Promise<GraphChecklistItem[]> {
  if (Array.isArray(task.checklistItems)) {
    return task.checklistItems;
  }
  return todoApi.listChecklistItems(listId, task.id);
}
