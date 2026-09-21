import { MarkdownView, Notice, TFile, normalizePath, type App } from "obsidian";
import { findTaskInVault, findTaskLineByMtdId } from "../parse/file-task-scanner";
import type { SyncIndex } from "../sync/sync-index";
import type { SyncIndexEntry } from "../types/sync";
import { parseMtdComment } from "../parse/mtd-comment";
import { parseTaskLine } from "../parse/task-line-parser";
import { formatString, type MtdStrings } from "../i18n";
import {
  decodeObsidianUriParam,
  getVaultUriIdentifier,
  vaultMatchesUriTarget,
} from "./obsidian-uri";
import {
  highlightEditorLineWithCm,
  highlightPreviewTaskElement,
  resolveTaskLineRect,
  showRowHighlightBand,
} from "./task-locate-highlight";
import { findTaskElementInPreview, TaskLocateOverlay } from "./task-locate-overlay";
import { openFileWithLeaf } from "../utils/workspace-navigation";

const LOCATE_RETRY_DELAY_MS = 180;
const LOCATE_MAX_ATTEMPTS = 8;
const LOCATE_INITIAL_DELAY_MS = 120;

export class TaskLocateNavigation {
  private readonly overlay = new TaskLocateOverlay();
  private readonly pendingTimers = new Set<number>();
  private disposed = false;
  private locateEpoch = 0;

  constructor(
    private readonly app: App,
    private readonly getStrings: () => MtdStrings,
    private readonly loadIndex?: () => Promise<SyncIndex>,
    private readonly repairIndexEntry?: (entry: SyncIndexEntry) => Promise<void>
  ) {}

  dispose(): void {
    this.disposed = true;
    this.locateEpoch += 1;
    for (const timerId of this.pendingTimers) {
      window.clearTimeout(timerId);
    }
    this.pendingTimers.clear();
    this.overlay.clear();
  }

  async resolveByMtdId(options: {
    mtdId: string;
    vaultParam?: string;
    filePath?: string;
    lineHint?: number;
  }): Promise<boolean> {
    const strings = this.getStrings();
    if (options.vaultParam && !vaultMatchesUriTarget(this.app, options.vaultParam)) {
      const vaultLabel = decodeObsidianUriParam(options.vaultParam);
      new Notice(formatString(strings.notices.switchVault, { vault: vaultLabel }));
      return false;
    }

    if (options.filePath) {
      return this.navigateToTask({
        vaultParam: options.vaultParam ?? getVaultUriIdentifier(this.app),
        filePath: options.filePath,
        mtdId: options.mtdId,
        lineHint: options.lineHint,
      });
    }

    const index = this.loadIndex ? await this.loadIndex() : undefined;
    const entry = index?.getByMtdId(options.mtdId);
    if (entry) {
      const lineHint =
        options.lineHint !== undefined ? options.lineHint - 1 : entry.lineHint;
      const opened = await this.openTaskAtPath(entry.vaultPath, options.mtdId, lineHint);
      if (opened) {
        return true;
      }
    }

    const scanned = await findTaskInVault(this.app, options.mtdId);
    if (!scanned) {
      new Notice(strings.notices.taskLineNotFound);
      return false;
    }

    if (entry && this.repairIndexEntry) {
      await this.repairIndexEntry({
        ...entry,
        vaultPath: scanned.file.path,
        lineHint: scanned.line,
      });
    }

    const lineHint =
      options.lineHint !== undefined ? options.lineHint - 1 : scanned.line;
    return this.openTaskAtPath(scanned.file.path, options.mtdId, lineHint);
  }

  private async openTaskAtPath(
    filePath: string,
    mtdId: string,
    lineHint?: number
  ): Promise<boolean> {
    const normalized = normalizePath(
      filePath.endsWith(".md") ? filePath : `${filePath}.md`
    );
    const file = this.app.vault.getAbstractFileByPath(normalized);
    if (!(file instanceof TFile)) {
      new Notice(this.getStrings().notices.taskNoteNotFound);
      return false;
    }

    const leaf = await openFileWithLeaf(this.app, normalized);
    if (!leaf) {
      return false;
    }

    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    let line = lineHint !== undefined ? lineHint : -1;
    if (line < 0 || parseMtdComment(lines[line] ?? "").id !== mtdId) {
      line = findTaskLineByMtdId(lines, mtdId);
    }
    if (line < 0) {
      new Notice(this.getStrings().notices.taskLineNotFound);
      return false;
    }

    const view = leaf.view;
    if (view instanceof MarkdownView) {
      return this.locateInMarkdownView(view, line, mtdId, this.getStrings().notices.locatedTask);
    }
    return false;
  }

