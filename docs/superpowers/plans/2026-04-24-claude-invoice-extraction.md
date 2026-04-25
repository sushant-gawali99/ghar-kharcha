# Claude-API Grocery Invoice Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 400-line regex-based grocery invoice parser with a Claude-API structured extractor that works on any grocery invoice PDF and drops the keyword-based item categoriser.

**Architecture:** New `invoiceExtractor.ts` module orchestrates a tiered extraction flow — Haiku 4.5 on the text-extracted invoice first; if validation fails or the text is too short, escalate to Sonnet 4.6 on the PDF bytes via a `document` content block. Tool use (`record_invoice`) enforces the output shape. A pure `validate()` function confirms totals reconcile before persisting. The upload route, DB schema, and response shape are unchanged.

**Tech Stack:** TypeScript, Hono, Drizzle ORM, Postgres, Vitest, `@anthropic-ai/sdk` (new), `pdfjs-dist` (existing text extraction retained).

**Spec:** `docs/superpowers/specs/2026-04-24-claude-invoice-extraction-design.md`

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `packages/api/package.json` | Modify | Add `@anthropic-ai/sdk` dep |
| `packages/api/src/env.ts` | Modify | Load `.env`, then validate required env vars including `ANTHROPIC_API_KEY` |
| `.env.example` | Create | Document required env vars |
| `docker-compose.yml` | Modify | Pass `ANTHROPIC_API_KEY` to api container |
| `packages/api/src/lib/invoiceExtractor.ts` | Create | `extractInvoice()`, `validate()`, tool schema, system prompt, `InvoiceExtractionError`, types |
| `packages/api/src/lib/invoiceExtractor.test.ts` | Create | Unit tests for `validate()` and orchestration (mocked SDK) |
| `packages/api/src/routes/upload.ts` | Modify | Swap `parseGroceryInvoice(text)` for `extractInvoice(buffer)` |
| `packages/api/src/routes/upload.test.ts` | Create | Integration test: real Postgres + mocked Anthropic |
| `packages/api/test/fixtures/*.pdf` | Create | 2 Zepto + 2 Swiggy + 1 Other invoice fixtures |
| `packages/api/test/fixtures/*.expected.json` | Create | Ground-truth assertions per fixture |
| `packages/api/src/lib/invoiceExtractor.golden.test.ts` | Create | `RUN_GOLDEN=1`-gated real-API test |
| `packages/api/src/lib/groceryCategories.ts` | Modify | Strip keyword matcher body; keep enum + label export |
| `packages/api/src/lib/groceryInvoiceParser.ts` | Delete | Regex parser removed in final cleanup task |

---

## Task 1: Add SDK dependency and environment validation

**Files:**
- Modify: `packages/api/package.json`
- Modify: `packages/api/src/env.ts`
- Create: `.env.example` (repo root)
- Modify: `docker-compose.yml`

- [ ] **Step 1: Install the Anthropic SDK**

Run:
```bash
pnpm --filter @ghar-kharcha/api add @anthropic-ai/sdk
```

Expected: `packages/api/package.json` gains a `"@anthropic-ai/sdk": "^x.y.z"` entry under `dependencies`. `pnpm-lock.yaml` updated.

- [ ] **Step 2: Add env validation to `env.ts`**

Append to `packages/api/src/env.ts` (below the existing dotenv loader):

```typescript
const REQUIRED_ENV_VARS = ["DATABASE_URL", "ANTHROPIC_API_KEY"] as const;

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}
```

- [ ] **Step 3: Create `.env.example` at repo root**

Create `.env.example`:

```
# Postgres connection string for the API
DATABASE_URL=postgresql://ghar:ghar@localhost:5432/ghar_kharcha

# Anthropic API key for grocery invoice extraction
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx

# Upload directory for raw PDFs (optional; defaults to /data/uploads)
UPLOAD_DIR=/data/uploads
```

- [ ] **Step 4: Pass the key through docker-compose**

In `docker-compose.yml`, under the `api` service's `environment:` block, add a line:

```yaml
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
```

Full snippet (for clarity):

```yaml
    environment:
      DATABASE_URL: postgresql://ghar:ghar@db:5432/ghar_kharcha
      UPLOAD_DIR: /data/uploads
      PORT: 3000
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
```

- [ ] **Step 5: Verify the API still boots**

