# Regex Invoice Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a regex-based first stage to `extractInvoice` that parses Blinkit and Zepto invoices in code (~50ms, free), with Claude as fallback and a single lightweight Claude call to assign grocery categories.

**Architecture:** Platform detection routes to a platform-specific parser that returns `ParsedGroceryOrder` with all `groceryCategory` fields set to `"other"`. On validation success, a single Haiku call categorizes all items in one round-trip. On validation failure the existing Haiku→Sonnet Claude stages run unchanged.

**Tech Stack:** TypeScript, Vitest, existing `pdfjs-dist` text extractor, `@anthropic-ai/sdk` (Haiku only for categorization)

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/lib/parsers/__fixtures__/blinkit.txt` | Create | Extracted text from ForwardInvoice_ORD38631533033.pdf |
| `src/lib/parsers/__fixtures__/zepto.txt` | Create | Extracted text from Zepto Drogheria invoice |
| `src/lib/parsers/detect.ts` | Create | Platform detection from raw text |
| `src/lib/parsers/detect.test.ts` | Create | Tests for platform detection |
| `src/lib/parsers/blinkit.ts` | Create | Blinkit forwarded-invoice parser |
| `src/lib/parsers/blinkit.test.ts` | Create | Tests for Blinkit parser |
| `src/lib/parsers/zepto.ts` | Create | Zepto/Drogheria invoice parser |
| `src/lib/parsers/zepto.test.ts` | Create | Tests for Zepto parser |
| `src/lib/parsers/index.ts` | Create | Exports `parseInvoice(text)` dispatcher |
| `src/lib/categorizer.ts` | Create | Single Haiku call to batch-categorize item names |
| `src/lib/categorizer.test.ts` | Create | Tests for categorizer |
| `src/lib/invoiceExtractor.ts` | Modify | Add regex stage + `regexParser`/`categorizer` to `ExtractInvoiceDeps` |
| `src/lib/invoiceExtractor.test.ts` | Modify | Two new integration test cases |

---

## Task 1: Fixture files

**Files:**
- Create: `src/lib/parsers/__fixtures__/blinkit.txt` ✓ (already copied)
- Create: `src/lib/parsers/__fixtures__/zepto.txt` ✓ (already copied)

- [ ] **Step 1: Verify fixtures exist and have content**

```bash
wc -l packages/api/src/lib/parsers/__fixtures__/blinkit.txt \
        packages/api/src/lib/parsers/__fixtures__/zepto.txt
```

Expected: both files show line counts > 50.

- [ ] **Step 2: Commit fixtures**

```bash
git add packages/api/src/lib/parsers/__fixtures__/
git commit -m "test: add blinkit and zepto invoice text fixtures"
```

---

## Task 2: Platform detection

**Files:**
- Create: `src/lib/parsers/detect.ts`
- Create: `src/lib/parsers/detect.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/lib/parsers/detect.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { detectPlatform } from "./detect";

