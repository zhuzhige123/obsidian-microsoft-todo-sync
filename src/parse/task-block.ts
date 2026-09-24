import { extractFencedNoteBlock, extractLegacyIndentedNote, isFenceLine } from "./note-block-parser";
import { getQuoteDepth } from "./task-callout";
import { parseTaskLine } from "./task-line-parser";

export interface TaskBlockBounds {
  blockEnd: number;
  noteBody: string;
  subtaskLineEnd: number;
}

/**
 * Task block layout:
 *   parent task line
 *   nested subtasks (optional)
 *   fenced note ``` ... ``` (optional)
 */
export function parseTaskBlockBounds(
  lines: string[],
  taskLine: number,
  taskIndent: number
): TaskBlockBounds {
  const parentQuoteDepth = getQuoteDepth(lines[taskLine] ?? "");
  let index = taskLine + 1;
  /** Exclusive end of real block content — blank look-ahead must not extend this. */
  let blockContentEnd = taskLine + 1;
  let sawSubtask = false;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      // Peek through blanks for nested content; do not claim them as part of the block
      // until a subtask/note actually follows (avoids swallowing gaps before siblings,
      // headings, or plugin footers like `%% kanban:settings`).
      index += 1;
      continue;
    }
    if (getQuoteDepth(line) < parentQuoteDepth) {
      break;
    }
    if (isFenceLine(line)) {
      break;
    }
    const parsed = parseTaskLine(line);
    if (parsed && parsed.indent > taskIndent) {
      sawSubtask = true;
      index += 1;
      blockContentEnd = index;
      continue;
    }
    break;
  }

  const subtaskLineEnd = blockContentEnd;
  const fenced = extractFencedNoteBlock(lines, index);
  if (fenced.endIndex > index || fenced.noteBody) {
    return {
      blockEnd: fenced.endIndex,
      noteBody: fenced.noteBody,
      subtaskLineEnd,
    };
  }

  if (!sawSubtask) {
    const legacy = extractLegacyIndentedNote(lines, taskLine + 1, taskIndent);
    return {
      blockEnd: legacy.endIndex,
      noteBody: legacy.noteLines.join("\n").trim(),
      subtaskLineEnd: taskLine + 1,
    };
  }

  return {
    blockEnd: subtaskLineEnd,
    noteBody: "",
    subtaskLineEnd,
  };
}

/** End line index (exclusive) for parent + subtasks + fenced note. */
export function computeTaskBlockEnd(
  lines: string[],
  taskLine: number,
  taskIndent: number
): number {
  return parseTaskBlockBounds(lines, taskLine, taskIndent).blockEnd;
}
