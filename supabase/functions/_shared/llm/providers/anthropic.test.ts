import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stub } from "https://deno.land/std@0.224.0/testing/mock.ts";
import { callAnthropic } from "./anthropic.ts";

Deno.test("callAnthropic: posts to api.anthropic.com OpenAI-compat URL with bearer + anthropic-version header", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }), { status: 200 }))
  );
  try {
    const res = await callAnthropic({
      apiKey: "sk-ant-test",
      model: "claude-opus-4-7",
      systemPrompt: "s",
      userMessage: "u",
      imageUrls: [],
    });
    assertEquals(res.content, '{"ok":true}');
    const [url, init] = fetchStub.calls[0].args;
    assertEquals(String(url), "https://api.anthropic.com/v1/chat/completions");
    const headers = (init as RequestInit).headers as Record<string, string>;
    assertEquals(headers.Authorization, "Bearer sk-ant-test");
    assertEquals(headers["anthropic-version"], "2023-06-01");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callAnthropic: does NOT send response_format or reasoning_effort (Anthropic compat ignores them)", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: "" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    }), { status: 200 }))
  );
  try {
    await callAnthropic({
      apiKey: "k",
      model: "claude-opus-4-7",
      systemPrompt: "s",
      userMessage: "u",
      imageUrls: [],
    });
    const body = JSON.parse((fetchStub.calls[0].args[1] as RequestInit).body as string);
    assertEquals(body.response_format, undefined);
    assertEquals(body.reasoning_effort, undefined);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callAnthropic: caps temperature at 1", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: "" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    }), { status: 200 }))
  );
  try {
    await callAnthropic({ apiKey:"k", model:"claude-opus-4-7", systemPrompt:"", userMessage:"", imageUrls:[], temperature: 1.5 });
    const body = JSON.parse((fetchStub.calls[0].args[1] as RequestInit).body as string);
    assertEquals(body.temperature, 1);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callAnthropic: omits temperature when not provided (default behavior)", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: "" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    }), { status: 200 }))
  );
  try {
    await callAnthropic({ apiKey:"k", model:"claude-opus-4-7", systemPrompt:"", userMessage:"", imageUrls:[] });
    const body = JSON.parse((fetchStub.calls[0].args[1] as RequestInit).body as string);
    assertEquals(body.temperature, undefined);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callAnthropic: includes images in user message content", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: "" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    }), { status: 200 }))
  );
  try {
    await callAnthropic({
      apiKey: "k",
      model: "claude-opus-4-7",
      systemPrompt: "",
      userMessage: "u",
      imageUrls: ["https://example.com/a.png"],
    });
    const body = JSON.parse((fetchStub.calls[0].args[1] as RequestInit).body as string);
    const userContent = body.messages[1].content;
    assertEquals(userContent.length, 2);
    assertEquals(userContent[1].type, "image_url");
  } finally {
    fetchStub.restore();
  }
});
