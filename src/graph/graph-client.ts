import { requestUrl } from "obsidian";
import type { MsAuthService } from "../auth/ms-auth-service";
import { getOutlookTimezonePreferHeader } from "../utils/timezone";

const MAX_RETRIES = 3;
const RETRY_STATUSES = new Set([429, 503]);
const RETRY_BASE_MS = 1000;

export class GraphApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly responseText: string
  ) {
    super(`Graph ${method} ${path} failed (${status}): ${responseText}`);
    this.name = "GraphApiError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export class GraphClient {
  constructor(private readonly auth: MsAuthService) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.requestWithRetry<T>(method, path, body, false);
  }

  async requestRawUrl<T>(method: string, url: string, body?: unknown): Promise<T> {
    return this.requestWithRetry<T>(method, url, body, true);
  }

  private async requestWithRetry<T>(
    method: string,
    pathOrUrl: string,
    body?: unknown,
    isFullUrl = false
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await this.requestOnce<T>(method, pathOrUrl, body, isFullUrl);
      } catch (error) {
        lastError = error;
        if (
          error instanceof GraphApiError &&
          RETRY_STATUSES.has(error.status) &&
          attempt < MAX_RETRIES
        ) {
          await sleep(RETRY_BASE_MS * 2 ** attempt);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  private async requestOnce<T>(
    method: string,
    pathOrUrl: string,
    body?: unknown,
    isFullUrl = false
  ): Promise<T> {
    const token = await this.auth.getAccessToken();
    const url = isFullUrl ? pathOrUrl : `https://graph.microsoft.com/v1.0${pathOrUrl}`;
    const response = await requestUrl({
      url,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: getOutlookTimezonePreferHeader(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      throw: false,
    });

    if (response.status >= 400) {
      throw new GraphApiError(response.status, method, pathOrUrl, response.text);
    }

    if (response.status === 204 || response.text.trim() === "") {
      return undefined as T;
    }
    return JSON.parse(response.text) as T;
  }

  async requestBinary(method: string, path: string): Promise<ArrayBuffer> {
    const token = await this.auth.getAccessToken();
    const url = path.startsWith("https://")
      ? path
      : `https://graph.microsoft.com/v1.0${path}`;
    const response = await requestUrl({
      url,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      throw: false,
    });

    if (response.status >= 400) {
      throw new GraphApiError(response.status, method, path, response.text);
    }

    return response.arrayBuffer;
  }
}
