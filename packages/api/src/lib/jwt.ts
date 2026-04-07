import { SignJWT } from "jose";
import { createHash, randomBytes } from "node:crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-in-production"
);

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(JWT_SECRET);
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}
