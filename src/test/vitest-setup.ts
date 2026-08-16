/**
 * Obsidian production code uses `window` / `activeWindow` (not `globalThis`).
 * Vitest runs in Node — mirror those globals onto the Node realm for unit tests.
 */
import { webcrypto } from "node:crypto";

const runtime = globalThis as typeof globalThis & {
  window?: unknown;
  activeWindow?: unknown;
  crypto?: Crypto;
};

runtime.window = runtime;
runtime.activeWindow = runtime;

if (!runtime.crypto?.randomUUID || !runtime.crypto?.subtle) {
  runtime.crypto = webcrypto as Crypto;
}
