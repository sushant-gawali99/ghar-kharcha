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
