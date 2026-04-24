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

  it("rejects year-only orderDate (not YYYY-MM-DD)", () => {
    const result = validate(makeOrder({ orderDate: "2026" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/YYYY-MM-DD/);
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
