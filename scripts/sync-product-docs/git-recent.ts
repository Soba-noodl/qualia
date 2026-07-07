import { execFileSync } from "node:child_process";

export interface ParsedCommit {
  sha: string;
  date: string;
  subject: string;
}

export interface ClassifiedCommit extends ParsedCommit {
  type: "feat" | "fix" | "refactor" | "chore" | "docs" | "merge" | "other";
  skip: boolean;
}

export function parseCommitLine(line: string): ParsedCommit | null {
  const parts = line.split("|");
  if (parts.length < 3) return null;
  const [sha, date, ...rest] = parts;
  const subject = rest.join("|");
  if (!sha || !date || !subject) return null;
  return { sha: sha.trim(), date: date.trim(), subject: subject.trim() };
}

export function classifyCommit(subject: string): { type: ClassifiedCommit["type"]; skip: boolean } {
  if (/^Merge\b/i.test(subject)) return { type: "merge", skip: true };
  const m = subject.match(/^(feat|fix|refactor|chore|docs)(\([^)]+\))?:/i);
  if (!m) return { type: "other", skip: true };
  const type = m[1].toLowerCase() as ClassifiedCommit["type"];
  const skip = type === "chore" || type === "docs";
  return { type, skip };
}

export function collapsePartSeries(commits: ClassifiedCommit[]): ClassifiedCommit[] {
  const seriesPattern = /part\s+\d+\/(\d+)/i;
  const seen = new Set<string>();
  const out: ClassifiedCommit[] = [];
  for (const c of commits) {
    const m = c.subject.match(seriesPattern);
    if (!m) {
      out.push(c);
      continue;
    }
    const key = c.subject.replace(seriesPattern, "").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    const subject = c.subject.replace(seriesPattern, "").replace(/\s+/g, " ").trim();
    out.push({ ...c, subject });
  }
  return out;
}

function runGit(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf-8" });
}

export function recentCommits(sinceSha: string | null, branch = "staging"): ClassifiedCommit[] {
  const rangeArg = sinceSha ? `${sinceSha}..${branch}` : branch;
  const args = ["log", rangeArg, "--pretty=format:%h|%ad|%s", "--date=short", "--no-merges"];
  let stdout: string;
  try {
    stdout = runGit(args);
  } catch (err) {
    const stderr = (err && typeof err === "object" && "stderr" in err)
      ? String((err as { stderr: unknown }).stderr ?? "")
      : "";
    const looksLikeBadRev = /unknown revision|bad revision|bad object|ambiguous argument/i.test(stderr);
    if (!looksLikeBadRev) throw err;
    process.stderr.write(`git-recent: falling back to --since=30 days ago (sinceSha may be missing)\n`);
    stdout = runGit(["log", branch, "--pretty=format:%h|%ad|%s", "--date=short", "--since=30 days ago", "--no-merges"]);
  }
  const parsed = stdout.split("\n").map(parseCommitLine).filter((c): c is ParsedCommit => c !== null);
  const classified: ClassifiedCommit[] = parsed.map((p) => ({ ...p, ...classifyCommit(p.subject) }));
  const kept = classified.filter((c) => !c.skip);
  return collapsePartSeries(kept);
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")))
) {
  const sinceSha = process.argv[2] || null;
  const branch = process.argv[3] || "staging";
  const commits = recentCommits(sinceSha, branch);
  console.log(JSON.stringify(commits, null, 2));
}
