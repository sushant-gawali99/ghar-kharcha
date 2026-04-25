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
