import type { App, TFile } from "obsidian";
import { findTaskLineByMtdId } from "../parse/mtd-index";
import { isVaultPathExcluded } from "./excluded-folders";

export async function findTaskInVault(
  app: App,
  mtdId: string,
  excludedFolders: string[] = []
): Promise<{ file: TFile; line: number } | null> {
  for (const file of app.vault.getMarkdownFiles()) {
    if (isVaultPathExcluded(file.path, excludedFolders)) {
      continue;
    }
    const content = await app.vault.read(file);
    const line = findTaskLineByMtdId(content.split("\n"), mtdId);
    if (line >= 0) {
      return { file, line };
    }
  }
  return null;
}
