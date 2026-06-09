import { MarkdownView, Notice, TFile, normalizePath, type App } from "obsidian";
import { findTaskLineByMtdId } from "../parse/file-task-scanner";
import { parseMtdComment } from "../parse/mtd-comment";
import { formatString, type MtdStrings } from "../i18n";
import { findTaskElementInPreview, TaskLocateOverlay } from "./task-locate-overlay";
import { openFileWithLeaf } from "../utils/workspace-navigation";

export class TaskLocateNavigation {
  private readonly overlay = new TaskLocateOverlay();

  constructor(
    private readonly app: App,
    private readonly getStrings: () => MtdStrings
  ) {}

  async navigateToTask(options: {
    vaultName: string;
    filePath: string;
    mtdId: string;
    lineHint?: number;
  }): Promise<boolean> {
    const strings = this.getStrings();
    const currentVault = this.app.vault.getName();
    if (currentVault !== options.vaultName) {
      new Notice(formatString(strings.notices.switchVault, { vault: options.vaultName }));
      return false;
    }

    const normalized = normalizePath(options.filePath.endsWith(".md") ? options.filePath : `${options.filePath}.md`);
    const file = this.app.vault.getAbstractFileByPath(normalized);
    if (!(file instanceof TFile)) {
      new Notice(strings.notices.taskNoteNotFound);
      return false;
    }

    const leaf = await openFileWithLeaf(this.app, normalized);
    if (!leaf) {
      return false;
    }

    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    let line = options.lineHint !== undefined ? options.lineHint - 1 : -1;
    if (line < 0 || !parseMtdComment(lines[line] ?? "").id) {
      line = findTaskLineByMtdId(lines, options.mtdId);
    }
    if (line < 0) {
      new Notice(strings.notices.taskLineNotFound);
      return false;
    }

    const view = leaf.view;
    if (view instanceof MarkdownView) {
      return this.locateInMarkdownView(view, line, options.mtdId, strings.notices.locatedTask);
    }
    return false;
  }

  private locateInMarkdownView(
    view: MarkdownView,
    line: number,
    mtdId: string,
    overlayLabel: string
  ): boolean {
    const editor = view.editor;
    if (editor) {
      const lineText = editor.getLine(line) ?? "";
      editor.setCursor({ line, ch: 0 });
      editor.scrollIntoView({ from: { line: Math.max(0, line - 2), ch: 0 }, to: { line: line + 2, ch: 0 } }, true);
      const container = view.containerEl;
      const el = findTaskElementInPreview(container, mtdId) ?? findTaskElementInPreview(container, lineText);
      if (el) {
        el.scrollIntoView({ block: "center" });
        this.overlay.showAtElement(el, overlayLabel);
        return true;
      }
    }
    return true;
  }
}
