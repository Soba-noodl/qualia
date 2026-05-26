import { describe, it, expect } from "vitest";
import { resolveReportLanguage } from "../lib/resolveReportLanguage";

describe("resolveReportLanguage", () => {
  it("returns project language when explicitly set to English", () => {
    expect(resolveReportLanguage("English", "it")).toBe("English");
  });

  it("returns project language when explicitly set to Italian", () => {
    expect(resolveReportLanguage("Italian", "en")).toBe("Italian");
  });

  it("maps 'it' to Italian when project language is empty", () => {
    expect(resolveReportLanguage("", "it")).toBe("Italian");
  });

  it("maps 'en' to English when project language is empty", () => {
    expect(resolveReportLanguage("", "en")).toBe("English");
  });

  it("maps 'en' to English when project language is null/undefined", () => {
    expect(resolveReportLanguage(null as unknown as string, "en")).toBe("English");
    expect(resolveReportLanguage(undefined as unknown as string, "en")).toBe("English");
  });
});
