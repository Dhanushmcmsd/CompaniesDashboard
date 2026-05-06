import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function roleHome(role: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "EMPLOYEE") return "/upload";
  if (role === "MANAGEMENT") return "/dashboard";
  return "/login";
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (token.role === "PENDING") {
    return NextResponse.redirect(new URL("/login?error=pending", req.url));
  }

  if (pathname.startsWith("/admin")) {
    if (token.role !== "ADMIN") {
      return NextResponse.redirect(new URL(roleHome(token.role), req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/upload")) {
    if (token.role !== "EMPLOYEE") {
      return NextResponse.redirect(new URL(roleHome(token.role), req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard")) {
    if (token.role !== "MANAGEMENT") {
      return NextResponse.redirect(new URL(roleHome(token.role), req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/upload/:path*", "/admin/:path*"],
};
