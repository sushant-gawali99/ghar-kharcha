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
