import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { users } from "../db/schema";
import { authMiddleware, type AuthVariables } from "../middleware/auth";

const me = new Hono<{ Variables: AuthVariables }>();

me.use(authMiddleware);

me.get("/", async (c) => {
  const userId = c.get("userId");
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row) return c.json({ error: "User not found" }, 404);

  return c.json({
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    monthlyBudget: row.monthlyBudget !== null ? Number(row.monthlyBudget) : null,
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
