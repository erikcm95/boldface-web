import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

type Attachment = { filename: string; content: Uint8Array };
type Email = { to: string; subject: string; text: string; html: string; replyTo?: string; attachments?: Attachment[] };

/**
 * Sends an email through Resend (RESEND_API_KEY + SUPPORT_FROM).
 * Locally without a key, the email is written to .data/outbox/ so the flow can be tested.
 * Returns false if it couldn't be sent.
 */
export async function sendEmail(e: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SUPPORT_FROM;
  if (!apiKey || !from) {
    if (process.env.VERCEL) { console.error("Email: RESEND_API_KEY or SUPPORT_FROM is not set"); return false; }
    const dir = path.join(process.cwd(), ".data", "outbox");
    await fs.mkdir(dir, { recursive: true });
    const base = path.join(dir, `${Date.now()}`);
    await fs.writeFile(`${base}.json`, JSON.stringify({ ...e, attachments: e.attachments?.map((a) => ({ filename: a.filename, bytes: a.content.length })) }, null, 2));
    for (const a of e.attachments || []) await fs.writeFile(`${base}-${a.filename}`, a.content);
    return true;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [e.to],
      ...(e.replyTo ? { reply_to: e.replyTo } : {}),
      subject: e.subject,
      text: e.text,
      html: e.html,
      ...(e.attachments?.length
        ? { attachments: e.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) }
        : {}),
    }),
  });
  if (!res.ok) console.error("Email: Resend error", res.status, await res.text().catch(() => ""));
  return res.ok;
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
