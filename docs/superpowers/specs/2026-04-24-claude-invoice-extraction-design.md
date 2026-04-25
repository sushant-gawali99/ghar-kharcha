# Claude-API Grocery Invoice Extraction — Design

**Status:** Approved design, pre-implementation
**Date:** 2026-04-24
**Author:** Sushant Gawali
**Supersedes:** `packages/api/src/lib/groceryInvoiceParser.ts` (regex parser)

---

## 1. Problem

The current grocery invoice parser (`packages/api/src/lib/groceryInvoiceParser.ts`) is ~400 lines of hand-rolled regex covering Zepto and Swiggy Instamart PDFs. It is a deliberate "ship it now" port from a prior project. Known problems:

- **Silent layout drift.** Any change to a Zepto or Swiggy invoice template silently breaks extraction and surfaces as 422 `failed` uploads with no actionable error.
- **Platform lock-in.** Only Zepto and Swiggy Instamart are supported. Invoices from BigBasket, Blinkit, JioMart, or paper/kirana bills are rejected at upload.
- **No tests guard parsing behaviour.** The parser has no unit or integration tests. Regression risk on every invoice format change.
- **Keyword-based categorisation is brittle.** `categorizeGroceryItem(name)` matches hard-coded keywords and misses most branded items (e.g., "Amul Taaza 1L" does not contain "milk").

## 2. Goal

Replace the regex parser with a Claude-API-backed structured extractor that:

1. Works across any grocery invoice PDF (quick-commerce, supermarket, kirana), not just Zepto and Swiggy Instamart.
2. Survives layout changes without code updates.
3. Produces the same `ParsedGroceryOrder` output shape as today so no downstream code (upload route, DB schema, response contract) changes.
4. Categorises items accurately, replacing the keyword matcher.
5. Validates its own output before persisting.

## 3. Non-goals

- A review-and-edit UI for failed extractions (future work).
- Prompt versioning / A-B infrastructure.
- Streaming responses.
- Changes to the upload API contract, DB schema, or dedup logic.
- Use of third-party MCP servers (Swiggy, Zepto) to pull order history directly — evaluated and rejected separately; see Appendix A.

## 4. Architecture

```
POST /api/upload
  └─ upload.ts (entry; unchanged outer flow)
     ├─ persist raw PDF to disk + uploads row (unchanged)
     ├─ extractInvoice(pdfBuffer) ──────────────────────┐
     │    ├─ path A: pdfText → extractStructured(text, Haiku 4.5)
     │    │    └─ validate(parsed)
     │    └─ path B (escalation): extractStructured(pdfBytes, Sonnet 4.6)
     │         └─ validate(parsed)
     ├─ dedup on (userId, invoiceNo) (unchanged)
     ├─ insert orders + orderItems (unchanged)
     └─ return response (unchanged shape)
```

Only one new module is introduced: `packages/api/src/lib/invoiceExtractor.ts`. The upload route, DB schema, response shape, and shared types are unchanged. This is a parser swap, not an API change.

### Why tiered models

- Haiku 4.5 is sufficient and cheap for digitally-generated PDFs (Zepto, Swiggy, Blinkit), which are the 95% case.
- Sonnet 4.6 is used only when the text path fails validation or the extracted text is too short to work with (likely a scanned or photographed invoice that needs vision). Sonnet + PDF document block handles these.

### Why tool use (not free-form JSON)

The Anthropic API enforces the `input_schema` on tool calls: Claude cannot emit a malformed shape or an off-enum `groceryCategory`. This removes a class of parsing bugs and simplifies validation to business rules (totals, date parseability).

### Why prompt caching

The system prompt and tool schema are identical on every call. Applying `cache_control: { type: "ephemeral" }` to the system block yields ~90% input-cost reduction after the first uncached call. Per-request user content (the invoice) is not cached.

## 5. Module interface

`packages/api/src/lib/invoiceExtractor.ts`:

```ts
export async function extractInvoice(
  pdfBuffer: Buffer
): Promise<ParsedGroceryOrder>

export class InvoiceExtractionError extends Error {
  stage: "text" | "pdf" | "both"
  reason: string
  raw?: unknown
}
```

