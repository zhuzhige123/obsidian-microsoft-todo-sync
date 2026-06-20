import type { SyncIndexEntry } from "../types/sync";

export class SyncIndex {
  private readonly graphIdToMtdId = new Map<string, string>();

  constructor(private entries: Record<string, SyncIndexEntry>) {
    this.rebuildGraphIndex();
  }

  static fromRecord(record: Record<string, SyncIndexEntry> | undefined): SyncIndex {
    return new SyncIndex(record ?? {});
  }

  toRecord(): Record<string, SyncIndexEntry> {
    return { ...this.entries };
  }

  /** Merge entries from another snapshot (e.g. index repair during a sync op). */
  importEntries(record: Record<string, SyncIndexEntry>): void {
    for (const [mtdId, entry] of Object.entries(record)) {
      this.upsert({ ...entry, mtdId });
    }
  }

  getByMtdId(mtdId: string): SyncIndexEntry | undefined {
    return this.entries[mtdId];
  }

  getByGraphId(graphTaskId: string): SyncIndexEntry | undefined {
    const mtdId = this.graphIdToMtdId.get(graphTaskId);
    return mtdId ? this.entries[mtdId] : undefined;
  }

  upsert(entry: SyncIndexEntry): void {
    const previous = this.entries[entry.mtdId];
    if (previous?.graphTaskId && previous.graphTaskId !== entry.graphTaskId) {
      this.graphIdToMtdId.delete(previous.graphTaskId);
    }
    if (entry.graphTaskId) {
      const otherMtdId = this.graphIdToMtdId.get(entry.graphTaskId);
      if (otherMtdId && otherMtdId !== entry.mtdId) {
        this.removeByMtdId(otherMtdId);
      }
    }
    this.entries[entry.mtdId] = entry;
    if (entry.graphTaskId) {
      this.graphIdToMtdId.set(entry.graphTaskId, entry.mtdId);
    }
  }

  removeByMtdId(mtdId: string): void {
    const entry = this.entries[mtdId];
    if (entry?.graphTaskId) {
      this.graphIdToMtdId.delete(entry.graphTaskId);
    }
    delete this.entries[mtdId];
  }

  removeByGraphId(graphTaskId: string): void {
    const entry = this.getByGraphId(graphTaskId);
    if (entry) {
      this.removeByMtdId(entry.mtdId);
    }
  }

  all(): SyncIndexEntry[] {
    return Object.values(this.entries);
  }

  forFile(vaultPath: string): SyncIndexEntry[] {
    return Object.values(this.entries).filter((entry) => entry.vaultPath === vaultPath);
  }

  private rebuildGraphIndex(): void {
    this.graphIdToMtdId.clear();
    for (const entry of Object.values(this.entries)) {
      if (entry.graphTaskId) {
        this.graphIdToMtdId.set(entry.graphTaskId, entry.mtdId);
      }
    }
  }
}
