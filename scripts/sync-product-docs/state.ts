import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pid } from "node:process";

export interface SyncState {
  last_run_at: string;
  last_discovery_at: string | null;
  last_synced_commit_sha: string | null;
  notion_source_ids: Record<string, string>;
  research_sources_seen: string[];
  gtm_log_seen_signatures: string[];
  weight_audit_version: number;
}

export const DEFAULT_STATE: SyncState = {
  last_run_at: new Date(0).toISOString(),
  last_discovery_at: null,
  last_synced_commit_sha: null,
  notion_source_ids: {},
  research_sources_seen: [],
  gtm_log_seen_signatures: [],
  weight_audit_version: 1,
};

function statePath(): string {
  return process.env.SYNC_PRODUCT_DOCS_STATE_PATH ?? join(homedir(), ".claude", "sync-product-docs-state.json");
}

export async function loadState(): Promise<SyncState | null> {
  const path = statePath();
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SyncState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse state file at ${path}: ${message}`);
  }
}

export async function saveState(state: SyncState): Promise<void> {
  const path = statePath();
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const tmp = `${path}.tmp.${pid}`;
  await writeFile(tmp, JSON.stringify(state, null, 2));
  await rename(tmp, path);
}
