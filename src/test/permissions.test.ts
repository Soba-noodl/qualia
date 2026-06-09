import { describe, it, expect } from "vitest";
import { canManageProject } from "@/utils/permissions";

describe("canManageProject", () => {
  it("returns true for the project owner", () => {
    expect(canManageProject("user-1", "user-1", "admin-99")).toBe(true);
  });

  it("returns true for the org admin on someone else's project", () => {
    expect(canManageProject("admin-99", "user-1", "admin-99")).toBe(true);
  });

  it("returns false for a regular member", () => {
    expect(canManageProject("user-2", "user-1", "admin-99")).toBe(false);
  });

  it("returns false when userId is undefined", () => {
    expect(canManageProject(undefined, "user-1", "admin-99")).toBe(false);
  });

  it("returns true for owner even when orgOwnerId is undefined (personal project)", () => {
    expect(canManageProject("user-1", "user-1", undefined)).toBe(true);
  });

  it("returns false for non-owner when orgOwnerId is undefined", () => {
    expect(canManageProject("user-2", "user-1", undefined)).toBe(false);
  });
});
