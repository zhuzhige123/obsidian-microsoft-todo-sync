import { Notice, TFile } from "obsidian";
import { GraphApiError } from "../graph/graph-client";
import { formatString } from "../i18n";
import {
  collectMtdIdsInLines,
  fileContainsSyncTag,
  scanFileForSyncTasks,
} from "../parse/file-task-scanner";
import { generateMtdId, parseMtdComment, sanitizeGraphId, upsertMtdComment } from "../parse/mtd-comment";
import type { MtdPluginSettings } from "../settings/types";
import type { MtdPluginData, ParsedSyncTask, SyncIndexEntry } from "../types/sync";
import { SyncIndex } from "./sync-index";
import { getVaultUriIdentifier } from "../navigation/obsidian-uri";
import { resolveNoteBodyOnPull,
  appendBacklinkToBody,
  buildObsidianTaskUri,
} from "./backlink-writer";
import { buildGraphTaskPayload } from "./field-mapper";
import { computeTaskSnapshot,
  decideTaskSyncPlan,
  parseGraphModifiedMs,
  splitLocalDirty,
  splitRemoteDirty,
  type SyncDirection,
} from "./task-snapshot";
import type { GraphTodoTask } from "../types/graph";
import { normalizeSyncMeta } from "./sync-meta";
import { syncAndAttachLinkedResource } from "./index-linked-resource";
import { ensureListId } from "./sync-list-ids";
import { applyRemoteTaskToLines } from "./remote-task-apply";
import { graphIndexTimestamps } from "./graph-index-timestamps";
import type { SyncContext } from "./sync-context";
import {
  localTaskModifiedMs,
  touchLocalTaskModified,
} from "./sync-local-state";
import { isVaultPathExcluded } from "../vault/excluded-folders";

export class OutboundSync {
  constructor(
    private readonly ctx: SyncContext,
    private readonly persistIndex: (
      index: SyncIndex,
      patch?: (data: MtdPluginData) => void
    ) => Promise<void>
  ) {}

  async pushFile(
    file: TFile,
    options: { silent?: boolean; content?: string } = {}
  ): Promise<number> {
    if (!this.ctx.host.auth.isLoggedIn) {
      return 0;
    }

    const settings = this.ctx.host.getSettings();
    if (isVaultPathExcluded(file.path, settings.excludedFolders)) {
      return 0;
    }
    const content = options.content ?? (await this.ctx.host.app.vault.read(file));
    if (!fileContainsSyncTag(content, settings.syncTag)) {
      return 0;
    }

    const lines = content.split("\n");
    const cache = this.ctx.host.app.metadataCache.getFileCache(file);
    const listItems = cache?.listItems ?? [];
    const tasks = scanFileForSyncTasks(file.path, lines, listItems, settings);

    const data = await this.ctx.host.loadData();
    data.syncMeta = normalizeSyncMeta(data.syncMeta);
    const index = await this.ctx.getWorkingIndex();
    const mtdIdsInFile = collectMtdIdsInLines(lines);
    const staleEntries = index.forFile(file.path).filter((entry) => !mtdIdsInFile.has(entry.mtdId));

    if (tasks.length === 0 && staleEntries.length === 0) {
      return 0;
    }

    const listIdByName = new Map<string, string>();
    let changed = 0;
    let workingLines = [...lines];
    const processedMtdIds = new Set<string>();
    const pendingIndexEntries: SyncIndexEntry[] = [];

    while (true) {
      const pendingTasks = scanFileForSyncTasks(
        file.path,
        workingLines,
        listItems,
        settings
      ).filter((candidate) => {
        if (candidate.mtd.id) {
          return !processedMtdIds.has(candidate.mtd.id);
        }
        return !processedMtdIds.has(`line:${candidate.line}`);
      });

      if (pendingTasks.length === 0) {
        break;
      }

      const task = pendingTasks[0];
      const taskMtdId = task.mtd.id;

      try {
        const listId = await ensureListId(this.ctx.todoApi, task.targetListName, listIdByName);
        const result = await this.reconcileTask({
          task: { ...task, rawLine: workingLines[task.line] ?? task.rawLine },
          file,
          lines: workingLines,
          listId,
          index,
          settings,
          vaultIdentifier: getVaultUriIdentifier(this.ctx.host.app),
        });
        if (result.action !== "skip") {
          changed += 1;
          workingLines = result.lines;
          if (result.pendingEntry) {
            pendingIndexEntries.push(result.pendingEntry);
          }
        }

        if (taskMtdId) {
          processedMtdIds.add(taskMtdId);
        } else {
          const resolvedId = parseMtdComment(workingLines[task.line] ?? "").id;
          if (resolvedId) {
            processedMtdIds.add(resolvedId);
          } else {
            processedMtdIds.add(`line:${task.line}`);
          }
        }
      } catch (error) {
        if (taskMtdId) {
          processedMtdIds.add(taskMtdId);
        } else {
          processedMtdIds.add(`line:${task.line}`);
        }
        window.console.error("Microsoft To Do sync failed:", error);
        if (!options.silent) {
          const message = error instanceof Error ? error.message : String(error);
          const strings = this.ctx.host.getStrings();
          new Notice(formatString(strings.notices.syncFailed, { message: message.slice(0, 180) }));
        }
      }
    }

    for (const entry of staleEntries) {
      try {
        await this.ctx.todoApi.deleteTaskIfExists(entry.graphListId, entry.graphTaskId);
        index.removeByMtdId(entry.mtdId);
      } catch (error) {
        window.console.error("Microsoft To Do sync: stale task cleanup failed", error);
      }
    }

    if (changed > 0) {
      this.ctx.host.markPluginWrite?.(file.path);
      await this.ctx.host.app.vault.modify(file, workingLines.join("\n"));
      for (const pending of pendingIndexEntries) {
        index.upsert(pending);
      }
    }

    await this.persistIndex(index, (pluginData) => {
      pluginData.syncMeta = normalizeSyncMeta(pluginData.syncMeta);
    });

    if (!options.silent && changed > 0) {
      const strings = this.ctx.host.getStrings();
      new Notice(formatString(strings.notices.syncedTasks, { count: String(changed) }));
    }
    return changed;
  }

