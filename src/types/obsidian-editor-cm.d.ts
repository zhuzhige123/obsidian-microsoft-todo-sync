type Cm6EditorView = {
  dispatch: (spec?: Record<string, never>) => void;
  state: { doc: { line: (n: number) => { from: number; to: number } } };
  coordsAtPos?: (pos: number) => { top: number; left: number; bottom: number; right: number } | null;
  domAtPos?: (pos: number) => { node: Node; offset: number };
};

declare module "obsidian" {
  interface Editor {
    /** CodeMirror 6 EditorView instance (Obsidian internal). */
    cm?: Cm6EditorView;
  }
}

export {};