Run:
```bash
ANTHROPIC_API_KEY=test-key DATABASE_URL=postgresql://ghar:ghar@localhost:5432/ghar_kharcha pnpm --filter @ghar-kharcha/api typecheck
```

Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/package.json packages/api/src/env.ts .env.example docker-compose.yml pnpm-lock.yaml
git commit -m "chore: add anthropic sdk dep and ANTHROPIC_API_KEY env var"
```

---

## Task 2: Define types, constants, and tool schema in `invoiceExtractor.ts`

**Files:**
- Create: `packages/api/src/lib/invoiceExtractor.ts`

This task creates the module skeleton — types, constants, and the error class. No runtime behaviour yet; the validator lands in Task 3.

- [ ] **Step 1: Create `invoiceExtractor.ts` with types, constants, and error class**

Create `packages/api/src/lib/invoiceExtractor.ts`:

```typescript
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
```

- [ ] **Step 2: Typecheck passes**

Run:
```bash
pnpm --filter @ghar-kharcha/api typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/lib/invoiceExtractor.ts
git commit -m "feat: scaffold invoiceExtractor module with types and tool schema"
```

---

## Task 3: Write `validate()` TDD-style

**Files:**
- Modify: `packages/api/src/lib/invoiceExtractor.ts`
- Create: `packages/api/src/lib/invoiceExtractor.test.ts`

- [ ] **Step 1: Write failing tests for `validate()`**

Create `packages/api/src/lib/invoiceExtractor.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validate, type ParsedGroceryOrder } from "./invoiceExtractor";

function makeOrder(overrides: Partial<ParsedGroceryOrder> = {}): ParsedGroceryOrder {
  return {
    platform: "zepto",
    orderDate: "2026-04-20",
    invoiceNo: "INV-123",
    orderNo: "ORD-456",
    itemTotal: 100,
    handlingFee: 0,
    deliveryFee: 0,
    totalTaxes: 18,
    totalDiscount: 0,
    totalAmount: 100,
    items: [
      {
        name: "Milk 1L",
        quantity: 1,
        unit: "pack",
        mrp: 60,
        productRate: 60,
        discount: 0,
        taxableAmount: 60,
        cgst: 0,
        sgst: 0,
        cess: 0,
        totalAmount: 100,
        groceryCategory: "dairy",
        hsn: "04012010",
      },
    ],
    ...overrides,
  };
}

