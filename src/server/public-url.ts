/**
 * Public origin of the app for absolute OAuth redirect URLs (docs/implementation/05).
 *
 * Prefers APP_URL / NEXTAUTH_URL, which must be set to the externally reachable origin
 * (e.g. an ngrok tunnel or the deployed domain). Behind a reverse proxy the request host
 * often resolves to the upstream address (localhost:3000), which would produce an invalid
 * OAuth `redirect_uri` that the provider rejects - so the configured public URL wins, with
 * the request origin only as a last-resort fallback for plain localhost dev.
 */
export function publicOrigin(req: Request): string {
  const env = process.env.APP_URL ?? process.env.NEXTAUTH_URL;
  if (env) return env.replace(/\/$/, "");
  return new URL(req.url).origin;
}
