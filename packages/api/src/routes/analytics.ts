import { Hono } from "hono";
import { authMiddleware, type AuthVariables } from "../middleware/auth";

const analytics = new Hono<{ Variables: AuthVariables }>();

analytics.use(authMiddleware);

analytics.get("/summary", async (c) => {
  // TODO: return analytics summary for authenticated user
  return c.json({ error: "Not implemented" }, 501);
});

export { analytics };
