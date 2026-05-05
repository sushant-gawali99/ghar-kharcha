import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { db } from "../db/index";
import { me } from "./me";
import {
  households,
  auditEvents,
  orderItems,
  orders,
  refreshTokens,
  usedRefreshTokens,
  uploads,
  users,
} from "../db/schema";
import { uploadPathFor, writeUpload } from "../lib/uploadStorage";

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

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({ id, email: `${id}@test.local`, name: "Test" });
  return id;
}

async function makeOrderWithUpload(userId: string): Promise<{ orderId: string; uploadId: string; storageKey: string }> {
  const uploadId = randomUUID();
  const storageKey = `${userId}/${uploadId}.pdf`;
  await writeUpload(storageKey, Buffer.from("%PDF-1.4\naccount delete test", "utf8"));
  await db.insert(uploads).values({
    id: uploadId,
    userId,
    filename: "invoice.pdf",
    storageKey,
    status: "success",
  });
  const [order] = await db
    .insert(orders)
    .values({
      userId,
      uploadId,
      platform: "zepto",
      invoiceNo: `INV-${randomUUID().slice(0, 8)}`,
      orderedAt: new Date(),
      itemTotal: "100",
      total: "100",
    })
    .returning({ id: orders.id });
  await db.insert(orderItems).values({
    orderId: order.id,
    name: "Milk",
    quantity: "1",
    totalAmount: "100",
  });
  return { orderId: order.id, uploadId, storageKey };
}

async function fileExists(storageKey: string): Promise<boolean> {
  try {
    await access(uploadPathFor(storageKey));
    return true;
  } catch {
    return false;
  }
}

describe("DELETE /api/me", () => {
  const app = new Hono();
  app.route("/api/me", me);

  beforeEach(async () => {
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(uploads);
    await db.delete(auditEvents);
    await db.delete(usedRefreshTokens);
    await db.delete(refreshTokens);
    await db.delete(users);
    await db.delete(households);
  });

  it("hard-deletes the current user's account data and stored PDFs", async () => {
    const userId = await makeUser();
    const otherUserId = await makeUser();
    const own = await makeOrderWithUpload(userId);
    const other = await makeOrderWithUpload(otherUserId);
    await db.insert(refreshTokens).values({
      userId,
      tokenHash: `hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const res = await app.request("/api/me", {
      method: "DELETE",
      headers: { "x-test-user-id": userId },
    });

    expect(res.status).toBe(200);
    expect(await db.query.users.findFirst({ where: eq(users.id, userId) })).toBeUndefined();
    expect(await db.query.orders.findFirst({ where: eq(orders.id, own.orderId) })).toBeUndefined();
    expect(await db.query.uploads.findFirst({ where: eq(uploads.id, own.uploadId) })).toBeUndefined();
    expect(await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.userId, userId) })).toBeUndefined();
    expect(await fileExists(own.storageKey)).toBe(false);

    expect(await db.query.users.findFirst({ where: eq(users.id, otherUserId) })).toBeDefined();
    expect(await db.query.uploads.findFirst({ where: eq(uploads.id, other.uploadId) })).toBeDefined();
    expect(await fileExists(other.storageKey)).toBe(true);
  });
});

describe("GET /api/me/export", () => {
  const app = new Hono();
  app.route("/api/me", me);

  beforeEach(async () => {
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(uploads);
    await db.delete(auditEvents);
    await db.delete(usedRefreshTokens);
    await db.delete(refreshTokens);
    await db.delete(users);
    await db.delete(households);
  });

  it("exports the current user's profile, uploads, orders, items, and session metadata", async () => {
    const userId = await makeUser();
    const otherUserId = await makeUser();
    const own = await makeOrderWithUpload(userId);
    await makeOrderWithUpload(otherUserId);
    await db.insert(refreshTokens).values({
      userId,
      tokenHash: `hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const res = await app.request("/api/me/export", {
      headers: { "x-test-user-id": userId },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe(userId);
    expect(body.uploads).toEqual([
      expect.objectContaining({
        id: own.uploadId,
        filename: "invoice.pdf",
        status: "success",
      }),
    ]);
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0]).toMatchObject({
      id: own.orderId,
      platform: "zepto",
      total: 100,
      items: [
        expect.objectContaining({
          name: "Milk",
          quantity: 1,
          totalAmount: 100,
        }),
      ],
    });
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]).not.toHaveProperty("tokenHash");
  });
});
