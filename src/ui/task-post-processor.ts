import type { MarkdownPostProcessorContext, Plugin } from "obsidian";
import { TFile } from "obsidian";
import { getStrings } from "../i18n";
import { findMtdCommentMatchesInLine, parseMtdComment } from "../parse/mtd-comment";
import { indexMtdIdsByLine } from "../parse/mtd-index";
import type MicrosoftTodoSyncPlugin from "../main";
import { createMtdSyncChipElement } from "./mtd-comment-chip";
import { buildMtdChipActivateHandler } from "./mtd-chip-host";
import { appendTaskBadges, computeTaskBadgeHints } from "./task-badges";
import { domInstanceOf } from "../utils/dom-instance-of";

export function registerTaskPostProcessor(plugin: Plugin): void {
  const mtdPlugin = plugin as MicrosoftTodoSyncPlugin;
  plugin.registerMarkdownPostProcessor((element, context) => {
    const strings = getStrings(mtdPlugin.settings.uiLanguage);
    void processElement(element, context, mtdPlugin, strings.chips, strings.badges.myDay).catch(
      (error) => {
        globalThis.console.error("Microsoft To Do sync: reading view chip failed", error);
      }
    );
  });
}

async function processElement(
  element: HTMLElement,
  context: MarkdownPostProcessorContext,
  plugin: MicrosoftTodoSyncPlugin,
  chips: ReturnType<typeof getStrings>["chips"],
  myDayLabel: string
): Promise<void> {
  const lineByMtdId = await loadMtdLineMap(plugin, context.sourcePath);
  const items = element.querySelectorAll(".task-list-item, li");
  for (const item of items) {
    if (!domInstanceOf(item, HTMLElement)) {
      continue;
    }
    addSyncChip(item, chips, plugin, context.sourcePath, lineByMtdId);
    stripMtdCommentsInTree(item);
    addBadges(item, myDayLabel);
  }
}

async function loadMtdLineMap(
  plugin: MicrosoftTodoSyncPlugin,
  sourcePath: string
): Promise<Map<string, number>> {
  if (!sourcePath) {
    return new Map();
  }
  const file = plugin.app.vault.getAbstractFileByPath(sourcePath);
  if (!(file instanceof TFile)) {
    return new Map();
  }
  try {
    const content = await plugin.app.vault.cachedRead(file);
    return indexMtdIdsByLine(content.split("\n"));
  } catch (error) {
    globalThis.console.warn("Microsoft To Do sync: could not cache task lines", error);
    return new Map();
  }
}

function addSyncChip(
  item: HTMLElement,
  chips: ReturnType<typeof getStrings>["chips"],
  plugin: MicrosoftTodoSyncPlugin,
  sourcePath: string,
  lineByMtdId: Map<string, number>
): void {
  const text = item.textContent ?? "";
  const mtd = parseMtdComment(text);
  if (!mtd.id && !mtd.step) {
    return;
  }
  if (item.querySelector(".mtd-sync-chip")) {
    return;
  }
  const line = mtd.id ? lineByMtdId.get(mtd.id) : undefined;
  const onActivate =
    mtd.id && sourcePath && line !== undefined
      ? buildMtdChipActivateHandler(plugin, sourcePath, line, mtd.id)
      : undefined;
  item.appendChild(createMtdSyncChipElement(mtd, chips, { onActivate }));
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
  const hints = computeTaskBadgeHints(item.textContent ?? "", myDayLabel);
  appendTaskBadges(item, hints);
}
