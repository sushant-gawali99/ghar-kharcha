// Grocery platform + category enums. Items are categorised by Claude
// during invoice extraction; no keyword matcher is needed.

export const GROCERY_PLATFORMS = [
  "zepto",
  "swiggy_instamart",
  "other",
] as const;

export type GroceryPlatform = (typeof GROCERY_PLATFORMS)[number];

export const GROCERY_CATEGORIES = [
  "dairy",
  "fruits",
  "vegetables",
  "bread_bakery",
  "biscuits_cookies",
  "snacks",
  "beverages",
  "staples",
  "meat_eggs",
  "personal_care",
  "cleaning_household",
  "other",
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

export const GROCERY_CATEGORY_LABELS: Record<GroceryCategory, string> = {
  dairy: "Dairy",
  fruits: "Fruits",
  vegetables: "Vegetables",
  bread_bakery: "Bread & Bakery",
  biscuits_cookies: "Biscuits & Cookies",
  snacks: "Snacks",
  beverages: "Beverages",
  staples: "Staples & Grains",
  meat_eggs: "Meat & Eggs",
  personal_care: "Personal Care",
  cleaning_household: "Cleaning & Household",
  other: "Other",
};
