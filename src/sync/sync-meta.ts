import type { SyncMeta } from "../types/sync";

export function normalizeSyncMeta(meta: SyncMeta | undefined): SyncMeta {
  if (!meta) {
    return { deltaLinks: {} };
  }

  const deltaLinks = { ...(meta.deltaLinks ?? {}) };
  const raw = meta as Record<string, unknown>;
  const legacyListId = typeof raw.todoListId === "string" ? raw.todoListId : undefined;
  const legacyDeltaLink = typeof raw.deltaLink === "string" ? raw.deltaLink : undefined;

  if (legacyListId && legacyDeltaLink && !deltaLinks[legacyListId]) {
    deltaLinks[legacyListId] = legacyDeltaLink;
  }

  return { deltaLinks };
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
  return { deltaLinks };
}
