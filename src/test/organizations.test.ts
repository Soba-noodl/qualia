import { describe, it, expect } from "vitest";
import { buildInviteToken, isTokenExpired } from "@/services/organizations.service";

describe("buildInviteToken", () => {
  it("returns a string of at least 32 characters", () => {
    const token = buildInviteToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it("returns different values on each call", () => {
    expect(buildInviteToken()).not.toBe(buildInviteToken());
  });
});

describe("isTokenExpired", () => {
  it("returns true when expiry is in the past", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isTokenExpired(past)).toBe(true);
  });

  it("returns false when expiry is in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isTokenExpired(future)).toBe(false);
  });
});
