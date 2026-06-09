import { describe, expect, it } from "vitest";
import type { App } from "obsidian";
import { AUTH_REFRESH_TOKEN_KEY } from "../config/constants";
import { clearRefreshToken, loadRefreshToken, saveRefreshToken } from "./auth-secret-storage";

function createMockApp(): App {
  const store = new Map<string, string>();
  return {
    secretStorage: {
      getSecret: (key: string) => store.get(key) ?? null,
      setSecret: (key: string, value: string) => {
        store.set(key, value);
      },
      listSecrets: () => [...store.keys()],
    },
  } as unknown as App;
}

describe("auth-secret-storage", () => {
  it("persists and clears refresh token", async () => {
    const app = createMockApp();
    expect(await loadRefreshToken(app)).toBeNull();
    await saveRefreshToken(app, "refresh-abc");
    expect(await loadRefreshToken(app)).toBe("refresh-abc");
    await clearRefreshToken(app);
    expect(await loadRefreshToken(app)).toBeNull();
  });

  it("uses the configured secretStorage key", async () => {
    const app = createMockApp();
    await saveRefreshToken(app, "token");
    expect(await loadRefreshToken(app)).toBe("token");
    expect(AUTH_REFRESH_TOKEN_KEY).toBe("mtd-ms-refresh-token");
  });
});
