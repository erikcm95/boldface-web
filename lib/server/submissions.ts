import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { DeckSummary } from "./deckPackage";
import { deleteFiles, listFiles, putFile, readFile, type StoredFile } from "./storage";

/**
 * Deck Library submissions.
 * - submissions/<id>.json  pending review (written once)
 * - library/<id>.json      approved, shown in the Deck Library (written once)
 * - decks/<name>-<random>.boldface  the deck file itself (unguessable URL)
 * Approving writes the library record and removes the pending one; rejecting removes both the
 * pending record and the file. No submitter email address is stored: it only goes into the
 * review email as Reply-To.
 */

export type Submission = {
  id: string;
  submittedAt: string;
  approvedAt?: string;
  author: string;           // optional display name ("" = anonymous)
  notes: string;            // note to the reviewer (pending only)
  fileName: string;
  size: number;
  file: StoredFile;
  summary: DeckSummary;
};

export type LibraryDeck = Omit<Submission, "notes">;

const ID_RE = /^[0-9a-f-]{36}$/;
export const validId = (id: string) => ID_RE.test(id);

function secret(): string | null {
  const s = process.env.ADMIN_SECRET;
  if (s && s.length >= 16) return s;
  return process.env.VERCEL ? null : "local-dev-admin-secret";
}
export const reviewEnabled = () => secret() !== null;

/** Signed token for a review link. `scope` is a submission id, or "admin" for the list page. */
export function reviewToken(scope: string): string {
  const s = secret();
  if (!s) throw new Error("ADMIN_SECRET is not set");
  return createHmac("sha256", s).update(`review:${scope}`).digest("base64url").slice(0, 32);
}
export function checkToken(scope: string, token: unknown): boolean {
  if (typeof token !== "string" || !secret()) return false;
  const a = Buffer.from(reviewToken(scope));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson<T>(f: StoredFile): Promise<T | null> {
  try { return JSON.parse(Buffer.from(await readFile(f)).toString("utf8")) as T; } catch { return null; }
}
const one = async (prefix: string) => (await listFiles(prefix)).find((f) => f.pathname === prefix) ?? null;

export async function savePending(sub: Submission) {
  await putFile(`submissions/${sub.id}.json`, new TextEncoder().encode(JSON.stringify(sub)), "application/json", false);
}

export async function getSubmission(id: string): Promise<{ sub: Submission; status: "pending" | "approved" } | null> {
  if (!validId(id)) return null;
  const lib = await one(`library/${id}.json`);
  if (lib) { const sub = await readJson<Submission>(lib); if (sub) return { sub: { ...sub, notes: sub.notes ?? "" }, status: "approved" }; }
  const pend = await one(`submissions/${id}.json`);
  if (pend) { const sub = await readJson<Submission>(pend); if (sub) return { sub, status: "pending" }; }
  return null;
}

async function readAll<T>(prefix: string): Promise<T[]> {
  const files = (await listFiles(prefix)).filter((f) => f.pathname.endsWith(".json"));
  return (await Promise.all(files.map((f) => readJson<T>(f)))).filter((x): x is Awaited<T> => !!x) as T[];
}

export async function listPending(): Promise<Submission[]> {
  return (await readAll<Submission>("submissions/")).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function listLibrary(): Promise<LibraryDeck[]> {
  return (await readAll<LibraryDeck>("library/")).sort((a, b) => (b.approvedAt || "").localeCompare(a.approvedAt || ""));
}

export async function approve(id: string): Promise<boolean> {
  const pend = await one(`submissions/${id}.json`);
  const sub = pend && (await readJson<Submission>(pend));
  if (!pend || !sub) return false;
  const { notes: _notes, ...rest } = sub;
  const entry: LibraryDeck = { ...rest, approvedAt: new Date().toISOString() };
  await putFile(`library/${id}.json`, new TextEncoder().encode(JSON.stringify(entry)), "application/json", false);
  await deleteFiles([pend]);
  return true;
}

/** Rejects a pending deck, or removes an approved one from the Library. Deletes the deck file. */
export async function remove(id: string): Promise<boolean> {
  const found = await getSubmission(id);
  if (!found) return false;
  const records = (await Promise.all([one(`submissions/${id}.json`), one(`library/${id}.json`)])).filter((f): f is StoredFile => !!f);
  await deleteFiles([...records, found.sub.file]);
  return true;
}
