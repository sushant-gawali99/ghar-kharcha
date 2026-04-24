import { Hono } from "hono";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../db/index";
import { orders, orderItems, users } from "../db/schema";
import { authMiddleware, type AuthVariables } from "../middleware/auth";

const analytics = new Hono<{ Variables: AuthVariables }>();

analytics.use(authMiddleware);

function parseMonthQuery(raw: string | undefined): {
  year: number;
  month: number;
} | null {
  if (raw == null || raw === "") return null;
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  if (year < 2000 || year > 2100) return null;
  return { year, month };
}

function buildUtcMonthDate(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

function shiftUtcMonth(base: Date, deltaMonths: number): Date {
  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + deltaMonths, 1)
  );
}

analytics.get("/home", async (c) => {
  const userId = c.get("userId");

  // Total spent in the current calendar month (server time, UTC).
  const monthSpendRow = await db
    .select({
      total: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
      orderCount: sql<string>`count(*)::text`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        sql`date_trunc('month', ${orders.orderedAt}) = date_trunc('month', now())`
      )
    );

  const monthSpend = Number(monthSpendRow[0]?.total ?? 0);
  const monthOrderCount = Number(monthSpendRow[0]?.orderCount ?? 0);

  // Top categories by spend for the current month, top 3.
  const topCategoryRows = await db
    .select({
      category: orderItems.category,
      total: sql<string>`sum(${orderItems.totalAmount})::text`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        sql`date_trunc('month', ${orders.orderedAt}) = date_trunc('month', now())`
      )
    )
    .groupBy(orderItems.category)
    .orderBy(desc(sql`sum(${orderItems.totalAmount})`))
    .limit(3);

  const topCategories = topCategoryRows.map((row) => ({
    category: row.category ?? "other",
    total: Number(row.total),
  }));

  // 5 most recent orders for the user (any month).
  const recentOrderRows = await db
    .select({
      id: orders.id,
      platform: orders.platform,
      total: orders.total,
      orderedAt: orders.orderedAt,
      invoiceNo: orders.invoiceNo,
      itemCount: sql<string>`count(${orderItems.id})::text`,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(eq(orders.userId, userId))
    .groupBy(orders.id)
    .orderBy(desc(orders.orderedAt))
    .limit(5);

  // Pull the item names + categories for those orders in one shot so we can
  // build a preview string and a distinct-category list per order.
  const recentIds = recentOrderRows.map((r) => r.id);
  const recentItemRows = recentIds.length
    ? await db
        .select({
          orderId: orderItems.orderId,
          name: orderItems.name,
          quantity: orderItems.quantity,
          totalAmount: orderItems.totalAmount,
          category: orderItems.category,
        })
        .from(orderItems)
        .where(sql`${orderItems.orderId} in ${recentIds}`)
        .orderBy(desc(orderItems.totalAmount))
    : [];

  const itemsByOrder = new Map<string, typeof recentItemRows>();
  for (const item of recentItemRows) {
    const bucket = itemsByOrder.get(item.orderId) ?? [];
    bucket.push(item);
    itemsByOrder.set(item.orderId, bucket);
  }

  const recentOrders = recentOrderRows.map((row) => {
    const items = itemsByOrder.get(row.id) ?? [];
    const preview = items
      .slice(0, 3)
      .map((it) => {
        const qty = Number(it.quantity);
        return qty > 1 ? `${it.name} × ${qty}` : it.name;
      })
      .join(" · ");
    const categoryTotals = new Map<string, number>();
    for (const it of items) {
      const cat = it.category ?? "other";
      categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + Number(it.totalAmount));
    }
    const categories = [...categoryTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);

    return {
      id: row.id,
      platform: row.platform,
      total: Number(row.total),
      orderedAt: row.orderedAt.toISOString(),
      invoiceNo: row.invoiceNo,
      itemCount: Number(row.itemCount),
      preview,
      categories,
    };
  });

  const userRow = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const monthlyBudget =
    userRow && userRow.monthlyBudget !== null ? Number(userRow.monthlyBudget) : null;

  return c.json({
    monthSpend,
    monthOrderCount,
    monthlyBudget,
    topCategories,
    recentOrders,
  });
});

analytics.get("/grocery/month", async (c) => {
  const userId = c.get("userId");

  const parsed = parseMonthQuery(c.req.query("month"));
  if (c.req.query("month") != null && c.req.query("month") !== "" && !parsed) {
    return c.json({ error: "Invalid month (use YYYY-MM)" }, 400);
  }

  const now = new Date();
  const year = parsed?.year ?? now.getUTCFullYear();
  const monthNum = parsed?.month ?? now.getUTCMonth() + 1;

  const monthStart = new Date(Date.UTC(year, monthNum - 1, 1));
  const monthEnd = new Date(Date.UTC(year, monthNum, 1));

  const monthKey = `${year}-${String(monthNum).padStart(2, "0")}`;

  const monthSpendRow = await db
    .select({
      total: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
      orderCount: sql<string>`count(*)::text`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        gte(orders.orderedAt, monthStart),
        lt(orders.orderedAt, monthEnd)
      )
    );

  const monthSpend = Number(monthSpendRow[0]?.total ?? 0);
  const monthOrderCount = Number(monthSpendRow[0]?.orderCount ?? 0);

  const categoryRows = await db
    .select({
      category: orderItems.category,
      total: sql<string>`sum(${orderItems.totalAmount})::text`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        gte(orders.orderedAt, monthStart),
        lt(orders.orderedAt, monthEnd)
      )
    )
    .groupBy(orderItems.category)
    .orderBy(desc(sql`sum(${orderItems.totalAmount})`));

  const itemSpendTotal = categoryRows.reduce(
    (acc, row) => acc + Number(row.total),
    0
  );

  const categories = categoryRows
    .filter((row) => Number(row.total) > 0)
    .map((row) => {
      const total = Number(row.total);
      const percentage =
        itemSpendTotal > 0 ? (total / itemSpendTotal) * 100 : 0;
      return {
        category: row.category ?? "other",
        total,
        percentage,
      };
    });

  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthStart);

  return c.json({
    monthKey,
    monthLabel,
    monthSpend,
    itemSpendTotal,
    monthOrderCount,
    categories,
  });
});