  async pushTaskAt(file: TFile, line: number): Promise<boolean> {
    if (!this.ctx.host.auth.isLoggedIn) {
      return false;
    }
    const settings = this.ctx.host.getSettings();
    if (isVaultPathExcluded(file.path, settings.excludedFolders)) {
      return false;
    }
    const content = await this.ctx.host.app.vault.read(file);
    const lines = content.split("\n");
    const cache = this.ctx.host.app.metadataCache.getFileCache(file);
    const tasks = scanFileForSyncTasks(file.path, lines, cache?.listItems ?? [], settings);
    const task = tasks.find((item) => item.line === line);
    if (!task) {
      return false;
    }

    const index = await this.ctx.getWorkingIndex();
    const listIdByName = new Map<string, string>();
    const listId = await ensureListId(this.ctx.todoApi, task.targetListName, listIdByName);
    const result = await this.reconcileTask({
      task: { ...task, rawLine: lines[task.line] ?? task.rawLine },
      file,
      lines,
      listId,
      index,
      settings,
      vaultIdentifier: getVaultUriIdentifier(this.ctx.host.app),
    });
    if (result.action === "skip") {
      return false;
    }
    this.ctx.host.markPluginWrite?.(file.path);
    await this.ctx.host.app.vault.modify(file, result.lines.join("\n"));
    if (result.pendingEntry) {
      index.upsert(result.pendingEntry);
    }
    await this.persistIndex(index);
    return true;
  }

  private async reconcileTask(options: {
    task: ParsedSyncTask;
    file: TFile;
    lines: string[];
    listId: string;
    index: SyncIndex;
    settings: MtdPluginSettings;
    vaultIdentifier: string;
  }): Promise<{ action: SyncDirection; lines: string[]; pendingEntry?: SyncIndexEntry }> {
    const { task, file, listId, index, settings, vaultIdentifier } = options;
    let lines = options.lines;
    const mtdId = task.mtd.id;
    const entry = mtdId ? index.getByMtdId(mtdId) : undefined;

    if (!entry?.graphTaskId) {
      const pushed = await this.pushTask({
        task,
        file,
        lines,
        listId,
        index,
        settings,
        vaultIdentifier,
      });
      return { action: "push", lines: pushed.lines };
    }

    let remoteTask: GraphTodoTask;
    try {
      remoteTask = await this.ctx.todoApi.getTask(entry.graphListId, entry.graphTaskId);
    } catch (error) {
      if (error instanceof GraphApiError && error.status === 404) {
        const pushed = await this.pushTask({
          task,
          file,
          lines,
          listId,
          index,
          settings,
          vaultIdentifier,
        });
        return { action: "push", lines: pushed.lines };
      }
      throw error;
    }

    const { localFieldsDirty, localNoteDirty } = splitLocalDirty(entry, task);
    const { remoteFieldsDirty, remoteNoteDirty } = splitRemoteDirty(entry, remoteTask);
    touchLocalTaskModified(entry, file.stat.mtime, localFieldsDirty, localNoteDirty);
    const plan = decideTaskSyncPlan({
      localFieldsDirty,
      localNoteDirty,
      remoteFieldsDirty,
      remoteNoteDirty,
      localMs: localTaskModifiedMs(entry, file.stat.mtime),
      remoteMs: parseGraphModifiedMs(remoteTask.lastModifiedDateTime),
    });

    if (plan.action === "skip") {
      return { action: "skip", lines };
    }
    if (plan.action === "pull") {
      const applied = await applyRemoteTaskToLines(
        this.ctx.todoApi,
        task,
        remoteTask,
        entry,
        lines,
        file,
        settings,
        {
          preserveLocalNote: plan.preserveLocalNote,
          checklist: remoteTask.checklistItems,
        }
      );
      return { action: "pull", lines: applied.lines, pendingEntry: applied.entry };
    }

    const pushed = await this.pushTask({
      task,
      file,
      lines,
      listId,
      index,
      settings,
      vaultIdentifier,
      remoteTask,
      useRemoteNoteOnPush: plan.useRemoteNoteOnPush,
    });
    return { action: "push", lines: pushed.lines };
  }

