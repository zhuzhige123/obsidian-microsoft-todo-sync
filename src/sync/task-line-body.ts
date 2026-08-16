import { formatDueSegment, formatReminderSegment } from "../parse/task-datetime";
import { sanitizeTaskDisplayText } from "../parse/task-text";
import type { ParsedSyncTask } from "../types/sync";

export interface TaskLineBodyFields {
  title: string;
  tags: string[];
  checkbox: string;
  dueDate?: string;
  dueTime?: string;
  reminderDate?: string;
  reminderTime?: string;
  scheduledDate?: string;
  startDate?: string;
  priority?: ParsedSyncTask["priority"];
  doneDate?: string;
}

/** Assemble the visible task title segment (tags + emoji fields), excluding checkbox and mtd comment. */
export function formatTaskLineBody(fields: TaskLineBodyFields): string {
  let body = sanitizeTaskDisplayText(fields.title);
  for (const tag of fields.tags) {
    if (tag && !body.includes(tag)) {
      body = `${body} ${tag}`.trim();
    }
  }

  const dueSegment = formatDueSegment(fields.dueDate, fields.dueTime);
  if (dueSegment) {
    body += ` ${dueSegment}`;
  }
  const reminderSegment = formatReminderSegment(
    fields.reminderDate,
    fields.reminderTime,
    fields.dueDate
  );
  if (reminderSegment) {
    body += ` ${reminderSegment}`;
  }
  if (fields.scheduledDate) {
    body += ` ⏳ ${fields.scheduledDate}`;
  }
  if (fields.startDate) {
    body += ` 🛫 ${fields.startDate}`;
  }
  if (fields.priority === "high") {
    body += " ⏫";
  } else if (fields.priority === "low") {
    body += " 🔽";
  }
  if (fields.checkbox === "x" || fields.checkbox === "X") {
    if (fields.doneDate) {
      body += ` ✅ ${fields.doneDate}`;
    }
  }

  return body.trim();
}

export function taskLineBodyFromParsedTask(task: ParsedSyncTask, syncTag: string): TaskLineBodyFields {
  const defaultTag = syncTag.startsWith("#") ? syncTag : `#${syncTag}`;
  const existingTags = task.rawLine.replace(/<!--\s*mtd:[^>]+-->/g, "").match(/#[\w/-]+/g) ?? [];
  const tags = existingTags.length > 0 ? existingTags : [defaultTag];
  return {
    title: task.title,
    tags,
    checkbox: task.checkbox,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    reminderDate: task.reminderDate,
    reminderTime: task.reminderTime,
    scheduledDate: task.scheduledDate,
    startDate: task.startDate,
    priority: task.priority,
    doneDate: task.doneDate,
  };
}
