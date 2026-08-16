/**
 * Default Entra app used by Simple Microsoft To Do (PKCE + obsidian:// redirect).
 * Override in settings with your own app registration if needed.
 */
export const DEFAULT_OAUTH_CLIENT_ID = "28d3e5ae-00e3-4ff6-9443-742f353cf511";

export const OAUTH_REDIRECT_URI = "obsidian://mstodo-auth";

export const AUTH_PROTOCOL_NAME = "mstodo-auth";

export const GRAPH_SCOPES = ["Tasks.ReadWrite", "User.Read", "offline_access"];

export const GRAPH_SCOPE_STRING = GRAPH_SCOPES.join(" ");

/** secretStorage key for OAuth refresh token */
export const AUTH_REFRESH_TOKEN_KEY = "mtd-ms-refresh-token";

export const PROTOCOL_NAME = "mtd-sync";

export const BACKLINK_SEPARATOR = "---";
