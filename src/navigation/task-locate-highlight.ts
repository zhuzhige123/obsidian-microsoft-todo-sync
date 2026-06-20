import type { Editor, MarkdownView } from "obsidian";
import { TASK_LOCATE_HIGHLIGHT_DURATION_MS } from "../editor/constants";
import { domInstanceOf } from "../utils/dom-instance-of";
import { requestEditorLocateLineHighlight } from "./task-locate-editor-extension";
import type { TaskLocatePreviewQuery } from "./task-locate-overlay";
import { findTaskElementInPreview } from "./task-locate-overlay";

const ROW_BAND_CLASS = "mtd-task-locate-band";
const PREVIEW_HIGHLIGHT_CLASS = "mtd-task-locate-preview-highlight";
const DEFAULT_DURATION_MS = TASK_LOCATE_HIGHLIGHT_DURATION_MS;

export function highlightEditorLineWithCm(
  editor: Editor,
  line: number,
  durationMs = DEFAULT_DURATION_MS
): boolean {
  const view = editor.cm;
  if (!view?.state?.doc?.line) {
    return false;
  }

  try {
    view.state.doc.line(line + 1);
  } catch {
    return false;
  }

  return requestEditorLocateLineHighlight(editor, line, durationMs);
}

export function highlightPreviewTaskElement(
  element: HTMLElement,
  durationMs = DEFAULT_DURATION_MS
): void {
  element.classList.add(PREVIEW_HIGHLIGHT_CLASS);
  globalThis.setTimeout(() => {
    element.classList.remove(PREVIEW_HIGHLIGHT_CLASS);
  }, durationMs);
}

export function showRowHighlightBand(
  rect: DOMRect | DOMRectReadOnly | null | undefined,
  durationMs = DEFAULT_DURATION_MS
): boolean {
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return false;
  }

  const band = globalThis.document.body.createDiv({ cls: ROW_BAND_CLASS });
  band.setCssProps({
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, 24)}px`,
    height: `${Math.max(rect.height, 20)}px`,
  });

  globalThis.setTimeout(() => {
    band.remove();
  }, durationMs);
  return true;
}

export function resolveTaskLineRect(
  view: MarkdownView,
  line: number,
  query: TaskLocatePreviewQuery
): DOMRect | null {
  const container = view.containerEl;
  const element = findTaskElementInPreview(container, { ...query, line });
  if (element) {
    return normalizeDisplayRect(element.getBoundingClientRect());
  }

  const cmLine = findCmLineElement(view.editor, line);
  if (cmLine) {
    return normalizeDisplayRect(cmLine.getBoundingClientRect());
  }

  const editorRect = resolveLineRectFromEditorCm(view.editor, line);
  if (editorRect) {
    return editorRect;
  }

  return null;
}

function findCmLineElement(editor: Editor | undefined, line: number): HTMLElement | null {
  const view = editor?.cm;
  if (!view?.state?.doc?.line || !view.domAtPos) {
    return null;
  }

  try {
    const lineInfo = view.state.doc.line(line + 1);
    const dom = view.domAtPos(lineInfo.from);
    const node = dom.node;
    const element =
      node instanceof Text ? node.parentElement : domInstanceOf(node, HTMLElement) ? node : null;
    const cmLine = element?.closest(".cm-line");
    return domInstanceOf(cmLine, HTMLElement) ? cmLine : null;
  } catch {
    return null;
  }
}

function resolveLineRectFromEditorCm(editor: Editor | undefined, line: number): DOMRect | null {
  const cm = editor?.cm;
  if (!cm?.coordsAtPos || !cm.state?.doc?.line) {
    return null;
  }

  try {
    const lineInfo = cm.state.doc.line(line + 1);
    const start = cm.coordsAtPos(lineInfo.from);
    const end = cm.coordsAtPos(lineInfo.to);
    if (!start || !end) {
      return null;
    }
    return normalizeDisplayRect(
      new DOMRect(start.left, start.top, Math.max(end.right - start.left, 8), Math.max(end.bottom - start.top, 18))
    );
  } catch {
    return null;
  }
}

function normalizeDisplayRect(rect: DOMRect | DOMRectReadOnly | null): DOMRect | null {
  if (!rect || (!Number.isFinite(rect.width) && !Number.isFinite(rect.height))) {
    return null;
  }
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }
  return new DOMRect(rect.left, rect.top, Math.max(rect.width, 8), Math.max(rect.height, 18));
}
