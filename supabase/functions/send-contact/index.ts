import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

const SEND_CONTACT_EXTRA_HEADERS = [
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
];

// Operator inbox that receives contact-form submissions. No literal
// fallback — must be set in env or the handler refuses to start. See
// docs/reviews/2026-05-23/privacy.md M-3.
const TO_EMAIL = Deno.env.get("CONTACT_EMAIL") ?? "";
const BCC_EMAIL = Deno.env.get("CONTACT_BCC_EMAIL") ?? "";

// Simple in-memory rate limiter (per IP, 1 request per 1 minute)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 1;               // 1 request per minute per IP
const ipRequests = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipRequests.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    ipRequests.set(ip, recent);
    return true;
  }
  recent.push(now);
  ipRequests.set(ip, recent);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req, SEND_CONTACT_EXTRA_HEADERS);
  }

  if (!TO_EMAIL) {
    throw new Error(
      "CONTACT_EMAIL env var required — set the operator inbox that receives contact-form submissions."
    );
  }

  try {
    // Rate limiting by IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...getCorsHeaders(req, SEND_CONTACT_EXTRA_HEADERS), "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 503, headers: { ...getCorsHeaders(req, SEND_CONTACT_EXTRA_HEADERS), "Content-Type": "application/json" } }
      );
    }

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    const body = await req.json() as { name?: string; email?: string; message?: string };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Missing name, email, or message" }),
        { status: 400, headers: { ...getCorsHeaders(req, SEND_CONTACT_EXTRA_HEADERS), "Content-Type": "application/json" } }
      );
    }

    // Basic email format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...getCorsHeaders(req, SEND_CONTACT_EXTRA_HEADERS), "Content-Type": "application/json" } }
      );
    }

    // Length limits
    if (name.length > 200 || email.length > 320 || message.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Input exceeds maximum length" }),
        { status: 400, headers: { ...getCorsHeaders(req, SEND_CONTACT_EXTRA_HEADERS), "Content-Type": "application/json" } }
      );
    }

    const from = Deno.env.get("RESEND_FROM_EMAIL") || "Qualia Contact <onboarding@resend.dev>";
    const subject = `[Qualia Contact] From ${name}`;
    const html = `
      <p><strong>From:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [TO_EMAIL],
        ...(BCC_EMAIL ? { bcc: [BCC_EMAIL] } : {}),
        reply_to: email,
        subject,
        html,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Resend error:", res.status, data);
      return new Response(
        JSON.stringify({ error: "Failed to send email. Please try again." }),
        { status: 502, headers: { ...getCorsHeaders(req, SEND_CONTACT_EXTRA_HEADERS), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...getCorsHeaders(req, SEND_CONTACT_EXTRA_HEADERS), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-contact error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req, SEND_CONTACT_EXTRA_HEADERS), "Content-Type": "application/json" } }
    );
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
