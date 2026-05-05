import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index";
import { users, orders, orderItems, households, refreshTokens, uploads } from "../db/schema";
import { authMiddleware, type AuthVariables } from "../middleware/auth";
import { getHouseholdId, getHouseholdMemberIds } from "../lib/household";
import { deleteUpload } from "../lib/uploadStorage";
import { logAuditEvent } from "../lib/audit";

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
    onboardedAt: row.onboardedAt ? row.onboardedAt.toISOString() : null,
    termsAcceptedAt: row.termsAcceptedAt ? row.termsAcceptedAt.toISOString() : null,
    privacyAcceptedAt: row.privacyAcceptedAt ? row.privacyAcceptedAt.toISOString() : null,
    aiProcessingConsentAt: row.aiProcessingConsentAt ? row.aiProcessingConsentAt.toISOString() : null,
    monthlyBudget,
    stats: {
      totalInvoices: Number(totals?.totalInvoices ?? 0),
      totalItems: Number(itemsAgg?.totalItems ?? 0),
      monthSpend: Number(monthAgg?.monthSpend ?? 0),
    },
  });
});

me.get("/export", async (c) => {
  const userId = c.get("userId");
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row) return c.json({ error: "User not found" }, 404);

  const household = row.householdId
    ? await db.query.households.findFirst({ where: eq(households.id, row.householdId) })
    : null;

  const householdMembers = row.householdId
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.householdId, row.householdId))
        .orderBy(asc(users.createdAt))
    : [];

  const uploadRows = await db
    .select({
      id: uploads.id,
      filename: uploads.filename,
      status: uploads.status,
      errorMessage: uploads.errorMessage,
      createdAt: uploads.createdAt,
    })
    .from(uploads)
    .where(eq(uploads.userId, userId))
    .orderBy(asc(uploads.createdAt));

  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(asc(orders.orderedAt));

  const orderIds = orderRows.map((order) => order.id);
  const itemRows = orderIds.length > 0
    ? await db
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds))
        .orderBy(asc(orderItems.orderId), asc(orderItems.name))
    : [];

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const bucket = itemsByOrder.get(item.orderId) ?? [];
    bucket.push(item);
    itemsByOrder.set(item.orderId, bucket);
  }

  const sessions = await db
    .select({
      id: refreshTokens.id,
      createdAt: refreshTokens.createdAt,
      expiresAt: refreshTokens.expiresAt,
    })
    .from(refreshTokens)
    .where(eq(refreshTokens.userId, userId))
    .orderBy(asc(refreshTokens.createdAt));

  await logAuditEvent(userId, "account.exported", {
    orderCount: orderRows.length,
    uploadCount: uploadRows.length,
  });

  return c.json({
    generatedAt: new Date().toISOString(),
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatarUrl,
      googleId: row.googleId,
      householdId: row.householdId,
      onboardedAt: row.onboardedAt?.toISOString() ?? null,
      termsAcceptedAt: row.termsAcceptedAt?.toISOString() ?? null,
      privacyAcceptedAt: row.privacyAcceptedAt?.toISOString() ?? null,
      aiProcessingConsentAt: row.aiProcessingConsentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    household: household
      ? {
          id: household.id,
          monthlyBudget: household.monthlyBudget === null ? null : Number(household.monthlyBudget),
          createdAt: household.createdAt.toISOString(),
          members: householdMembers.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            avatarUrl: member.avatarUrl,
            createdAt: member.createdAt.toISOString(),
          })),
        }
      : null,
    uploads: uploadRows.map((upload) => ({
      id: upload.id,
      filename: upload.filename,
      status: upload.status,
      errorMessage: upload.errorMessage,
      createdAt: upload.createdAt.toISOString(),
    })),
    orders: orderRows.map((order) => ({
      id: order.id,
      uploadId: order.uploadId,
      platform: order.platform,
      invoiceNo: order.invoiceNo,
      orderNo: order.orderNo,
      orderedAt: order.orderedAt.toISOString(),
      itemTotal: Number(order.itemTotal),
      handlingFee: Number(order.handlingFee),
      deliveryFee: Number(order.deliveryFee),
      taxes: Number(order.taxes),
      discounts: Number(order.discounts),
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        unit: item.unit,
        hsn: item.hsn,
        mrp: Number(item.mrp),
        productRate: Number(item.productRate),
        discount: Number(item.discount),
        taxableAmount: Number(item.taxableAmount),
        cgst: Number(item.cgst),
        sgst: Number(item.sgst),
        cess: Number(item.cess),
        totalAmount: Number(item.totalAmount),
        category: item.category,
      })),
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    })),
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
      onboarded: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const userUpdate: { name?: string; onboardedAt?: Date | null; updatedAt?: Date } = {};
    if (body.name !== undefined) userUpdate.name = body.name;
    if (body.onboarded === true) userUpdate.onboardedAt = new Date();
    if (Object.keys(userUpdate).length > 0) {
      userUpdate.updatedAt = new Date();
      await db.update(users).set(userUpdate).where(eq(users.id, userId));
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

    await logAuditEvent(userId, "account.profile_updated", {
      monthlyBudgetChanged: body.monthlyBudget !== undefined,
      nameChanged: body.name !== undefined,
      onboardedChanged: body.onboarded !== undefined,
    });

    return c.json({
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatarUrl,
      householdId: row.householdId,
      onboardedAt: row.onboardedAt ? row.onboardedAt.toISOString() : null,
      termsAcceptedAt: row.termsAcceptedAt ? row.termsAcceptedAt.toISOString() : null,
      privacyAcceptedAt: row.privacyAcceptedAt ? row.privacyAcceptedAt.toISOString() : null,
      aiProcessingConsentAt: row.aiProcessingConsentAt ? row.aiProcessingConsentAt.toISOString() : null,
      monthlyBudget,
    });
  },
);

me.delete("/", async (c) => {
  const userId = c.get("userId");
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row) return c.json({ error: "User not found" }, 404);

  const userUploads = await db.query.uploads.findMany({
    where: eq(uploads.userId, userId),
  });
  await logAuditEvent(userId, "account.deleted", {
    uploadCount: userUploads.length,
  });

  await db.transaction(async (tx) => {
    await tx.delete(orders).where(eq(orders.userId, userId));
    await tx.delete(uploads).where(eq(uploads.userId, userId));
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));

    if (row.householdId) {
      const [remaining] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.householdId, row.householdId))
        .limit(1);
      if (!remaining) {
        await tx.delete(households).where(eq(households.id, row.householdId));
      }
    }
  });

  await Promise.all(userUploads.map((upload) => deleteUpload(upload.storageKey)));

  return c.json({ ok: true });
});

export { me };
