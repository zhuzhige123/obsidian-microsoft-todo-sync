export interface MtdComment {
  id?: string;
  graph?: string;
  reminder?: string;
  myday?: boolean;
  step?: string;
}

const MTD_COMMENT_RE = /<!--\s*mtd:([\s\S]*?)\s*-->/;
/** Full inline comment token on a single line (editor scan / reading view). */
export const MTD_COMMENT_INLINE_RE = /<!--\s*mtd:[^>]*?-->/g;

export function findMtdCommentMatchesInLine(
  lineText: string
): Array<{ index: number; raw: string }> {
  const results: Array<{ index: number; raw: string }> = [];
  const re = new RegExp(MTD_COMMENT_INLINE_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(lineText)) !== null) {
    results.push({ index: match.index, raw: match[0] });
  }
  return results;
}
const MTD_KNOWN_KEYS = ["id", "graph", "reminder", "step"] as const;

export function sanitizeGraphId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const compact = value.replace(/\s+/g, "");
  return compact || undefined;
}

function extractMtdAttribute(body: string, key: string): string | undefined {
  const marker = `${key}=`;
  const index = body.indexOf(marker);
  if (index === -1) {
    return undefined;
  }
  const start = index + marker.length;
  const tail = body.slice(start);
  const nextKey = tail.search(/\s+(?:id|graph|reminder|step)=|\s+myday\b/);
  const raw = (nextKey === -1 ? tail : tail.slice(0, nextKey)).trim();
  return raw || undefined;
}

export function parseMtdComment(line: string): MtdComment {
  const match = line.match(MTD_COMMENT_RE);
  if (!match) {
    return {};
  }
  const body = match[1].trim();
  const result: MtdComment = {};
  if (/\bmyday\b/.test(body)) {
    result.myday = true;
  }
  for (const key of MTD_KNOWN_KEYS) {
    const value = extractMtdAttribute(body, key);
    if (!value) {
      continue;
    }
    if (key === "graph") {
      result.graph = sanitizeGraphId(value);
    } else if (key === "id") {
      result.id = value;
    } else if (key === "reminder") {
      result.reminder = value;
    } else if (key === "step") {
      result.step = value;
    }
  }
  return result;
}

export function stripMtdComment(line: string): string {
  return line.replace(MTD_COMMENT_RE, "").trimEnd();
}

/** Vault line metadata — graph IDs stay in the plugin index, not in notes. */
export function serializeMtdComment(mtd: MtdComment): string {
  const parts: string[] = [];
  if (mtd.id) parts.push(`id=${mtd.id}`);
  if (mtd.reminder) parts.push(`reminder=${mtd.reminder}`);
  if (mtd.myday) parts.push("myday");
  if (mtd.step) parts.push(`step=${mtd.step}`);
  if (parts.length === 0) {
    return "";
  }
  return `<!-- mtd:${parts.join(" ")} -->`;
}

export function upsertMtdComment(line: string, patch: Partial<MtdComment>): string {
  const current = parseMtdComment(line);
  const merged: MtdComment = { ...current };
  if (patch.id !== undefined) merged.id = patch.id;
  else if ("id" in patch) delete merged.id;
  if ("graph" in patch) delete merged.graph;
  if (patch.reminder !== undefined) merged.reminder = patch.reminder;
  else if ("reminder" in patch) delete merged.reminder;
  if (patch.step !== undefined) merged.step = patch.step;
  else if ("step" in patch) delete merged.step;
  if (patch.myday !== undefined) merged.myday = patch.myday;
  else if ("myday" in patch) delete merged.myday;
  const without = stripMtdComment(line);
  const serialized = serializeMtdComment(merged);
  return serialized ? `${without} ${serialized}`.trimEnd() : without;
}

export function generateMtdId(): string {
  const suffix = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `mtd-${suffix}`;
}