describe("validate", () => {
  it("accepts a reconciling order", () => {
    expect(validate(makeOrder()).ok).toBe(true);
  });

  it("rejects empty invoiceNo", () => {
    const result = validate(makeOrder({ invoiceNo: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/invoiceNo/i);
  });

  it("rejects zero items", () => {
    const result = validate(makeOrder({ items: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/items/i);
  });

  it("rejects totals mismatch beyond tolerance", () => {
    const result = validate(makeOrder({ totalAmount: 500 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/total/i);
  });

  it("accepts totals mismatch within \u20b91 tolerance", () => {
    const result = validate(makeOrder({ totalAmount: 100.4 }));
    expect(result.ok).toBe(true);
  });

  it("rejects unparseable orderDate", () => {
    const result = validate(makeOrder({ orderDate: "not-a-date" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/date/i);
  });

  it("rejects off-enum platform", () => {
    // @ts-expect-error: deliberately invalid
    const result = validate(makeOrder({ platform: "amazon_fresh" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/platform/i);
  });

  it("handles handlingFee and deliveryFee in reconciliation", () => {
    const result = validate(
      makeOrder({
        items: [
          {
            name: "X",
            quantity: 1,
            unit: "pack",
            mrp: 50,
            productRate: 50,
            discount: 0,
            taxableAmount: 50,
            cgst: 0,
            sgst: 0,
            cess: 0,
            totalAmount: 50,
            groceryCategory: "other",
            hsn: "",
          },
        ],
        handlingFee: 10,
        deliveryFee: 20,
        totalAmount: 80,
      }),
    );
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests and watch them fail**

Run:
```bash
pnpm --filter @ghar-kharcha/api test invoiceExtractor.test.ts
```

Expected: fails with "validate is not a function" or equivalent.

- [ ] **Step 3: Implement `validate()` in `invoiceExtractor.ts`**

Append to `packages/api/src/lib/invoiceExtractor.ts`:

```typescript
import { GROCERY_PLATFORMS } from "./groceryCategories";

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

  const dateMs = Date.parse(order.orderDate);
  if (Number.isNaN(dateMs)) {
    return { ok: false, reason: `orderDate "${order.orderDate}" is not a valid date` };
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
```

Note: the existing `packages/api/src/lib/groceryCategories.ts` already exports `GROCERY_PLATFORMS`. No change needed there.

- [ ] **Step 4: Run tests and watch them pass**

Run:
```bash
pnpm --filter @ghar-kharcha/api test invoiceExtractor.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/invoiceExtractor.ts packages/api/src/lib/invoiceExtractor.test.ts
git commit -m "feat: add validate() for extracted grocery invoices"
```

---

## Task 4: Implement `extractStructured()` and `extractInvoice()` orchestration

**Files:**
- Modify: `packages/api/src/lib/invoiceExtractor.ts`
- Modify: `packages/api/src/lib/invoiceExtractor.test.ts`

The extractor takes a PDF buffer and returns a validated `ParsedGroceryOrder`, escalating from Haiku-on-text to Sonnet-on-PDF on failure. The Anthropic client is injected via an optional argument so tests can swap in a mock.

- [ ] **Step 1: Write failing orchestration tests**

Append to `packages/api/src/lib/invoiceExtractor.test.ts`:

```typescript
import { describe as desc2, it as it2, expect as expect2, vi } from "vitest";
import { extractInvoice, InvoiceExtractionError, HAIKU_MODEL, SONNET_MODEL } from "./invoiceExtractor";

function makeToolUseResponse(order: ReturnType<typeof makeOrder>) {
  return {
    content: [
      { type: "tool_use", name: "record_invoice", input: order },
    ],
    usage: { input_tokens: 100, output_tokens: 200, cache_read_input_tokens: 0 },
  };
}

function validPdfBuffer(): Buffer {
  // Minimal bytes so the PDF magic-number check in extractPdfText passes when mocked.
  return Buffer.from("%PDF-1.4\n...bytes...", "utf8");
}

desc2("extractInvoice orchestration", () => {
  it2("returns parsed order from text path when Haiku succeeds and validates", async () => {
    const haikuOrder = makeOrder();
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue(makeToolUseResponse(haikuOrder)),
      },
    };
    const pdfText = vi.fn().mockResolvedValue("Zepto invoice text long enough to pass threshold. ".repeat(20));

    const result = await extractInvoice(validPdfBuffer(), { client, pdfText });

    expect2(result).toEqual(haikuOrder);
    expect2(client.messages.create).toHaveBeenCalledTimes(1);
    expect2(client.messages.create.mock.calls[0][0].model).toBe(HAIKU_MODEL);
  });

  it2("escalates to Sonnet when Haiku output fails validation", async () => {
    const badOrder = makeOrder({ totalAmount: 999 }); // reconciliation mismatch
    const goodOrder = makeOrder();
    const client = {
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(makeToolUseResponse(badOrder))
          .mockResolvedValueOnce(makeToolUseResponse(goodOrder)),
      },
    };
    const pdfText = vi.fn().mockResolvedValue("x".repeat(500));

    const result = await extractInvoice(validPdfBuffer(), { client, pdfText });

    expect2(result).toEqual(goodOrder);
    expect2(client.messages.create).toHaveBeenCalledTimes(2);
    expect2(client.messages.create.mock.calls[1][0].model).toBe(SONNET_MODEL);
  });

  it2("skips text path when extracted text is too short", async () => {
    const goodOrder = makeOrder();
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue(makeToolUseResponse(goodOrder)),
      },
    };
    const pdfText = vi.fn().mockResolvedValue("tiny"); // under MIN_TEXT_LENGTH

    const result = await extractInvoice(validPdfBuffer(), { client, pdfText });

    expect2(result).toEqual(goodOrder);
    expect2(client.messages.create).toHaveBeenCalledTimes(1);
    expect2(client.messages.create.mock.calls[0][0].model).toBe(SONNET_MODEL);
  });

  it2("throws InvoiceExtractionError when both paths fail validation", async () => {
    const badOrder = makeOrder({ invoiceNo: "" });
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue(makeToolUseResponse(badOrder)),
      },
    };
    const pdfText = vi.fn().mockResolvedValue("x".repeat(500));

    await expect2(extractInvoice(validPdfBuffer(), { client, pdfText })).rejects.toMatchObject({
      name: "InvoiceExtractionError",
      stage: "both",
    });
  });

  it2("escalates when Haiku response contains no tool_use block", async () => {
    const goodOrder = makeOrder();
    const client = {
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce({ content: [{ type: "text", text: "refused" }], usage: {} })
          .mockResolvedValueOnce(makeToolUseResponse(goodOrder)),
      },
    };
    const pdfText = vi.fn().mockResolvedValue("x".repeat(500));

    const result = await extractInvoice(validPdfBuffer(), { client, pdfText });

    expect2(result).toEqual(goodOrder);
    expect2(client.messages.create).toHaveBeenCalledTimes(2);
  });

  it2("escalates when Haiku SDK call throws", async () => {
    const goodOrder = makeOrder();
    const client = {
      messages: {
        create: vi.fn()
          .mockRejectedValueOnce(new Error("network"))
          .mockResolvedValueOnce(makeToolUseResponse(goodOrder)),
      },
    };
    const pdfText = vi.fn().mockResolvedValue("x".repeat(500));

    const result = await extractInvoice(validPdfBuffer(), { client, pdfText });
    expect2(result).toEqual(goodOrder);
  });
});
```

- [ ] **Step 2: Run tests and watch them fail**

Run:
```bash
pnpm --filter @ghar-kharcha/api test invoiceExtractor.test.ts
```

Expected: fails with "extractInvoice is not a function".

- [ ] **Step 3: Implement `extractInvoice` and `extractStructured`**

Append to `packages/api/src/lib/invoiceExtractor.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { extractPdfText } from "./pdfText";

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
    sharedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

function logExtraction(fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event: "invoice_extraction", ...fields }));
}

export async function extractInvoice(
  pdfBuffer: Buffer,
  deps: ExtractInvoiceDeps = {},
): Promise<ParsedGroceryOrder> {
  const client = deps.client ?? getDefaultClient();
  const pdfText = deps.pdfText ?? extractPdfText;

  let text = "";
  try {
    text = await pdfText(pdfBuffer);
  } catch {
    text = "";
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
        reason: err instanceof Error ? err.message : "sdk_error",
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
      reason: err instanceof Error ? err.message : "sdk_error",
    });
    throw new InvoiceExtractionError(
      "both",
      err instanceof Error ? err.message : "SDK error on PDF path",
      { textRaw, pdfRaw },
    );
  }
}
```

- [ ] **Step 4: Run tests and watch them pass**

Run:
```bash
pnpm --filter @ghar-kharcha/api test invoiceExtractor.test.ts
```

Expected: all orchestration tests pass (plus the 8 validator tests from Task 3).

- [ ] **Step 5: Typecheck**

Run:
```bash
pnpm --filter @ghar-kharcha/api typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/lib/invoiceExtractor.ts packages/api/src/lib/invoiceExtractor.test.ts
git commit -m "feat: add tiered claude extraction for grocery invoices"
```

---

## Task 5: Flip the upload route to call `extractInvoice`

**Files:**
- Modify: `packages/api/src/routes/upload.ts`
- Create: `packages/api/src/routes/upload.test.ts`

The existing upload route calls `parseGroceryInvoice(text)`. Replace with `extractInvoice(buffer)`. The response shape is identical, so no frontend changes are needed.

- [ ] **Step 1: Write integration test for the happy path**

Create `packages/api/src/routes/upload.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { db } from "../db/index";
import { uploads, orders, orderItems, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const FAKE_ORDER = {
  platform: "zepto",
  orderDate: "2026-04-20",
  invoiceNo: "INV-TEST-001",
  orderNo: "ORD-TEST-001",
  itemTotal: 50,
  handlingFee: 0,
  deliveryFee: 0,
  totalTaxes: 0,
  totalDiscount: 0,
  totalAmount: 50,
  items: [
    {
      name: "Test Milk",
      quantity: 1,
      unit: "pack",
      mrp: 50,
      productRate: 50,
      discount: 0,
      taxableAmount: 50,
      cgst: 0,
      sgst: 0,
      cess: 0,
      totalAmount: 50,
      groceryCategory: "dairy",
      hsn: "04012010",
    },
  ],
};

vi.mock("../lib/invoiceExtractor", async () => {
  const actual = await vi.importActual<typeof import("../lib/invoiceExtractor")>(
    "../lib/invoiceExtractor",
  );
  return {
    ...actual,
    extractInvoice: vi.fn(),
  };
});

// Stub the auth middleware to set a fixed userId from a header for tests.
vi.mock("../middleware/auth", () => ({
  authMiddleware: async (
    c: { req: { header: (n: string) => string | undefined }; set: (k: string, v: string) => void },
    next: () => Promise<void>,
  ) => {
    const userId = c.req.header("x-test-user-id");
    if (!userId) throw new Error("missing x-test-user-id in test");
    c.set("userId", userId);
    await next();
  },
}));

import { upload } from "./upload";
import { extractInvoice } from "../lib/invoiceExtractor";

const mockedExtract = vi.mocked(extractInvoice);

async function makeTestUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({ id, email: `${id}@test.local`, name: "Test" });
  return id;
}

function makePdfBuffer(): Buffer {
  return Buffer.from("%PDF-1.4\n" + "x".repeat(100), "utf8");
}

function makeFormData(buffer: Buffer): FormData {
  const fd = new FormData();
  fd.append("file", new File([buffer], "invoice.pdf", { type: "application/pdf" }));
  return fd;
}

describe("POST /api/upload", () => {
  const app = new Hono();
  app.route("/api/upload", upload);

  beforeEach(async () => {
    mockedExtract.mockReset();
    // Truncate tables between tests
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(uploads);
    await db.delete(users);
  });

  it("persists upload, order, and items on successful extraction", async () => {
    const userId = await makeTestUser();
    mockedExtract.mockResolvedValue({ ...FAKE_ORDER });

    const res = await app.request("/api/upload", {
      method: "POST",
      headers: { "x-test-user-id": userId },
      body: makeFormData(makePdfBuffer()),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.invoiceNo).toBe("INV-TEST-001");

    const persistedOrder = await db.query.orders.findFirst({
      where: eq(orders.invoiceNo, "INV-TEST-001"),
    });
    expect(persistedOrder).toBeDefined();
    const persistedItems = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, persistedOrder!.id),
    });
    expect(persistedItems).toHaveLength(1);
    expect(persistedItems[0].name).toBe("Test Milk");
  });

  it("returns duplicate status when the same invoiceNo is uploaded twice", async () => {
    const userId = await makeTestUser();
    mockedExtract.mockResolvedValue({ ...FAKE_ORDER });

    const first = await app.request("/api/upload", {
      method: "POST",
      headers: { "x-test-user-id": userId },
      body: makeFormData(makePdfBuffer()),
    });
    expect(first.status).toBe(201);

    const second = await app.request("/api/upload", {
      method: "POST",
      headers: { "x-test-user-id": userId },
      body: makeFormData(makePdfBuffer()),
    });
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.status).toBe("duplicate");
  });

  it("marks upload failed and returns 422 when extraction throws", async () => {
    const userId = await makeTestUser();
    const { InvoiceExtractionError } = await import("../lib/invoiceExtractor");
    mockedExtract.mockRejectedValue(new InvoiceExtractionError("both", "test failure"));

    const res = await app.request("/api/upload", {
      method: "POST",
      headers: { "x-test-user-id": userId },
      body: makeFormData(makePdfBuffer()),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/test failure/);

    const row = await db.query.uploads.findFirst({
      where: eq(uploads.id, body.uploadId),
    });
    expect(row?.status).toBe("failed");
    expect(row?.errorMessage).toMatch(/test failure/);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run:
```bash
docker compose up -d db
pnpm --filter @ghar-kharcha/api db:migrate
pnpm --filter @ghar-kharcha/api test upload.test.ts
```

Expected: fails because `upload.ts` still uses `parseGroceryInvoice`, not `extractInvoice`.

- [ ] **Step 3: Modify `upload.ts` to use `extractInvoice`**

In `packages/api/src/routes/upload.ts`:

Replace these imports:
```typescript
import { extractPdfText } from "../lib/pdfText";
import { parseGroceryInvoice } from "../lib/groceryInvoiceParser";
```

with:
```typescript
import { extractInvoice, InvoiceExtractionError } from "../lib/invoiceExtractor";
```

Replace the "Extract text + parse" block (lines 66-79 in the current file):

```typescript
  // Extract text + parse
  let parsed;
  try {
    const text = await extractPdfText(buffer);
    parsed = parseGroceryInvoice(text);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse invoice";
    await db
      .update(uploads)
      .set({ status: "failed", errorMessage: message })
      .where(eq(uploads.id, uploadRow.id));
    return c.json({ error: message, uploadId: uploadRow.id }, 422);
  }
```

with:

```typescript
  // Extract structured invoice via Claude API.
  let parsed;
  try {
    parsed = await extractInvoice(buffer);
  } catch (err) {
    const message =
      err instanceof InvoiceExtractionError
        ? err.reason
        : err instanceof Error
          ? err.message
          : "Failed to parse invoice";
    await db
      .update(uploads)
      .set({ status: "failed", errorMessage: message })
      .where(eq(uploads.id, uploadRow.id));
    return c.json({ error: message, uploadId: uploadRow.id }, 422);
  }
```

Everything below that block (duplicate check, transaction, response) is unchanged.

- [ ] **Step 4: Run the integration tests and watch them pass**

Run:
```bash
pnpm --filter @ghar-kharcha/api test upload.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Run the full test suite to confirm nothing else broke**

Run:
```bash
pnpm --filter @ghar-kharcha/api test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/upload.ts packages/api/src/routes/upload.test.ts
git commit -m "feat: wire upload route to claude-api invoice extractor"
```

---

## Task 6: Capture fixture PDFs and write golden tests

**Files:**
- Create: `packages/api/test/fixtures/zepto-*.pdf` (2 files)
- Create: `packages/api/test/fixtures/swiggy-*.pdf` (2 files)
- Create: `packages/api/test/fixtures/other-*.pdf` (1 file)
- Create: `packages/api/test/fixtures/*.expected.json` (5 files)
- Create: `packages/api/src/lib/invoiceExtractor.golden.test.ts`

`tmp-uploads/` contains prior user uploads grouped under `<userId>/<uploadId>.pdf`. Copy usable ones as fixtures. If fewer than required, download fresh invoices from each platform.

- [ ] **Step 1: Identify fixture candidates**

Run:
```bash
find tmp-uploads -name '*.pdf' -type f | head -20
```

Pick 2 Zepto, 2 Swiggy Instamart, and 1 other-platform PDF. If you do not have coverage, download at least one invoice from BigBasket, Blinkit, or JioMart to use as the "other" fixture.

- [ ] **Step 2: Copy fixtures and rename them**

```bash
mkdir -p packages/api/test/fixtures
cp <path-to-zepto-1.pdf>           packages/api/test/fixtures/zepto-01.pdf
cp <path-to-zepto-2.pdf>           packages/api/test/fixtures/zepto-02.pdf
cp <path-to-swiggy-1.pdf>          packages/api/test/fixtures/swiggy-01.pdf
cp <path-to-swiggy-2.pdf>          packages/api/test/fixtures/swiggy-02.pdf
cp <path-to-other-platform.pdf>    packages/api/test/fixtures/other-01.pdf
```

- [ ] **Step 3: Write `.expected.json` for each fixture**

For each `*.pdf`, create a `*.expected.json` with ground-truth values read off the PDF by eye. Example for `packages/api/test/fixtures/zepto-01.expected.json`:

```json
{
  "platform": "zepto",
  "invoiceNo": "<read from PDF>",
  "minItems": 3,
  "maxItems": 30,
  "totalAmount": <read from PDF>
}
```

Repeat for all 5 fixtures.

- [ ] **Step 4: Write the golden test**

Create `packages/api/src/lib/invoiceExtractor.golden.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { extractInvoice } from "./invoiceExtractor";

const FIXTURES_DIR = path.resolve(__dirname, "../../test/fixtures");

interface Expected {
  platform: string;
  invoiceNo: string;
  minItems: number;
  maxItems: number;
  totalAmount: number;
}

const shouldRun = process.env.RUN_GOLDEN === "1";
const runner = shouldRun ? describe : describe.skip;

runner("invoiceExtractor golden fixtures (live API)", () => {
  it("extracts every fixture within tolerance", async () => {
    const files = (await readdir(FIXTURES_DIR)).filter((f) => f.endsWith(".pdf"));
    expect(files.length).toBeGreaterThanOrEqual(5);

    for (const pdfName of files) {
      const pdfPath = path.join(FIXTURES_DIR, pdfName);
      const expectedPath = pdfPath.replace(/\.pdf$/, ".expected.json");
      const buffer = await readFile(pdfPath);
      const expected: Expected = JSON.parse(await readFile(expectedPath, "utf8"));

      const actual = await extractInvoice(buffer);

      expect(actual.platform, `${pdfName} platform`).toBe(expected.platform);
      expect(actual.invoiceNo, `${pdfName} invoiceNo`).toBe(expected.invoiceNo);
      expect(actual.items.length, `${pdfName} items.length`).toBeGreaterThanOrEqual(expected.minItems);
      expect(actual.items.length, `${pdfName} items.length`).toBeLessThanOrEqual(expected.maxItems);
      expect(Math.abs(actual.totalAmount - expected.totalAmount), `${pdfName} totalAmount`).toBeLessThanOrEqual(1);
    }
  }, 120_000);
});
```

- [ ] **Step 5: Run the golden test against the live API**

Run:
```bash
RUN_GOLDEN=1 ANTHROPIC_API_KEY=<real-key> pnpm --filter @ghar-kharcha/api test invoiceExtractor.golden.test.ts
```

Expected: all fixtures pass. If any fail, read the console output, adjust either the `.expected.json` (if your ground-truth was wrong) or the system prompt (if Claude is systematically misreading something), re-run, and iterate.

- [ ] **Step 6: Verify regex parity (sanity check)**

Before deleting the regex parser, manually spot-check: pick one Zepto and one Swiggy fixture, run both parsers on the same PDF text, and confirm the Claude output is at least as good on the fields that matter (invoiceNo, items.length, totalAmount). This is a one-off eyeball check, no test.

- [ ] **Step 7: Commit**

```bash
git add packages/api/test/fixtures packages/api/src/lib/invoiceExtractor.golden.test.ts
git commit -m "test: add golden fixtures for claude invoice extraction"
```

---

## Task 7: Remove the regex parser and keyword matcher

**Files:**
- Delete: `packages/api/src/lib/groceryInvoiceParser.ts`
- Modify: `packages/api/src/lib/groceryCategories.ts`

- [ ] **Step 1: Search for remaining references to the regex parser**

Run:
```bash
grep -rn "groceryInvoiceParser\|parseGroceryInvoice" packages apps 2>/dev/null
```

Expected: no matches (`upload.ts` was updated in Task 5).

- [ ] **Step 2: Delete the regex parser**

```bash
rm packages/api/src/lib/groceryInvoiceParser.ts
```

- [ ] **Step 3: Search for references to `categorizeGroceryItem`**

Run:
```bash
grep -rn "categorizeGroceryItem" packages apps 2>/dev/null
```

Expected: no runtime references outside of `groceryCategories.ts` itself. Claude now sets `groceryCategory` during extraction, so the keyword matcher is dead code.

- [ ] **Step 4: Strip the keyword body from `groceryCategories.ts`**

Replace the contents of `packages/api/src/lib/groceryCategories.ts` with the enum, labels, and types only:

```typescript
// Grocery platform + category enums. Items are categorised by Claude
// during invoice extraction; no keyword matcher is needed.

export const GROCERY_PLATFORMS = [
  "zepto",
  "swiggy_instamart",
  "other",
] as const;

export type GroceryPlatform = (typeof GROCERY_PLATFORMS)[number];

export const GROCERY_CATEGORIES = [
  "dairy",
  "fruits",
  "vegetables",
  "bread_bakery",
  "biscuits_cookies",
  "snacks",
  "beverages",
  "staples",
  "meat_eggs",
  "personal_care",
  "cleaning_household",
  "other",
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

export const GROCERY_CATEGORY_LABELS: Record<GroceryCategory, string> = {
  dairy: "Dairy",
  fruits: "Fruits",
  vegetables: "Vegetables",
  bread_bakery: "Bread & Bakery",
  biscuits_cookies: "Biscuits & Cookies",
  snacks: "Snacks",
  beverages: "Beverages",
  staples: "Staples & Grains",
  meat_eggs: "Meat & Eggs",
  personal_care: "Personal Care",
  cleaning_household: "Cleaning & Household",
  other: "Other",
};
```

- [ ] **Step 5: Typecheck and test**

Run:
```bash
pnpm --filter @ghar-kharcha/api typecheck
pnpm --filter @ghar-kharcha/api test
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/lib/groceryInvoiceParser.ts packages/api/src/lib/groceryCategories.ts
git commit -m "chore: remove regex parser and keyword categoriser"
```

Note: `git add` on a deleted file stages the deletion.

---

## Post-Implementation

- Tail the API logs on the next few real uploads and confirm the `invoice_extraction` log lines look sane (model, path, durationMs, cache hits after the first call).
- The spec mentions a future "review & edit" UI for failed extractions — tracked as follow-up work, not part of this plan.
