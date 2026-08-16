import type { App } from "obsidian";
import type { MsAuthService } from "../auth/ms-auth-service";
import type { GraphClient } from "../graph/graph-client";
import type { TodoApi } from "../graph/todo-api";
import type { MtdStrings } from "../i18n";
import type { MtdPluginSettings } from "../settings/types";
import type { MtdPluginData } from "../types/sync";
import type { SyncIndex } from "./sync-index";

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

export interface SyncContext {
  host: SyncEngineHost;
  todoApi: TodoApi;
  /** Shared in-flight index while the sync queue is active. */
  getWorkingIndex: () => Promise<SyncIndex>;
}
