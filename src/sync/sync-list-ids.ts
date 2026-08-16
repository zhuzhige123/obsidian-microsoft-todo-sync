import type { TodoApi } from "../graph/todo-api";
import type { MtdPluginSettings } from "../settings/types";
import { collectManagedListNames } from "../parse/sync-tag";
import { SyncIndex } from "./sync-index";

export async function ensureListId(
  todoApi: TodoApi,
  listName: string,
  cache: Map<string, string>
): Promise<string> {
  const cached = cache.get(listName);
  if (cached) {
    return cached;
  }
  const list = await todoApi.ensureTaskList(listName);
  cache.set(listName, list.id);
  return list.id;
}

/** Resolve a list id for delta poll without creating missing lists. */
export async function resolveListIdForPoll(
  todoApi: TodoApi,
  listName: string,
  cache: Map<string, string>,
  listsByName?: Map<string, string>
): Promise<string | undefined> {
  const cached = cache.get(listName);
  if (cached) {
    return cached;
  }
  const nameToId =
    listsByName ??
    new Map((await todoApi.listTaskLists()).map((list) => [list.displayName, list.id]));
  if (!listsByName) {
    for (const [name, id] of nameToId.entries()) {
      cache.set(name, id);
    }
  }
  const id = nameToId.get(listName);
  if (id) {
    cache.set(listName, id);
  }
  return id;
}

export async function collectPollListIds(
  todoApi: TodoApi,
  settings: MtdPluginSettings,
  index: SyncIndex,
  cache: Map<string, string>
): Promise<string[]> {
  const ids = new Set<string>();
  const remoteLists = await todoApi.listTaskLists();
  const listsByName = new Map(remoteLists.map((list) => [list.displayName, list.id]));
  for (const [name, id] of listsByName.entries()) {
    cache.set(name, id);
  }
  for (const name of collectManagedListNames(settings)) {
    const id = await resolveListIdForPoll(todoApi, name, cache, listsByName);
    if (id) {
      ids.add(id);
    }
  }
  for (const entry of index.all()) {
    if (entry.graphListId) {
      ids.add(entry.graphListId);
    }
  }
  return [...ids];
}

export async function buildListIdToNameMap(
  todoApi: TodoApi,
  settings: MtdPluginSettings,
  index: SyncIndex,
  listIdByName: Map<string, string>
): Promise<Map<string, string>> {
  const listIdToName = new Map<string, string>();
  for (const [name, id] of listIdByName.entries()) {
    listIdToName.set(id, name);
  }
  try {
    const lists = await todoApi.listTaskLists();
    for (const list of lists) {
      listIdToName.set(list.id, list.displayName);
    }
  } catch (error) {
    window.console.warn("Microsoft To Do sync: could not list task lists", error);
  }
  for (const name of collectManagedListNames(settings)) {
    const id = listIdByName.get(name);
    if (id) {
      listIdToName.set(id, name);
    }
  }
  for (const entry of index.all()) {
    if (entry.graphListId && !listIdToName.has(entry.graphListId)) {
      listIdToName.set(entry.graphListId, settings.todoListName);
    }
  }
  return listIdToName;
}
