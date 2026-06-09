import type { ParsedSyncTask } from "../types/sync";

/** Normalized task body used to detect unsynced Obsidian edits. */
export function computeTaskSnapshot(task: ParsedSyncTask): string {
  const subtasks = task.subtasks
    .map((sub) => `${sub.title}|${sub.checked}`)
    .join(";");
  return JSON.stringify({
    checkbox: task.checkbox,
    title: task.title,
    dueDate: task.dueDate ?? null,
    dueTime: task.dueTime ?? null,
    reminderDate: task.reminderDate ?? null,
    reminderTime: task.reminderTime ?? null,
    scheduledDate: task.scheduledDate ?? null,
    priority: task.priority,
    noteBody: task.noteBody,
    subtasks,
  });
}

export type SyncDirection = "skip" | "push" | "pull";

export function decideSyncDirection(options: {
  localDirty: boolean;
  remoteDirty: boolean;
  localMs: number;
  remoteMs: number;
}): SyncDirection {
  const { localDirty, remoteDirty, localMs, remoteMs } = options;
  if (!localDirty && !remoteDirty) {
    return "skip";
  }
  if (localDirty && !remoteDirty) {
    return "push";
  }
  if (!localDirty && remoteDirty) {
    return "pull";
  }
  return localMs >= remoteMs ? "push" : "pull";
}

export function parseGraphModifiedMs(value?: string): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
