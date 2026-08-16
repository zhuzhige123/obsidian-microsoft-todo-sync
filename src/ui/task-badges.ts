import { parseMtdComment } from "../parse/mtd-comment";
import { parseInlineTaskDateTime } from "../parse/task-datetime";

export interface TaskBadgeHints {
  reminderLabel?: string;
  myDayLabel?: string;
}

export function computeTaskBadgeHints(lineText: string, myDayBadgeText: string): TaskBadgeHints {
  const inline = parseInlineTaskDateTime(lineText);
  const mtd = parseMtdComment(lineText);
  const time =
    inline.dueTime ??
    inline.reminderTime ??
    (mtd.reminder?.includes("T") ? mtd.reminder.split("T")[1]?.slice(0, 5) : undefined);

  const hints: TaskBadgeHints = {};
  if (time && !lineText.includes("⏰")) {
    hints.reminderLabel = `⏰${time}`;
  }
  if (mtd.myday) {
    hints.myDayLabel = myDayBadgeText;
  }
  return hints;
}

export function appendTaskBadges(container: HTMLElement, hints: TaskBadgeHints): void {
  if (hints.reminderLabel && !container.querySelector(".mtd-badge-reminder")) {
    const badge = container.ownerDocument.createElement("span");
    badge.className = "mtd-badge mtd-badge-reminder";
    badge.textContent = hints.reminderLabel;
    container.appendChild(badge);
  }
  if (hints.myDayLabel && !container.querySelector(".mtd-badge-today")) {
    const badge = container.ownerDocument.createElement("span");
    badge.className = "mtd-badge mtd-badge-today";
    badge.textContent = hints.myDayLabel;
    container.appendChild(badge);
  }
}

export function createTaskBadgesElement(
  doc: Document,
  hints: TaskBadgeHints
): HTMLElement | null {
  if (!hints.reminderLabel && !hints.myDayLabel) {
    return null;
  }
  const wrap = doc.createElement("span");
  wrap.className = "mtd-task-badges";
  appendTaskBadges(wrap, hints);
  return wrap.childElementCount > 0 ? wrap : null;
}
