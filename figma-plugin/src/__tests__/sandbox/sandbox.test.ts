/**
 * Sandbox tests — exercises code.ts message handling by mocking the figma global.
 *
 * Strategy: set up figma mock once at module scope, then use vi.resetModules() +
 * dynamic import in beforeEach to get a fresh module instance (and thus fresh
 * _selectionUnsubscribe state) for every test.
 */

import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// figma global mock — must be set before any import of code.ts
// ---------------------------------------------------------------------------

function makeFrame(name: string, x = 0) {
  return {
    type: "FRAME" as const,
    name,
    absoluteBoundingBox: { x, y: 0, width: 375, height: 812 },
    fills: [],
    children: [],
    exportAsync: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  };
}

function makeNonFrame(name = "Text layer") {
  return { type: "TEXT" as const, name, absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 20 } };
}

function makeFrameWithReactions(name: string, x = 0, destinationIds: string[] = []) {
  const reactions = destinationIds.map((id) => ({
    actions: [{ type: "NODE", destinationId: id }],
  }));
  return {
    type: "FRAME" as const,
    id: `id-${name}`,
    name,
    absoluteBoundingBox: { x, y: 0, width: 375, height: 812 },
    fills: [],
    reactions,
    children: [] as unknown[],
    exportAsync: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    visible: true,
  };
}

const figmaMock = {
  fileKey: "test-file-key" as string | null,
  currentPage: {
    selection: [] as ReturnType<typeof makeFrame | typeof makeNonFrame>[],
    flowStartingPoints: [] as { nodeId: string; name: string }[],
    children: [] as unknown[],
  },
  ui: {
    postMessage: vi.fn(),
    onmessage: null as ((msg: unknown) => void) | null,
    resize: vi.fn(),
  },
  on: vi.fn(),
  off: vi.fn(),
  notify: vi.fn(),
  showUI: vi.fn(),
  mixed: Symbol("mixed"),
  clientStorage: {
    getAsync: vi.fn().mockResolvedValue(null),
    setAsync: vi.fn().mockResolvedValue(undefined),
    deleteAsync: vi.fn().mockResolvedValue(undefined),
  },
  getNodeByIdAsync: vi.fn().mockResolvedValue(null),
  loadFontAsync: vi.fn().mockResolvedValue(undefined),
  viewport: { scrollAndZoomIntoView: vi.fn() },
  root: { name: "Test File" },
  variables: {
    getVariableById: vi.fn().mockReturnValue(null),
  },
};

(globalThis as Record<string, unknown>).figma = figmaMock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Send a message to the plugin sandbox (as if posted from the UI iframe). */
function send(msg: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- getSelectionChangeHandler always present after sendInit
  figmaMock.ui.onmessage!(msg);
}

/** Return the handler registered with figma.on("selectionchange", ...) — if any. */
function getSelectionChangeHandler(): (() => void) | undefined {
  const call = (figmaMock.on as Mock).mock.calls.find(([e]) => e === "selectionchange");
  return call?.[1] as (() => void) | undefined;
}

