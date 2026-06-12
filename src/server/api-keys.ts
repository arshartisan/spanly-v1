import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { ApiKey, Subscription } from "@prisma/client";
import { prisma } from "@/server/db";
import type { GateResult } from "@/server/plans";

/**
 * API key service (docs/implementation, design doc 12). Keys grant programmatic access to the
 * public v1 API. We store only sha256(secret) + a non-secret prefix and last-4; the plaintext
 * is returned exactly once at creation and never persisted. All key actions are gated behind
 * the paid API add-on (enforced server-side, never on the client alone).
 */

const KEY_PREFIX = "spb_live";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** The API add-on gate (doc 12). Active subscription + apiAddonActive required. */
export function requireApiAddon(sub: Subscription | null): GateResult {
  if (!sub || sub.status === "canceled") {
    return { ok: false, status: 402, error: "No active subscription." };
  }
  if (!sub.apiAddonActive) {
    return { ok: false, status: 402, error: "API access requires the API add-on. Enable it in Billing." };
  }
  return { ok: true };
}

export interface ApiKeyView {
  id: string;
  name: string;
  maskedKey: string; // e.g. "spb_live_••••1a2b"
  createdAt: string;
  lastUsedAt: string | null;
}

function toView(k: ApiKey): ApiKeyView {
  return {
    id: k.id,
    name: k.name,
    maskedKey: `${k.prefix}_••••${k.last4}`,
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
  };
}

/** Active (non-revoked) keys for the user, newest first. */
export async function listApiKeys(userId: string): Promise<ApiKeyView[]> {
  const keys = await prisma.apiKey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return keys.map(toView);
}

/** Mint a new key. Returns the plaintext ONCE plus the stored view. */
export async function createApiKey(
  userId: string,
  name: string,
): Promise<{ plaintext: string; key: ApiKeyView }> {
  const secret = `${KEY_PREFIX}_${randomBytes(24).toString("hex")}`;
  const record = await prisma.apiKey.create({
    data: {
      userId,
      name,
      prefix: KEY_PREFIX,
      last4: secret.slice(-4),
      hashedKey: sha256(secret),
    },
  });
  return { plaintext: secret, key: toView(record) };
}

/** Revoke a key the user owns. Returns false if it isn't theirs / already gone. */
export async function revokeApiKey(userId: string, id: string): Promise<boolean> {
  const res = await prisma.apiKey.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

/**
 * Authenticate a request by raw API key. Returns the owning userId (and stamps lastUsedAt), or
 * null if the key is unknown/revoked. The caller still enforces the add-on gate on the owner.
 */
export async function authenticateApiKey(rawKey: string): Promise<string | null> {
  if (!rawKey.startsWith(`${KEY_PREFIX}_`)) return null;
  const key = await prisma.apiKey.findUnique({ where: { hashedKey: sha256(rawKey) } });
  if (!key || key.revokedAt) return null;
  // Best-effort usage stamp; never block auth on it.
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return key.userId;
}

export type ApiAuthResult = { ok: true; userId: string } | { ok: false; status: number; error: string };

/**
 * Authorize a public v1 API request: `Authorization: Bearer <key>` → valid key → owner has the
 * API add-on. Used by every `/api/v1/*` handler.
 */
export async function authorizeApiRequest(req: Request): Promise<ApiAuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) {
    return { ok: false, status: 401, error: "Missing API key. Use 'Authorization: Bearer <key>'." };
  }
  const userId = await authenticateApiKey(m[1].trim());
  if (!userId) return { ok: false, status: 401, error: "Invalid or revoked API key." };

  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const gate = requireApiAddon(sub);
  if (!gate.ok) return { ok: false, status: gate.status, error: gate.error };
  return { ok: true, userId };
}
