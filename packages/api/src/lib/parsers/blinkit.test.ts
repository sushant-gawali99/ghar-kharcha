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
