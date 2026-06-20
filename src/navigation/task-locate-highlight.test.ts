import type { Editor } from "obsidian";
import { describe, expect, it, vi } from "vitest";

vi.mock("./task-locate-editor-extension", () => ({
  requestEditorLocateLineHighlight: vi.fn(() => true),
}));

import { requestEditorLocateLineHighlight } from "./task-locate-editor-extension";
import { highlightEditorLineWithCm } from "./task-locate-highlight";

describe("highlightEditorLineWithCm", () => {
  it("delegates to the CM6 locate highlight helper", () => {
    const editor = {
      cm: {
        state: {
          doc: {
            line: (n: number) => ({ from: n * 10, to: n * 10 + 5 }),
          },
        },
      },
    } as unknown as Editor;

    expect(highlightEditorLineWithCm(editor, 18, 2600)).toBe(true);
    expect(requestEditorLocateLineHighlight).toHaveBeenCalledWith(editor, 18, 2600);
  });

  it("returns false when CM6 editor view is unavailable", () => {
    const editor = {} as Editor;
    expect(highlightEditorLineWithCm(editor, 0)).toBe(false);
  });

  it("returns false for out-of-range lines", () => {
    const editor = {
      cm: {
        state: {
          doc: {
            line: () => {
              throw new Error("Invalid line");
            },
          },
        },
      },
    } as unknown as Editor;
    expect(highlightEditorLineWithCm(editor, 999)).toBe(false);
  });
});
