import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { db } from "../db/index";
import { uploads, orders, orderItems } from "../db/schema";
import { authMiddleware, type AuthVariables } from "../middleware/auth";
import { extractInvoice, InvoiceExtractionError } from "../lib/invoiceExtractor";

const upload = new Hono<{ Variables: AuthVariables }>();

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/data/uploads";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

upload.use(authMiddleware);

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
  const absPath = path.join(UPLOAD_DIR, storageKey);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, buffer);

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
    return c.json(
      { error: "Could not extract invoice number", uploadId: uploadRow.id },
      422
    );
  }

  // Duplicate check on (userId, invoiceNo)
  const existingOrder = await db.query.orders.findFirst({
    where: and(eq(orders.userId, userId), eq(orders.invoiceNo, parsed.invoiceNo)),
  });

  if (existingOrder) {
    await db
      .update(uploads)
      .set({ status: "duplicate" })
      .where(eq(uploads.id, uploadRow.id));
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
