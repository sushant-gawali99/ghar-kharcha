import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { detectPlatform } from "./detect";

const blinkitFixture = readFileSync(
  join(__dirname, "__fixtures__/blinkit.txt"),
  "utf8"
);
const zeptoFixture = readFileSync(
  join(__dirname, "__fixtures__/zepto.txt"),
  "utf8"
);

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

  it("returns zepto for real Zepto invoice fixture", () => {
    expect(detectPlatform(zeptoFixture)).toBe("zepto");
  });

  it("returns blinkit for real Blinkit invoice fixture", () => {
    expect(detectPlatform(blinkitFixture)).toBe("blinkit");
  });

  it("returns null for unknown invoice", () => {
    expect(detectPlatform("Some Kirana Shop\nInvoice No: 123")).toBeNull();
  });
});
