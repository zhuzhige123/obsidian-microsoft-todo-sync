import { parseMtdComment } from "./mtd-comment";

export function indexMtdIdsByLine(lines: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let line = 0; line < lines.length; line += 1) {
    const mtd = parseMtdComment(lines[line] ?? "");
    if (mtd.id) {
      map.set(mtd.id, line);
    }
  }
  return map;
}

export function findTaskLineByMtdId(lines: string[], mtdId: string): number {
  for (let line = 0; line < lines.length; line += 1) {
    const mtd = parseMtdComment(lines[line] ?? "");
    if (mtd.id === mtdId) {
      return line;
    }
  }
  return -1;
}

export function collectMtdIdsInLines(lines: string[]): Set<string> {
  const ids = new Set<string>();
  for (const line of lines) {
    const mtd = parseMtdComment(line);
    if (mtd.id) {
      ids.add(mtd.id);
    }
  }
  return ids;
}
