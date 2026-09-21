import { Notice, TFile } from "obsidian";
import { formatString } from "../i18n";
import { parseInboundRouteHeader } from "../parse/inbound-route";
import {
  computeInboundInsertLine,
  insertInboundTaskBlock,
  projectedInboundParentLine,
} from "../parse/inbound-insert";
import { isInboundAllowedList } from "../parse/inbound-policy";
import { scanFileForSyncTasks } from "../parse/file-task-scanner";
import { generateMtdId, upsertMtdComment } from "../parse/mtd-comment";
import { resolveInboundRoute, removeSyncTagFromLine } from "../parse/sync-tag";
import type { MtdPluginSettings } from "../settings/types";
import { resolveTaskChecklist } from "../graph/task-checklist";
import {
  buildObsidianTaskUri,
  formatTodoBodyAfterInbound,
  resolveNoteBodyOnPull,
} from "./backlink-writer";
import {
  buildInboundTaskBlock,
  ensureInboundFile,
  readVaultFileOrEmpty,
} from "./inbound-task-writer";
import { resolveInboundLinkTarget } from "./inbound-resolver";
import { syncAndAttachLinkedResource } from "./index-linked-resource";
import { graphIndexTimestamps } from "./graph-index-timestamps";
import { applyRemoteTaskToLines } from "./remote-task-apply";
import type { GraphTodoTask } from "../types/graph";
import {
  computeTaskSnapshot,
  decideTaskSyncPlan,
  parseGraphModifiedMs,
  splitLocalDirty,
  splitRemoteDirty,
} from "./task-snapshot";
import { removeTaskBlockFromLines } from "./vault-task-writer";
import { lookupIndexedVaultTask } from "./vault-task-resolver";
import { SyncIndex } from "./sync-index";
import { getVaultUriIdentifier } from "../navigation/obsidian-uri";
import type { SyncContext } from "./sync-context";
import {
  localTaskModifiedMs,
  touchLocalTaskModified,
} from "./sync-local-state";
import {
  isIgnoredGraphTaskId,
  normalizeSyncMeta,
  removeIgnoredGraphTaskId,
} from "./sync-meta";

export class InboundSync {
  constructor(private readonly ctx: SyncContext) {}

