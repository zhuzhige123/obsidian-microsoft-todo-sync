import { MarkdownView, TFile, type App, type WorkspaceLeaf } from "obsidian";

/** Open a vault file, reusing an existing markdown leaf when possible. */
export async function openFileWithLeaf(app: App, path: string): Promise<WorkspaceLeaf | null> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    return null;
  }

  for (const leaf of app.workspace.getLeavesOfType("markdown")) {
    const view = leaf.view;
    if (view instanceof MarkdownView && view.file?.path === path) {
      app.workspace.setActiveLeaf(leaf, { focus: true });
      return leaf;
    }
  }

  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  app.workspace.setActiveLeaf(leaf, { focus: true });
  return leaf;
}