/** Convenience: assert postMessage was called with a matching subset. */
function expectPosted(subset: Record<string, unknown>) {
  expect(figmaMock.ui.postMessage).toHaveBeenCalledWith(expect.objectContaining(subset));
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("sandbox — selection watch", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    figmaMock.currentPage.selection = [];
    figmaMock.currentPage.flowStartingPoints = [];
    figmaMock.fileKey = "test-file-key";
    figmaMock.ui.onmessage = null;

    vi.resetModules();
    await import("../../code");
  });

  // --- start-selection-watch ---

  it("registers a selectionchange listener on start-selection-watch single", () => {
    send({ type: "start-selection-watch", mode: "single" });
    expect(figmaMock.on).toHaveBeenCalledWith("selectionchange", expect.any(Function));
  });

  it("fires selection-update immediately on start-selection-watch (0 frames → invalid)", () => {
    send({ type: "start-selection-watch", mode: "single" });
    expectPosted({ type: "selection-update", valid: false, count: 0, nonFrameSelected: false });
  });

  it("reports valid=true immediately when a frame is already selected (single)", () => {
    figmaMock.currentPage.selection = [makeFrame("Login")];
    send({ type: "start-selection-watch", mode: "single" });
    expectPosted({ type: "selection-update", valid: true, count: 1, names: ["Login"] });
  });

  it("fires update on each selectionchange event", () => {
    send({ type: "start-selection-watch", mode: "single" });
    figmaMock.ui.postMessage.mockClear();

    figmaMock.currentPage.selection = [makeFrame("Dashboard")];
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- getSelectionChangeHandler always present after sendInit
    const handler = getSelectionChangeHandler()!;
    handler();

    expectPosted({ type: "selection-update", valid: true, count: 1, names: ["Dashboard"] });
  });

  it("detects non-frame selection and sets nonFrameSelected=true", () => {
    figmaMock.currentPage.selection = [makeNonFrame("Some Text")];
    send({ type: "start-selection-watch", mode: "single" });
    expectPosted({ type: "selection-update", valid: false, count: 0, nonFrameSelected: true });
  });

  it("does not set nonFrameSelected when selection is empty", () => {
    figmaMock.currentPage.selection = [];
    send({ type: "start-selection-watch", mode: "single" });
    expectPosted({ type: "selection-update", valid: false, count: 0, nonFrameSelected: false });
  });

  // --- single mode validity ---

  it("single: 1 frame selected → valid", () => {
    figmaMock.currentPage.selection = [makeFrame("Home")];
    send({ type: "start-selection-watch", mode: "single" });
    expectPosted({ type: "selection-update", valid: true, count: 1 });
  });

  it("single: 2 frames selected → invalid", () => {
    figmaMock.currentPage.selection = [makeFrame("A"), makeFrame("B")];
    send({ type: "start-selection-watch", mode: "single" });
    expectPosted({ type: "selection-update", valid: false, count: 2 });
  });

  // --- flow mode validity ---

  it("flow: 1 frame → invalid", () => {
    figmaMock.currentPage.selection = [makeFrame("A")];
    send({ type: "start-selection-watch", mode: "flow" });
    expectPosted({ type: "selection-update", valid: false, count: 1 });
  });

  it("flow: 2 frames → valid", () => {
    figmaMock.currentPage.selection = [makeFrame("A"), makeFrame("B")];
    send({ type: "start-selection-watch", mode: "flow" });
    expectPosted({ type: "selection-update", valid: true, count: 2 });
  });

  it("flow: 10 frames → valid", () => {
    figmaMock.currentPage.selection = Array.from({ length: 10 }, (_, i) => makeFrame(`F${i}`));
    send({ type: "start-selection-watch", mode: "flow" });
    expectPosted({ type: "selection-update", valid: true, count: 10 });
  });

  it("flow: 11 frames → invalid", () => {
    figmaMock.currentPage.selection = Array.from({ length: 11 }, (_, i) => makeFrame(`F${i}`));
    send({ type: "start-selection-watch", mode: "flow" });
    expectPosted({ type: "selection-update", valid: false, count: 11 });
  });

  // --- frame name sort order ---

  it("sorts frame names by X position (left-to-right) in the update message", () => {
    // Selection order is right-to-left; expected output is left-to-right
    figmaMock.currentPage.selection = [
      makeFrame("Dashboard", 800),
      makeFrame("Home", 0),
      makeFrame("Login", 400),
    ];
    send({ type: "start-selection-watch", mode: "flow" });
    expectPosted({ type: "selection-update", names: ["Home", "Login", "Dashboard"] });
  });

  // --- stop-selection-watch ---

  it("calls figma.off on stop-selection-watch", () => {
    send({ type: "start-selection-watch", mode: "single" });
    figmaMock.off.mockClear();

    send({ type: "stop-selection-watch" });
    expect(figmaMock.off).toHaveBeenCalledWith("selectionchange", expect.any(Function));
  });

  it("second startWatch removes the first listener before adding a new one", () => {
    send({ type: "start-selection-watch", mode: "single" });
    // off not called yet
    expect(figmaMock.off).not.toHaveBeenCalledWith("selectionchange", expect.any(Function));

    // Start again
    send({ type: "start-selection-watch", mode: "flow" });
    expect(figmaMock.off).toHaveBeenCalledWith("selectionchange", expect.any(Function));

    // Exactly one selectionchange listener active after second start
    const activeCalls = (figmaMock.on as Mock).mock.calls.filter(([e]) => e === "selectionchange");
    const removedCalls = (figmaMock.off as Mock).mock.calls.filter(([e]) => e === "selectionchange");
    expect(activeCalls.length - removedCalls.length).toBe(1);
  });

  it("does not fire selectionchange updates after stop-selection-watch", () => {
    send({ type: "start-selection-watch", mode: "single" });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- getSelectionChangeHandler always present after sendInit
    const handler = getSelectionChangeHandler()!;
    send({ type: "stop-selection-watch" });
    figmaMock.ui.postMessage.mockClear();

    // The handler is detached — simulating it should not have side effects via figma.off
    // (the listener is removed, so figma wouldn't call it; we just verify stop happened)
    expect(figmaMock.off).toHaveBeenCalledWith("selectionchange", handler);
  });
});

