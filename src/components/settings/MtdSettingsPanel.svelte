<script lang="ts">
  import { onMount, untrack } from "svelte";
  import TabNavigation from "../ui/TabNavigation.svelte";
  import LoginHelpModal from "./LoginHelpModal.svelte";
  import ListRoutesTable from "./ListRoutesTable.svelte";
  import ExcludedFoldersList from "./ExcludedFoldersList.svelte";
  import { mountAccountSettings, mountAdvancedSettings } from "./account-settings";
  import { mountGeneralSettings } from "./general-settings";
  import { clearSettingsHosts, mountSettingsHosts } from "./native-settings-host";
  import { getStrings } from "../../i18n";
  import { normalizeExcludedFolders } from "../../vault/excluded-folders";
  import type { UiLanguage } from "../../i18n";
  import type MicrosoftTodoSyncPlugin from "../../main";

  interface Props {
    plugin: MicrosoftTodoSyncPlugin;
  }

  type SettingsTabId = "general" | "account" | "about";

  const TAB_PANEL_IDS: Record<SettingsTabId, string> = {
    general: "mtd-settings-panel-general",
    account: "mtd-settings-panel-account",
    about: "mtd-settings-panel-about",
  };

  let { plugin }: Props = $props();

  let activeTab = $state<SettingsTabId>("general");
  /** Bumps when plugin settings or auth state change so Svelte re-reads non-reactive plugin.settings. */
  let stateVersion = $state(0);
  let showLoginHelp = $state(false);
  let excludedFolders = $state<string[]>(
    untrack(() => normalizeExcludedFolders(plugin.settings.excludedFolders))
  );
  let interfaceSettingsHost = $state<HTMLDivElement | null>(null);
  let scopeSettingsHost = $state<HTMLDivElement | null>(null);
  let listRoutesSettingsHost = $state<HTMLDivElement | null>(null);
  let autoSyncSettingsHost = $state<HTMLDivElement | null>(null);
  let remoteSettingsHost = $state<HTMLDivElement | null>(null);
  let linksSettingsHost = $state<HTMLDivElement | null>(null);
  let deletionSettingsHost = $state<HTMLDivElement | null>(null);
  let notificationsSettingsHost = $state<HTMLDivElement | null>(null);
  let accountSettingsHost = $state<HTMLDivElement | null>(null);
  let advancedSettingsHost = $state<HTMLDivElement | null>(null);

  function bumpState(): void {
    stateVersion += 1;
  }

  let strings = $derived.by(() => {
    stateVersion;
    return getStrings(plugin.settings.uiLanguage);
  });

  let tabs = $derived.by(() => {
    stateVersion;
    return [
      { id: "general", label: strings.tabs.general, panelId: TAB_PANEL_IDS.general },
      { id: "account", label: strings.tabs.account, panelId: TAB_PANEL_IDS.account },
      { id: "about", label: strings.tabs.about, panelId: TAB_PANEL_IDS.about },
    ] as const;
  });

  let isLoggedIn = $derived.by(() => {
    stateVersion;
    return plugin.auth.isLoggedIn;
  });

  let pluginDisplayName = $derived.by(() => {
    stateVersion;
    return plugin.manifest?.name ?? "MS To Do Sync";
  });

  let pluginDisplayVersion = $derived.by(() => {
    stateVersion;
    return plugin.manifest?.version ? `v${plugin.manifest.version}` : "";
  });

  let contactItems = $derived.by(() => {
    stateVersion;
    return [
      {
        label: strings.about.email,
        href: "mailto:tutaoyuan8@outlook.com?subject=Microsoft%20To%20Do%20Sync%20%E5%8F%8D%E9%A6%88",
      },
      {
        label: strings.about.qqGroup,
        href: "https://qm.qq.com/q/uN7Ungeq1G",
      },
      {
        label: strings.about.docs,
        href: "https://github.com/zhuzhige123/obsidian-microsoft-todo-sync/tree/main/docs",
      },
      {
        label: strings.about.issues,
        href: "https://github.com/zhuzhige123/obsidian-microsoft-todo-sync/issues",
      },
    ];
  });

  async function save(): Promise<void> {
    await plugin.saveSettings();
    bumpState();
  }

  async function updateUiLanguage(value: UiLanguage): Promise<void> {
    if (plugin.settings.uiLanguage === value) {
      return;
    }
    plugin.settings.uiLanguage = value;
    await save();
  }

  function switchTab(tabId: SettingsTabId): void {
    activeTab = tabId;
  }

  $effect(() => {
    const unsubscribeAuth = plugin.onAuthStateChange(() => {
      bumpState();
    });
    return unsubscribeAuth;
  });

  onMount(() => {
    return () => {
      clearSettingsHosts(
        interfaceSettingsHost,
        scopeSettingsHost,
        listRoutesSettingsHost,
        autoSyncSettingsHost,
        remoteSettingsHost,
        linksSettingsHost,
        deletionSettingsHost,
        notificationsSettingsHost,
        accountSettingsHost,
        advancedSettingsHost
      );
    };
  });

  $effect(() => {
    stateVersion;
    strings;

    if (
      activeTab !== "general"
      || !interfaceSettingsHost
      || !scopeSettingsHost
      || !listRoutesSettingsHost
      || !autoSyncSettingsHost
      || !remoteSettingsHost
      || !linksSettingsHost
      || !deletionSettingsHost
      || !notificationsSettingsHost
    ) {
      return;
    }

    return mountSettingsHosts(
      [
        interfaceSettingsHost,
        scopeSettingsHost,
        listRoutesSettingsHost,
        autoSyncSettingsHost,
        remoteSettingsHost,
        linksSettingsHost,
        deletionSettingsHost,
        notificationsSettingsHost,
      ],
      () => {
        mountGeneralSettings(
          {
            interface: interfaceSettingsHost!,
            scope: scopeSettingsHost!,
            listRoutes: listRoutesSettingsHost!,
            autoSync: autoSyncSettingsHost!,
            remote: remoteSettingsHost!,
            links: linksSettingsHost!,
            deletion: deletionSettingsHost!,
            notifications: notificationsSettingsHost!,
          },
          plugin,
          strings,
          save,
          updateUiLanguage
        );
      }
    );
  });

  $effect(() => {
    stateVersion;
    strings;
    isLoggedIn;

    if (activeTab !== "account" || !accountSettingsHost) {
      return;
    }

    return mountSettingsHosts([accountSettingsHost], () => {
      mountAccountSettings(
        accountSettingsHost!,
        plugin,
        strings,
        isLoggedIn,
        save,
        () => {
          showLoginHelp = true;
        },
        bumpState
      );
    });
  });

  $effect(() => {
    stateVersion;
    strings;

    if (activeTab !== "account" || !advancedSettingsHost) {
      return;
    }

    return mountSettingsHosts([advancedSettingsHost], () => {
      mountAdvancedSettings(advancedSettingsHost!, plugin, strings, save);
    });
  });
