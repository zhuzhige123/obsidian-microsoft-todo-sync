import { describe, expect, it } from "vitest";
import { SyncQueue } from "./sync-queue";

describe("SyncQueue", () => {
  it("runs jobs serially", async () => {
    const queue = new SyncQueue();
    const order: number[] = [];

    const first = queue.enqueue(async () => {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
      order.push(1);
    });
    const second = queue.enqueue(async () => {
      order.push(2);
    });

    await Promise.all([first, second]);
    expect(order).toEqual([1, 2]);
  });

  it("tracks busy state", async () => {
    const queue = new SyncQueue();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const job = queue.enqueue(async () => {
      await gate;
    });
    expect(queue.busy).toBe(true);
    release();
    await job;
    expect(queue.busy).toBe(false);
  });
});