describe("sandbox — capture-selection single", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    figmaMock.currentPage.selection = [];
    figmaMock.fileKey = "test-file-key";
    figmaMock.ui.onmessage = null;
    vi.resetModules();
    await import("../../code");
  });

  it("stops the selection watch immediately when capture begins", () => {
    send({ type: "start-selection-watch", mode: "single" });
    figmaMock.off.mockClear();

    figmaMock.currentPage.selection = [makeFrame("Home")];
    send({ type: "capture-selection", mode: "single" });

    expect(figmaMock.off).toHaveBeenCalledWith("selectionchange", expect.any(Function));
  });

  it("sends capture-error when nothing is selected", () => {
    figmaMock.currentPage.selection = [];
    send({ type: "capture-selection", mode: "single" });
    expectPosted({ type: "capture-error" });
  });

  it("sends capture-error when a non-frame is selected", () => {
    figmaMock.currentPage.selection = [makeNonFrame()];
    send({ type: "capture-selection", mode: "single" });
    expectPosted({ type: "capture-error" });
  });

  it("sends capture-error when 2 frames are selected in single mode", () => {
    figmaMock.currentPage.selection = [makeFrame("A"), makeFrame("B")];
    send({ type: "capture-selection", mode: "single" });
    expectPosted({ type: "capture-error" });
  });

  it("sends init with empty fileKey when fileKey is missing", () => {
    figmaMock.fileKey = null;
    figmaMock.currentPage.selection = [makeFrame("Home")];
    send({ type: "capture-selection", mode: "single" });
    expectPosted({ type: "init", payload: expect.objectContaining({ fileKey: "", mode: "single" }) });
  });

  it("sends init then export-images for valid single selection", async () => {
    const frame = makeFrame("Checkout");
    figmaMock.currentPage.selection = [frame];
    send({ type: "capture-selection", mode: "single" });

    // init is sent synchronously
    expectPosted({ type: "init", payload: expect.objectContaining({ mode: "single" }) });

    // export-images is sent after exportAsync resolves
    await vi.waitFor(() => {
      expect(figmaMock.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "export-images" })
      );
    });
  });
});

describe("sandbox — capture-selection flow", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    figmaMock.currentPage.selection = [];
    figmaMock.fileKey = "test-file-key";
    figmaMock.ui.onmessage = null;
    vi.resetModules();
    await import("../../code");
  });

  it("sends capture-error for 0 frames", () => {
    figmaMock.currentPage.selection = [];
    send({ type: "capture-selection", mode: "flow" });
    expectPosted({ type: "capture-error" });
  });

  it("sends capture-error for 1 frame", () => {
    figmaMock.currentPage.selection = [makeFrame("Only")];
    send({ type: "capture-selection", mode: "flow" });
    expectPosted({ type: "capture-error" });
  });

  it("sends capture-error for 11 frames", () => {
    figmaMock.currentPage.selection = Array.from({ length: 11 }, (_, i) => makeFrame(`F${i}`));
    send({ type: "capture-selection", mode: "flow" });
    expectPosted({ type: "capture-error" });
  });

  it("sends init with empty fileKey when fileKey is missing (flow)", () => {
    figmaMock.fileKey = null;
    figmaMock.currentPage.selection = [makeFrame("A"), makeFrame("B")];
    send({ type: "capture-selection", mode: "flow" });
    expectPosted({ type: "init", payload: expect.objectContaining({ fileKey: "", mode: "flow" }) });
  });

  it("sends init and export-images for 2 valid frames", async () => {
    figmaMock.currentPage.selection = [makeFrame("Login"), makeFrame("Home", 400)];
    send({ type: "capture-selection", mode: "flow" });

    expectPosted({ type: "init", payload: expect.objectContaining({ mode: "flow" }) });

    await vi.waitFor(() => {
      expect(figmaMock.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "export-images" })
      );
    });
  });

  it("stops selection watch when capture-selection is called", () => {
    send({ type: "start-selection-watch", mode: "flow" });
    figmaMock.off.mockClear();

    figmaMock.currentPage.selection = [makeFrame("A"), makeFrame("B")];
    send({ type: "capture-selection", mode: "flow" });

    expect(figmaMock.off).toHaveBeenCalledWith("selectionchange", expect.any(Function));
  });
});

