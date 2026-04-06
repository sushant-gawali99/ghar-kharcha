import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware, type AuthVariables } from "../middleware/auth";

const orders = new Hono<{ Variables: AuthVariables }>();

orders.use(authMiddleware);

orders.get(
  "/",
  zValidator(
    "query",
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      platform: z.enum(["zepto", "swiggy_instamart"]).optional(),
    })
  ),
  async (c) => {
    // TODO: query orders for authenticated user
    return c.json({ error: "Not implemented" }, 501);
  }
);

orders.get("/:id", async (c) => {
  // TODO: return single order with items
  return c.json({ error: "Not implemented" }, 501);
});

export { orders };
