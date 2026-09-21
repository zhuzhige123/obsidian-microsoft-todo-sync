import type { SyncMeta } from "../types/sync";

export function normalizeSyncMeta(meta: SyncMeta | undefined): SyncMeta {
  if (!meta) {
    return { deltaLinks: {}, ignoredGraphTaskIds: [] };
  }

  const deltaLinks = { ...(meta.deltaLinks ?? {}) };
  const raw = meta as Record<string, unknown>;
  const legacyListId = typeof raw.todoListId === "string" ? raw.todoListId : undefined;
  const legacyDeltaLink = typeof raw.deltaLink === "string" ? raw.deltaLink : undefined;

  if (legacyListId && legacyDeltaLink && !deltaLinks[legacyListId]) {
    deltaLinks[legacyListId] = legacyDeltaLink;
  }

  const ignoredGraphTaskIds = Array.isArray(meta.ignoredGraphTaskIds)
    ? [...new Set(meta.ignoredGraphTaskIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];

  return { deltaLinks, ignoredGraphTaskIds };
}

export function getDeltaLink(meta: SyncMeta | undefined, listId: string): string | undefined {
  const normalized = normalizeSyncMeta(meta);
  return normalized.deltaLinks?.[listId];
}

export function setDeltaLink(meta: SyncMeta, listId: string, deltaLink: string | undefined): SyncMeta {
  const normalized = normalizeSyncMeta(meta);
  const deltaLinks = { ...(normalized.deltaLinks ?? {}) };
  if (deltaLink) {
    deltaLinks[listId] = deltaLink;
  } else {
    delete deltaLinks[listId];
  }
  return {
    deltaLinks,
    ignoredGraphTaskIds: normalized.ignoredGraphTaskIds ?? [],
  };
}

export function isIgnoredGraphTaskId(meta: SyncMeta | undefined, graphTaskId: string): boolean {
  const normalized = normalizeSyncMeta(meta);
  return (normalized.ignoredGraphTaskIds ?? []).includes(graphTaskId);
}

export function addIgnoredGraphTaskId(meta: SyncMeta, graphTaskId: string): SyncMeta {
  const normalized = normalizeSyncMeta(meta);
  if (!graphTaskId || (normalized.ignoredGraphTaskIds ?? []).includes(graphTaskId)) {
    return normalized;
  }
  return {
    ...normalized,
    ignoredGraphTaskIds: [...(normalized.ignoredGraphTaskIds ?? []), graphTaskId],
  };
}

export function removeIgnoredGraphTaskId(meta: SyncMeta, graphTaskId: string): SyncMeta {
  const normalized = normalizeSyncMeta(meta);
  return {
    ...normalized,
    ignoredGraphTaskIds: (normalized.ignoredGraphTaskIds ?? []).filter((id) => id !== graphTaskId),
  };
}
