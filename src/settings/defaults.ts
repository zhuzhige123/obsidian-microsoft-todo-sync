import type { ListRouteEntry, MtdPluginSettings } from "./types";
import { SETTINGS_BOUNDS, clampInt } from "./settings-bounds";

export const DEFAULT_SETTINGS: MtdPluginSettings = {
  uiLanguage: "auto",
  autoSyncMode: "leave_file",
  autoSyncIdleSeconds: 8,
  autoSyncTagDelaySeconds: 4,
  syncAfterLogin: true,
  notifyOnAutoSync: true,
  syncTag: "mtd-sync",
  todoListName: "Obsidian Sync",
  defaultInboundVaultPath: "Microsoft To Do/Inbox.md",
  listRoutes: [],
  deltaIntervalMinutes: 5,
  remoteDeletePolicy: "delete",
  appendBacklinkToTodo: true,
  createLinkedResource: true,
  cleanupRemoteOnUnlink: true,
  stripInboundRouteHeader: true,
  azureClientId: "",
  azureTenant: "common",
  accountDisplayName: "",
};

function normalizeListRoutes(raw: unknown): ListRouteEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const routes: ListRouteEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const tagPath = typeof record.tagPath === "string" ? record.tagPath.trim() : "";
    const listName = typeof record.listName === "string" ? record.listName.trim() : "";
    const vaultPath = typeof record.vaultPath === "string" ? record.vaultPath.trim() : "";
    if (tagPath && listName) {
      routes.push({ tagPath, listName, vaultPath });
    }
  }
  return routes;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

export function normalizeSettings(raw: Partial<MtdPluginSettings> | undefined): MtdPluginSettings {
  return {
    ...DEFAULT_SETTINGS,
    syncTag: String(raw?.syncTag ?? DEFAULT_SETTINGS.syncTag).replace(/^#/, "").trim() || DEFAULT_SETTINGS.syncTag,
    todoListName: String(raw?.todoListName ?? DEFAULT_SETTINGS.todoListName).trim() || DEFAULT_SETTINGS.todoListName,
    defaultInboundVaultPath:
      String(raw?.defaultInboundVaultPath ?? DEFAULT_SETTINGS.defaultInboundVaultPath).trim() ||
      DEFAULT_SETTINGS.defaultInboundVaultPath,
    listRoutes: normalizeListRoutes(raw?.listRoutes),
    deltaIntervalMinutes: clampInt(
      Number(raw?.deltaIntervalMinutes),
      SETTINGS_BOUNDS.deltaIntervalMinutes.min,
      SETTINGS_BOUNDS.deltaIntervalMinutes.max,
      SETTINGS_BOUNDS.deltaIntervalMinutes.default
    ),
    remoteDeletePolicy:
      raw?.remoteDeletePolicy === "unlink" || raw?.remoteDeletePolicy === "keep"
        ? raw.remoteDeletePolicy
        : DEFAULT_SETTINGS.remoteDeletePolicy,
    uiLanguage:
      raw?.uiLanguage === "en" || raw?.uiLanguage === "zh" || raw?.uiLanguage === "auto"
        ? raw.uiLanguage
        : DEFAULT_SETTINGS.uiLanguage,
    autoSyncMode:
      raw?.autoSyncMode === "idle" || raw?.autoSyncMode === "manual" || raw?.autoSyncMode === "leave_file"
        ? raw.autoSyncMode
        : DEFAULT_SETTINGS.autoSyncMode,
    autoSyncIdleSeconds: clampInt(
      Number(raw?.autoSyncIdleSeconds),
      SETTINGS_BOUNDS.autoSyncIdleSeconds.min,
      SETTINGS_BOUNDS.autoSyncIdleSeconds.max,
      SETTINGS_BOUNDS.autoSyncIdleSeconds.default
    ),
    autoSyncTagDelaySeconds: clampInt(
      Number(raw?.autoSyncTagDelaySeconds),
      SETTINGS_BOUNDS.autoSyncTagDelaySeconds.min,
      SETTINGS_BOUNDS.autoSyncTagDelaySeconds.max,
      SETTINGS_BOUNDS.autoSyncTagDelaySeconds.default
    ),
    syncAfterLogin: normalizeBoolean(raw?.syncAfterLogin, DEFAULT_SETTINGS.syncAfterLogin),
    notifyOnAutoSync: normalizeBoolean(raw?.notifyOnAutoSync, DEFAULT_SETTINGS.notifyOnAutoSync),
    appendBacklinkToTodo: normalizeBoolean(
      raw?.appendBacklinkToTodo,
      DEFAULT_SETTINGS.appendBacklinkToTodo
    ),
    createLinkedResource: normalizeBoolean(
      raw?.createLinkedResource,
      DEFAULT_SETTINGS.createLinkedResource
    ),
    cleanupRemoteOnUnlink: normalizeBoolean(
      raw?.cleanupRemoteOnUnlink,
      DEFAULT_SETTINGS.cleanupRemoteOnUnlink
    ),
    stripInboundRouteHeader: normalizeBoolean(
      raw?.stripInboundRouteHeader,
      DEFAULT_SETTINGS.stripInboundRouteHeader
    ),
    azureClientId: String(raw?.azureClientId ?? DEFAULT_SETTINGS.azureClientId).trim(),
    azureTenant: String(raw?.azureTenant ?? DEFAULT_SETTINGS.azureTenant).trim() || DEFAULT_SETTINGS.azureTenant,
    accountDisplayName: "",
  };
}
