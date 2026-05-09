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
import { household } from "./routes/household";
import { legal } from "./routes/legal";

const app = new Hono();
const configuredOrigins = (process.env.CORS_ORIGINS ?? process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const devOrigins = [
  "http://localhost:8081",
  "http://localhost:19006",
  "http://localhost:4174",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:19006",
  "http://127.0.0.1:4174",
];
const allowedOrigins =
  configuredOrigins.length > 0
    ? configuredOrigins
    : process.env.NODE_ENV === "production"
      ? []
      : devOrigins;

app.use(logger());
app.use(async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
});
app.use(
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : ""),
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 600,
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/", legal);
app.route("/api/auth", auth);
app.route("/api/upload", upload);
app.route("/api/orders", orders);
app.route("/api/analytics", analytics);
app.route("/api/me", me);
app.route("/api/household", household);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = Number(process.env.PORT ?? 3000);
console.log(`API listening on port ${port}`);

serve({ fetch: app.fetch, port });

export type AppType = typeof app;
