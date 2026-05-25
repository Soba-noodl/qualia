import { describe, it, expect } from "vitest";
import { extractTitle, extractTag, extractCompany } from "./notion-query";

describe("extractTitle", () => {
  it("extracts the title from a Name property", () => {
    const page = { properties: { Name: { title: [{ plain_text: "Test Person" }] } } };
    expect(extractTitle(page)).toBe("Test Person");
  });

  it("handles a NBSP (\\u00a0) in the name", () => {
    const page = { properties: { Name: { title: [{ plain_text: "Test\u00a0Persontwo" }] } } };
    expect(extractTitle(page)).toBe("Test Persontwo");
  });

  it("returns empty when title missing", () => {
    expect(extractTitle({ properties: {} })).toBe("");
  });
});

describe("extractTag", () => {
  it("reads Qualia segment select value", () => {
    const page = { properties: { "Qualia segment": { select: { name: "in-house-designer" } } } };
    expect(extractTag(page)).toBe("in-house-designer");
  });

  it("returns null when property absent", () => {
    expect(extractTag({ properties: {} })).toBeNull();
  });

  it("returns null when select empty", () => {
    expect(extractTag({ properties: { "Qualia segment": { select: null } } })).toBeNull();
  });
});

describe("extractCompany", () => {
  it("reads Company rich_text value", () => {
    const page = { properties: { Company: { rich_text: [{ plain_text: "Intella" }] } } };
    expect(extractCompany(page)).toBe("Intella");
  });

  it("returns empty when Company missing", () => {
    expect(extractCompany({ properties: {} })).toBe("");
  });
});
