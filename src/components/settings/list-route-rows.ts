import type { ListRouteEntry } from "../../settings/types";
import {
  formatRouteDisplayTag,
  parseRouteDisplayInput,
} from "../../parse/sync-tag";

export interface RouteRow {
  id: string;
  displayTag: string;
  listName: string;
  saved: boolean;
}

export type RouteValidationError = "tag" | "list" | "duplicate" | "namespace";

export function routesSyncKey(routes: ListRouteEntry[], tag: string): string {
  return JSON.stringify({ tag, routes });
}

export function buildSavedRows(nextRoutes: ListRouteEntry[], tag: string): RouteRow[] {
  return nextRoutes.map((route, index) => ({
    id: `saved-${index}-${route.tagPath}`,
    displayTag: formatRouteDisplayTag(tag, route.tagPath),
    listName: route.listName,
    saved: true,
  }));
}

export function newRouteRowId(): string {
  return `draft-${globalThis.crypto.randomUUID()}`;
}

export function defaultRouteDisplayTag(syncTag: string): string {
  const prefix = syncTag.replace(/^#/, "").trim() || "mtd-sync";
  return `#${prefix}/`;
}

export function entriesFromRows(rows: RouteRow[], syncTag: string): ListRouteEntry[] | null {
  const entries: ListRouteEntry[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row.saved) {
      continue;
    }

    const parsed = parseRouteDisplayInput(row.displayTag, syncTag);
    if (parsed.error) {
      return null;
    }

    const listName = row.listName.trim();
    if (!listName) {
      return null;
    }

    const dedupeKey = parsed.tagPath.toLowerCase();
    if (seen.has(dedupeKey)) {
      return null;
    }
    seen.add(dedupeKey);

    entries.push({ tagPath: parsed.tagPath, listName });
  }

  return entries;
}

export function validateRouteRow(
  row: RouteRow,
  rows: RouteRow[],
  syncTag: string
): RouteValidationError | null {
  const parsed = parseRouteDisplayInput(row.displayTag, syncTag);
  if (parsed.error === "empty" || parsed.error === "invalid") {
    return "tag";
  }
  if (parsed.error === "namespace_only") {
    return "namespace";
  }
  if (!row.listName.trim()) {
    return "list";
  }

  const duplicate = rows.some((item) => {
    if (item.id === row.id || !item.saved) {
      return false;
    }
    const other = parseRouteDisplayInput(item.displayTag, syncTag);
    return !other.error && other.tagPath.toLowerCase() === parsed.tagPath.toLowerCase();
  });
  if (duplicate) {
    return "duplicate";
  }

  return null;
}

export function commitRouteRow(row: RouteRow, syncTag: string): RouteRow {
  const parsed = parseRouteDisplayInput(row.displayTag, syncTag);
  if (parsed.error) {
    return row;
  }
  return {
    ...row,
    saved: true,
    displayTag: formatRouteDisplayTag(syncTag, parsed.tagPath),
    listName: row.listName.trim(),
  };
}
