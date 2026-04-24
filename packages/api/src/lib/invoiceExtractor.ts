import type { GroceryCategory, GroceryPlatform } from "./groceryCategories";
import { GROCERY_CATEGORIES } from "./groceryCategories";

export interface ParsedGroceryItem {
  name: string;
  quantity: number;
  unit: string;
  mrp: number;
  productRate: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  cess: number;
  totalAmount: number;
  groceryCategory: GroceryCategory;
  hsn: string;
}

export interface ParsedGroceryOrder {
  platform: GroceryPlatform;
  orderDate: string;
  invoiceNo: string;
  orderNo: string;
  itemTotal: number;
  handlingFee: number;
  deliveryFee: number;
  totalTaxes: number;
  totalDiscount: number;
  totalAmount: number;
  items: ParsedGroceryItem[];
}

export type ExtractionStage = "text" | "pdf" | "both";

export class InvoiceExtractionError extends Error {
  readonly stage: ExtractionStage;
  readonly reason: string;
  readonly raw?: unknown;

  constructor(stage: ExtractionStage, reason: string, raw?: unknown) {
    super(`Invoice extraction failed at stage=${stage}: ${reason}`);
    this.name = "InvoiceExtractionError";
    this.stage = stage;
    this.reason = reason;
    this.raw = raw;
  }
}

export const MIN_TEXT_LENGTH = 200;
export const TOTAL_TOLERANCE_RUPEES = 1;

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";
export const SONNET_MODEL = "claude-sonnet-4-6";
export const MAX_OUTPUT_TOKENS = 4096;

export const SYSTEM_PROMPT = [
  "You extract structured data from Indian grocery invoices, including",
  "quick-commerce (Zepto, Swiggy Instamart, Blinkit, BigBasket, JioMart)",
  "and in-store or kirana receipts.",
  "",
  "Always call `record_invoice` exactly once per invoice.",
  "",
  "Field rules:",
  "- Monetary values are in rupees, no currency symbols, numbers only.",
  "- `productRate` is the per-unit pre-tax price.",
  "- `taxableAmount` is productRate \u00d7 quantity \u2212 discount.",
  "- Prefer the invoice's printed \"Taxable Amt.\" column over computing",
  "  from MRP; quick-commerce MRP is often inflated relative to the",
  "  actual sale price.",
  "- `platform`:",
  "  - \"zepto\" if the invoice mentions Zepto, zeptonow.com, or Drogheria Sellers.",
  "  - \"swiggy_instamart\" if it mentions Swiggy, Instamart, or IMSCT.",
  "  - \"other\" otherwise.",
  "- If a field is not present in the invoice, use \"\" for strings and 0",
  "  for numbers. Never invent values.",
  "- `groceryCategory` must be one of the enum values.",
].join("\n");

export const INVOICE_TOOL = {
  name: "record_invoice",
  description: "Records the structured contents of one grocery invoice.",
  input_schema: {
    type: "object" as const,
    required: [
      "platform", "orderDate", "invoiceNo", "items",
      "itemTotal", "handlingFee", "deliveryFee",
      "totalTaxes", "totalDiscount", "totalAmount",
    ],
    properties: {
      platform: { enum: ["zepto", "swiggy_instamart", "other"] },
      orderDate: { type: "string", description: "YYYY-MM-DD" },
      invoiceNo: { type: "string" },
      orderNo: { type: "string" },
      itemTotal: { type: "number" },
      handlingFee: { type: "number" },
      deliveryFee: { type: "number" },
      totalTaxes: { type: "number" },
      totalDiscount: { type: "number" },
      totalAmount: { type: "number" },
      items: {
        type: "array",
        items: {
          type: "object",
          required: [
            "name", "quantity", "unit", "mrp", "productRate",
            "discount", "taxableAmount", "cgst", "sgst", "cess",
            "totalAmount", "groceryCategory",
          ],
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            mrp: { type: "number" },
            productRate: { type: "number" },
            discount: { type: "number" },
            taxableAmount: { type: "number" },
            cgst: { type: "number" },
            sgst: { type: "number" },
            cess: { type: "number" },
            totalAmount: { type: "number" },
            hsn: { type: "string" },
            groceryCategory: { enum: [...GROCERY_CATEGORIES] },
          },
        },
      },
    },
  },
};
