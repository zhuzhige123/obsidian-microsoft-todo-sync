import type { MarkdownPostProcessorContext, Plugin } from "obsidian";
import { getStrings } from "../i18n";
import { findMtdCommentMatchesInLine, parseMtdComment } from "../parse/mtd-comment";
import { parseInlineTaskDateTime } from "../parse/task-datetime";
import type MicrosoftTodoSyncPlugin from "../main";
import { createMtdSyncChipElement } from "./mtd-comment-chip";
import { domInstanceOf } from "../utils/dom-instance-of";

export function registerTaskPostProcessor(plugin: Plugin): void {
  const mtdPlugin = plugin as MicrosoftTodoSyncPlugin;
  plugin.registerMarkdownPostProcessor((element, context) => {
    const strings = getStrings(mtdPlugin.settings.uiLanguage);
    processElement(element, context, strings.chips, strings.badges.myDay);
  });
}

function processElement(
  element: HTMLElement,
  context: MarkdownPostProcessorContext,
  chips: ReturnType<typeof getStrings>["chips"],
  myDayLabel: string
): void {
  const items = element.querySelectorAll(".task-list-item, li");
  for (const item of items) {
    if (!domInstanceOf(item, HTMLElement)) {
      continue;
    }
    addSyncChip(item, chips);
    stripMtdCommentsInTree(item);
    addBadges(item, myDayLabel);
  }

  void context;
}

function addSyncChip(item: HTMLElement, chips: ReturnType<typeof getStrings>["chips"]): void {
  const text = item.textContent ?? "";
  const mtd = parseMtdComment(text);
  if (!mtd.id && !mtd.step) {
    return;
  }
  if (item.querySelector(".mtd-sync-chip")) {
    return;
  }
  item.appendChild(createMtdSyncChipElement(mtd, chips));
}

function stripMtdCommentsInTree(root: HTMLElement): void {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const toClean: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (node instanceof Text && findMtdCommentMatchesInLine(node.textContent ?? "").length > 0) {
      toClean.push(node);
    }
    node = walker.nextNode();
  }
  for (const textNode of toClean) {
    const cleaned = (textNode.textContent ?? "")
      .replace(/<!--\s*mtd:[^>]*?-->/g, "")
      .replace(/\s{2,}/g, " ")
      .trimEnd();
    if (cleaned) {
      textNode.textContent = cleaned;
    } else {
      textNode.remove();
    }
  }
}

function addBadges(item: HTMLElement, myDayLabel: string): void {
  const text = item.textContent ?? "";
  const inline = parseInlineTaskDateTime(text);
  const mtd = parseMtdComment(text);
  const time =
    inline.dueTime ??
    inline.reminderTime ??
    (mtd.reminder?.includes("T") ? mtd.reminder.split("T")[1]?.slice(0, 5) : "");
  if (time && !item.querySelector(".mtd-badge-reminder") && !text.includes("⏰")) {
    const badge = item.createSpan({ cls: "mtd-badge mtd-badge-reminder", text: `⏰${time}` });
    item.appendChild(badge);
  }
  if (mtd.myday && !item.querySelector(".mtd-badge-today")) {
    const badge = item.createSpan({ cls: "mtd-badge mtd-badge-today", text: myDayLabel });
    item.appendChild(badge);
  }
}
