import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { users, refreshTokens, households } from "../db/schema";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiresAt,
} from "../lib/jwt";
import { authMiddleware, type AuthVariables } from "../middleware/auth";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const auth = new Hono<{ Variables: AuthVariables }>();

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
    const [user] = await db
      .insert(users)
      .values({
        email: googlePayload.email,
        name: googlePayload.name ?? googlePayload.email,
        avatarUrl: googlePayload.picture ?? null,
        googleId: googlePayload.sub,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: googlePayload.name ?? googlePayload.email,
          avatarUrl: googlePayload.picture ?? null,
          googleId: googlePayload.sub,
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

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(rawRefreshToken),
      expiresAt: refreshTokenExpiresAt(),
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
      return c.json({ error: "Invalid or expired refresh token" }, 401);
    }

    // Rotate: delete old, issue new
    await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash));

    const rawNewRefreshToken = generateRefreshToken();
    await db.insert(refreshTokens).values({
      userId: stored.userId,
      tokenHash: hashToken(rawNewRefreshToken),
      expiresAt: refreshTokenExpiresAt(),
    });

    const accessToken = await signAccessToken(stored.userId);

    return c.json({ accessToken, refreshToken: rawNewRefreshToken });
  }
);

auth.post("/logout", authMiddleware, async (c) => {
  const userId = c.get("userId");
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  return c.json({ success: true });
});

export { auth };
