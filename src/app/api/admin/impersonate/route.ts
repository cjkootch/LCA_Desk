import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify caller is super admin OR is returning from impersonation
  const impersonatedBy = (session.user as Record<string, unknown>).impersonatedBy as string | null;
  const [admin] = await db.select({ isSuperAdmin: users.isSuperAdmin })
    .from(users).where(eq(users.id, session.user.id)).limit(1);

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Allow if: (a) caller is super admin, or (b) caller is impersonated and returning to their admin
  const isAdmin = !!admin?.isSuperAdmin;
  const isReturningToAdmin = !!impersonatedBy && userId === impersonatedBy;

  if (!isAdmin && !isReturningToAdmin) {
    // For return-to-admin, verify the original admin is actually a super admin
    if (impersonatedBy) {
      const [origAdmin] = await db.select({ isSuperAdmin: users.isSuperAdmin })
        .from(users).where(eq(users.id, impersonatedBy)).limit(1);
      if (!origAdmin?.isSuperAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Fetch the target user
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Create a JWT token for the target user with impersonation metadata
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const token = await encode({
    token: {
      id: target.id,
      name: target.name,
      email: target.email,
      isSuperAdmin: false, // Impersonated user should NOT have admin powers
      userRole: target.userRole || "filer",
      // Store the real admin ID so we can "return to admin"
      impersonatedBy: session.user.id,
    },
    secret,
    salt: "authjs.session-token",
  });

  // Determine the right redirect based on user role
  const role = target.userRole || "filer";
  let redirectTo = "/dashboard";
  if (role.includes("secretariat")) redirectTo = "/secretariat/dashboard";
  else if (role.includes("job_seeker")) redirectTo = "/seeker/dashboard";
  else if (role.includes("supplier")) redirectTo = "/supplier-portal/dashboard";

  // Set the session cookie
  const cookieStore = await cookies();
  const isSecure = process.env.NODE_ENV === "production";
  const cookieName = isSecure ? "__Secure-authjs.session-token" : "authjs.session-token";

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4, // 4 hours max for impersonation
  });

  return NextResponse.json({ success: true, redirectTo, targetName: target.name, targetEmail: target.email });
}
