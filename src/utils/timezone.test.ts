import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fromGraphDateTimeTimeZone,
  getOutlookTimezonePreferHeader,
  normalizeGraphLocalDateTime,
} from "./timezone";

describe("timezone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes date and time for Graph", () => {
    expect(normalizeGraphLocalDateTime("2026-06-10T12:00")).toBe(
      "2026-06-10T12:00:00.0000000"
    );
    expect(normalizeGraphLocalDateTime("2026-06-10")).toBe("2026-06-10T09:00:00.0000000");
  });

  it("builds Prefer outlook.timezone header from local zone", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "Asia/Shanghai",
    });
    expect(getOutlookTimezonePreferHeader()).toBe(
      'outlook.timezone="China Standard Time"'
    );
  });

  it("converts UTC Graph reminder to local wall clock", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "Asia/Shanghai",
    });
    expect(
      fromGraphDateTimeTimeZone({
        dateTime: "2026-06-10T15:00:00.0000000",
        timeZone: "UTC",
      })
    ).toBe("2026-06-10T23:00");
  });

  it("keeps wall clock when Graph already returned the local Windows zone", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "Asia/Shanghai",
    });
    expect(
      fromGraphDateTimeTimeZone({
        dateTime: "2026-06-10T23:00:00.0000000",
        timeZone: "China Standard Time",
      })
    ).toBe("2026-06-10T23:00");
  });

  it("shifts due-date midnight UTC into the correct local calendar day", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "Asia/Shanghai",
    });
    expect(
      fromGraphDateTimeTimeZone({
        dateTime: "2026-04-14T16:00:00.0000000",
        timeZone: "UTC",
      })?.slice(0, 10)
    ).toBe("2026-04-15");
  });
});
