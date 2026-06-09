import type { App } from "obsidian";
import { AUTH_REFRESH_TOKEN_KEY } from "../config/constants";

type SecretStorageApi = {
  getSecret(id: string): string | null;
  setSecret(id: string, secret: string): void;
};

function resolveSecretStorage(app: App): SecretStorageApi | null {
  const storage = app.secretStorage as Partial<SecretStorageApi> | undefined;
  if (typeof storage?.getSecret !== "function" || typeof storage?.setSecret !== "function") {
    return null;
  }
  return storage as SecretStorageApi;
}

export async function loadRefreshToken(app: App): Promise<string | null> {
  try {
    const storage = resolveSecretStorage(app);
    if (!storage) {
      return null;
    }
    const token = storage.getSecret(AUTH_REFRESH_TOKEN_KEY);
    if (typeof token !== "string") {
      return null;
    }
    const trimmed = token.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

export async function saveRefreshToken(app: App, refreshToken: string): Promise<void> {
  const storage = resolveSecretStorage(app);
  if (!storage) {
    throw new Error("SecretStorage requires Obsidian 1.11.4 or later.");
  }
  storage.setSecret(AUTH_REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearRefreshToken(app: App): Promise<void> {
  try {
    const storage = resolveSecretStorage(app);
    if (!storage) {
      return;
    }
    storage.setSecret(AUTH_REFRESH_TOKEN_KEY, "");
  } catch {
    // Already removed or storage unavailable.
  }
}
