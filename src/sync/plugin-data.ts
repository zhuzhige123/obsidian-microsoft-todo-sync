import { normalizeSettings } from "../settings/defaults";
import type { MtdPluginSettings } from "../settings/types";
import type { LegacyAuthState, MtdPluginData } from "../types/sync";
import { normalizeSyncMeta } from "./sync-meta";

/** Bump when plugin data shape migrations are required. */
export const PLUGIN_DATA_VERSION = 1;

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

function normalizePluginDataVersion(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 1) {
    return PLUGIN_DATA_VERSION;
  }
  return Math.floor(raw);
}

export function migratePluginData(data: MtdPluginData): MtdPluginData {
  let version = data.settingsVersion ?? 0;
  if (version < 1) {
    version = 1;
  }
  return { ...data, settingsVersion: version };
}

export function createEmptyPluginData(settings: MtdPluginSettings): MtdPluginData {
  return migratePluginData({
    settingsVersion: PLUGIN_DATA_VERSION,
    settings,
    index: {},
    syncMeta: {},
  });
}

export function mergePluginData(
  raw: Partial<MtdPluginData> | MtdPluginSettings | null | undefined,
  settings: MtdPluginSettings
): MtdPluginData {
  if (!raw) {
    return createEmptyPluginData(settings);
  }
  if ("syncTag" in raw && !("index" in raw)) {
    return migratePluginData({
      settingsVersion: PLUGIN_DATA_VERSION,
      settings: normalizeSettings({ ...settings, ...raw }),
      index: {},
      syncMeta: {},
    });
  }
  const data = raw as Partial<MtdPluginData>;
  const mergedSettings = normalizeSettings({ ...settings, ...(data.settings ?? {}) });
  return migratePluginData({
    settingsVersion: normalizePluginDataVersion(data.settingsVersion),
    settings: mergedSettings,
    index: data.index ?? {},
    syncMeta: normalizeSyncMeta(data.syncMeta),
  });
}
