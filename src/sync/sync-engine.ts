import { Notice, TFile } from "obsidian";
import { TodoApi } from "../graph/todo-api";
import { fileContainsSyncTag, scanFileForSyncTasks } from "../parse/file-task-scanner";
import { parseMtdComment, upsertMtdComment } from "../parse/mtd-comment";
import type { SyncIndexEntry } from "../types/sync";
import { isVaultPathExcluded } from "../vault/excluded-folders";
import { SyncIndex } from "./sync-index";
import { SyncQueue } from "./sync-queue";
import { DeltaSync } from "./delta-sync";
import { InboundSync } from "./inbound-sync";
import { OutboundSync } from "./outbound-sync";
import {
  persistPluginData as savePluginIndex,
} from "./index-persistence";
import { applyRemoteTaskToLines } from "./remote-task-apply";
import { cleanupRemoteOnUnlink } from "./remote-unlink-cleanup";
import type { SyncContext, SyncEngineHost } from "./sync-context";
import { addIgnoredGraphTaskId, normalizeSyncMeta } from "./sync-meta";

export type { SyncEngineHost } from "./sync-context";

export {
  createEmptyPluginData,
  mergePluginData,
  readLegacyAuthState,
} from "./plugin-data";

export class SyncEngine {
  private readonly ctx: SyncContext;
  private readonly queue = new SyncQueue();
  private readonly outbound: OutboundSync;
  private readonly inbound: InboundSync;
  private readonly delta: DeltaSync;
  private sessionIndex: SyncIndex | null = null;

  constructor(
    host: SyncEngineHost,
    todoApi?: TodoApi
  ) {
    const api = todoApi ?? new TodoApi(host.graph);
    this.ctx = {
      host,
      todoApi: api,
      getWorkingIndex: () => this.ensureSessionIndex(),
    };
    this.outbound = new OutboundSync(this.ctx, (index, patch) =>
      savePluginIndex(host.loadData, host.saveData, index, patch)
    );
    this.inbound = new InboundSync(this.ctx);
    this.delta = new DeltaSync(this.ctx, this.inbound);
  }

  get busy(): boolean {
    return this.queue.busy;
  }

  /** In-flight index snapshot while a queued sync operation is running. */
  getLiveIndex(): SyncIndex | null {
    return this.sessionIndex;
  }

  async ensureSessionIndex(): Promise<SyncIndex> {
    if (!this.sessionIndex) {
      const data = await this.ctx.host.loadData();
      this.sessionIndex = SyncIndex.fromRecord(data.index);
    }
    return this.sessionIndex;
  }

  private clearSessionIndex(): void {
    this.sessionIndex = null;
  }

  private runQueued<T>(job: () => Promise<T>): Promise<T> {
    return this.queue
      .enqueue(async () => {
        await this.ensureSessionIndex();
        return job();
      })
      .finally(() => {
        if (!this.queue.busy) {
          this.clearSessionIndex();
        }
      });
  }

  async repairIndexEntry(entry: SyncIndexEntry): Promise<void> {
    return this.runQueued(async () => {
      const index = await this.ctx.getWorkingIndex();
      index.upsert(entry);
      await savePluginIndex(this.ctx.host.loadData, this.ctx.host.saveData, index);
    });
  }

  async syncVault(options: { silent?: boolean } = {}): Promise<number> {
    return this.runQueued(() => this.syncVaultInner(options));
  }

  private async syncVaultInner(options: { silent?: boolean } = {}): Promise<number> {
    const strings = this.ctx.host.getStrings();
    if (!this.ctx.host.auth.isLoggedIn) {
      if (!options.silent) {
        new Notice(strings.notices.signInFirst);
      }
      return 0;
    }

    const settings = this.ctx.host.getSettings();
    const files = this.ctx.host.app.vault.getMarkdownFiles();
    let changed = 0;
    for (const file of files) {
      if (isVaultPathExcluded(file.path, settings.excludedFolders)) {
        continue;
      }
      const content = await this.ctx.host.app.vault.read(file);
      if (!fileContainsSyncTag(content, settings.syncTag)) {
        continue;
      }
      changed += await this.outbound.pushFile(file, { silent: true, content });
    }
    const pulled = await this.delta.pullDelta({ silent: true });
    return changed + pulled;
  }

