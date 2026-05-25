import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { renderHook } from "@testing-library/react";
import { useCreateAudit, useAudits } from "@/hooks/use-audits";
import { listAudits } from "@/services/audit.service";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock posthog
vi.mock("@/lib/posthog", () => ({
  posthog: {
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  },
  initPostHog: vi.fn(),
}));

// Mock supabase
let mockAuthStateCallback: ((event: string, session: unknown) => void) | null = null;
// eslint-disable-next-line require-await -- mock default; concrete overrides may not need await
let mockGetSession: () => Promise<{ data: { session: unknown } }> = async () => ({
  data: { session: null },
});

vi.mock("@/services/audit.service", () => ({
  createAudit: vi.fn().mockResolvedValue({ id: "audit-1", status: "pending" }),
  listAudits: vi.fn().mockResolvedValue([]),
  deleteAudit: vi.fn(),
  updateAuditFeedback: vi.fn(),
  transformAudit: (a: unknown) => a,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        mockAuthStateCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import { posthog } from "@/lib/posthog";

function SignOutTrigger({ onReady }: { onReady: (signOut: () => Promise<void>) => void }) {
  const { signOut } = useAuth();
  useEffect(() => { onReady(signOut); }, [signOut, onReady]);
  return null;
}

describe("AuthContext PostHog integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStateCallback = null;
    mockGetSession = async () => ({ data: { session: null } }); // eslint-disable-line require-await -- mock reset
    localStorage.clear();
  });

  it("calls posthog.identify on SIGNED_IN event", async () => {
    const session = { user: { id: "user-123", email: "user@example.com" } };
    render(<AuthProvider>{null}</AuthProvider>);

    // eslint-disable-next-line require-await -- act() wrapper contract; callback may not need await
    await act(async () => {
      mockAuthStateCallback?.("SIGNED_IN", session);
    });

    expect(posthog.identify).toHaveBeenCalledWith("user-123", {
      email: "user@example.com",
    });
  });

  it("calls posthog.identify on session restore", async () => {
    const session = { user: { id: "user-456", email: "restored@example.com" } };
    mockGetSession = async () => ({ data: { session } }); // eslint-disable-line require-await -- mock override

    // eslint-disable-next-line require-await -- act() wrapper contract
    await act(async () => {
      render(<AuthProvider>{null}</AuthProvider>);
    });

    expect(posthog.identify).toHaveBeenCalledWith("user-456", {
      email: "restored@example.com",
    });
  });

  it("calls posthog.reset on sign-out", async () => {
    const session = { user: { id: "user-123", email: "user@example.com" } };
    mockGetSession = async () => ({ data: { session } }); // eslint-disable-line require-await -- mock override

    let triggerSignOut!: () => Promise<void>;

    // eslint-disable-next-line require-await -- act() wrapper contract
    await act(async () => {
      render(
        <AuthProvider>
          <SignOutTrigger onReady={(fn) => { triggerSignOut = fn; }} />
        </AuthProvider>
      );
    });

    await act(async () => {
      await triggerSignOut();
    });

    expect(posthog.reset).toHaveBeenCalledOnce();
  });
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCreateAudit PostHog tracking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("captures audit_started with type=single", async () => {
    const { result } = renderHook(() => useCreateAudit("project-1"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        project_id: "project-1",
        user_id: "user-1",
        screenshot_url: "https://example.com/img.png",
      });
    });

    expect(posthog.capture).toHaveBeenCalledWith("audit_started", {
      audit_type: "single",
      has_personas: false,
      has_screen_context: false,
    });
  });

  it("captures audit_started with type=flow", async () => {
    const { result } = renderHook(() => useCreateAudit("project-1"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        project_id: "project-1",
        user_id: "user-1",
        screenshot_url: "https://example.com/img.png",
        flow_images: ["https://example.com/f1.png"],
      });
    });

    expect(posthog.capture).toHaveBeenCalledWith("audit_started", {
      audit_type: "flow",
      has_personas: false,
      has_screen_context: false,
    });
  });

  it("captures audit_started with type=re-audit", async () => {
    const { result } = renderHook(() => useCreateAudit("project-1"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        project_id: "project-1",
        user_id: "user-1",
        screenshot_url: "https://example.com/img.png",
        follow_up_audit_id: "original-audit-id",
      });
    });

    expect(posthog.capture).toHaveBeenCalledWith("audit_started", {
      audit_type: "re-audit",
      has_personas: false,
      has_screen_context: false,
    });
  });
});

describe("useAudits audit_completed tracking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("captures audit_completed when status transitions to completed", async () => {
    const { listAudits } = await import("@/services/audit.service");
    const processingAudit = {
      id: "audit-1",
      status: "processing" as const,
      flow_images: null,
      follow_up_audit_id: null,
      created_at: new Date().toISOString(),
    };
    const completedAudit = { ...processingAudit, status: "completed" as const };

    vi.mocked(listAudits).mockResolvedValueOnce([processingAudit] as never);

    const { result, rerender } = renderHook(() => useAudits("project-1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    vi.mocked(listAudits).mockResolvedValue([completedAudit] as never);
    rerender();
    await result.current.refetch();

    await waitFor(() => {
      expect(posthog.capture).toHaveBeenCalledWith("audit_completed", {
        audit_type: "single",
      });
    });
  });

  it("does not capture audit_completed on first load when status is already completed", async () => {
    const { listAudits } = await import("@/services/audit.service");
    const completedAudit = {
      id: "audit-2",
      status: "completed" as const,
      flow_images: null,
      follow_up_audit_id: null,
      created_at: new Date().toISOString(),
    };

    vi.mocked(listAudits).mockResolvedValue([completedAudit] as never);

    const { result } = renderHook(() => useAudits("project-1"), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(posthog.capture).not.toHaveBeenCalledWith(
      "audit_completed",
      expect.anything()
    );
  });
});
