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
