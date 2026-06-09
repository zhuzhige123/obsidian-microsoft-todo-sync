import { describe, expect, it } from "vitest";
import {
  formatDueSegment,
  formatReminderSegment,
  inlineFromGraphReminder,
  parseInlineTaskDateTime,
  reminderIsoFromInline,
} from "./task-datetime";

describe("task-datetime", () => {
  it("parses due date with time on the same emoji", () => {
    expect(parseInlineTaskDateTime("- [ ] Meet 📅 2026-06-10 14:00")).toEqual({
      dueDate: "2026-06-10",
      dueTime: "14:00",
    });
  });

  it("parses separate reminder emoji", () => {
    expect(
      parseInlineTaskDateTime("- [ ] Meet ⏰ 10:00 📅 2026-06-17")
    ).toEqual({
      reminderTime: "10:00",
      dueDate: "2026-06-17",
    });
  });

  it("builds reminder iso from inline fields", () => {
    expect(
      reminderIsoFromInline({ dueDate: "2026-06-10", dueTime: "14:00" })
    ).toBe("2026-06-10T14:00");
    expect(
      reminderIsoFromInline({ dueDate: "2026-06-17", reminderTime: "10:00" })
    ).toBe("2026-06-17T10:00");
  });

  it("maps graph reminder back to inline fields", () => {
    expect(
      inlineFromGraphReminder("2026-06-10", "2026-06-10T14:00:00.0000000")
    ).toEqual({ dueDate: "2026-06-10", dueTime: "14:00" });
    expect(
      inlineFromGraphReminder(
        "2026-06-17",
        "2026-06-16T10:00:00.0000000"
      )
    ).toEqual({
      dueDate: "2026-06-17",
      reminderDate: "2026-06-16",
      reminderTime: "10:00",
    });
  });

  it("formats segments for vault lines", () => {
    expect(formatDueSegment("2026-06-10", "14:00")).toBe("📅 2026-06-10 14:00");
    expect(formatReminderSegment("2026-06-16", "10:00")).toBe("⏰ 2026-06-16 10:00");
    expect(formatReminderSegment(undefined, "10:00")).toBe("⏰ 10:00");
  });
});
