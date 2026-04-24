import "./env";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./routes/auth";
import { upload } from "./routes/upload";
import { orders } from "./routes/orders";
import { analytics } from "./routes/analytics";
import { me } from "./routes/me";

const app = new Hono();

app.use(logger());
app.use(cors());

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/auth", auth);
app.route("/api/upload", upload);
app.route("/api/orders", orders);
app.route("/api/analytics", analytics);
app.route("/api/me", me);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = Number(process.env.PORT ?? 3000);
console.log(`API listening on port ${port}`);

serve({ fetch: app.fetch, port });

export type AppType = typeof app;
