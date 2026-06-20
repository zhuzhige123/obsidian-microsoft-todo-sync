/** Parse inbound placement header at the start of a Microsoft To Do task body. */

export interface WikilinkTarget {
  filePart: string;
  heading?: string;
}

export interface InboundRouteParseResult {
  hasRoute: boolean;
  linkRaw?: string;
  filePart?: string;
  heading?: string;
  userNote: string;
}

const WIKILINK_LINE_RE = /^\[\[([^\]]+)\]\]\s*$/;
const PAGE_LINE_RE = /^page:\s*(.+)$/i;
const ROUTE_SEPARATOR = "---";

/** Split `[[Note#Heading]]` or `[[Note## Heading]]` into file + optional heading. */
export function parseWikilinkTarget(line: string): WikilinkTarget | null {
  const trimmed = line.trim();
  const match = WIKILINK_LINE_RE.exec(trimmed);
  if (!match) {
    return null;
  }

  return parseLinkInner(match[1].trim());
}

function parseLinkInner(innerRaw: string): WikilinkTarget | null {
  let inner = innerRaw.trim();
  const aliasSep = inner.indexOf("|");
  if (aliasSep >= 0) {
    inner = inner.slice(0, aliasSep).trim();
  }

  const hashMatch = /#{1,2}\s*(.+)$/.exec(inner);
  if (!hashMatch) {
    return inner ? { filePart: inner } : null;
  }

  const hashIndex = inner.indexOf(hashMatch[0]);
  const filePart = inner.slice(0, hashIndex).trim();
  const heading = hashMatch[1].trim();
  if (!filePart) {
    return null;
  }
  return { filePart, heading: heading || undefined };
}

function parsePlainPageValue(value: string): WikilinkTarget | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (WIKILINK_LINE_RE.test(trimmed)) {
    return parseWikilinkTarget(trimmed);
  }

  if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
    return parseWikilinkTarget(trimmed);
  }

  return parseLinkInner(trimmed);
}

/** Parse the first route line: `[[note#heading]]` or `page: …`. */
export function parseInboundRouteLine(line: string): (WikilinkTarget & { linkRaw: string }) | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  if (WIKILINK_LINE_RE.test(trimmed)) {
    const wikilink = parseWikilinkTarget(trimmed);
    if (!wikilink?.filePart) {
      return null;
    }
    return { ...wikilink, linkRaw: trimmed };
  }

  const pageMatch = PAGE_LINE_RE.exec(trimmed);
  if (!pageMatch) {
    return null;
  }

  const target = parsePlainPageValue(pageMatch[1] ?? "");
  if (!target?.filePart) {
    return null;
  }
  return { ...target, linkRaw: trimmed };
}

/**
 * Dedicated-sync-list tasks may optionally start the To Do body with a placement header:
 *
 * ```text
 * [[file#heading]]
 * ---
 * user note
 * ```
 *
 * or
 *
 * ```text
 * page: [[file#heading]]
 * ---
 * user note
 * ```
 *
 * List membership controls *whether* inbound runs; this header controls *where* in the vault.
 */
export function parseInboundRouteHeader(body: string): InboundRouteParseResult {
  const lines = body.replace(/^\uFEFF/, "").split("\n");
  if (lines.length < 2) {
    return { hasRoute: false, userNote: body };
  }

  const firstLine = lines[0] ?? "";
  const secondLine = (lines[1] ?? "").trim();
  if (secondLine !== ROUTE_SEPARATOR) {
    return { hasRoute: false, userNote: body };
  }

  const target = parseInboundRouteLine(firstLine);
  if (!target) {
    return { hasRoute: false, userNote: body };
  }

  return {
    hasRoute: true,
    linkRaw: target.linkRaw,
    filePart: target.filePart,
    heading: target.heading,
    userNote: lines.slice(2).join("\n"),
  };
}
