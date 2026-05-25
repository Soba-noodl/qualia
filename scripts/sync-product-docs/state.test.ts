import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadState, saveState, DEFAULT_STATE, type SyncState } from "./state";
import { existsSync } from "node:fs";
import { unlink, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const TEST_PATH = join(tmpdir(), `sync-product-docs-state-test-${Date.now()}.json`);

describe("state", () => {
  let currentPath = TEST_PATH;

  beforeEach(() => {
    currentPath = TEST_PATH;
    process.env.SYNC_PRODUCT_DOCS_STATE_PATH = TEST_PATH;
  });

  afterEach(async () => {
    if (existsSync(currentPath)) await unlink(currentPath);
    const dir = dirname(currentPath);
    if (currentPath !== TEST_PATH && existsSync(dir)) {
      await rmdir(dir).catch(() => {/* ignore if not empty */});
    }
    delete process.env.SYNC_PRODUCT_DOCS_STATE_PATH;
  });

  it("returns null when no state file exists", async () => {
    const state = await loadState();
    expect(state).toBeNull();
  });

  it("saves and reloads state preserving fields", async () => {
    const state: SyncState = {
      ...DEFAULT_STATE,
      last_synced_commit_sha: "abc123",
      notion_source_ids: { research_db: "uuid-here" },
      research_sources_seen: ["page-uuid-1", "page-uuid-2"],
      gtm_log_seen_signatures: ["hash-1", "hash-2"],
    };
    await saveState(state);
    const loaded = await loadState();
    expect(loaded?.last_synced_commit_sha).toBe("abc123");
    expect(loaded?.notion_source_ids.research_db).toBe("uuid-here");
    expect(loaded?.research_sources_seen).toEqual(["page-uuid-1", "page-uuid-2"]);
    expect(loaded?.gtm_log_seen_signatures).toEqual(["hash-1", "hash-2"]);
  });

  it("creates parent directory if missing", async () => {
    const nestedPath = join(tmpdir(), `nested-${Date.now()}`, "state.json");
    currentPath = nestedPath;
    process.env.SYNC_PRODUCT_DOCS_STATE_PATH = nestedPath;
    await saveState(DEFAULT_STATE);
    const loaded = await loadState();
    expect(loaded).not.toBeNull();
  });

  it("throws with path context when state file is malformed JSON", async () => {
    await writeFile(TEST_PATH, "{ not json");
    await expect(loadState()).rejects.toThrow(TEST_PATH);
  });

  it("backfills missing fields from DEFAULT_STATE for older state files", async () => {
    const legacy = {
      last_run_at: "2026-01-01T00:00:00.000Z",
      last_discovery_at: null,
      last_synced_commit_sha: "old-sha",
      notion_source_ids: { research_db: "uuid" },
      research_sources_seen: ["page-1"],
      weight_audit_version: 1,
    };
    await writeFile(TEST_PATH, JSON.stringify(legacy));
    const loaded = await loadState();
    expect(loaded?.gtm_log_seen_signatures).toEqual([]);
    expect(loaded?.last_synced_commit_sha).toBe("old-sha");
    expect(loaded?.research_sources_seen).toEqual(["page-1"]);
  });
});
