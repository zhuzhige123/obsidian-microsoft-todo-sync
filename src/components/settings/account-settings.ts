import { Setting } from "obsidian";
import type { MtdStrings } from "../../i18n/types";
import type MicrosoftTodoSyncPlugin from "../../main";
import { styleDestructiveButton } from "./destructive-ui";
import { wireTextSetting } from "./settings-field";

function addLoginHelpButton(
  setting: Setting,
  strings: MtdStrings,
  onOpenHelp: () => void
): void {
  setting.addButton((button) => {
    button.setButtonText(strings.account.loginHelpButton);
    button.onClick(onOpenHelp);
  });
}

export function mountAccountSettings(
  host: HTMLElement,
  plugin: MicrosoftTodoSyncPlugin,
  strings: MtdStrings,
  isLoggedIn: boolean,
  save: () => Promise<void>,
  onOpenLoginHelp: () => void,
  onAuthChange: () => void
): void {
  if (isLoggedIn) {
    const setting = new Setting(host)
      .setName(strings.account.status)
      .setDesc(`✅ ${strings.account.signedIn}`)
      .addButton((button) => {
        button.setButtonText(strings.account.signOut);
        styleDestructiveButton(button);
        button.onClick(async () => {
          await plugin.logout();
          onAuthChange();
        });
      });
    addLoginHelpButton(setting, strings, onOpenLoginHelp);
    return;
  }

  const setting = new Setting(host)
    .setName(strings.account.status)
    .setDesc(`❌ ${strings.account.notSignedIn}`)
    .addButton((button) => {
      button.setButtonText(strings.account.signIn);
      button.setCta();
      button.onClick(() => {
        void plugin.login();
      });
    });
  addLoginHelpButton(setting, strings, onOpenLoginHelp);
}

export function mountAdvancedSettings(
  host: HTMLElement,
  plugin: MicrosoftTodoSyncPlugin,
  strings: MtdStrings,
  save: () => Promise<void>
): void {
  new Setting(host)
    .setName(strings.account.advancedClientIdName)
    .setDesc(strings.account.advancedClientIdDesc)
    .addText((text) => {
      wireTextSetting(
        text,
        () => plugin.settings.azureClientId,
        (value) => {
          plugin.settings.azureClientId = value.trim();
        },
        save
      );
    });

  new Setting(host)
    .setName(strings.account.advancedTenantName)
    .setDesc(strings.account.advancedTenantDesc)
    .addText((text) => {
      wireTextSetting(
        text,
        () => plugin.settings.azureTenant,
        (value) => {
          plugin.settings.azureTenant = value.trim() || "common";
        },
        save
      );
    });
}