Internals (not exported):

- `extractStructured(input, model)` — single function that calls the Anthropic SDK with tool use. Accepts either a `text` block (path A) or a `document` block (path B). Returns the tool_use input JSON.
- `validate(parsed)` — returns `{ ok: true } | { ok: false, reason: string }`. Rules:
  - `invoiceNo` is a non-empty string.
  - `items.length > 0`.
  - `|Σ(item.totalAmount) + handlingFee + deliveryFee − totalAmount| ≤ 1` (₹1 rounding tolerance).
  - `platform` ∈ `{"zepto","swiggy_instamart","other"}` (enforced by schema too; validated defensively).
  - `orderDate` parses as a valid ISO date.
- `extractInvoice(buffer)` orchestration:
  1. `text = await extractPdfText(buffer)`.
  2. If `text.length >= 200`: call `extractStructured(text, "claude-haiku-4-5-20251001")` → `validate`.
  3. On (a) `text.length < 200`, or (b) path-A validation failure, or (c) tool_use absent: call `extractStructured(pdfBytes, "claude-sonnet-4-6")` → `validate`.
  4. If path B still fails, throw `InvoiceExtractionError` with `stage: "both"` and raw outputs attached.

### Types

`ParsedGroceryOrder` and `ParsedGroceryItem` move from `groceryInvoiceParser.ts` into `invoiceExtractor.ts` with the same shape (no downstream changes). `GroceryCategory` enum is retained as a type-only export from `lib/groceryCategories.ts` because it is referenced by `packages/api/src/db/schema.ts` and `packages/shared-types`. The keyword-matcher body of that file is deleted.

### Environment

One new variable: `ANTHROPIC_API_KEY`. Added to `packages/api/src/env.ts` with fail-fast validation at process start. `.env.example` and `docker-compose.yml` updated.

## 6. Tool schema

```jsonc
{
  "name": "record_invoice",
  "description": "Records the structured contents of one grocery invoice.",
  "input_schema": {
    "type": "object",
    "required": [
      "platform","orderDate","invoiceNo","items",
      "itemTotal","handlingFee","deliveryFee",
      "totalTaxes","totalDiscount","totalAmount"
    ],
    "properties": {
      "platform":      { "enum": ["zepto","swiggy_instamart","other"] },
      "orderDate":     { "type": "string", "description": "YYYY-MM-DD" },
      "invoiceNo":     { "type": "string" },
      "orderNo":       { "type": "string" },
      "itemTotal":     { "type": "number" },
      "handlingFee":   { "type": "number" },
      "deliveryFee":   { "type": "number" },
      "totalTaxes":    { "type": "number" },
      "totalDiscount": { "type": "number" },
      "totalAmount":   { "type": "number" },
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "name","quantity","unit","mrp","productRate",
            "discount","taxableAmount","cgst","sgst","cess",
            "totalAmount","groceryCategory"
          ],
          "properties": {
            "name":           { "type": "string" },
            "quantity":       { "type": "number" },
            "unit":           { "type": "string" },
            "mrp":            { "type": "number" },
            "productRate":    { "type": "number" },
            "discount":       { "type": "number" },
            "taxableAmount":  { "type": "number" },
            "cgst":           { "type": "number" },
            "sgst":           { "type": "number" },
            "cess":           { "type": "number" },
            "totalAmount":    { "type": "number" },
            "hsn":            { "type": "string" },
            "groceryCategory": {
              "enum": [
                "dairy","fruits","vegetables","bread_bakery",
                "biscuits_cookies","snacks","beverages","staples",
                "meat_eggs","personal_care","cleaning_household","other"
              ]
            }
          }
        }
      }
    }
  }
}
```

The enum values in `groceryCategory` MUST match the existing `GroceryCategory` type in `packages/api/src/lib/groceryCategories.ts`; any mismatch is caught by TypeScript at build time.

## 7. System prompt (stable, cached)

