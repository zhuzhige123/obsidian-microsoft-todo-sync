import { Notice, TFile, type App } from "obsidian";
import type { MsAuthService } from "../auth/ms-auth-service";
import { TodoApi } from "../graph/todo-api";
import { GraphApiError, type GraphClient } from "../graph/graph-client";
import { formatString, type MtdStrings } from "../i18n";
import {
  collectMtdIdsInLines,
  fileContainsSyncTag,
  findTaskLineByMtdId,
  scanFileForSyncTasks,
} from "../parse/file-task-scanner";
import { generateMtdId, sanitizeGraphId, upsertMtdComment } from "../parse/mtd-comment";
import type { MtdPluginSettings } from "../settings/types";
import type { MtdPluginData, ParsedSyncTask } from "../types/sync";
import { SyncIndex } from "./sync-index";
import {
  appendBacklinkToBody,
  buildObsidianTaskUri,
  resolveNoteBodyOnPull,
} from "./backlink-writer";
import { buildGraphTaskPayload, graphTaskToObsidianPatch } from "./field-mapper";
import {
  computeTaskSnapshot,
  decideSyncDirection,
  parseGraphModifiedMs,
  type SyncDirection,
} from "./task-snapshot";
import { rebuildFileSection, removeTaskBlockFromLines } from "./vault-task-writer";
import type { GraphTodoTask } from "../types/graph";
import type { LegacyAuthState, SyncIndexEntry, SyncMeta } from "../types/sync";
import { SyncQueue } from "./sync-queue";
import { collectManagedListNames } from "../parse/sync-tag";
import { getDeltaLink, normalizeSyncMeta, setDeltaLink } from "./sync-meta";

export interface SyncEngineHost {
  app: App;
  getSettings: () => MtdPluginSettings;
  getStrings: () => MtdStrings;
  loadData: () => Promise<MtdPluginData>;
  saveData: (data: MtdPluginData) => Promise<void>;
  auth: MsAuthService;
  graph: GraphClient;
  markPluginWrite?: (path: string) => void;
}

export class SyncEngine {
  private readonly todoApi: TodoApi;
  private readonly queue = new SyncQueue();

  constructor(private readonly host: SyncEngineHost) {
    this.todoApi = new TodoApi(host.graph);
  }

  get busy(): boolean {
    return this.queue.busy;
  }

  async syncVault(options: { silent?: boolean } = {}): Promise<number> {
    return this.queue.enqueue(() => this.syncVaultInner(options));
  }

  private async syncVaultInner(options: { silent?: boolean } = {}): Promise<number> {
    const strings = this.host.getStrings();
    if (!this.host.auth.isLoggedIn) {
      if (!options.silent) {
        new Notice(strings.notices.signInFirst);
      }
      return 0;
    }

    const settings = this.host.getSettings();
    const files = this.host.app.vault.getMarkdownFiles();
    let changed = 0;
    for (const file of files) {
      const content = await this.host.app.vault.read(file);
      if (!fileContainsSyncTag(content, settings.syncTag)) {
        continue;
      }
      changed += await this.pushFileInner(file, { silent: true, content });
    }
    await this.pullDeltaInner({ silent: true });
    return changed;
  }

  async pushFile(
    file: TFile,
    options: { silent?: boolean; content?: string } = {}
  ): Promise<number> {
    return this.queue.enqueue(() => this.pushFileInner(file, options));
  }