  async createInboundRemoteTask(
    graphTask: GraphTodoTask,
    listId: string,
    listName: string,
    index: SyncIndex,
    settings: MtdPluginSettings,
    options: { silent?: boolean } = {}
  ): Promise<number> {
    const data = await this.ctx.host.loadData();
    if (isIgnoredGraphTaskId(data.syncMeta, graphTask.id)) {
      return 0;
    }

    if (!isInboundAllowedList(listName, settings)) {
      return 0;
    }

    try {
      let remoteTask = graphTask;
      try {
        remoteTask = await this.ctx.todoApi.getTask(listId, graphTask.id);
      } catch (error) {
        window.console.warn("Microsoft To Do sync: falling back to delta task payload", error);
      }

      const route = resolveInboundRoute(listName, settings);
      const routeHeader = parseInboundRouteHeader(remoteTask.body?.content ?? "");
      let targetVaultPath = route.vaultPath;
      let insertHeading: string | undefined;

      if (routeHeader.hasRoute && routeHeader.filePart) {
        const resolvedLink = resolveInboundLinkTarget(
          this.ctx.host.app,
          routeHeader.filePart,
          routeHeader.heading
        );
        if (resolvedLink) {
          targetVaultPath = resolvedLink.vaultPath;
          insertHeading = resolvedLink.heading;
        }
      }

      const file = await ensureInboundFile(this.ctx.host.app.vault, targetVaultPath);
      const checklist = await resolveTaskChecklist(this.ctx.todoApi, listId, remoteTask);
      const existing = await readVaultFileOrEmpty(this.ctx.host.app.vault, file);
      const existingLines = existing.length > 0 ? existing.split("\n") : [];
      const insertAt = computeInboundInsertLine(existingLines, insertHeading);
      const parentLine = projectedInboundParentLine(insertAt, existingLines);
      const mtdId = generateMtdId();
      const noteBody = resolveNoteBodyOnPull("", remoteTask.body?.content);

      const block = buildInboundTaskBlock(
        remoteTask,
        checklist,
        settings,
        route,
        parentLine,
        { noteBody, mtdId }
      );
      const inserted = insertInboundTaskBlock(existingLines, block.lines, insertAt);

      const vaultIdentifier = getVaultUriIdentifier(this.ctx.host.app);
      const uri = buildObsidianTaskUri({
        mtdId: block.mtdId,
        vaultIdentifier,
        format: "id-only",
      });

      this.ctx.host.markPluginWrite?.(file.path);
      await this.ctx.host.app.vault.modify(file, inserted.lines.join("\n"));

      const cache = this.ctx.host.app.metadataCache.getFileCache(file);
      const updatedTasks = scanFileForSyncTasks(
        file.path,
        inserted.lines,
        cache?.listItems ?? [],
        settings
      );
      const createdTask = updatedTasks.find((item) => item.mtd.id === block.mtdId);
      const taskSnapshot = createdTask ? computeTaskSnapshot(createdTask) : undefined;

      index.upsert({
        mtdId: block.mtdId,
        vaultPath: file.path,
        lineHint: inserted.parentLine,
        graphTaskId: remoteTask.id,
        graphListId: listId,
        steps: block.steps,
        obsidianModified: file.stat.mtime,
        ...graphIndexTimestamps(remoteTask),
        taskSnapshot,
      });

      const pluginData = await this.ctx.host.loadData();
      pluginData.syncMeta = removeIgnoredGraphTaskId(
        normalizeSyncMeta(pluginData.syncMeta),
        remoteTask.id
      );

      const shouldUpdateTodoBody =
        settings.appendBacklinkToTodo ||
        (settings.stripInboundRouteHeader && routeHeader.hasRoute);
      if (shouldUpdateTodoBody) {
        const bodyText = formatTodoBodyAfterInbound(remoteTask.body?.content ?? "", {
          stripRouteHeader: settings.stripInboundRouteHeader,
          appendBacklink: settings.appendBacklinkToTodo,
          backlinkUri: uri,
          backlinkHeader: this.ctx.host.getStrings().sync.backlinkTodoHeader,
        });
        await this.ctx.todoApi.updateTask(listId, remoteTask.id, {
          body: { content: bodyText, contentType: "text" },
        });
      }

      await syncAndAttachLinkedResource(this.ctx.todoApi, {
        listId,
        graphTaskId: remoteTask.id,
        mtdId: block.mtdId,
        title: remoteTask.title?.trim() || "Untitled task",
        uri,
        settings,
        index,
      });

      return 1;
    } catch (error) {
      window.console.error("Microsoft To Do sync: inbound task creation failed", error);
      if (!options.silent) {
        const message = error instanceof Error ? error.message : String(error);
        const strings = this.ctx.host.getStrings();
        new Notice(formatString(strings.notices.inboundFailed, { message: message.slice(0, 180) }));
      }
      return 0;
    }
  }

