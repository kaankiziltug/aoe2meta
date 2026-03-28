import { SignJWT, jwtVerify } from "jose";

const secret = () => new TextEncoder().encode(process.env.STAGING_JWT_SECRET ?? "fallback-dev-secret-change-me");

export const COOKIE_SESSION = "staging_session";
export const COOKIE_PENDING = "staging_otp_pending";

// ── OTP pending token (contains hashed OTP, expires in 5 min) ──────────────
export async function signOtpPending(otp: string): Promise<string> {
  return new SignJWT({ otp })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(secret());
}

export async function verifyOtpPending(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.otp as string) ?? null;
  } catch {
    return null;
  }
}

// ── Session token (valid 24h) ───────────────────────────────────────────────
export async function signSession(): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(secret());
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

// ── Credentials check ──────────────────────────────────────────────────────
export function checkCredentials(username: string, password: string): boolean {
  return (
    username === process.env.STAGING_USERNAME &&
    password === process.env.STAGING_PASSWORD
  );
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
