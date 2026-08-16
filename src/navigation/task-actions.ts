import { Notice, type App } from "obsidian";
import { buildObsidianTaskUri, getVaultUriIdentifier } from "./obsidian-uri";

export function buildMicrosoftTodoTaskUrl(graphTaskId: string): string {
  return `https://to-do.live.com/tasks/id/${graphTaskId}`;
}

export function openMicrosoftTodoTask(graphTaskId: string): void {
  window.open(buildMicrosoftTodoTaskUrl(graphTaskId), "_blank", "noopener");
}

export async function copyObsidianTaskLink(
  app: App,
  mtdId: string,
  notices: { linkCopied: string; copyLinkFailed: string }
): Promise<boolean> {
  const uri = buildObsidianTaskUri({
    mtdId,
    vaultIdentifier: getVaultUriIdentifier(app),
    format: "id-only",
  });
  try {
    await window.navigator.clipboard.writeText(uri);
    new Notice(notices.linkCopied);
    return true;
  } catch {
    new Notice(notices.copyLinkFailed);
    return false;
  }
}
