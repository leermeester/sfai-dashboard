import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

function getSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET must be set in production");
  }
  return new TextEncoder().encode(secret || "dev-secret-change-me");
}

function getCronSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("CRON_SECRET must be set in production");
  }
  return secret || "dev-secret-change-me";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page, API auth routes, and static assets
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Allow API routes that accept bearer token auth (cron, resolution, slack, voice)
  if (
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/resolution") ||
    pathname.startsWith("/api/slack") ||
    pathname.startsWith("/api/voice") ||
    pathname.startsWith("/api/capacity") ||
    pathname.startsWith("/api/settings")
  ) {
    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${getCronSecret()}`) {
      return NextResponse.next();
    }
    // Also allow if user has a valid session cookie (dashboard UI calls)
    const token = request.cookies.get("sfai-session")?.value;
    if (token) {
      try {
        await jwtVerify(token, getSecret());
        return NextResponse.next();
      } catch {
        // fall through to unauthorized
      }
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check session cookie
  const token = request.cookies.get("sfai-session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
