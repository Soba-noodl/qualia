import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stub } from "https://deno.land/std@0.224.0/testing/mock.ts";
import { callGemini } from "./gemini.ts";
import { LLMRateLimitError, LLMInvalidKeyError, LLMBillingError } from "../errors.ts";

Deno.test("callGemini: posts to OpenAI-compat endpoint with bearer auth + correct body", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }), { status: 200 }))
  );
  try {
    const res = await callGemini({
      apiKey: "AIza-test",
      model: "gemini-3-flash-preview",
      systemPrompt: "sys",
      userMessage: "user",
      imageUrls: [],
      maxTokens: 100,
    });
    assertEquals(res.content, '{"ok":true}');
    assertEquals(res.usage.prompt_tokens, 10);
    assertEquals(res.finishReason, "stop");
    assertEquals(fetchStub.calls.length, 1);
    const [url, init] = fetchStub.calls[0].args;
    assertEquals(String(url), "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    const headers = (init as RequestInit).headers as Record<string, string>;
    assertEquals(headers.Authorization, "Bearer AIza-test");
    const body = JSON.parse((init as RequestInit).body as string);
    assertEquals(body.model, "gemini-3-flash-preview");
    assertEquals(body.max_tokens, 100);
    assertEquals(body.response_format.type, "json_object");
    assertEquals(body.messages[0].role, "system");
    assertEquals(body.messages[1].role, "user");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callGemini: includes image_url entries when imageUrls provided", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }), { status: 200 }))
  );
  try {
    await callGemini({
      apiKey: "k",
      model: "gemini-3-flash-preview",
      systemPrompt: "",
      userMessage: "u",
      imageUrls: ["https://example.com/a.png", "https://example.com/b.png"],
    });
    const body = JSON.parse((fetchStub.calls[0].args[1] as RequestInit).body as string);
    const userContent = body.messages[1].content;
    // 1 text + 2 images = 3 entries
    assertEquals(userContent.length, 3);
    assertEquals(userContent[0].type, "text");
    assertEquals(userContent[1].type, "image_url");
    assertEquals(userContent[1].image_url.url, "https://example.com/a.png");
    assertEquals(userContent[2].type, "image_url");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callGemini: interleaves image labels when provided", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }), { status: 200 }))
  );
  try {
    await callGemini({
      apiKey: "k",
      model: "gemini-3-flash-preview",
      systemPrompt: "",
      userMessage: "u",
      imageUrls: ["https://example.com/a.png"],
      imageLabels: ["Frame 1"],
    });
    const body = JSON.parse((fetchStub.calls[0].args[1] as RequestInit).body as string);
    const userContent = body.messages[1].content;
    // 1 text + 1 label + 1 image = 3 entries
    assertEquals(userContent.length, 3);
    assertEquals(userContent[1].type, "text");
    assertEquals(userContent[1].text, "Frame 1");
    assertEquals(userContent[2].type, "image_url");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callGemini: 401 → LLMInvalidKeyError", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Unauthorized", { status: 401 }))
  );
  try {
    await assertRejects(
      () => callGemini({ apiKey: "bad", model: "gemini-3-flash-preview", systemPrompt: "", userMessage: "", imageUrls: [], maxAttempts: 1 }),
      LLMInvalidKeyError,
    );
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callGemini: 402 → LLMBillingError", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Quota exceeded", { status: 402 }))
  );
  try {
    await assertRejects(
      () => callGemini({ apiKey: "k", model: "gemini-3-flash-preview", systemPrompt: "", userMessage: "", imageUrls: [], maxAttempts: 1 }),
      LLMBillingError,
    );
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callGemini: 429 after retries → LLMRateLimitError with retry hint from header", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Too many", { status: 429, headers: { "retry-after": "30" } }))
  );
  try {
    const err = await assertRejects(
      () => callGemini({ apiKey: "k", model: "gemini-3-flash-preview", systemPrompt: "", userMessage: "", imageUrls: [], maxAttempts: 1 }),
      LLMRateLimitError,
    );
    assertEquals(err.retryAfterSec, 30);
    assertEquals(err.provider, "gemini");
  } finally {
    fetchStub.restore();
  }
});
