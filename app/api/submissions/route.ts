import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { MAX_DECK_BYTES, readDeckPackage } from "@/lib/server/deckPackage";
import { esc, sendEmail } from "@/lib/server/email";
import { clientIp, limited } from "@/lib/server/rateLimit";
import { deleteFiles, listFiles, putFile, readFile, storageMode, type StoredFile } from "@/lib/server/storage";
import { reviewEnabled, reviewToken, savePending, type Submission } from "@/lib/server/submissions";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const maxDuration = 60;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ATTACH_LIMIT = 15 * 1024 * 1024; // larger decks are linked instead of attached
const REVIEW_TO = () => process.env.SUBMISSIONS_TO || process.env.SUPPORT_TO || site.contactEmail;

/** Tells the Submit a Deck dialog how to upload. */
export async function GET() {
  const mode = storageMode() === "off" || !reviewEnabled() ? "off" : storageMode();
  return NextResponse.json({ mode, maxBytes: MAX_DECK_BYTES });
}

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const text = (v: FormDataEntryValue | unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  if (storageMode() === "off" || !reviewEnabled()) return fail("Deck submissions aren’t open yet.", 503);
  if (limited(`submit:${clientIp(req)}`, 5, 60 * 60 * 1000)) return fail("Too many submissions. Try again later.", 429);

  // Fields arrive as multipart (local mode, file included) or JSON (Blob mode, file already uploaded).
  let fields: Record<string, unknown>;
  let data: Uint8Array | null = null;
  let uploaded: StoredFile | null = null;
  let fileName = "";
  const isMultipart = (req.headers.get("content-type") || "").includes("multipart/form-data");
  try {
    if (isMultipart) {
      if (storageMode() !== "local") return fail("Invalid request.");
      const form = await req.formData();
      fields = Object.fromEntries(form.entries());
      const f = form.get("file");
      if (!(f instanceof File)) return fail("Choose a .boldface file.");
      if (f.size > MAX_DECK_BYTES) return fail("Decks can be up to 50 MB.");
      data = new Uint8Array(await f.arrayBuffer());
      fileName = f.name;
    } else {
      fields = await req.json();
      const pathname = text(fields.pathname, 300);
      if (!/^decks\/[^/]+\.boldface$/.test(pathname)) return fail("Invalid upload.");
      uploaded = (await listFiles(pathname)).find((x) => x.pathname === pathname) ?? null;
      if (!uploaded) return fail("The upload didn’t finish. Try again.");
      data = await readFile(uploaded);
      fileName = text(fields.fileName, 200) || pathname.slice(6);
    }
  } catch {
    return fail("Invalid request.");
  }

  const cleanup = () => (uploaded ? deleteFiles([uploaded]).catch(() => {}) : Promise.resolve());

  // Honeypot: bots fill the hidden field. Pretend success.
  if (text(fields.website, 200)) { await cleanup(); return NextResponse.json({ ok: true }); }

  const email = text(fields.email, 254);
  const author = text(fields.author, 60);
  const notes = text(fields.notes, 2000);
  if (!EMAIL_RE.test(email)) { await cleanup(); return fail("Enter a valid email address."); }
  if (fields.consent !== true && fields.consent !== "true" && fields.consent !== "on") {
    await cleanup(); return fail("Please confirm the deck can be shared publicly.");
  }

  let summary;
  try { summary = readDeckPackage(data!); } catch (e) { await cleanup(); return fail((e as Error).message); }

  const file = uploaded ?? (await putFile(`decks/${slug(summary.name)}.boldface`, data!, "application/octet-stream"));
  const sub: Submission = {
    id: randomUUID(),
    submittedAt: new Date().toISOString(),
    author,
    notes,
    fileName: fileName.toLowerCase().endsWith(".boldface") ? fileName : `${slug(summary.name)}.boldface`,
    size: data!.length,
    file,
    summary,
  };
  await savePending(sub);

  const origin = new URL(req.url).origin;
  const reviewUrl = `${origin}/review/${sub.id}?t=${reviewToken(sub.id)}`;
  const listUrl = `${origin}/review?t=${reviewToken("admin")}`;
  const sent = await sendEmail({
    to: REVIEW_TO(),
    replyTo: email,
    subject: `Deck submitted for review: ${summary.name}`,
    text: reviewText(sub, email, reviewUrl, listUrl),
    html: reviewHtml(sub, email, reviewUrl, listUrl),
    attachments: data!.length <= ATTACH_LIMIT ? [{ filename: sub.fileName, content: data! }] : [],
  });
  if (!sent) console.error(`Deck submission ${sub.id} saved but the review email failed. Review: ${reviewUrl}`);

  return NextResponse.json({ ok: true, name: summary.name, cards: summary.cardCount });
}

