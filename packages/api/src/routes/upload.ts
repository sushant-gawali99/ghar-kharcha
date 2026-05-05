import { Hono } from "hono";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index";
import { uploads, orders, orderItems, users } from "../db/schema";
import { authMiddleware, type AuthVariables } from "../middleware/auth";
import { extractInvoice, InvoiceExtractionError } from "../lib/invoiceExtractor";
import { getHouseholdMemberIds } from "../lib/household";
import { writeUpload } from "../lib/uploadStorage";
import { rateLimit } from "../middleware/rateLimit";
import { logAuditEvent } from "../lib/audit";

const upload = new Hono<{ Variables: AuthVariables }>();

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

upload.use(authMiddleware);
upload.use(
  rateLimit({
    keyPrefix: "upload",
    windowMs: 60 * 60 * 1000,
    max: 10,
    key: (c) => String(c.get("userId")),
  }),
);

upload.post("/", async (c) => {
  const userId = c.get("userId");

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "Invalid multipart payload" }, 400);
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return c.json({ error: "Missing file field" }, 400);
  }

  if (formData.get("aiProcessingConsent") !== "true") {
    return c.json({ error: "AI processing consent is required for invoice upload" }, 428);
  }

  await db
    .update(users)
    .set({ aiProcessingConsentAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  if (fileEntry.type && fileEntry.type !== "application/pdf") {
    return c.json({ error: "Only PDF files are accepted" }, 415);
  }

  if (fileEntry.size > MAX_BYTES) {
    return c.json({ error: "File exceeds 10 MB limit" }, 413);
  }

  const buffer = Buffer.from(await fileEntry.arrayBuffer());

  if (buffer.subarray(0, 4).toString() !== "%PDF") {
    return c.json({ error: "File is not a valid PDF" }, 415);
  }

  // Persist the raw PDF first so we always have an audit trail.
  const uploadId = randomUUID();
  const storageKey = `${userId}/${uploadId}.pdf`;
  await writeUpload(storageKey, buffer);

  const [uploadRow] = await db
    .insert(uploads)
    .values({
      id: uploadId,
      userId,
      filename: fileEntry.name || `${uploadId}.pdf`,
      storageKey,
      status: "processing",
    })
    .returning();

  // Extract structured invoice via Claude API.
  let parsed;
  try {
    parsed = await extractInvoice(buffer);
  } catch (err) {
    const message =
      err instanceof InvoiceExtractionError
        ? err.reason
        : err instanceof Error
          ? err.message
          : "Failed to parse invoice";
    await db
      .update(uploads)
      .set({ status: "failed", errorMessage: message })
      .where(eq(uploads.id, uploadRow.id));
    await logAuditEvent(userId, "upload.failed", {
      uploadId: uploadRow.id,
      reason: message,
    });
    return c.json({ error: message, uploadId: uploadRow.id }, 422);
  }

  if (!parsed.invoiceNo) {
    await db
      .update(uploads)
      .set({
        status: "failed",
        errorMessage: "Could not extract invoice number",
      })
      .where(eq(uploads.id, uploadRow.id));
    await logAuditEvent(userId, "upload.failed", {
      uploadId: uploadRow.id,
      reason: "Could not extract invoice number",
    });
    return c.json(
      { error: "Could not extract invoice number", uploadId: uploadRow.id },
      422
    );
  }

  // Duplicate check across any household member (household-scoped ledger).
  const memberIds = await getHouseholdMemberIds(userId);
  const existingOrder = await db.query.orders.findFirst({
    where: and(inArray(orders.userId, memberIds), eq(orders.invoiceNo, parsed.invoiceNo)),
  });

  if (existingOrder) {
    await db
      .update(uploads)
      .set({ status: "duplicate" })
      .where(eq(uploads.id, uploadRow.id));
    await logAuditEvent(userId, "upload.duplicate", {
      uploadId: uploadRow.id,
      invoiceNo: parsed.invoiceNo,
      existingOrderId: existingOrder.id,
    });
    return c.json({
      uploadId: uploadRow.id,
      status: "duplicate",
      orderId: existingOrder.id,
      invoiceNo: parsed.invoiceNo,
    });
  }

  // Insert the order + items in a single transaction.
  const orderId = await db.transaction(async (tx) => {
    const [orderRow] = await tx
      .insert(orders)
      .values({
        userId,
        uploadId: uploadRow.id,
        platform: parsed.platform,
        invoiceNo: parsed.invoiceNo,
        orderNo: parsed.orderNo || null,
        orderedAt: new Date(parsed.orderDate),
        itemTotal: parsed.itemTotal.toString(),
        handlingFee: parsed.handlingFee.toString(),
        deliveryFee: parsed.deliveryFee.toString(),
        taxes: parsed.totalTaxes.toString(),
        discounts: parsed.totalDiscount.toString(),
        total: parsed.totalAmount.toString(),
      })
      .returning({ id: orders.id });

    if (parsed.items.length > 0) {
      await tx.insert(orderItems).values(
        parsed.items.map((item) => ({
          orderId: orderRow.id,
          name: item.name,
          quantity: item.quantity.toString(),
          unit: item.unit,
          hsn: item.hsn || null,
          mrp: item.mrp.toString(),
          productRate: item.productRate.toString(),
          discount: item.discount.toString(),
          taxableAmount: item.taxableAmount.toString(),
          cgst: item.cgst.toString(),
          sgst: item.sgst.toString(),
          cess: item.cess.toString(),
          totalAmount: item.totalAmount.toString(),
          category: item.groceryCategory,
        }))
      );
    }

    return orderRow.id;
  });

  await db
    .update(uploads)
    .set({ status: "success" })
    .where(eq(uploads.id, uploadRow.id));
  await logAuditEvent(userId, "upload.success", {
    uploadId: uploadRow.id,
    orderId,
    invoiceNo: parsed.invoiceNo,
    platform: parsed.platform,
  });

  return c.json(
    {
      uploadId: uploadRow.id,
      orderId,
      status: "success",
      platform: parsed.platform,
      invoiceNo: parsed.invoiceNo,
      orderNo: parsed.orderNo,
      orderedAt: parsed.orderDate,
      total: parsed.totalAmount,
      itemCount: parsed.items.length,
    },
    201
  );
});

upload.get("/:id/status", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const row = await db.query.uploads.findFirst({
    where: and(eq(uploads.id, id), eq(uploads.userId, userId)),
  });

  if (!row) {
    return c.json({ error: "Upload not found" }, 404);
  }

  return c.json({
    id: row.id,
    filename: row.filename,
    status: row.status,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  });
});

export { upload };
