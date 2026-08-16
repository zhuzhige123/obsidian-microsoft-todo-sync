/** Serializes sync operations so push and pull never run concurrently. */
export class SyncQueue {
  private chain: Promise<unknown> = Promise.resolve();
  private pending = 0;

  get busy(): boolean {
    return this.pending > 0;
  }

  enqueue<T>(job: () => Promise<T>): Promise<T> {
    this.pending += 1;
    const result = this.chain.then(() => job());
    this.chain = result.then(
      () => undefined,
      () => undefined
    );
    void result.finally(() => {
      this.pending -= 1;
    });
    return result;
  }
}
