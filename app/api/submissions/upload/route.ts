import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { MAX_DECK_BYTES } from "@/lib/server/deckPackage";
import { clientIp, limited } from "@/lib/server/rateLimit";
import { storageMode } from "@/lib/server/storage";

export const runtime = "nodejs";

/**
 * Issues a short-lived token so the browser can upload a .boldface file straight to Vercel Blob
 * (Vercel functions only accept request bodies up to 4.5 MB). The file is checked afterwards by
 * POST /api/submissions, which deletes anything that isn't a valid deck.
 */
export async function POST(req: Request) {
  if (storageMode() !== "blob") return NextResponse.json({ error: "Uploads aren’t available." }, { status: 503 });
  let body: HandleUploadBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (body.type === "blob.generate-client-token" && limited(`upload:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^decks\/[A-Za-z0-9_-]{1,60}\.boldface$/.test(pathname)) throw new Error("Invalid file name.");
        return {
          allowedContentTypes: ["application/octet-stream", "application/zip", "application/x-boldface-deck"],
          maximumSizeInBytes: MAX_DECK_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
