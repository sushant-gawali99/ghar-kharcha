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
