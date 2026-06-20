import { setIcon, type IconName } from "obsidian";
import { formatString, type MtdStrings } from "../i18n";
import type { MtdComment } from "../parse/mtd-comment";

export function mtdChipTooltip(mtd: MtdComment, chips: MtdStrings["chips"]): string {
  if (mtd.id) {
    return formatString(chips.task, { id: mtd.id });
  }
  if (mtd.step) {
    return formatString(chips.step, { id: mtd.step });
  }
  return chips.sync;
}

export function mtdChipIcon(mtd: MtdComment): IconName {
  if (mtd.step && !mtd.id) {
    return "list";
  }
  return "cloud";
}

export function createMtdSyncChipElement(
  mtd: MtdComment,
  chips: MtdStrings["chips"],
  options?: { onActivate?: (event: MouseEvent) => void }
): HTMLElement {
  const span = globalThis.document.createElement("span");
  span.className = "mtd-sync-chip";
  if (mtd.step && !mtd.id) {
    span.classList.add("mtd-sync-chip--step");
  }
  if (mtd.myday) {
    span.classList.add("mtd-sync-chip--myday");
  }
  const tooltip = mtdChipTooltip(mtd, chips);
  setIcon(span, mtdChipIcon(mtd));
  span.title = tooltip;
  span.setAttribute("aria-label", tooltip);
  if (mtd.id) {
    span.setAttribute("data-mtd-id", mtd.id);
  }
  if (mtd.step) {
    span.setAttribute("data-mtd-step", mtd.step);
  }
  if (mtd.id && options?.onActivate) {
    span.classList.add("clickable-icon", "mtd-sync-chip--interactive");
    span.addEventListener("click", options.onActivate);
    span.addEventListener("contextmenu", options.onActivate);
  }
  return span;
}
