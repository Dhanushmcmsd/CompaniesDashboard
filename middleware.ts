import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (token.role === "PENDING") {
    return NextResponse.redirect(new URL("/login?error=pending", req.url));
  }

  if (pathname.startsWith("/dashboard") && !["MANAGEMENT", "ADMIN"].includes(token.role)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/upload") && !["EMPLOYEE", "ADMIN"].includes(token.role)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/upload/:path*", "/admin/:path*"],
};
