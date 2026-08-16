import type { MtdPluginSettings } from "../settings/types";
import type { TodoApi } from "../graph/todo-api";
import { SyncIndex } from "./sync-index";

export async function syncLinkedResource(
  todoApi: TodoApi,
  listId: string,
  graphTaskId: string,
  mtdId: string,
  title: string,
  uri: string,
  settings: MtdPluginSettings
): Promise<string | undefined> {
  if (!settings.createLinkedResource) {
    return undefined;
  }
  const resources = await todoApi.listLinkedResources(listId, graphTaskId);
  const found = resources.find((r) => r.externalId === mtdId);
  if (found?.id) {
    if (found.webUrl !== uri) {
      await todoApi.updateLinkedResource(listId, graphTaskId, found.id, {
        webUrl: uri,
      });
    }
    return found.id;
  }
  const created = await todoApi.createLinkedResource(listId, graphTaskId, {
    applicationName: "Obsidian",
    displayName: title,
    webUrl: uri,
    externalId: mtdId,
  });
  return created.id;
}

export async function attachLinkedResourceId(
  index: SyncIndex,
  mtdId: string,
  linkedResourceId: string | undefined
): Promise<void> {
  if (!linkedResourceId) {
    return;
  }
  const current = index.getByMtdId(mtdId);
  if (!current) {
    return;
  }
  index.upsert({ ...current, linkedResourceId });
}

export async function syncAndAttachLinkedResource(
  todoApi: TodoApi,
  options: {
    listId: string;
    graphTaskId: string;
    mtdId: string;
    title: string;
    uri: string;
    settings: MtdPluginSettings;
    index: SyncIndex;
  }
): Promise<void> {
  const linkedResourceId = await syncLinkedResource(
    todoApi,
    options.listId,
    options.graphTaskId,
    options.mtdId,
    options.title,
    options.uri,
    options.settings
  );
  await attachLinkedResourceId(options.index, options.mtdId, linkedResourceId);
}
