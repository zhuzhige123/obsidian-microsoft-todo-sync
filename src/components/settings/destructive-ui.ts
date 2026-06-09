import type { ButtonComponent } from "obsidian";

type DestructiveButton = ButtonComponent & {
  setDestructive?: () => ButtonComponent;
};

/** Obsidian 1.13+ exposes setDestructive; older app versions still use setWarning. */
export function styleDestructiveButton(button: ButtonComponent): void {
  const candidate = button as DestructiveButton;
  if (typeof candidate.setDestructive === "function") {
    candidate.setDestructive();
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- fallback for Obsidian < 1.13 where setDestructive is missing
  button.setWarning();
}
