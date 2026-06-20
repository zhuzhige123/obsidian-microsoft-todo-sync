import { Notice } from "obsidian";
import { formatString } from "../i18n";
import { SyncIndex } from "./sync-index";
import { normalizeSyncMeta, getDeltaLink, setDeltaLink } from "./sync-meta";
import type { SyncMeta } from "../types/sync";
import {
  buildListIdToNameMap,
  collectPollListIds,
} from "./sync-list-ids";
import {
  persistPluginDataWithMeta as savePluginIndexWithMeta,
} from "./index-persistence";
import type { SyncContext } from "./sync-context";
import { removeUntaggedIndexEntriesInVault } from "./sync-local-state";
import { InboundSync } from "./inbound-sync";

export class DeltaSync {
  constructor(
    private readonly ctx: SyncContext,
    private readonly inbound: InboundSync
  ) {}

  async pullDelta(options: { silent?: boolean } = {}): Promise<number> {
    if (!this.ctx.host.auth.isLoggedIn) {
      return 0;
    }

    const settings = this.ctx.host.getSettings();
    const data = await this.ctx.host.loadData();
    data.syncMeta = normalizeSyncMeta(data.syncMeta);
    const index = await this.ctx.getWorkingIndex();
    const listIdByName = new Map<string, string>();
    let listIds: string[];
    try {
      listIds = await collectPollListIds(
        this.ctx.todoApi,
        settings,
        index,
        listIdByName
      );
    } catch (error) {
      this.reportDeltaFailure(error, options.silent);
      throw error;
    }
    const listIdToName = await buildListIdToNameMap(
      this.ctx.todoApi,
      settings,
      index,
      listIdByName
    );

    let changes = 0;
    let syncMeta: SyncMeta = data.syncMeta;

    try {
      for (const listId of listIds) {
        const listName = listIdToName.get(listId) ?? "";
        let deltaLink = getDeltaLink(syncMeta, listId);
        let hasMore = true;
        let pageFailed = false;
        while (hasMore) {
          const response = await this.ctx.todoApi.deltaTasks(listId, deltaLink);
          for (const item of response.value ?? []) {
            try {
              let itemChanges = 0;
              if (item["@removed"]) {
                itemChanges = await this.inbound.applyRemoteDeletion(item.id, index, settings);
              } else {
                itemChanges = await this.inbound.applyRemoteTask(
                  item,
                  listId,
                  listName,
                  index,
                  settings,
                  { silent: options.silent }
                );
              }
              if (itemChanges > 0) {
                changes += itemChanges;
                await this.persistProgress(index, syncMeta);
              }
            } catch (error) {
              pageFailed = true;
              globalThis.console.error("Microsoft To Do sync: delta item failed", error);
            }
          }

          if (response["@odata.nextLink"]) {
            deltaLink = response["@odata.nextLink"];
            hasMore = true;
          } else {
            deltaLink = response["@odata.deltaLink"];
            hasMore = false;
          }

          if (pageFailed) {
            break;
          }
        }

        if (deltaLink && !pageFailed) {
          syncMeta = setDeltaLink(syncMeta, listId, deltaLink);
        }
      }
    } catch (error) {
      this.reportDeltaFailure(error, options.silent);
      throw error;
    }

    await removeUntaggedIndexEntriesInVault(this.ctx.host.app, index, settings);

    await savePluginIndexWithMeta(
      this.ctx.host.loadData,
      this.ctx.host.saveData,
      index,
      syncMeta
    );

    if (!options.silent && changes > 0) {
      const strings = this.ctx.host.getStrings();
      new Notice(formatString(strings.notices.pulledChanges, { count: String(changes) }));
    }
    return changes;
  }

  private reportDeltaFailure(error: unknown, silent?: boolean): void {
    globalThis.console.error("Microsoft To Do sync: delta pull failed", error);
    if (silent) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    const strings = this.ctx.host.getStrings();
    new Notice(formatString(strings.notices.deltaPullFailed, { message: message.slice(0, 180) }));
  }

  private async persistProgress(index: SyncIndex, syncMeta: SyncMeta): Promise<void> {
    await savePluginIndexWithMeta(
      this.ctx.host.loadData,
      this.ctx.host.saveData,
      index,
      syncMeta
    );
  }
}
