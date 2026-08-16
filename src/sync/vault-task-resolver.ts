import { TFile, type App } from "obsidian";
import { findTaskLineByMtdId } from "../parse/mtd-index";
import { scanFileForSyncTasks } from "../parse/file-task-scanner";
import type { MtdPluginSettings } from "../settings/types";
import type { ParsedSyncTask, SyncIndexEntry } from "../types/sync";
import { findTaskInVault } from "../vault/mtd-locator";
import { isVaultEnoentError } from "./inbound-task-writer";
import { SyncIndex } from "./sync-index";

export interface ResolvedVaultTask {
  file: TFile;
  lines: string[];
  task: ParsedSyncTask;
  entry: SyncIndexEntry;
}

export async function resolveIndexedVaultTask(
  app: App,
  entry: SyncIndexEntry,
  index: SyncIndex,
  settings: MtdPluginSettings
): Promise<ResolvedVaultTask | null> {
  let currentEntry = entry;
  let file: TFile;
  const indexedFile = app.vault.getAbstractFileByPath(currentEntry.vaultPath);
  if (indexedFile instanceof TFile) {
    file = indexedFile;
  } else {
    const relocated = await findTaskInVault(app, currentEntry.mtdId);
    if (!relocated) {
      return null;
    }
    currentEntry = {
      ...currentEntry,
      vaultPath: relocated.file.path,
      lineHint: relocated.line,
    };
    index.upsert(currentEntry);
    file = relocated.file;
  }

  let content: string;
  try {
    content = await app.vault.read(file);
  } catch (error) {
    if (!isVaultEnoentError(error)) {
      throw error;
    }
    const relocated = await findTaskInVault(app, currentEntry.mtdId);
    if (!relocated) {
      return null;
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
    const relocated = await findTaskInVault(app, currentEntry.mtdId);
    if (!relocated) {
      return null;
    }
    currentEntry = {
      ...currentEntry,
      vaultPath: relocated.file.path,
      lineHint: relocated.line,
    };
    index.upsert(currentEntry);
    file = relocated.file;
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
      return null;
    }
    return { file, lines: relocatedLines, task, entry: currentEntry };
  }

  if (currentEntry.lineHint !== task.line) {
    currentEntry = { ...currentEntry, lineHint: task.line };
    index.upsert(currentEntry);
  }

  return { file, lines, task, entry: currentEntry };
}
