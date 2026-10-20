import { readDeckImage } from "@/lib/server/deckPackage";
import { deckBytes } from "@/lib/server/reviewDeck";
import { getSubmission } from "@/lib/server/submissions";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", webp: "image/webp", gif: "image/gif" };

/** One photo from an approved Library deck. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const name = new URL(req.url).searchParams.get("name") || "";
  const found = await getSubmission(id);
  if (!found || found.status !== "approved") return new Response("Not found", { status: 404 });
  const img = readDeckImage(await deckBytes(found.sub.file), name);
  if (!img) return new Response("Not found", { status: 404 });
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return new Response(Buffer.from(img), {
    headers: {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
