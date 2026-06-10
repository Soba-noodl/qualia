import type { LLMProvider } from "./pricing.ts";

interface LLMErrorInit {
  provider?: LLMProvider;
  retryAfterSec?: number;
  message?: string;
  reason?: string;
}

export abstract class LLMError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  provider?: LLMProvider;
  retryAfterSec?: number;
  reason?: string;
  constructor(init: LLMErrorInit = {}) {
    super(init.message ?? "");
    this.provider = init.provider;
    this.retryAfterSec = init.retryAfterSec;
    this.reason = init.reason;
  }
}

export class LLMNoKeyError extends LLMError {
  readonly code = "no_key";
  readonly httpStatus = 402; // payment-method (key) required
}

export class LLMInvalidKeyError extends LLMError {
  readonly code = "invalid_key";
  readonly httpStatus = 401;
}

export class LLMRateLimitError extends LLMError {
  readonly code = "rate_limit";
  readonly httpStatus = 429;
}

export class LLMBillingError extends LLMError {
  readonly code = "billing_block";
  readonly httpStatus = 402;
}

export class LLMProviderError extends LLMError {
  readonly code = "provider_error";
  readonly httpStatus = 502;
}

export class LLMRequestError extends LLMError {
  readonly code = "bad_request";
  readonly httpStatus = 400;
}

export function toJsonResponse(e: LLMError): { status: number; body: string } {
  return {
    status: e.httpStatus,
    body: JSON.stringify({
      error: e.code,
      provider: e.provider ?? null,
      retry_after_sec: e.retryAfterSec,
      message: e.message || undefined,
      reason: e.reason,
    }),
  };
}
