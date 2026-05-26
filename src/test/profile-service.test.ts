import { describe, it, expect } from "vitest";
import { validateAvatarFile } from "@/services/profile.service";

describe("validateAvatarFile", () => {
  const makeFile = (name: string, type: string, size: number) =>
    new File(["x".repeat(size)], name, { type });

  it("accepts a valid JPEG under 2 MB", () => {
    expect(() => validateAvatarFile(makeFile("a.jpg", "image/jpeg", 1_000_000))).not.toThrow();
  });

  it("accepts a valid PNG under 2 MB", () => {
    expect(() => validateAvatarFile(makeFile("a.png", "image/png", 500_000))).not.toThrow();
  });

  it("rejects files over 2 MB", () => {
    expect(() => validateAvatarFile(makeFile("a.jpg", "image/jpeg", 3_000_000))).toThrow("avatarFileTooLarge");
  });

  it("rejects non-image files", () => {
    expect(() => validateAvatarFile(makeFile("a.pdf", "application/pdf", 100))).toThrow("avatarInvalidType");
  });

  it("rejects GIF files", () => {
    expect(() => validateAvatarFile(makeFile("a.gif", "image/gif", 100))).toThrow("avatarInvalidType");
  });
});
