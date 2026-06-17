import { Button } from "@/components/ui/button";

/** Google "G" wordmark (official multi-color). Sized by Button's `[&_svg]:size-4`. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.6-.21-2.36H12v4.46h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.72Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.9l-3.88-3a7.2 7.2 0 0 1-10.79-3.78H1.26v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.32a7.2 7.2 0 0 1 0-4.64v-3.1H1.26a12 12 0 0 0 0 10.84l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.26 6.58l4.01 3.1A7.2 7.2 0 0 1 12 4.77Z"
      />
    </svg>
  );
}

/**
 * "Continue with Google" - a link (not a form action) to the server-side start route, which
 * 302s on to Google. `next` forwards the post-login deep-link from the login page.
 */
export function GoogleButton({
  next,
  label = "Continue with Google",
}: {
  next?: string | null;
  label?: string;
}) {
  const href = next ? `/api/auth/google/start?next=${encodeURIComponent(next)}` : "/api/auth/google/start";
  return (
    <Button asChild variant="outline" className="w-full">
      <a href={href}>
        <GoogleIcon />
        {label}
      </a>
    </Button>
  );
}
