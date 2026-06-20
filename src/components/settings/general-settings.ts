import { Setting } from "obsidian";
import type { UiLanguage } from "../../i18n";
import type { MtdStrings } from "../../i18n/types";
import type MicrosoftTodoSyncPlugin from "../../main";
import { SETTINGS_BOUNDS, parseBoundedInt } from "../../settings/settings-bounds";
import { wireTextSetting } from "./settings-field";

export function mountGeneralSettings(
  hosts: {
    interface: HTMLElement;
    scope: HTMLElement;
    autoSync: HTMLElement;
    remote: HTMLElement;
    links: HTMLElement;
    deletion: HTMLElement;
    notifications: HTMLElement;
  },
  plugin: MicrosoftTodoSyncPlugin,
  strings: MtdStrings,
  save: () => Promise<void>,
  updateUiLanguage: (value: UiLanguage) => Promise<void>
): void {
  new Setting(hosts.interface)
    .setName(strings.language.name)
    .setDesc(strings.language.desc)
    .addDropdown((dropdown) => {
      dropdown.addOption("auto", strings.language.auto);
      dropdown.addOption("en", strings.language.en);
      dropdown.addOption("zh", strings.language.zh);
      dropdown.setValue(plugin.settings.uiLanguage);
      dropdown.onChange(async (value) => {
        if (value === "auto" || value === "en" || value === "zh") {
          await updateUiLanguage(value);
        }
      });
    });

  new Setting(hosts.scope)
    .setName(strings.sync.syncTagName)
    .setDesc(strings.sync.syncTagDesc)
    .addText((text) => {
      wireTextSetting(
        text,
        () => plugin.settings.syncTag,
        (value) => {
          plugin.settings.syncTag = value.replace(/^#/, "").trim() || "mtd-sync";
        },
        save
      );
    });

  new Setting(hosts.scope)
    .setName(strings.sync.listName)
    .setDesc(strings.sync.listDesc)
    .addText((text) => {
      wireTextSetting(
        text,
        () => plugin.settings.todoListName,
        (value) => {
          plugin.settings.todoListName = value.trim() || "Obsidian Sync";
        },
        save
      );
    });

  new Setting(hosts.scope)
    .setName(strings.sync.defaultInboundVaultPathName)
    .setDesc(strings.sync.defaultInboundVaultPathDesc)
    .addText((text) => {
      wireTextSetting(
        text,
        () => plugin.settings.defaultInboundVaultPath,
        (value) => {
          plugin.settings.defaultInboundVaultPath =
            value.trim() || "Microsoft To Do/Inbox.md";
        },
        save
      );
    });

  new Setting(hosts.scope)
    .setName(strings.sync.inboundRouteName)
    .setDesc(strings.sync.inboundRouteDesc);

  new Setting(hosts.autoSync)
    .setName(strings.sync.autoSyncModeName)
    .setDesc(strings.sync.autoSyncModeDesc)
    .addDropdown((dropdown) => {
      dropdown.addOption("leave_file", strings.sync.autoSyncModeLeave);
      dropdown.addOption("idle", strings.sync.autoSyncModeIdle);
      dropdown.addOption("manual", strings.sync.autoSyncModeManual);
      dropdown.setValue(plugin.settings.autoSyncMode);
      dropdown.onChange(async (value) => {
        if (value === "leave_file" || value === "idle" || value === "manual") {
          plugin.settings.autoSyncMode = value;
          await save();
        }
      });
    });

  const idleBounds = SETTINGS_BOUNDS.autoSyncIdleSeconds;
  new Setting(hosts.autoSync)
    .setName(strings.sync.autoSyncIdleName)
    .setDesc(strings.sync.autoSyncIdleDesc)
    .addText((text) => {
      wireTextSetting(
        text,
        () => String(plugin.settings.autoSyncIdleSeconds),
        (value) => {
          plugin.settings.autoSyncIdleSeconds = parseBoundedInt(
            value,
            idleBounds.min,
            idleBounds.max,
            idleBounds.default
          );
        },
        save
      );
    });

  const tagDelayBounds = SETTINGS_BOUNDS.autoSyncTagDelaySeconds;
  new Setting(hosts.autoSync)
    .setName(strings.sync.autoSyncTagDelayName)
    .setDesc(strings.sync.autoSyncTagDelayDesc)
    .addText((text) => {
      wireTextSetting(
        text,
        () => String(plugin.settings.autoSyncTagDelaySeconds),
        (value) => {
          plugin.settings.autoSyncTagDelaySeconds = parseBoundedInt(
            value,
            tagDelayBounds.min,
            tagDelayBounds.max,
            tagDelayBounds.default
          );
        },
        save
      );
    });

  new Setting(hosts.autoSync)
    .setName(strings.sync.syncAfterLoginName)
    .setDesc(strings.sync.syncAfterLoginDesc)
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.syncAfterLogin);
      toggle.onChange(async (value) => {
        plugin.settings.syncAfterLogin = value;
        await save();
      });
    });

  const intervalBounds = SETTINGS_BOUNDS.deltaIntervalMinutes;
  new Setting(hosts.remote)
    .setName(strings.sync.intervalName)
    .setDesc(strings.sync.intervalDesc)
    .addText((text) => {
      wireTextSetting(
        text,
        () => String(plugin.settings.deltaIntervalMinutes),
        (value) => {
          plugin.settings.deltaIntervalMinutes = parseBoundedInt(
            value,
            intervalBounds.min,
            intervalBounds.max,
            intervalBounds.default
          );
        },
        async () => {
          await save();
          plugin.restartDeltaPoller();
        }
      );
    });

  new Setting(hosts.links)
    .setName(strings.sync.backlinkName)
    .setDesc(strings.sync.backlinkDesc)
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.appendBacklinkToTodo);
      toggle.onChange(async (value) => {
        plugin.settings.appendBacklinkToTodo = value;
        await save();
      });
    });

  new Setting(hosts.links)
    .setName(strings.sync.linkedResourceName)
    .setDesc(strings.sync.linkedResourceDesc)
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.createLinkedResource);
      toggle.onChange(async (value) => {
        plugin.settings.createLinkedResource = value;
        await save();
      });
    });

  new Setting(hosts.links)
    .setName(strings.sync.stripInboundRouteHeaderName)
    .setDesc(strings.sync.stripInboundRouteHeaderDesc)
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.stripInboundRouteHeader);
      toggle.onChange(async (value) => {
        plugin.settings.stripInboundRouteHeader = value;
        await save();
      });
    });

  new Setting(hosts.links)
    .setName(strings.sync.cleanupRemoteOnUnlinkName)
    .setDesc(strings.sync.cleanupRemoteOnUnlinkDesc)
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.cleanupRemoteOnUnlink);
      toggle.onChange(async (value) => {
        plugin.settings.cleanupRemoteOnUnlink = value;
        await save();
      });
    });

  new Setting(hosts.deletion)
    .setName(strings.sync.deletePolicyName)
    .setDesc(strings.sync.deletePolicyDesc)
    .addDropdown((dropdown) => {
      dropdown.addOption("delete", strings.sync.deletePolicyDelete);
      dropdown.addOption("unlink", strings.sync.deletePolicyUnlink);
      dropdown.addOption("keep", strings.sync.deletePolicyKeep);
      dropdown.setValue(plugin.settings.remoteDeletePolicy);
      dropdown.onChange(async (value) => {
        if (value === "delete" || value === "unlink" || value === "keep") {
          plugin.settings.remoteDeletePolicy = value;
          await save();
        }
      });
    });

  new Setting(hosts.notifications)
    .setName(strings.sync.notifyOnAutoSyncName)
    .setDesc(strings.sync.notifyOnAutoSyncDesc)
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.notifyOnAutoSync);
      toggle.onChange(async (value) => {
        plugin.settings.notifyOnAutoSync = value;
        await save();
      });
    });
}
