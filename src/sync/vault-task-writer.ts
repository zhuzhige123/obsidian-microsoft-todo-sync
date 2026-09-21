import { serializeMtdComment, stripMtdComment, upsertMtdComment } from "../parse/mtd-comment";
import { formatDueSegment, formatReminderSegment } from "../parse/task-datetime";
import { buildTaskLine, parseTaskLine } from "../parse/task-line-parser";
import { formatFencedNoteBlock } from "../parse/note-block-parser";
import { stripCalloutPrefix, withCalloutPrefix } from "../parse/task-callout";
import { computeTaskBlockEnd } from "../parse/task-block";
import { extractTags } from "../parse/tags";
import { sanitizeTaskDisplayText } from "../parse/task-text";
import type { ParsedSubtask, ParsedSyncTask } from "../types/sync";
import { formatTaskLineBody, taskLineBodyFromParsedTask } from "./task-line-body";

export function rebuildTaskLine(task: ParsedSyncTask, syncTag: string): string {
  const indent = " ".repeat(task.taskIndent);
  const body = formatTaskLineBody(taskLineBodyFromParsedTask(task, syncTag));
  const mtdSerialized = serializeMtdComment(task.mtd);
  const line = buildTaskLine({
    indent,
    checkbox: task.checkbox,
    body,
    mtdComment: mtdSerialized || undefined,
  });
  return withCalloutPrefix(task.quoteDepth ?? 0, line);
}

export function applyGraphPatchToTaskLine(
  rawLine: string,
  patch: {
    checkbox: string;
    title?: string;
    dueDate?: string;
    dueTime?: string;
    reminderDate?: string;
    reminderTime?: string;
    scheduledDate?: string;
  }
): string {
  const { quoteDepth } = stripCalloutPrefix(rawLine);
  let line = rawLine;
  const parsed = parseTaskLine(line);
  if (!parsed) {
    return rawLine;
  }

  line = upsertMtdComment(line, {});

  let stripped = stripMtdComment(line);
  stripped = stripped.replace(/📅\s*\d{4}-\d{2}-\d{2}(?:[ T]\d{1,2}:\d{2})?/g, "");
  stripped = stripped.replace(/⏰\s*(?:\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2})?|\d{1,2}:\d{2})/g, "");
  stripped = stripped.replace(/⏳\s*\d{4}-\d{2}-\d{2}/g, "");
  stripped = stripped.replace(/✅\s*\d{4}-\d{2}-\d{2}/g, "");
  stripped = stripped.replace(/\s{2,}/g, " ").trimEnd();

  const mtdPart = line.match(/<!--\s*mtd:[^>]+-->/)?.[0] ?? "";
  let body = stripped.replace(/^(\s*)([-*+])\s+\[[ xX/-]\]\s+/, "").trim();
  if (patch.title) {
    const tags = extractTags(body).map((tag) => `#${tag}`);
    const priority = body.match(/(⏫|🔺|🔼|🔽|🔻)/g) ?? [];
    const mergedTags = tags.length > 0 ? ` ${tags.join(" ")}` : "";
    const mergedPriority = priority.length > 0 ? ` ${priority.join(" ")}` : "";
    body = `${patch.title.trim()}${mergedTags}${mergedPriority}`.trim();
  }

  const dueSegment = formatDueSegment(patch.dueDate, patch.dueTime);
  if (dueSegment) body += ` ${dueSegment}`;
  const reminderSegment = formatReminderSegment(
    patch.reminderDate,
    patch.reminderTime,
    patch.dueDate
  );
  if (reminderSegment) body += ` ${reminderSegment}`;
  if (patch.scheduledDate) body += ` ⏳ ${patch.scheduledDate}`;

  const indent = " ".repeat(parsed.indent);
  const rebuilt = `${indent}- [${patch.checkbox}] ${body.trim()}${mtdPart ? ` ${mtdPart}` : ""}`;
  return withCalloutPrefix(quoteDepth, rebuilt.trimEnd());
}

export function rebuildFileSection(
  lines: string[],
  task: ParsedSyncTask,
  syncTag: string,
  noteBody: string,
  subtasks: ParsedSubtask[]
): string[] {
  const before = lines.slice(0, task.line);
  const afterIndex = computeTaskBlockEnd(lines, task.line, task.taskIndent);

  const newBlock: string[] = [rebuildTaskLine({ ...task, noteBody }, syncTag)];
  for (const sub of subtasks) {
    const parsedSub = parseTaskLine(sub.rawLine);
    const indentCount = parsedSub && parsedSub.indent > task.taskIndent
      ? parsedSub.indent
      : task.taskIndent + 2;
    const indent = " ".repeat(indentCount);
    const check = sub.checked ? "x" : " ";
    const title = sanitizeTaskDisplayText(sub.title);
    const stepOnly = { step: sub.mtd.step };
    const mtd = serializeMtdComment(stepOnly);
    const subLine = `${indent}- [${check}] ${title}${mtd ? ` ${mtd}` : ""}`;
    newBlock.push(withCalloutPrefix(task.quoteDepth ?? 0, subLine));
  }
  if (noteBody.trim()) {
    newBlock.push(...formatFencedNoteBlock(noteBody, task.quoteDepth ?? 0));
  }

  return [...before, ...newBlock, ...lines.slice(afterIndex)];
}

export function removeTaskBlockFromLines(lines: string[], task: ParsedSyncTask): string[] {
  const endIndex = computeTaskBlockEnd(lines, task.line, task.taskIndent);
  return [...lines.slice(0, task.line), ...lines.slice(endIndex)];
}
