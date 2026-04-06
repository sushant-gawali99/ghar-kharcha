import { z } from "zod";
import { PlatformSchema } from "./platforms";

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  quantity: z.number(),
  unit: z.string().nullable(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  category: z.string().nullable(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  platform: PlatformSchema,
  orderedAt: z.string().datetime(),
  subtotal: z.number(),
  deliveryFee: z.number(),
  taxes: z.number(),
  discounts: z.number(),
  total: z.number(),
  itemCount: z.number(),
  items: z.array(OrderItemSchema).optional(),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderListResponseSchema = z.object({
  orders: z.array(OrderSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;
