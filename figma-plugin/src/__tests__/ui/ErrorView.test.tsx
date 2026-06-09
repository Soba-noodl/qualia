import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorView } from "../../ui/views/ErrorView";
import { defaultStore } from "../../ui/store";
import type { Store } from "../../ui/store";

const mockPostMessage = (globalThis as Record<string, unknown>).__mockParentPostMessage as ReturnType<typeof vi.fn>;

function makeStore(overrides: Partial<Store>): Store {
  return { ...defaultStore, ...overrides };
}

function renderErrorView(error: Store["error"], storeOverrides: Partial<Store> = {}, setStore = vi.fn()) {
  return render(
    <ErrorView store={makeStore({ error, ...storeOverrides })} setStore={setStore} />
  );
}

// --- CAPTURE_FAILED ---

describe("ErrorView — CAPTURE_FAILED", () => {
  it("renders error message", () => {
    renderErrorView({ code: "CAPTURE_FAILED", message: "Could not read file key. Make sure the file is saved to Figma." });
    expect(screen.getByText(/could not read file key/i)).toBeInTheDocument();
  });

  it("shows Try again button", () => {
    renderErrorView({ code: "CAPTURE_FAILED", message: "Something failed." });
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("Try again with selectionMode set → posts start-selection-watch and goes to selecting", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    renderErrorView(
      { code: "CAPTURE_FAILED", message: "Failed." },
      { selectionMode: "single" },
      setStore
    );
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockPostMessage).toHaveBeenCalledWith(
      { pluginMessage: { type: "start-selection-watch", mode: "single" } },
      "*"
    );
    expect(setStore).toHaveBeenCalledWith(
      expect.objectContaining({ view: "selecting", error: null, capturing: false, selectionState: null })
    );
  });

  it("Try again with selectionMode=flow → posts start-selection-watch mode=flow", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    renderErrorView(
      { code: "CAPTURE_FAILED", message: "Failed." },
      { selectionMode: "flow" },
      setStore
    );
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockPostMessage).toHaveBeenCalledWith(
      { pluginMessage: { type: "start-selection-watch", mode: "flow" } },
      "*"
    );
  });

  it("Try again with no selectionMode → goes to home (not selecting), no start-selection-watch", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    renderErrorView(
      { code: "CAPTURE_FAILED", message: "Failed." },
      { selectionMode: null },
      setStore
    );
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockPostMessage).not.toHaveBeenCalledWith(
      { pluginMessage: expect.objectContaining({ type: "start-selection-watch" }) },
      "*"
    );
    expect(setStore).toHaveBeenCalledWith(
      expect.objectContaining({ view: "home", error: null, capturing: false })
    );
  });

  it("does NOT set view=ready (which was the old broken behaviour)", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    renderErrorView({ code: "CAPTURE_FAILED", message: "Failed." }, {}, setStore);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(setStore).not.toHaveBeenCalledWith(expect.objectContaining({ view: "ready" }));
  });
});

// --- EXPORT_MISSING / EXPORT_INCOMPLETE ---

describe("ErrorView — EXPORT_MISSING / EXPORT_INCOMPLETE", () => {
  it("shows Select frames again button for EXPORT_MISSING", () => {
    renderErrorView({ code: "EXPORT_MISSING", message: "Could not read frames." });
    expect(screen.getByRole("button", { name: /select frames again/i })).toBeInTheDocument();
  });

  it("shows Select frames again button for EXPORT_INCOMPLETE", () => {
    renderErrorView({ code: "EXPORT_INCOMPLETE", message: "Incomplete." });
    expect(screen.getByRole("button", { name: /select frames again/i })).toBeInTheDocument();
  });

  it("no longer tells user to close the plugin", () => {
    renderErrorView({ code: "EXPORT_MISSING", message: "Could not read frames." });
    expect(screen.queryByText(/close the plugin/i)).not.toBeInTheDocument();
  });

  it("Select frames again with selectionMode → goes to selecting", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    renderErrorView(
      { code: "EXPORT_MISSING", message: "Could not read frames." },
      { selectionMode: "flow" },
      setStore
    );
    await user.click(screen.getByRole("button", { name: /select frames again/i }));
    expect(setStore).toHaveBeenCalledWith(
      expect.objectContaining({ view: "selecting", error: null })
    );
  });

  it("Select frames again without selectionMode → goes to home", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    renderErrorView(
      { code: "EXPORT_MISSING", message: "Could not read frames." },
      { selectionMode: null },
      setStore
    );
    await user.click(screen.getByRole("button", { name: /select frames again/i }));
    expect(setStore).toHaveBeenCalledWith(expect.objectContaining({ view: "home" }));
  });
});

// --- NETWORK_ERROR ---

describe("ErrorView — NETWORK_ERROR", () => {
  it("shows Retry button", () => {
    renderErrorView({ code: "NETWORK_ERROR", message: "Request failed." });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("Retry goes to view=ready (upload retry, not capture retry)", async () => {
    const user = userEvent.setup();
    const setStore = vi.fn();
    renderErrorView({ code: "NETWORK_ERROR", message: "Request failed." }, {}, setStore);
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(setStore).toHaveBeenCalledWith(expect.objectContaining({ view: "ready" }));
  });
});

// --- TOKEN_INVALID ---

describe("ErrorView — TOKEN_INVALID", () => {
  it("shows Log in again button", () => {
    renderErrorView({ code: "TOKEN_INVALID", message: "Session expired." });
    expect(screen.getByRole("button", { name: /log in again/i })).toBeInTheDocument();
  });
});

// --- QUOTA_EXCEEDED ---

describe("ErrorView — QUOTA_EXCEEDED", () => {
  it("shows upgrade link", () => {
    renderErrorView({ code: "QUOTA_EXCEEDED", message: "Daily limit reached." });
    expect(screen.getByRole("link", { name: /upgrade/i })).toBeInTheDocument();
  });
});

// --- FIGMA_NOT_CONNECTED ---

describe("ErrorView — FIGMA_NOT_CONNECTED", () => {
  it("shows settings link", () => {
    renderErrorView({ code: "FIGMA_NOT_CONNECTED", message: "Figma not connected." });
    expect(screen.getByRole("link", { name: /open qualia settings/i })).toBeInTheDocument();
  });
});

// --- null guard ---

describe("ErrorView — null error", () => {
  it("renders nothing when error is null", () => {
    const { container } = renderErrorView(null);
    expect(container).toBeEmptyDOMElement();
  });
});
