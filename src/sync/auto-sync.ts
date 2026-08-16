import { MarkdownView, TFile, type App, type Plugin, type WorkspaceLeaf } from "obsidian";
import { fileContainsSyncTag } from "../parse/file-task-scanner";
import { hasSyncTag } from "../parse/task-line-parser";
import type { MtdPluginSettings } from "../settings/types";

export interface AutoSyncHost {
  app: App;
  getSettings: () => MtdPluginSettings;
  isLoggedIn: () => boolean;
  isSyncing: () => boolean;
  isPluginWrite: (path: string) => boolean;
  pushFile: (file: TFile) => Promise<void>;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class AutoSyncScheduler {
  private idleTimers = new Map<string, number>();
  private previousFilePath: string | null = null;

  constructor(private readonly host: AutoSyncHost) {}

  attach(plugin: Plugin): void {
    this.previousFilePath = this.getActiveMarkdownPath();
    plugin.register(() => this.detach());

    plugin.registerEvent(
      plugin.app.workspace.on("active-leaf-change", (_leaf: WorkspaceLeaf | null) => {
        void this.handleActiveLeafChange();
      })
    );

    plugin.registerEvent(
      plugin.app.workspace.on("editor-change", (editor, view) => {
        this.handleEditorChange(editor, view.file);
      })
    );
  }

  private async handleActiveLeafChange(): Promise<void> {
    const settings = this.host.getSettings();
    if (settings.autoSyncMode === "manual" || !this.host.isLoggedIn()) {
      this.previousFilePath = this.getActiveMarkdownPath();
      return;
    }

    const previousPath = this.previousFilePath;
    const activePath = this.getActiveMarkdownPath();
    this.previousFilePath = activePath;

    if (!previousPath || previousPath === activePath) {
      return;
    }

    const file = this.host.app.vault.getAbstractFileByPath(previousPath);
    if (!(file instanceof TFile) || file.extension !== "md") {
      return;
    }

    if (this.host.isSyncing() || this.host.isPluginWrite(file.path)) {
      return;
    }

    const content = await this.host.app.vault.read(file);
    if (!fileContainsSyncTag(content, settings.syncTag)) {
      return;
    }

    await this.host.pushFile(file);
  }

  private handleEditorChange(
    editor: MarkdownView["editor"],
    file: TFile | null | undefined
  ): void {
    const settings = this.host.getSettings();
    if (settings.autoSyncMode === "manual" || !this.host.isLoggedIn() || !file) {
      return;
    }
    if (!(file instanceof TFile) || file.extension !== "md") {
      return;
    }
    if (this.host.isSyncing() || this.host.isPluginWrite(file.path)) {
      return;
    }

    if (settings.autoSyncMode === "idle") {
      this.schedulePush(file, settings.autoSyncIdleSeconds * 1000);
      return;
    }

    const line = editor.getLine(editor.getCursor().line) ?? "";
    const tag = escapeRegex(settings.syncTag.replace(/^#/, ""));
    const tagReady = new RegExp(`#${tag}(?:/[\\p{L}\\p{N}_/-]+)?(?=\\s|$)`, "u").test(line);
    if (tagReady || hasSyncTag(line, settings.syncTag)) {
      this.schedulePush(file, settings.autoSyncTagDelaySeconds * 1000);
    }
  }

  private schedulePush(file: TFile, delayMs: number): void {
    const existing = this.idleTimers.get(file.path);
    if (existing !== undefined) {
      window.clearTimeout(existing);
    }
    const timer = window.setTimeout(() => {
      this.idleTimers.delete(file.path);
      void this.host.pushFile(file);
    }, delayMs);
    this.idleTimers.set(file.path, timer);
  }

  detach(): void {
    for (const timer of this.idleTimers.values()) {
      window.clearTimeout(timer);
    }
    this.idleTimers.clear();
  }

  private getActiveMarkdownPath(): string | null {
    const view = this.host.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file?.path ?? null;
  }
}