describe("detectPlatform", () => {
  it("returns blinkit for Blink Commerce text", () => {
    expect(detectPlatform("Tax Invoice\nBLINK COMMERCE PRIVATE LIMITED")).toBe("blinkit");
  });

  it("returns blinkit for Zomato Hyperpure text", () => {
    expect(detectPlatform("ZOMATO HYPERPURE PRIVATE LIMITED\nSS Pune")).toBe("blinkit");
  });

  it("returns zepto for Drogheria Sellers text", () => {
    expect(detectPlatform("Seller Name: Drogheria Sellers Private Limited")).toBe("zepto");
  });

  it("returns zepto for Seller Name: header", () => {
    expect(detectPlatform("TAX INVOICE/BILL OF SUPPLY\nSeller Name: Foo Bar Ltd")).toBe("zepto");
  });

  it("returns null for unknown invoice", () => {
    expect(detectPlatform("Some Kirana Shop\nInvoice No: 123")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/api && pnpm test -- --reporter=verbose src/lib/parsers/detect.test.ts 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module './detect'`

- [ ] **Step 3: Implement detect.ts**

Create `packages/api/src/lib/parsers/detect.ts`:

```typescript
import type { GroceryPlatform } from "../groceryCategories";

export function detectPlatform(text: string): GroceryPlatform | null {
  const head = text.slice(0, 400);
  if (/Blink Commerce|Zomato Hyperpure/i.test(head)) return "blinkit";
  if (/Drogheria Sellers|^Seller Name:/m.test(head)) return "zepto";
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/api && pnpm test -- --reporter=verbose src/lib/parsers/detect.test.ts 2>&1 | tail -20
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/parsers/detect.ts packages/api/src/lib/parsers/detect.test.ts
git commit -m "feat: add invoice platform detection"
```

---

## Task 3: Blinkit parser

**Files:**
- Create: `src/lib/parsers/blinkit.ts`
- Create: `src/lib/parsers/blinkit.test.ts`

Blinkit PDFs are forwarded invoices: multiple sub-invoices concatenated, split by `"Tax Invoice"`. Sub-invoices come from different sellers (Blink Commerce, Zomato Hyperpure) plus a separate handling charge page. All items and totals are aggregated into one `ParsedGroceryOrder`.

Expected values from `blinkit.txt`:
- `invoiceNo`: `"C491287T26003771"` (first product block)
- `orderDate`: `"2026-04-14"`
- `platform`: `"blinkit"`
- `items`: 5 (Fanta, Thums Up, Paper Boat, Paneer, Spinach — delivery rows excluded)
- `deliveryFee`: `6.40` (2.15 + 2.10 + 2.15)
- `handlingFee`: `5.60`
- `totalAmount`: `235.00` (125.40 + 104.00 + 5.60)

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/lib/parsers/blinkit.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseBlinkitText } from "./blinkit";
import { validate } from "../invoiceExtractor";

const fixture = readFileSync(
  join(__dirname, "__fixtures__/blinkit.txt"),
  "utf8"
);

describe("parseBlinkitText", () => {
  it("extracts platform and invoice metadata", () => {
    const order = parseBlinkitText(fixture);
    expect(order.platform).toBe("blinkit");
    expect(order.invoiceNo).toBe("C491287T26003771");
    expect(order.orderDate).toBe("2026-04-14");
  });

  it("extracts all 5 product items (excluding delivery rows)", () => {
    const order = parseBlinkitText(fixture);
    expect(order.items).toHaveLength(5);
  });

  it("extracts correct item names and totals", () => {
    const order = parseBlinkitText(fixture);
    expect(order.items[0].name).toContain("Fanta Orange");
    expect(order.items[0].totalAmount).toBe(40);
    expect(order.items[1].name).toContain("Thums Up");
    expect(order.items[1].totalAmount).toBe(39);
    expect(order.items[3].name).toContain("Paneer");
    expect(order.items[3].totalAmount).toBe(80);
  });

  it("splits delivery charges into deliveryFee", () => {
    const order = parseBlinkitText(fixture);
    expect(order.deliveryFee).toBeCloseTo(6.40, 1);
  });

  it("extracts handlingFee from separate handling charge sub-invoice", () => {
    const order = parseBlinkitText(fixture);
    expect(order.handlingFee).toBeCloseTo(5.60, 1);
  });

  it("sums totalAmount across all sub-invoices", () => {
    const order = parseBlinkitText(fixture);
    expect(order.totalAmount).toBeCloseTo(235.00, 1);
  });

  it("passes validate()", () => {
    const order = parseBlinkitText(fixture);
    const result = validate(order);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/api && pnpm test -- --reporter=verbose src/lib/parsers/blinkit.test.ts 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module './blinkit'`

- [ ] **Step 3: Implement blinkit.ts**

Create `packages/api/src/lib/parsers/blinkit.ts`:

```typescript
import type { ParsedGroceryOrder, ParsedGroceryItem } from "../invoiceExtractor";

function normaliseDateToISO(raw: string): string {
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  // "14-Apr-2026"
  const long = raw.match(/^(\d{2})-([A-Za-z]+)-(\d{4})$/);
  if (long) return `${long[3]}-${months[long[2]] ?? "01"}-${long[1]}`;
  // "14-04-2026"
  const short = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (short) return `${short[3]}-${short[2]}-${short[1]}`;
  return raw;
}

function extractBlinkitName(lines: string[], dataIdx: number): string {
  const parts: string[] = [];
  for (let i = dataIdx - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) break;
    if (/^\d+\s+\d{4}$/.test(line)) break;          // "1 8901" — item number + UPC start
    if (/^\d+$/.test(line)) continue;                // UPC digit chunk — skip
    if (/^-\s+-/.test(line)) break;                  // delivery row — stop
    if (/^[\d.]+\s+[\d.]+\s+\d+/.test(line)) break; // another data line — stop
    parts.unshift(line);
  }
  return parts
    .join(" ")
    .replace(/\s*\(HSN[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseBlinkitText(text: string): ParsedGroceryOrder {
  // Each sub-invoice starts with "Tax Invoice"
  const blocks = text
    .split("Tax Invoice")
    .map((b) => b.trim())
    .filter(Boolean);

  let invoiceNo = "";
  let orderDate = "";
  const items: ParsedGroceryItem[] = [];
  let deliveryFee = 0;
  let handlingFee = 0;
  let totalAmount = 0;

  for (const block of blocks) {
    // Sub-invoice total: last number on the first "Total <integer> ..." line
    // (Annexure has "Total 5.087 ..." — excluded by requiring integer second token)
    const subTotalMatch = block.match(/^Total\s+\d+(?![.\d]).*\s([\d.]+)\s*$/m);
    const subTotal = parseFloat(subTotalMatch?.[1] ?? "0");
    totalAmount += subTotal;

    // Handling charge block: skip item parsing, capture fee
    if (/\bHandling charge\b/i.test(block)) {
      handlingFee += subTotal;
      continue;
    }

    // Extract invoice metadata from the first product block
    if (!invoiceNo) {
      invoiceNo =
        block.match(/Invoice Number\s*:?\s*([A-Z0-9]+)/)?.[1]?.trim() ?? "";
      const rawDate =
        block.match(/Invoice\s*\n\s*Date\s*\n\s*:\s*(\d{2}-[A-Za-z]+-\d{4})/)?.[1] ??
        block.match(/Invoice Date\s*:\s*(\d{2}-\d{2}-\d{4})/)?.[1] ??
        "";
      orderDate = normaliseDateToISO(rawDate);
    }

    // Parse item and delivery rows line by line
    const lines = block.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Product data line: MRP Discount Qty TaxableVal [6 more nums] Total
      // Non-capturing group covers CGST%, CGSTAmt, SGST%, SGSTAmt, Cess%, CessAmt
      const pm = line.match(
        /^([\d.]+)\s+([\d.]+)\s+(\d+)\s+([\d.]+)(?:\s+[\d.]+){6}\s+([\d.]+)$/
      );
      if (pm && !line.startsWith("-")) {
        items.push({
          name: extractBlinkitName(lines, i),
          quantity: parseInt(pm[3]),
          unit: "unit",
          mrp: parseFloat(pm[1]),
          productRate: parseFloat(pm[1]) - parseFloat(pm[2]),
          discount: parseFloat(pm[2]),
          taxableAmount: parseFloat(pm[4]),
          cgst: 0,
          sgst: 0,
          cess: 0,
          totalAmount: parseFloat(pm[5]),
          hsn: "",
          groceryCategory: "other",
        });
        continue;
      }

      // Delivery row: "- - - <nums> <total>"
      const dm = line.match(/^-\s+-\s+-\s+.+\s+([\d.]+)$/);
      if (dm) deliveryFee += parseFloat(dm[1]);
    }
  }

  return {
    platform: "blinkit",
    invoiceNo,
    orderNo: "",
    orderDate,
    items,
    itemTotal: items.reduce((s, it) => s + it.totalAmount, 0),
    handlingFee,
    deliveryFee,
    totalTaxes: 0,
    totalDiscount: 0,
    totalAmount,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/api && pnpm test -- --reporter=verbose src/lib/parsers/blinkit.test.ts 2>&1 | tail -20
```

Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/parsers/blinkit.ts packages/api/src/lib/parsers/blinkit.test.ts
git commit -m "feat: add Blinkit invoice parser"
```

---

## Task 4: Zepto parser

**Files:**
- Create: `src/lib/parsers/zepto.ts`
- Create: `src/lib/parsers/zepto.test.ts`

Zepto invoices are single-page, from Drogheria Sellers. Item names span multiple lines; the numeric data line has the format `MRP HSN Qty ProductRate Disc% TaxableAmt CGST% SGST% CGSTAmt SGSTAmt`. Each item terminates with `+ cessAmt` then `cessAmt totalAmt` on the last line.

Expected values from `zepto.txt`:
- `invoiceNo`: `"260427D006540692"`
- `orderNo`: `"KRGOPLUB91775A"`
- `orderDate`: `"2026-04-13"`
- `platform`: `"zepto"`
- `items.length`: `9`
- `totalAmount`: `847.03`
- `items[0]`: name contains `"Amul Taaza"`, qty `3`, mrp `17`, totalAmount `51`
- `items[4]`: name `"Broccoli"`, qty `1`, mrp `38`, totalAmount `28`

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/lib/parsers/zepto.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseZeptoText } from "./zepto";
import { validate } from "../invoiceExtractor";

const fixture = readFileSync(
  join(__dirname, "__fixtures__/zepto.txt"),
  "utf8"
);

describe("parseZeptoText", () => {
  it("extracts platform and invoice metadata", () => {
    const order = parseZeptoText(fixture);
    expect(order.platform).toBe("zepto");
    expect(order.invoiceNo).toBe("260427D006540692");
    expect(order.orderNo).toBe("KRGOPLUB91775A");
    expect(order.orderDate).toBe("2026-04-13");
  });

  it("extracts all 9 items", () => {
    const order = parseZeptoText(fixture);
    expect(order.items).toHaveLength(9);
  });

  it("extracts correct item names and totals", () => {
    const order = parseZeptoText(fixture);
    expect(order.items[0].name).toContain("Amul Taaza");
    expect(order.items[0].quantity).toBe(3);
    expect(order.items[0].mrp).toBe(17);
    expect(order.items[0].totalAmount).toBe(51);
    expect(order.items[4].name).toContain("Broccoli");
    expect(order.items[4].totalAmount).toBe(28);
  });

  it("extracts correct totalAmount", () => {
    const order = parseZeptoText(fixture);
    expect(order.totalAmount).toBeCloseTo(847.03, 1);
  });

  it("has zero deliveryFee and handlingFee", () => {
    const order = parseZeptoText(fixture);
    expect(order.deliveryFee).toBe(0);
    expect(order.handlingFee).toBe(0);
  });

  it("passes validate()", () => {
    const order = parseZeptoText(fixture);
    const result = validate(order);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/api && pnpm test -- --reporter=verbose src/lib/parsers/zepto.test.ts 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module './zepto'`

- [ ] **Step 3: Implement zepto.ts**

Create `packages/api/src/lib/parsers/zepto.ts`:

```typescript
import type { ParsedGroceryOrder, ParsedGroceryItem } from "../invoiceExtractor";

function normaliseDateToISO(raw: string): string {
  const short = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (short) return `${short[3]}-${short[2]}-${short[1]}`;
  return raw;
}

function parseZeptoItems(text: string): ParsedGroceryItem[] {
  // Item table: after last "Total\nAmt.\n" header, before "Item Total" / "Invoice Value"
  const headerToken = "Total\nAmt.\n";
  const headerIdx = text.lastIndexOf(headerToken);
  const tableStart = headerIdx >= 0 ? headerIdx + headerToken.length : 0;
  const tableEndMatch = text.search(/\nItem Total|\nInvoice Value/);
  const table = text.slice(tableStart, tableEndMatch > 0 ? tableEndMatch : undefined);

  const lines = table
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ParsedGroceryItem[] = [];
  let state: "seek" | "collect" = "seek";
  let nameLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Data line: MRP(decimal) HSN(5-8 digits) Qty ProductRate Disc% TaxableAmt ...
    const dm = line.match(
      /^([\d.]+)\s+(\d{5,8})\s+(\d+)\s+([\d.]+)\s+[\d.]+%\s+([\d.]+)/
    );
    if (dm) {
      // Find the terminal "cessAmt totalAmt" line in next 5 lines
      let total = 0;
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const tm = lines[j].match(/^([\d.]+)\s+([\d.]+)$/);
        if (tm) {
          total = parseFloat(tm[2]);
          break;
        }
      }

      const mrp = parseFloat(dm[1]);
      const qty = parseInt(dm[3]);
      const productRate = parseFloat(dm[4]);
      const taxableAmt = parseFloat(dm[5]);
      const discount = Math.max(0, productRate * qty - taxableAmt);

      items.push({
        name: nameLines.join(" ").replace(/\s+/g, " ").trim(),
        quantity: qty,
        unit: "unit",
        mrp,
        productRate,
        discount,
        taxableAmount: taxableAmt,
        cgst: 0,
        sgst: 0,
        cess: 0,
        totalAmount: total,
        hsn: dm[2],
        groceryCategory: "other",
      });

      state = "seek";
      nameLines = [];
      continue;
    }

    if (state === "seek") {
      if (/^\d+$/.test(line)) {
        state = "collect";
        nameLines = [];
        continue;
      }
      if (/^\d+ \w/.test(line)) {
        state = "collect";
        nameLines = [line.replace(/^\d+ /, "")];
        continue;
      }
      // Any other line in seek state is ignored (page totals, repeated headers)
      continue;
    }

    // state === "collect": accumulate name lines
    // Skip lines that look like post-data-line content or page subtotals
    if (/^[\d.]+%$/.test(line)) continue;
    if (/^\+\s/.test(line)) continue;
    if (/^[\d.]+ [\d.]+ [\d.]+ [\d.]+ [\d.]+/.test(line)) continue; // page subtotal
    nameLines.push(line);
  }

  return items;
}

export function parseZeptoText(text: string): ParsedGroceryOrder {
  const invoiceNo =
    text.match(/Invoice No\.\s*:\s*([A-Z0-9]+)/)?.[1]?.trim() ?? "";
  const orderNo =
    text.match(/Order No\.\s*:\s*([A-Z0-9]+)/)?.[1]?.trim() ?? "";
  const rawDate = text.match(/Date\s*:\s*(\d{2}-\d{2}-\d{4})/)?.[1] ?? "";
  const orderDate = normaliseDateToISO(rawDate);

  const totalAmount = parseFloat(
    text.match(/(?:Item Total|Invoice Value)\s+([\d.]+)/)?.[1] ?? "0"
  );

  const items = parseZeptoItems(text);

  return {
    platform: "zepto",
    invoiceNo,
    orderNo,
    orderDate,
    items,
    itemTotal: items.reduce((s, it) => s + it.totalAmount, 0),
    handlingFee: 0,
    deliveryFee: 0,
    totalTaxes: 0,
    totalDiscount: 0,
    totalAmount,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/api && pnpm test -- --reporter=verbose src/lib/parsers/zepto.test.ts 2>&1 | tail -20
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/parsers/zepto.ts packages/api/src/lib/parsers/zepto.test.ts
git commit -m "feat: add Zepto invoice parser"
```

---

## Task 5: Parser index + categorizer

**Files:**
- Create: `src/lib/parsers/index.ts`
- Create: `src/lib/categorizer.ts`
- Create: `src/lib/categorizer.test.ts`

- [ ] **Step 1: Create the parsers index**

Create `packages/api/src/lib/parsers/index.ts`:

```typescript
import { detectPlatform } from "./detect";
import { parseBlinkitText } from "./blinkit";
import { parseZeptoText } from "./zepto";
import type { ParsedGroceryOrder } from "../invoiceExtractor";

export function parseInvoice(text: string): ParsedGroceryOrder | null {
  const platform = detectPlatform(text);
  if (platform === "blinkit") return parseBlinkitText(text);
  if (platform === "zepto") return parseZeptoText(text);
  return null;
}
```

- [ ] **Step 2: Write the failing categorizer test**

Create `packages/api/src/lib/categorizer.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { categorizeItems } from "./categorizer";

function makeClient(responseText: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: responseText }],
        usage: {},
      }),
    },
  };
}

describe("categorizeItems", () => {
  it("returns parsed categories from Claude response", async () => {
    const client = makeClient('["dairy", "vegetables"]');
    const result = await categorizeItems(["Amul Milk", "Spinach"], client as never);
    expect(result).toEqual(["dairy", "vegetables"]);
  });

  it("returns empty array for empty input", async () => {
    const client = makeClient("[]");
    const result = await categorizeItems([], client as never);
    expect(result).toEqual([]);
    expect(client.messages.create).not.toHaveBeenCalled();
  });

  it("coerces unknown category values to other", async () => {
    const client = makeClient('["dairy", "unknown_category"]');
    const result = await categorizeItems(["Milk", "Foo"], client as never);
    expect(result).toEqual(["dairy", "other"]);
  });

  it("falls back to all-other when Claude throws", async () => {
    const client = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error("API error")),
      },
    };
    const result = await categorizeItems(["Milk", "Spinach"], client as never);
    expect(result).toEqual(["other", "other"]);
  });

  it("falls back to all-other when response has wrong array length", async () => {
    const client = makeClient('["dairy"]'); // length 1 but 2 items
    const result = await categorizeItems(["Milk", "Spinach"], client as never);
    expect(result).toEqual(["other", "other"]);
  });

  it("falls back to all-other when response is not valid JSON array", async () => {
    const client = makeClient("sorry, I cannot categorize these");
    const result = await categorizeItems(["Milk"], client as never);
    expect(result).toEqual(["other"]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/api && pnpm test -- --reporter=verbose src/lib/categorizer.test.ts 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module './categorizer'`

- [ ] **Step 4: Implement categorizer.ts**

Create `packages/api/src/lib/categorizer.ts`:

```typescript
import type { GroceryCategory } from "./groceryCategories";
import { GROCERY_CATEGORIES } from "./groceryCategories";
import type { AnthropicLike } from "./invoiceExtractor";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export async function categorizeItems(
  itemNames: string[],
  client: AnthropicLike,
): Promise<GroceryCategory[]> {
  if (itemNames.length === 0) return [];

  const fallback = (): GroceryCategory[] => itemNames.map(() => "other");
  const validCategories = GROCERY_CATEGORIES.join(", ");
  const numbered = itemNames.map((n, i) => `${i + 1}. ${n}`).join("\n");

  try {
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Categorize each grocery item into exactly one of: ${validCategories}.\n\nItems:\n${numbered}\n\nReturn a JSON array of category strings, same order, same length. Example: ["dairy","vegetables"]`,
        },
      ],
    });

    const text =
      (response.content as Array<{ type: string; text?: string }>)
        .find((b) => b.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return fallback();

    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    if (!Array.isArray(parsed) || parsed.length !== itemNames.length) return fallback();

    return parsed.map((cat) =>
      (GROCERY_CATEGORIES as readonly string[]).includes(cat as string)
        ? (cat as GroceryCategory)
        : "other"
    );
  } catch {
    return fallback();
  }
}
```

- [ ] **Step 5: Export `AnthropicLike` from invoiceExtractor.ts**

The `AnthropicLike` interface is currently not exported. Add `export` to it in `packages/api/src/lib/invoiceExtractor.ts`:

```typescript
// Change:
interface AnthropicLike {
// To:
export interface AnthropicLike {
```

- [ ] **Step 6: Run categorizer tests**

```bash
cd packages/api && pnpm test -- --reporter=verbose src/lib/categorizer.test.ts 2>&1 | tail -20
```

Expected: 6 tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/lib/parsers/index.ts \
        packages/api/src/lib/categorizer.ts \
        packages/api/src/lib/categorizer.test.ts \
        packages/api/src/lib/invoiceExtractor.ts
git commit -m "feat: add parsers index and item categorizer"
```

---

## Task 6: Wire regex stage into extractInvoice

**Files:**
- Modify: `src/lib/invoiceExtractor.ts`
- Modify: `src/lib/invoiceExtractor.test.ts`

- [ ] **Step 1: Write two new failing integration tests**

Add to the bottom of `packages/api/src/lib/invoiceExtractor.test.ts` (inside the `desc2` block, before the closing `)`):

```typescript
  it2("uses regex parser when it returns a valid order — Claude not called for parsing", async () => {
    const validOrder = makeOrder();
    const regexParser = vi.fn().mockReturnValue(validOrder);
    const categorizer = vi.fn().mockResolvedValue(["dairy"]);
    const client = { messages: { create: vi.fn() } };
    const pdfText = vi.fn().mockResolvedValue("x".repeat(500));

    const result = await extractInvoice(validPdfBuffer(), {
      client,
      pdfText,
      regexParser,
      categorizer,
    });

    expect(result.platform).toBe(validOrder.platform);
    expect(regexParser).toHaveBeenCalledTimes(1);
    expect(categorizer).toHaveBeenCalledTimes(1);
    expect(client.messages.create).not.toHaveBeenCalled();
  });

  it2("falls back to Claude when regex parser returns null", async () => {
    const goodOrder = makeOrder();
    const regexParser = vi.fn().mockReturnValue(null);
    const categorizer = vi.fn();
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue(makeToolUseResponse(goodOrder)),
      },
    };
    const pdfText = vi.fn().mockResolvedValue("x".repeat(500));

    await extractInvoice(validPdfBuffer(), { client, pdfText, regexParser, categorizer });

    expect(categorizer).not.toHaveBeenCalled();
    expect(client.messages.create).toHaveBeenCalledTimes(1); // Haiku ran
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

```bash
cd packages/api && pnpm test -- --reporter=verbose src/lib/invoiceExtractor.test.ts 2>&1 | tail -30
```

Expected: 2 new tests FAIL (deps.regexParser is unknown), existing 15 tests still PASS

- [ ] **Step 3: Update ExtractInvoiceDeps in invoiceExtractor.ts**

In `packages/api/src/lib/invoiceExtractor.ts`, find:

```typescript
export interface ExtractInvoiceDeps {
  client?: AnthropicLike;
  pdfText?: (buffer: Buffer) => Promise<string>;
}
```

Replace with:

```typescript
export interface ExtractInvoiceDeps {
  client?: AnthropicLike;
  pdfText?: (buffer: Buffer) => Promise<string>;
  regexParser?: (text: string) => ParsedGroceryOrder | null;
  categorizer?: (names: string[], client: AnthropicLike) => Promise<GroceryCategory[]>;
}
```

Also add to the imports at the top of the file:

```typescript
import type { GroceryCategory } from "./groceryCategories";
import { parseInvoice } from "./parsers/index";
import { categorizeItems } from "./categorizer";
```

- [ ] **Step 4: Insert the regex stage into extractInvoice**

In `packages/api/src/lib/invoiceExtractor.ts`, find the block that begins with `const textPathEligible`:

```typescript
  const textPathEligible = text.length >= MIN_TEXT_LENGTH;
  let textRaw: unknown = null;

  if (textPathEligible) {
```

Insert the regex stage immediately BEFORE that block:

```typescript
  // Stage 0: regex parser (fast path — no Claude call for parsing)
  if (text.length >= MIN_TEXT_LENGTH) {
    const regexParseFn = deps.regexParser ?? parseInvoice;
    const categorizerFn = deps.categorizer ?? categorizeItems;
    const regexStart = Date.now();
    try {
      const regexParsed = regexParseFn(text);
      if (regexParsed) {
        const v = validate(regexParsed);
        logExtraction({
          path: "regex",
          durationMs: Date.now() - regexStart,
          validationOk: v.ok,
        });
        if (v.ok) {
          try {
            const names = regexParsed.items.map((it) => it.name);
            const categories = await categorizerFn(names, client);
            return {
              ...regexParsed,
              items: regexParsed.items.map((it, idx) => ({
                ...it,
                groceryCategory: categories[idx] ?? "other",
              })),
            };
          } catch (catErr) {
            logExtraction({ path: "regex_categorize", warning: sanitizeReason(catErr) });
            return regexParsed;
          }
        }
      }
    } catch (regexErr) {
      logExtraction({
        path: "regex",
        durationMs: Date.now() - regexStart,
        validationOk: false,
        reason: sanitizeReason(regexErr),
      });
    }
  }

  const textPathEligible = text.length >= MIN_TEXT_LENGTH;
```

- [ ] **Step 5: Run all invoiceExtractor tests**

```bash
cd packages/api && pnpm test -- --reporter=verbose src/lib/invoiceExtractor.test.ts 2>&1 | tail -30
```

Expected: all 17 tests PASS (15 existing + 2 new)

- [ ] **Step 6: Run full test suite**

```bash
cd packages/api && pnpm test 2>&1 | tail -30
```

Expected: all parser, categorizer, and extractor tests pass. The orders/upload route tests will still fail with `DATABASE_URL` error — that is pre-existing and unrelated.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/lib/invoiceExtractor.ts \
        packages/api/src/lib/invoiceExtractor.test.ts
git commit -m "feat: wire regex invoice parser stage into extractInvoice pipeline"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Platform detection (detect.ts — Task 2)
- ✅ Blinkit parser with delivery/handling split (blinkit.ts — Task 3)
- ✅ Zepto parser (zepto.ts — Task 4)
- ✅ Categorizer — single Haiku call, soft failure (categorizer.ts — Task 5)
- ✅ Regex stage prepended to extractInvoice (Task 6)
- ✅ Claude fallback unchanged (existing stages untouched)
- ✅ Error handling: regex throws → log + fall through; categorizer throws → return without categories
- ✅ Fixtures as .txt files, no binary PDFs in tests
- ✅ `validate()` called after regex parse before categorizer

**Type consistency check:**
- `ParsedGroceryOrder` and `ParsedGroceryItem` types used consistently across all parsers
- `AnthropicLike` exported in Task 5 Step 5 before categorizer imports it
- `GroceryCategory` imported in invoiceExtractor.ts in Task 6 Step 3
- `regexParser` and `categorizer` dep signatures match their implementations exactly

**No placeholders:** All steps contain actual code, exact commands, and expected output.
