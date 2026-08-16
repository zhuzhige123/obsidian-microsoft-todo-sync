/** Obsidian tag body: letters, numbers, underscore, hyphen, slash; Unicode allowed. */
const TAG_BODY = "[\\p{L}\\p{N}_/-]+";
const TAG_RE = new RegExp(`#(${TAG_BODY})`, "gu");

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

/** Remove the configured sync tag (and list-route subtags) from a task line. */
export function removeSyncTagFromLine(line: string, syncTag: string): string {
  const prefix = normalizeSyncTagPrefix(syncTag);
  if (!prefix) {
    return line;
  }
  const lowerPrefix = prefix.toLowerCase();
  const tagPattern = new RegExp(`#(${TAG_BODY})`, "gu");
  const stripped = line.replace(tagPattern, (match, tagBody: string) => {
    const lower = tagBody.toLowerCase();
    if (lower === lowerPrefix || lower.startsWith(`${lowerPrefix}/`)) {
      return "";
    }
    return match;
  });
  return stripped.replace(/\s{2,}/g, " ").trimEnd();
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
