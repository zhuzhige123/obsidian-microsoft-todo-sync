import type { GraphTodoTask } from "../types/graph";
import type { ParsedSyncTask, SyncIndexEntry } from "../types/sync";
import { stripBacklinkFromBody } from "./backlink-writer";
import { graphTaskToObsidianPatch } from "./field-mapper";

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

function parseSnapshot(snapshot?: string): Record<string, unknown> | null {
  if (!snapshot) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(snapshot);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function splitLocalDirty(
  entry: SyncIndexEntry,
  task: ParsedSyncTask
): { localFieldsDirty: boolean; localNoteDirty: boolean } {
  const current = parseSnapshot(computeTaskSnapshot(task));
  const previous = parseSnapshot(entry.taskSnapshot);
  if (!previous || !current) {
    return { localFieldsDirty: true, localNoteDirty: true };
  }
  const localNoteDirty = (previous.noteBody ?? null) !== (current.noteBody ?? null);
  const previousFields = { ...previous, noteBody: null };
  const currentFields = { ...current, noteBody: null };
  const localFieldsDirty = JSON.stringify(previousFields) !== JSON.stringify(currentFields);
  return { localFieldsDirty, localNoteDirty };
}

function fieldKeysFromSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
  return {
    checkbox: snapshot.checkbox ?? null,
    title: snapshot.title ?? null,
    dueDate: snapshot.dueDate ?? null,
    dueTime: snapshot.dueTime ?? null,
    reminderDate: snapshot.reminderDate ?? null,
    reminderTime: snapshot.reminderTime ?? null,
    scheduledDate: snapshot.scheduledDate ?? null,
    priority: snapshot.priority ?? null,
  };
}

function remoteFieldSnapshot(remoteTask: GraphTodoTask): Record<string, unknown> {
  const patch = graphTaskToObsidianPatch(remoteTask, { scheduledMapsToStart: true });
  return {
    checkbox: patch.checkbox,
    title: patch.title,
    dueDate: patch.dueDate ?? null,
    dueTime: patch.dueTime ?? null,
    reminderDate: patch.reminderDate ?? null,
    reminderTime: patch.reminderTime ?? null,
    scheduledDate: patch.scheduledDate ?? null,
    priority: patch.priority ?? null,
  };
}

/**
 * Detect remote field vs note dirtiness without conflating body edits into field conflicts.
 * `lastModifiedDateTime` alone is not used for fields — body-only Graph edits bump it too.
 */
export function splitRemoteDirty(
  entry: SyncIndexEntry,
  remoteTask: GraphTodoTask
): { remoteFieldsDirty: boolean; remoteNoteDirty: boolean } {
  const previous = parseSnapshot(entry.taskSnapshot);

  let remoteNoteDirty =
    !!remoteTask.bodyLastModifiedDateTime &&
    remoteTask.bodyLastModifiedDateTime !== entry.graphBodyModified;
  if (previous) {
    const remoteNote = stripBacklinkFromBody(remoteTask.body?.content ?? "");
    const noteContentDirty = (previous.noteBody ?? "") !== remoteNote;
    if (!remoteTask.bodyLastModifiedDateTime) {
      remoteNoteDirty = noteContentDirty;
    } else if (!remoteNoteDirty && noteContentDirty && !entry.graphBodyModified) {
      remoteNoteDirty = true;
    }
  }

  let remoteFieldsDirty = false;
  if (previous) {
    remoteFieldsDirty =
      JSON.stringify(fieldKeysFromSnapshot(previous)) !==
      JSON.stringify(remoteFieldSnapshot(remoteTask));
  } else if (
    remoteTask.lastModifiedDateTime &&
    remoteTask.lastModifiedDateTime !== entry.graphModified
  ) {
    remoteFieldsDirty = true;
  }

  const lastModifiedAdvanced =
    !!remoteTask.lastModifiedDateTime &&
    remoteTask.lastModifiedDateTime !== entry.graphModified;
  const bodyModifiedAdvanced =
    !!remoteTask.bodyLastModifiedDateTime &&
    remoteTask.bodyLastModifiedDateTime !== entry.graphBodyModified;

  // Checklist-only (and similar) Graph changes bump lastModified without field/note payload diffs.
  if (!remoteFieldsDirty && !remoteNoteDirty && lastModifiedAdvanced && !bodyModifiedAdvanced) {
    remoteFieldsDirty = true;
  }

  return { remoteFieldsDirty, remoteNoteDirty };
}

export type SyncDirection = "skip" | "push" | "pull";

export interface TaskSyncPlan {
  action: SyncDirection;
  /** Keep Obsidian noteBody when applying a remote pull. */
  preserveLocalNote: boolean;
  /** Push remote noteBody when Obsidian note did not change. */
  useRemoteNoteOnPush: boolean;
}

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

export function decideTaskSyncPlan(options: {
  localFieldsDirty: boolean;
  localNoteDirty: boolean;
  remoteFieldsDirty: boolean;
  remoteNoteDirty: boolean;
  localMs: number;
  remoteMs: number;
}): TaskSyncPlan {
  const {
    localFieldsDirty,
    localNoteDirty,
    remoteFieldsDirty,
    remoteNoteDirty,
    localMs,
    remoteMs,
  } = options;

  if (!localFieldsDirty && !localNoteDirty && !remoteFieldsDirty && !remoteNoteDirty) {
    return { action: "skip", preserveLocalNote: false, useRemoteNoteOnPush: false };
  }

  let action: SyncDirection = "skip";

  if (localFieldsDirty && !remoteFieldsDirty) {
    action = "push";
  } else if (!localFieldsDirty && remoteFieldsDirty) {
    action = "pull";
  } else if (localFieldsDirty && remoteFieldsDirty) {
    action = decideSyncDirection({
      localDirty: true,
      remoteDirty: true,
      localMs,
      remoteMs,
    });
  }

  if (action === "skip") {
    if (localNoteDirty) {
      action = "push";
    } else if (remoteNoteDirty) {
      action = "pull";
    }
  }

  return {
    action,
    preserveLocalNote: action === "pull" && localNoteDirty,
    useRemoteNoteOnPush: action === "push" && remoteNoteDirty && !localNoteDirty,
  };
}

export function parseGraphModifiedMs(value?: string): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
