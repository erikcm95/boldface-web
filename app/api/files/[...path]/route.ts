import { readLocal, storageMode } from "@/lib/server/storage";

export const runtime = "nodejs";

/** Development only: serves files saved in .data/ when no Vercel Blob store is connected. */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (storageMode() !== "local") return new Response("Not found", { status: 404 });
  const p = (await ctx.params).path.map(decodeURIComponent).join("/");
  const data = await readLocal(p);
  if (!data) return new Response("Not found", { status: 404 });
  const name = p.split("/").pop() || "file";
  const download = new URL(req.url).searchParams.has("download");
  return new Response(Buffer.from(data), {
    headers: {
      "Content-Type": p.endsWith(".json") ? "application/json" : "application/octet-stream",
      ...(download ? { "Content-Disposition": `attachment; filename="${name}"` } : {}),
    },
  });
}
