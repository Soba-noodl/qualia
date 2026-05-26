import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  saveLlmKey,
  testLlmKey,
  deleteLlmKey,
  setDefaultLlmProvider,
} from "./llm-key.service";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

const originalFetch = globalThis.fetch;

describe("llm-key.service", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { session: { access_token: "test-token-abc" } },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("saveLlmKey POSTs to manage-llm-key with action=save + provider + api_key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await saveLlmKey("gemini", "AIza-test-key");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer test-token-abc");
    expect(JSON.parse(opts.body)).toEqual({
      action: "save",
      provider: "gemini",
      api_key: "AIza-test-key",
      model_override: undefined,
    });
  });

  it("testLlmKey POSTs action=test with provider only", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await testLlmKey("openai");

    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({
      action: "test",
      provider: "openai",
    });
  });

  it("deleteLlmKey POSTs action=delete with provider only", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "deleted" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await deleteLlmKey("openai");

    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({
      action: "delete",
      provider: "openai",
    });
  });

  it("setDefaultLlmProvider POSTs action=set-default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await setDefaultLlmProvider("gemini");

    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({
      action: "set-default",
      provider: "gemini",
    });
  });

  it("throws when there is no auth session", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { session: null },
    });

    await expect(saveLlmKey("gemini", "k")).rejects.toThrow("Not authenticated");
  });

  it("throws on non-OK response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "server boom" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(saveLlmKey("gemini", "k")).rejects.toThrow();
  });
});
