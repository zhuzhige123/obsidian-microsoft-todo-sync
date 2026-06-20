import { describe, expect, it } from "vitest";
import { computeTaskBadgeHints } from "./task-badges";

describe("task-badges", () => {
  it("derives reminder and myday badges from line text", () => {
    const hints = computeTaskBadgeHints(
      '- [ ] Task ⏰ 14:30 #mtd-sync <!-- mtd:id=a myday reminder=2026-06-12T14:30 -->',
      "Today"
    );
    expect(hints.reminderLabel).toBeUndefined();
    expect(hints.myDayLabel).toBe("Today");
  });

  it("adds reminder badge when time is only in mtd comment", () => {
    const hints = computeTaskBadgeHints(
      '- [ ] Task #mtd-sync <!-- mtd:id=a reminder=2026-06-12T14:30 -->',
      "Today"
    );
    expect(hints.reminderLabel).toBe("⏰14:30");
  });
});
