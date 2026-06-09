import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeView } from "../../ui/views/HomeView";
import { defaultStore } from "../../ui/store";

const mockPostMessage = (globalThis as Record<string, unknown>).__mockParentPostMessage as ReturnType<typeof vi.fn>;

function renderHomeView(setStore = vi.fn()) {
  return render(<HomeView store={defaultStore} setStore={setStore} />);
}

describe("HomeView", () => {
  it("renders all three mode cards", () => {
    renderHomeView();
    expect(screen.getByText("Single Screen")).toBeInTheDocument();
    expect(screen.getByText("User Flow")).toBeInTheDocument();
    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });

  it("renders mode descriptions", () => {
    renderHomeView();
    expect(screen.getByText("Audit one selected frame for UX & accessibility issues.")).toBeInTheDocument();
    expect(screen.getByText("Audit multiple frames as a connected flow.")).toBeInTheDocument();
    expect(screen.getByText("Crawl all linked frames and audit the full prototype.")).toBeInTheDocument();
  });

  it("has no Continue button", () => {
    renderHomeView();
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
  });

  it("has no hint text about pre-selecting frames", () => {
    renderHomeView();
    expect(screen.queryByText(/select.*frame.*canvas/i)).not.toBeInTheDocument();
  });

  it("clicking Single Screen posts start-selection-watch with mode=single", async () => {
    const user = userEvent.setup();
    renderHomeView();
    await user.click(screen.getByText("Single Screen"));
    expect(mockPostMessage).toHaveBeenCalledWith(
      { pluginMessage: { type: "start-selection-watch", mode: "single" } },
      "*"
    );
  });

  it("clicking Single Screen calls setStore with view=selecting and selectionMode=single", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    render(<HomeView store={defaultStore} setStore={setStore} />);
    await user.click(screen.getByText("Single Screen"));
    expect(setStore).toHaveBeenCalledWith(
      expect.objectContaining({ view: "selecting", selectionMode: "single", selectionState: null })
    );
  });

  it("clicking User Flow posts start-selection-watch with mode=flow", async () => {
    const user = userEvent.setup();
    renderHomeView();
    await user.click(screen.getByText("User Flow"));
    expect(mockPostMessage).toHaveBeenCalledWith(
      { pluginMessage: { type: "start-selection-watch", mode: "flow" } },
      "*"
    );
  });

  it("clicking User Flow calls setStore with view=selecting and selectionMode=flow", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    render(<HomeView store={defaultStore} setStore={setStore} />);
    await user.click(screen.getByText("User Flow"));
    expect(setStore).toHaveBeenCalledWith(
      expect.objectContaining({ view: "selecting", selectionMode: "flow" })
    );
  });

  it("clicking Prototype posts start-prototype-crawl (not start-selection-watch)", async () => {
    const user = userEvent.setup();
    renderHomeView();
    await user.click(screen.getByText("Prototype"));
    expect(mockPostMessage).toHaveBeenCalledWith(
      { pluginMessage: { type: "start-prototype-crawl" } },
      "*"
    );
    expect(mockPostMessage).not.toHaveBeenCalledWith(
      { pluginMessage: expect.objectContaining({ type: "start-selection-watch" }) },
      "*"
    );
  });

  it("clicking Prototype does NOT call setStore with view=selecting", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    render(<HomeView store={defaultStore} setStore={setStore} />);
    await user.click(screen.getByText("Prototype"));
    expect(setStore).not.toHaveBeenCalledWith(
      expect.objectContaining({ view: "selecting" })
    );
  });
});
