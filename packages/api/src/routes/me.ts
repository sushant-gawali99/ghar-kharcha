import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index";
import { users, orders, orderItems, households } from "../db/schema";
import { authMiddleware, type AuthVariables } from "../middleware/auth";
import { getHouseholdId, getHouseholdMemberIds } from "../lib/household";

const me = new Hono<{ Variables: AuthVariables }>();

me.use(authMiddleware);

me.get("/", async (c) => {
  const userId = c.get("userId");
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row) return c.json({ error: "User not found" }, 404);

  let monthlyBudget: number | null = null;
  if (row.householdId) {
    const [hh] = await db
      .select({ monthlyBudget: households.monthlyBudget })
      .from(households)
      .where(eq(households.id, row.householdId))
      .limit(1);
    monthlyBudget = hh?.monthlyBudget !== null && hh?.monthlyBudget !== undefined ? Number(hh.monthlyBudget) : null;
  }

  const memberIds = await getHouseholdMemberIds(userId);

  const [totals] = await db
    .select({ totalInvoices: sql<string>`count(*)::text` })
    .from(orders)
    .where(inArray(orders.userId, memberIds));

  const [itemsAgg] = await db
    .select({ totalItems: sql<string>`coalesce(count(${orderItems.id}), 0)::text` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(inArray(orders.userId, memberIds));

  const [monthAgg] = await db
    .select({ monthSpend: sql<string>`coalesce(sum(${orders.total}), 0)::text` })
    .from(orders)
    .where(
      and(
        inArray(orders.userId, memberIds),
        sql`date_trunc('month', ${orders.orderedAt}) = date_trunc('month', now())`,
      ),
    );

  return c.json({
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    householdId: row.householdId,
    monthlyBudget,
    stats: {
      totalInvoices: Number(totals?.totalInvoices ?? 0),
      totalItems: Number(itemsAgg?.totalItems ?? 0),
      monthSpend: Number(monthAgg?.monthSpend ?? 0),
    },
  });
});

me.patch(
  "/",
  zValidator(
    "json",
    z.object({
      monthlyBudget: z
        .union([z.number().nonnegative(), z.null()])
        .optional(),
      name: z.string().trim().min(1).max(120).optional(),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");

    if (body.name !== undefined) {
      await db
        .update(users)
        .set({ name: body.name, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    if (body.monthlyBudget !== undefined) {
      const householdId = await getHouseholdId(userId);
      if (!householdId) {
        return c.json({ error: "User has no household" }, 400);
      }
      await db
        .update(households)
        .set({
          monthlyBudget: body.monthlyBudget === null ? null : body.monthlyBudget.toFixed(2),
        })
        .where(eq(households.id, householdId));
    }

    const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!row) return c.json({ error: "User not found" }, 404);

    let monthlyBudget: number | null = null;
    if (row.householdId) {
      const [hh] = await db
        .select({ monthlyBudget: households.monthlyBudget })
        .from(households)
        .where(eq(households.id, row.householdId))
        .limit(1);
      monthlyBudget = hh?.monthlyBudget !== null && hh?.monthlyBudget !== undefined ? Number(hh.monthlyBudget) : null;
    }

    return c.json({
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatarUrl,
      householdId: row.householdId,
      monthlyBudget,
    });
  },
);

export { me };
