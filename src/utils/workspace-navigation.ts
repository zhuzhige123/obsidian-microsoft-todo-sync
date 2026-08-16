import { MarkdownView, TFile, type App, type WorkspaceLeaf } from "obsidian";

export async function openFileWithLeaf(app: App, path: string): Promise<WorkspaceLeaf | null> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    return null;
  }
  const leaf = app.workspace.getLeaf("tab");
  await leaf.openFile(file);
  app.workspace.setActiveLeaf(leaf, { focus: true });
  return leaf;
}

export function getActiveMarkdownView(app: App): MarkdownView | null {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  return view ?? null;
}
