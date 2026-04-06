import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isLoggedIn = !!session?.user;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = ((session?.user as any)?.userRole as string) ?? "filer";
  const roles = userRole.split(",");

  const isDashboard = nextUrl.pathname.startsWith("/dashboard");
  const isSeekerRoute = nextUrl.pathname.startsWith("/seeker");
  const isSupplierRoute = nextUrl.pathname.startsWith("/supplier-portal");
  const isSecretariatRoute = nextUrl.pathname.startsWith("/secretariat");

  // Protect compliance dashboard — requires filer or super_admin role
  if (isDashboard) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/auth/login", nextUrl));
    }
    const canAccess =
      roles.includes("filer") ||
      roles.includes("super_admin") ||
      (session?.user as any)?.isSuperAdmin;
    if (!canAccess) {
      if (roles.includes("job_seeker")) {
        return NextResponse.redirect(new URL("/seeker/dashboard", nextUrl));
      }
      if (roles.includes("supplier")) {
        return NextResponse.redirect(new URL("/supplier-portal/dashboard", nextUrl));
      }
      if (roles.includes("secretariat")) {
        return NextResponse.redirect(new URL("/secretariat/dashboard", nextUrl));
      }
      return NextResponse.redirect(new URL("/auth/login", nextUrl));
    }
  }

  if (isSecretariatRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/auth/login?role=secretariat", nextUrl));
  }

  if (isSeekerRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/auth/login?role=job_seeker", nextUrl));
  }

  if (isSupplierRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/auth/login?role=supplier", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/seeker/:path*", "/supplier-portal/:path*", "/secretariat/:path*"],
};
