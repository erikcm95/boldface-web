import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readFile, type StoredFile } from "./storage";

// Small cache so a review page with many photos downloads the deck once, not once per photo.
const cache = new Map<string, { at: number; data: Uint8Array }>();
export async function deckBytes(file: StoredFile): Promise<Uint8Array> {
  const hit = cache.get(file.pathname);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.data;
  const data = await readFile(file);
  cache.set(file.pathname, { at: Date.now(), data });
  while (cache.size > 4) cache.delete(cache.keys().next().value!);
  return data;
}

let builtIns: Map<string, any> | null = null;
/** BoldFace's built-in cards (public/data/flashcards.json), keyed by id. */
export async function builtInCards() {
  if (builtIns) return builtIns;
  const raw = await fs.readFile(path.join(process.cwd(), "public", "data", "flashcards.json"), "utf8");
  builtIns = new Map(JSON.parse(raw).cards.map((c: any) => [c.id, c]));
  return builtIns;
}