  async pushFile(
    file: TFile,
    options: { silent?: boolean; content?: string } = {}
  ): Promise<number> {
    return this.runQueued(() => this.outbound.pushFile(file, options));
  }

  async pullDelta(options: { silent?: boolean } = {}): Promise<number> {
    return this.runQueued(() => this.delta.pullDelta(options));
  }

  async pushTaskAt(file: TFile, line: number): Promise<boolean> {
    return this.runQueued(async () => {
      if (!this.ctx.host.auth.isLoggedIn) {
        new Notice(this.ctx.host.getStrings().notices.signInFirst);
        return false;
      }
      try {
        return await this.outbound.pushTaskAt(file, line);
      } catch (error) {
        window.console.error("Microsoft To Do sync: push task failed", error);
        throw error;
      }
    });
  }

  async pullTaskAt(file: TFile, line: number): Promise<boolean> {
    return this.runQueued(async () => {
      if (!this.ctx.host.auth.isLoggedIn) {
        new Notice(this.ctx.host.getStrings().notices.signInFirst);
        return false;
      }
      try {
        const settings = this.ctx.host.getSettings();
        const content = await this.ctx.host.app.vault.read(file);
        const lines = content.split("\n");
        const cache = this.ctx.host.app.metadataCache.getFileCache(file);
        const tasks = scanFileForSyncTasks(file.path, lines, cache?.listItems ?? [], settings);
        const task = tasks.find((item) => item.line === line);
        if (!task?.mtd.id) {
          return false;
        }

        const index = await this.ctx.getWorkingIndex();
        const entry = index.getByMtdId(task.mtd.id);
        if (!entry?.graphTaskId) {
          return false;
        }

        const remoteTask = await this.ctx.todoApi.getTask(entry.graphListId, entry.graphTaskId);
        const applied = await applyRemoteTaskToLines(
          this.ctx.todoApi,
          task,
          remoteTask,
          entry,
          lines,
          file,
          settings
        );
        this.ctx.host.markPluginWrite?.(file.path);
        await this.ctx.host.app.vault.modify(file, applied.lines.join("\n"));
        index.upsert(applied.entry);
        await savePluginIndex(this.ctx.host.loadData, this.ctx.host.saveData, index);
        return true;
      } catch (error) {
        window.console.error("Microsoft To Do sync: pull task failed", error);
        throw error;
      }
    });
  }

  async unlinkTaskAt(file: TFile, line: number): Promise<boolean> {
    return this.runQueued(async () => {
      try {
        const settings = this.ctx.host.getSettings();
        const content = await this.ctx.host.app.vault.read(file);
        const lines = content.split("\n");
        const mtd = parseMtdComment(lines[line] ?? "");
        if (!mtd.id) {
          return false;
        }

        const index = await this.ctx.getWorkingIndex();
        const entry = index.getByMtdId(mtd.id);

        if (entry && this.ctx.host.auth.isLoggedIn) {
          try {
            await cleanupRemoteOnUnlink(this.ctx.todoApi, entry, settings);
          } catch (error) {
            window.console.error("Microsoft To Do sync: remote unlink cleanup failed", error);
          }
        }

        lines[line] = upsertMtdComment(lines[line] ?? "", { id: undefined });
        this.ctx.host.markPluginWrite?.(file.path);
        await this.ctx.host.app.vault.modify(file, lines.join("\n"));
        if (entry) {
          index.removeByMtdId(mtd.id);
        }
        await savePluginIndex(this.ctx.host.loadData, this.ctx.host.saveData, index, (data) => {
          if (entry?.graphTaskId) {
            data.syncMeta = addIgnoredGraphTaskId(
              normalizeSyncMeta(data.syncMeta),
              entry.graphTaskId
            );
          }
        });
        return true;
      } catch (error) {
        window.console.error("Microsoft To Do sync: unlink task failed", error);
        throw error;
      }
    });
  }
}
