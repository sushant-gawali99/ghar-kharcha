import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db/index";
import { orders as ordersTable, orderItems } from "../db/schema";
import { authMiddleware, type AuthVariables } from "../middleware/auth";
import { getHouseholdMemberIds } from "../lib/household";

const orders = new Hono<{ Variables: AuthVariables }>();

orders.use(authMiddleware);

const PREVIEW_ITEM_COUNT = 3;

function monthBoundsUtc(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

// Monday-start ISO weeks, always in UTC.
function startOfIsoWeekUtc(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = copy.getUTCDay(); // 0 = Sun, 1 = Mon
  const delta = (dow + 6) % 7; // days since Monday
  copy.setUTCDate(copy.getUTCDate() - delta);
  return copy;
}

function sectionLabelForEarlier(monthStart: Date): string {
  return `Earlier in ${monthStart.toLocaleString("en-US", { month: "long", timeZone: "UTC" })}`;
}

orders.get(
  "/",
  zValidator(
    "query",
    z.object({
      month: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional(),
      platform: z.enum(["zepto", "swiggy_instamart", "other"]).optional(),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const memberIds = await getHouseholdMemberIds(userId);
    const { month, platform } = c.req.valid("query");

    const now = new Date();
    const year = month ? Number(month.slice(0, 4)) : now.getUTCFullYear();
    const monthNum = month ? Number(month.slice(5, 7)) : now.getUTCMonth() + 1;
    const { start: monthStart, end: monthEnd } = monthBoundsUtc(year, monthNum);

    const thisWeekStart = startOfIsoWeekUtc(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);

    const whereCond = and(
      inArray(ordersTable.userId, memberIds),
      gte(ordersTable.orderedAt, monthStart),
      lt(ordersTable.orderedAt, monthEnd),
      platform ? eq(ordersTable.platform, platform) : undefined,
    );

    const orderRows = await db
      .select({
        id: ordersTable.id,
        platform: ordersTable.platform,
        orderedAt: ordersTable.orderedAt,
        total: ordersTable.total,
      })
      .from(ordersTable)
      .where(whereCond)
      .orderBy(desc(ordersTable.orderedAt));

    if (orderRows.length === 0) {
      return c.json({
        month: `${year}-${String(monthNum).padStart(2, "0")}`,
        bills: 0,
        total: 0,
        sections: [],
      });
    }

    const orderIds = orderRows.map((r) => r.id);

    const itemRows = await db
      .select({
        orderId: orderItems.orderId,
        name: orderItems.name,
        quantity: orderItems.quantity,
        totalAmount: orderItems.totalAmount,
        category: orderItems.category,
      })
      .from(orderItems)
      .where(sql`${orderItems.orderId} in ${orderIds}`)
      .orderBy(asc(orderItems.orderId), desc(orderItems.totalAmount));

    type ItemRow = (typeof itemRows)[number];
    const itemsByOrder = new Map<string, ItemRow[]>();
    for (const item of itemRows) {
      const bucket = itemsByOrder.get(item.orderId) ?? [];
      bucket.push(item);
      itemsByOrder.set(item.orderId, bucket);
    }

    const cards = orderRows.map((row) => {
      const items = itemsByOrder.get(row.id) ?? [];
      const preview = items
        .slice(0, PREVIEW_ITEM_COUNT)
        .map((it) => {
          const qty = Number(it.quantity);
          return qty > 1 ? `${it.name} × ${qty}` : it.name;
        })
        .join(" · ");

      const categoryTotals = new Map<string, number>();
      for (const it of items) {
        const cat = it.category ?? "other";
        categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + Number(it.totalAmount));
      }
      const categories = [...categoryTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([cat]) => cat);

      return {
        id: row.id,
        platform: row.platform,
        orderedAt: row.orderedAt.toISOString(),
        total: Number(row.total),
        itemCount: items.length,
        preview,
        categories,
      };
    });

    type Card = (typeof cards)[number];
    const thisWeek: Card[] = [];
    const lastWeek: Card[] = [];
    const earlier: Card[] = [];

    for (const card of cards) {
      const d = new Date(card.orderedAt);
      if (d >= thisWeekStart) thisWeek.push(card);
      else if (d >= lastWeekStart) lastWeek.push(card);
      else earlier.push(card);
    }

    const sumTotal = (list: Card[]) => list.reduce((s, c) => s + c.total, 0);

    const sections: { label: string; total: number; orders: Card[] }[] = [];
    if (thisWeek.length > 0) sections.push({ label: "This week", total: sumTotal(thisWeek), orders: thisWeek });
    if (lastWeek.length > 0) sections.push({ label: "Last week", total: sumTotal(lastWeek), orders: lastWeek });
    if (earlier.length > 0) sections.push({ label: sectionLabelForEarlier(monthStart), total: sumTotal(earlier), orders: earlier });

    return c.json({
      month: `${year}-${String(monthNum).padStart(2, "0")}`,
      bills: cards.length,
      total: sumTotal(cards),
      sections,
    });
  },
);

orders.get("/:id", async (c) => {
  const userId = c.get("userId");
  const memberIds = await getHouseholdMemberIds(userId);
  const id = c.req.param("id");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Invalid order id" }, 400);
  }

  const order = await db.query.orders.findFirst({
    where: and(eq(ordersTable.id, id), inArray(ordersTable.userId, memberIds)),
  });

  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  const items = await db
    .select({
      id: orderItems.id,
      name: orderItems.name,
      quantity: orderItems.quantity,
      unit: orderItems.unit,
      totalAmount: orderItems.totalAmount,
      category: orderItems.category,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(desc(orderItems.totalAmount));

  return c.json({
    id: order.id,
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
    items: items.map((it) => ({
      id: it.id,
      name: it.name,
      quantity: Number(it.quantity),
      unit: it.unit,
      totalAmount: Number(it.totalAmount),
      category: it.category ?? "other",
    })),
  });
});

export { orders };
