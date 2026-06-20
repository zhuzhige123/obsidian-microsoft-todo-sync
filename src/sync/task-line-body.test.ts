import { describe, expect, it } from "vitest";
import { formatTaskLineBody } from "./task-line-body";

describe("formatTaskLineBody", () => {
  it("includes due date, priority, and completion emoji", () => {
    const body = formatTaskLineBody({
      title: "Review deck",
      tags: ["#mtd-sync"],
      checkbox: "x",
      dueDate: "2026-06-12",
      priority: "high",
      doneDate: "2026-06-12",
    });
    expect(body).toContain("#mtd-sync");
    expect(body).toContain("📅 2026-06-12");
    expect(body).toContain("⏫");
    expect(body).toContain("✅ 2026-06-12");
  });

  it("includes scheduled and start dates", () => {
    const body = formatTaskLineBody({
      title: "Plan sprint",
      tags: ["#mtd-sync/work"],
      checkbox: " ",
      scheduledDate: "2026-06-10",
      startDate: "2026-06-08",
    });
    expect(body).toContain("⏳ 2026-06-10");
    expect(body).toContain("🛫 2026-06-08");
  });
});
