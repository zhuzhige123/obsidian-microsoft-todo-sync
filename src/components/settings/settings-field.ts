import type { TextComponent } from "obsidian";

/** Keep plugin.settings in sync while typing; persist on commit (blur / Enter). */
export function wireTextSetting(
  text: TextComponent,
  read: () => string,
  write: (value: string) => void,
  persist: () => Promise<void>
): () => void {
  text.setValue(read());
  const onInput = () => {
    write(text.getValue());
  };
  text.inputEl.addEventListener("input", onInput);
  text.onChange(async (value) => {
    write(value);
    await persist();
  });
  return () => {
    text.inputEl.removeEventListener("input", onInput);
  };
}
