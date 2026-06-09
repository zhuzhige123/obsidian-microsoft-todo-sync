import { describe, expect, it } from "vitest";
import { toGraphReminder } from "./field-mapper";

describe("field-mapper", () => {
  it("uses local wall time without UTC shift", () => {
    const result = toGraphReminder("2026-06-10T12:00");
    expect(result.isReminderOn).toBe(true);
    expect(result.reminderDateTime?.dateTime).toBe("2026-06-10T12:00:00.0000000");
    expect(result.reminderDateTime?.timeZone).not.toBe("UTC");
  });
});
