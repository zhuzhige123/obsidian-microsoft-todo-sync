import { afterEach, describe, expect, it, vi } from "vitest";
import { graphTaskToObsidianPatch, toGraphReminder } from "./field-mapper";

describe("field-mapper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses local wall time without UTC shift", () => {
    const result = toGraphReminder("2026-06-10T12:00");
    expect(result.isReminderOn).toBe(true);
    expect(result.reminderDateTime?.dateTime).toBe("2026-06-10T12:00:00.0000000");
    expect(result.reminderDateTime?.timeZone).not.toBe("UTC");
  });

  it("maps UTC Graph reminder into local wall-clock time", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "Asia/Shanghai",
    });

    // Mobile To Do: due 2026-06-10, reminder 23:00 CST → Graph default UTC payload.
    const patch = graphTaskToObsidianPatch(
      {
        id: "g1",
        title: "Phone task",
        isReminderOn: true,
        dueDateTime: {
          dateTime: "2026-06-09T16:00:00.0000000",
          timeZone: "UTC",
        },
        reminderDateTime: {
          dateTime: "2026-06-10T15:00:00.0000000",
          timeZone: "UTC",
        },
      },
      { scheduledMapsToStart: true }
    );

    expect(patch.dueDate).toBe("2026-06-10");
    expect(patch.dueTime).toBe("23:00");
    expect(patch.reminderDate).toBeUndefined();
    expect(patch.reminderTime).toBeUndefined();
  });
});
