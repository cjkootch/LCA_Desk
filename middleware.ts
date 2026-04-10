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
  const isAffiliateRoute = nextUrl.pathname.startsWith("/affiliate");

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

  // Protect secretariat portal — requires secretariat role
  if (isSecretariatRoute) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/auth/login?role=secretariat", nextUrl));
    }
    const canAccess =
      roles.includes("secretariat") ||
      roles.includes("super_admin") ||
      (session?.user as any)?.isSuperAdmin;
    if (!canAccess) {
      // Redirect unauthorized users back to their proper portal
      if (roles.includes("filer")) {
        return NextResponse.redirect(new URL("/dashboard", nextUrl));
      }
      if (roles.includes("job_seeker")) {
        return NextResponse.redirect(new URL("/seeker/dashboard", nextUrl));
      }
      return NextResponse.redirect(new URL("/auth/login", nextUrl));
    }
  }

  // Protect affiliate portal — requires affiliate role
  if (isAffiliateRoute) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/auth/login", nextUrl));
    }
    const canAccess =
      roles.includes("affiliate") ||
      roles.includes("super_admin") ||
      (session?.user as any)?.isSuperAdmin;
    if (!canAccess) {
      if (roles.includes("filer")) {
        return NextResponse.redirect(new URL("/dashboard", nextUrl));
      }
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

  if (isSeekerRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/auth/login?role=job_seeker", nextUrl));
  }

  if (isSupplierRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/auth/login?role=supplier", nextUrl));
  }

  // Pass pathname to server components (for paywall check in layout)
  const response = NextResponse.next();
  response.headers.set("x-pathname", nextUrl.pathname);
  return response;
});

export const config = {
  matcher: ["/dashboard/:path*", "/seeker/:path*", "/supplier-portal/:path*", "/secretariat/:path*", "/affiliate/:path*"],
};
