import { NextRequest, NextResponse } from "next/server";
import { verifyOtpPending, signSession, COOKIE_PENDING, COOKIE_SESSION } from "@/lib/staging-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { otp, redirectTo } = await request.json();

  const pendingToken = request.cookies.get(COOKIE_PENDING)?.value;
  if (!pendingToken) {
    return NextResponse.json({ error: "No pending OTP — start over" }, { status: 400 });
  }

  const expectedOtp = await verifyOtpPending(pendingToken);
  if (!expectedOtp || otp.trim() !== expectedOtp) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  const sessionToken = await signSession();
  const response = NextResponse.json({ ok: true, redirectTo: redirectTo ?? "/" });

  response.cookies.set(COOKIE_SESSION, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24h
    path: "/",
  });
  response.cookies.delete(COOKIE_PENDING);
  return response;
}
