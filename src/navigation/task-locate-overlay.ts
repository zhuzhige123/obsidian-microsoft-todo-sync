import { setIcon } from "obsidian";
import { domInstanceOf } from "../utils/dom-instance-of";

const OVERLAY_CLASS = "mtd-task-locate-overlay";

export class TaskLocateOverlay {
  private overlayEl: HTMLElement | null = null;
  private timer: number | null = null;

  showAtElement(element: HTMLElement, label = "Located task"): boolean {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return false;
    }
    this.clear();

    const doc = element.ownerDocument;
    const overlay = doc.body.createDiv({ cls: OVERLAY_CLASS });
    const iconWrap = overlay.createDiv({ cls: `${OVERLAY_CLASS}__icon` });
    setIcon(iconWrap, "map-pin");
    overlay.createSpan({ cls: `${OVERLAY_CLASS}__label`, text: label });

    const top = Math.max(8, rect.top + 4);
    const left = Math.max(8, rect.left);
    overlay.style.setProperty("--mtd-overlay-top", `${top}px`);
    overlay.style.setProperty("--mtd-overlay-left", `${left}px`);

    this.overlayEl = overlay;
    this.timer = globalThis.setTimeout(() => this.clear(), 2600) as unknown as number;
    return true;
  }

  clear(): void {
    if (this.timer !== null) {
      globalThis.clearTimeout(this.timer);
      this.timer = null;
    }
    this.overlayEl?.remove();
    this.overlayEl = null;
  }
}

export function findTaskElementInPreview(container: HTMLElement, mtdId: string): HTMLElement | null {
  const candidates = container.querySelectorAll(".task-list-item, li");
  for (const node of candidates) {
    if (!domInstanceOf(node, HTMLElement)) {
      continue;
    }
    if ((node.textContent ?? "").includes(`mtd:id=${mtdId}`) || (node.textContent ?? "").includes(mtdId)) {
      return node;
    }
  }
  return null;
}
