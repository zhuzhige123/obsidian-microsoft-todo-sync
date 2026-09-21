import { setIcon } from "obsidian";
import { TASK_LOCATE_HIGHLIGHT_DURATION_MS } from "../editor/constants";
import { domInstanceOf } from "../utils/dom-instance-of";

const OVERLAY_CLASS = "mtd-task-locate-overlay";
const DEFAULT_DURATION_MS = TASK_LOCATE_HIGHLIGHT_DURATION_MS;

export interface TaskLocatePreviewQuery {
  mtdId: string;
  line?: number;
  titleHint?: string;
}

export interface LocateHostWindow {
  document: Document;
  innerWidth: number;
  innerHeight: number;
  setTimeout: typeof window.setTimeout;
  clearTimeout: typeof window.clearTimeout;
}

function hostFromElement(element: Element): LocateHostWindow {
  const doc = element.ownerDocument;
  const win = doc.defaultView ?? window;
  return {
    document: doc,
    innerWidth: win.innerWidth,
    innerHeight: win.innerHeight,
    setTimeout: win.setTimeout.bind(win),
    clearTimeout: win.clearTimeout.bind(win),
  };
}

export class TaskLocateOverlay {
  private overlayEl: HTMLElement | null = null;
  private timer: number | null = null;
  private host: LocateHostWindow | null = null;

  showAtRect(
    rect: DOMRect | DOMRectReadOnly | null | undefined,
    label = "Located task",
    durationMs = DEFAULT_DURATION_MS,
    anchor?: Element
  ): boolean {
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      return false;
    }
    this.clear();

    const host = anchor
      ? hostFromElement(anchor)
      : {
          document: window.document,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          setTimeout: window.setTimeout.bind(window),
          clearTimeout: window.clearTimeout.bind(window),
        };
    this.host = host;

    const overlay = host.document.body.createDiv({ cls: OVERLAY_CLASS });
    overlay.classList.add(`${OVERLAY_CLASS}--measuring`);
    overlay.setCssProps({ top: "-9999px", left: "-9999px" });

    const iconWrap = overlay.createDiv({ cls: `${OVERLAY_CLASS}__icon` });
    setIcon(iconWrap, "map-pin");
    overlay.createSpan({ cls: `${OVERLAY_CLASS}__label`, text: label });

    const overlayWidth = Math.max(overlay.offsetWidth, 180);
    const overlayHeight = Math.max(overlay.offsetHeight, 36);
    const top = clamp(
      rect.top + Math.min(12, Math.max(4, rect.height * 0.15)),
      12,
      Math.max(12, host.innerHeight - overlayHeight - 12)
    );
    const left = clamp(
      rect.left + Math.min(16, Math.max(6, rect.width * 0.08)),
      12,
      Math.max(12, host.innerWidth - overlayWidth - 12)
    );

    overlay.classList.remove(`${OVERLAY_CLASS}--measuring`);
    overlay.setCssProps({
      "--mtd-overlay-top": `${top}px`,
      "--mtd-overlay-left": `${left}px`,
    });

    this.overlayEl = overlay;
    this.timer = host.setTimeout(() => this.clear(), durationMs);
    return true;
  }

  clear(): void {
    if (this.timer !== null) {
      (this.host ?? {
        clearTimeout: window.clearTimeout.bind(window),
      }).clearTimeout(this.timer);
      this.timer = null;
    }
    this.overlayEl?.remove();
    this.overlayEl = null;
    this.host = null;
  }
}

export function findTaskElementInPreview(
  container: HTMLElement,
  query: TaskLocatePreviewQuery
): HTMLElement | null {
  const byChip = findTaskByMtdChip(container, query.mtdId);
  if (byChip) {
    return byChip;
  }

  if (query.line !== undefined && query.line >= 0) {
    const byLine = findTaskByEditorLine(container, query.line);
    if (byLine) {
      return byLine;
    }
  }

  if (query.titleHint) {
    return findTaskByTitleHint(container, query.titleHint);
  }

  return null;
}

function findTaskByMtdChip(container: HTMLElement, mtdId: string): HTMLElement | null {
  const escaped = escapeCssAttributeValue(mtdId);
  const chip = container.querySelector(`[data-mtd-id="${escaped}"]`);
  if (!domInstanceOf(chip, HTMLElement)) {
    return null;
  }
  return chip.closest(".task-list-item, li") ?? chip;
}

function findTaskByEditorLine(container: HTMLElement, line: number): HTMLElement | null {
  const previewItems = container.querySelectorAll(
    ".markdown-reading-view .task-list-item, .markdown-preview-view .task-list-item"
  );
  for (const item of previewItems) {
    if (!domInstanceOf(item, HTMLElement)) {
      continue;
    }
    const lineAttr = item.getAttribute("data-line");
    if (lineAttr !== null && Number.parseInt(lineAttr, 10) === line) {
      return item;
    }
  }

  return null;
}

function findTaskByTitleHint(container: HTMLElement, titleHint: string): HTMLElement | null {
  const normalizedHint = normalizeLocateText(titleHint);
  if (!normalizedHint) {
    return null;
  }

  const candidates = container.querySelectorAll(
    ".markdown-reading-view .task-list-item, .markdown-preview-view .task-list-item, .task-list-item, li"
  );
  for (const node of candidates) {
    if (!domInstanceOf(node, HTMLElement)) {
      continue;
    }
    const text = normalizeLocateText(node.textContent ?? "");
    if (text.includes(normalizedHint)) {
      return node;
    }
  }

  return null;
}

function normalizeLocateText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function escapeCssAttributeValue(value: string): string {
  if (typeof window.CSS !== "undefined" && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
