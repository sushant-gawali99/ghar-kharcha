import { z } from "zod";

export const MonthlySpendSchema = z.object({
  month: z.string(),
  total: z.number(),
  orderCount: z.number(),
});
export type MonthlySpend = z.infer<typeof MonthlySpendSchema>;

export const CategorySpendSchema = z.object({
  category: z.string(),
  total: z.number(),
  percentage: z.number(),
});
export type CategorySpend = z.infer<typeof CategorySpendSchema>;

export const AnalyticsSummarySchema = z.object({
  totalSpend: z.number(),
  totalOrders: z.number(),
  avgOrderValue: z.number(),
  monthlySpend: z.array(MonthlySpendSchema),
  categoryBreakdown: z.array(CategorySpendSchema),
});
export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;

/** Line-item spend by grocery category for the current calendar month (server / DB month). */
export const GroceryMonthCategoryRowSchema = z.object({
  category: z.string(),
  total: z.number(),
  percentage: z.number(),
});
export type GroceryMonthCategoryRow = z.infer<typeof GroceryMonthCategoryRowSchema>;

export const GroceryMonthAnalyticsSchema = z.object({
  /** `YYYY-MM` for the period returned (UTC month). */
  monthKey: z.string(),
  monthLabel: z.string(),
  /** Sum of `orders.total` for the month (includes fees; matches home screen). */
  monthSpend: z.number(),
  /** Sum of line item `total_amount` for the month (used as % denominator). */
  itemSpendTotal: z.number(),
  monthOrderCount: z.number(),
  categories: z.array(GroceryMonthCategoryRowSchema),
});
export type GroceryMonthAnalytics = z.infer<typeof GroceryMonthAnalyticsSchema>;

export const MonthlyComparisonPointSchema = z.object({
  monthKey: z.string(),
  monthShortLabel: z.string(),
  monthLabel: z.string(),
  total: z.number(),
});
export type MonthlyComparisonPoint = z.infer<
  typeof MonthlyComparisonPointSchema
>;

export const MonthlyComparisonAnalyticsSchema = z.object({
  scope: z.enum(["overall", "category"]),
  category: z.string().nullable(),
  months: z.array(MonthlyComparisonPointSchema),
});
export type MonthlyComparisonAnalytics = z.infer<
  typeof MonthlyComparisonAnalyticsSchema
>;

export const GroceryCategoryItemRowSchema = z.object({
  name: z.string(),
  /** Distinct orders in the period that contain this item. */
  timesOrdered: z.number(),
  /** Sum of quantities (units/packs) bought across the period. */
  units: z.number(),
  /** Display MRP for the item (best-effort; invoices can vary). */
  mrp: z.number(),
  totalCost: z.number(),
});
export type GroceryCategoryItemRow = z.infer<typeof GroceryCategoryItemRowSchema>;

export const GroceryCategoryItemsAnalyticsSchema = z.object({
  monthKey: z.string(),
  monthLabel: z.string(),
  category: z.string(),
  distinctItemCount: z.number(),
  totalOrdersWithCategory: z.number(),
  totalUnits: z.number(),
  totalValue: z.number(),
  items: z.array(GroceryCategoryItemRowSchema),
});
export type GroceryCategoryItemsAnalytics = z.infer<
  typeof GroceryCategoryItemsAnalyticsSchema
>;