```
You extract structured data from Indian grocery invoices, including
quick-commerce (Zepto, Swiggy Instamart, Blinkit, BigBasket, JioMart)
and in-store or kirana receipts.

Always call `record_invoice` exactly once per invoice.

Field rules:
- Monetary values are in rupees, no currency symbols, numbers only.
- `productRate` is the per-unit pre-tax price.
- `taxableAmount` is productRate × quantity − discount.
- Prefer the invoice's printed "Taxable Amt." column over computing
  from MRP; quick-commerce MRP is often inflated relative to the
  actual sale price.
- `platform`:
  - "zepto" if the invoice mentions Zepto, zeptonow.com, or Drogheria Sellers.
  - "swiggy_instamart" if it mentions Swiggy, Instamart, or IMSCT.
  - "other" otherwise.
- If a field is not present in the invoice, use "" for strings and 0
  for numbers. Never invent values.
- `groceryCategory` must be one of the enum values.
```

The user message contains only the invoice content as either a `text` block (path A) or a `document` block with the PDF bytes (path B). No templating or per-request instructions. This maximises the cached prefix.

### Model configuration

- Path A: `claude-haiku-4-5-20251001`
- Path B: `claude-sonnet-4-6`
- `max_tokens`: 4096 (item arrays can be long on large orders)
- Single-turn, no streaming
- `tool_choice: { type: "tool", name: "record_invoice" }` to force the tool call

## 8. Failure handling

| Failure | Behaviour |
|---|---|
| Path A: Anthropic SDK error (network, 5xx, rate limit) | Escalate to Path B. |
| Path A: `tool_use` absent in response | Escalate to Path B. |
| Path A: `validate()` returns `ok: false` | Escalate to Path B. |
| Path A: extracted text < 200 chars | Skip Path A; go straight to Path B. |
| Path B: any of the above | Throw `InvoiceExtractionError({ stage: "both", reason, raw })`. |
| Caught in `upload.ts` | Mark `uploads.status = "failed"`, set `errorMessage`, return 422. (Same behaviour as today.) |

The raw Claude response (tool_use input if any, otherwise the full message) is logged on final failure so we can debug extraction regressions against specific PDFs.

There are no retry loops. One text attempt, one PDF attempt, then hard fail.

## 9. Testing

Per `CLAUDE.md`: TDD is required; integration tests hit a real DB (not mocks). The Anthropic SDK is a third-party network boundary, so mocking it in tests is standard practice — the "no mocking DB" rule is specifically about prod/migration divergence, not a blanket ban on mocks.

### Layer 1 — Unit tests (Vitest, colocated `.test.ts`)

`invoiceExtractor.test.ts`:

- `validate()` — table-driven:
  - missing `invoiceNo` → fail
  - `items.length === 0` → fail
  - totals mismatch > ₹1 → fail
  - totals match within ₹1 → pass
  - malformed `orderDate` → fail
  - off-enum `platform` → fail (defensive; schema should prevent)
- `extractInvoice()` orchestration with a mocked Anthropic client:
  - Path A succeeds → returns parsed, Sonnet never invoked.
  - Path A validation fails → Sonnet called with PDF bytes; returns parsed.
  - Path A throws → Sonnet called; returns parsed.
  - Both paths fail → throws `InvoiceExtractionError` with `stage: "both"`.
  - `text.length < 200` → Path A skipped entirely.

### Layer 2 — Integration test (Vitest + real Postgres)

`routes/upload.test.ts` (new file):

- POST `/api/upload` with a fixture PDF, Anthropic mocked to return a known structured payload. Verify rows in `uploads`, `orders`, `orderItems`.
- Duplicate-invoice path: same invoice uploaded twice → second returns `status: "duplicate"` with existing `orderId`.
- Extraction-failure path: Anthropic mock throws → row marked `failed`, 422 returned.

### Layer 3 — Golden fixture tests (manual, API-live)

`invoiceExtractor.golden.test.ts`, gated behind `RUN_GOLDEN=1`:

- Fixture set in `packages/api/test/fixtures/`:
  - 2 Zepto PDFs
  - 2 Swiggy Instamart PDFs
  - 1 "other" platform PDF (BigBasket, Blinkit, or a scanned kirana bill)
