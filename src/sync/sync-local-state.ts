import type { ListItemCache } from "obsidian";
import { collectMtdIdsInLines } from "../parse/mtd-index";
import { scanFileForSyncTasks } from "../parse/file-task-scanner";
import type { MtdPluginSettings } from "../settings/types";
import type { SyncIndexEntry } from "../types/sync";
import type { SyncIndex } from "./sync-index";

/** Index entries whose mtd:id remains in the vault but the sync tag was removed (sync paused). */
export function findUntaggedIndexEntries(
  index: SyncIndex,
  filePath: string,
  mtdIdsInFile: Set<string>,
  eligibleMtdIds: Set<string>
): SyncIndexEntry[] {
  return index.forFile(filePath).filter(
    (entry) => mtdIdsInFile.has(entry.mtdId) && !eligibleMtdIds.has(entry.mtdId)
  );
}

/**
 * Count paused (untagged-but-mapped) entries. Does not remove index rows —
 * removing the mapping is what caused inbound recreate after users stopped sync.
 */
export function countUntaggedIndexEntriesForFile(
  index: SyncIndex,
  filePath: string,
  lines: string[],
  listItems: ListItemCache[],
  settings: MtdPluginSettings
): number {
  const mtdIdsInFile = collectMtdIdsInLines(lines);
  const tasks = scanFileForSyncTasks(filePath, lines, listItems, settings);
  const eligibleMtdIds = new Set(
    tasks.map((task) => task.mtd.id).filter((id): id is string => !!id)
  );
  return findUntaggedIndexEntries(index, filePath, mtdIdsInFile, eligibleMtdIds).length;
}

export function touchLocalTaskModified(
  entry: SyncIndexEntry,
  fileMtime: number,
  localFieldsDirty: boolean,
  localNoteDirty: boolean
): void {
  if (localFieldsDirty || localNoteDirty) {
    entry.obsidianModified = fileMtime;
  }
}

export function localTaskModifiedMs(entry: SyncIndexEntry, fileMtime: number): number {
  return entry.obsidianModified ?? fileMtime;
}
