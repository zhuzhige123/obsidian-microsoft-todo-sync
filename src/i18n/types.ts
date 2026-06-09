export type ResolvedLocale = "en" | "zh";

export type UiLanguage = "auto" | ResolvedLocale;

export interface MtdStrings {
  tabs: {
    general: string;
    account: string;
    about: string;
  };
  groups: {
    interface: string;
    scope: {
      title: string;
      description: string;
    };
    autoSync: {
      title: string;
      description: string;
    };
    remote: {
      title: string;
      description: string;
    };
    links: {
      title: string;
      description: string;
    };
    deletion: {
      title: string;
      description: string;
    };
    notifications: {
      title: string;
      description: string;
    };
  };
  language: {
    name: string;
    desc: string;
    auto: string;
    en: string;
    zh: string;
  };
  sync: {
    syncTagName: string;
    syncTagDesc: string;
    listName: string;
    listDesc: string;
    listRoutesName: string;
    listRoutesDesc: string;
    listRoutesColTag: string;
    listRoutesColList: string;
    listRoutesColActions: string;
    listRoutesNew: string;
    listRoutesSave: string;
    listRoutesDelete: string;
    listRoutesEmpty: string;
    listRoutesTagPlaceholder: string;
    listRoutesListPlaceholder: string;
    listRoutesErrorTag: string;
    listRoutesErrorList: string;
    listRoutesErrorDuplicate: string;
    listRoutesErrorNamespace: string;
    intervalName: string;
    intervalDesc: string;
    backlinkName: string;
    backlinkDesc: string;
    linkedResourceName: string;
    linkedResourceDesc: string;
    deletePolicyName: string;
    deletePolicyDesc: string;
    deletePolicyDelete: string;
    deletePolicyUnlink: string;
    deletePolicyKeep: string;
    syncAfterLoginName: string;
    syncAfterLoginDesc: string;
    notifyOnAutoSyncName: string;
    notifyOnAutoSyncDesc: string;
    autoSyncModeName: string;
    autoSyncModeDesc: string;
    autoSyncModeLeave: string;
    autoSyncModeIdle: string;
    autoSyncModeManual: string;
    autoSyncIdleName: string;
    autoSyncIdleDesc: string;
    autoSyncTagDelayName: string;
    autoSyncTagDelayDesc: string;
  };
  account: {
    title: string;
    description: string;
    status: string;
    signedIn: string;
    notSignedIn: string;
    connectedStatus: string;
    connectedAs: string;
    signIn: string;
    signOut: string;
    advancedClientIdName: string;
    advancedClientIdDesc: string;
    advancedTenantName: string;
    advancedTenantDesc: string;
    advancedTitle: string;
    loginHelpButton: string;
    loginHelp: {
      title: string;
      close: string;
      items: Array<{ question: string; answer: string }>;
    };
  };
  about: {
    panelTitle: string;
    panelDescription: string;
    pluginInfo: string;
    pluginName: string;
    version: string;
    pluginId: string;
    overview: string;
    contactTitle: string;
    docs: string;
    issues: string;
    email: string;
    qqGroup: string;
  };
  notices: {
    browserOpened: string;
    connecting: string;
    connected: string;
    authRefused: string;
    signInFailed: string;
    signInFirst: string;
    signedOut: string;
    pushed: string;
    syncedFile: string; // {count}
    noTaggedTasks: string;
    syncComplete: string;
    ribbonTooltip: string;
    syncFailed: string;
    syncedTasks: string;
    pulledChanges: string;
    invalidTaskLink: string;
    switchVault: string;
    taskNoteNotFound: string;
    taskLineNotFound: string;
    locatedTask: string;
  };
  commands: {
    syncVault: string;
    syncFile: string;
    pullDelta: string;
  };
  chips: {
    sync: string;
    task: string;
    step: string;
  };
  badges: {
    myDay: string;
  };
}
