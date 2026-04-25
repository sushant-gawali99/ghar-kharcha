import type { GroceryPlatform } from "../groceryCategories";

export function detectPlatform(text: string): GroceryPlatform | null {
  const head = text.slice(0, 400);
  if (/Blink Commerce|Zomato Hyperpure/i.test(head)) return "blinkit";
  if (/Drogheria Sellers|^Seller Name:/m.test(head)) return "zepto";
  return null;
}
