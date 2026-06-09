import type { ListRouteEntry } from "../settings/types";

/** Obsidian tag body: letters, numbers, underscore, hyphen, slash; Unicode allowed. */
const TAG_BODY = "[\\p{L}\\p{N}_/-]+";
const TAG_RE = new RegExp(`#(${TAG_BODY})`, "gu");

export interface SyncScopeSettings {
  syncTag: string;
  todoListName: string;
  listRoutes: ListRouteEntry[];
}

export function normalizeSyncTagPrefix(syncTag: string): string {
  return syncTag.replace(/^#/, "").trim();
}

export function extractTags(text: string): string[] {
  const tags: string[] = [];
  const re = new RegExp(TAG_RE.source, TAG_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const body = match[1];
    if (body) {
      tags.push(body);
    }
  }
  return tags;
}

export function stripHashTags(text: string): string {
  return text.replace(new RegExp(`#${TAG_BODY}`, "gu"), "");
}

export function hasSyncTag(line: string, syncTag: string): boolean {
  const prefix = normalizeSyncTagPrefix(syncTag);
  if (!prefix) {
    return false;
  }
  const lowerPrefix = prefix.toLowerCase();
  for (const tag of extractTags(line)) {
    const lower = tag.toLowerCase();
    if (lower === lowerPrefix || lower.startsWith(`${lowerPrefix}/`)) {
      return true;
    }
  }
  return false;
}

function normalizeRoutePath(tagPath: string, prefix: string): string {
  let path = tagPath.replace(/^#/, "").trim();
  const lowerPrefix = prefix.toLowerCase();
  if (path.toLowerCase().startsWith(`${lowerPrefix}/`)) {
    path = path.slice(prefix.length + 1);
  }
  return path;
}

export function resolveTargetListName(line: string, settings: SyncScopeSettings): string {
  const prefix = normalizeSyncTagPrefix(settings.syncTag);
  const lowerPrefix = prefix.toLowerCase();
  const matching = extractTags(line).filter((tag) => {
    const lower = tag.toLowerCase();
    return lower === lowerPrefix || lower.startsWith(`${lowerPrefix}/`);
  });

  if (matching.length === 0) {
    return settings.todoListName;
  }

  let bestRoute: ListRouteEntry | undefined;
  let bestLen = -1;

  for (const route of settings.listRoutes) {
    const path = normalizeRoutePath(route.tagPath, prefix);
    if (!path) {
      continue;
    }
    const fullTag = `${prefix}/${path}`.toLowerCase();
    for (const tag of matching) {
      if (tag.toLowerCase() === fullTag && path.length > bestLen) {
        bestRoute = route;
        bestLen = path.length;
      }
    }
  }

  return bestRoute?.listName.trim() || settings.todoListName;
}

export function collectManagedListNames(settings: SyncScopeSettings): string[] {
  const names = new Set<string>();
  names.add(settings.todoListName.trim());
  for (const route of settings.listRoutes) {
    const name = route.listName.trim();
    if (name) {
      names.add(name);
    }
  }
  return [...names];
}

export function formatRouteDisplayTag(syncTag: string, tagPath: string): string {
  const prefix = normalizeSyncTagPrefix(syncTag);
  const path = normalizeRoutePath(tagPath, prefix);
  if (!path) {
    return `#${prefix}`;
  }
  return `#${prefix}/${path}`;
}

export type RouteDisplayParseError = "empty" | "namespace_only" | "invalid";

export function parseRouteDisplayInput(
  input: string,
  syncTag: string
): { tagPath: string; error?: RouteDisplayParseError } {
  const prefix = normalizeSyncTagPrefix(syncTag);
  if (!prefix) {
    return { tagPath: "", error: "invalid" };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { tagPath: "", error: "empty" };
  }

  let body = trimmed.replace(/^#/, "").trim();
  const lowerPrefix = prefix.toLowerCase();
  const lowerBody = body.toLowerCase();

  if (lowerBody === lowerPrefix) {
    return { tagPath: "", error: "namespace_only" };
  }

  if (lowerBody.startsWith(`${lowerPrefix}/`)) {
    body = body.slice(prefix.length + 1);
  }

  const tagPath = body.trim();
  if (!tagPath) {
    return { tagPath: "", error: "invalid" };
  }

  return { tagPath };
}

export function formatListRoutesText(routes: ListRouteEntry[]): string {
  return routes.map((route) => `${route.tagPath} | ${route.listName}`).join("\n");
}

export function parseListRoutesText(text: string): ListRouteEntry[] {
  const routes: ListRouteEntry[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const pipe = trimmed.indexOf("|");
    const eq = trimmed.indexOf("=");
    let tagPath = "";
    let listName = "";
    if (pipe >= 0 && (eq < 0 || pipe < eq)) {
      tagPath = trimmed.slice(0, pipe).trim();
      listName = trimmed.slice(pipe + 1).trim();
    } else if (eq >= 0) {
      tagPath = trimmed.slice(0, eq).trim();
      listName = trimmed.slice(eq + 1).trim();
    }
    if (tagPath && listName) {
      routes.push({ tagPath, listName });
    }
  }
  return routes;
}
