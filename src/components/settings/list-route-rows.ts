import type { ListRouteEntry } from "../../settings/types";
import {
  formatRouteDisplayTag,
  parseRouteDisplayInput,
} from "../../parse/sync-tag";

export interface RouteRow {
  id: string;
  displayTag: string;
  listName: string;
  vaultPath: string;
  saved: boolean;
}

export type RouteValidationError =
  | "tag"
  | "list"
  | "vault"
  | "duplicate"
  | "namespace"
  | "list_conflict";

export function routesSyncKey(routes: ListRouteEntry[], tag: string): string {
  return JSON.stringify({ tag, routes });
}

export function buildSavedRows(nextRoutes: ListRouteEntry[], tag: string): RouteRow[] {
  return nextRoutes.map((route, index) => ({
    id: `saved-${index}-${route.tagPath}`,
    displayTag: formatRouteDisplayTag(tag, route.tagPath),
    listName: route.listName,
    vaultPath: route.vaultPath,
    saved: true,
  }));
}

export function newRouteRowId(): string {
  return `draft-${window.crypto.randomUUID()}`;
}

export function defaultRouteDisplayTag(syncTag: string): string {
  const prefix = syncTag.replace(/^#/, "").trim() || "mtd-sync";
  return `#${prefix}/`;
}

export function entriesFromRows(rows: RouteRow[], syncTag: string): ListRouteEntry[] | null {
  const entries: ListRouteEntry[] = [];
  const seenTags = new Set<string>();
  const seenLists = new Map<string, string>();

  for (const row of rows) {
    if (!row.saved) {
      continue;
    }

    const parsed = parseRouteDisplayInput(row.displayTag, syncTag);
    if (parsed.error) {
      return null;
    }

    const listName = row.listName.trim();
    const vaultPath = row.vaultPath.trim();
    if (!listName) {
      return null;
    }
    if (!vaultPath) {
      return null;
    }

    const dedupeKey = parsed.tagPath.toLowerCase();
    if (seenTags.has(dedupeKey)) {
      return null;
    }
    seenTags.add(dedupeKey);

    const listKey = listName.toLowerCase();
    const existingPath = seenLists.get(listKey);
    if (existingPath && existingPath !== vaultPath) {
      return null;
    }
    seenLists.set(listKey, vaultPath);

    entries.push({ tagPath: parsed.tagPath, listName, vaultPath });
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
  if (!row.vaultPath.trim()) {
    return "vault";
  }

  const duplicateTag = rows.some((item) => {
    if (item.id === row.id || !item.saved) {
      return false;
    }
    const other = parseRouteDisplayInput(item.displayTag, syncTag);
    return !other.error && other.tagPath.toLowerCase() === parsed.tagPath.toLowerCase();
  });
  if (duplicateTag) {
    return "duplicate";
  }

  const listKey = row.listName.trim().toLowerCase();
  const vaultPath = row.vaultPath.trim();
  const listConflict = rows.some((item) => {
    if (item.id === row.id || !item.saved) {
      return false;
    }
    return (
      item.listName.trim().toLowerCase() === listKey &&
      item.vaultPath.trim() !== vaultPath
    );
  });
  if (listConflict) {
    return "list_conflict";
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
    vaultPath: row.vaultPath.trim(),
  };
}
