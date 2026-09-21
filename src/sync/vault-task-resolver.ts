import { TFile, type App } from "obsidian";
import { findTaskLineByMtdId } from "../parse/mtd-index";
import { scanFileForSyncTasks } from "../parse/file-task-scanner";
import type { MtdPluginSettings } from "../settings/types";
import type { ParsedSyncTask, SyncIndexEntry } from "../types/sync";
import { isVaultPathExcluded } from "../vault/excluded-folders";
import { findTaskInVault } from "../vault/mtd-locator";
import { isVaultEnoentError } from "./inbound-task-writer";
import { SyncIndex } from "./sync-index";

export interface ResolvedVaultTask {
  file: TFile;
  lines: string[];
  task: ParsedSyncTask;
  entry: SyncIndexEntry;
}

/**
 * Locate an indexed task in the vault.
 * - `resolved`: sync-eligible task line found
 * - `paused`: mtd:id still present but not eligible (e.g. sync tag removed) — keep mapping, do not recreate
 * - `missing`: mtd:id not found anywhere in the vault
 */
export type IndexedVaultTaskLookup =
  | { status: "resolved"; value: ResolvedVaultTask }
  | { status: "paused"; entry: SyncIndexEntry }
  | { status: "missing" };

export async function lookupIndexedVaultTask(
  app: App,
  entry: SyncIndexEntry,
  index: SyncIndex,
  settings: MtdPluginSettings
): Promise<IndexedVaultTaskLookup> {
  let currentEntry = entry;
  let file: TFile;
  const indexedFile = app.vault.getAbstractFileByPath(currentEntry.vaultPath);
  if (indexedFile instanceof TFile) {
    file = indexedFile;
  } else {
    const relocated = await findTaskInVault(app, currentEntry.mtdId, settings.excludedFolders);
    if (!relocated) {
      return { status: "missing" };
    }
    currentEntry = {
      ...currentEntry,
      vaultPath: relocated.file.path,
      lineHint: relocated.line,
    };
    index.upsert(currentEntry);
    file = relocated.file;
  }

  if (isVaultPathExcluded(file.path, settings.excludedFolders)) {
    return { status: "paused", entry: currentEntry };
  }

  let content: string;
  try {
    content = await app.vault.read(file);
  } catch (error) {
    if (!isVaultEnoentError(error)) {
      throw error;
    }
    const relocated = await findTaskInVault(app, currentEntry.mtdId, settings.excludedFolders);
    if (!relocated) {
      return { status: "missing" };
    }
    currentEntry = {
      ...currentEntry,
      vaultPath: relocated.file.path,
      lineHint: relocated.line,
    };
    index.upsert(currentEntry);
    file = relocated.file;
    content = await app.vault.read(file);
  }

  if (isVaultPathExcluded(file.path, settings.excludedFolders)) {
    return { status: "paused", entry: currentEntry };
  }

  const lines = content.split("\n");
  const cache = app.metadataCache.getFileCache(file);
  const tasks = scanFileForSyncTasks(file.path, lines, cache?.listItems ?? [], settings);
  let task = tasks.find((item) => item.mtd.id === currentEntry.mtdId);
  if (!task) {
    const lineHint = findTaskLineByMtdId(lines, currentEntry.mtdId);
    if (lineHint >= 0) {
      task = tasks.find((item) => item.line === lineHint);
    }
  }
  if (!task) {
    const lineInFile = findTaskLineByMtdId(lines, currentEntry.mtdId);
    if (lineInFile >= 0) {
      if (currentEntry.lineHint !== lineInFile) {
        currentEntry = { ...currentEntry, lineHint: lineInFile };
        index.upsert(currentEntry);
      }
      return { status: "paused", entry: currentEntry };
    }

    const relocated = await findTaskInVault(app, currentEntry.mtdId, settings.excludedFolders);
    if (!relocated) {
      return { status: "missing" };
    }
    currentEntry = {
      ...currentEntry,
      vaultPath: relocated.file.path,
      lineHint: relocated.line,
    };
    index.upsert(currentEntry);
    file = relocated.file;
    if (isVaultPathExcluded(file.path, settings.excludedFolders)) {
      return { status: "paused", entry: currentEntry };
    }
    const relocatedContent = await app.vault.read(file);
    const relocatedLines = relocatedContent.split("\n");
    const relocatedCache = app.metadataCache.getFileCache(file);
    const relocatedTasks = scanFileForSyncTasks(
      file.path,
      relocatedLines,
      relocatedCache?.listItems ?? [],
      settings
    );
    task = relocatedTasks.find((item) => item.mtd.id === currentEntry.mtdId);
    if (!task) {
      const pausedLine = findTaskLineByMtdId(relocatedLines, currentEntry.mtdId);
      if (pausedLine >= 0) {
        return { status: "paused", entry: currentEntry };
      }
      return { status: "missing" };
    }
    return {
      status: "resolved",
      value: { file, lines: relocatedLines, task, entry: currentEntry },
    };
  }

  if (currentEntry.lineHint !== task.line) {
    currentEntry = { ...currentEntry, lineHint: task.line };
    index.upsert(currentEntry);
  }

  return {
    status: "resolved",
    value: { file, lines, task, entry: currentEntry },
  };
}