  private async pushFileInner(
    file: TFile,
    options: { silent?: boolean; content?: string } = {}
  ): Promise<number> {
    if (!this.host.auth.isLoggedIn) {
      return 0;
    }

    const settings = this.host.getSettings();
    const content = options.content ?? (await this.host.app.vault.read(file));
    if (!fileContainsSyncTag(content, settings.syncTag)) {
      return 0;
    }

    const lines = content.split("\n");
    const cache = this.host.app.metadataCache.getFileCache(file);
    const listItems = cache?.listItems ?? [];
    const tasks = scanFileForSyncTasks(file.path, lines, listItems, settings);

    const data = await this.host.loadData();
    data.syncMeta = normalizeSyncMeta(data.syncMeta);
    const index = SyncIndex.fromRecord(data.index);
    const mtdIdsInFile = collectMtdIdsInLines(lines);
    const staleEntries = index.forFile(file.path).filter((entry) => !mtdIdsInFile.has(entry.mtdId));

    if (tasks.length === 0 && staleEntries.length === 0) {
      return 0;
    }

    const listIdByName = new Map<string, string>();

    let changed = 0;
    let workingLines = [...lines];

    for (const task of tasks) {
      try {
        const listId = await this.ensureListId(task.targetListName, listIdByName);
        const result = await this.reconcileTask({
          task: { ...task, rawLine: workingLines[task.line] ?? task.rawLine },
          file,
          lines: workingLines,
          listId,
          index,
          settings,
          vaultName: this.host.app.vault.getName(),
        });
        if (result.action !== "skip") {
          changed += 1;
          workingLines = result.lines;
        }
      } catch (error) {
        globalThis.console.error("Microsoft To Do sync failed:", error);
        if (!options.silent) {
          const message = error instanceof Error ? error.message : String(error);
          const strings = this.host.getStrings();
          new Notice(formatString(strings.notices.syncFailed, { message: message.slice(0, 180) }));
        }
      }
    }

    for (const entry of staleEntries) {
      await this.todoApi.deleteTaskIfExists(entry.graphListId, entry.graphTaskId);
      index.removeByMtdId(entry.mtdId);
    }

    if (changed > 0) {
      this.host.markPluginWrite?.(file.path);
      await this.host.app.vault.modify(file, workingLines.join("\n"));
    }

    data.index = index.toRecord();
    await this.host.saveData(data);

    if (!options.silent && changed > 0) {
      const strings = this.host.getStrings();
      new Notice(formatString(strings.notices.syncedTasks, { count: String(changed) }));
    }
    return changed;
  }

  private async reconcileTask(options: {
    task: ParsedSyncTask;
    file: TFile;
    lines: string[];
    listId: string;
    index: SyncIndex;
    settings: MtdPluginSettings;
    vaultName: string;
  }): Promise<{ action: SyncDirection; lines: string[] }> {
    const { task, file, listId, index, settings, vaultName } = options;
    let lines = options.lines;
    const mtdId = task.mtd.id;
    const entry = mtdId ? index.getByMtdId(mtdId) : undefined;
    const snapshot = computeTaskSnapshot(task);

    if (!entry?.graphTaskId) {
      const pushed = await this.pushTask({
        task,
        file,
        lines,
        listId,
        index,
        settings,
        vaultName,
      });
      return { action: "push", lines: pushed.lines };
    }

    let remoteTask: GraphTodoTask;
    try {
      remoteTask = await this.todoApi.getTask(entry.graphListId, entry.graphTaskId);
    } catch (error) {
      if (error instanceof GraphApiError && error.status === 404) {
        const pushed = await this.pushTask({
          task,
          file,
          lines,
          listId,
          index,
          settings,
          vaultName,
        });
        return { action: "push", lines: pushed.lines };
      }
      throw error;
    }

    const localDirty = !entry.taskSnapshot || snapshot !== entry.taskSnapshot;
    const remoteDirty =
      !!remoteTask.lastModifiedDateTime &&
      remoteTask.lastModifiedDateTime !== entry.graphModified;
    const direction = decideSyncDirection({
      localDirty,
      remoteDirty,
      localMs: file.stat.mtime,
      remoteMs: parseGraphModifiedMs(remoteTask.lastModifiedDateTime),
    });

    if (direction === "skip") {
      return { action: "skip", lines };
    }
    if (direction === "pull") {
      lines = await this.applyRemoteTaskToLines(
        task,
        remoteTask,
        entry,
        lines,
        file,
        settings,
        index
      );
      return { action: "pull", lines };
    }

    const pushed = await this.pushTask({
      task,
      file,
      lines,
      listId,
      index,
      settings,
      vaultName,
    });
    return { action: "push", lines: pushed.lines };
  }

  async pullDelta(options: { silent?: boolean } = {}): Promise<number> {
    return this.queue.enqueue(() => this.pullDeltaInner(options));
  }

  private async ensureListId(
    listName: string,
    cache: Map<string, string>
  ): Promise<string> {
    const cached = cache.get(listName);
    if (cached) {
      return cached;
    }
    const list = await this.todoApi.ensureTaskList(listName);
    cache.set(listName, list.id);
    return list.id;
  }

  private async collectPollListIds(
    settings: MtdPluginSettings,
    index: SyncIndex,
    cache: Map<string, string>
  ): Promise<string[]> {
    const ids = new Set<string>();
    for (const name of collectManagedListNames(settings)) {
      ids.add(await this.ensureListId(name, cache));
    }
    for (const entry of index.all()) {
      if (entry.graphListId) {
        ids.add(entry.graphListId);
      }
    }
    return [...ids];
  }

