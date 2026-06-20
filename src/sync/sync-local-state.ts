import type { ListItemCache } from "obsidian";
import { TFile, type App } from "obsidian";
import { collectMtdIdsInLines } from "../parse/mtd-index";
import { scanFileForSyncTasks } from "../parse/file-task-scanner";
import type { MtdPluginSettings } from "../settings/types";
import type { SyncIndexEntry } from "../types/sync";
import type { SyncIndex } from "./sync-index";

/** Index entries whose mtd:id remains in the vault but the sync tag was removed. */
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

export function removeUntaggedIndexEntriesForFile(
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
  const untagged = findUntaggedIndexEntries(index, filePath, mtdIdsInFile, eligibleMtdIds);
  for (const entry of untagged) {
    index.removeByMtdId(entry.mtdId);
  }
  return untagged.length;
}

/** Scans only vault paths referenced by the sync index (not the whole vault). */
export async function removeUntaggedIndexEntriesInVault(
  app: App,
  index: SyncIndex,
  settings: MtdPluginSettings
): Promise<number> {
  const paths = [...new Set(index.all().map((entry) => entry.vaultPath))];
  let removed = 0;
  for (const path of paths) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      continue;
    }
    const content = await app.vault.read(file);
    const cache = app.metadataCache.getFileCache(file);
    removed += removeUntaggedIndexEntriesForFile(
      index,
      path,
      content.split("\n"),
      cache?.listItems ?? [],
      settings
    );
  }
  return removed;
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
