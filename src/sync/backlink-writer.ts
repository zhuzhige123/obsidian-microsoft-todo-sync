import { PROTOCOL_NAME } from "../config/constants";

export function buildObsidianTaskUri(options: {
  vaultName: string;
  filePath: string;
  mtdId: string;
  lineNumber?: number;
}): string {
  const params = new URLSearchParams({
    vault: options.vaultName,
    file: options.filePath.replace(/\.md$/i, ""),
    task: options.mtdId,
  });
  if (options.lineNumber !== undefined) {
    params.set("line", String(options.lineNumber + 1));
  }
  return `obsidian://${PROTOCOL_NAME}?${params.toString()}`;
}

const BACKLINK_SECTION_RE =
  /(?:^|\n)---\s*\n在\s*Obsidian\s*中打开[：:]\s*\nobsidian:\/\/[^\s]+/gi;
const STANDALONE_URI_RE = /obsidian:\/\/mtd-sync\?[^\s]*/gi;

export function stripBacklinkFromBody(body: string): string {
  let text = body.trimEnd();
  text = text.replace(BACKLINK_SECTION_RE, "");
  text = text.replace(STANDALONE_URI_RE, "");
  text = text.replace(/在\s*Obsidian\s*中打开[：:]\s*/gi, "");
  return text.trimEnd();
}

export function isBacklinkOnlyBody(body: string): boolean {
  return stripBacklinkFromBody(body).trim().length === 0;
}

/** Pull To Do body into Obsidian fenced note; never import the auto-appended backlink. */
export function resolveNoteBodyOnPull(localNote: string, remoteRaw?: string): string {
  if (!remoteRaw?.trim()) {
    return localNote;
  }
  if (isBacklinkOnlyBody(remoteRaw)) {
    return localNote;
  }
  return stripBacklinkFromBody(remoteRaw);
}

export function appendBacklinkToBody(noteBody: string, uri: string): string {
  const base = stripBacklinkFromBody(noteBody);
  if (!base) {
    return `---\n在 Obsidian 中打开：\n${uri}`;
  }
  return `${base}\n\n---\n在 Obsidian 中打开：\n${uri}`;
}
