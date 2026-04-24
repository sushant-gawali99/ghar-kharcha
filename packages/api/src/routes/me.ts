import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { users, orders, orderItems } from "../db/schema";
import { authMiddleware, type AuthVariables } from "../middleware/auth";

const me = new Hono<{ Variables: AuthVariables }>();

me.use(authMiddleware);

me.get("/", async (c) => {
  const userId = c.get("userId");
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row) return c.json({ error: "User not found" }, 404);

  const [totals] = await db
    .select({
      totalInvoices: sql<string>`count(*)::text`,
    })
    .from(orders)
    .where(eq(orders.userId, userId));

  const [itemsAgg] = await db
    .select({
      totalItems: sql<string>`coalesce(count(${orderItems.id}), 0)::text`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orders.userId, userId));

  const [monthAgg] = await db
    .select({
      monthSpend: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        sql`date_trunc('month', ${orders.orderedAt}) = date_trunc('month', now())`,
      ),
    );

  return c.json({
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    monthlyBudget: row.monthlyBudget !== null ? Number(row.monthlyBudget) : null,
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

    const updates: { monthlyBudget?: string | null; name?: string; updatedAt?: Date } = {};
    if (body.monthlyBudget !== undefined) {
      updates.monthlyBudget = body.monthlyBudget === null ? null : body.monthlyBudget.toFixed(2);
    }
    if (body.name !== undefined) {
      updates.name = body.name;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }
    updates.updatedAt = new Date();

    const [row] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    if (!row) return c.json({ error: "User not found" }, 404);

    return c.json({
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatarUrl,
      monthlyBudget: row.monthlyBudget !== null ? Number(row.monthlyBudget) : null,
    });
  },
);

export { me };
