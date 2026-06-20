import { TFile } from "obsidian";
import { resolveTaskChecklist } from "../graph/task-checklist";
import type { TodoApi } from "../graph/todo-api";
import type { GraphChecklistItem, GraphTodoTask } from "../types/graph";
import type { MtdPluginSettings } from "../settings/types";
import type { ParsedSyncTask, SyncIndexEntry } from "../types/sync";
import { graphTaskToObsidianPatch } from "./field-mapper";
import { resolveNoteBodyOnPull } from "./backlink-writer";
import { graphIndexTimestamps } from "./graph-index-timestamps";
import { computeTaskSnapshot } from "./task-snapshot";
import { rebuildFileSection } from "./vault-task-writer";
import { SyncIndex } from "./sync-index";
import { mergeRemoteChecklistIntoSubtasks } from "./remote-checklist-merge";

export interface ApplyRemoteTaskOptions {
  preserveLocalNote?: boolean;
  checklist?: GraphChecklistItem[];
}

export async function applyRemoteTaskToLines(
  todoApi: TodoApi,
  task: ParsedSyncTask,
  remoteTask: GraphTodoTask,
  entry: SyncIndexEntry,
  lines: string[],
  file: TFile,
  settings: MtdPluginSettings,
  index: SyncIndex,
  options: ApplyRemoteTaskOptions = {}
): Promise<string[]> {
  const patch = graphTaskToObsidianPatch(remoteTask, { scheduledMapsToStart: true });
  const checklist = options.checklist
    ? options.checklist
    : await resolveTaskChecklist(todoApi, entry.graphListId, remoteTask);
  const { subtasks, steps } = mergeRemoteChecklistIntoSubtasks(
    task,
    checklist,
    entry.steps ?? {}
  );
  entry.steps = steps;

  const noteBody = options.preserveLocalNote
    ? task.noteBody
    : resolveNoteBodyOnPull(task.noteBody, remoteTask.body?.content);

  const mergedTask: ParsedSyncTask = {
    ...task,
    ...patch,
    checkbox: patch.checkbox as ParsedSyncTask["checkbox"],
    title: patch.title,
    noteBody,
    priority: patch.priority ?? task.priority,
    startDate: patch.startDate ?? task.startDate,
    doneDate: patch.doneDate ?? (patch.checkbox === "x" ? task.doneDate : undefined),
    mtd: { id: entry.mtdId, myday: task.mtd.myday },
  };

  const rebuilt = rebuildFileSection(lines, mergedTask, settings.syncTag, noteBody, subtasks);

  Object.assign(entry, graphIndexTimestamps(remoteTask));
  entry.lineHint = task.line;
  entry.obsidianModified = file.stat.mtime;
  entry.taskSnapshot = computeTaskSnapshot(mergedTask);
  index.upsert(entry);
  return rebuilt;
}
