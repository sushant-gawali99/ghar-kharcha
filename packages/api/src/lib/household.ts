import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { users } from "../db/schema";

/**
 * Returns the IDs of all users who share a household with `userId`, including
 * `userId` itself. Used to scope ledger queries: a household member can see
 * any order/upload/item created by any other member.
 *
 * If the user is not attached to a household yet (shouldn't happen after the
 * 0002 migration + auth flow), falls back to just [userId] so queries still
 * work and the caller isn't surprised by an empty array.
 */
export async function getHouseholdMemberIds(userId: string): Promise<string[]> {
  const me = await db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const householdId = me[0]?.householdId;
  if (!householdId) return [userId];

  const members = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.householdId, householdId));

  const ids = members.map((m) => m.id);
  return ids.length > 0 ? ids : [userId];
}

/**
 * Returns the user's household id (never null — creates one would be caller's
 * job; this just reads).
 */
export async function getHouseholdId(userId: string): Promise<string | null> {
  const row = await db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row[0]?.householdId ?? null;
}