</script>

<div class="mtd-settings-root">
  <div class="mtd-settings-tabs">
    <TabNavigation
      tabs={[...tabs]}
      {activeTab}
      onTabChange={(tabId) => {
        switchTab(tabId as SettingsTabId);
      }}
      variant="plain"
    />
  </div>

  <div class="mtd-settings-tab-panel" id={`mtd-settings-panel-${activeTab}`}>
    {#if activeTab === "general"}
      <section class="mtd-settings-section mtd-settings-section--compact">
        <div class="mtd-settings-group mtd-settings-group--panel">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-cyan">{strings.groups.interface}</h3>
          </div>
          <div bind:this={interfaceSettingsHost} class="mtd-native-settings-host"></div>
        </div>

        <div class="mtd-settings-group mtd-settings-group--panel">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-purple">{strings.groups.scope.title}</h3>
            <p class="mtd-settings-group-description">{strings.groups.scope.description}</p>
          </div>
          <div bind:this={scopeSettingsHost} class="mtd-native-settings-host"></div>
        </div>

        <div class="mtd-settings-group mtd-settings-group--panel">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-cyan">
              {strings.groups.listRoutes.title}
            </h3>
            <p class="mtd-settings-group-description">{strings.groups.listRoutes.description}</p>
          </div>
          <div bind:this={listRoutesSettingsHost} class="mtd-native-settings-host"></div>
          <ListRoutesTable
            syncTag={plugin.settings.syncTag}
            routes={plugin.settings.listRoutes}
            strings={strings.sync}
            onRoutesChange={async (routes) => {
              plugin.settings.listRoutes = routes;
              await save();
            }}
          />
        </div>

        <div class="mtd-settings-group mtd-settings-group--panel">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-purple">
              {strings.sync.excludedFoldersName}
            </h3>
            <p class="mtd-settings-group-description">{strings.sync.excludedFoldersDesc}</p>
          </div>
          <div class="mtd-native-settings-host">
            <ExcludedFoldersList
              plugin={plugin}
              folders={excludedFolders}
              strings={strings.sync}
              onFoldersChange={async (next) => {
                plugin.settings.excludedFolders = next;
                excludedFolders = next;
                await save();
              }}
            />
          </div>
        </div>

        <div class="mtd-settings-group mtd-settings-group--panel">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-cyan">{strings.groups.autoSync.title}</h3>
            <p class="mtd-settings-group-description">{strings.groups.autoSync.description}</p>
          </div>
          <div bind:this={autoSyncSettingsHost} class="mtd-native-settings-host"></div>
        </div>

        <div class="mtd-settings-group mtd-settings-group--panel">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-purple">{strings.groups.remote.title}</h3>
            <p class="mtd-settings-group-description">{strings.groups.remote.description}</p>
          </div>
          <div bind:this={remoteSettingsHost} class="mtd-native-settings-host"></div>
        </div>

        <div class="mtd-settings-group mtd-settings-group--panel">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-cyan">{strings.groups.links.title}</h3>
            <p class="mtd-settings-group-description">{strings.groups.links.description}</p>
          </div>
          <div bind:this={linksSettingsHost} class="mtd-native-settings-host"></div>
        </div>

        <div class="mtd-settings-group mtd-settings-group--panel">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-purple">{strings.groups.deletion.title}</h3>
            <p class="mtd-settings-group-description">{strings.groups.deletion.description}</p>
          </div>
          <div bind:this={deletionSettingsHost} class="mtd-native-settings-host"></div>
        </div>

        <div class="mtd-settings-group mtd-settings-group--panel">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-cyan">{strings.groups.notifications.title}</h3>
            <p class="mtd-settings-group-description">{strings.groups.notifications.description}</p>
          </div>
          <div bind:this={notificationsSettingsHost} class="mtd-native-settings-host"></div>
        </div>
      </section>
    {/if}

    {#if activeTab === "account"}
      <section class="mtd-settings-section mtd-settings-section--compact">
        <div class="mtd-settings-group mtd-settings-group--panel">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-purple">{strings.account.title}</h3>
            <p class="mtd-settings-group-description">{strings.account.description}</p>
          </div>
          <div class="mtd-account-card">
            <div bind:this={accountSettingsHost} class="mtd-native-settings-host mtd-account-settings-host"></div>
          </div>
        </div>

        <div class="mtd-settings-group mtd-settings-group--panel">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-cyan">{strings.account.advancedTitle}</h3>
          </div>
          <div bind:this={advancedSettingsHost} class="mtd-native-settings-host"></div>
        </div>
      </section>
    {/if}

    {#if activeTab === "about"}
      <section class="mtd-settings-section mtd-settings-section--about">
        <div class="mtd-settings-group">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-cyan">{strings.about.panelTitle}</h3>
            <p class="mtd-settings-group-description">{strings.about.panelDescription}</p>
          </div>

          <div class="mtd-about-overview-list">
            <div class="mtd-about-overview-section-label">{strings.about.pluginInfo}</div>
            <div class="mtd-about-overview-item">
              <div class="mtd-about-overview-label">{strings.about.pluginName}</div>
              <div class="mtd-about-overview-value">{pluginDisplayName}</div>
            </div>
            {#if pluginDisplayVersion}
              <div class="mtd-about-overview-item">
                <div class="mtd-about-overview-label">{strings.about.version}</div>
                <div class="mtd-about-overview-value">{pluginDisplayVersion}</div>
              </div>
            {/if}
            <div class="mtd-about-overview-item">
              <div class="mtd-about-overview-label">{strings.about.pluginId}</div>
              <div class="mtd-about-overview-value"><code>ms-todo-sync</code></div>
            </div>

            <div class="mtd-about-overview-section-label mtd-about-overview-section-label--separated">
              {strings.about.overview}
            </div>
            <div class="mtd-about-overview-item">
              <div class="mtd-about-overview-label">{strings.about.panelTitle}</div>
              <div class="mtd-about-overview-value">{strings.about.panelDescription}</div>
            </div>
          </div>
        </div>

        <div class="mtd-settings-group mtd-settings-group--panel">
          <div class="mtd-settings-group-header">
            <h3 class="mtd-settings-group-title with-accent-bar accent-purple">{strings.about.contactTitle}</h3>
          </div>

          <div class="mtd-about-links">
            {#each contactItems as item (item.href)}
              <a
                class="mtd-about-link"
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {item.label}
              </a>
            {/each}
          </div>
        </div>
      </section>
    {/if}
  </div>
</div>

<LoginHelpModal open={showLoginHelp} strings={strings.account.loginHelp} onClose={() => {
  showLoginHelp = false;
}} />
