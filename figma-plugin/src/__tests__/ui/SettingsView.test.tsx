import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsView } from "../../ui/views/SettingsView";
import { defaultStore } from "../../ui/store";

const CONSENT_KEY = "qualia_plugin_analytics_opt_in";

const mockPostMessage = (globalThis as Record<string, unknown>).__mockParentPostMessage as ReturnType<typeof vi.fn>;

function renderSettings(overrides: Partial<typeof defaultStore> = {}) {
  const setStore = vi.fn();
  const utils = render(
    <SettingsView store={{ ...defaultStore, ...overrides }} setStore={setStore} />,
  );
  return { ...utils, setStore };
}

describe("SettingsView", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPostMessage.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders the three sections: AI Providers, analytics, Account", () => {
    renderSettings();
    expect(screen.getByText(/AI Providers/i)).toBeInTheDocument();
    expect(screen.getByText(/^Account$/i)).toBeInTheDocument();
    // Analytics section label comes from t("pluginSettingsAnalyticsLabel")
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("shows 'No key configured' when byokStatus.hasKey is false", () => {
    renderSettings({ byokStatus: { hasKey: false } as never });
    expect(screen.getByText(/No key configured/i)).toBeInTheDocument();
  });

  it("shows provider + model when byokStatus.hasKey is true", () => {
    renderSettings({
      byokStatus: { hasKey: true, provider: "gemini", model: "gemini-2.5-flash" } as never,
    });
    // Provider is rendered inside <strong>Gemini</strong> · {model}
    expect(screen.getByText(/^Gemini$/)).toBeInTheDocument();
    expect(screen.getByText(/gemini-2\.5-flash/)).toBeInTheDocument();
  });

  it("analytics checkbox defaults to checked (opt-in) when localStorage is empty", () => {
    renderSettings();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull();
  });

  it("analytics checkbox reflects previously-stored 'false' (opted out)", () => {
    localStorage.setItem(CONSENT_KEY, "false");
    renderSettings();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it("toggling analytics OFF persists 'false' to localStorage", () => {
    renderSettings();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);

    expect(checkbox.checked).toBe(false);
    expect(localStorage.getItem(CONSENT_KEY)).toBe("false");
  });

  it("toggling analytics ON persists 'true' to localStorage", () => {
    localStorage.setItem(CONSENT_KEY, "false");
    renderSettings();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);

    expect(checkbox.checked).toBe(true);
    expect(localStorage.getItem(CONSENT_KEY)).toBe("true");
  });

  it("logout button posts clear-token to parent and resets store", () => {
    const { setStore } = renderSettings({ token: "tok_abc" as never });
    // i18n: pluginSettingsLogout = "Log out" (EN) / "Esci" (IT)
    const logoutBtn = screen.getAllByRole("button").find((b) =>
      /log\s*out|esci/i.test(b.textContent ?? ""),
    );
    expect(logoutBtn).toBeDefined();
    fireEvent.click(logoutBtn!);

    expect(mockPostMessage).toHaveBeenCalledWith(
      { pluginMessage: { type: "clear-token" } },
      "*",
    );
    expect(setStore).toHaveBeenCalledWith(
      expect.objectContaining({ view: "auth", token: null }),
    );
  });

  it("opting out does not break opting back in (round-trip)", () => {
    renderSettings();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(checkbox); // off
    expect(localStorage.getItem(CONSENT_KEY)).toBe("false");
    fireEvent.click(checkbox); // on
    expect(localStorage.getItem(CONSENT_KEY)).toBe("true");
    fireEvent.click(checkbox); // off
    expect(localStorage.getItem(CONSENT_KEY)).toBe("false");
  });
});
