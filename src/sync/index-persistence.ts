import type { MtdPluginData, SyncMeta } from "../types/sync";
import { SyncIndex } from "./sync-index";
import { normalizeSyncMeta } from "./sync-meta";

/**
 * Persist the working sync index as the authoritative snapshot.
 * Removals in `index` must appear on disk — merge-only upserts would resurrect deleted mappings.
 */
export async function persistPluginData(
  loadData: () => Promise<MtdPluginData>,
  saveData: (data: MtdPluginData) => Promise<void>,
  index: SyncIndex,
  patch?: (data: MtdPluginData) => void
): Promise<void> {
  const data = await loadData();
  if (patch) {
    patch(data);
  }
  data.index = index.toRecord();
  await saveData(data);
}

export async function persistPluginDataWithMeta(
  loadData: () => Promise<MtdPluginData>,
  saveData: (data: MtdPluginData) => Promise<void>,
  index: SyncIndex,
  syncMeta: SyncMeta,
  patch?: (data: MtdPluginData) => void
): Promise<void> {
  await persistPluginData(loadData, saveData, index, (data) => {
    const deltaLinks = normalizeSyncMeta(syncMeta).deltaLinks ?? {};
    const ignoredGraphTaskIds = normalizeSyncMeta(data.syncMeta).ignoredGraphTaskIds ?? [];
    data.syncMeta = { deltaLinks, ignoredGraphTaskIds };
    patch?.(data);
  });
}
