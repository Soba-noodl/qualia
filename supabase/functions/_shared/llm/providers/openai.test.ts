import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stub } from "https://deno.land/std@0.224.0/testing/mock.ts";
import { callOpenAI } from "./openai.ts";

Deno.test("callOpenAI: posts to api.openai.com chat/completions with bearer auth", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
      usage: { prompt_tokens: 8, completion_tokens: 4 },
    }), { status: 200 }))
  );
  try {
    const res = await callOpenAI({ apiKey: "sk-proj-test", model: "gpt-5.4", systemPrompt: "s", userMessage: "u", imageUrls: [] });
    assertEquals(res.content, '{"ok":true}');
    const [url, init] = fetchStub.calls[0].args;
    assertEquals(String(url), "https://api.openai.com/v1/chat/completions");
    const headers = (init as RequestInit).headers as Record<string, string>;
    assertEquals(headers.Authorization, "Bearer sk-proj-test");
    const body = JSON.parse((init as RequestInit).body as string);
    assertEquals(body.response_format.type, "json_object");
    assertEquals(body.model, "gpt-5.4");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callOpenAI: includes images + labels in user content", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: "" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    }), { status: 200 }))
  );
  try {
    await callOpenAI({
      apiKey: "k",
      model: "gpt-5.4",
      systemPrompt: "",
      userMessage: "u",
      imageUrls: ["https://example.com/a.png", "https://example.com/b.png"],
      imageLabels: ["Frame A", "Frame B"],
    });
    const body = JSON.parse((fetchStub.calls[0].args[1] as RequestInit).body as string);
    const userContent = body.messages[1].content;
    // text + label + image + label + image = 5
    assertEquals(userContent.length, 5);
    assertEquals(userContent[1].text, "Frame A");
    assertEquals(userContent[2].image_url.url, "https://example.com/a.png");
    assertEquals(userContent[3].text, "Frame B");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callOpenAI: appends contextUrls after main images", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: "" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    }), { status: 200 }))
  );
  try {
    await callOpenAI({
      apiKey: "k",
      model: "gpt-5.4",
      systemPrompt: "",
      userMessage: "u",
      imageUrls: ["https://example.com/main.png"],
      contextUrls: ["https://example.com/ctx.png"],
    });
    const body = JSON.parse((fetchStub.calls[0].args[1] as RequestInit).body as string);
    const userContent = body.messages[1].content;
    assertEquals(userContent.length, 3);
    assertEquals(userContent[1].image_url.url, "https://example.com/main.png");
    assertEquals(userContent[2].image_url.url, "https://example.com/ctx.png");
  } finally {
    fetchStub.restore();
  }
});
