import { describe, it, expect, vi } from "vitest";
import { categorizeItems } from "./categorizer";

function makeClient(responseText: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: responseText }],
        usage: {},
      }),
    },
  };
}

describe("categorizeItems", () => {
  it("returns parsed categories from Claude response", async () => {
    const client = makeClient('["dairy", "vegetables"]');
    const result = await categorizeItems(["Amul Milk", "Spinach"], client as never);
    expect(result).toEqual(["dairy", "vegetables"]);
  });

  it("returns empty array for empty input", async () => {
    const client = makeClient("[]");
    const result = await categorizeItems([], client as never);
    expect(result).toEqual([]);
    expect(client.messages.create).not.toHaveBeenCalled();
  });

  it("coerces unknown category values to other", async () => {
    const client = makeClient('["dairy", "unknown_category"]');
    const result = await categorizeItems(["Milk", "Foo"], client as never);
    expect(result).toEqual(["dairy", "other"]);
  });

  it("falls back to all-other when Claude throws", async () => {
    const client = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error("API error")),
      },
    };
    const result = await categorizeItems(["Milk", "Spinach"], client as never);
    expect(result).toEqual(["other", "other"]);
  });

  it("falls back to all-other when response has wrong array length", async () => {
    const client = makeClient('["dairy"]');
    const result = await categorizeItems(["Milk", "Spinach"], client as never);
    expect(result).toEqual(["other", "other"]);
  });

  it("falls back to all-other when response is not valid JSON array", async () => {
    const client = makeClient("sorry, I cannot categorize these");
    const result = await categorizeItems(["Milk"], client as never);
    expect(result).toEqual(["other"]);
  });

  it("returns correct categories when response has preamble text with brackets", async () => {
    // Non-greedy regex would match [1] instead of ["dairy"] here
    const client = makeClient('Based on rule [1], the categories are: ["dairy", "vegetables"]');
    const result = await categorizeItems(["Milk", "Spinach"], client as never);
    expect(result).toEqual(["dairy", "vegetables"]);
  });
});
