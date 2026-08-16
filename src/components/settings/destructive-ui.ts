import type { ButtonComponent } from "obsidian";

type DestructiveButton = ButtonComponent & {
  setDestructive?: () => ButtonComponent;
};

type LegacyDestructiveButton = {
  setWarning: () => ButtonComponent;
};

/** Obsidian 1.13+ exposes setDestructive; older app versions still use setWarning. */
export function styleDestructiveButton(button: ButtonComponent): void {
  const candidate = button as DestructiveButton;
  if (typeof candidate.setDestructive === "function") {
    candidate.setDestructive();
    return;
  }
  (button as unknown as LegacyDestructiveButton).setWarning();
}
