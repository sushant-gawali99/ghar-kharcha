import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index";
import { users, refreshTokens, households, usedRefreshTokens } from "../db/schema";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiresAt,
} from "../lib/jwt";
import { authMiddleware, type AuthVariables } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { logAuditEvent } from "../lib/audit";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const auth = new Hono<{ Variables: AuthVariables }>();

auth.use(
  "/google",
  rateLimit({ keyPrefix: "auth_google", windowMs: 60_000, max: 10 }),
);
auth.use(
  "/refresh",
  rateLimit({ keyPrefix: "auth_refresh", windowMs: 60_000, max: 30 }),
);

auth.post(
  "/google",
  zValidator("json", z.object({ idToken: z.string() })),
  async (c) => {
    const { idToken } = c.req.valid("json");

    // Verify the Google ID token
    let googlePayload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      googlePayload = ticket.getPayload();
    } catch {
      return c.json({ error: "Invalid Google token" }, 401);
    }

    if (!googlePayload?.sub || !googlePayload.email) {
      return c.json({ error: "Invalid Google token payload" }, 401);
    }

    // Upsert user
    const now = new Date();
    const [user] = await db
      .insert(users)
      .values({
        email: googlePayload.email,
        name: googlePayload.name ?? googlePayload.email,
        avatarUrl: googlePayload.picture ?? null,
        googleId: googlePayload.sub,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: googlePayload.name ?? googlePayload.email,
          avatarUrl: googlePayload.picture ?? null,
          googleId: googlePayload.sub,
          termsAcceptedAt: now,
          privacyAcceptedAt: now,
          updatedAt: new Date(),
        },
      })
      .returning();

    // New user (or pre-household backfill) without a household → create one.
    if (!user.householdId) {
      const [household] = await db.insert(households).values({}).returning();
      await db.update(users).set({ householdId: household.id }).where(eq(users.id, user.id));
      user.householdId = household.id;
    }

    // Issue tokens
    const accessToken = await signAccessToken(user.id);
    const rawRefreshToken = generateRefreshToken();
    const familyId = randomUUID();

    await db.insert(refreshTokens).values({
      userId: user.id,
      familyId,
      tokenHash: hashToken(rawRefreshToken),
      expiresAt: refreshTokenExpiresAt(),
    });
    await logAuditEvent(user.id, "auth.google_sign_in", {
      email: user.email,
    });

    return c.json({
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    });
  }
);

auth.post(
  "/refresh",
  zValidator("json", z.object({ refreshToken: z.string() })),
  async (c) => {
    const { refreshToken } = c.req.valid("json");
    const tokenHash = hashToken(refreshToken);

    const stored = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });

    if (!stored || stored.expiresAt < new Date()) {
      const used = await db.query.usedRefreshTokens.findFirst({
        where: eq(usedRefreshTokens.tokenHash, tokenHash),
      });
      if (used) {
        await db
          .delete(refreshTokens)
          .where(
            and(
              eq(refreshTokens.userId, used.userId),
              eq(refreshTokens.familyId, used.familyId),
            ),
          );
        await logAuditEvent(used.userId, "auth.refresh_token_reuse_detected", {
          familyId: used.familyId,
        });
      }
      return c.json({ error: "Invalid or expired refresh token" }, 401);
    }

    // Rotate: delete old, issue new
    await db.transaction(async (tx) => {
      await tx.insert(usedRefreshTokens).values({
        userId: stored.userId,
        familyId: stored.familyId,
        tokenHash,
      });
      await tx
        .delete(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash));
    });

    const rawNewRefreshToken = generateRefreshToken();
    await db.insert(refreshTokens).values({
      userId: stored.userId,
      familyId: stored.familyId,
      tokenHash: hashToken(rawNewRefreshToken),
      expiresAt: refreshTokenExpiresAt(),
    });

    const accessToken = await signAccessToken(stored.userId);
    await logAuditEvent(stored.userId, "auth.refresh_token_rotated", {
      familyId: stored.familyId,
    });

    return c.json({ accessToken, refreshToken: rawNewRefreshToken });
  }
);

auth.post("/logout", authMiddleware, async (c) => {
  const userId = c.get("userId");
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  await logAuditEvent(userId, "auth.logout");
  return c.json({ success: true });
});

export { auth };
