import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditCard } from "../../ui/components/AuditCard";

const baseAudit = {
  id: "a1",
  name: "Confirmation code",
  score: 78,
  type: "single" as const,
  source: "plugin",
  file_key: "abc",
  project: { id: "p1", name: "Acme Banking" },
  created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
};

describe("AuditCard", () => {
  it("renders name, score, project, type label, relative date", () => {
    render(<AuditCard audit={baseAudit} onClick={() => {}} />);
    expect(screen.getByText("Confirmation code")).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();
    expect(screen.getByText(/Acme Banking/)).toBeInTheDocument();
    expect(screen.getByText(/Single screen/)).toBeInTheDocument();
    expect(screen.getByText(/2h ago/)).toBeInTheDocument();
  });

  it("shows Web badge when source is not plugin", () => {
    render(<AuditCard audit={{ ...baseAudit, source: "webapp" }} onClick={() => {}} />);
    expect(screen.getByText("Web")).toBeInTheDocument();
  });

  it("hides Web badge when source is plugin", () => {
    render(<AuditCard audit={baseAudit} onClick={() => {}} />);
    expect(screen.queryByText("Web")).not.toBeInTheDocument();
  });

  it("omits project segment when project is null", () => {
    render(<AuditCard audit={{ ...baseAudit, project: null }} onClick={() => {}} />);
    expect(screen.queryByText(/Acme Banking/)).not.toBeInTheDocument();
    expect(screen.getByText(/Single screen/)).toBeInTheDocument();
  });

  it("invokes onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AuditCard audit={baseAudit} onClick={onClick} />);
    await user.click(screen.getByText("Confirmation code"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders type label for flow", () => {
    render(<AuditCard audit={{ ...baseAudit, type: "flow" }} onClick={() => {}} />);
    expect(screen.getByText(/User flow/)).toBeInTheDocument();
  });

  it("renders type label for prototype", () => {
    render(<AuditCard audit={{ ...baseAudit, type: "prototype" }} onClick={() => {}} />);
    expect(screen.getByText(/Prototype/)).toBeInTheDocument();
  });

  it("hides score when null", () => {
    render(<AuditCard audit={{ ...baseAudit, score: null }} onClick={() => {}} />);
    expect(screen.queryByText("78")).not.toBeInTheDocument();
  });
});
