/** Strip editor decorations that should not round-trip through sync. */
export function sanitizeTaskDisplayText(text: string): string {
  return text
    .replace(/~~/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
