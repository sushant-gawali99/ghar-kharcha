import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index";
import { auditEvents, refreshTokens, usedRefreshTokens, users } from "../db/schema";
import { generateRefreshToken, hashToken, refreshTokenExpiresAt } from "../lib/jwt";
import { auth } from "./auth";

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({ id, email: `${id}@test.local`, name: "Test" });
  return id;
}

describe("POST /api/auth/refresh", () => {
  const app = new Hono();
  app.route("/api/auth", auth);

  beforeEach(async () => {
    await db.delete(auditEvents);
    await db.delete(usedRefreshTokens);
    await db.delete(refreshTokens);
    await db.delete(users);
  });

  it("rotates refresh tokens and revokes the token family on old-token reuse", async () => {
    const userId = await makeUser();
    const familyId = randomUUID();
    const raw = generateRefreshToken();
    await db.insert(refreshTokens).values({
      userId,
      familyId,
      tokenHash: hashToken(raw),
      expiresAt: refreshTokenExpiresAt(),
    });

    const first = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: raw }),
    });
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.refreshToken).toBeTruthy();
    expect(firstBody.refreshToken).not.toBe(raw);

    const current = await db.query.refreshTokens.findMany({
      where: eq(refreshTokens.userId, userId),
    });
    expect(current).toHaveLength(1);
    expect(current[0].familyId).toBe(familyId);

    const reused = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: raw }),
    });
    expect(reused.status).toBe(401);
    expect(await db.query.refreshTokens.findMany({ where: eq(refreshTokens.userId, userId) })).toHaveLength(0);

    const audit = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.action, "auth.refresh_token_reuse_detected"),
    });
    expect(audit).toBeDefined();
  });
});