describe("sandbox — start-prototype-crawl", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    figmaMock.currentPage.selection = [];
    figmaMock.currentPage.flowStartingPoints = [];
    figmaMock.currentPage.children = [];
    figmaMock.fileKey = "test-file-key";
    figmaMock.ui.onmessage = null;
    figmaMock.root = { name: "Test File" };
    vi.resetModules();
    await import("../../code");
  });

  it("posts prototype-error when page has no frames", async () => {
    figmaMock.currentPage.children = [];
    send({ type: "start-prototype-crawl" });
    await vi.waitFor(() => {
      expect(figmaMock.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "prototype-error" })
      );
    });
  });

  it("posts prototype-graph with correct frameIds for frames on page", async () => {
    const frameA = makeFrameWithReactions("Screen A", 0, ["id-Screen B"]);
    const frameB = makeFrameWithReactions("Screen B", 400);
    figmaMock.currentPage.children = [frameA, frameB];
    figmaMock.currentPage.flowStartingPoints = [{ nodeId: "id-Screen A", name: "Screen A" }];

    send({ type: "start-prototype-crawl", seedNodeId: "id-Screen A" });

    await vi.waitFor(() => {
      expect(figmaMock.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "prototype-graph",
          frameIds: ["id-Screen A", "id-Screen B"],
        })
      );
    });
  });

  it("ignores a second crawl while first is in progress", async () => {
    const frameA = makeFrameWithReactions("A", 0);
    figmaMock.currentPage.children = [frameA];
    figmaMock.currentPage.flowStartingPoints = [{ nodeId: "id-A", name: "A" }];

    send({ type: "start-prototype-crawl" });
    send({ type: "start-prototype-crawl" });

    await vi.waitFor(() => {
      expect(figmaMock.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "prototype-graph" })
      );
    });

    const graphCalls = (figmaMock.ui.postMessage as Mock).mock.calls.filter(
      ([msg]) => msg.type === "prototype-graph"
    );
    expect(graphCalls.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeA11y — tested indirectly via capture-selection (single mode)
// The figmaA11y field is included in the export-images message.
// ---------------------------------------------------------------------------

function makeRootWithChildren(children: unknown[]) {
  const root = {
    type: "FRAME" as const,
    name: "Root",
    visible: true,
    absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 812 },
    fills: [{ type: "SOLID", visible: true, color: { r: 1, g: 1, b: 1 } }],
    children,
    exportAsync: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    parent: null,
  };
  (children as Array<{ parent: unknown }>).forEach(c => { c.parent = root; });
  return root;
}

