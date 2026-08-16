/**
 * Cross-window DOM type checks (Obsidian popout windows).
 */
export function domInstanceOf<T>(value: unknown, type: { new (): T }): value is T {
  if (value !== null && typeof value === "object" && "instanceOf" in value) {
    const checker = (value as { instanceOf?: (ctor: { new (): T }) => boolean }).instanceOf;
    if (typeof checker === "function") {
      return checker.call(value, type);
    }
  }
  return value instanceof type;
}
