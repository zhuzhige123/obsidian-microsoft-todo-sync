import { TFile } from "obsidian";
import type MicrosoftTodoSyncPlugin from "../main";
import { openMtdChipMenu } from "./mtd-chip-menu";

export function buildMtdChipActivateHandler(
  plugin: MicrosoftTodoSyncPlugin,
  filePath: string,
  line: number,
  mtdId: string
): (event: MouseEvent) => void {
  return (event: MouseEvent) => {
    const file = plugin.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      return;
    }
    openMtdChipMenu(event, {
      app: plugin.app,
      syncEngine: plugin.syncEngine,
      uiLanguage: plugin.settings.uiLanguage,
      isLoggedIn: () => plugin.auth.isLoggedIn,
      loadIndex: async () => plugin.loadSyncIndex(),
      file,
      line,
      mtdId,
    });
  };
}
