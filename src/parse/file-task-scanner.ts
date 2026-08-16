import type { ListItemCache } from "obsidian";
import type { SyncScopeSettings } from "./sync-tag";
import { hasSyncTag, resolveTargetListName } from "./sync-tag";
import { parseTaskLine } from "./task-line-parser";
import { extractNoteAfterSubtasks } from "./note-block-parser";
import { collectSubtasks, collectSubtasksFromLines } from "./subtask-parser";
import { parseMtdComment } from "./mtd-comment";
import type { ParsedSyncTask } from "../types/sync";

export { collectMtdIdsInLines, findTaskLineByMtdId } from "./mtd-index";
export { findTaskInVault } from "../vault/mtd-locator";

function buildTaskFromLine(
  filePath: string,
  lines: string[],
  line: number,
  listItems: ListItemCache[],
  scope: SyncScopeSettings
): ParsedSyncTask | null {
  const rawLine = lines[line] ?? "";
  const parsed = parseTaskLine(rawLine);
  if (!parsed) {
    return null;
  }

  if (!hasSyncTag(rawLine, scope.syncTag)) {
    return null;
  }

  const mtd = parseMtdComment(rawLine);
  const subtasksFromCache = collectSubtasks(lines, listItems, line);
  const subtasks =
    subtasksFromCache.length > 0
      ? subtasksFromCache
      : collectSubtasksFromLines(lines, line, parsed.indent);
  const lastSubtaskLine =
    subtasks.length > 0 ? subtasks[subtasks.length - 1]?.line ?? null : null;
  const noteBody = extractNoteAfterSubtasks(
    lines,
    line,
    parsed.indent,
    lastSubtaskLine
  );

  return {
    filePath,
    line,
    rawLine,
    checkbox: parsed.checkbox,
    title: parsed.title,
    dueDate: parsed.dueDate,
    dueTime: parsed.dueTime,
    reminderDate: parsed.reminderDate,
    reminderTime: parsed.reminderTime,
    scheduledDate: parsed.scheduledDate,
    startDate: parsed.startDate,
    doneDate: parsed.doneDate,
    cancelledDate: parsed.cancelledDate,
    priority: parsed.priority,
    mtd,
    noteBody,
    subtasks,
    taskIndent: parsed.indent,
    quoteDepth: parsed.quoteDepth,
    eligible: true,
    targetListName: resolveTargetListName(rawLine, scope),
  };
}

export function fileContainsSyncTag(content: string, syncTag: string): boolean {
  return hasSyncTag(content, syncTag);
}

function scanFromListItems(
  filePath: string,
  lines: string[],
  listItems: ListItemCache[],
  scope: SyncScopeSettings
): ParsedSyncTask[] {
  const tasks: ParsedSyncTask[] = [];
  const seenLines = new Set<number>();
  for (const item of listItems) {
    if (item.task === undefined) {
      continue;
    }
    const line = item.position.start.line;
    if (seenLines.has(line)) {
      continue;
    }
    const task = buildTaskFromLine(filePath, lines, line, listItems, scope);
    if (task) {
      seenLines.add(line);
      tasks.push(task);
    }
  }
  return tasks;
}

function scanFromLines(
  filePath: string,
  lines: string[],
  listItems: ListItemCache[],
  scope: SyncScopeSettings
): ParsedSyncTask[] {
  const tasks: ParsedSyncTask[] = [];
  const seenLines = new Set<number>();
  for (let line = 0; line < lines.length; line++) {
    const task = buildTaskFromLine(filePath, lines, line, listItems, scope);
    if (task && !seenLines.has(line)) {
      seenLines.add(line);
      tasks.push(task);
    }
  }
  return tasks;
}

export function scanFileForSyncTasks(
  filePath: string,
  lines: string[],
  listItems: ListItemCache[],
  scope: SyncScopeSettings | string
): ParsedSyncTask[] {
  const settings: SyncScopeSettings =
    typeof scope === "string"
      ? {
          syncTag: scope,
          todoListName: "Obsidian Sync",
          defaultInboundVaultPath: "Microsoft To Do/Inbox.md",
          listRoutes: [],
        }
      : scope;
  const byLine = new Map<number, ParsedSyncTask>();
  for (const task of scanFromListItems(filePath, lines, listItems, settings)) {
    byLine.set(task.line, task);
  }
  for (const task of scanFromLines(filePath, lines, listItems, settings)) {
    byLine.set(task.line, task);
  }
  return [...byLine.values()].sort((a, b) => a.line - b.line);
}

