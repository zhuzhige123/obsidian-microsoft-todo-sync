import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import { loadRefreshToken } from "./auth-secret-storage";
import { MsAuthService } from "./ms-auth-service";

const requestUrl = vi.fn();

vi.mock("obsidian", () => ({
  requestUrl: (...args: unknown[]) => requestUrl(...args),
}));

function createApp(): App {
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

describe("MsAuthService", () => {
  let app: App;
  let changes: Array<{ auth: { refreshToken: string } | null }>;

  beforeEach(() => {
    app = createApp();
    changes = [];
    requestUrl.mockReset();
  });

  function createService(): MsAuthService {
    return new MsAuthService(
      app,
      () => "",
      () => "common",
      async (event) => {
        changes.push(event);
      }
    );
  }

  it("migrates legacy refresh token into secretStorage", async () => {
    const service = createService();
    const migrated = await service.hydrateFromStorage({ refreshToken: "legacy-rt" });
    expect(migrated).toBe(true);
    expect(await loadRefreshToken(app)).toBe("legacy-rt");
    expect(service.isLoggedIn).toBe(true);
  });

  it("clears secretStorage on logout", async () => {
    const service = createService();
    await service.hydrateFromStorage({ refreshToken: "legacy-rt" });
    await service.logout();
    expect(await loadRefreshToken(app)).toBeNull();
    expect(service.isLoggedIn).toBe(false);
    expect(changes.at(-1)?.auth).toBeNull();
  });
});