  private async pullDeltaInner(options: { silent?: boolean } = {}): Promise<number> {
    if (!this.host.auth.isLoggedIn) {
      return 0;
    }

    const settings = this.host.getSettings();
    const data = await this.host.loadData();
    data.syncMeta = normalizeSyncMeta(data.syncMeta);
    const index = SyncIndex.fromRecord(data.index);
    const listIdByName = new Map<string, string>();
    const listIds = await this.collectPollListIds(settings, index, listIdByName);

    let changes = 0;
    let syncMeta: SyncMeta = data.syncMeta;

    for (const listId of listIds) {
      let deltaLink = getDeltaLink(syncMeta, listId);
      let hasMore = true;
      while (hasMore) {
        const response = await this.todoApi.deltaTasks(listId, deltaLink);
        for (const item of response.value ?? []) {
          if (item["@removed"]) {
            changes += await this.applyRemoteDeletion(item.id, index, settings);
            continue;
          }
          changes += await this.applyRemoteTask(item, index, settings);
        }

        if (response["@odata.nextLink"]) {
          deltaLink = response["@odata.nextLink"];
          hasMore = true;
        } else {
          deltaLink = response["@odata.deltaLink"];
          hasMore = false;
        }
      }

      if (deltaLink) {
        syncMeta = setDeltaLink(syncMeta, listId, deltaLink);
      }
    }

    data.syncMeta = syncMeta;
    data.index = index.toRecord();
    await this.host.saveData(data);

    if (!options.silent && changes > 0) {
      const strings = this.host.getStrings();
      new Notice(formatString(strings.notices.pulledChanges, { count: String(changes) }));
    }
    return changes;
  }

