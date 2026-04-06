import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { secretariatMembers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { SecretariatShell } from "./SecretariatShell";

export default async function SecretariatLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?role=secretariat");
  }

  // Server-side check: is this user actually a secretariat member?
  const [membership] = await db.select({ id: secretariatMembers.id })
    .from(secretariatMembers)
    .where(eq(secretariatMembers.userId, session.user.id))
    .limit(1);

  if (!membership) {
    // Not a secretariat member — send them back
    const userRole = (session.user as Record<string, unknown>).userRole as string || "filer";
    if (userRole.includes("filer")) redirect("/dashboard");
    if (userRole.includes("job_seeker")) redirect("/seeker/dashboard");
    redirect("/auth/login");
  }

  return <SecretariatShell>{children}</SecretariatShell>;
}
