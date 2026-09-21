import { AbstractInputSuggest, TFolder, type App } from "obsidian";
import { normalizeExcludedFolderPath } from "../../vault/excluded-folders";

/** Folder path autocomplete for excluded-folder settings inputs. */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private chooserOpen = false;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private readonly excludedPaths: () => string[],
    private readonly onPick: (folder: TFolder) => void
  ) {
    super(app, inputEl);
  }

  /** True while the suggestion popover is showing matches. Enter belongs to the popover then. */
  isChooserOpen(): boolean {
    return this.chooserOpen;
  }

  protected getSuggestions(query: string): TFolder[] {
    const needle = query.trim().toLowerCase();
    const folders: TFolder[] = [];
    for (const abstract of this.app.vault.getAllLoadedFiles()) {
      if (!(abstract instanceof TFolder) || abstract.isRoot()) {
        continue;
      }
      if (isExcludedOrCovered(abstract.path, this.excludedPaths())) {
        continue;
      }
      if (!needle || abstract.path.toLowerCase().includes(needle)) {
        folders.push(abstract);
      }
    }
    folders.sort((a, b) => a.path.localeCompare(b.path));
    this.chooserOpen = folders.length > 0;
    return folders.slice(0, 50);
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
    evt.preventDefault();
    this.setValue(folder.path);
    this.onPick(folder);
    this.close();
  }

  override close(): void {
    this.chooserOpen = false;
    super.close();
  }
}

/** Resolve a typed path to a real vault folder, including case-insensitive matches. */
export function resolveVaultFolder(app: App, rawPath: string): TFolder | null {
  const normalized = normalizeExcludedFolderPath(rawPath);
  if (!normalized) {
    return null;
  }
  const direct = app.vault.getAbstractFileByPath(normalized);
  if (direct instanceof TFolder && !direct.isRoot()) {
    return direct;
  }
  const needle = normalized.toLowerCase();
  for (const abstract of app.vault.getAllLoadedFiles()) {
    if (!(abstract instanceof TFolder) || abstract.isRoot()) {
      continue;
    }
    if (abstract.path.toLowerCase() === needle) {
      return abstract;
    }
  }
  return null;
}

function isExcludedOrCovered(path: string, excluded: string[]): boolean {
  const key = normalizeExcludedFolderPath(path).toLowerCase();
  if (!key) {
    return false;
  }
  for (const folder of excluded) {
    const folderKey = normalizeExcludedFolderPath(folder).toLowerCase();
    if (!folderKey) {
      continue;
    }
    if (key === folderKey || key.startsWith(`${folderKey}/`)) {
      return true;
    }
  }
  return false;
}