  private async pushTask(options: {
    task: ParsedSyncTask;
    file: TFile;
    lines: string[];
    listId: string;
    index: SyncIndex;
    settings: MtdPluginSettings;
    vaultName: string;
  }): Promise<{ changed: boolean; lines: string[] }> {
    const { task, file, listId, index, settings, vaultName } = options;
    let lines = options.lines;
    let mtdId = task.mtd.id ?? generateMtdId();
    const indexEntry = index.getByMtdId(mtdId);
    let graphId = sanitizeGraphId(indexEntry?.graphTaskId ?? task.mtd.graph);
    const lineText = lines[task.line] ?? task.rawLine;
    const previousListId = indexEntry?.graphListId;

    if (
      graphId &&
      previousListId &&
      previousListId !== listId
    ) {
      await this.todoApi.deleteTaskIfExists(previousListId, graphId);
      graphId = undefined;
    }

    if (!task.mtd.id || task.mtd.graph) {
      lines[task.line] = upsertMtdComment(lineText, { id: mtdId });
    }

    const uri = buildObsidianTaskUri({
      vaultName,
      filePath: file.path,
      mtdId,
      lineNumber: task.line,
    });

    let bodyText = task.noteBody;
    if (settings.appendBacklinkToTodo) {
      bodyText = appendBacklinkToBody(bodyText, uri);
    }

    const payload = buildGraphTaskPayload(
      { ...task, mtd: { ...task.mtd, id: mtdId } },
      bodyText,
      { scheduledMapsToStart: true }
    );

    let graphTask: GraphTodoTask;
    if (graphId) {
      try {
        graphTask = await this.todoApi.updateTask(listId, graphId, payload);
      } catch (error) {
        if (error instanceof GraphApiError && (error.status === 404 || error.status === 400)) {
          graphTask = await this.todoApi.createTask(listId, payload);
          graphId = graphTask.id;
        } else {
          throw error;
        }
      }
    } else {
      graphTask = await this.todoApi.createTask(listId, payload);
      graphId = graphTask.id;
    }

    lines[task.line] = upsertMtdComment(lines[task.line], { id: mtdId });
    const steps = await this.syncSubtasksPush(listId, graphId, task, lines, index, mtdId);
    await this.syncLinkedResource(listId, graphId, mtdId, task.title, uri, settings, index);

    index.upsert({
      mtdId,
      vaultPath: file.path,
      lineHint: task.line,
      graphTaskId: graphId,
      graphListId: listId,
      steps,
      linkedResourceId: index.getByMtdId(mtdId)?.linkedResourceId,
      obsidianModified: file.stat.mtime,
      graphModified: graphTask.lastModifiedDateTime,
      taskSnapshot: computeTaskSnapshot(task),
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
    const remoteItems = await this.todoApi.listChecklistItems(listId, graphTaskId);
    const remoteById = new Map(remoteItems.map((item) => [item.id, item]));
    const steps = { ...(index.getByMtdId(mtdId)?.steps ?? {}) };

    for (const sub of task.subtasks) {
      const stepId = sub.mtd.step ?? `step-${sub.line}`;
      let graphStepId = steps[stepId] ?? sanitizeGraphId(sub.mtd.graph);

      if (graphStepId && remoteById.has(graphStepId)) {
        await this.todoApi.updateChecklistItem(listId, graphTaskId, graphStepId, {
          displayName: sub.title,
          isChecked: sub.checked,
        });
        remoteById.delete(graphStepId);
      } else {
        const created = await this.todoApi.createChecklistItem(
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
      await this.todoApi.deleteChecklistItem(listId, graphTaskId, orphanId);
    }
    return steps;
  }

  private async syncLinkedResource(
    listId: string,
    graphTaskId: string,
    mtdId: string,
    title: string,
    uri: string,
    settings: MtdPluginSettings,
    index: SyncIndex
  ): Promise<void> {
    if (!settings.createLinkedResource) {
      return;
    }
    const existing = index.getByMtdId(mtdId);
    const resources = await this.todoApi.listLinkedResources(listId, graphTaskId);
    const found = resources.find((r) => r.externalId === mtdId);
    if (found) {
      return;
    }
    const created = await this.todoApi.createLinkedResource(listId, graphTaskId, {
      applicationName: "Obsidian",
      displayName: title,
      webUrl: uri,
      externalId: mtdId,
    });
    if (existing) {
      existing.linkedResourceId = created.id;
      index.upsert(existing);
    }
  }

  private async applyRemoteDeletion(
    graphTaskId: string,
    index: SyncIndex,
    settings: MtdPluginSettings
  ): Promise<number> {
    const entry = index.getByGraphId(graphTaskId);
    if (!entry) {
      return 0;
    }

    const file = this.host.app.vault.getAbstractFileByPath(entry.vaultPath);
    if (!(file instanceof TFile)) {
      index.removeByGraphId(graphTaskId);
      return 1;
    }

    const content = await this.host.app.vault.read(file);
    const lines = content.split("\n");
    const cache = this.host.app.metadataCache.getFileCache(file);
    const tasks = scanFileForSyncTasks(file.path, lines, cache?.listItems ?? [], settings);
    const task = tasks.find((t) => t.mtd.id === entry.mtdId || t.mtd.graph === graphTaskId);
    if (!task) {
      index.removeByGraphId(graphTaskId);
      return 0;
    }

    if (settings.remoteDeletePolicy === "keep") {
      index.removeByGraphId(graphTaskId);
      return 0;
    }

    if (settings.remoteDeletePolicy === "unlink") {
      const lineText = lines[task.line] ?? "";
      lines[task.line] = upsertMtdComment(lineText, { graph: undefined });
      this.host.markPluginWrite?.(file.path);
      await this.host.app.vault.modify(file, lines.join("\n"));
      index.removeByGraphId(graphTaskId);
      return 1;
    }

    const newLines = removeTaskBlockFromLines(lines, task);
    this.host.markPluginWrite?.(file.path);
    await this.host.app.vault.modify(file, newLines.join("\n"));
    index.removeByGraphId(graphTaskId);
    return 1;
  }

  private async applyRemoteTask(
    graphTask: GraphTodoTask,
    index: SyncIndex,
    settings: MtdPluginSettings
  ): Promise<number> {
    const entry = index.getByGraphId(graphTask.id);
    if (!entry) {
      return 0;
    }

    let remoteTask = graphTask;
    try {
      remoteTask = await this.todoApi.getTask(entry.graphListId, graphTask.id);
    } catch (error) {
      globalThis.console.warn("Microsoft To Do sync: falling back to delta task payload", error);
    }

    const file = this.host.app.vault.getAbstractFileByPath(entry.vaultPath);
    if (!(file instanceof TFile)) {
      return 0;
    }

    const content = await this.host.app.vault.read(file);
    const lines = content.split("\n");
    const cache = this.host.app.metadataCache.getFileCache(file);
    const tasks = scanFileForSyncTasks(file.path, lines, cache?.listItems ?? [], settings);
    let task = tasks.find((t) => t.mtd.id === entry.mtdId);
    if (!task) {
      const lineHint = findTaskLineByMtdId(lines, entry.mtdId);
      if (lineHint < 0) {
        return 0;
      }
      task = tasks.find((t) => t.line === lineHint);
    }
    if (!task) {
      return 0;
    }

    const snapshot = computeTaskSnapshot(task);
    const localDirty = !entry.taskSnapshot || snapshot !== entry.taskSnapshot;
    const remoteDirty =
      !!remoteTask.lastModifiedDateTime &&
      remoteTask.lastModifiedDateTime !== entry.graphModified;
    const direction = decideSyncDirection({
      localDirty,
      remoteDirty,
      localMs: file.stat.mtime,
      remoteMs: parseGraphModifiedMs(remoteTask.lastModifiedDateTime),
    });

    if (direction !== "pull") {
      return 0;
    }

    const rebuilt = await this.applyRemoteTaskToLines(
      task,
      remoteTask,
      entry,
      lines,
      file,
      settings,
      index
    );

    this.host.markPluginWrite?.(file.path);
    await this.host.app.vault.modify(file, rebuilt.join("\n"));
    return 1;
  }

  private async applyRemoteTaskToLines(
    task: ParsedSyncTask,
    remoteTask: GraphTodoTask,
    entry: SyncIndexEntry,
    lines: string[],
    file: TFile,
    settings: MtdPluginSettings,
    index: SyncIndex
  ): Promise<string[]> {
    const patch = graphTaskToObsidianPatch(remoteTask, { scheduledMapsToStart: true });
    const checklist = await this.todoApi.listChecklistItems(entry.graphListId, remoteTask.id);
    const steps = entry.steps ?? {};
    const subtasks = task.subtasks.map((sub) => {
      const stepId = sub.mtd.step ?? `step-${sub.line}`;
      const graphStepId = steps[stepId];
      const remote = graphStepId
        ? checklist.find((item) => item.id === graphStepId)
        : undefined;
      if (!remote) {
        return sub;
      }
      return {
        ...sub,
        title: remote.displayName,
        checked: remote.isChecked,
        mtd: { ...sub.mtd, step: stepId },
      };
    });

    const noteBody = resolveNoteBodyOnPull(
      task.noteBody,
      remoteTask.body?.content
    );

    const mergedTask: ParsedSyncTask = {
      ...task,
      ...patch,
      checkbox: patch.checkbox as ParsedSyncTask["checkbox"],
      title: patch.title,
      noteBody,
      doneDate: patch.doneDate ?? (patch.checkbox === "x" ? task.doneDate : undefined),
      mtd: { id: task.mtd.id, myday: task.mtd.myday },
    };

    const rebuilt = rebuildFileSection(
      lines,
      mergedTask,
      settings.syncTag,
      noteBody,
      subtasks
    );

    entry.graphModified = remoteTask.lastModifiedDateTime;
    entry.lineHint = task.line;
    entry.obsidianModified = file.stat.mtime;
    entry.taskSnapshot = computeTaskSnapshot(mergedTask);
    index.upsert(entry);
    return rebuilt;
  }
}

export function readLegacyAuthState(raw: unknown): LegacyAuthState | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const refreshToken = record.refreshToken;
  if (typeof refreshToken !== "string" || !refreshToken) {
    return undefined;
  }
  const accessToken = record.accessToken;
  const expiresAt = record.expiresAt;
  return {
    refreshToken,
    accessToken: typeof accessToken === "string" ? accessToken : undefined,
    expiresAt: typeof expiresAt === "number" && Number.isFinite(expiresAt) ? expiresAt : undefined,
  };
}

export function createEmptyPluginData(settings: MtdPluginSettings): MtdPluginData {
  return {
    settings,
    index: {},
    syncMeta: {},
  };
}

export function mergePluginData(
  raw: Partial<MtdPluginData> | MtdPluginSettings | null | undefined,
  settings: MtdPluginSettings
): MtdPluginData {
  if (!raw) {
    return createEmptyPluginData(settings);
  }
  if ("syncTag" in raw && !("index" in raw)) {
    return {
      settings: { ...settings, ...raw },
      index: {},
      syncMeta: {},
    };
  }
  const data = raw as Partial<MtdPluginData>;
  const mergedSettings = { ...settings, ...(data.settings ?? {}) };
  return {
    settings: mergedSettings,
    index: data.index ?? {},
    syncMeta: normalizeSyncMeta(data.syncMeta),
  };
}
