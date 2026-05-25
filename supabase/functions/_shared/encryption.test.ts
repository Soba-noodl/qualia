import { assertEquals, assertNotEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { encrypt, decrypt, isEncrypted } from "./encryption.ts";

const VALID_KEY = "test-key-must-be-at-least-32-chars-long-yes";
const ANOTHER_KEY = "different-but-also-32-chars-long-test-key!";

Deno.test("encrypt/decrypt: roundtrip preserves plaintext", async () => {
  const plaintext = "my-secret-api-key-AIzaSyABCDEFG";
  const encrypted = await encrypt(plaintext, VALID_KEY);
  const decrypted = await decrypt(encrypted, VALID_KEY);
  assertEquals(decrypted, plaintext);
});

Deno.test("encrypt: produces different ciphertext each call (random IV)", async () => {
  const plaintext = "same input";
  const c1 = await encrypt(plaintext, VALID_KEY);
  const c2 = await encrypt(plaintext, VALID_KEY);
  assertNotEquals(c1, c2);
});

Deno.test("decrypt: fails with wrong key", async () => {
  const encrypted = await encrypt("payload", VALID_KEY);
  await assertRejects(() => decrypt(encrypted, ANOTHER_KEY));
});

Deno.test("encrypt: rejects keys shorter than 32 chars", async () => {
  await assertRejects(
    () => encrypt("hello", "too-short"),
    Error,
    "must be at least 32 characters",
  );
});

Deno.test("decrypt: rejects keys shorter than 32 chars", async () => {
  const encrypted = await encrypt("hello", VALID_KEY);
  await assertRejects(
    () => decrypt(encrypted, "too-short"),
    Error,
    "must be at least 32 characters",
  );
});

Deno.test("isEncrypted: returns false for figd_-prefixed Figma PATs", () => {
  assertEquals(isEncrypted("figd_abc123def456"), false);
});

Deno.test("isEncrypted: returns false for empty string", () => {
  assertEquals(isEncrypted(""), false);
});

Deno.test("isEncrypted: returns false for short plaintext", () => {
  assertEquals(isEncrypted("abc"), false);
});

Deno.test("isEncrypted: returns true for actual encrypted output", async () => {
  const encrypted = await encrypt("test-payload", VALID_KEY);
  assertEquals(isEncrypted(encrypted), true);
});

Deno.test("encrypt: handles empty plaintext", async () => {
  const encrypted = await encrypt("", VALID_KEY);
  const decrypted = await decrypt(encrypted, VALID_KEY);
  assertEquals(decrypted, "");
});

Deno.test("encrypt: handles unicode characters", async () => {
  const plaintext = "héllo 🔐 wörld 中文";
  const encrypted = await encrypt(plaintext, VALID_KEY);
  const decrypted = await decrypt(encrypted, VALID_KEY);
  assertEquals(decrypted, plaintext);
});
