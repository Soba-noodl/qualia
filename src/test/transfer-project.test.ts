import { describe, it, expect } from "vitest";
import { assertTransferTarget } from "@/services/project.service";

describe("assertTransferTarget", () => {
  it("allows moving to the user's own org", () => {
    expect(() => assertTransferTarget("org-123", "org-123")).not.toThrow();
  });

  it("allows making personal (null orgId)", () => {
    expect(() => assertTransferTarget(null, "org-123")).not.toThrow();
  });

  it("allows moving when user has no org and target is null", () => {
    expect(() => assertTransferTarget(null, null)).not.toThrow();
  });

  it("throws when target org does not match user's org", () => {
    expect(() => assertTransferTarget("org-456", "org-123")).toThrow(
      "Cannot transfer project to an org you do not belong to"
    );
  });

  it("throws when user has no org but a non-null target is given", () => {
    expect(() => assertTransferTarget("org-456", null)).toThrow(
      "Cannot transfer project to an org you do not belong to"
    );
  });
});
