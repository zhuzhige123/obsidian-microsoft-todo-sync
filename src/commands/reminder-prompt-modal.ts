import { Modal, Setting, type App } from "obsidian";
import type { MtdStrings } from "../i18n/types";

export class ReminderPromptModal extends Modal {
  private value = "";

  constructor(
    app: App,
    private readonly strings: MtdStrings["commands"],
    private readonly onSubmit: (value: string) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.strings.setReminderPromptTitle);
    contentEl.createEl("p", { text: this.strings.setReminderPromptDesc });

    new Setting(contentEl)
      .setName(this.strings.setReminderInputName)
      .addText((text) => {
        text.setPlaceholder(this.strings.setReminderPlaceholder);
        text.onChange((value) => {
          this.value = value;
        });
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            this.close();
            this.onSubmit(this.value);
          }
        });
      });

    new Setting(contentEl).addButton((button) => {
      button.setButtonText(this.strings.setReminderConfirm);
      button.setCta();
      button.onClick(() => {
        this.close();
        this.onSubmit(this.value);
      });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
