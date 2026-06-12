import { NextResponse, type NextRequest } from "next/server";

// Edge middleware: cheap gate on the session-cookie's PRESENCE only — no DB/Prisma
// on the edge (D-012). The (app) layout does full DB validation and will bounce a
// stale/invalid cookie to /login. Authed users hitting an auth page go to /dashboard.

const SESSION_COOKIE = "spanly_session";

// Authenticated app sections. Everything else (marketing "/", /api/*, assets) is public.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/create",
  "/posts",
  "/calendar",
  "/connections",
  "/publishing",
  "/settings",
];

const AUTH_PAGES = ["/login", "/signup", "/forgot", "/reset", "/verify"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p);

  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
