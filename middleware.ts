import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  return updateSession(req);
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