  private async pushTask(options: {
    task: ParsedSyncTask;
    file: TFile;
    lines: string[];
    listId: string;
    index: SyncIndex;
    settings: MtdPluginSettings;
    vaultIdentifier: string;
    remoteTask?: GraphTodoTask;
    useRemoteNoteOnPush?: boolean;
  }): Promise<{ changed: boolean; lines: string[] }> {
    const { task, file, listId, index, settings, vaultIdentifier } = options;
    let lines = options.lines;
    let mtdId = task.mtd.id ?? generateMtdId();
    const indexEntry = index.getByMtdId(mtdId);
    let graphId = sanitizeGraphId(indexEntry?.graphTaskId ?? task.mtd.graph);
    const lineText = lines[task.line] ?? task.rawLine;
    const previousListId = indexEntry?.graphListId;

    if (graphId && previousListId && previousListId !== listId) {
      await this.ctx.todoApi.deleteTaskIfExists(previousListId, graphId);
      graphId = undefined;
    }

    if (!task.mtd.id || task.mtd.graph) {
      lines[task.line] = upsertMtdComment(lineText, { id: mtdId });
    }

    const uri = buildObsidianTaskUri({
      mtdId,
      vaultIdentifier,
      format: "id-only",
    });

    let bodyText = task.noteBody;
    if (options.useRemoteNoteOnPush && options.remoteTask) {
      bodyText = resolveNoteBodyOnPull("", options.remoteTask.body?.content);
    }
    if (settings.appendBacklinkToTodo) {
      bodyText = appendBacklinkToBody(
        bodyText,
        uri,
        this.ctx.host.getStrings().sync.backlinkTodoHeader
      );
    }

    const payload = buildGraphTaskPayload(
      { ...task, mtd: { ...task.mtd, id: mtdId } },
      bodyText,
      { scheduledMapsToStart: true, allowEmptyBody: !task.noteBody.trim() }
    );

    let graphTask: GraphTodoTask;
    if (graphId) {
      try {
        graphTask = await this.ctx.todoApi.updateTask(listId, graphId, payload);
      } catch (error) {
        if (error instanceof GraphApiError && error.status === 404) {
          graphTask = await this.ctx.todoApi.createTask(listId, payload);
          graphId = graphTask.id;
        } else {
          throw error;
        }
      }
    } else {
      graphTask = await this.ctx.todoApi.createTask(listId, payload);
      graphId = graphTask.id;
    }

    lines[task.line] = upsertMtdComment(lines[task.line], { id: mtdId });
    const steps = await this.syncSubtasksPush(listId, graphId, task, lines, index, mtdId);

    index.upsert({
      mtdId,
      vaultPath: file.path,
      lineHint: task.line,
      graphTaskId: graphId,
      graphListId: listId,
      steps,
      linkedResourceId: index.getByMtdId(mtdId)?.linkedResourceId,
      obsidianModified: file.stat.mtime,
      ...graphIndexTimestamps(graphTask),
      taskSnapshot: computeTaskSnapshot(task),
    });

    await syncAndAttachLinkedResource(this.ctx.todoApi, {
      listId,
      graphTaskId: graphId,
      mtdId,
      title: task.title,
      uri,
      settings,
      index,
    });

    return { changed: true, lines };
  }

  private async syncSubtasksPush(
    listId: string,
    graphTaskId: string,
    task: ParsedSyncTask,
    lines: string[],
    index: SyncIndex,
    mtdId: string
  ): Promise<Record<string, string>> {
    const remoteItems = await this.ctx.todoApi.listChecklistItems(listId, graphTaskId);
    const remoteById = new Map(remoteItems.map((item) => [item.id, item]));
    const steps = { ...(index.getByMtdId(mtdId)?.steps ?? {}) };

    for (const sub of task.subtasks) {
      const stepId = sub.mtd.step ?? `step-${sub.line}`;
      let graphStepId = steps[stepId] ?? sanitizeGraphId(sub.mtd.graph);

      if (graphStepId && remoteById.has(graphStepId)) {
        await this.ctx.todoApi.updateChecklistItem(listId, graphTaskId, graphStepId, {
          displayName: sub.title,
          isChecked: sub.checked,
        });
        remoteById.delete(graphStepId);
      } else {
        const created = await this.ctx.todoApi.createChecklistItem(
          listId,
          graphTaskId,
          sub.title,
          sub.checked
        );
        graphStepId = created.id;
      }
      steps[stepId] = graphStepId;
      lines[sub.line] = upsertMtdComment(lines[sub.line], { step: stepId });
    }

    for (const orphanId of remoteById.keys()) {
      await this.ctx.todoApi.deleteChecklistItem(listId, graphTaskId, orphanId);
    }
    return steps;
  }
}
