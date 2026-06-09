import type { UiLanguage } from "../i18n";

export type RemoteDeletePolicy = "delete" | "unlink" | "keep";

export interface ListRouteEntry {
  /** Sub-tag path after the sync namespace, e.g. "基础任务" for #msd/基础任务 */
  tagPath: string;
  /** Microsoft To Do list display name */
  listName: string;
}

/** leave_file: sync when switching away; idle: after pause while editing; manual: ribbon/commands only */
export type AutoSyncMode = "leave_file" | "idle" | "manual";

export interface MtdPluginSettings {
  uiLanguage: UiLanguage;
  autoSyncMode: AutoSyncMode;
  autoSyncIdleSeconds: number;
  autoSyncTagDelaySeconds: number;
  syncAfterLogin: boolean;
  notifyOnAutoSync: boolean;
  syncTag: string;
  todoListName: string;
  listRoutes: ListRouteEntry[];
  deltaIntervalMinutes: number;
  remoteDeletePolicy: RemoteDeletePolicy;
  appendBacklinkToTodo: boolean;
  createLinkedResource: boolean;
  azureClientId: string;
  azureTenant: string;
  accountDisplayName: string;
}
