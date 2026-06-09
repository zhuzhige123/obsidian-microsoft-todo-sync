/* Obsidian plugins must load CodeMirror through the app-patched require()
   so extensions use the same @codemirror/state instance as the editor. */

type CmViewModule = typeof import("@codemirror/view");
type CmStateModule = typeof import("@codemirror/state");

export function loadCmViewModule(): CmViewModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- Obsidian CM6 bridge
  return require("@codemirror/view") as CmViewModule;
}

export function loadCmStateModule(): CmStateModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- Obsidian CM6 bridge
  return require("@codemirror/state") as CmStateModule;
}
