import { editorLivePreviewField, Platform, type Plugin } from "obsidian";
import { getStrings } from "../i18n";
import { findMtdCommentMatchesInLine, parseMtdComment } from "../parse/mtd-comment";
import type MicrosoftTodoSyncPlugin from "../main";
import { loadCmStateModule, loadCmViewModule } from "./codemirror-loader";
import { createMtdSyncChipElement } from "./mtd-comment-chip";
import { selectionTouchesRange } from "./mtd-comment-cursor";

/**
 * Build CM6 extensions at runtime so `require("@codemirror/*")` resolves through
 * Obsidian's patched module loader (avoids duplicate @codemirror/state instances).
 */
export function registerMtdCommentEditorExtension(plugin: Plugin): void {
  if (!Platform.isDesktopApp) {
    return;
  }

  const mtdPlugin = plugin as MicrosoftTodoSyncPlugin;
  const { Decoration, EditorView, ViewPlugin, WidgetType } = loadCmViewModule();
  const { RangeSetBuilder } = loadCmStateModule();

  class MtdCommentWidget extends WidgetType {
    constructor(readonly raw: string) {
      super();
    }

    eq(other: MtdCommentWidget): boolean {
      return other.raw === this.raw;
    }

    toDOM(): HTMLElement {
      const chips = getStrings(mtdPlugin.settings.uiLanguage).chips;
      return createMtdSyncChipElement(parseMtdComment(this.raw), chips);
    }

    ignoreEvent(): boolean {
      return true;
    }
  }

  function buildMtdCommentDecorations(view: InstanceType<typeof EditorView>) {
    if (!view.state.field(editorLivePreviewField, false)) {
      return Decoration.none;
    }

    type DecorationInstance = ReturnType<typeof Decoration.replace>;
    const builder = new RangeSetBuilder<DecorationInstance>();
    const { from, to } = view.viewport;
    let lineNo = view.state.doc.lineAt(from).number;
    const endLineNo = view.state.doc.lineAt(to).number;

    while (lineNo <= endLineNo) {
      const line = view.state.doc.line(lineNo);
      for (const match of findMtdCommentMatchesInLine(line.text)) {
        const start = line.from + match.index;
        const end = start + match.raw.length;
        if (selectionTouchesRange(view.state.selection.ranges, start, end)) {
          continue;
        }
        builder.add(
          start,
          end,
          Decoration.replace({
            widget: new MtdCommentWidget(match.raw),
            inclusive: false,
          })
        );
      }
      lineNo += 1;
    }

    return builder.finish();
  }

  class MtdCommentHidePlugin {
    decorations: ReturnType<typeof buildMtdCommentDecorations>;

    constructor(view: InstanceType<typeof EditorView>) {
      this.decorations = buildMtdCommentDecorations(view);
    }

    update(update: { docChanged: boolean; viewportChanged: boolean; selectionSet: boolean; view: InstanceType<typeof EditorView> }): void {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildMtdCommentDecorations(update.view);
      }
    }
  }

  const mtdCommentHidePlugin = ViewPlugin.fromClass(MtdCommentHidePlugin, {
    decorations: (value) => value.decorations,
    provide: (viewPlugin) =>
      EditorView.atomicRanges.of((view) => {
        return view.plugin(viewPlugin)?.decorations ?? Decoration.none;
      }),
  });

  plugin.registerEditorExtension(mtdCommentHidePlugin);
}
