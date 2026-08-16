import type { EditorView } from "@codemirror/view";
import type { Editor, Plugin } from "obsidian";
import { loadCmStateModule, loadCmViewModule } from "../editor/codemirror-loader";

export const TASK_LOCATE_LINE_HIGHLIGHT_CLASS = "mtd-task-locate-line-highlight";

const highlightedByView = new WeakMap<object, number>();

export function registerTaskLocateEditorExtension(plugin: Plugin): void {
  const { RangeSetBuilder } = loadCmStateModule();
  const { Decoration, ViewPlugin } = loadCmViewModule();

  type LineDecoration = ReturnType<typeof Decoration.line>;

  function buildLocateDecorations(view: EditorView) {
    const highlightedLine = highlightedByView.get(view);
    if (highlightedLine === undefined) {
      return Decoration.none;
    }
    try {
      const lineInfo = view.state.doc.line(highlightedLine + 1);
      const builder = new RangeSetBuilder<LineDecoration>();
      builder.add(
        lineInfo.from,
        lineInfo.from,
        Decoration.line({ class: TASK_LOCATE_LINE_HIGHLIGHT_CLASS })
      );
      return builder.finish();
    } catch {
      return Decoration.none;
    }
  }

  class LocateHighlightPlugin {
    decorations: ReturnType<typeof buildLocateDecorations>;

    constructor(view: EditorView) {
      this.decorations = buildLocateDecorations(view);
    }

    update(update: {
      docChanged: boolean;
      viewportChanged: boolean;
      view: EditorView;
    }): void {
      this.decorations = buildLocateDecorations(update.view);
    }
  }

  const locateHighlightPlugin = ViewPlugin.fromClass(LocateHighlightPlugin, {
    decorations: (value) => value.decorations,
  });

  plugin.registerEditorExtension(locateHighlightPlugin);
}

export function requestEditorLocateLineHighlight(editor: Editor, line: number, durationMs: number): boolean {
  const view = editor.cm;
  if (!view?.dispatch) {
    return false;
  }

  highlightedByView.set(view, line);
  try {
    view.dispatch({});
  } catch {
    highlightedByView.delete(view);
    return false;
  }

  globalThis.setTimeout(() => {
    if (highlightedByView.get(view) === line) {
      highlightedByView.delete(view);
    }
    try {
      view.dispatch?.({});
    } catch {
      /* view may be closed */
    }
  }, durationMs);
  return true;
}
