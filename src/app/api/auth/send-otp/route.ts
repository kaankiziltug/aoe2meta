import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { checkCredentials, generateOtp, signOtpPending, COOKIE_PENDING } from "@/lib/staging-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!checkCredentials(username, password)) {
    await new Promise((r) => setTimeout(r, 500)); // timing-safe delay
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const otp = generateOtp();
  const pendingToken = await signOtpPending(otp);

  // Send OTP email
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "AoE2Meta Staging <noreply@aoe2meta.com>",
    to: process.env.STAGING_EMAIL!,
    subject: `Your staging login code: ${otp}`,
    html: `
      <div style="font-family:monospace;max-width:400px;margin:40px auto;padding:32px;border:1px solid #333;border-radius:8px;background:#111;color:#eee;">
        <h2 style="color:#f97316;margin:0 0 16px">AoE2Meta Staging</h2>
        <p style="color:#aaa;margin:0 0 24px">Your one-time login code:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#fff;margin:0 0 24px">${otp}</div>
        <p style="color:#666;font-size:12px;margin:0">Expires in 5 minutes. Do not share.</p>
      </div>
    `,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_PENDING, pendingToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 300, // 5 min
    path: "/",
  });
  return response;
}
