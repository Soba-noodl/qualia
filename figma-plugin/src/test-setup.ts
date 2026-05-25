import "@testing-library/jest-dom";

// Mock window.parent.postMessage — used by all plugin UI views
const mockParentPostMessage = vi.fn();
Object.defineProperty(window, "parent", {
  value: { postMessage: mockParentPostMessage },
  writable: true,
});

// Expose on globalThis so tests can reset/inspect it
(globalThis as Record<string, unknown>).__mockParentPostMessage = mockParentPostMessage;

beforeEach(() => {
  mockParentPostMessage.mockClear();
});
