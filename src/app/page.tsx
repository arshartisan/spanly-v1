import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";

// Root entry: send authenticated users to the app, everyone else to login.
// (A public marketing landing can replace this later under a (marketing) group.)
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
