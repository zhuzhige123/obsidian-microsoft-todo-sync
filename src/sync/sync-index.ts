import type { SyncIndexEntry } from "../types/sync";

export class SyncIndex {
  constructor(private entries: Record<string, SyncIndexEntry>) {}

  static fromRecord(record: Record<string, SyncIndexEntry> | undefined): SyncIndex {
    return new SyncIndex(record ?? {});
  }

  toRecord(): Record<string, SyncIndexEntry> {
    return { ...this.entries };
  }

  getByMtdId(mtdId: string): SyncIndexEntry | undefined {
    return this.entries[mtdId];
  }

  getByGraphId(graphTaskId: string): SyncIndexEntry | undefined {
    return Object.values(this.entries).find((entry) => entry.graphTaskId === graphTaskId);
  }

  upsert(entry: SyncIndexEntry): void {
    this.entries[entry.mtdId] = entry;
  }

  removeByMtdId(mtdId: string): void {
    delete this.entries[mtdId];
  }

  removeByGraphId(graphTaskId: string): void {
    const entry = this.getByGraphId(graphTaskId);
    if (entry) {
      delete this.entries[entry.mtdId];
    }
  }

  all(): SyncIndexEntry[] {
    return Object.values(this.entries);
  }

  forFile(vaultPath: string): SyncIndexEntry[] {
    return Object.values(this.entries).filter((entry) => entry.vaultPath === vaultPath);
  }
}
