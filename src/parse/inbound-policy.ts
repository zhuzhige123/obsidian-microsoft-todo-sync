import { collectManagedListNames, type SyncScopeSettings } from "./sync-tag";

/**
 * Inbound (To Do → Obsidian) only applies to Obsidian-dedicated lists configured in settings:
 * the default `todoListName` plus each `listRoutes[].listName`.
 */
export function isInboundAllowedList(listName: string, settings: SyncScopeSettings): boolean {
  const trimmed = listName.trim();
  if (!trimmed) {
    return false;
  }
  return collectManagedListNames(settings).includes(trimmed);
}
