import Link from "next/link";
import { prisma } from "@/server/db";
import { consumeToken } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Server component: validates the verify_email token, marks the email verified.
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let ok = false;
  if (token) {
    const userId = await consumeToken(token, "verify_email");
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: new Date() },
      });
      ok = true;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ok ? "Email confirmed" : "Verification failed"}</CardTitle>
        <CardDescription>
          {ok
            ? "Your email address has been verified. You're all set."
            : "This verification link is invalid or has expired."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full">
          <Link href={ok ? "/dashboard" : "/login"}>{ok ? "Go to dashboard" : "Back to log in"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
