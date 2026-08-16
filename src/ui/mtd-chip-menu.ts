import { Menu, Notice, TFile, type App } from "obsidian";
import { formatString, getStrings, type UiLanguage } from "../i18n";
import { copyObsidianTaskLink, openMicrosoftTodoTask } from "../navigation/task-actions";
import type { SyncEngine } from "../sync/sync-engine";
import { SyncIndex } from "../sync/sync-index";

export interface MtdChipMenuContext {
  app: App;
  syncEngine: SyncEngine;
  uiLanguage: UiLanguage;
  isLoggedIn: () => boolean;
  loadIndex: () => Promise<SyncIndex>;
  file: TFile;
  line: number;
  mtdId: string;
}

function requireSignedIn(context: MtdChipMenuContext): boolean {
  if (context.isLoggedIn()) {
    return true;
  }
  new Notice(getStrings(context.uiLanguage).notices.signInFirst);
  return false;
}

function reportChipError(context: MtdChipMenuContext, error: unknown): void {
  window.console.error("Microsoft To Do sync: chip action failed", error);
  const message = error instanceof Error ? error.message : String(error);
  new Notice(
    formatString(getStrings(context.uiLanguage).chips.actionFailed, {
      message: message.slice(0, 180),
    })
  );
}

async function runChipAction(
  context: MtdChipMenuContext,
  action: () => Promise<boolean>,
  successNotice: string
): Promise<void> {
  try {
    const ok = await action();
    if (ok) {
      new Notice(successNotice);
    }
  } catch (error) {
    reportChipError(context, error);
  }
}

export function openMtdChipMenu(event: MouseEvent, context: MtdChipMenuContext): void {
  event.preventDefault();
  event.stopPropagation();

  const strings = getStrings(context.uiLanguage).chips;
  const menu = new Menu();

  menu.addItem((item) => {
    item.setTitle(strings.pushNow).onClick(() => {
      if (!requireSignedIn(context)) {
        return;
      }
      void runChipAction(
        context,
        () => context.syncEngine.pushTaskAt(context.file, context.line),
        strings.pushed
      );
    });
  });

  menu.addItem((item) => {
    item.setTitle(strings.pullNow).onClick(() => {
      if (!requireSignedIn(context)) {
        return;
      }
      void runChipAction(
        context,
        () => context.syncEngine.pullTaskAt(context.file, context.line),
        strings.pulled
      );
    });
  });

  menu.addItem((item) => {
    item.setTitle(strings.openInTodo).onClick(() => {
      void openTaskInTodo(context).catch((error) => reportChipError(context, error));
    });
  });

  menu.addItem((item) => {
    item.setTitle(strings.copyLink).onClick(() => {
      void copyTaskLink(context).catch((error) => reportChipError(context, error));
    });
  });

  menu.addSeparator();

  menu.addItem((item) => {
    item.setTitle(strings.unlink).setWarning(true).onClick(() => {
      void runChipAction(
        context,
        () => context.syncEngine.unlinkTaskAt(context.file, context.line),
        strings.unlinked
      );
    });
  });

  menu.showAtMouseEvent(event);
}

async function openTaskInTodo(context: MtdChipMenuContext): Promise<void> {
  const strings = getStrings(context.uiLanguage).chips;
  const index = await context.loadIndex();
  const entry = index.getByMtdId(context.mtdId);
  if (!entry?.graphTaskId) {
    new Notice(strings.openTodoUnavailable);
    return;
  }
  openMicrosoftTodoTask(entry.graphTaskId);
}

async function copyTaskLink(context: MtdChipMenuContext): Promise<void> {
  const strings = getStrings(context.uiLanguage).chips;
  await copyObsidianTaskLink(context.app, context.mtdId, {
    linkCopied: strings.linkCopied,
    copyLinkFailed: strings.copyLinkFailed,
  });
}
