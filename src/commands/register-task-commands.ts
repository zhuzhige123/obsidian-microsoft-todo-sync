import { Notice, type TFile } from "obsidian";
import { formatString, getStrings } from "../i18n";
import { copyObsidianTaskLink, openMicrosoftTodoTask } from "../navigation/task-actions";
import { scanFileForSyncTasks } from "../parse/file-task-scanner";
import { generateMtdId, upsertMtdComment } from "../parse/mtd-comment";
import type MicrosoftTodoSyncPlugin from "../main";
import type { ParsedSyncTask } from "../types/sync";
import { ReminderPromptModal } from "./reminder-prompt-modal";
import {
  applyReminderToTaskLine,
  applyTodayToTaskLine,
  parseReminderInput,
} from "./task-line-edit";

function stringsFor(plugin: MicrosoftTodoSyncPlugin) {
  return getStrings(plugin.settings.uiLanguage);
}

function requireLogin(plugin: MicrosoftTodoSyncPlugin): boolean {
  if (plugin.auth.isLoggedIn) {
    return true;
  }
  new Notice(stringsFor(plugin).notices.signInFirst);
  return false;
}

async function findTaskAtLine(
  plugin: MicrosoftTodoSyncPlugin,
  file: TFile,
  line: number
): Promise<ParsedSyncTask | null> {
  const strings = stringsFor(plugin);
  const content = await plugin.app.vault.read(file);
  const lines = content.split("\n");
  const cache = plugin.app.metadataCache.getFileCache(file);
  const tasks = scanFileForSyncTasks(file.path, lines, cache?.listItems ?? [], plugin.settings);
  const task = tasks.find((item) => item.line === line);
  if (!task) {
    new Notice(strings.notices.noTaskAtLine);
    return null;
  }
  return task;
}

export function registerTaskCommands(plugin: MicrosoftTodoSyncPlugin): void {
  plugin.addCommand({
    id: "mtd-sync-task",
    name: stringsFor(plugin).commands.syncTask,
    editorCallback: (editor, view) => {
      if (!view.file || !requireLogin(plugin)) {
        return;
      }
      void plugin.syncEngine
        .pushTaskAt(view.file, editor.getCursor().line)
        .then((ok) => {
          if (ok) {
            new Notice(stringsFor(plugin).notices.syncedCurrentTask);
          }
        })
        .catch((error) => {
          globalThis.console.error("Microsoft To Do sync: push task command failed", error);
          const message = error instanceof Error ? error.message : String(error);
          new Notice(
            formatString(stringsFor(plugin).notices.syncFailed, { message: message.slice(0, 180) })
          );
        });
    },
  });

  plugin.addCommand({
    id: "mtd-add-today",
    name: stringsFor(plugin).commands.addToday,
    editorCallback: (editor, view) => {
      if (!view.file) {
        return;
      }
      void applyLineEdit(plugin, view.file, editor.getCursor().line, (task) =>
        applyTodayToTaskLine(task, plugin.settings.syncTag)
      );
    },
  });

  plugin.addCommand({
    id: "mtd-set-reminder",
    name: stringsFor(plugin).commands.setReminder,
    editorCallback: (editor, view) => {
      if (!view.file) {
        return;
      }
      const file = view.file;
      const line = editor.getCursor().line;
      new ReminderPromptModal(plugin.app, stringsFor(plugin).commands, (raw) => {
        void applyLineEdit(plugin, file, line, (task) => {
          const parsed = parseReminderInput(raw, task.dueDate);
          if (!parsed) {
            new Notice(stringsFor(plugin).notices.invalidReminder);
            return null;
          }
          return applyReminderToTaskLine(task, plugin.settings.syncTag, parsed);
        });
      }).open();
    },
  });

  plugin.addCommand({
    id: "mtd-open-in-todo",
    name: stringsFor(plugin).commands.openInTodo,
    editorCallback: (editor, view) => {
      if (!view.file) {
        return;
      }
      void openInTodo(plugin, view.file, editor.getCursor().line);
    },
  });

  plugin.addCommand({
    id: "mtd-copy-backlink",
    name: stringsFor(plugin).commands.copyBacklink,
    editorCallback: (editor, view) => {
      if (!view.file) {
        return;
      }
      void copyBacklink(plugin, view.file, editor.getCursor().line);
    },
  });
}

async function applyLineEdit(
  plugin: MicrosoftTodoSyncPlugin,
  file: TFile,
  line: number,
  edit: (task: ParsedSyncTask) => string | null
): Promise<void> {
  const task = await findTaskAtLine(plugin, file, line);
  if (!task) {
    return;
  }

  const nextLine = edit(task);
  if (!nextLine) {
    return;
  }

  const content = await plugin.app.vault.read(file);
  const lines = content.split("\n");
  lines[line] = nextLine;
  plugin.markVaultWrite(file.path);
  await plugin.app.vault.modify(file, lines.join("\n"));

  if (requireLogin(plugin)) {
    await plugin.syncEngine.pushTaskAt(file, line);
  }
}

async function openInTodo(plugin: MicrosoftTodoSyncPlugin, file: TFile, line: number): Promise<void> {
  const strings = stringsFor(plugin);
  const task = await findTaskAtLine(plugin, file, line);
  if (!task?.mtd.id) {
    new Notice(strings.chips.openTodoUnavailable);
    return;
  }

  const index = await plugin.loadSyncIndex();
  const entry = index.getByMtdId(task.mtd.id);
  if (!entry?.graphTaskId) {
    new Notice(strings.chips.openTodoUnavailable);
    return;
  }

  openMicrosoftTodoTask(entry.graphTaskId);
}

async function copyBacklink(plugin: MicrosoftTodoSyncPlugin, file: TFile, line: number): Promise<void> {
  const strings = stringsFor(plugin);
  const content = await plugin.app.vault.read(file);
  const lines = content.split("\n");
  const cache = plugin.app.metadataCache.getFileCache(file);
  const tasks = scanFileForSyncTasks(file.path, lines, cache?.listItems ?? [], plugin.settings);
  const task = tasks.find((item) => item.line === line);
  let mtdId = task?.mtd.id;
  if (!mtdId) {
    mtdId = generateMtdId();
    lines[line] = upsertMtdComment(lines[line] ?? "", { id: mtdId });
    plugin.markVaultWrite(file.path);
    await plugin.app.vault.modify(file, lines.join("\n"));
  }

  await copyObsidianTaskLink(plugin.app, mtdId, {
    linkCopied: strings.chips.linkCopied,
    copyLinkFailed: strings.chips.copyLinkFailed,
  });
}
