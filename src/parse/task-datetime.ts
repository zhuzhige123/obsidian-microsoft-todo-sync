/** Inline task date/time parsing (Tasks 📅 + Reminder ⏰ conventions). */

export interface InlineTaskDateTime {
  dueDate?: string;
  dueTime?: string;
  reminderDate?: string;
  reminderTime?: string;
}

const DATE = String.raw`\d{4}-\d{2}-\d{2}`;
const TIME = String.raw`\d{1,2}:\d{2}`;

const DUE_RE = new RegExp(String.raw`📅\s*(${DATE})(?:[ T](${TIME}))?`);
const REMINDER_FULL_RE = new RegExp(String.raw`⏰\s*(${DATE})(?:\s+(${TIME}))?`);
const REMINDER_TIME_ONLY_RE = new RegExp(String.raw`⏰\s*(${TIME})(?!\d)`);

export function parseInlineTaskDateTime(line: string): InlineTaskDateTime {
  const result: InlineTaskDateTime = {};
  const due = line.match(DUE_RE);
  if (due) {
    result.dueDate = due[1];
    if (due[2]) {
      result.dueTime = normalizeTime(due[2]);
    }
  }

  const reminderFull = line.match(REMINDER_FULL_RE);
  if (reminderFull) {
    result.reminderDate = reminderFull[1];
    if (reminderFull[2]) {
      result.reminderTime = normalizeTime(reminderFull[2]);
    }
  } else {
    const reminderTime = line.match(REMINDER_TIME_ONLY_RE);
    if (reminderTime) {
      result.reminderTime = normalizeTime(reminderTime[1]);
    }
  }

  return result;
}

export function stripInlineTaskDateTime(line: string): string {
  return line
    .replace(DUE_RE, "")
    .replace(REMINDER_FULL_RE, "")
    .replace(REMINDER_TIME_ONLY_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function formatDueSegment(dueDate?: string, dueTime?: string): string {
  if (!dueDate) {
    return "";
  }
  return dueTime ? `📅 ${dueDate} ${dueTime}` : `📅 ${dueDate}`;
}

export function formatReminderSegment(
  reminderDate?: string,
  reminderTime?: string,
  dueDate?: string
): string {
  if (reminderDate && reminderTime) {
    return `⏰ ${reminderDate} ${reminderTime}`;
  }
  if (reminderTime) {
    return `⏰ ${reminderTime}`;
  }
  if (reminderDate) {
    return `⏰ ${reminderDate}`;
  }
  void dueDate;
  return "";
}

export function reminderIsoFromInline(
  fields: InlineTaskDateTime,
  legacyReminder?: string
): string | undefined {
  if (fields.reminderDate && fields.reminderTime) {
    return `${fields.reminderDate}T${fields.reminderTime}`;
  }
  if (fields.reminderTime && fields.dueDate) {
    return `${fields.dueDate}T${fields.reminderTime}`;
  }
  if (fields.dueDate && fields.dueTime) {
    return `${fields.dueDate}T${fields.dueTime}`;
  }
  if (legacyReminder) {
    return legacyReminder.length === 10 ? `${legacyReminder}T09:00` : legacyReminder;
  }
  return undefined;
}

export function inlineFromGraphReminder(
  dueDate?: string,
  reminderDateTime?: string
): InlineTaskDateTime {
  if (!reminderDateTime) {
    return { dueDate };
  }
  const match = reminderDateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!match) {
    return { dueDate };
  }
  const [, reminderDate, reminderTime] = match;
  if (dueDate && reminderDate === dueDate) {
    return { dueDate, dueTime: reminderTime };
  }
  return {
    dueDate,
    reminderDate,
    reminderTime,
  };
}

function normalizeTime(value: string): string {
  const [hour, minute] = value.split(":");
  return `${hour.padStart(2, "0")}:${minute}`;
}
