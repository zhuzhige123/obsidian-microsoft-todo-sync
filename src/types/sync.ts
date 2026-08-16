import type { MtdComment } from "../parse/mtd-comment";

export interface ParsedSubtask {
  line: number;
  rawLine: string;
  title: string;
  checked: boolean;
  mtd: MtdComment;
}

export interface ParsedSyncTask {
  filePath: string;
  line: number;
  rawLine: string;
  checkbox: " " | "x" | "X" | "/" | "-";
  title: string;
  dueDate?: string;
  dueTime?: string;
  reminderDate?: string;
  reminderTime?: string;
  scheduledDate?: string;
  startDate?: string;
  doneDate?: string;
  cancelledDate?: string;
  priority: "high" | "normal" | "low" | null;
  mtd: MtdComment;
  noteBody: string;
  subtasks: ParsedSubtask[];
  taskIndent: number;
  quoteDepth: number;
  eligible: boolean;
  /** Resolved Microsoft To Do list display name from sync tag routing. */
  targetListName: string;
}

export interface SyncIndexEntry {
  mtdId: string;
  vaultPath: string;
  lineHint: number;
  graphTaskId: string;
  graphListId: string;
  steps: Record<string, string>;
  linkedResourceId?: string;
  obsidianModified: number;
  graphModified?: string;
  /** ISO timestamp of last synced To Do note body (`bodyLastModifiedDateTime`). */
  graphBodyModified?: string;
  /** Fingerprint of last successfully synced task content. */
  taskSnapshot?: string;
}

export interface SyncMeta {
  /** Per-list Microsoft Graph delta links (listId → deltaLink). */
  deltaLinks?: Record<string, string>;
  /** @deprecated Migrated into deltaLinks on load. */
  deltaLink?: string;
  /** @deprecated Migrated into deltaLinks on load. */
  todoListId?: string;
}

/** In-memory session; refresh token is persisted via app.secretStorage only. */
export interface AuthState {
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
}

/** Legacy shape read from data.json before secretStorage migration. */
export interface LegacyAuthState {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
}

export interface MtdPluginData {
  /** Schema version for incremental migrations on load. */
  settingsVersion?: number;
  settings: import("../settings/types").MtdPluginSettings;
  index: Record<string, SyncIndexEntry>;
  syncMeta: SyncMeta;
}
