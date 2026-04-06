import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const auth = new Hono();

auth.post(
  "/refresh",
  zValidator(
    "json",
    z.object({
      refreshToken: z.string(),
    })
  ),
  async (c) => {
    // TODO: implement refresh token rotation
    return c.json({ error: "Not implemented" }, 501);
  }
);

auth.post("/logout", async (c) => {
  // TODO: implement logout (invalidate refresh token)
  return c.json({ success: true });
});

export { auth };
