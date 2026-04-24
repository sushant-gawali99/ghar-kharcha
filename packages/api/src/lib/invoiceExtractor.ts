import Anthropic from "@anthropic-ai/sdk";
import { extractPdfText } from "./pdfText";
import type { GroceryCategory, GroceryPlatform } from "./groceryCategories";
import { GROCERY_CATEGORIES, GROCERY_PLATFORMS } from "./groceryCategories";

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

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validate(order: ParsedGroceryOrder): ValidationResult {
  if (!order.invoiceNo || order.invoiceNo.trim() === "") {
    return { ok: false, reason: "invoiceNo is empty" };
  }

  if (!order.items || order.items.length === 0) {
    return { ok: false, reason: "items array is empty" };
  }

  if (!(GROCERY_PLATFORMS as readonly string[]).includes(order.platform)) {
    return { ok: false, reason: `platform "${order.platform}" is not a known enum value` };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(order.orderDate) || Number.isNaN(Date.parse(order.orderDate))) {
    return { ok: false, reason: `orderDate "${order.orderDate}" is not a valid date (expected YYYY-MM-DD)` };
  }

  const itemsSum = order.items.reduce((sum, item) => sum + item.totalAmount, 0);
  const expected = itemsSum + order.handlingFee + order.deliveryFee;
  const delta = Math.abs(expected - order.totalAmount);
  if (delta > TOTAL_TOLERANCE_RUPEES) {
    return {
      ok: false,
      reason: `totals mismatch: items+fees=${expected.toFixed(2)} vs totalAmount=${order.totalAmount.toFixed(2)} (delta ${delta.toFixed(2)} > \u20b9${TOTAL_TOLERANCE_RUPEES})`,
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Orchestration: extractStructured + extractInvoice
// ---------------------------------------------------------------------------

interface AnthropicLike {
  messages: {
    create: (args: unknown) => Promise<{
      content: Array<{ type: string; name?: string; input?: unknown; text?: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
      };
    }>;
  };
}

export interface ExtractInvoiceDeps {
  client?: AnthropicLike;
  pdfText?: (buffer: Buffer) => Promise<string>;
}

let sharedClient: AnthropicLike | null = null;
function getDefaultClient(): AnthropicLike {
  if (!sharedClient) {
    sharedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) as unknown as AnthropicLike;
  }
  return sharedClient;
}

type ExtractInput =
  | { kind: "text"; text: string }
  | { kind: "pdf"; base64: string };

async function extractStructured(
  client: AnthropicLike,
  input: ExtractInput,
  model: string,
): Promise<ParsedGroceryOrder | null> {
  const userContent =
    input.kind === "text"
      ? [{ type: "text", text: input.text }]
      : [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: input.base64,
            },
          },
        ];

  const response = await client.messages.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    tools: [INVOICE_TOOL],
    tool_choice: { type: "tool", name: "record_invoice" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || !toolUse.input) return null;
  return toolUse.input as ParsedGroceryOrder;
}

const MAX_LOG_REASON_CHARS = 120;

function sanitizeReason(err: unknown): string {
  if (!(err instanceof Error)) return "sdk_error";
  const msg = err.message || "sdk_error";
  return msg.length > MAX_LOG_REASON_CHARS
    ? msg.slice(0, MAX_LOG_REASON_CHARS) + "…"
    : msg;
}

function logExtraction(fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event: "invoice_extraction", ...fields }));
}

export async function extractInvoice(
  pdfBuffer: Buffer,
  deps: ExtractInvoiceDeps = {},
): Promise<ParsedGroceryOrder> {
  const client = deps.client ?? getDefaultClient();
  const pdfTextFn = deps.pdfText ?? extractPdfText;

  let text = "";
  try {
    text = await pdfTextFn(pdfBuffer);
  } catch (err) {
    text = "";
    logExtraction({
      path: "text",
      skipped: true,
      reason: `pdf_text_extraction_failed: ${sanitizeReason(err)}`,
    });
  }

  const textPathEligible = text.length >= MIN_TEXT_LENGTH;
  let textRaw: unknown = null;

  if (textPathEligible) {
    const start = Date.now();
    try {
      const parsed = await extractStructured(client, { kind: "text", text }, HAIKU_MODEL);
      textRaw = parsed;
      if (parsed) {
        const v = validate(parsed);
        logExtraction({
          model: HAIKU_MODEL,
          path: "text",
          durationMs: Date.now() - start,
          validationOk: v.ok,
        });
        if (v.ok) return parsed;
      } else {
        logExtraction({ model: HAIKU_MODEL, path: "text", durationMs: Date.now() - start, validationOk: false, reason: "no_tool_use" });
      }
    } catch (err) {
      logExtraction({
        model: HAIKU_MODEL,
        path: "text",
        durationMs: Date.now() - start,
        validationOk: false,
        reason: sanitizeReason(err),
      });
    }
  }

  const start = Date.now();
  let pdfRaw: unknown = null;
  try {
    const parsed = await extractStructured(
      client,
      { kind: "pdf", base64: pdfBuffer.toString("base64") },
      SONNET_MODEL,
    );
    pdfRaw = parsed;
    if (!parsed) {
      logExtraction({ model: SONNET_MODEL, path: "pdf", durationMs: Date.now() - start, validationOk: false, reason: "no_tool_use" });
      throw new InvoiceExtractionError("both", "no tool_use on PDF path", { textRaw, pdfRaw });
    }
    const v = validate(parsed);
    logExtraction({
      model: SONNET_MODEL,
      path: "pdf",
      durationMs: Date.now() - start,
      validationOk: v.ok,
    });
    if (v.ok) return parsed;
    throw new InvoiceExtractionError("both", v.reason, { textRaw, pdfRaw });
  } catch (err) {
    if (err instanceof InvoiceExtractionError) throw err;
    logExtraction({
      model: SONNET_MODEL,
      path: "pdf",
      durationMs: Date.now() - start,
      validationOk: false,
      reason: sanitizeReason(err),
    });
    throw new InvoiceExtractionError(
      "both",
      err instanceof Error ? err.message : "SDK error on PDF path",
      { textRaw, pdfRaw },
    );
  }
}
