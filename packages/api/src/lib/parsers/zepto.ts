import type { ParsedGroceryOrder, ParsedGroceryItem } from "../invoiceExtractor";

function normaliseDateToISO(raw: string): string {
  const short = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (short) return `${short[3]}-${short[2]}-${short[1]}`;
  return raw;
}

function parseZeptoItems(text: string): ParsedGroceryItem[] {
  // Item table: after first "Total\nAmt.\n" header, before "Item Total" / "Invoice Value"
  const headerToken = "Total\nAmt.\n";
  const headerIdx = text.indexOf(headerToken);
  const tableStart = headerIdx >= 0 ? headerIdx + headerToken.length : 0;
  const tableEndMatch = text.search(/\nItem Total|\nInvoice Value/);
  const table = text.slice(tableStart, tableEndMatch > 0 ? tableEndMatch : undefined);

  const lines = table
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ParsedGroceryItem[] = [];
  let state: "seek" | "collect" = "seek";
  let nameLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Combined line: item-number name MRP HSN Qty ProductRate Disc% TaxableAmt ...
    // e.g. "5 Broccoli 1 pc 38.00 07099990 1 38.00 26.31% 28.00 ..."
    const combined = line.match(
      /^(\d+)\s+(.+?)\s+([\d.]+)\s+(\d{5,8})\s+(\d+)\s+([\d.]+)\s+[\d.]+%\s+([\d.]+)/
    );
    if (combined) {
      // Find the terminal "cessAmt totalAmt" line in next 5 lines
      let total = 0;
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const tm = lines[j].match(/^([\d.]+)\s+([\d.]+)$/);
        if (tm) {
          total = parseFloat(tm[2]);
          break;
        }
      }

      const mrp = parseFloat(combined[3]);
      const qty = parseInt(combined[5]);
      const productRate = parseFloat(combined[6]);
      const taxableAmt = parseFloat(combined[7]);
      const discount = Math.max(0, productRate * qty - taxableAmt);

      items.push({
        name: combined[2].replace(/\s+/g, " ").trim(),
        quantity: qty,
        unit: "unit",
        mrp,
        productRate,
        discount,
        taxableAmount: taxableAmt,
        cgst: 0,
        sgst: 0,
        cess: 0,
        totalAmount: total,
        hsn: combined[4],
        groceryCategory: "other",
      });

      state = "seek";
      nameLines = [];
      continue;
    }

    // Data line: MRP(decimal) HSN(5-8 digits) Qty ProductRate Disc% TaxableAmt ...
    const dm = line.match(
      /^([\d.]+)\s+(\d{5,8})\s+(\d+)\s+([\d.]+)\s+[\d.]+%\s+([\d.]+)/
    );
    if (dm) {
      // Find the terminal "cessAmt totalAmt" line in next 5 lines
      let total = 0;
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const tm = lines[j].match(/^([\d.]+)\s+([\d.]+)$/);
        if (tm) {
          total = parseFloat(tm[2]);
          break;
        }
      }

      const mrp = parseFloat(dm[1]);
      const qty = parseInt(dm[3]);
      const productRate = parseFloat(dm[4]);
      const taxableAmt = parseFloat(dm[5]);
      const discount = Math.max(0, productRate * qty - taxableAmt);

      items.push({
        name: nameLines.join(" ").replace(/\s+/g, " ").trim(),
        quantity: qty,
        unit: "unit",
        mrp,
        productRate,
        discount,
        taxableAmount: taxableAmt,
        cgst: 0,
        sgst: 0,
        cess: 0,
        totalAmount: total,
        hsn: dm[2],
        groceryCategory: "other",
      });

      state = "seek";
      nameLines = [];
      continue;
    }

    if (state === "seek") {
      // Item number alone on a line: "1"
      if (/^\d+$/.test(line)) {
        state = "collect";
        nameLines = [];
        continue;
      }
      // Item number with content: "5 Broccoli 1 pc" (but NOT a data line — already handled above)
      if (/^\d+ \w/.test(line)) {
        state = "collect";
        nameLines = [line.replace(/^\d+ /, "")];
        continue;
      }
      continue;
    }

    // state === "collect": accumulate name lines
    if (/^[\d.]+%$/.test(line)) continue;
    if (/^\+\s/.test(line)) continue;
    // page subtotal line: multiple numbers separated by spaces
    if (/^[\d.]+ [\d.]+ [\d.]+ [\d.]+ [\d.]+/.test(line)) continue;
    nameLines.push(line);
  }

  return items;
}

export function parseZeptoText(text: string): ParsedGroceryOrder {
  const invoiceNo =
    text.match(/Invoice No\.\s*:\s*([A-Z0-9]+)/)?.[1]?.trim() ?? "";
  const orderNo =
    text.match(/Order No\.\s*:\s*([A-Z0-9]+)/)?.[1]?.trim() ?? "";
  const rawDate = text.match(/Date\s*:\s*(\d{2}-\d{2}-\d{4})/)?.[1] ?? "";
  const orderDate = normaliseDateToISO(rawDate);

  const totalAmount = parseFloat(
    text.match(/(?:Item Total|Invoice Value)\s+([\d.]+)/)?.[1] ?? "0"
  );

  const items = parseZeptoItems(text);

  const totalTaxes = items.reduce((s, it) => s + it.cgst + it.sgst + it.cess, 0);
  const totalDiscount = items.reduce((s, it) => s + it.discount, 0);

  return {
    platform: "zepto",
    invoiceNo,
    orderNo,
    orderDate,
    items,
    itemTotal: items.reduce((s, it) => s + it.totalAmount, 0),
    handlingFee: 0,
    deliveryFee: 0,
    totalTaxes,
    totalDiscount,
    totalAmount,
  };
}