describe("sandbox — computeA11y: tap target parent chain (A1)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    figmaMock.fileKey = "test-file-key";
    figmaMock.ui.onmessage = null;
    vi.resetModules();
    await import("../../code");
  });

  it("does NOT flag a 24×24 icon-btn when its parent is an invisible 44×44 frame", async () => {
    const btn = {
      type: "INSTANCE" as const,
      name: "icon-btn",
      visible: true,
      absoluteBoundingBox: { x: 10, y: 10, width: 24, height: 24 },
      fills: [],
      children: [],
      parent: null as unknown,
    };
    const hitAreaFrame = {
      type: "FRAME" as const,
      name: "tap-target",
      visible: false,
      locked: false,
      absoluteBoundingBox: { x: 0, y: 0, width: 44, height: 44 },
      fills: [],
      children: [btn],
      parent: null as unknown,
    };
    btn.parent = hitAreaFrame;
    const root = makeRootWithChildren([hitAreaFrame]);
    figmaMock.currentPage.selection = [root as unknown as ReturnType<typeof makeFrame>];
    send({ type: "capture-selection", mode: "single" });

    await vi.waitFor(() => {
      const call = (figmaMock.ui.postMessage as Mock).mock.calls.find(([m]) => m.type === "export-images");
      expect(call).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array index after .length guard
      const figmaA11y = call![0].payload.figmaA11y;
      expect(figmaA11y.touch_targets).toHaveLength(0);
    });
  });

  it("DOES flag a 24×24 icon-btn when no parent provides adequate hit area", async () => {
    const btn = {
      type: "INSTANCE" as const,
      name: "icon-btn",
      visible: true,
      absoluteBoundingBox: { x: 10, y: 10, width: 24, height: 24 },
      fills: [],
      children: [],
      parent: null as unknown,
    };
    const root = makeRootWithChildren([btn]);
    btn.parent = root;
    figmaMock.currentPage.selection = [root as unknown as ReturnType<typeof makeFrame>];
    send({ type: "capture-selection", mode: "single" });

    await vi.waitFor(() => {
      const call = (figmaMock.ui.postMessage as Mock).mock.calls.find(([m]) => m.type === "export-images");
      expect(call).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array index after .length guard
      const figmaA11y = call![0].payload.figmaA11y;
      expect(figmaA11y.touch_targets).toHaveLength(1);
      expect(figmaA11y.touch_targets[0].hit_area_source).toBe("self");
    });
  });
});

describe("sandbox — computeA11y: color variable modes (A2)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    figmaMock.fileKey = "test-file-key";
    figmaMock.ui.onmessage = null;
    figmaMock.variables.getVariableById = vi.fn().mockReturnValue(null);
    vi.resetModules();
    await import("../../code");
  });

  it("does NOT flag contrast when variable passes in at least one mode", async () => {
    figmaMock.variables.getVariableById = vi.fn().mockReturnValue({
      valuesByMode: {
        "mode-light": { r: 0.9, g: 0.9, b: 0.9 }, // white-ish on white bg → fails
        "mode-dark":  { r: 0.0, g: 0.0, b: 0.0 }, // black on white bg → passes
      },
    });

    const textNode = {
      type: "TEXT" as const,
      name: "Label",
      visible: true,
      absoluteBoundingBox: { x: 10, y: 10, width: 100, height: 20 },
      fills: [{ type: "SOLID", visible: true, color: { r: 0.9, g: 0.9, b: 0.9 }, boundVariables: { color: { id: "var-1" } } }],
      children: [],
      parent: null as unknown,
    };
    const root = makeRootWithChildren([textNode]);
    textNode.parent = root;
    figmaMock.currentPage.selection = [root as unknown as ReturnType<typeof makeFrame>];
    send({ type: "capture-selection", mode: "single" });

    await vi.waitFor(() => {
      const call = (figmaMock.ui.postMessage as Mock).mock.calls.find(([m]) => m.type === "export-images");
      expect(call).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array index after .length guard
      const figmaA11y = call![0].payload.figmaA11y;
      expect(figmaA11y.contrast).toHaveLength(0);
    });
  });

  it("DOES flag contrast (is_dynamic:true) when variable fails in ALL modes", async () => {
    figmaMock.variables.getVariableById = vi.fn().mockReturnValue({
      valuesByMode: {
        "mode-light": { r: 0.85, g: 0.85, b: 0.85 },
        "mode-dark":  { r: 0.80, g: 0.80, b: 0.80 },
      },
    });

    const textNode = {
      type: "TEXT" as const,
      name: "LowContrast",
      visible: true,
      absoluteBoundingBox: { x: 10, y: 10, width: 100, height: 20 },
      fills: [{ type: "SOLID", visible: true, color: { r: 0.85, g: 0.85, b: 0.85 }, boundVariables: { color: { id: "var-2" } } }],
      children: [],
      parent: null as unknown,
    };
    const root = makeRootWithChildren([textNode]);
    textNode.parent = root;
    figmaMock.currentPage.selection = [root as unknown as ReturnType<typeof makeFrame>];
    send({ type: "capture-selection", mode: "single" });

    await vi.waitFor(() => {
      const call = (figmaMock.ui.postMessage as Mock).mock.calls.find(([m]) => m.type === "export-images");
      expect(call).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array index after .length guard
      const figmaA11y = call![0].payload.figmaA11y;
      expect(figmaA11y.contrast.length).toBeGreaterThan(0);
      expect(figmaA11y.contrast[0].is_dynamic).toBe(true);
    });
  });

  it("flags contrast with confidence:low when variable cannot be resolved", async () => {
    figmaMock.variables.getVariableById = vi.fn().mockReturnValue(null);

    const textNode = {
      type: "TEXT" as const,
      name: "UnresolvableVar",
      visible: true,
      absoluteBoundingBox: { x: 10, y: 10, width: 100, height: 20 },
      fills: [{ type: "SOLID", visible: true, color: { r: 0.85, g: 0.85, b: 0.85 }, boundVariables: { color: { id: "missing-var" } } }],
      children: [],
      parent: null as unknown,
    };
    const root = makeRootWithChildren([textNode]);
    textNode.parent = root;
    figmaMock.currentPage.selection = [root as unknown as ReturnType<typeof makeFrame>];
    send({ type: "capture-selection", mode: "single" });

    await vi.waitFor(() => {
      const call = (figmaMock.ui.postMessage as Mock).mock.calls.find(([m]) => m.type === "export-images");
      expect(call).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array index after .length guard
      const figmaA11y = call![0].payload.figmaA11y;
      expect(figmaA11y.contrast[0].confidence).toBe("low");
    });
  });
});

