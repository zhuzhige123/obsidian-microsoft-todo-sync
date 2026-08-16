import type { App, TFile } from "obsidian";
import { findTaskLineByMtdId } from "../parse/mtd-index";

export async function findTaskInVault(
  app: App,
  mtdId: string
): Promise<{ file: TFile; line: number } | null> {
  for (const file of app.vault.getMarkdownFiles()) {
    const content = await app.vault.read(file);
    const line = findTaskLineByMtdId(content.split("\n"), mtdId);
    if (line >= 0) {
      return { file, line };
    }
  }
  return null;
}
