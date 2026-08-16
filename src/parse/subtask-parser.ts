import type { ListItemCache } from "obsidian";
import { isFenceLine } from "./note-block-parser";
import { getQuoteDepth } from "./task-callout";
import { parseMtdComment, stripMtdComment } from "./mtd-comment";
import { sanitizeTaskDisplayText } from "./task-text";
import type { ParsedSubtask } from "../types/sync";
import { parseTaskLine } from "./task-line-parser";

export function collectSubtasks(
  lines: string[],
  listItems: ListItemCache[],
  parentLine: number
): ParsedSubtask[] {
  const children = listItems
    .filter((item) => item.parent === parentLine && item.task !== undefined)
    .sort((a, b) => a.position.start.line - b.position.start.line);

  const result: ParsedSubtask[] = [];
  for (const child of children) {
    const line = lines[child.position.start.line] ?? "";
    const parsed = parseTaskLine(line);
    if (!parsed) {
      continue;
    }
    const mtd = parseMtdComment(line);
    const title = sanitizeTaskDisplayText(
      stripMtdComment(parsed.body)
        .replace(/#[\w/-]+/g, "")
        .trim()
    );
    result.push({
      line: child.position.start.line,
      rawLine: line,
      title,
      checked: child.task !== " ",
      mtd,
    });
  }
  return result;
}

export function collectSubtasksFromLines(
  lines: string[],
  parentLine: number,
  parentIndent: number
): ParsedSubtask[] {
  const parentQuoteDepth = getQuoteDepth(lines[parentLine] ?? "");
  const result: ParsedSubtask[] = [];
  for (let index = parentLine + 1; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      continue;
    }
    if (getQuoteDepth(line) < parentQuoteDepth) {
      break;
    }
    if (isFenceLine(line)) {
      break;
    }
    const parsed = parseTaskLine(line);
    if (!parsed) {
      break;
    }
    if (parsed.indent <= parentIndent) {
      break;
    }
    if (parsed.indent !== parentIndent + 2) {
      continue;
    }
    const mtd = parseMtdComment(line);
    const title = sanitizeTaskDisplayText(
      stripMtdComment(parsed.body)
        .replace(/#[\w/-]+/g, "")
        .trim()
    );
    result.push({
      line: index,
      rawLine: line,
      title,
      checked: parsed.checkbox === "x" || parsed.checkbox === "X",
      mtd,
    });
  }
  return result;
}