analytics.get("/grocery/category/items", async (c) => {
  const userId = c.get("userId");

  const category = (c.req.query("category") ?? "").trim();
  if (!category) {
    return c.json({ error: "Missing category" }, 400);
  }

  const parsed = parseMonthQuery(c.req.query("month"));
  if (c.req.query("month") != null && c.req.query("month") !== "" && !parsed) {
    return c.json({ error: "Invalid month (use YYYY-MM)" }, 400);
  }

  const now = new Date();
  const year = parsed?.year ?? now.getUTCFullYear();
  const monthNum = parsed?.month ?? now.getUTCMonth() + 1;

  const monthStart = new Date(Date.UTC(year, monthNum - 1, 1));
  const monthEnd = new Date(Date.UTC(year, monthNum, 1));

  const monthKey = `${year}-${String(monthNum).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthStart);

  const summaryRows = await db
    .select({
      distinctItemCount: sql<string>`count(distinct ${orderItems.name})::text`,
      totalOrdersWithCategory: sql<string>`count(distinct ${orderItems.orderId})::text`,
      totalValue: sql<string>`coalesce(sum(${orderItems.totalAmount}), 0)::text`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.category, category),
        gte(orders.orderedAt, monthStart),
        lt(orders.orderedAt, monthEnd)
      )
    );

  const summary = summaryRows[0];

  const itemRows = await db
    .select({
      name: orderItems.name,
      timesOrdered: sql<string>`count(distinct ${orderItems.orderId})::text`,
      mrp: sql<string>`coalesce(max(${orderItems.mrp}), 0)::text`,
      totalCost: sql<string>`coalesce(sum(${orderItems.totalAmount}), 0)::text`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.category, category),
        gte(orders.orderedAt, monthStart),
        lt(orders.orderedAt, monthEnd)
      )
    )
    .groupBy(orderItems.name)
    .orderBy(desc(sql`sum(${orderItems.totalAmount})`));

  const items = itemRows.map((r) => ({
    name: r.name,
    timesOrdered: Number(r.timesOrdered ?? 0),
    mrp: Number(r.mrp ?? 0),
    totalCost: Number(r.totalCost ?? 0),
  }));

  return c.json({
    monthKey,
    monthLabel,
    category,
    distinctItemCount: Number(summary?.distinctItemCount ?? 0),
    totalOrdersWithCategory: Number(summary?.totalOrdersWithCategory ?? 0),
    totalValue: Number(summary?.totalValue ?? 0),
    items,
  });
});

analytics.get("/grocery/compare", async (c) => {
  const userId = c.get("userId");

  const parsed = parseMonthQuery(c.req.query("month"));
  if (c.req.query("month") != null && c.req.query("month") !== "" && !parsed) {
    return c.json({ error: "Invalid month (use YYYY-MM)" }, 400);
  }

  const now = new Date();
  const endYear = parsed?.year ?? now.getUTCFullYear();
  const endMonth = parsed?.month ?? now.getUTCMonth() + 1;
  const endMonthStart = buildUtcMonthDate(endYear, endMonth);
  const category = (c.req.query("category") ?? "").trim();

  const monthStarts = Array.from({ length: 6 }, (_, index) =>
    shiftUtcMonth(endMonthStart, index - 5)
  );

  const months = await Promise.all(
    monthStarts.map(async (monthStart) => {
      const monthEnd = shiftUtcMonth(monthStart, 1);

      if (category) {
        const rows = await db
          .select({
            total: sql<string>`coalesce(sum(${orderItems.totalAmount}), 0)::text`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(
            and(
              eq(orders.userId, userId),
              eq(orderItems.category, category),
              gte(orders.orderedAt, monthStart),
              lt(orders.orderedAt, monthEnd)
            )
          );

        return {
          monthKey: `${monthStart.getUTCFullYear()}-${String(
            monthStart.getUTCMonth() + 1
          ).padStart(2, "0")}`,
          monthShortLabel: new Intl.DateTimeFormat("en-IN", {
            month: "short",
            timeZone: "UTC",
          }).format(monthStart),
          monthLabel: new Intl.DateTimeFormat("en-IN", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(monthStart),
          total: Number(rows[0]?.total ?? 0),
        };
      }

      const rows = await db
        .select({
          total: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.userId, userId),
            gte(orders.orderedAt, monthStart),
            lt(orders.orderedAt, monthEnd)
          )
        );

      return {
        monthKey: `${monthStart.getUTCFullYear()}-${String(
          monthStart.getUTCMonth() + 1
        ).padStart(2, "0")}`,
        monthShortLabel: new Intl.DateTimeFormat("en-IN", {
          month: "short",
          timeZone: "UTC",
        }).format(monthStart),
        monthLabel: new Intl.DateTimeFormat("en-IN", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(monthStart),
        total: Number(rows[0]?.total ?? 0),
      };
    })
  );

  return c.json({
    scope: category ? "category" : "overall",
    category: category || null,
    months,
  });
});

analytics.get("/summary", async (c) => {
  // TODO: return analytics summary for authenticated user
  return c.json({ error: "Not implemented" }, 501);
});

export { analytics };
