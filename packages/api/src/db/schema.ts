import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const uploadStatusEnum = pgEnum("upload_status", [
  "pending",
  "processing",
  "success",
  "failed",
  "duplicate",
]);

export const platformEnum = pgEnum("platform", [
  "zepto",
  "swiggy_instamart",
  "other",
]);

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  monthlyBudget: numeric("monthly_budget", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  googleId: text("google_id").unique(),
  householdId: uuid("household_id").references(() => households.id, {
    onDelete: "set null",
  }),
  onboardedAt: timestamp("onboarded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const householdInvites = pgTable("household_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  inviterId: uuid("inviter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const uploads = pgTable("uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull(),
  status: uploadStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    uploadId: uuid("upload_id").references(() => uploads.id),
    platform: platformEnum("platform").notNull(),
    invoiceNo: text("invoice_no").notNull(),
    orderNo: text("order_no"),
    orderedAt: timestamp("ordered_at").notNull(),
    itemTotal: numeric("item_total", { precision: 10, scale: 2 }).notNull(),
    handlingFee: numeric("handling_fee", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    taxes: numeric("taxes", { precision: 10, scale: 2 }).notNull().default("0"),
    discounts: numeric("discounts", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userInvoiceUnique: uniqueIndex("orders_user_invoice_unique").on(
      table.userId,
      table.invoiceNo
    ),
  })
);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit"),
  hsn: text("hsn"),
  mrp: numeric("mrp", { precision: 10, scale: 2 }).notNull().default("0"),
  productRate: numeric("product_rate", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  taxableAmount: numeric("taxable_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  cgst: numeric("cgst", { precision: 10, scale: 2 }).notNull().default("0"),
  sgst: numeric("sgst", { precision: 10, scale: 2 }).notNull().default("0"),
  cess: numeric("cess", { precision: 10, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category"),
});
