import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "../db/index";
import { users, households, householdInvites } from "../db/schema";
import { authMiddleware, type AuthVariables } from "../middleware/auth";

const household = new Hono<{ Variables: AuthVariables }>();

household.use(authMiddleware);

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const INVITE_CODE_LENGTH = 6;
const INVITE_TTL_DAYS = 7;

function generateInviteCode(): string {
  let out = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    out += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  }
  return out;
}

function inviteExpiry(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + INVITE_TTL_DAYS);
  return d;
}

async function resolveUserHouseholdId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.householdId ?? null;
}

// GET /api/household → current household + members + any pending invites the
// caller created.
household.get("/", async (c) => {
  const userId = c.get("userId");
  const householdId = await resolveUserHouseholdId(userId);
  if (!householdId) return c.json({ error: "No household" }, 404);

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.householdId, householdId))
    .orderBy(users.createdAt);

  const now = new Date();
  const pending = await db
    .select({
      id: householdInvites.id,
      code: householdInvites.code,
      expiresAt: householdInvites.expiresAt,
      inviterId: householdInvites.inviterId,
      createdAt: householdInvites.createdAt,
    })
    .from(householdInvites)
    .where(
      and(
        eq(householdInvites.householdId, householdId),
        isNull(householdInvites.acceptedAt),
        gt(householdInvites.expiresAt, now),
      ),
    )
    .orderBy(desc(householdInvites.createdAt));

  return c.json({
    id: householdId,
    members,
    pendingInvites: pending.map((p) => ({
      id: p.id,
      code: p.code,
      expiresAt: p.expiresAt.toISOString(),
      inviterId: p.inviterId,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

// POST /api/household/invites → create a 7-day code the caller can share.
household.post("/invites", async (c) => {
  const userId = c.get("userId");
  const householdId = await resolveUserHouseholdId(userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  // Retry on the exceedingly unlikely unique collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      const [row] = await db
        .insert(householdInvites)
        .values({
          householdId,
          inviterId: userId,
          code,
          expiresAt: inviteExpiry(),
        })
        .returning();
      return c.json({
        id: row.id,
        code: row.code,
        expiresAt: row.expiresAt.toISOString(),
      });
    } catch (err) {
      if (attempt === 4) {
        return c.json({ error: "Could not generate invite code" }, 500);
      }
    }
  }

  return c.json({ error: "Could not generate invite code" }, 500);
});

// POST /api/household/invites/accept { code } → join the invite's household.
household.post(
  "/invites/accept",
  zValidator(
    "json",
    z.object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .length(INVITE_CODE_LENGTH),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const { code } = c.req.valid("json");

    const [invite] = await db
      .select({
        id: householdInvites.id,
        householdId: householdInvites.householdId,
        expiresAt: householdInvites.expiresAt,
        acceptedAt: householdInvites.acceptedAt,
        inviterId: householdInvites.inviterId,
      })
      .from(householdInvites)
      .where(eq(householdInvites.code, code))
      .limit(1);

    if (!invite) return c.json({ error: "Invalid code" }, 404);
    if (invite.acceptedAt !== null) {
      return c.json({ error: "Invite already used" }, 410);
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return c.json({ error: "Invite has expired" }, 410);
    }

    const currentHouseholdId = await resolveUserHouseholdId(userId);
    if (currentHouseholdId === invite.householdId) {
      return c.json({ error: "You're already in this household" }, 409);
    }

    const previousHouseholdId = currentHouseholdId;

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ householdId: invite.householdId, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await tx
        .update(householdInvites)
        .set({ acceptedAt: new Date(), acceptedByUserId: userId })
        .where(eq(householdInvites.id, invite.id));

      // If the joiner's prior household is now empty, clean it up.
      if (previousHouseholdId && previousHouseholdId !== invite.householdId) {
        const [remaining] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.householdId, previousHouseholdId))
          .limit(1);
        if (!remaining) {
          await tx.delete(households).where(eq(households.id, previousHouseholdId));
        }
      }
    });

    return c.json({ householdId: invite.householdId });
  },
);

// DELETE /api/household/members/:id → remove a member from the current
// household. The removed user gets a fresh empty household of their own.
household.delete("/members/:id", async (c) => {
  const userId = c.get("userId");
  const targetId = c.req.param("id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
    return c.json({ error: "Invalid user id" }, 400);
  }

  const householdId = await resolveUserHouseholdId(userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const [target] = await db
    .select({ id: users.id, householdId: users.householdId })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);

  if (!target || target.householdId !== householdId) {
    return c.json({ error: "User is not in your household" }, 404);
  }

  await db.transaction(async (tx) => {
    const [fresh] = await tx.insert(households).values({}).returning();
    await tx
      .update(users)
      .set({ householdId: fresh.id, updatedAt: new Date() })
      .where(eq(users.id, targetId));
  });

  return c.json({ ok: true });
});

export { household };
