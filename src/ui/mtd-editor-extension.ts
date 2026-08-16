import { editorLivePreviewField, MarkdownView, Platform, type Plugin } from "obsidian";
import { getStrings } from "../i18n";
import { findMtdCommentMatchesInLine, parseMtdComment } from "../parse/mtd-comment";
import type MicrosoftTodoSyncPlugin from "../main";
import { loadCmStateModule, loadCmViewModule } from "../editor/codemirror-loader";
import { createMtdSyncChipElement } from "./mtd-comment-chip";
import { selectionTouchesRange } from "./mtd-comment-cursor";
import { buildMtdChipActivateHandler } from "./mtd-chip-host";
import {
  computeTaskBadgeHints,
  createTaskBadgesElement,
  type TaskBadgeHints,
} from "./task-badges";

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
  const myDayBadgeLabel = () => getStrings(mtdPlugin.settings.uiLanguage).badges.myDay;

  function resolveEditorFilePath(view: InstanceType<typeof EditorView>): string | undefined {
    for (const leaf of mtdPlugin.app.workspace.getLeavesOfType("markdown")) {
      const markdown = leaf.view;
      if (markdown instanceof MarkdownView && markdown.editor?.cm === view) {
        return markdown.file?.path;
      }
    }
    return undefined;
  }

  class TaskBadgesWidget extends WidgetType {
    constructor(readonly hints: TaskBadgeHints) {
      super();
    }

    eq(other: TaskBadgesWidget): boolean {
      return (
        other.hints.reminderLabel === this.hints.reminderLabel &&
        other.hints.myDayLabel === this.hints.myDayLabel
      );
    }

    toDOM(): HTMLElement {
      const element = createTaskBadgesElement(window.document, this.hints);
      return element ?? window.createSpan();
    }

    ignoreEvent(): boolean {
      return true;
    }
  }

  class MtdCommentWidget extends WidgetType {
    constructor(
      readonly raw: string,
      readonly line: number,
      readonly filePath?: string
    ) {
      super();
    }

    eq(other: MtdCommentWidget): boolean {
      return (
        other.raw === this.raw &&
        other.line === this.line &&
        other.filePath === this.filePath
      );
    }

    toDOM(): HTMLElement {
      const mtd = parseMtdComment(this.raw);
      const chips = getStrings(mtdPlugin.settings.uiLanguage).chips;
      const onActivate =
        mtd.id && this.filePath
          ? buildMtdChipActivateHandler(mtdPlugin, this.filePath, this.line, mtd.id)
          : undefined;
      return createMtdSyncChipElement(mtd, chips, { onActivate });
    }

    ignoreEvent(event: Event): boolean {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(".mtd-sync-chip--interactive")
      ) {
        return false;
      }
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

    const filePath = resolveEditorFilePath(view);

    while (lineNo <= endLineNo) {
      const line = view.state.doc.line(lineNo);
      const matches = findMtdCommentMatchesInLine(line.text);
      const badgeHints = computeTaskBadgeHints(line.text, myDayBadgeLabel());
      if (badgeHints.reminderLabel || badgeHints.myDayLabel) {
        const badgeAt = matches[0] ? line.from + matches[0].index : line.to;
        builder.add(
          badgeAt,
          badgeAt,
          Decoration.widget({
            widget: new TaskBadgesWidget(badgeHints),
            side: -1,
          })
        );
      }
      for (const match of matches) {
        const start = line.from + match.index;
        const end = start + match.raw.length;
        if (selectionTouchesRange(view.state.selection.ranges, start, end)) {
          continue;
        }
        builder.add(
          start,
          end,
          Decoration.replace({
            widget: new MtdCommentWidget(match.raw, lineNo - 1, filePath),
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
