import type { GroceryCategory } from "./groceryCategories";
import { GROCERY_CATEGORIES } from "./groceryCategories";
import { HAIKU_MODEL, type AnthropicLike } from "./invoiceExtractor";

export async function categorizeItems(
  itemNames: string[],
  client: AnthropicLike,
): Promise<GroceryCategory[]> {
  if (itemNames.length === 0) return [];

  const fallback = (): GroceryCategory[] => itemNames.map(() => "other");
  const validCategories = GROCERY_CATEGORIES.join(", ");
  const numbered = itemNames.map((n, i) => `${i + 1}. ${n}`).join("\n");

  try {
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Categorize each grocery item into exactly one of: ${validCategories}.\n\nItems:\n${numbered}\n\nReturn a JSON array of category strings, same order, same length. Example: ["dairy","vegetables"]`,
        },
      ],
    });

    const text =
      (response.content as Array<{ type: string; text?: string }>)
        .find((b) => b.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\[\s*["'][\s\S]*\]/);
    if (!jsonMatch) return fallback();

    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    if (!Array.isArray(parsed) || parsed.length !== itemNames.length) return fallback();

    return parsed.map((cat) =>
      (GROCERY_CATEGORIES as readonly string[]).includes(cat as string)
        ? (cat as GroceryCategory)
        : "other"
    );
  } catch {
    return fallback();
  }
}
