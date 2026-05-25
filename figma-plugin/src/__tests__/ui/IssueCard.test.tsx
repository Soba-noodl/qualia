import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssueCard } from "../../ui/components/IssueCard";

const baseProps = {
  text: "No confirmation after submit",
  severity: "high" as const,
  stance: null,
  reason: "",
  onStanceChange: vi.fn(),
  onReasonChange: vi.fn(),
  onReasonBlur: vi.fn(),
};

describe("IssueCard — content", () => {
  it("renders the issue text", () => {
    render(<IssueCard {...baseProps} />);
    expect(screen.getByText("No confirmation after submit")).toBeInTheDocument();
  });

  it("renders whyItMatters when provided", () => {
    render(<IssueCard {...baseProps} whyItMatters="Users are confused." />);
    expect(screen.getByText("Users are confused.")).toBeInTheDocument();
  });

  it("renders suggestion when provided", () => {
    render(<IssueCard {...baseProps} suggestion="Add a toast notification." />);
    expect(screen.getByText("Add a toast notification.")).toBeInTheDocument();
  });

  it("renders engineLabel badge when provided", () => {
    render(<IssueCard {...baseProps} engineLabel="Cognitive" />);
    expect(screen.getByText("Cognitive")).toBeInTheDocument();
  });

  it("renders screenLabel pill when provided", () => {
    render(<IssueCard {...baseProps} screenLabel="Screen 2" />);
    expect(screen.getByText("Screen 2")).toBeInTheDocument();
  });
});

describe("IssueCard — stance buttons", () => {
  it("renders all 4 stance buttons", () => {
    render(<IssueCard {...baseProps} />);
    expect(screen.getByRole("button", { name: /^agree$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^disagree$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /already fixed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /not relevant/i })).toBeInTheDocument();
  });

  it("calls onStanceChange with 'agree' when Agree is clicked", async () => {
    const onStanceChange = vi.fn();
    const user = userEvent.setup();
    render(<IssueCard {...baseProps} onStanceChange={onStanceChange} />);
    await user.click(screen.getByRole("button", { name: /^agree$/i }));
    expect(onStanceChange).toHaveBeenCalledWith("agree");
  });

  it("active stance button has bg-primary class", () => {
    render(<IssueCard {...baseProps} stance="agree" />);
    expect(screen.getByRole("button", { name: /^agree$/i })).toHaveClass("bg-primary/20");
  });

  it("clicking active stance calls onStanceChange with null (toggle off)", async () => {
    const onStanceChange = vi.fn();
    const user = userEvent.setup();
    render(<IssueCard {...baseProps} stance="agree" onStanceChange={onStanceChange} />);
    await user.click(screen.getByRole("button", { name: /^agree$/i }));
    expect(onStanceChange).toHaveBeenCalledWith(null);
  });
});

describe("IssueCard — reason textarea", () => {
  it("always renders the textarea", () => {
    render(<IssueCard {...baseProps} stance={null} reason="" />);
    expect(screen.getByPlaceholderText(/optional note/i)).toBeInTheDocument();
  });

  it("renders textarea when a stance is selected", () => {
    render(<IssueCard {...baseProps} stance="agree" />);
    expect(screen.getByPlaceholderText(/optional note/i)).toBeInTheDocument();
  });

  it("renders textarea when reason already has content", () => {
    render(<IssueCard {...baseProps} stance={null} reason="My note" />);
    expect(screen.getByPlaceholderText(/optional note/i)).toBeInTheDocument();
  });

  it("calls onReasonChange when typing in textarea", async () => {
    const onReasonChange = vi.fn();
    const user = userEvent.setup();
    render(<IssueCard {...baseProps} stance="agree" onReasonChange={onReasonChange} />);
    await user.type(screen.getByPlaceholderText(/optional note/i), "x");
    expect(onReasonChange).toHaveBeenCalled();
  });
});

describe("IssueCard — card click", () => {
  it("calls onClick when card body is clicked and onClick is provided", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<IssueCard {...baseProps} onClick={onClick} />);
    await user.click(screen.getByText("No confirmation after submit"));
    expect(onClick).toHaveBeenCalled();
  });

  it("does not call onClick when a stance button is clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<IssueCard {...baseProps} onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: /^agree$/i }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
