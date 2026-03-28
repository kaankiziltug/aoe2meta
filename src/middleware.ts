import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = () => new TextEncoder().encode(process.env.STAGING_JWT_SECRET ?? "fallback-dev-secret-change-me");

const STAGING_HOST = "staging.aoe2meta.com";
const PUBLIC_PATHS = ["/auth/login", "/auth/verify", "/api/auth/"];

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  // Only protect staging domain
  if (!host.includes(STAGING_HOST)) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Allow auth pages and API routes through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Check session cookie
  const session = request.cookies.get("staging_session")?.value;
  if (session) {
    try {
      await jwtVerify(session, secret());
      return NextResponse.next();
    } catch {
      // expired or invalid — fall through to redirect
    }
  }

  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
