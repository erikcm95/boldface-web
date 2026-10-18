import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Simple per-instance rate limit: 5 messages per IP per 10 minutes.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function POST(req: Request) {
  let body: { email?: unknown; message?: unknown; website?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: bots fill the hidden field. Pretend success.
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  if (!message || message.length > 5000) return NextResponse.json({ error: "Invalid message." }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many messages. Try again later." }, { status: 429 });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SUPPORT_FROM;
  const to = process.env.SUPPORT_TO || "boldfaceaviation@gmail.com";
  if (!apiKey || !from) {
    console.error("Support form: RESEND_API_KEY or SUPPORT_FROM is not set");
    return NextResponse.json({ error: "Support email is not configured yet." }, { status: 503 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: `BoldFace support: ${message.slice(0, 60).replace(/\s+/g, " ")}`,
      text: `From: ${email}\n\n${message}`,
      html: `<p><strong>From:</strong> ${esc(email)}</p><p style="white-space:pre-wrap">${esc(message)}</p>`,
    }),
  });

  if (!res.ok) {
    console.error("Support form: Resend error", res.status, await res.text().catch(() => ""));
    return NextResponse.json({ error: "Could not send." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
