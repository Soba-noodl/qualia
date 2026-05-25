import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadyView } from "../../ui/views/ReadyView";
import { defaultStore } from "../../ui/store";
import type { Store } from "../../ui/store";

// Mock fetch so fetchProjects doesn't hit the network
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ projects: [] }),
}));

// localStorage is provided by jsdom — reset between tests
beforeEach(() => {
  localStorage.clear();
});

function makeStore(overrides: Partial<Store>): Store {
  return { ...defaultStore, ...overrides };
}

function renderReadyView(store: Store, setStore = vi.fn()) {
  return render(<ReadyView store={store} setStore={setStore} />);
}

const personalProject = {
  id: "p1",
  name: "My App",
  mission: "m",
  persona: "u",
  constraints: null,
  language: "English",
  scope: "whole" as const,
  product_name: null,
  global_mission: null,
  org_id: null,
  personas: [],
};

const teamProject = {
  id: "t1",
  name: "Acme — Onboarding",
  mission: "m",
  persona: "u",
  constraints: null,
  language: "English",
  scope: "whole" as const,
  product_name: null,
  global_mission: null,
  org_id: "org-abc",
  personas: [],
};

// ── Toggle renders ────────────────────────────────────────────

describe("ReadyView — toggle tabs", () => {
  it("renders Personal and Team tabs", () => {
    renderReadyView(makeStore({ projects: [] }));
    expect(screen.getByRole("button", { name: "Personal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument();
  });

  it("Personal tab is active by default", () => {
    renderReadyView(makeStore({ projects: [] }));
    const personalBtn = screen.getByRole("button", { name: "Personal" });
    expect(personalBtn).toHaveClass("bg-primary");
  });

  it("clicking Team tab makes it active", async () => {
    const user = userEvent.setup();
    renderReadyView(makeStore({ projects: [] }));
    await user.click(screen.getByRole("button", { name: "Team" }));
    const teamBtn = screen.getByRole("button", { name: "Team" });
    expect(teamBtn).toHaveClass("bg-primary");
  });

  it("persists scope to localStorage when switching to Team", async () => {
    const user = userEvent.setup();
    renderReadyView(makeStore({ projects: [] }));
    await user.click(screen.getByRole("button", { name: "Team" }));
    expect(localStorage.getItem("qualia_plugin_view_scope")).toBe("team");
  });

  it("reads initial scope from localStorage", () => {
    localStorage.setItem("qualia_plugin_view_scope", "team");
    renderReadyView(makeStore({ projects: [] }));
    const teamBtn = screen.getByRole("button", { name: "Team" });
    expect(teamBtn).toHaveClass("bg-primary");
  });
});

// ── Project filtering ─────────────────────────────────────────

describe("ReadyView — project filtering", () => {
  it("Personal tab shows only personal projects (org_id === null)", () => {
    renderReadyView(makeStore({ projects: [personalProject, teamProject] }));
    expect(screen.getByRole("option", { name: "My App" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Acme — Onboarding" })).not.toBeInTheDocument();
  });

  it("Team tab shows only team projects (org_id !== null)", async () => {
    const user = userEvent.setup();
    renderReadyView(makeStore({ projects: [personalProject, teamProject] }));
    await user.click(screen.getByRole("button", { name: "Team" }));
    expect(screen.getByRole("option", { name: "Acme — Onboarding" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "My App" })).not.toBeInTheDocument();
  });
});

// ── Empty states ──────────────────────────────────────────────

describe("ReadyView — empty states", () => {
  it("shows empty message when personal tab has no personal projects", () => {
    renderReadyView(makeStore({ projects: [teamProject] }));
    expect(screen.getByText(/no personal projects yet/i)).toBeInTheDocument();
  });

  it("shows empty message when team tab has no team projects", async () => {
    const user = userEvent.setup();
    renderReadyView(makeStore({ projects: [personalProject] }));
    await user.click(screen.getByRole("button", { name: "Team" }));
    expect(screen.getByText(/you're not in a team yet/i)).toBeInTheDocument();
  });
});

// ── No create form ────────────────────────────────────────────

describe("ReadyView — inline create form is removed", () => {
  it("does not render a Create project button", () => {
    renderReadyView(makeStore({ projects: [] }));
    expect(screen.queryByRole("button", { name: /create project/i })).not.toBeInTheDocument();
  });

  it("does not render product name input", () => {
    renderReadyView(makeStore({ projects: [] }));
    expect(screen.queryByPlaceholderText(/e\.g\. my app/i)).not.toBeInTheDocument();
  });
});

// ── Qualia link ───────────────────────────────────────────────

describe("ReadyView — Qualia link", () => {
  it("renders the Qualia link", () => {
    renderReadyView(makeStore({ projects: [] }));
    expect(screen.getByText(/create or manage projects in qualia/i)).toBeInTheDocument();
  });

  it("renders the Qualia link subtitle", () => {
    renderReadyView(makeStore({ projects: [] }));
    expect(screen.getByText(/set up mission, personas and constraints/i)).toBeInTheDocument();
  });
});

// ── Goal field labeling ───────────────────────────────────────

describe("ReadyView — goal field labeling", () => {
  it("hides the goal field for prototype mode", () => {
    renderReadyView(makeStore({ mode: "prototype" }));
    expect(screen.queryByText(/screen goal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/flow goal/i)).not.toBeInTheDocument();
  });

  it("shows 'Flow goal' for flow mode", () => {
    renderReadyView(makeStore({ mode: "flow" }));
    expect(screen.getByText(/flow goal/i)).toBeInTheDocument();
  });

  it("shows 'Screen goal' for single mode", () => {
    renderReadyView(makeStore({ mode: "single" }));
    expect(screen.getByText(/screen goal/i)).toBeInTheDocument();
  });
});

// ── Prototype frame list collapse ────────────────────────────

describe("ReadyView — prototype frame list", () => {
  function makeProtoGraph(count: number) {
    const frameIds = Array.from({ length: count }, (_, i) => `node${i}`);
    const frameNames = Object.fromEntries(frameIds.map((id, i) => [id, `Frame ${i + 1}`]));
    return { frameIds, frameNames, startingNodeName: "Frame 1", frameMapText: "", hasConnections: true, designTokenSummary: "", figmaFileName: "", multipleStartingPoints: null, fileKey: "f1" };
  }

  it("shows only 4 frames + overflow row when prototype has many frames", () => {
    renderReadyView(makeStore({ mode: "prototype", prototypeGraph: makeProtoGraph(23) }));
    expect(screen.getByText("Frame 1")).toBeInTheDocument();
    expect(screen.getByText("Frame 4")).toBeInTheDocument();
    expect(screen.queryByText("Frame 5")).not.toBeInTheDocument();
    expect(screen.getByText(/\+19 more/i)).toBeInTheDocument();
  });

  it("shows full list when prototype has 4 or fewer frames", () => {
    renderReadyView(makeStore({ mode: "prototype", prototypeGraph: makeProtoGraph(2) }));
    expect(screen.getByText("Frame 1")).toBeInTheDocument();
    expect(screen.getByText("Frame 2")).toBeInTheDocument();
    expect(screen.queryByText(/more/i)).not.toBeInTheDocument();
  });
});

// ── Analyze button ────────────────────────────────────────────

describe("ReadyView — analyze button", () => {
  it("analyze button is disabled when no project is selected", () => {
    renderReadyView(makeStore({
      projects: [personalProject],
      selectedProjectId: null,
      initPayload: { mode: "single", fileKey: "f1", nodes: [{ id: "n1", name: "Home" }] },
      exportedImages: [{ nodeId: "n1", bytes: new ArrayBuffer(8) }],
    }));
    expect(screen.getByRole("button", { name: /analyze screen/i })).toBeDisabled();
  });
});