  async applyRemoteTask(
    graphTask: GraphTodoTask,
    listId: string,
    listName: string,
    index: SyncIndex,
    settings: MtdPluginSettings,
    options: { silent?: boolean } = {}
  ): Promise<number> {
    const entry = index.getByGraphId(graphTask.id);
    if (!entry) {
      return this.createInboundRemoteTask(graphTask, listId, listName, index, settings, options);
    }

    let remoteTask = graphTask;
    try {
      remoteTask = await this.ctx.todoApi.getTask(entry.graphListId, graphTask.id);
    } catch (error) {
      window.console.warn("Microsoft To Do sync: falling back to delta task payload", error);
    }

    const lookup = await lookupIndexedVaultTask(this.ctx.host.app, entry, index, settings);
    if (lookup.status === "paused") {
      // Sync tag removed: keep mapping, do not pull or recreate.
      return 0;
    }
    if (lookup.status === "missing") {
      index.removeByGraphId(graphTask.id);
      return this.createInboundRemoteTask(graphTask, listId, listName, index, settings, options);
    }
    const { file, lines, task, entry: resolvedEntry } = lookup.value;

    const { localFieldsDirty, localNoteDirty } = splitLocalDirty(resolvedEntry, task);
    const { remoteFieldsDirty, remoteNoteDirty } = splitRemoteDirty(resolvedEntry, remoteTask);
    touchLocalTaskModified(resolvedEntry, file.stat.mtime, localFieldsDirty, localNoteDirty);
    const plan = decideTaskSyncPlan({
      localFieldsDirty,
      localNoteDirty,
      remoteFieldsDirty,
      remoteNoteDirty,
      localMs: localTaskModifiedMs(resolvedEntry, file.stat.mtime),
      remoteMs: parseGraphModifiedMs(remoteTask.lastModifiedDateTime),
    });

    if (plan.action !== "pull") {
      return 0;
    }

    const applied = await applyRemoteTaskToLines(
      this.ctx.todoApi,
      task,
      remoteTask,
      resolvedEntry,
      lines,
      file,
      settings,
      {
        preserveLocalNote: plan.preserveLocalNote,
        checklist: remoteTask.checklistItems,
      }
    );

    this.ctx.host.markPluginWrite?.(file.path);
    await this.ctx.host.app.vault.modify(file, applied.lines.join("\n"));
    index.upsert(applied.entry);
    return 1;
  }

  async applyRemoteDeletion(
    graphTaskId: string,
    index: SyncIndex,
    settings: MtdPluginSettings
  ): Promise<number> {
    const entry = index.getByGraphId(graphTaskId);
    const clearIgnore = async (): Promise<void> => {
      const pluginData = await this.ctx.host.loadData();
      pluginData.syncMeta = removeIgnoredGraphTaskId(
        normalizeSyncMeta(pluginData.syncMeta),
        graphTaskId
      );
    };

    if (!entry) {
      await clearIgnore();
      return 0;
    }

    const file = this.ctx.host.app.vault.getAbstractFileByPath(entry.vaultPath);
    if (!(file instanceof TFile)) {
      index.removeByGraphId(graphTaskId);
      await clearIgnore();
      return 1;
    }

    const content = await this.ctx.host.app.vault.read(file);
    const lines = content.split("\n");
    const cache = this.ctx.host.app.metadataCache.getFileCache(file);
    const tasks = scanFileForSyncTasks(file.path, lines, cache?.listItems ?? [], settings);
    const task = tasks.find((t) => t.mtd.id === entry.mtdId || t.mtd.graph === graphTaskId);
    if (!task) {
      index.removeByGraphId(graphTaskId);
      await clearIgnore();
      return 0;
    }

    if (settings.remoteDeletePolicy === "keep") {
      const lineText = lines[task.line] ?? "";
      lines[task.line] = removeSyncTagFromLine(lineText, settings.syncTag);
      this.ctx.host.markPluginWrite?.(file.path);
      await this.ctx.host.app.vault.modify(file, lines.join("\n"));
      index.removeByGraphId(graphTaskId);
      await clearIgnore();
      return 1;
    }

    if (settings.remoteDeletePolicy === "unlink") {
      const lineText = lines[task.line] ?? "";
      lines[task.line] = upsertMtdComment(lineText, { graph: undefined });
      this.ctx.host.markPluginWrite?.(file.path);
      await this.ctx.host.app.vault.modify(file, lines.join("\n"));
      index.removeByGraphId(graphTaskId);
      await clearIgnore();
      return 1;
    }

    const newLines = removeTaskBlockFromLines(lines, task);
    this.ctx.host.markPluginWrite?.(file.path);
    await this.ctx.host.app.vault.modify(file, newLines.join("\n"));
    index.removeByGraphId(graphTaskId);
    await clearIgnore();
    return 1;
  }
}
