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
