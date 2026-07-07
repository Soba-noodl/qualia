import { describe, it, expect } from "vitest";
import { isValidKeyFormat } from "./llm-key-format";

describe("isValidKeyFormat — gemini", () => {
  it("accepts a new Google auth key (AQ. prefix)", () => {
    // Google AI Studio issues these exclusively to new users since 2026.
    // Synthetic shape-only fixture — never a real credential.
    expect(isValidKeyFormat("gemini", "AQ.FAKE_synthetic_gemini_auth_key_for_tests")).toBe(true);
  });

  it("still accepts a legacy standard key (AIza prefix)", () => {
    expect(isValidKeyFormat("gemini", "AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q")).toBe(true);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidKeyFormat("gemini", "  AQ.FAKE_synthetic_trimmed_value  ")).toBe(true);
  });

  it("rejects an obviously non-key value", () => {
    expect(isValidKeyFormat("gemini", "not a real key")).toBe(false);
  });

  it("rejects an OpenAI key pasted into the Gemini field", () => {
    expect(isValidKeyFormat("gemini", "sk-proj-abc123")).toBe(false);
  });
});

describe("isValidKeyFormat — openai", () => {
  it("accepts an sk-proj key", () => {
    expect(isValidKeyFormat("openai", "sk-proj-abcDEF123_-")).toBe(true);
  });

  it("rejects a Gemini key pasted into the OpenAI field", () => {
    expect(isValidKeyFormat("openai", "AIzaSyABC")).toBe(false);
  });
});
