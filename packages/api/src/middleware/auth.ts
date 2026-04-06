import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret");

export type AuthVariables = {
  userId: string;
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      if (typeof payload.sub !== "string") {
        return c.json({ error: "Unauthorized" }, 401);
      }
      c.set("userId", payload.sub);
      await next();
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
);
