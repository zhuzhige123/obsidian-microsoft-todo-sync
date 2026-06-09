import { Notice, Plugin, TFile } from "obsidian";
import { MsAuthService, type AuthChangeEvent } from "./auth/ms-auth-service";
import { AUTH_PROTOCOL_NAME } from "./config/constants";
import { GraphClient } from "./graph/graph-client";
import { formatString, getStrings } from "./i18n";
import { TaskLocateNavigation } from "./navigation/task-locate-navigation";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings/defaults";
import { MtdSettingsTab } from "./settings/MtdSettingsTab";
import type { MtdPluginSettings } from "./settings/types";
import { AutoSyncScheduler } from "./sync/auto-sync";
import { DeltaPoller } from "./sync/delta-poller";
import {
  createEmptyPluginData,
  mergePluginData,
  readLegacyAuthState,
  SyncEngine,
  type SyncEngineHost,
} from "./sync/sync-engine";
import type { MtdPluginData } from "./types/sync";
import { registerMtdCommentEditorExtension } from "./ui/mtd-editor-extension";
import { registerTaskPostProcessor } from "./ui/task-post-processor";

export default class MicrosoftTodoSyncPlugin extends Plugin {
  settings: MtdPluginSettings = { ...DEFAULT_SETTINGS };
  private pluginData: MtdPluginData = createEmptyPluginData(this.settings);
  private pluginWrittenPaths = new Map<string, number>();
  private readonly authStateListeners = new Set<() => void>();
  private readonly deltaPoller = new DeltaPoller();

  auth!: MsAuthService;
  graph!: GraphClient;
  syncEngine!: SyncEngine;
  taskNavigation!: TaskLocateNavigation;
  private autoSync!: AutoSyncScheduler;

