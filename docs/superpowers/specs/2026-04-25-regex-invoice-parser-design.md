# Regex Invoice Parser Design

**Date:** 2026-04-25
**Status:** Approved

## Problem

The current invoice extraction pipeline sends every PDF to Claude (Haiku then Sonnet), costing ~$0.01/invoice and taking 2–5 seconds per parse. It also requires a valid Anthropic API key in production — when that key expires or is misconfigured, all parsing fails hard.

## Goal

Add a regex-based first stage to `extractInvoice` that parses Blinkit and Zepto invoices entirely in code. Claude is kept as a fallback for invoices the regex stage cannot handle, and retained for one lightweight task: assigning `groceryCategory` to items.

## Decisions

| Question | Decision |
|---|---|
| Replace Claude entirely? | No — regex-first, Claude fallback |
| Platforms in scope | Blinkit, Zepto (Swiggy added later when real invoice available) |
| Category assignment | Claude-only, single batch call after successful regex parse |

## Pipeline

```
PDF buffer
  │
  ├─ extractPdfText() → raw text
  │
  ├─ STAGE 1 — Regex parser (new)
  │    detect.ts → platform? (blinkit / zepto / null)
  │    platform parser → ParsedGroceryOrder (categories = "other")
  │    validate() → ✓ → categorizer → return   (fast path, ~50ms, ~$0.0001)
  │              → ✗ → fall through
  │
  └─ STAGE 2 — Claude fallback (existing, unchanged)
       Haiku text path → validate → ✓ return
       Sonnet PDF path → validate → ✓ return
       both fail → throw InvoiceExtractionError
```

## New Files

```
packages/api/src/lib/
  parsers/
    detect.ts          — platform detection from text
    blinkit.ts         — Blinkit forwarded-invoice parser
    zepto.ts           — Zepto/Drogheria invoice parser
    __fixtures__/
      blinkit.txt      — extracted text from ForwardInvoice_ORD38631533033.pdf
      zepto.txt        — extracted text from a Zepto Drogheria invoice
    detect.test.ts
    blinkit.test.ts
    zepto.test.ts
  categorizer.ts       — single Claude Haiku call for groceryCategory
  categorizer.test.ts
```

## Component Details

### `detect.ts`

Inspects the first 300 characters of extracted text for anchor strings:

- `"Blink Commerce"` or `"Zomato Hyperpure"` → `"blinkit"`
- `"Drogheria Sellers"` or `"Seller Name:"` → `"zepto"`
- Otherwise → `null` (caller falls through to Claude)

### `blinkit.ts`

Blinkit forwards a combined PDF with 2–3 sub-invoices concatenated (different sellers, same Order Id).

1. Split text on `"Tax Invoice"` to isolate sub-invoice blocks.
2. Extract metadata from first block: `Invoice Number :`, `Order Id :`, `Invoice Date :` / `Invoice Date:`.
3. For each product block, scan item rows (numbered `1`, `2`, `3`…). Skip rows starting with `-` (delivery charge rows) — sum their `Total` column into `deliveryFee`.
4. Identify the handling-charge sub-invoice (the page where the only item is `"Handling charge"`) — its total becomes `handlingFee`.
5. Aggregate items from all product sub-invoices.
6. `totalAmount` = sum of each sub-invoice's `Total` line value.
7. Return `ParsedGroceryOrder` with `groceryCategory: "other"` on all items.

### `zepto.ts`

Single-page invoices from Drogheria Sellers (Zepto's fulfillment partner).

1. `Invoice No.:` → `invoiceNo`, `Order No.:` → `orderNo`, `Date :` → `orderDate` (DD-MM-YYYY).
2. Item rows: each starts with a digit and tab/space; columns are name, MRP, HSN, qty, productRate, disc%, taxableAmt, CGST%, SGST%, totalAmt.
3. `Item Total` or `Invoice Value` → `totalAmount`.
4. Return `ParsedGroceryOrder` with `groceryCategory: "other"` on all items.

### `categorizer.ts`

```
categorizeItems(itemNames: string[], client?): Promise<GroceryCategory[]>
```

- One `claude-haiku-4-5-20251001` call with all item names in a compact numbered list.
- Prompt instructs Claude to return a JSON array of the same length, each value a valid `GroceryCategory`.
- If the call throws or returns a malformed/wrong-length array, returns `"other"` for every item (soft failure — order still saves).
- Client injected via optional parameter (same `deps` pattern as `extractInvoice`) for testability.

### `invoiceExtractor.ts` changes

- Add `parseInvoice(text)` call at the top of `extractInvoice`, before the Haiku text path.
- If regex parse succeeds validation, call `categorizeItems`, merge categories into items, return.
- If regex parse returns `null` or throws, log and continue to existing Claude stages.
- No changes to the existing Haiku → Sonnet fallback logic.

## Error Handling

| Failure | Behaviour |
|---|---|
| Platform not recognised | `detect` returns `null` → silent fall-through to Claude |
| Regex parse throws | Caught, logged, fall-through to Claude |
| Validation fails after regex | Fall-through to Claude |
| Categorizer throws | Log warning, return items with `groceryCategory: "other"` |
| Claude fallback also fails | Existing `InvoiceExtractionError` thrown (unchanged) |

## Testing

Each parser is tested against real extracted-text fixtures (plain `.txt` files, no binary PDFs in the test suite). Tests assert:

- Correct `invoiceNo`, `orderDate`, `platform`
- Correct item count, names, `totalAmount` values
- `deliveryFee` and `handlingFee` correctly split out (Blinkit)
- `validate()` passes on the parsed result

The categorizer is tested with a mocked Claude client. The `invoiceExtractor` integration tests gain two new cases: regex succeeds (categorizer called, Claude skipped) and regex fails (escalates to Haiku).

## Out of Scope

- Swiggy Instamart parser (added when real invoice sample available)
- Keyword-based category fallback
- Changing the validation tolerance or formula
