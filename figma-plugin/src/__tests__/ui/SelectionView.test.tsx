import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectionView } from "../../ui/views/SelectionView";
import { defaultStore } from "../../ui/store";
import type { Store } from "../../ui/store";

const mockPostMessage = (globalThis as Record<string, unknown>).__mockParentPostMessage as ReturnType<typeof vi.fn>;

function makeStore(overrides: Partial<Store>): Store {
  return { ...defaultStore, ...overrides };
}

function renderSelectionView(store: Store, setStore = vi.fn()) {
  return render(<SelectionView store={store} setStore={setStore} />);
}

// --- Waiting states ---

describe("SelectionView — waiting states", () => {
  it("shows waiting state when selectionState is null", () => {
    renderSelectionView(makeStore({ selectionMode: "single", selectionState: null }));
    expect(screen.getByText(/waiting for selection/i)).toBeInTheDocument();
  });

  it("shows 0/1 frame counter for single mode in waiting state", () => {
    renderSelectionView(makeStore({ selectionMode: "single", selectionState: null }));
    expect(screen.getByText(/0 \/ 1 frame/i)).toBeInTheDocument();
  });

  it("shows 0/10 frames counter for flow mode in waiting state", () => {
    renderSelectionView(makeStore({ selectionMode: "flow", selectionState: null }));
    expect(screen.getByText(/0 \/ 10 frames/i)).toBeInTheDocument();
  });

  it("shows waiting state when count=0 and nonFrameSelected=false", () => {
    renderSelectionView(makeStore({
      selectionMode: "single",
      selectionState: { valid: false, count: 0, names: [], nonFrameSelected: false },
    }));
    expect(screen.getByText(/waiting for selection/i)).toBeInTheDocument();
  });

  it("shows non-frame hint instead of waiting when nonFrameSelected=true", () => {
    renderSelectionView(makeStore({
      selectionMode: "single",
      selectionState: { valid: false, count: 0, names: [], nonFrameSelected: true },
    }));
    expect(screen.getByText(/layer or group, not a frame/i)).toBeInTheDocument();
    expect(screen.queryByText(/waiting for selection/i)).not.toBeInTheDocument();
  });

  it("shows Frame hint in the non-frame message", () => {
    renderSelectionView(makeStore({
      selectionMode: "flow",
      selectionState: { valid: false, count: 0, names: [], nonFrameSelected: true },
    }));
    expect(screen.getByText(/select a frame/i)).toBeInTheDocument();
  });
});

// --- Valid states ---

describe("SelectionView — valid selection", () => {
  it("shows green valid state with frame name for single", () => {
    renderSelectionView(makeStore({
      selectionMode: "single",
      selectionState: { valid: true, count: 1, names: ["Checkout"], nonFrameSelected: false },
    }));
    expect(screen.getByText(/checkout/i)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 1 frame/i)).toBeInTheDocument();
  });

  it("enables Analyze button when valid", () => {
    renderSelectionView(makeStore({
      selectionMode: "single",
      selectionState: { valid: true, count: 1, names: ["Home"], nonFrameSelected: false },
    }));
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });

  it("shows frame names joined with → for valid flow", () => {
    renderSelectionView(makeStore({
      selectionMode: "flow",
      selectionState: { valid: true, count: 3, names: ["Home", "Login", "Dashboard"], nonFrameSelected: false },
    }));
    expect(screen.getByText("Home → Login → Dashboard")).toBeInTheDocument();
    expect(screen.getByText(/3 \/ 10 frames/i)).toBeInTheDocument();
  });
});

// --- Invalid states ---

