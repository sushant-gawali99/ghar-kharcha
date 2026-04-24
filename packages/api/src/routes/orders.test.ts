import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index";
import { orders as ordersTable, orderItems, users, uploads } from "../db/schema";

vi.mock("../middleware/auth", () => ({
  authMiddleware: async (
    c: { req: { header: (n: string) => string | undefined }; set: (k: string, v: string) => void },
    next: () => Promise<void>,
  ) => {
    const userId = c.req.header("x-test-user-id");
    if (!userId) throw new Error("missing x-test-user-id in test");
    c.set("userId", userId);
    await next();
  },
}));

import { orders } from "./orders";

async function makeTestUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({ id, email: `${id}@test.local`, name: "Test" });
  return id;
}

async function makeOrder(params: {
  userId: string;
  platform: "zepto" | "swiggy_instamart" | "other";
  orderedAt: Date;
  total: number;
  items: { name: string; quantity: number; totalAmount: number; category: string }[];
}) {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId: params.userId,
      platform: params.platform,
      invoiceNo: `INV-${randomUUID().slice(0, 8)}`,
      orderedAt: params.orderedAt,
      itemTotal: params.total.toString(),
      total: params.total.toString(),
    })
    .returning({ id: ordersTable.id });

  if (params.items.length > 0) {
    await db.insert(orderItems).values(
      params.items.map((it) => ({
        orderId: row.id,
        name: it.name,
        quantity: it.quantity.toString(),
        totalAmount: it.totalAmount.toString(),
        category: it.category,
      })),
    );
  }

  return row.id;
}

describe("GET /api/orders", () => {
  const app = new Hono();
  app.route("/api/orders", orders);

  beforeEach(async () => {
    await db.delete(orderItems);
    await db.delete(ordersTable);
    await db.delete(uploads);
    await db.delete(users);
  });

  it("returns empty list for a user with no orders", async () => {
    const userId = await makeTestUser();

    const res = await app.request("/api/orders?month=2026-04", {
      headers: { "x-test-user-id": userId },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bills).toBe(0);
    expect(body.total).toBe(0);
    expect(body.sections).toEqual([]);
  });

  it("buckets orders into this week / last week / earlier in month", async () => {
    const userId = await makeTestUser();

    // We create orders within the current month using offsets from now.
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const thisWeek = new Date(now);
    const lastWeek = new Date(now);
    lastWeek.setUTCDate(lastWeek.getUTCDate() - 8);
    const earlier = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); // start of month

    await makeOrder({
      userId,
      platform: "zepto",
      orderedAt: thisWeek,
      total: 1247,
      items: [
        { name: "Amul Taaza Milk 1L", quantity: 2, totalAmount: 140, category: "dairy" },
        { name: "Bhindi", quantity: 1, totalAmount: 80, category: "vegetables" },
      ],
    });

    await makeOrder({
      userId,
      platform: "other",
      orderedAt: lastWeek,
      total: 2104,
      items: [
        { name: "Fortune Sunflower Oil 5L", quantity: 1, totalAmount: 800, category: "staples" },
      ],
    });

    // Only create an "earlier" order if it fits in the month and is before last week.
    const earlierFits = earlier < lastWeek;
    if (earlierFits) {
      await makeOrder({
        userId,
        platform: "swiggy_instamart",
        orderedAt: earlier,
        total: 389,
        items: [
          { name: "Britannia Good Day", quantity: 1, totalAmount: 60, category: "biscuits_cookies" },
        ],
      });
    }

    const res = await app.request(`/api/orders?month=${currentMonth}`, {
      headers: { "x-test-user-id": userId },
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.bills).toBe(earlierFits ? 3 : 2);

    const labels = body.sections.map((s: { label: string }) => s.label);
    expect(labels).toContain("This week");
    expect(labels).toContain("Last week");

    const thisWeekSection = body.sections.find((s: { label: string }) => s.label === "This week");
    expect(thisWeekSection.orders).toHaveLength(1);
    expect(thisWeekSection.orders[0].platform).toBe("zepto");
    expect(thisWeekSection.orders[0].preview).toContain("Amul Taaza Milk 1L × 2");
    expect(thisWeekSection.orders[0].itemCount).toBe(2);
    expect(thisWeekSection.orders[0].categories).toEqual(
      expect.arrayContaining(["dairy", "vegetables"]),
    );
  });

  it("filters by platform", async () => {
    const userId = await makeTestUser();
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    await makeOrder({
      userId,
      platform: "zepto",
      orderedAt: now,
      total: 500,
      items: [{ name: "Item A", quantity: 1, totalAmount: 500, category: "dairy" }],
    });
    await makeOrder({
      userId,
      platform: "swiggy_instamart",
      orderedAt: now,
      total: 800,
      items: [{ name: "Item B", quantity: 1, totalAmount: 800, category: "staples" }],
    });

    const res = await app.request(`/api/orders?month=${currentMonth}&platform=zepto`, {
      headers: { "x-test-user-id": userId },
    });
    const body = await res.json();

    expect(body.bills).toBe(1);
    const allOrders = body.sections.flatMap((s: { orders: unknown[] }) => s.orders);
    expect(allOrders).toHaveLength(1);
    expect(allOrders[0]).toMatchObject({ platform: "zepto" });
  });
});

describe("GET /api/orders/:id", () => {
  const app = new Hono();
  app.route("/api/orders", orders);

  beforeEach(async () => {
    await db.delete(orderItems);
    await db.delete(ordersTable);
    await db.delete(uploads);
    await db.delete(users);
  });

  it("returns the order with its line items", async () => {
    const userId = await makeTestUser();
    const orderId = await makeOrder({
      userId,
      platform: "zepto",
      orderedAt: new Date(),
      total: 428,
      items: [
        { name: "Amul Taaza 1L", quantity: 1, totalAmount: 185, category: "dairy" },
        { name: "Aashirvaad Atta 5kg", quantity: 1, totalAmount: 68, category: "staples" },
      ],
    });

    const res = await app.request(`/api/orders/${orderId}`, {
      headers: { "x-test-user-id": userId },
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.id).toBe(orderId);
    expect(body.platform).toBe("zepto");
    expect(body.total).toBe(428);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({
      name: "Amul Taaza 1L",
      category: "dairy",
      totalAmount: 185,
    });
  });

  it("returns 400 for an invalid id format", async () => {
    const userId = await makeTestUser();
    const res = await app.request("/api/orders/not-a-uuid", {
      headers: { "x-test-user-id": userId },
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for another user's order", async () => {
    const userA = await makeTestUser();
    const userB = await makeTestUser();
    const orderId = await makeOrder({
      userId: userA,
      platform: "zepto",
      orderedAt: new Date(),
      total: 100,
      items: [{ name: "X", quantity: 1, totalAmount: 100, category: "other" }],
    });

    const res = await app.request(`/api/orders/${orderId}`, {
      headers: { "x-test-user-id": userB },
    });
    expect(res.status).toBe(404);
  });
});
