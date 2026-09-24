import { formatCalloutPrefix, stripCalloutPrefix } from "./task-callout";
import { parseTaskLine } from "./task-line-parser";

const LIST_ITEM_RE = /^\s*([-*+]|\d+\.)\s/;
const FENCE_LINE_RE = /^\s*```\s*(\w*)?\s*$/;

export function isFenceLine(line: string): boolean {
  const { content } = stripCalloutPrefix(line);
  return FENCE_LINE_RE.test(content);
}

/** Fenced note immediately after parent/subtasks: ``` ... ``` */
export function extractFencedNoteBlock(
  lines: string[],
  startIndex: number
): { noteBody: string; endIndex: number } {
  let index = startIndex;
  while (index < lines.length && lines[index]?.trim() === "") {
    index += 1;
  }
  if (index >= lines.length || !isFenceLine(lines[index] ?? "")) {
    return { noteBody: "", endIndex: startIndex };
  }

  index += 1;
  const noteLines: string[] = [];
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (isFenceLine(line)) {
      return { noteBody: noteLines.join("\n").trimEnd(), endIndex: index + 1 };
    }
    noteLines.push(stripCalloutPrefix(line).content);
    index += 1;
  }

  return { noteBody: "", endIndex: startIndex };
}

/** Legacy indented paragraphs; only read when no subtasks precede the note. */
export function extractLegacyIndentedNote(
  lines: string[],
  taskLineIndex: number,
  taskIndent: number
): { noteLines: string[]; endIndex: number } {
  const noteLines: string[] = [];
  let index = taskLineIndex;
  /** Exclusive end of note content — blank look-ahead must not extend this. */
  let contentEnd = taskLineIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      // Peek only; trailing/inter-block blanks belong to the document, not the note.
      index += 1;
      continue;
    }

    const taskAtSameLevel = parseTaskLine(line);
    if (taskAtSameLevel && taskAtSameLevel.indent <= taskIndent) {
      break;
    }

    if (/^#{1,6}\s/.test(line)) {
      break;
    }

    if (/^---\s*$/.test(line.trim())) {
      break;
    }

    if (isFenceLine(line)) {
      break;
    }

    const lineIndent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
    const nestedTask = parseTaskLine(line);
    if (nestedTask && nestedTask.indent > taskIndent) {
      break;
    }

    if (lineIndent > taskIndent && !LIST_ITEM_RE.test(line)) {
      noteLines.push(line.trim());
      index += 1;
      contentEnd = index;
      continue;
    }

    break;
  }

  return { noteLines, endIndex: contentEnd };
}

export function formatFencedNoteBlock(noteBody: string, quoteDepth = 0): string[] {
  const trimmed = noteBody.trimEnd();
  if (!trimmed) {
    return [];
  }
  const prefix = formatCalloutPrefix(quoteDepth);
  const bodyLines = trimmed.split("\n");
  return [`${prefix}\`\`\``, ...bodyLines.map((line) => `${prefix}${line}`), `${prefix}\`\`\``];
}

export function formatNoteBlock(noteLines: string[], taskIndent: number): string[] {
  void taskIndent;
  return formatFencedNoteBlock(noteLines.join("\n"));
}

export function extractNoteAfterSubtasks(
  lines: string[],
  taskLine: number,
  taskIndent: number,
  lastSubtaskLine: number | null
): string {
  const noteStart = lastSubtaskLine === null ? taskLine + 1 : lastSubtaskLine + 1;
  const fenced = extractFencedNoteBlock(lines, noteStart);
  if (fenced.noteBody || fenced.endIndex > noteStart) {
    return fenced.noteBody;
  }
  if (lastSubtaskLine === null) {
    const legacy = extractLegacyIndentedNote(lines, taskLine + 1, taskIndent);
    return legacy.noteLines.join("\n").trim();
  }
  return "";
}
