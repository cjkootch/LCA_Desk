import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

declare module "next-auth" {
  interface User {
    isSuperAdmin?: boolean;
    userRole?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(8),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const db = getDb();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1);

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!valid) return null;

        // Track last login
        db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).catch((err) => {
          console.error(`[auth] Failed to update lastLoginAt for user ${user.id}:`, err instanceof Error ? err.message : err);
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin ?? false,
          userRole: user.userRole ?? "filer",
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnAdmin = nextUrl.pathname.startsWith("/dashboard/admin");

      if (isOnAdmin) {
        // Block admin access at the middleware level — must be logged in
        // Fine-grained super_admin check happens server-side in the page
        if (!isLoggedIn) return false;
        return true;
      }

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false;
      }
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).isSuperAdmin = user.isSuperAdmin ?? false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).userRole = (user as any).userRole ?? "filer";
      }
      // Handle session updates (e.g. name change from profile settings)
      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.name) session.user.name = token.name as string;
      if (token.email) session.user.email = token.email as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).isSuperAdmin = (token as any).isSuperAdmin ?? false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).userRole = (token as any).userRole ?? "filer";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).impersonatedBy = (token as any).impersonatedBy ?? null;
      return session;
    },
  },
});