describe("SelectionView — invalid selection", () => {
  it("shows error for single mode with 2 frames", () => {
    renderSelectionView(makeStore({
      selectionMode: "single",
      selectionState: { valid: false, count: 2, names: ["A", "B"], nonFrameSelected: false },
    }));
    expect(screen.getByText(/select exactly one frame/i)).toBeInTheDocument();
  });

  it("shows error for flow mode with 1 frame (too few)", () => {
    renderSelectionView(makeStore({
      selectionMode: "flow",
      selectionState: { valid: false, count: 1, names: ["Only"], nonFrameSelected: false },
    }));
    expect(screen.getByText(/need at least 2 frames for a flow/i)).toBeInTheDocument();
  });

  it("shows error for flow mode with 11 frames (too many)", () => {
    renderSelectionView(makeStore({
      selectionMode: "flow",
      selectionState: { valid: false, count: 11, names: [], nonFrameSelected: false },
    }));
    expect(screen.getByText(/select at most 10 frames for a flow/i)).toBeInTheDocument();
  });

  it("disables Analyze when selection is invalid", () => {
    renderSelectionView(makeStore({
      selectionMode: "flow",
      selectionState: { valid: false, count: 1, names: ["Only"], nonFrameSelected: false },
    }));
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("disables Analyze when selectionState is null", () => {
    renderSelectionView(makeStore({ selectionMode: "single", selectionState: null }));
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });
});

// --- Capturing state ---

describe("SelectionView — capturing state", () => {
  const capturingStore = makeStore({
    selectionMode: "single",
    selectionState: { valid: true, count: 1, names: ["Home"], nonFrameSelected: false },
    capturing: true,
  });

  it("shows capturing spinner text (in spinner area and button)", () => {
    renderSelectionView(capturingStore);
    // "Capturing…" appears in both the spinner div and the button label — both are correct
    const elements = screen.getAllByText(/capturing…/i);
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("disables Analyze button while capturing", () => {
    renderSelectionView(capturingStore);
    expect(screen.getByRole("button", { name: /capturing/i })).toBeDisabled();
  });

  it("disables Back button while capturing", () => {
    renderSelectionView(capturingStore);
    expect(screen.getByRole("button", { name: /← back/i })).toBeDisabled();
  });
});

// --- Interactions ---

describe("SelectionView — Analyze button", () => {
  it("sets capturing=true in store and posts capture-selection on click", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    render(<SelectionView
      store={makeStore({
        selectionMode: "single",
        selectionState: { valid: true, count: 1, names: ["Home"], nonFrameSelected: false },
      })}
      setStore={setStore}
    />);
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(setStore).toHaveBeenCalledWith({ capturing: true });
    expect(mockPostMessage).toHaveBeenCalledWith(
      { pluginMessage: { type: "capture-selection", mode: "single" } },
      "*"
    );

  });

  it("posts capture-selection with mode=flow in flow mode", async () => {
    const user = userEvent.setup();
    render(<SelectionView
      store={makeStore({
        selectionMode: "flow",
        selectionState: { valid: true, count: 2, names: ["A", "B"], nonFrameSelected: false },
      })}
      setStore={vi.fn()}
    />);
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(mockPostMessage).toHaveBeenCalledWith(
      { pluginMessage: { type: "capture-selection", mode: "flow" } },
      "*"
    );
  });

  it("does not fire when button is disabled (invalid selection)", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    render(<SelectionView
      store={makeStore({
        selectionMode: "single",
        selectionState: { valid: false, count: 0, names: [], nonFrameSelected: false },
      })}
      setStore={setStore}
    />);
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(setStore).not.toHaveBeenCalled();
    expect(mockPostMessage).not.toHaveBeenCalled();
  });
});

describe("SelectionView — Back button", () => {
  it("posts stop-selection-watch and resets store on back", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    render(<SelectionView
      store={makeStore({
        selectionMode: "single",
        selectionState: { valid: true, count: 1, names: ["Home"], nonFrameSelected: false },
      })}
      setStore={setStore}
    />);
    await user.click(screen.getByRole("button", { name: /← back/i }));
    expect(mockPostMessage).toHaveBeenCalledWith(
      { pluginMessage: { type: "stop-selection-watch" } },
      "*"
    );
    expect(setStore).toHaveBeenCalledWith(
      expect.objectContaining({ view: "new-audit", selectionMode: null, selectionState: null, capturing: false })
    );
  });

  it("shows correct title for single mode", () => {
    renderSelectionView(makeStore({ selectionMode: "single", selectionState: null }));
    expect(screen.getByRole("heading", { name: /select a frame/i })).toBeInTheDocument();
  });

  it("shows correct title for flow mode", () => {
    renderSelectionView(makeStore({ selectionMode: "flow", selectionState: null }));
    expect(screen.getByRole("heading", { name: /select frames/i })).toBeInTheDocument();
  });
});