const slug = (s: string) => s.replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "Deck";
const mb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function reviewText(s: Submission, email: string, reviewUrl: string, listUrl: string) {
  const d = s.summary;
  return [
    `A deck was submitted to the BoldFace Deck Library.`,
    ``,
    `Deck: ${d.name}`,
    d.description && `Description: ${d.description}`,
    `Cards: ${d.cardCount} (${d.userCardCount} custom, ${d.imageCount} images)`,
    d.categories.length ? `Categories: ${d.categories.join(", ")}` : "",
    d.ratings.length ? `Ratings: ${d.ratings.join(", ")}` : "",
    `File: ${s.fileName} (${mb(s.size)})`,
    `Submitted by: ${s.author || "(no name)"} <${email}>  (reply to this email to reach them)`,
    s.notes && `\nNote from the submitter:\n${s.notes}`,
    ``,
    `First cards:`,
    ...d.sample.map((c, i) => `${i + 1}. Q: ${c.question}\n   A: ${c.answer}`),
    ``,
    `Approve or reject: ${reviewUrl}`,
    `All pending decks: ${listUrl}`,
    s.size > ATTACH_LIMIT ? `\nThe deck is too large to attach. Download it: ${s.file.downloadUrl}` : `\nThe deck is attached. Open it on your iPhone or iPad to try it in BoldFace.`,
  ].filter((x): x is string => typeof x === "string" && x !== "").join("\n");
}

function reviewHtml(s: Submission, email: string, reviewUrl: string, listUrl: string) {
  const d = s.summary;
  const row = (k: string, v: string) => `<tr><td style="padding:4px 14px 4px 0;color:#666;vertical-align:top">${k}</td><td style="padding:4px 0">${v}</td></tr>`;
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:620px">
<p style="margin:0 0 4px;color:#666">New Deck Library submission</p>
<h1 style="margin:0 0 14px;font-size:24px">${esc(d.name)}</h1>
${d.description ? `<p style="margin:0 0 14px">${esc(d.description)}</p>` : ""}
<table style="border-collapse:collapse;margin-bottom:16px">
${row("Cards", `${d.cardCount} (${d.userCardCount} custom, ${d.imageCount} images)`)}
${d.categories.length ? row("Categories", esc(d.categories.join(", "))) : ""}
${d.ratings.length ? row("Ratings", esc(d.ratings.join(", "))) : ""}
${row("File", `${esc(s.fileName)} (${mb(s.size)})`)}
${row("Submitted by", `${esc(s.author || "(no name)")} &lt;${esc(email)}&gt;<br><span style="color:#666">Reply to this email to reach them.</span>`)}
</table>
${s.notes ? `<p style="margin:0 0 4px;color:#666">Note from the submitter</p><p style="margin:0 0 16px;white-space:pre-wrap;background:#f5f5f5;padding:10px 12px;border-radius:8px">${esc(s.notes)}</p>` : ""}
<p style="margin:0 0 6px;color:#666">First cards</p>
<ol style="margin:0 0 20px;padding-left:20px">${d.sample.map((c) => `<li style="margin-bottom:8px"><strong>${esc(c.question)}</strong><br>${esc(c.answer)}</li>`).join("")}</ol>
<p style="margin:0 0 18px"><a href="${reviewUrl}" style="display:inline-block;background:#F2B544;color:#141414;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Review this deck</a></p>
<p style="margin:0 0 6px;color:#666;font-size:13px">${s.size > ATTACH_LIMIT ? `Too large to attach. <a href="${s.file.downloadUrl}">Download the deck</a>.` : "The deck is attached. Open it on your iPhone or iPad to try it in BoldFace."}</p>
<p style="margin:0;color:#666;font-size:13px"><a href="${listUrl}">All pending decks</a></p>
</div>`;
}
