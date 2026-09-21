import { inlineFromGraphReminder, reminderIsoFromInline } from "../parse/task-datetime";
import { sanitizeTaskDisplayText } from "../parse/task-text";
import {
  fromGraphDateTimeTimeZone,
  getGraphTimeZone,
  normalizeGraphLocalDateTime,
} from "../utils/timezone";
import type { ParsedSyncTask } from "../types/sync";
import type { GraphTodoTask } from "../types/graph";

export function taskStatusFromCheckbox(checkbox: string): string {
  if (checkbox === "x" || checkbox === "X") return "completed";
  if (checkbox === "/") return "inProgress";
  return "notStarted";
}

export function checkboxFromGraphStatus(status?: string): string {
  if (status === "completed") return "x";
  if (status === "inProgress") return "/";
  return " ";
}

export function graphImportance(priority: ParsedSyncTask["priority"]): string {
  if (priority === "high") return "high";
  if (priority === "low") return "low";
  return "normal";
}

export function toGraphDateTimeValue(
  iso?: string
): { dateTime: string; timeZone: string } | undefined {
  if (!iso) {
    return undefined;
  }
  return {
    dateTime: normalizeGraphLocalDateTime(iso),
    timeZone: getGraphTimeZone(),
  };
}

export function toGraphDueDate(date?: string): { dateTime: string; timeZone: string } | undefined {
  if (!date) return undefined;
  return toGraphDateTimeValue(`${date}T00:00`);
}

export function toGraphReminder(reminder?: string): {
  isReminderOn: boolean;
  reminderDateTime?: { dateTime: string; timeZone: string };
} {
  if (!reminder) {
    return { isReminderOn: false };
  }
  const reminderDateTime = toGraphDateTimeValue(reminder);
  return {
    isReminderOn: true,
    reminderDateTime,
  };
}

function compactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const compact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    // Keep explicit nulls — Graph uses null to clear dueDateTime / startDateTime.
    if (value !== undefined) {
      compact[key] = value;
    }
  }
  return compact;
}

export function buildGraphTaskPayload(
  task: ParsedSyncTask,
  bodyContent: string,
  options: { scheduledMapsToStart: boolean; allowEmptyBody?: boolean }
): Record<string, unknown> {
  const reminderIso = reminderIsoFromInline(
    {
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      reminderDate: task.reminderDate,
      reminderTime: task.reminderTime,
    },
    task.mtd.reminder
  );
  const reminder = toGraphReminder(reminderIso);
  const due = task.mtd.myday ? todayIso() : task.dueDate;
  const payload: Record<string, unknown> = {
    title: task.title || "Untitled task",
    status: taskStatusFromCheckbox(task.checkbox),
    importance: graphImportance(task.priority),
    isReminderOn: reminder.isReminderOn,
  };

  if (bodyContent.trim()) {
    payload.body = {
      contentType: "text",
      content: bodyContent,
    };
  } else if (options.allowEmptyBody) {
    payload.body = {
      contentType: "text",
      content: "",
    };
  }

  const dueDateTime = toGraphDueDate(due);
  if (dueDateTime) {
    payload.dueDateTime = dueDateTime;
  } else if (!task.mtd.myday) {
    payload.dueDateTime = null;
  }

  if (reminder.isReminderOn && reminder.reminderDateTime) {
    payload.reminderDateTime = reminder.reminderDateTime;
  } else {
    payload.isReminderOn = false;
  }

  const scheduled = options.scheduledMapsToStart ? task.scheduledDate : undefined;
  const startDateTime = toGraphDueDate(scheduled);
  if (startDateTime) {
    payload.startDateTime = startDateTime;
  } else if (options.scheduledMapsToStart) {
    payload.startDateTime = null;
  }

  return compactPayload(payload);
}

function priorityFromGraphImportance(
  importance?: string
): ParsedSyncTask["priority"] {
  if (importance === "high") {
    return "high";
  }
  if (importance === "low") {
    return "low";
  }
  return null;
}

export function graphTaskToObsidianPatch(
  graphTask: GraphTodoTask,
  options: { scheduledMapsToStart: boolean }
): {
  checkbox: string;
  title: string;
  dueDate?: string;
  dueTime?: string;
  reminderDate?: string;
  reminderTime?: string;
  scheduledDate?: string;
  startDate?: string;
  priority: ParsedSyncTask["priority"];
  doneDate?: string;
} {
  const checkbox = checkboxFromGraphStatus(graphTask.status);
  const dueLocal = fromGraphDateTimeTimeZone(graphTask.dueDateTime);
  const dueDate = dueLocal?.slice(0, 10);
  const startLocal = fromGraphDateTimeTimeZone(graphTask.startDateTime);
  const startSlice = startLocal?.slice(0, 10);
  const scheduledDate = options.scheduledMapsToStart ? startSlice : undefined;
  const startDate = options.scheduledMapsToStart ? undefined : startSlice;
  const reminderSource =
    graphTask.isReminderOn
      ? fromGraphDateTimeTimeZone(graphTask.reminderDateTime)
      : undefined;
  const inline = inlineFromGraphReminder(dueDate, reminderSource);
  const doneLocal =
    graphTask.status === "completed"
      ? fromGraphDateTimeTimeZone(graphTask.completedDateTime)
      : undefined;
  const doneDate = doneLocal?.slice(0, 10);
  return {
    checkbox,
    title: sanitizeTaskDisplayText(graphTask.title?.trim() || "Untitled task"),
    dueDate: inline.dueDate,
    dueTime: inline.dueTime,
    reminderDate: inline.reminderDate,
    reminderTime: inline.reminderTime,
    scheduledDate,
    startDate,
    priority: priorityFromGraphImportance(graphTask.importance),
    doneDate,
  };
}

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
