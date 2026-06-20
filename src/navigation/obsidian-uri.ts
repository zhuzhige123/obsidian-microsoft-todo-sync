import type { App } from "obsidian";
import { PROTOCOL_NAME } from "../config/constants";

type AppWithVaultId = App & { appId?: string };

const MTD_ID_PREFIX_RE = /^mtd-[0-9a-f]{8}/i;

/** Decode query values from obsidian:// links (+ as space, per application/x-www-form-urlencoded). */
export function decodeObsidianUriParam(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value.replace(/\+/g, " ");
  }
}

/**
 * Stable vault token for obsidian:// URIs. Prefer Obsidian's internal vault id so core can
 * resolve the vault before the plugin handler runs (names with spaces break when encoded as +).
 */
export function getVaultUriIdentifier(app: App): string {
  const appId = (app as AppWithVaultId).appId?.trim();
  if (appId) {
    return appId;
  }
  return app.vault.getName();
}

export function vaultMatchesUriTarget(app: App, vaultParam: string): boolean {
  const decoded = decodeObsidianUriParam(vaultParam.trim());
  if (!decoded) {
    return false;
  }
  const appId = (app as AppWithVaultId).appId?.trim();
  if (appId && decoded === appId) {
    return true;
  }
  return app.vault.getName() === decoded;
}

/** Recover mtd id when To Do or linkifiers append extra text after the id. */
export function parseMtdIdFromUriParam(taskParam: string): string {
  const decoded = decodeObsidianUriParam(taskParam.trim());
  const match = decoded.match(MTD_ID_PREFIX_RE);
  return match?.[0] ?? decoded;
}

export type ObsidianTaskUriFormat = "full" | "id-only";

export interface ObsidianTaskLinkParams {
  mtdId: string;
  vaultParam?: string;
  filePath?: string;
  lineHint?: number;
}

export function buildObsidianTaskUri(options: {
  mtdId: string;
  format?: ObsidianTaskUriFormat;
  vaultIdentifier?: string;
  filePath?: string;
  lineNumber?: number;
}): string {
  const format = options.format ?? "id-only";
  const parts: string[] = [`task=${encodeURIComponent(options.mtdId)}`];

  if (format === "full") {
    if (!options.vaultIdentifier || !options.filePath) {
      throw new Error("Full task URI requires vaultIdentifier and filePath");
    }
    parts.unshift(
      `vault=${encodeURIComponent(options.vaultIdentifier)}`,
      `file=${encodeURIComponent(options.filePath.replace(/\.md$/i, ""))}`
    );
    if (options.lineNumber !== undefined) {
      parts.push(`line=${encodeURIComponent(String(options.lineNumber + 1))}`);
    }
  } else if (options.vaultIdentifier) {
    parts.unshift(`vault=${encodeURIComponent(options.vaultIdentifier)}`);
  }

  return `obsidian://${PROTOCOL_NAME}?${parts.join("&")}`;
}

export function parseTaskLinkParams(params: Record<string, string>): ObsidianTaskLinkParams | null {
  const task = params.task?.trim();
  if (!task) {
    return null;
  }
  const lineRaw = params.line?.trim();
  const lineHint = lineRaw ? Number.parseInt(lineRaw, 10) : undefined;
  return {
    mtdId: parseMtdIdFromUriParam(task),
    vaultParam: params.vault?.trim() || undefined,
    filePath: params.file?.trim() || undefined,
    lineHint:
      lineHint !== undefined && Number.isFinite(lineHint) && lineHint >= 1 ? lineHint : undefined,
  };
}
