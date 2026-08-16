import { PluginSettingTab } from "obsidian";
import { mount, unmount } from "svelte";
import MtdSettingsPanel from "../components/settings/MtdSettingsPanel.svelte";
import type MicrosoftTodoSyncPlugin from "../main";

export class MtdSettingsTab extends PluginSettingTab {
  plugin: MicrosoftTodoSyncPlugin;
  private mounted: unknown = null;

  constructor(app: MicrosoftTodoSyncPlugin["app"], plugin: MicrosoftTodoSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    plugin.register(() => {
      void this.destroyPanel();
    });
  }

  /**
   * Declared for Obsidian 1.13+ settings search lint.
   * Return empty so Obsidian still calls `display()` and keeps the Svelte settings UI.
   * A full declarative migration can replace this later without changing minAppVersion.
   */
  getSettingDefinitions(): [] {
    return [];
  }

  display(): void {
    void this.ensurePanel();
  }

  hide(): void {
    void this.plugin.saveSettings();
  }

  private async destroyPanel(): Promise<void> {
    if (!this.mounted) {
      return;
    }
    void unmount(this.mounted);
    this.mounted = null;
  }

  private async ensurePanel(): Promise<void> {
    const { containerEl } = this;
    if (this.mounted && containerEl.childElementCount > 0) {
      return;
    }

    if (this.mounted) {
      await this.destroyPanel();
    }

    containerEl.empty();
    this.mounted = mount(MtdSettingsPanel, {
      target: containerEl,
      props: {
        plugin: this.plugin,
      },
    });
  }
}
