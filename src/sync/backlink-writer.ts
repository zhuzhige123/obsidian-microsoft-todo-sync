export { buildObsidianTaskUri } from "../navigation/obsidian-uri";
import { parseInboundRouteHeader } from "../parse/inbound-route";

/** Known backlink section headers (en + zh) for strip on pull/inbound. */
const BACKLINK_HEADER_LABEL =
  "(?:在\\s*Obsidian\\s*中打开|Open in Obsidian)[：:]";

const BACKLINK_SECTION_RE = new RegExp(
  `(?:^|\\n)---\\s*\\n${BACKLINK_HEADER_LABEL}\\s*\\nobsidian:\\/\\/[^\\s]+`,
  "gi"
);
const STANDALONE_URI_RE = /obsidian:\/\/mtd-sync\?[^\s]*/gi;
const BACKLINK_INLINE_LABEL_RE = new RegExp(`${BACKLINK_HEADER_LABEL}\\s*`, "gi");

export function stripBacklinkFromBody(body: string): string {
  let text = body.trimEnd();
  text = text.replace(BACKLINK_SECTION_RE, "");
  text = text.replace(STANDALONE_URI_RE, "");
  text = text.replace(BACKLINK_INLINE_LABEL_RE, "");
  return text.trimEnd();
}

export function isBacklinkOnlyBody(body: string): boolean {
  return stripBacklinkFromBody(body).trim().length === 0;
}

function stripRouteAndBacklink(remoteRaw: string): string {
  const { userNote } = parseInboundRouteHeader(remoteRaw);
  return stripBacklinkFromBody(userNote);
}

/** Pull To Do body into Obsidian fenced note; strip route header and auto-appended backlink. */
export function resolveNoteBodyOnPull(localNote: string, remoteRaw?: string): string {
  if (!remoteRaw?.trim()) {
    return localNote;
  }
  const stripped = stripRouteAndBacklink(remoteRaw);
  if (!stripped.trim() && isBacklinkOnlyBody(remoteRaw)) {
    return localNote;
  }
  if (!stripped.trim() && parseInboundRouteHeader(remoteRaw).hasRoute) {
    return "";
  }
  return stripped;
}

export function formatTodoBodyAfterInbound(
  remoteRaw: string,
  options: {
    stripRouteHeader: boolean;
    appendBacklink: boolean;
    backlinkUri?: string;
    backlinkHeader?: string;
  }
): string {
  const { stripRouteHeader, appendBacklink, backlinkUri, backlinkHeader } = options;
  let note = remoteRaw;
  if (stripRouteHeader) {
    note = parseInboundRouteHeader(remoteRaw).userNote;
  }
  note = stripBacklinkFromBody(note);
  if (appendBacklink && backlinkUri && backlinkHeader) {
    return appendBacklinkToBody(note, backlinkUri, backlinkHeader);
  }
  return note;
}

export function appendBacklinkToBody(
  noteBody: string,
  uri: string,
  header: string
): string {
  const base = stripBacklinkFromBody(noteBody);
  if (!base) {
    return `---\n${header}\n${uri}`;
  }
  return `${base}\n\n---\n${header}\n${uri}`;
}
