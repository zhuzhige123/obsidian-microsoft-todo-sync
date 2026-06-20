export function normalizeHeadingText(text: string): string {
  return text
    .trim()
    .replace(/\[\[|\]\]/g, "")
    .replace(/^#{1,6}\s*/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Find the line index where a new inbound task block should be inserted at the end of
 * a heading section. Returns null when the heading is not found.
 */
export function findHeadingSectionEnd(lines: string[], headingText: string): number | null {
  const target = normalizeHeadingText(headingText);
  if (!target) {
    return null;
  }

  let sectionLevel = 0;
  let inSection = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!match) {
      continue;
    }

    const level = match[1].length;
    const text = normalizeHeadingText(match[2] ?? "");

    if (!inSection) {
      if (text === target) {
        inSection = true;
        sectionLevel = level;
      }
      continue;
    }

    if (level <= sectionLevel) {
      return index;
    }
  }

  return inSection ? lines.length : null;
}

/** 0-based line index where a blank separator (if any) and task block are spliced in. */
export function computeInboundInsertAt(existingLines: string[]): number {
  const lines = [...existingLines];
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
    lines.pop();
  }
  return lines.length;
}

/** 0-based line index of the parent task after optional blank separator insertion. */
export function projectedInboundParentLine(insertAt: number, existingLines: string[]): number {
  const needsBlank =
    insertAt > 0 && insertAt <= existingLines.length && (existingLines[insertAt - 1] ?? "").trim() !== "";
  return insertAt + (needsBlank ? 1 : 0);
}

/** Line index (0-based) where the inbound block should be spliced in. */
export function computeInboundInsertLine(lines: string[], heading?: string): number {
  const trimmedHeading = heading?.trim();
  if (!trimmedHeading) {
    return computeInboundInsertAt(lines);
  }

  const sectionEnd = findHeadingSectionEnd(lines, trimmedHeading);
  if (sectionEnd === null) {
    return computeInboundInsertAt(lines);
  }

  return computeInboundInsertAt(lines.slice(0, sectionEnd));
}

export function insertInboundTaskBlock(
  existingLines: string[],
  blockLines: string[],
  insertAt: number
): { lines: string[]; parentLine: number } {
  const lines = [...existingLines];
  const needsBlank =
    insertAt > 0 && insertAt <= lines.length && (lines[insertAt - 1] ?? "").trim() !== "";
  const prefix = needsBlank ? [""] : [];
  const parentLine = insertAt + (needsBlank ? 1 : 0);
  lines.splice(insertAt, 0, ...prefix, ...blockLines);
  return { lines, parentLine };
}

export function appendInboundTaskBlock(
  existingLines: string[],
  blockLines: string[]
): { lines: string[]; parentLine: number } {
  return insertInboundTaskBlock(existingLines, blockLines, computeInboundInsertAt(existingLines));
}
