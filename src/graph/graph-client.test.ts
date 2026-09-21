import { beforeEach, describe, expect, it, vi } from "vitest";
import { GraphApiError, GraphClient } from "./graph-client";

const requestUrl = vi.fn();

vi.mock("obsidian", () => ({
  requestUrl: (...args: unknown[]) => requestUrl(...args),
}));

describe("GraphClient", () => {
  const auth = {
    getAccessToken: vi.fn(async () => "access-token"),
    invalidateAccessToken: vi.fn(),
  };

  beforeEach(() => {
    requestUrl.mockReset();
    auth.getAccessToken.mockClear();
  });

  it("retries on HTTP 429", async () => {
    requestUrl
      .mockResolvedValueOnce({ status: 429, text: "throttled" })
      .mockResolvedValueOnce({ status: 200, text: '{"id":"task-1"}' });

    const client = new GraphClient(auth as never);
    const result = await client.request<{ id: string }>("GET", "/me/todo/lists/x/tasks/y");
    expect(result.id).toBe("task-1");
    expect(requestUrl).toHaveBeenCalledTimes(2);
  });

  it("sends Prefer outlook.timezone so Graph returns local wall clock", async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "Asia/Shanghai",
    });
    requestUrl.mockResolvedValue({ status: 200, text: '{"id":"task-1"}' });

    const client = new GraphClient(auth as never);
    await client.request("GET", "/me/todo/lists/x/tasks/y");

    expect(requestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Prefer: 'outlook.timezone="China Standard Time"',
        }),
      })
    );
    vi.restoreAllMocks();
  });

  it("throws GraphApiError after retries are exhausted", async () => {
    vi.useFakeTimers();
    requestUrl.mockResolvedValue({ status: 503, text: "unavailable" });
    const client = new GraphClient(auth as never);
    const promise = client.request("GET", "/me/todo/lists");
    const assertion = expect(promise).rejects.toBeInstanceOf(GraphApiError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(requestUrl).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
});
