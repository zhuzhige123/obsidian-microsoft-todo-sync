import { GraphApiError } from "../graph/graph-client";
import type { TodoApi } from "../graph/todo-api";
import { stripBacklinkFromBody } from "./backlink-writer";
import type { MtdPluginSettings } from "../settings/types";
import type { SyncIndexEntry } from "../types/sync";

export async function cleanupRemoteOnUnlink(
  todoApi: TodoApi,
  entry: SyncIndexEntry,
  settings: MtdPluginSettings
): Promise<void> {
  if (!settings.cleanupRemoteOnUnlink) {
    return;
  }
  const { graphListId, graphTaskId } = entry;
  if (!graphListId || !graphTaskId) {
    return;
  }

  if (settings.createLinkedResource) {
    await deleteLinkedResourcesForTask(todoApi, graphListId, graphTaskId, entry);
  }

  if (settings.appendBacklinkToTodo) {
    await stripRemoteBacklinkBody(todoApi, graphListId, graphTaskId);
  }
}

async function deleteLinkedResourcesForTask(
  todoApi: TodoApi,
  listId: string,
  taskId: string,
  entry: SyncIndexEntry
): Promise<void> {
  const candidates = new Set<string>();
  if (entry.linkedResourceId) {
    candidates.add(entry.linkedResourceId);
  }

  try {
    const resources = await todoApi.listLinkedResources(listId, taskId);
    for (const resource of resources) {
      if (resource.id && resource.externalId === entry.mtdId) {
        candidates.add(resource.id);
      }
    }
  } catch (error) {
    if (!(error instanceof GraphApiError && error.status === 404)) {
      throw error;
    }
  }

  for (const resourceId of candidates) {
    try {
      await todoApi.deleteLinkedResource(listId, taskId, resourceId);
    } catch (error) {
      if (error instanceof GraphApiError && error.status === 404) {
        continue;
      }
      throw error;
    }
  }
}

async function stripRemoteBacklinkBody(
  todoApi: TodoApi,
  listId: string,
  taskId: string
): Promise<void> {
  let remoteTask;
  try {
    remoteTask = await todoApi.getTask(listId, taskId);
  } catch (error) {
    if (error instanceof GraphApiError && error.status === 404) {
      return;
    }
    throw error;
  }

  const rawBody = remoteTask.body?.content ?? "";
  const stripped = stripBacklinkFromBody(rawBody);
  if (stripped === rawBody.trimEnd()) {
    return;
  }

  await todoApi.updateTask(listId, taskId, {
    body: { content: stripped, contentType: "text" },
  });
}
