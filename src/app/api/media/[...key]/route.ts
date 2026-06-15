import { NextResponse } from "next/server";
import { fetchObject } from "@/server/storage";

// GET /api/media/<key...> — dev media proxy. Streams an object from storage (MinIO in dev)
// over the app's public origin so remote platforms can fetch media that physically lives on
// localhost. Set S3_PUBLIC_BASE_URL to "<public-origin>/api/media" to route uploads here.
// Harmless in production: when S3_PUBLIC_BASE_URL points at a public bucket/CDN, nothing
// generates URLs through this route.
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const objectKey = key.join("/");
  try {
    const { bytes, contentType } = await fetchObject(objectKey);
    return new Response(bytes, {
      headers: {
        "Content-Type": contentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
