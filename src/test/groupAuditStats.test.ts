import { describe, it, expect } from "vitest";
import { groupAuditStats } from "@/services/audit.service";

describe("groupAuditStats", () => {
  it("returns count and latest created_at per project", () => {
    const rows = [
      { project_id: "p1", created_at: "2026-04-07T10:00:00Z" },
      { project_id: "p1", created_at: "2026-04-09T10:00:00Z" },
      { project_id: "p2", created_at: "2026-03-01T10:00:00Z" },
    ];
    const stats = groupAuditStats(rows);
    expect(stats.get("p1")).toEqual({ count: 2, lastAuditAt: "2026-04-09T10:00:00Z" });
    expect(stats.get("p2")).toEqual({ count: 1, lastAuditAt: "2026-03-01T10:00:00Z" });
  });

  it("returns empty map for empty input", () => {
    expect(groupAuditStats([]).size).toBe(0);
  });

  it("returns null lastAuditAt when created_at is null", () => {
    const rows = [{ project_id: "p1", created_at: null as unknown as string }];
    const stats = groupAuditStats(rows);
    expect(stats.get("p1")).toEqual({ count: 1, lastAuditAt: null });
  });
});
