import { describe, it, expect } from "vitest";
import { recentCommits } from "./git-recent";
import { computeWeight } from "./weight";
import { DEFAULT_STATE } from "./state";

describe("integration", () => {
  it("HomeFeed-style single-log claim is LOW weight", () => {
    // The HomeFeed-elevation failure mode: a single fresh source from one log
    // gets called "the biggest retention move". With G1 in place, that claim
    // would be classified LOW and surfaced with "single-source signal —
    // needs corroboration" rather than promoted to differentiator.
    const claim = computeWeight({
      sources: [{ date: "2026-05-11", round: "qual_4", sourceType: "direct-quote" }],
      contradictedBy: 0,
      asOf: "2026-05-12",
    });
    expect(claim.bucket).toBe("LOW");
  });

  it("git-recent returns a typed array on the current repo", () => {
    const commits = recentCommits(null, "staging");
    expect(Array.isArray(commits)).toBe(true);
    for (const c of commits) {
      expect(typeof c.sha).toBe("string");
      expect(typeof c.type).toBe("string");
      expect(c.skip).toBe(false);
    }
  });

  it("default state uses zero-epoch last_run_at", () => {
    expect(DEFAULT_STATE.last_run_at).toBe(new Date(0).toISOString());
  });
});
