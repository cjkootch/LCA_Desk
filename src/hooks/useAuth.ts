"use client";

import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
import { useCallback } from "react";

export function useAuth() {
  const { data: session, status } = useSession();

  const signOut = useCallback(async () => {
    await nextAuthSignOut({ callbackUrl: "/auth/login" });
  }, []);

  return {
    user: session?.user ?? null,
    profile: session?.user
      ? {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.name,
          avatar_url: session.user.image,
        }
      : null,
    loading: status === "loading",
    signOut,
  };
}
