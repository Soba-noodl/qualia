import { describe, it, expect } from "vitest";
import { parseCommitLine, classifyCommit, collapsePartSeries, type ClassifiedCommit } from "./git-recent";

describe("parseCommitLine", () => {
  it("parses sha|date|subject format", () => {
    const out = parseCommitLine("abc123|2026-05-12|feat(plugin): add HomeFeed view");
    expect(out).toEqual({
      sha: "abc123",
      date: "2026-05-12",
      subject: "feat(plugin): add HomeFeed view",
    });
  });

  it("returns null on malformed line", () => {
    expect(parseCommitLine("bogus")).toBeNull();
    expect(parseCommitLine("")).toBeNull();
  });
});

describe("classifyCommit", () => {
  it("classifies feat:", () => {
    expect(classifyCommit("feat: add x").type).toBe("feat");
  });
  it("classifies fix(scope):", () => {
    expect(classifyCommit("fix(plugin): repair y").type).toBe("fix");
  });
  it("classifies refactor:", () => {
    expect(classifyCommit("refactor: rename z").type).toBe("refactor");
  });
  it("classifies chore: as skip", () => {
    expect(classifyCommit("chore: bump deps").skip).toBe(true);
  });
  it("classifies docs: as skip", () => {
    expect(classifyCommit("docs: update readme").skip).toBe(true);
  });
  it("classifies merge as skip", () => {
    expect(classifyCommit("Merge branch 'foo' into bar").skip).toBe(true);
  });
});

describe("collapsePartSeries", () => {
  it("collapses UX-D-PROJECT-003 part 1..4 into one entry", () => {
    const commits: ClassifiedCommit[] = [
      { sha: "a", date: "2026-05-11", subject: "fix(ux): quota part 1/4 (UX-D-PROJECT-003)", type: "fix", skip: false },
      { sha: "b", date: "2026-05-11", subject: "fix(ux): quota part 2/4 (UX-D-PROJECT-003)", type: "fix", skip: false },
      { sha: "c", date: "2026-05-11", subject: "fix(ux): quota part 3/4 (UX-D-PROJECT-003)", type: "fix", skip: false },
      { sha: "d", date: "2026-05-11", subject: "fix(ux): quota part 4/4 (UX-D-PROJECT-003)", type: "fix", skip: false },
    ];
    const result = collapsePartSeries(commits);
    expect(result.length).toBe(1);
    expect(result[0].subject).toContain("UX-D-PROJECT-003");
    expect(result[0].subject).not.toMatch(/part \d\/\d/);
  });

  it("leaves unrelated commits alone", () => {
    const commits: ClassifiedCommit[] = [
      { sha: "a", date: "2026-05-11", subject: "feat: A", type: "feat", skip: false },
      { sha: "b", date: "2026-05-11", subject: "feat: B", type: "feat", skip: false },
    ];
    const result = collapsePartSeries(commits);
    expect(result.length).toBe(2);
  });

  it("preserves order when series are interleaved with unrelated commits", () => {
    const commits: ClassifiedCommit[] = [
      { sha: "a", date: "2026-05-11", subject: "feat: A", type: "feat", skip: false },
      { sha: "b", date: "2026-05-11", subject: "fix(ux): quota part 1/2 (UX-D-PROJECT-003)", type: "fix", skip: false },
      { sha: "c", date: "2026-05-11", subject: "feat: B", type: "feat", skip: false },
      { sha: "d", date: "2026-05-11", subject: "fix(ux): quota part 2/2 (UX-D-PROJECT-003)", type: "fix", skip: false },
    ];
    const result = collapsePartSeries(commits);
    expect(result.length).toBe(3);
    expect(result[0].subject).toBe("feat: A");
    expect(result[1].subject).toContain("UX-D-PROJECT-003");
    expect(result[1].subject).not.toMatch(/part \d\/\d/);
    expect(result[2].subject).toBe("feat: B");
  });
});
