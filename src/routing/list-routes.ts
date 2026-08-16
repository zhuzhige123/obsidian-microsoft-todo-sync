import { normalizePath } from "obsidian";
import type { ListRouteEntry } from "../settings/types";
import { extractTags, normalizeSyncTagPrefix } from "../parse/tags";

export interface SyncScopeSettings {
  syncTag: string;
  todoListName: string;
  defaultInboundVaultPath: string;
  listRoutes: ListRouteEntry[];
}

export interface InboundRoute {
  vaultPath: string;
  tagPath?: string;
}

export function normalizeInboundVaultPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = normalizePath(trimmed);
  return normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
}

export function resolveInboundVaultPath(route: ListRouteEntry, defaultPath: string): string {
  const explicit = normalizeInboundVaultPath(route.vaultPath);
  if (explicit) {
    return explicit;
  }
  return normalizeInboundVaultPath(defaultPath);
}

function normalizeRoutePath(tagPath: string, prefix: string): string {
  let path = tagPath.replace(/^#/, "").trim();
  const lowerPrefix = prefix.toLowerCase();
  const lowerPath = path.toLowerCase();
  const prefixWithSlash = `${lowerPrefix}/`;
  if (lowerPath.startsWith(prefixWithSlash)) {
    path = path.slice(lowerPath.indexOf(prefixWithSlash) + prefixWithSlash.length);
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

export function resolveInboundRoute(listName: string, settings: SyncScopeSettings): InboundRoute {
  const trimmed = listName.trim();
  const defaultPath = normalizeInboundVaultPath(settings.defaultInboundVaultPath);

  for (const route of settings.listRoutes) {
    if (route.listName.trim() === trimmed) {
      return {
        vaultPath: resolveInboundVaultPath(route, settings.defaultInboundVaultPath),
        tagPath: route.tagPath.trim() || undefined,
      };
    }
  }

  if (trimmed === settings.todoListName.trim()) {
    return { vaultPath: defaultPath };
  }

  return { vaultPath: defaultPath };
}

/** To Do lists that participate in Obsidian sync (inbound + outbound routing). */
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

  const prefixWithSlash = `${lowerPrefix}/`;
  if (lowerBody.startsWith(prefixWithSlash)) {
    body = body.slice(lowerBody.indexOf(prefixWithSlash) + prefixWithSlash.length);
  }

  const tagPath = body.trim();
  if (!tagPath) {
    return { tagPath: "", error: "invalid" };
  }

  return { tagPath };
}

export function formatListRoutesText(routes: ListRouteEntry[]): string {
  return routes
    .map((route) => `${route.tagPath} | ${route.listName} | ${route.vaultPath}`)
    .join("\n");
}

export function parseListRoutesText(text: string): ListRouteEntry[] {
  const routes: ListRouteEntry[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    let tagPath = "";
    let listName = "";
    let vaultPath = "";
    const segments = trimmed.split("|").map((part) => part.trim());
    if (segments.length >= 2) {
      tagPath = segments[0] ?? "";
      listName = segments[1] ?? "";
      vaultPath = segments[2] ?? "";
    } else if (eq >= 0) {
      tagPath = trimmed.slice(0, eq).trim();
      listName = trimmed.slice(eq + 1).trim();
    }
    if (tagPath && listName) {
      routes.push({ tagPath, listName, vaultPath });
    }
  }
  return routes;
}
