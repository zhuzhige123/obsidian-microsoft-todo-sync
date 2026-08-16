/** Obsidian callout / blockquote prefix: lines like `> - [ ] task`. */

export function getQuoteDepth(line: string): number {
  let depth = 0;
  let rest = line;
  while (rest.startsWith(">")) {
    rest = rest.slice(1);
    if (rest.startsWith(" ")) {
      rest = rest.slice(1);
    }
    depth += 1;
  }
  return depth;
}

export function stripCalloutPrefix(line: string): { content: string; quoteDepth: number } {
  const quoteDepth = getQuoteDepth(line);
  if (quoteDepth === 0) {
    return { content: line, quoteDepth: 0 };
  }
  let rest = line;
  for (let i = 0; i < quoteDepth; i++) {
    rest = rest.slice(1);
    if (rest.startsWith(" ")) {
      rest = rest.slice(1);
    }
  }
  return { content: rest, quoteDepth };
}

export function formatCalloutPrefix(quoteDepth: number): string {
  return quoteDepth > 0 ? "> ".repeat(quoteDepth) : "";
}

export function withCalloutPrefix(quoteDepth: number, body: string): string {
  if (quoteDepth <= 0) {
    return body;
  }
  return `${formatCalloutPrefix(quoteDepth)}${body}`;
}
