import { requestUrl, type App } from "obsidian";
import {
  DEFAULT_OAUTH_CLIENT_ID,
  GRAPH_SCOPE_STRING,
  OAUTH_REDIRECT_URI,
} from "../config/constants";
import type { AuthState, LegacyAuthState } from "../types/sync";
import { clearRefreshToken, loadRefreshToken, saveRefreshToken } from "./auth-secret-storage";
import { generateCodeChallenge, generateCodeVerifier } from "./ms-pkce";

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export interface AuthChangeEvent {
  auth: AuthState | null;
}

export class MsAuthService {
  private authState: AuthState | null = null;
  private pkceVerifier: string | null = null;

  constructor(
    private readonly app: App,
    private readonly getClientId: () => string,
    private readonly getTenant: () => string,
    private readonly onAuthChange: (event: AuthChangeEvent) => Promise<void>
  ) {}

  get isLoggedIn(): boolean {
    return Boolean(this.authState?.refreshToken);
  }

  /** Loads refresh token from secretStorage; migrates legacy data.json auth when present. */
  async hydrateFromStorage(legacyAuth?: LegacyAuthState): Promise<boolean> {
    let refreshToken = await loadRefreshToken(this.app);
    let migrated = false;

    if (!refreshToken && legacyAuth?.refreshToken) {
      await saveRefreshToken(this.app, legacyAuth.refreshToken);
      refreshToken = legacyAuth.refreshToken;
      migrated = true;
    }

    if (refreshToken) {
      this.authState = {
        refreshToken,
        accessToken: "",
        expiresAt: 0,
      };
    }

    return migrated;
  }

  async logout(): Promise<void> {
    this.authState = null;
    this.pkceVerifier = null;
    await clearRefreshToken(this.app);
    await this.onAuthChange({ auth: null });
  }

  async startBrowserLogin(): Promise<void> {
    const clientId = this.resolveClientId();
    const tenant = this.getTenant() || "common";
    this.pkceVerifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(this.pkceVerifier);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: OAUTH_REDIRECT_URI,
      response_mode: "query",
      scope: GRAPH_SCOPE_STRING,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
    globalThis.window.open(url);
  }

  async completeLogin(code: string): Promise<void> {
    if (!this.pkceVerifier) {
      throw new Error("Missing PKCE verifier. Start sign-in again.");
    }

    const clientId = this.resolveClientId();
    const tenant = this.getTenant() || "common";
    const body = new URLSearchParams({
      client_id: clientId,
      scope: GRAPH_SCOPE_STRING,
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: this.pkceVerifier,
    });

    const response = await requestUrl({
      url: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const token = JSON.parse(response.text) as TokenResponse;
    if (!token.access_token) {
      throw new Error(token.error_description ?? token.error ?? "Token exchange failed");
    }

    const refreshToken = token.refresh_token ?? "";
    if (!refreshToken) {
      throw new Error("No refresh token returned. Check offline_access scope.");
    }

    await saveRefreshToken(this.app, refreshToken);
    this.authState = {
      accessToken: token.access_token,
      refreshToken,
      expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    };
    this.pkceVerifier = null;
    await this.onAuthChange({ auth: this.authState });
  }

  async getAccessToken(): Promise<string> {
    if (!this.authState?.refreshToken) {
      throw new Error("Not signed in");
    }

    if (this.authState.accessToken && Date.now() < this.authState.expiresAt - 5 * 60_000) {
      return this.authState.accessToken;
    }

    const clientId = this.resolveClientId();
    const tenant = this.getTenant() || "common";
    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: this.authState.refreshToken,
      scope: GRAPH_SCOPE_STRING,
    });

    const response = await requestUrl({
      url: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const token = JSON.parse(response.text) as TokenResponse;
    if (!token.access_token) {
      throw new Error(token.error_description ?? token.error ?? "Token refresh failed");
    }

    const refreshToken = token.refresh_token ?? this.authState.refreshToken;
    if (refreshToken !== this.authState.refreshToken) {
      await saveRefreshToken(this.app, refreshToken);
    }

    this.authState = {
      ...this.authState,
      accessToken: token.access_token,
      refreshToken,
      expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    };
    await this.onAuthChange({ auth: this.authState });
    return this.authState.accessToken;
  }

  private resolveClientId(): string {
    return this.getClientId().trim() || DEFAULT_OAUTH_CLIENT_ID;
  }

}
