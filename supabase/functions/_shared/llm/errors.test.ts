import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  LLMNoKeyError,
  LLMInvalidKeyError,
  LLMRateLimitError,
  LLMBillingError,
  LLMProviderError,
  LLMRequestError,
  toJsonResponse,
} from "./errors.ts";

Deno.test("error: LLMNoKeyError has code=no_key and httpStatus=402", () => {
  const e = new LLMNoKeyError();
  assertEquals(e.code, "no_key");
  assertEquals(e.httpStatus, 402);
});

Deno.test("error: LLMInvalidKeyError carries provider", () => {
  const e = new LLMInvalidKeyError({ provider: "anthropic" });
  assertEquals(e.code, "invalid_key");
  assertEquals(e.httpStatus, 401);
  assertEquals(e.provider, "anthropic");
});

Deno.test("error: LLMRateLimitError carries retryAfterSec + provider", () => {
  const e = new LLMRateLimitError({ provider: "anthropic", retryAfterSec: 47 });
  assertEquals(e.code, "rate_limit");
  assertEquals(e.provider, "anthropic");
  assertEquals(e.retryAfterSec, 47);
});

Deno.test("error: LLMBillingError code=billing_block httpStatus=402", () => {
  const e = new LLMBillingError({ provider: "openai" });
  assertEquals(e.code, "billing_block");
  assertEquals(e.httpStatus, 402);
});

Deno.test("error: LLMProviderError code=provider_error httpStatus=502", () => {
  const e = new LLMProviderError({ provider: "gemini" });
  assertEquals(e.code, "provider_error");
  assertEquals(e.httpStatus, 502);
});

Deno.test("error: LLMRequestError code=bad_request httpStatus=400", () => {
  const e = new LLMRequestError();
  assertEquals(e.code, "bad_request");
  assertEquals(e.httpStatus, 400);
});

Deno.test("toJsonResponse: shape matches spec for LLMBillingError", () => {
  const e = new LLMBillingError({ provider: "openai", message: "Out of credit" });
  const r = toJsonResponse(e);
  assertEquals(r.status, 402);
  const body = JSON.parse(r.body);
  assertEquals(body.error, "billing_block");
  assertEquals(body.provider, "openai");
  assertEquals(body.message, "Out of credit");
});

Deno.test("toJsonResponse: omits retry_after_sec when not set", () => {
  const e = new LLMNoKeyError();
  const r = toJsonResponse(e);
  const body = JSON.parse(r.body);
  assertEquals(body.error, "no_key");
  assertEquals(body.provider, null);
  assertEquals(body.retry_after_sec, undefined);
});
