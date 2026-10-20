import { NextResponse } from "next/server";
import { getSubmission } from "@/lib/server/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stable download link for an approved Library deck. The BoldFace app's "Open in BoldFace" link
 * (boldface://library/<id>) downloads from here, so the app never needs to know storage URLs.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const found = await getSubmission(id);
  if (!found || found.status !== "approved") return NextResponse.json({ error: "Deck not found." }, { status: 404 });
  return NextResponse.redirect(new URL(found.sub.file.downloadUrl, req.url), 302);
}
