import { parseMtdComment, stripMtdComment } from "./mtd-comment";
import { stripHashTags } from "./sync-tag";
import { stripCalloutPrefix } from "./task-callout";
import { parseInlineTaskDateTime, stripInlineTaskDateTime } from "./task-datetime";
import { sanitizeTaskDisplayText } from "./task-text";

const TASK_LINE_RE = /^(\s*)([-*+])\s+\[([ xX/-])\]\s+(.*)$/;

const DATE_PATTERNS = {
  scheduled: /⏳\s*(\d{4}-\d{2}-\d{2})/,
  start: /🛫\s*(\d{4}-\d{2}-\d{2})/,
  done: /✅\s*(\d{4}-\d{2}-\d{2})/,
  cancelled: /❌\s*(\d{4}-\d{2}-\d{2})/,
};

export function parseTaskLine(line: string): {
  indent: number;
  quoteDepth: number;
  checkbox: " " | "x" | "X" | "/" | "-";
  body: string;
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
} | null {
  const { content, quoteDepth } = stripCalloutPrefix(line);
  const match = content.match(TASK_LINE_RE);
  if (!match) {
    return null;
  }
  const indent = match[1].length;
  const checkbox = match[3] as " " | "x" | "X" | "/" | "-";
  const body = match[4];
  const mtd = parseMtdComment(body);
  const stripped = stripMtdComment(body);

  const inlineDateTime = parseInlineTaskDateTime(stripped);
  const dueDate = inlineDateTime.dueDate;
  const dueTime = inlineDateTime.dueTime;
  const reminderDate = inlineDateTime.reminderDate;
  const reminderTime = inlineDateTime.reminderTime;
  const scheduledDate = stripped.match(DATE_PATTERNS.scheduled)?.[1];
  const startDate = stripped.match(DATE_PATTERNS.start)?.[1];
  const doneDate = stripped.match(DATE_PATTERNS.done)?.[1];
  const cancelledDate = stripped.match(DATE_PATTERNS.cancelled)?.[1];

  let priority: "high" | "normal" | "low" | null = null;
  if (/⏫|🔺/.test(stripped)) priority = "high";
  else if (/🔼/.test(stripped)) priority = "normal";
  else if (/🔽|🔻/.test(stripped)) priority = "low";

  let title = stripHashTags(
    stripInlineTaskDateTime(stripped)
      .replace(DATE_PATTERNS.scheduled, "")
      .replace(DATE_PATTERNS.start, "")
      .replace(DATE_PATTERNS.done, "")
      .replace(DATE_PATTERNS.cancelled, "")
      .replace(/⏫|🔺|🔼|🔽|🔻/g, "")
  )
    .replace(/\s{2,}/g, " ")
    .trim();
  title = sanitizeTaskDisplayText(title);

  void mtd;

  return {
    indent,
    quoteDepth,
    checkbox,
    body,
    title,
    dueDate,
    dueTime,
    reminderDate,
    reminderTime,
    scheduledDate,
    startDate,
    doneDate,
    cancelledDate,
    priority,
  };
}

export { hasSyncTag } from "./sync-tag";

export function buildTaskLine(options: {
  indent: string;
  checkbox: string;
  body: string;
  mtdComment?: string;
}): string {
  const suffix = options.mtdComment ? ` ${options.mtdComment}` : "";
  return `${options.indent}- [${options.checkbox}] ${options.body.trim()}${suffix}`;
}
