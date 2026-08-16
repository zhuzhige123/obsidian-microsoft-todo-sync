import type { Plugin } from "obsidian";

export class DeltaPoller {
  private intervalId: number | null = null;

  start(plugin: Plugin, intervalMs: number, tick: () => void): void {
    this.stop();
    const id = globalThis.setInterval(tick, intervalMs) as unknown as number;
    this.intervalId = id;
    plugin.registerInterval(id);
  }

  stop(): void {
    if (this.intervalId !== null) {
      globalThis.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
