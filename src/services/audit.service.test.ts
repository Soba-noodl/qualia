import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAudit,
  deleteAudit,
  updateAuditReport,
  updateAuditFeedback,
} from "./audit.service";
import type { Audit } from "@/types";

// Mock the Supabase client. Each test sets up the chain it needs by
// pulling the mocked module and assigning method behavior.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// updateAuditFeedback and deleteAudit pull from storage.service for
// screenshot cleanup. Mock it so tests stay focused on audit-table calls.
vi.mock("./storage.service", () => ({
  removeScreenshotPaths: vi.fn().mockResolvedValue(undefined),
}));

const sampleAudit: Audit = {
  id: "audit-123",
  project_id: "proj-456",
  user_id: "user-789",
  screenshot_url: "https://example.com/screenshot.png",
  status: "complete",
  ai_report: null,
  created_at: "2026-05-24T00:00:00Z",
  updated_at: "2026-05-24T00:00:00Z",
} as unknown as Audit;

describe("createAudit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts a row into the audits table with the provided params", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const single = vi.fn().mockResolvedValue({ data: sampleAudit, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ insert });

    await createAudit({
      project_id: "proj-456",
      user_id: "user-789",
      screenshot_url: "https://example.com/screenshot.png",
    });

    expect(supabase.from).toHaveBeenCalledWith("audits");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "proj-456",
        user_id: "user-789",
        screenshot_url: "https://example.com/screenshot.png",
        status: "pending",
      }),
    );
  });

  it("throws when Supabase returns an error", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "RLS violation" } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ insert });

    await expect(
      createAudit({
        project_id: "proj-456",
        user_id: "user-789",
        screenshot_url: "https://example.com/screenshot.png",
      }),
    ).rejects.toThrow();
  });
});

describe("deleteAudit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the row by id", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn().mockReturnValue({ eq });

    // First .from() call is for getReferencedScreenshotPaths; second for the delete.
    // Simpler test: pass an audit with an HTTP-prefixed screenshot so the storage
    // branch is skipped entirely.
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ delete: del });

    await deleteAudit(sampleAudit);

    expect(supabase.from).toHaveBeenCalledWith("audits");
    expect(eq).toHaveBeenCalledWith("id", "audit-123");
  });

  it("propagates DB errors from the delete", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const eq = vi
      .fn()
      .mockResolvedValue({ error: { message: "foreign key violation" } });
    const del = vi.fn().mockReturnValue({ eq });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ delete: del });

    await expect(deleteAudit(sampleAudit)).rejects.toMatchObject({
      message: expect.stringContaining("foreign key"),
    });
  });
});

describe("updateAuditReport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the ai_report column on the audit row", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ update });

    await updateAuditReport("audit-123", { one_big_thing: "Use larger CTAs" });

    expect(supabase.from).toHaveBeenCalledWith("audits");
    expect(update).toHaveBeenCalledWith({
      ai_report: { one_big_thing: "Use larger CTAs" },
    });
    expect(eq).toHaveBeenCalledWith("id", "audit-123");
  });

  it("throws on DB error", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const eq = vi.fn().mockResolvedValue({ error: { message: "perm denied" } });
    const update = vi.fn().mockReturnValue({ eq });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ update });

    await expect(
      updateAuditReport("audit-123", { foo: "bar" }),
    ).rejects.toMatchObject({ message: "perm denied" });
  });
});

describe("updateAuditFeedback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates feedback_rating + feedback_comment columns", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ update });

    await updateAuditFeedback("audit-123", {
      feedback_rating: 4,
      feedback_comment: "Useful",
    });

    expect(supabase.from).toHaveBeenCalledWith("audits");
    expect(update).toHaveBeenCalledWith({
      feedback_rating: 4,
      feedback_comment: "Useful",
    });
    expect(eq).toHaveBeenCalledWith("id", "audit-123");
  });
});
