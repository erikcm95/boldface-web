import { readDeckImage } from "@/lib/server/deckPackage";
import { deckBytes } from "@/lib/server/reviewDeck";
import { checkToken, getSubmission } from "@/lib/server/submissions";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", webp: "image/webp", gif: "image/gif" };

/** Serves one photo from a submitted deck to the reviewer (signed review link required). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "";
  if (!checkToken(id, url.searchParams.get("t"))) return new Response("Not found", { status: 404 });
  const found = await getSubmission(id);
  if (!found) return new Response("Not found", { status: 404 });
  const img = readDeckImage(await deckBytes(found.sub.file), name);
  if (!img) return new Response("Not found", { status: 404 });
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return new Response(Buffer.from(img), {
    headers: {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
