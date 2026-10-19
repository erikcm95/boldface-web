import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { del, list, put } from "@vercel/blob";

/**
 * File storage for Deck Library submissions.
 * - On Vercel: Vercel Blob (needs BLOB_READ_WRITE_TOKEN, added automatically when a Blob store
 *   is connected to the project).
 * - Locally without a token: files under .data/ served by /api/files/... (development only).
 */

export type StoredFile = { url: string; downloadUrl: string; pathname: string };

export const storageMode = (): "blob" | "local" | "off" =>
  process.env.BLOB_READ_WRITE_TOKEN ? "blob" : process.env.VERCEL ? "off" : "local";

const LOCAL_ROOT = path.join(process.cwd(), ".data", "blob");
const rand = () => Math.random().toString(36).slice(2, 10);

function localUrl(p: string) {
  return { url: `/api/files/${p}`, downloadUrl: `/api/files/${p}?download=1`, pathname: p };
}

/**
 * Saves a file. Each file is written once and never overwritten (so the Blob CDN never serves a
 * stale copy). `random` adds a suffix so the URL can't be guessed.
 */
export async function putFile(pathname: string, data: Uint8Array, contentType: string, random = true): Promise<StoredFile> {
  if (storageMode() === "blob") {
    const r = await put(pathname, Buffer.from(data), { access: "public", addRandomSuffix: random, contentType });
    return { url: r.url, downloadUrl: r.downloadUrl, pathname: r.pathname };
  }
  const ext = path.extname(pathname);
  const p = random ? `${pathname.slice(0, pathname.length - ext.length)}-${rand()}${ext}` : pathname;
  await fs.mkdir(path.dirname(path.join(LOCAL_ROOT, p)), { recursive: true });
  await fs.writeFile(path.join(LOCAL_ROOT, p), data);
  return localUrl(p);
}

/** Lists stored files whose pathname starts with `prefix`. */
export async function listFiles(prefix: string): Promise<StoredFile[]> {
  if (storageMode() === "blob") {
    const out: StoredFile[] = [];
    let cursor: string | undefined;
    do {
      const r = await list({ prefix, cursor, limit: 1000 });
      out.push(...r.blobs.map((b) => ({ url: b.url, downloadUrl: b.downloadUrl, pathname: b.pathname })));
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return out;
  }
  const out: StoredFile[] = [];
  async function walk(dir: string) {
    let entries: import("node:fs").Dirent[] = [];
    try { entries = await fs.readdir(path.join(LOCAL_ROOT, dir), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(rel);
      else if (rel.startsWith(prefix)) out.push(localUrl(rel));
    }
  }
  await walk(prefix.split("/").slice(0, -1).join("/"));
  return out;
}

export async function deleteFiles(files: StoredFile[]) {
  if (!files.length) return;
  if (storageMode() === "blob") { await del(files.map((f) => f.url)); return; }
  await Promise.all(files.map((f) => fs.rm(path.join(LOCAL_ROOT, f.pathname), { force: true })));
}

export async function readFile(file: StoredFile): Promise<Uint8Array> {
  if (storageMode() === "blob") {
    const res = await fetch(file.url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not read ${file.pathname} (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  return new Uint8Array(await fs.readFile(path.join(LOCAL_ROOT, file.pathname)));
}

/** Local development only: read a file by pathname for /api/files. */
export async function readLocal(pathname: string): Promise<Uint8Array | null> {
  const full = path.join(LOCAL_ROOT, pathname);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) return null;
  try { return new Uint8Array(await fs.readFile(full)); } catch { return null; }
}
