import { normalizePath, type TFile, type TFolder, type Vault } from "obsidian";
import {
  formatRouteDisplayTag,
  normalizeInboundVaultPath,
  type InboundRoute,
} from "../routing/list-routes";
import { formatFencedNoteBlock } from "../parse/note-block-parser";
import { generateMtdId, serializeMtdComment } from "../parse/mtd-comment";
import { buildTaskLine } from "../parse/task-line-parser";
import { sanitizeTaskDisplayText } from "../parse/task-text";
import type { MtdPluginSettings } from "../settings/types";
import type { GraphChecklistItem, GraphTodoTask } from "../types/graph";
import { graphTaskToObsidianPatch } from "./field-mapper";
import { resolveNoteBodyOnPull } from "./backlink-writer";
import { formatTaskLineBody } from "./task-line-body";

export interface InboundTaskBlock {
  lines: string[];
  mtdId: string;
  steps: Record<string, string>;
  parentLine: number;
}

export interface BuildInboundTaskOptions {
  /** Pre-resolved user note (route header and backlink already stripped). */
  noteBody?: string;
  /** Stable mtd id when assigned before block assembly. */
  mtdId?: string;
}

/** Create missing parent folders for a vault-relative file path. */
export async function ensureVaultParentFolders(vault: Vault, filePath: string): Promise<void> {
  const normalized = normalizePath(filePath);
  const parts = normalized.split("/");
  if (parts.length <= 1) {
    return;
  }

  let current = "";
  for (let index = 0; index < parts.length - 1; index += 1) {
    const segment = parts[index] ?? "";
    if (!segment) {
      continue;
    }
    current = current ? `${current}/${segment}` : segment;
    const existing = vault.getAbstractFileByPath(current);
    if (isVaultFolder(existing)) {
      continue;
    }
    if (isVaultMarkdownFile(existing)) {
      throw new Error(`Cannot create inbound folder "${current}": path is a file`);
    }
    await vault.createFolder(current);
  }
}

function isVaultFolder(entry: unknown): entry is TFolder {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  return "children" in entry && !("extension" in entry);
}

function isVaultMarkdownFile(entry: unknown): entry is TFile {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  return "extension" in entry;
}

export async function ensureInboundFile(vault: Vault, vaultPath: string): Promise<TFile> {
  const normalized = normalizeInboundVaultPath(vaultPath);
  const existing = vault.getAbstractFileByPath(normalized);
  if (isVaultMarkdownFile(existing)) {
    return existing;
  }
  if (isVaultFolder(existing)) {
    throw new Error(`Inbound path is a folder: ${normalized}`);
  }
  await ensureVaultParentFolders(vault, normalized);
  return vault.create(normalized, "");
}

export async function readVaultFileOrEmpty(vault: Vault, file: TFile): Promise<string> {
  try {
    return await vault.read(file);
  } catch (error) {
    if (isVaultEnoentError(error)) {
      return "";
    }
    throw error;
  }
}

export function isVaultEnoentError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const record = error as { code?: string; message?: string };
  return record.code === "ENOENT" || String(record.message ?? "").includes("ENOENT");
}

function syncTagLabel(settings: MtdPluginSettings, route: InboundRoute): string {
  if (route.tagPath) {
    return formatRouteDisplayTag(settings.syncTag, route.tagPath);
  }
  const prefix = settings.syncTag.replace(/^#/, "").trim() || "mtd-sync";
  return `#${prefix}`;
}

export function buildInboundTaskBlock(
  remoteTask: GraphTodoTask,
  checklist: GraphChecklistItem[],
  settings: MtdPluginSettings,
  route: InboundRoute,
  parentLine: number,
  options?: BuildInboundTaskOptions
): InboundTaskBlock {
  const mtdId = options?.mtdId ?? generateMtdId();
  const patch = graphTaskToObsidianPatch(remoteTask, { scheduledMapsToStart: true });
  const tag = syncTagLabel(settings, route);

  const body = formatTaskLineBody({
    title: patch.title ?? "Untitled task",
    tags: [tag],
    checkbox: patch.checkbox,
    dueDate: patch.dueDate,
    dueTime: patch.dueTime,
    reminderDate: patch.reminderDate,
    reminderTime: patch.reminderTime,
    scheduledDate: patch.scheduledDate,
    startDate: patch.startDate,
    priority: patch.priority,
    doneDate: patch.doneDate,
  });

  const mtdComment = serializeMtdComment({ id: mtdId });
  const parentLineText = buildTaskLine({
    indent: "",
    checkbox: patch.checkbox,
    body,
    mtdComment,
  });

  const block: string[] = [parentLineText];
  const steps: Record<string, string> = {};

  checklist.forEach((item, index) => {
    const subtaskLine = parentLine + 1 + index;
    const stepId = `step-${subtaskLine}`;
    steps[stepId] = item.id;
    const check = item.isChecked ? "x" : " ";
    const stepMtd = serializeMtdComment({ step: stepId });
    const title = sanitizeTaskDisplayText(item.displayName?.trim() || "Step");
    block.push(`  - [${check}] ${title}${stepMtd ? ` ${stepMtd}` : ""}`);
  });

  const resolvedNote =
    options?.noteBody ??
    resolveNoteBodyOnPull("", remoteTask.body?.content);
  const noteBody = resolvedNote.trimEnd();
  if (noteBody.trim()) {
    block.push(...formatFencedNoteBlock(noteBody, 0));
  }

  return {
    lines: block,
    mtdId,
    steps,
    parentLine,
  };
}
