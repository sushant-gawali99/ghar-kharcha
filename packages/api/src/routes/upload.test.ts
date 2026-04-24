import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { db } from "../db/index";
import { uploads, orders, orderItems, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const FAKE_ORDER = {
  platform: "zepto",
  orderDate: "2026-04-20",
  invoiceNo: "INV-TEST-001",
  orderNo: "ORD-TEST-001",
  itemTotal: 50,
  handlingFee: 0,
  deliveryFee: 0,
  totalTaxes: 0,
  totalDiscount: 0,
  totalAmount: 50,
  items: [
    {
      name: "Test Milk",
      quantity: 1,
      unit: "pack",
      mrp: 50,
      productRate: 50,
      discount: 0,
      taxableAmount: 50,
      cgst: 0,
      sgst: 0,
      cess: 0,
      totalAmount: 50,
      groceryCategory: "dairy",
      hsn: "04012010",
    },
  ],
};

vi.mock("../lib/invoiceExtractor", async () => {
  const actual = await vi.importActual<typeof import("../lib/invoiceExtractor")>(
    "../lib/invoiceExtractor",
  );
  return {
    ...actual,
    extractInvoice: vi.fn(),
  };
});

// Stub the auth middleware to set a fixed userId from a header for tests.
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

import { upload } from "./upload";
import { extractInvoice } from "../lib/invoiceExtractor";

const mockedExtract = vi.mocked(extractInvoice);

async function makeTestUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({ id, email: `${id}@test.local`, name: "Test" });
  return id;
}

function makePdfBuffer(): Buffer {
  return Buffer.from("%PDF-1.4\n" + "x".repeat(100), "utf8");
}

function makeFormData(buffer: Buffer): FormData {
  const fd = new FormData();
  fd.append("file", new File([buffer], "invoice.pdf", { type: "application/pdf" }));
  return fd;
}

describe("POST /api/upload", () => {
  const app = new Hono();
  app.route("/api/upload", upload);

  beforeEach(async () => {
    mockedExtract.mockReset();
    // Truncate tables between tests
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(uploads);
    await db.delete(users);
  });

  it("persists upload, order, and items on successful extraction", async () => {
    const userId = await makeTestUser();
    mockedExtract.mockResolvedValue({ ...FAKE_ORDER });

    const res = await app.request("/api/upload", {
      method: "POST",
      headers: { "x-test-user-id": userId },
      body: makeFormData(makePdfBuffer()),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.invoiceNo).toBe("INV-TEST-001");

    const persistedOrder = await db.query.orders.findFirst({
      where: eq(orders.invoiceNo, "INV-TEST-001"),
    });
    expect(persistedOrder).toBeDefined();
    const persistedItems = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, persistedOrder!.id),
    });
    expect(persistedItems).toHaveLength(1);
    expect(persistedItems[0].name).toBe("Test Milk");
  });

  it("returns duplicate status when the same invoiceNo is uploaded twice", async () => {
    const userId = await makeTestUser();
    mockedExtract.mockResolvedValue({ ...FAKE_ORDER });

    const first = await app.request("/api/upload", {
      method: "POST",
      headers: { "x-test-user-id": userId },
      body: makeFormData(makePdfBuffer()),
    });
    expect(first.status).toBe(201);

    const second = await app.request("/api/upload", {
      method: "POST",
      headers: { "x-test-user-id": userId },
      body: makeFormData(makePdfBuffer()),
    });
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.status).toBe("duplicate");
  });

  it("marks upload failed and returns 422 when extraction throws", async () => {
    const userId = await makeTestUser();
    const { InvoiceExtractionError } = await import("../lib/invoiceExtractor");
    mockedExtract.mockRejectedValue(new InvoiceExtractionError("both", "test failure"));

    const res = await app.request("/api/upload", {
      method: "POST",
      headers: { "x-test-user-id": userId },
      body: makeFormData(makePdfBuffer()),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/test failure/);

    const row = await db.query.uploads.findFirst({
      where: eq(uploads.id, body.uploadId),
    });
    expect(row?.status).toBe("failed");
    expect(row?.errorMessage).toMatch(/test failure/);
  });
});