  async onload(): Promise<void> {
    const rawData: unknown = await this.loadData();
    const legacyAuth = readLegacyAuthState(
      rawData && typeof rawData === "object" && "auth" in rawData
        ? (rawData as { auth?: unknown }).auth
        : undefined
    );
    await this.loadAllData(rawData);

    this.auth = new MsAuthService(
      this.app,
      () => this.settings.azureClientId,
      () => this.settings.azureTenant,
      async (event) => {
        await this.persistAuth(event);
      }
    );
    const migrated = await this.auth.hydrateFromStorage(legacyAuth);
    if (migrated) {
      await this.saveAllData(this.pluginData);
    }

    this.graph = new GraphClient(this.auth);
    this.taskNavigation = new TaskLocateNavigation(this.app, () => this.strings());

    const host: SyncEngineHost = {
      app: this.app,
      getSettings: () => this.settings,
      getStrings: () => this.strings(),
      loadData: async () => this.pluginData,
      saveData: async (data) => this.saveAllData(data),
      auth: this.auth,
      graph: this.graph,
      markPluginWrite: (path) => {
        this.markPluginWrite(path);
      },
    };
    this.syncEngine = new SyncEngine(host);

    this.autoSync = new AutoSyncScheduler({
      app: this.app,
      getSettings: () => this.settings,
      isLoggedIn: () => this.auth.isLoggedIn,
      isSyncing: () => this.syncEngine.busy,
      isPluginWrite: (path) => this.isPluginWrite(path),
      pushFile: async (file) => {
        await this.autoPushFile(file);
      },
    });
    this.autoSync.attach(this);

    this.addSettingTab(new MtdSettingsTab(this.app, this));
    registerTaskPostProcessor(this);
    registerMtdCommentEditorExtension(this);

    this.registerObsidianProtocolHandler("mtd-sync", async (params) => {
      await this.handleDeepLink(params);
    });

    this.registerObsidianProtocolHandler(AUTH_PROTOCOL_NAME, async (params) => {
      await this.handleAuthCallback(params);
    });

    this.startDeltaPoller();

    const strings = this.strings();
    this.addRibbonIcon("refresh-ccw", strings.notices.ribbonTooltip, () => {
      void this.runVaultSync();
    });

    this.addCommand({
      id: "mtd-sync-vault",
      name: strings.commands.syncVault,
      callback: () => {
        void this.runVaultSync();
      },
    });

    this.addCommand({
      id: "mtd-sync-file",
      name: strings.commands.syncFile,
      callback: () => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          void this.runFileSync(file);
        }
      },
    });

    this.addCommand({
      id: "mtd-pull-delta",
      name: strings.commands.pullDelta,
      callback: () => {
        void this.syncEngine.pullDelta();
      },
    });

    if (this.auth.isLoggedIn) {
      const startupPullId = globalThis.setTimeout(() => {
        void this.syncEngine.pullDelta({ silent: true });
      }, 5000) as unknown as number;
      this.register(() => {
        globalThis.clearTimeout(startupPullId);
      });
    }
  }

  onunload(): void {
    this.deltaPoller.stop();
    this.autoSync?.detach();
  }

  startDeltaPoller(): void {
    this.deltaPoller.start(
      this,
      this.settings.deltaIntervalMinutes * 60_000,
      () => {
        void this.syncEngine.pullDelta({ silent: true });
      }
    );
  }

  restartDeltaPoller(): void {
    this.startDeltaPoller();
  }

  async loadAllData(raw?: unknown): Promise<void> {
    const loaded: unknown = raw ?? (await this.loadData());
    const legacySettings =
      loaded && typeof loaded === "object" && "syncTag" in loaded && !("index" in loaded)
        ? normalizeSettings(loaded as Partial<MtdPluginSettings>)
        : normalizeSettings(
            loaded && typeof loaded === "object" && "settings" in loaded
              ? (loaded as Partial<MtdPluginData>).settings
              : undefined
          );
    this.pluginData = mergePluginData(
      loaded && typeof loaded === "object" ? loaded : null,
      legacySettings
    );
    this.settings = this.pluginData.settings;
  }

  async saveSettings(): Promise<void> {
    this.pluginData.settings = this.settings;
    await this.saveAllData(this.pluginData);
  }

  private async saveAllData(data: MtdPluginData): Promise<void> {
    this.pluginData = data;
    this.settings = data.settings;
    await this.saveData(data);
  }

  onAuthStateChange(listener: () => void): () => void {
    this.authStateListeners.add(listener);
    return () => {
      this.authStateListeners.delete(listener);
    };
  }

  private emitAuthStateChange(): void {
    for (const listener of this.authStateListeners) {
      listener();
    }
  }

  private async persistAuth(_event: AuthChangeEvent): Promise<void> {
    this.settings.accountDisplayName = "";
    this.emitAuthStateChange();
    await this.saveAllData(this.pluginData);
    this.emitAuthStateChange();
  }

  private strings() {
    return getStrings(this.settings.uiLanguage);
  }

  private markPluginWrite(path: string): void {
    const until = Date.now() + 5000;
    this.pluginWrittenPaths.set(path, until);
  }

  private isPluginWrite(path: string): boolean {
    const until = this.pluginWrittenPaths.get(path);
    if (until === undefined) {
      return false;
    }
    if (Date.now() > until) {
      this.pluginWrittenPaths.delete(path);
      return false;
    }
    return true;
  }

  async login(): Promise<void> {
    try {
      await this.auth.startBrowserLogin();
      new Notice(this.strings().notices.browserOpened);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(formatString(this.strings().notices.signInFailed, { message }));
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.saveSettings();
    new Notice(this.strings().notices.signedOut);
  }

  async runVaultSync(): Promise<void> {
    const strings = this.strings();
    if (!this.auth.isLoggedIn) {
      new Notice(strings.notices.signInFirst);
      return;
    }
    const count = await this.syncEngine.syncVault({ silent: true });
    new Notice(formatString(strings.notices.syncComplete, { count: String(count) }));
  }

  async runFileSync(file: TFile): Promise<void> {
    if (!this.auth.isLoggedIn) {
      new Notice(this.strings().notices.signInFirst);
      return;
    }
    const changes = await this.syncEngine.pushFile(file, { silent: true });
    const strings = this.strings();
    if (changes > 0) {
      new Notice(formatString(strings.notices.syncedFile, { count: String(changes) }));
    } else {
      new Notice(strings.notices.noTaggedTasks);
    }
  }

  private async handleAuthCallback(params: Record<string, string>): Promise<void> {
    const strings = this.strings();
    if (params.error) {
      new Notice(strings.notices.authRefused);
      return;
    }
    if (!params.code) {
      return;
    }
    try {
      new Notice(strings.notices.connecting);
      await this.auth.completeLogin(params.code);
      new Notice(strings.notices.connected);
      await this.syncEngine.pullDelta({ silent: true });
      if (this.settings.syncAfterLogin) {
        await this.runVaultSync();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(formatString(strings.notices.signInFailed, { message }));
    }
  }

  private async autoPushFile(file: TFile): Promise<void> {
    try {
      const pushed = await this.syncEngine.pushFile(file, { silent: true });
      if (pushed > 0 && this.settings.notifyOnAutoSync) {
        new Notice(formatString(this.strings().notices.pushed, { count: String(pushed) }));
      }
    } catch (error) {
      globalThis.console.error("Microsoft To Do auto sync failed:", error);
    }
  }

  private async handleDeepLink(params: Record<string, string>): Promise<void> {
    const vault = params.vault?.trim();
    const file = params.file?.trim();
    const task = params.task?.trim();
    const lineHint = params.line ? Number.parseInt(params.line, 10) : undefined;

    if (!vault || !file || !task) {
      new Notice(this.strings().notices.invalidTaskLink);
      return;
    }

    await this.taskNavigation.navigateToTask({
      vaultName: decodeURIComponent(vault),
      filePath: decodeURIComponent(file),
      mtdId: task,
      lineHint: Number.isFinite(lineHint) ? lineHint : undefined,
    });
  }
}
