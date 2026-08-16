import type { MtdPluginData, SyncMeta } from "../types/sync";
import { SyncIndex } from "./sync-index";
import { normalizeSyncMeta } from "./sync-meta";

export async function persistPluginData(
  loadData: () => Promise<MtdPluginData>,
  saveData: (data: MtdPluginData) => Promise<void>,
  index: SyncIndex,
  patch?: (data: MtdPluginData) => void
): Promise<void> {
  const data = await loadData();
  const merged = SyncIndex.fromRecord(data.index);
  merged.importEntries(index.toRecord());
  if (patch) {
    patch(data);
  }
  data.index = merged.toRecord();
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
    data.syncMeta = normalizeSyncMeta(syncMeta);
    patch?.(data);
  });
}