describe("sandbox — computeA11y: gradient fill skip (A3)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    figmaMock.fileKey = "test-file-key";
    figmaMock.ui.onmessage = null;
    vi.resetModules();
    await import("../../code");
  });

  it("emits no contrast check for a TEXT node with a gradient fill", async () => {
    const textNode = {
      type: "TEXT" as const,
      name: "GradientText",
      visible: true,
      absoluteBoundingBox: { x: 10, y: 10, width: 100, height: 20 },
      fills: [{ type: "GRADIENT_LINEAR", visible: true }],
      children: [],
      parent: null as unknown,
    };
    const root = makeRootWithChildren([textNode]);
    textNode.parent = root;
    figmaMock.currentPage.selection = [root as unknown as ReturnType<typeof makeFrame>];
    send({ type: "capture-selection", mode: "single" });

    await vi.waitFor(() => {
      const call = (figmaMock.ui.postMessage as Mock).mock.calls.find(([m]) => m.type === "export-images");
      expect(call).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array index after .length guard
      expect(call![0].payload.figmaA11y.contrast).toHaveLength(0);
    });
  });
});

describe("sandbox — computeA11y: INTERACTIVE_RE expansion (A4)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    figmaMock.fileKey = "test-file-key";
    figmaMock.ui.onmessage = null;
    vi.resetModules();
    await import("../../code");
  });

  it.each([
    ["pressable"],
    ["clickable"],
    ["select-option"],
  ])('flags a 24×24 component named "%s" as a touch target', async (name) => {
    const btn = {
      type: "COMPONENT" as const,
      name,
      visible: true,
      absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
      fills: [],
      children: [],
      parent: null as unknown,
    };
    const root = makeRootWithChildren([btn]);
    btn.parent = root;
    figmaMock.currentPage.selection = [root as unknown as ReturnType<typeof makeFrame>];
    send({ type: "capture-selection", mode: "single" });

    await vi.waitFor(() => {
      const call = (figmaMock.ui.postMessage as Mock).mock.calls.find(([m]) => m.type === "export-images");
      expect(call).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array index after .length guard
      expect(call![0].payload.figmaA11y.touch_targets.some((t: { element: string }) => t.element === name)).toBe(true);
    });
  });
});
