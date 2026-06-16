/**
 * Turns a raw provider publish error (often a raw Graph / OAuth JSON blob) into a short,
 * human-readable message plus an actionable hint and a stable "kind". The publishing UI shows
 * the friendly message + hint and tucks the raw text behind a "technical details" disclosure.
 *
 * Kinds drive the recovery affordance:
 *   - "auth"       → the connection is expired/revoked → Reconnect
 *   - "permission" → the app isn't approved/authorized to publish → fix in the platform's app
 *                    settings; retrying won't help
 *   - "rate"       → temporarily rate-limited → wait and retry
 *   - "generic"    → unknown → retry
 */
export type PublishErrorKind = "auth" | "permission" | "rate" | "generic";

export interface FriendlyPublishError {
  message: string;
  hint?: string;
  kind: PublishErrorKind;
  raw: string;
}

interface GraphError {
  message: string;
  type?: string;
  code?: number;
}

/** Pull a `{ "error": { ... } }` body out of a wrapped error string, if present. */
function extractGraphError(raw: string): GraphError | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  try {
    const parsed = JSON.parse(raw.slice(start)) as { error?: GraphError };
    if (parsed.error && typeof parsed.error.message === "string") {
      return parsed.error;
    }
  } catch {
    /* not JSON — fall through */
  }
  return null;
}

/** Strip the "Provider … failed (400): " prefix some providers prepend. */
function stripPrefix(raw: string): string {
  return raw.replace(/^.*?failed\s*\(\d+\):\s*/i, "").trim() || raw.trim();
}

export function humanizePublishError(raw: string | null | undefined): FriendlyPublishError {
  if (!raw || !raw.trim()) {
    return { message: "Publishing failed.", kind: "generic", raw: "" };
  }

  const graph = extractGraphError(raw);

  if (graph) {
    const msg = graph.message;
    const code = graph.code;

    // App not authorized to publish for this user/page (Meta code 200, or the classic string).
    if (
      code === 200 ||
      code === 10 ||
      code === 803 ||
      /cannot call api for app .* on behalf of user/i.test(msg) ||
      /requires .* permission|permission.*not been granted|missing permission/i.test(msg)
    ) {
      return {
        message: "This account isn’t authorized to publish through the app yet.",
        hint:
          "Add this account as an Admin/Developer/Tester of the platform app, or submit the app for review to unlock publishing permissions (e.g. pages_manage_posts). Retrying won’t help until that’s done.",
        kind: "permission",
        raw,
      };
    }

    // Expired / invalidated token (Meta code 190, generic OAuth wording).
    if (
      code === 190 ||
      code === 102 ||
      /expired|session (has been )?invalidated|reauthor|re-?authenticate|invalid.*token/i.test(msg)
    ) {
      return {
        message: "Your connection to this account has expired.",
        hint: "Reconnect the account, then try again.",
        kind: "auth",
        raw,
      };
    }

    // Rate limiting (Meta codes 4 / 17 / 32 / 613, or wording).
    if (
      code === 4 ||
      code === 17 ||
      code === 32 ||
      code === 613 ||
      /rate ?limit|too many|reduce the amount/i.test(msg)
    ) {
      return {
        message: "The platform is rate-limiting posts right now.",
        hint: "Wait a few minutes, then retry.",
        kind: "rate",
        raw,
      };
    }

    // Known Graph error, but not one we special-case — at least show its clean message.
    return {
      message: msg,
      kind: graph.type === "OAuthException" ? "permission" : "generic",
      raw,
    };
  }

  // Non-Graph strings: detect auth wording so the card offers Reconnect.
  const text = stripPrefix(raw);
  if (/reconnect|authoriz|expired|unauthor|revoked/i.test(raw)) {
    return {
      message: text,
      hint: "Reconnect the account, then try again.",
      kind: "auth",
      raw,
    };
  }

  return { message: text, kind: "generic", raw };
}
