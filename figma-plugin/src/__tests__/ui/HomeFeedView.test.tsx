import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeFeedView } from "../../ui/views/HomeFeedView";
import { defaultStore } from "../../ui/store";
import type { AuditListItem } from "../../ui/api";

function makeAudit(overrides: Partial<AuditListItem> = {}): AuditListItem {
  return {
    id: "a1",
    name: "Login screen",
    score: 80,
    type: "single",
    source: "plugin",
    file_key: "k",
    project: { id: "p", name: "Acme" },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("HomeFeedView", () => {
  it("renders Make new audit CTA", () => {
    render(
      <HomeFeedView
        store={{ ...defaultStore, audits: [makeAudit()] }}
        setStore={vi.fn()}
        onOpenAudit={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText("Make new audit")).toBeInTheDocument();
  });

  it("clicking CTA sets view to new-audit", async () => {
    const setStore = vi.fn();
    const user = userEvent.setup();
    render(
      <HomeFeedView
        store={{ ...defaultStore, audits: [makeAudit()] }}
        setStore={setStore}
        onOpenAudit={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    await user.click(screen.getByText("Make new audit"));
    expect(setStore).toHaveBeenCalledWith(expect.objectContaining({ view: "new-audit" }));
  });

  it("renders an AuditCard for each audit", () => {
    render(
      <HomeFeedView
        store={{
          ...defaultStore,
          audits: [makeAudit({ id: "1", name: "A" }), makeAudit({ id: "2", name: "B" })],
        }}
        setStore={vi.fn()}
        onOpenAudit={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("clicking an audit calls onOpenAudit with id", async () => {
    const user = userEvent.setup();
    const onOpenAudit = vi.fn();
    render(
      <HomeFeedView
        store={{ ...defaultStore, audits: [makeAudit({ id: "x1", name: "Tap me" })] }}
        setStore={vi.fn()}
        onOpenAudit={onOpenAudit}
        onRefresh={vi.fn()}
      />,
    );
    await user.click(screen.getByText("Tap me"));
    expect(onOpenAudit).toHaveBeenCalledWith("x1");
  });

  it("renders skeletons when loading and no audits yet", () => {
    render(
      <HomeFeedView
        store={{ ...defaultStore, audits: [], auditsLoading: true }}
        setStore={vi.fn()}
        onOpenAudit={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("audit-card-skeleton").length).toBeGreaterThan(0);
  });

  it("renders error state with retry that calls onRefresh", async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(
      <HomeFeedView
        store={{ ...defaultStore, audits: [], auditsError: "Network error" }}
        setStore={vi.fn()}
        onOpenAudit={vi.fn()}
        onRefresh={onRefresh}
      />,
    );
    await user.click(screen.getByText("Retry"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("renders View all in Qualia link", () => {
    render(
      <HomeFeedView
        store={{ ...defaultStore, audits: [makeAudit()] }}
        setStore={vi.fn()}
        onOpenAudit={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText(/View all in Qualia/)).toBeInTheDocument();
  });

  it("clicking refresh button calls onRefresh", async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(
      <HomeFeedView
        store={{ ...defaultStore, audits: [makeAudit()] }}
        setStore={vi.fn()}
        onOpenAudit={vi.fn()}
        onRefresh={onRefresh}
      />,
    );
    await user.click(screen.getByLabelText("Refresh audits"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