  async navigateToTask(options: {
    vaultParam: string;
    filePath: string;
    mtdId: string;
    lineHint?: number;
  }): Promise<boolean> {
    const strings = this.getStrings();
    if (!vaultMatchesUriTarget(this.app, options.vaultParam)) {
      const vaultLabel = decodeObsidianUriParam(options.vaultParam);
      new Notice(formatString(strings.notices.switchVault, { vault: vaultLabel }));
      return false;
    }

    const decodedFilePath = decodeObsidianUriParam(options.filePath);
    const lineHint =
      options.lineHint !== undefined ? options.lineHint - 1 : undefined;
    return this.openTaskAtPath(
      decodedFilePath.endsWith(".md") ? decodedFilePath : `${decodedFilePath}.md`,
      options.mtdId,
      lineHint
    );
  }

  private locateInMarkdownView(
    view: MarkdownView,
    line: number,
    mtdId: string,
    overlayLabel: string
  ): boolean {
    this.locateEpoch += 1;
    const epoch = this.locateEpoch;
    for (const timerId of this.pendingTimers) {
      window.clearTimeout(timerId);
    }
    this.pendingTimers.clear();
    this.overlay.clear();

    const editor = view.editor;
    const lineText = editor?.getLine(line) ?? "";
    const titleHint = parseTaskLine(lineText)?.title;
    const query = { mtdId, line, titleHint };

    if (editor) {
      this.scrollEditorToLine(editor, line, lineText);
    }

    this.flashLocateWithRetry(view, query, overlayLabel, 0, false, epoch);
    return true;
  }

  private scrollEditorToLine(
    editor: NonNullable<MarkdownView["editor"]>,
    line: number,
    lineText: string
  ): void {
    const from = { line, ch: 0 };
    const to = { line, ch: Math.max(0, lineText.length) };

    try {
      editor.setSelection(from, to);
    } catch {
      try {
        editor.setCursor(from);
      } catch {
        /* ignore */
      }
    }

    try {
      editor.scrollIntoView(
        { from: { line: Math.max(0, line - 2), ch: 0 }, to: { line: line + 2, ch: 0 } },
        true
      );
    } catch {
      try {
        editor.scrollIntoView({ from, to }, true);
      } catch {
        /* ignore */
      }
    }
  }

  private flashLocateWithRetry(
    view: MarkdownView,
    query: { mtdId: string; line: number; titleHint?: string },
    overlayLabel: string,
    attempt: number,
    cmHighlighted: boolean,
    epoch: number
  ): void {
    if (this.disposed || epoch !== this.locateEpoch) {
      return;
    }
    const delay = attempt === 0 ? LOCATE_INITIAL_DELAY_MS : LOCATE_RETRY_DELAY_MS;
    const timerId = window.setTimeout(() => {
      this.pendingTimers.delete(timerId);
      if (this.disposed || epoch !== this.locateEpoch) {
        return;
      }
      const editor = view.editor;
      let cmDone = cmHighlighted;

      if (editor && !cmDone) {
        cmDone = highlightEditorLineWithCm(editor, query.line);
      }

      const rect = resolveTaskLineRect(view, query.line, query);
      if (rect) {
        const anchor = view.containerEl;
        showRowHighlightBand(rect, undefined, anchor);
        this.overlay.showAtRect(rect, overlayLabel, undefined, anchor);

        const element = findTaskElementInPreview(view.containerEl, query);
        if (element) {
          highlightPreviewTaskElement(element);
          try {
            element.scrollIntoView({ block: "center", inline: "nearest" });
          } catch {
            /* ignore */
          }
        }
        return;
      }

      if (attempt + 1 < LOCATE_MAX_ATTEMPTS) {
        this.flashLocateWithRetry(view, query, overlayLabel, attempt + 1, cmDone, epoch);
      }
    }, delay);
    this.pendingTimers.add(timerId);
  }
}
