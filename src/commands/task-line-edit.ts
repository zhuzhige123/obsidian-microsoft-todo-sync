import { parseTaskLine, buildTaskLine } from "../parse/task-line-parser";
import { parseMtdComment, serializeMtdComment } from "../parse/mtd-comment";
import { formatTaskLineBody, taskLineBodyFromParsedTask } from "../sync/task-line-body";
import { todayIso } from "../sync/field-mapper";
import type { ParsedSyncTask } from "../types/sync";

export function applyTodayToTaskLine(task: ParsedSyncTask, syncTag: string): string {
  const parsed = parseTaskLine(task.rawLine);
  if (!parsed) {
    return task.rawLine;
  }

  const today = todayIso();
  const fields = taskLineBodyFromParsedTask(task, syncTag);
  fields.dueDate = today;

  const mtd = parseMtdComment(task.rawLine);
  const mtdComment = serializeMtdComment({ ...mtd, myday: true });
  const indent = " ".repeat(parsed.indent);

  return buildTaskLine({
    indent,
    checkbox: parsed.checkbox,
    body: formatTaskLineBody(fields),
    mtdComment,
  });
}

export function parseReminderInput(raw: string, defaultDate?: string): {
  reminderIso: string;
  reminderDate: string;
  reminderTime?: string;
} | null {
  const input = raw.trim();
  if (!input) {
    return null;
  }

  const full = input.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?$/);
  if (full) {
    const reminderDate = full[1];
    const reminderTime = full[2] ? normalizeReminderTime(full[2]) : undefined;
    const reminderIso = reminderTime ? `${reminderDate}T${reminderTime}` : `${reminderDate}T09:00`;
    return { reminderIso, reminderDate, reminderTime };
  }

  const timeOnly = input.match(/^(\d{1,2}:\d{2})$/);
  if (timeOnly) {
    const reminderDate = defaultDate ?? todayIso();
    const reminderTime = normalizeReminderTime(timeOnly[1]);
    return {
      reminderIso: `${reminderDate}T${reminderTime}`,
      reminderDate,
      reminderTime,
    };
  }

  return null;
}

function normalizeReminderTime(value: string): string {
  const [hours, minutes] = value.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

export function applyReminderToTaskLine(
  task: ParsedSyncTask,
  syncTag: string,
  reminder: { reminderIso: string; reminderDate: string; reminderTime?: string }
): string {
  const parsed = parseTaskLine(task.rawLine);
  if (!parsed) {
    return task.rawLine;
  }

  const fields = taskLineBodyFromParsedTask(task, syncTag);
  fields.reminderDate = reminder.reminderDate;
  fields.reminderTime = reminder.reminderTime;

  const mtd = parseMtdComment(task.rawLine);
  const mtdComment = serializeMtdComment({ ...mtd, reminder: reminder.reminderIso });
  const indent = " ".repeat(parsed.indent);

  return buildTaskLine({
    indent,
    checkbox: parsed.checkbox,
    body: formatTaskLineBody(fields),
    mtdComment,
  });
}
