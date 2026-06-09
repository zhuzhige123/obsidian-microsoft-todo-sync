export function selectionTouchesRange(
  ranges: readonly { from: number; to: number }[],
  from: number,
  to: number
): boolean {
  for (const range of ranges) {
    if (range.from <= to && range.to >= from) {
      return true;
    }
  }
  return false;
}
