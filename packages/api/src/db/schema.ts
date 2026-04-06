import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  pgEnum,
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
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  googleId: text("google_id").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  uploadId: uuid("upload_id").references(() => uploads.id),
  platform: platformEnum("platform").notNull(),
  orderedAt: timestamp("ordered_at").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  taxes: numeric("taxes", { precision: 10, scale: 2 }).notNull().default("0"),
  discounts: numeric("discounts", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  category: text("category"),
});
