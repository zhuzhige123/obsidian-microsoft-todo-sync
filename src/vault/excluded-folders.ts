import { normalizePath } from "obsidian";

/** Normalize a single folder path for storage and matching. Empty → "". */
export function normalizeExcludedFolderPath(raw: string): string {
  const trimmed = raw.trim().replace(/^[/\\]+/, "").replace(/[/\\]+$/, "");
  if (!trimmed) {
    return "";
  }
  return normalizePath(trimmed);
}

export type ExcludedFolderCommit =
  | { status: "empty" }
  | { status: "duplicate" }
  | { status: "covered"; by: string }
  | { status: "added"; folders: string[] };

/**
 * Decide how a newly chosen folder changes the exclusion list.
 * A parent replaces nested entries. A path already under an excluded parent is rejected.
 */
export function commitExcludedFolder(current: string[], rawPath: string): ExcludedFolderCommit {
  const path = normalizeExcludedFolderPath(rawPath);
  if (!path) {
    return { status: "empty" };
  }
  const folders = normalizeExcludedFolders(current);
  const pathKey = path.toLowerCase();
  for (const folder of folders) {
    const folderKey = folder.toLowerCase();
    if (folderKey === pathKey) {
      return { status: "duplicate" };
    }
    if (pathKey.startsWith(`${folderKey}/`)) {
      return { status: "covered", by: folder };
    }
  }
  const kept = folders.filter((folder) => !folder.toLowerCase().startsWith(`${pathKey}/`));
  kept.push(path);
  return { status: "added", folders: kept };
}

/** Coerce stored / UI values into a deduped list of folder paths. */
export function normalizeExcludedFolders(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const folders: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = normalizeExcludedFolderPath(item);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    folders.push(normalized);
  }
  return folders;
}

/**
 * True when `filePath` is the excluded folder itself or a file/folder under it.
 * `Templates` matches `Templates/a.md` but not `TemplatesExtra/a.md`.
 */
export function isVaultPathExcluded(filePath: string, excludedFolders: string[]): boolean {
  if (excludedFolders.length === 0) {
    return false;
  }
  const normalizedFile = normalizePath(filePath.trim());
  if (!normalizedFile) {
    return false;
  }
  const fileLower = normalizedFile.toLowerCase();
  for (const folder of excludedFolders) {
    const normalizedFolder = normalizeExcludedFolderPath(folder);
    if (!normalizedFolder) {
      continue;
    }
    const folderLower = normalizedFolder.toLowerCase();
    if (fileLower === folderLower || fileLower.startsWith(`${folderLower}/`)) {
      return true;
    }
  }
  return false;
}
