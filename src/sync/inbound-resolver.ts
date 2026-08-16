import { normalizePath, type App, type TFile } from "obsidian";
import { normalizeInboundVaultPath } from "../routing/list-routes";

export interface ResolvedInboundLink {
  vaultPath: string;
  heading?: string;
}

function isMarkdownFile(entry: unknown): entry is TFile {
  return !!entry && typeof entry === "object" && "extension" in entry;
}

/** Resolve a wikilink file part or vault-relative path to a markdown file path. */
export function resolveInboundVaultLink(
  app: App,
  filePart: string,
  sourcePath?: string
): string | null {
  const part = filePart.trim();
  if (!part) {
    return null;
  }

  if (part.includes("/") || /\.md$/i.test(part)) {
    const normalized = normalizeInboundVaultPath(part);
    const direct = app.vault.getAbstractFileByPath(normalized);
    if (isMarkdownFile(direct)) {
      return direct.path;
    }
    return normalized;
  }

  const dest = app.metadataCache.getFirstLinkpathDest(part, sourcePath ?? "");
  if (dest) {
    return dest.path;
  }

  const guessed = normalizeInboundVaultPath(part);
  const guessedFile = app.vault.getAbstractFileByPath(guessed);
  if (isMarkdownFile(guessedFile)) {
    return guessedFile.path;
  }

  return null;
}

export function resolveInboundLinkTarget(
  app: App,
  filePart: string,
  heading?: string,
  sourcePath?: string
): ResolvedInboundLink | null {
  const vaultPath = resolveInboundVaultLink(app, filePart, sourcePath);
  if (!vaultPath) {
    return null;
  }
  return {
    vaultPath: normalizePath(vaultPath),
    heading: heading?.trim() || undefined,
  };
}