- Each fixture has a companion `.expected.json` with ground-truth values for assertion.
- Assertions: correct `platform`, non-empty `invoiceNo`, `items.length` within expected range, `totalAmount` within ₹1 of ground truth.
- Run manually before release. Not in CI.

### TDD order

1. `validate()` — red, green, refactor.
2. `extractInvoice()` orchestration with mocked SDK.
3. `upload` route integration test.
4. Capture fixtures from `tmp-uploads/`; write golden tests last.

## 10. Rollout

Small, atomic commits direct to `main` (per CLAUDE.md trunk-based rules):

1. **dependency + env:** add `@anthropic-ai/sdk` to `packages/api/package.json`; add `ANTHROPIC_API_KEY` to `env.ts` with fail-fast check; update `.env.example` and `docker-compose.yml`.
2. **validator:** TDD `validate()` in `invoiceExtractor.ts`.
3. **extractor orchestration:** TDD `extractInvoice()` with mocked Anthropic SDK.
4. **route integration:** flip `upload.ts` to call `extractInvoice(buffer)`; add integration test.
5. **fixtures + golden tests:** capture PDFs from `tmp-uploads/`, commit to `packages/api/test/fixtures/`, add golden tests.
6. **manual verification:** run golden tests against the live API. Compare extracted output to what the regex parser produces on the same fixtures. Only proceed once parity or improvement is confirmed.
7. **cleanup:** delete `groceryInvoiceParser.ts` and the keyword-matcher body of `groceryCategories.ts`. Keep the `GroceryCategory` type-only export. Remove any now-orphan helpers.

No feature flag. The response shape is identical, dedup still works on `invoiceNo`, and existing DB rows are untouched. Rollback = revert the `upload.ts` flip.

### Observability

Log per-extraction at INFO level:

- `uploadId`
- `model` (haiku or sonnet)
- `path` (text or pdf)
- `usage.input_tokens` (uncached)
- `usage.cache_read_input_tokens`
- `usage.output_tokens`
- `durationMs`
- `validationResult`

Cheap to add, makes cost and latency visible from day one.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Extraction regresses on known-good Zepto/Swiggy PDFs | Golden tests compare against regex output before cutover. |
| Anthropic API unavailability blocks all uploads | Upload today already returns 422 on parser failure; behaviour is unchanged. Consider retry with backoff in a follow-up if this becomes a real problem. |
| Cost runaway (e.g., 1000 uploads/day) | Logging surfaces per-extraction cost. Haiku + prompt caching keeps the happy-path cheap. Revisit only if observability shows it matters. |
| Claude hallucinates an `invoiceNo` that later collides with a real one | Validation requires `invoiceNo` non-empty but cannot detect hallucination. Acceptable risk: `invoiceNo` dedup is per-user and collision would require a hallucinated string matching a real one — vanishingly rare. |
| Prompt injection via invoice content | Low risk — the response is constrained to the tool schema. Even a maliciously crafted PDF can at worst produce malformed data, not escape the structured output. |

## Appendix A — Why not Swiggy/Zepto MCP servers

The Swiggy Instamart MCP server at `mcp.swiggy.com/im` does expose `get_orders` and `get_order_details`, making direct retrieval theoretically possible. Rejected because:

1. Swiggy's documentation explicitly states "third-party app development is not permitted at this time due to ongoing security reviews and compliance requirements."
2. OAuth redirect URIs are whitelisted to Claude.ai, VS Code, and localhost. Ghar-kharcha's backend cannot be added.
3. Reverse-engineering the underlying private HTTP APIs is fragile, unsupported, and risks account suspension.
4. The MCP server runs on Swiggy's infra; there is no local proxy traffic to sniff — the client only sees MCP protocol frames.

Personal workflow (using the MCP server from the user's own Claude Desktop, exporting data, then importing into ghar-kharcha) remains viable but is out of scope for this spec.

Zepto's MCP endpoint at `mcp.zepto.co.in/mcp` returns 401 without auth and has no public manifest. Same constraints assumed to apply.
