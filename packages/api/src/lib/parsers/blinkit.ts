import type { ParsedGroceryOrder, ParsedGroceryItem } from "../invoiceExtractor";

function normaliseDateToISO(raw: string): string {
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  // "14-Apr-2026"
  const long = raw.match(/^(\d{2})-([A-Za-z]+)-(\d{4})$/);
  if (long) return `${long[3]}-${months[long[2]] ?? long[2]}-${long[1]}`;
  // "14-04-2026"
  const short = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (short) return `${short[3]}-${short[2]}-${short[1]}`;
  return raw;
}

function extractBlinkitName(lines: string[], dataIdx: number): string {
  const parts: string[] = [];
  for (let i = dataIdx - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) break;
    if (/^\d+\s+\d{4}$/.test(line)) break;          // "1 8901" — item number + UPC start
    if (/^\d+$/.test(line)) continue;                // UPC digit chunk — skip
    if (/^-\s+-/.test(line)) break;                  // delivery row — stop
    if (/^[\d.]+\s+[\d.]+\s+\d+/.test(line)) break; // another data line — stop
    parts.unshift(line);
  }
  return parts
    .join(" ")
    .replace(/\s*\(HSN[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseBlinkitText(text: string): ParsedGroceryOrder {
  // Each sub-invoice starts with "Tax Invoice"
  const blocks = text
    .split("Tax Invoice")
    .map((b) => b.trim())
    .filter(Boolean);

  let invoiceNo = "";
  let orderDate = "";
  const items: ParsedGroceryItem[] = [];
  let deliveryFee = 0;
  let handlingFee = 0;
  let totalAmount = 0;

  for (const block of blocks) {
    // Sub-invoice total: last number on the first "Total <integer> ..." line
    // (Annexure has "Total 5.087 ..." — excluded by requiring integer second token)
    const subTotalMatch = block.match(/^Total\s+\d+(?![.\d]).*\s([\d.]+)\s*$/m);
    const subTotal = parseFloat(subTotalMatch?.[1] ?? "0");
    totalAmount += subTotal;

    // Handling charge block: the dedicated handling invoice uses "HSN Code" in
    // its table header (not "UPC"), and has no grocery product rows.
    // Block 0 also mentions "Handling charge" in an Annexure — we must not skip it.
    const isHandlingOnlyBlock =
      /\bHandling charge\b/i.test(block) && /HSN Code Item Description/i.test(block);
    if (isHandlingOnlyBlock) {
      handlingFee += subTotal;
      continue;
    }

    // Extract invoice metadata from the first product block
    // Use the first product block's invoice number as the order's invoice number.
    // Blinkit forwarded invoices contain multiple sub-invoice numbers (one per seller);
    // we pick the first rather than concatenating all.
    if (!invoiceNo) {
      invoiceNo =
        block.match(/Invoice Number\s*:?\s*([A-Z0-9]+)/)?.[1]?.trim() ?? "";
      const rawDate =
        block.match(/Invoice\s*\n\s*Date\s*\n\s*:\s*(\d{2}-[A-Za-z]+-\d{4})/)?.[1] ??
        block.match(/Invoice Date\s*:\s*(\d{2}-\d{2}-\d{4})/)?.[1] ??
        "";
      orderDate = normaliseDateToISO(rawDate);
    }

    // Parse item and delivery rows line by line
    const lines = block.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Product data line: MRP Discount Qty TaxableVal [6 more nums] Total
      const pm = line.match(
        /^([\d.]+)\s+([\d.]+)\s+(\d+)\s+([\d.]+)(?:\s+[\d.]+){6}\s+([\d.]+)$/
      );
      if (pm && !line.startsWith("-")) {
        items.push({
          name: extractBlinkitName(lines, i),
          quantity: parseInt(pm[3]),
          unit: "unit",
          mrp: parseFloat(pm[1]),
          productRate: parseFloat(pm[1]) - parseFloat(pm[2]),
          discount: parseFloat(pm[2]),
          taxableAmount: parseFloat(pm[4]),
          cgst: 0,
          sgst: 0,
          cess: 0,
          totalAmount: parseFloat(pm[5]),
          hsn: "",
          groceryCategory: "other",
        });
        continue;
      }

      // Delivery row: "- - - <nums> <total>"
      const dm = line.match(/^-\s+-\s+-\s+.+\s+([\d.]+)$/);
      if (dm) deliveryFee += parseFloat(dm[1]);
    }
  }

  const totalTaxes = items.reduce((s, it) => s + it.cgst + it.sgst + it.cess, 0);
  const totalDiscount = items.reduce((s, it) => s + it.discount, 0);

  return {
    platform: "blinkit",
    invoiceNo,
    orderNo: "",
    orderDate,
    items,
    itemTotal: items.reduce((s, it) => s + it.totalAmount, 0),
    handlingFee,
    deliveryFee,
    totalTaxes,
    totalDiscount,
    totalAmount,
  };
}
