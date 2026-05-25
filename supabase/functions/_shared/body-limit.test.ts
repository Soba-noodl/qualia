import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB, BODY_LIMIT_5MB } from "./body-limit.ts";

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/fn", {
    method: "POST",
    headers,
  });
}

Deno.test("enforceBodyLimit: returns null when content-length is absent", () => {
  const result = enforceBodyLimit(makeReq(), BODY_LIMIT_1MB);
  assertEquals(result, null);
});

Deno.test("enforceBodyLimit: returns null when content-length is below limit", () => {
  const result = enforceBodyLimit(
    makeReq({ "content-length": String(BODY_LIMIT_1MB - 1) }),
    BODY_LIMIT_1MB,
  );
  assertEquals(result, null);
});

Deno.test("enforceBodyLimit: returns null when content-length equals limit", () => {
  const result = enforceBodyLimit(
    makeReq({ "content-length": String(BODY_LIMIT_1MB) }),
    BODY_LIMIT_1MB,
  );
  assertEquals(result, null);
});

Deno.test("enforceBodyLimit: returns 413 Response when content-length exceeds limit", async () => {
  const result = enforceBodyLimit(
    makeReq({ "content-length": String(BODY_LIMIT_1MB + 1) }),
    BODY_LIMIT_1MB,
  );
  assertNotEquals(result, null);
  assertEquals(result!.status, 413);
  const body = await result!.json();
  assertEquals(body.error, "FILE_TOO_LARGE");
});

Deno.test("enforceBodyLimit: 5MB limit accepts payloads <5MB", () => {
  const result = enforceBodyLimit(
    makeReq({ "content-length": String(4 * 1024 * 1024) }),
    BODY_LIMIT_5MB,
  );
  assertEquals(result, null);
});

Deno.test("enforceBodyLimit: 5MB limit rejects 6MB", async () => {
  const result = enforceBodyLimit(
    makeReq({ "content-length": String(6 * 1024 * 1024) }),
    BODY_LIMIT_5MB,
  );
  assertNotEquals(result, null);
  assertEquals(result!.status, 413);
});

Deno.test("enforceBodyLimit: ignores non-numeric content-length", () => {
  const result = enforceBodyLimit(
    makeReq({ "content-length": "not-a-number" }),
    BODY_LIMIT_1MB,
  );
  assertEquals(result, null);
});

Deno.test("constants: 1MB = 1048576", () => {
  assertEquals(BODY_LIMIT_1MB, 1 * 1024 * 1024);
});

Deno.test("constants: 5MB = 5242880", () => {
  assertEquals(BODY_LIMIT_5MB, 5 * 1024 * 1024);
});
