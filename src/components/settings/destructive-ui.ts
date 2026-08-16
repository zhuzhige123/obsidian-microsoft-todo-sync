import type { ButtonComponent } from "obsidian";

/** Match Obsidian warning/danger button styling without calling version-gated Button APIs. */
export function styleDestructiveButton(button: ButtonComponent): void {
  button.buttonEl.addClass("mod-warning");
}
