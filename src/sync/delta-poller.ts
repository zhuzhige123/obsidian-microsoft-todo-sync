import type { Plugin } from "obsidian";

export class DeltaPoller {
  private intervalId: number | null = null;

  start(plugin: Plugin, intervalMs: number, tick: () => void): void {
    this.stop();
    const id = window.setInterval(tick, intervalMs);
    this.intervalId = id;
    plugin.registerInterval(id);
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
