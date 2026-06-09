import { GraphApiError, type GraphClient } from "./graph-client";
import type {
  GraphChecklistItem,
  GraphDeltaResponse,
  GraphLinkedResource,
  GraphTodoTask,
  GraphTodoTaskList,
} from "../types/graph";

export class TodoApi {
  constructor(private readonly graph: GraphClient) {}

  async listTaskLists(): Promise<GraphTodoTaskList[]> {
    const data = await this.graph.request<{ value: GraphTodoTaskList[] }>("GET", "/me/todo/lists");
    return data.value ?? [];
  }

  async createTaskList(displayName: string): Promise<GraphTodoTaskList> {
    return this.graph.request<GraphTodoTaskList>("POST", "/me/todo/lists", { displayName });
  }

  async ensureTaskList(displayName: string): Promise<GraphTodoTaskList> {
    const lists = await this.listTaskLists();
    const existing = lists.find((list) => list.displayName === displayName);
    if (existing) {
      return existing;
    }
    return this.createTaskList(displayName);
  }

  async createTask(listId: string, task: Record<string, unknown>): Promise<GraphTodoTask> {
    return this.graph.request<GraphTodoTask>("POST", `/me/todo/lists/${listId}/tasks`, task);
  }

  async getTask(listId: string, taskId: string): Promise<GraphTodoTask> {
    return this.graph.request<GraphTodoTask>("GET", `/me/todo/lists/${listId}/tasks/${taskId}`);
  }

  async updateTask(listId: string, taskId: string, patch: Record<string, unknown>): Promise<GraphTodoTask> {
    return this.graph.request<GraphTodoTask>("PATCH", `/me/todo/lists/${listId}/tasks/${taskId}`, patch);
  }

  async deleteTask(listId: string, taskId: string): Promise<void> {
    await this.graph.request<void>("DELETE", `/me/todo/lists/${listId}/tasks/${taskId}`);
  }

  /** Deletes a remote task; returns false when the item is already gone (404). */
  async deleteTaskIfExists(listId: string, taskId: string): Promise<boolean> {
    try {
      await this.deleteTask(listId, taskId);
      return true;
    } catch (error) {
      if (error instanceof GraphApiError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  async listChecklistItems(listId: string, taskId: string): Promise<GraphChecklistItem[]> {
    const data = await this.graph.request<{ value: GraphChecklistItem[] }>(
      "GET",
      `/me/todo/lists/${listId}/tasks/${taskId}/checklistItems`
    );
    return data.value ?? [];
  }

  async createChecklistItem(
    listId: string,
    taskId: string,
    displayName: string,
    isChecked = false
  ): Promise<GraphChecklistItem> {
    return this.graph.request<GraphChecklistItem>(
      "POST",
      `/me/todo/lists/${listId}/tasks/${taskId}/checklistItems`,
      { displayName, isChecked }
    );
  }

  async updateChecklistItem(
    listId: string,
    taskId: string,
    itemId: string,
    patch: Partial<GraphChecklistItem>
  ): Promise<GraphChecklistItem> {
    return this.graph.request<GraphChecklistItem>(
      "PATCH",
      `/me/todo/lists/${listId}/tasks/${taskId}/checklistItems/${itemId}`,
      patch
    );
  }

  async deleteChecklistItem(listId: string, taskId: string, itemId: string): Promise<void> {
    await this.graph.request<void>(
      "DELETE",
      `/me/todo/lists/${listId}/tasks/${taskId}/checklistItems/${itemId}`
    );
  }

  async listLinkedResources(listId: string, taskId: string): Promise<GraphLinkedResource[]> {
    const data = await this.graph.request<{ value: GraphLinkedResource[] }>(
      "GET",
      `/me/todo/lists/${listId}/tasks/${taskId}/linkedResources`
    );
    return data.value ?? [];
  }

  async createLinkedResource(
    listId: string,
    taskId: string,
    resource: GraphLinkedResource
  ): Promise<GraphLinkedResource> {
    return this.graph.request<GraphLinkedResource>(
      "POST",
      `/me/todo/lists/${listId}/tasks/${taskId}/linkedResources`,
      resource
    );
  }

  async deltaTasks(listId: string, deltaLink?: string): Promise<GraphDeltaResponse<GraphTodoTask>> {
    const url =
      deltaLink ??
      `https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks/delta`;
    return this.graph.requestRawUrl<GraphDeltaResponse<GraphTodoTask>>("GET", url);
  }
}
