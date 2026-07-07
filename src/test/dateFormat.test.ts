import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatRelativeTime } from "@/lib/dateFormat";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a relative string for a very recent date", () => {
    const result = formatRelativeTime("2026-04-09T11:59:30Z");
    expect(result).toMatch(/minute|second/i);
  });

  it("returns a relative string for a date 2 days ago", () => {
    const result = formatRelativeTime("2026-04-07T12:00:00Z");
    expect(result).toMatch(/2 days ago/i);
  });

  it("returns a relative string for a date 3 weeks ago", () => {
    const result = formatRelativeTime("2026-03-19T12:00:00Z");
    expect(result).toMatch(/21 days ago|3 weeks ago/i);
  });
});
