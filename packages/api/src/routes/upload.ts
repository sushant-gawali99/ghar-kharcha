import { Hono } from "hono";
import { authMiddleware, type AuthVariables } from "../middleware/auth";

const upload = new Hono<{ Variables: AuthVariables }>();

upload.use(authMiddleware);

upload.post("/", async (c) => {
  // TODO: accept multipart PDF, store in R2, queue for parsing
  return c.json({ error: "Not implemented" }, 501);
});

upload.get("/:id/status", async (c) => {
  // TODO: return upload status by id
  return c.json({ error: "Not implemented" }, 501);
});

export { upload };
