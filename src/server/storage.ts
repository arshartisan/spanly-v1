import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";

/**
 * Object storage (docs/implementation/00 + 06). Media is uploaded straight from the
 * browser to S3/R2 (MinIO in dev) via a short-lived presigned PUT URL - the app never
 * proxies the bytes. We only persist the resulting public URL on the Media row.
 */

const ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const REGION = process.env.S3_REGION ?? "auto";
const BUCKET = process.env.S3_BUCKET ?? "spanly-media";
const PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL ?? `${ENDPOINT}/${BUCKET}`;

// `forcePathStyle` is required for MinIO (and any non-AWS S3) since it doesn't do
// virtual-hosted-style buckets by default.
const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
  },
});

const PRESIGN_TTL_SECONDS = 5 * 60;

/** Derive a collision-free object key, preserving the original extension. */
function objectKey(userId: string, filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const id = randomBytes(16).toString("hex");
  return `uploads/${userId}/${id}${ext}`;
}

export interface PresignedUpload {
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

/** Presign a direct-to-S3 PUT for one media object. */
export async function presignUpload(opts: {
  userId: string;
  filename: string;
  mimeType: string;
}): Promise<PresignedUpload> {
  const key = objectKey(opts.userId, opts.filename);
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: opts.mimeType }),
    { expiresIn: PRESIGN_TTL_SECONDS },
  );
  return { key, uploadUrl, publicUrl: `${PUBLIC_BASE_URL}/${key}` };
}

export interface FetchedObject {
  bytes: ArrayBuffer;
  contentType?: string;
}

/**
 * Read one object's bytes from storage. Used by the dev media-proxy route so locally-stored
 * media (MinIO on localhost) can be served over the app's public origin - remote platforms
 * (e.g. Instagram) fetch media by URL and can't reach localhost. In production
 * S3_PUBLIC_BASE_URL points straight at the CDN/bucket and the proxy route is unused.
 */
export async function fetchObject(key: string): Promise<FetchedObject> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!res.Body) throw new Error(`Object not found: ${key}`);
  const arr = await res.Body.transformToByteArray();
  // Copy into a standalone ArrayBuffer (a valid BodyInit) - the SDK's view may be backed by
  // a pooled/Shared buffer.
  const bytes = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
  return { bytes, contentType: res.ContentType };
}
