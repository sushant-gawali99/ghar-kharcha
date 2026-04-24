// Ported from personal-expense-tracker/server/groceryInvoiceParser.ts
// Pure regex parser for Zepto and Swiggy Instamart invoices.

import {
  categorizeGroceryItem,
  type GroceryCategory,
  type GroceryPlatform,
} from "./groceryCategories";

export interface ParsedGroceryItem {
  name: string;
  quantity: number;
  unit: string;
  mrp: number;
  productRate: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  cess: number;
  totalAmount: number;
  groceryCategory: GroceryCategory;
  hsn: string;
}

export interface ParsedGroceryOrder {
  platform: GroceryPlatform;
  orderDate: string;
  invoiceNo: string;
  orderNo: string;
  itemTotal: number;
  handlingFee: number;
  deliveryFee: number;
  totalTaxes: number;
  totalDiscount: number;
  totalAmount: number;
  items: ParsedGroceryItem[];
}

function detectPlatform(text: string): GroceryPlatform {
  if (
    text.includes("Zepto") ||
    text.includes("ZEPTO") ||
    text.includes("zeptonow.com") ||
    text.includes("Drogheria Sellers")
  ) {
    return "zepto";
  }
  if (
    text.includes("Swiggy") ||
    text.includes("SWIGGY") ||
    text.includes("Instamart") ||
    text.includes("IMSCT")
  ) {
    return "swiggy_instamart";
  }
  return "other";
}

function parseDateToString(dateStr: string): string {
  // DD-MM-YYYY → YYYY-MM-DD
  const match = dateStr.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

function parseZeptoInvoice(text: string): ParsedGroceryOrder {
  const invoiceNoMatch = text.match(/Invoice No\.?:?\s*(\S+)/);
  const orderNoMatch = text.match(/Order No\.?:?\s*(\S+)/);
  const dateMatch = text.match(/Date\s*:\s*(\d{2}-\d{2}-\d{4})/);
  const invoiceValueMatch = text.match(/Invoice Value\s+([\d,.]+)/);

  const invoiceNo = invoiceNoMatch?.[1] || "";
  const orderNo = orderNoMatch?.[1] || "";
  const orderDate = dateMatch
    ? parseDateToString(dateMatch[1])
    : new Date().toISOString().split("T")[0];
  const totalAmount = invoiceValueMatch
    ? parseFloat(invoiceValueMatch[1].replace(/,/g, ""))
    : 0;

  const items: ParsedGroceryItem[] = [];
  const lines = text.split("\n");

  let itemStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("Total") &&
      lines[i].includes("Amt.") &&
      lines[i - 1]?.includes("Cess")
    ) {
      itemStartIdx = i + 1;
    }
    if (lines[i].includes("Item Total")) {
      break;
    }
  }

  if (itemStartIdx === -1) {
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      if (/^\d+$/.test(line) && parseInt(line) <= 50) {
        const nameLines: string[] = [];
        let j = i + 1;

        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (/^\d+\.\d{2}\s+\d{8}/.test(nextLine)) {
            const dataStr = nextLine;
            const name = nameLines.join(" ").trim();

            const numPattern =
              /^([\d.]+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+%)\s+([\d.]+)\s+([\d.]+%)\s+([\d.]+%)\s+([\d.]+)\s+([\d.]+)/;
            const numMatch = dataStr.match(numPattern);

            if (numMatch) {
              const mrp = parseFloat(numMatch[1]);
              const hsn = numMatch[2];
              const qty = parseInt(numMatch[3]);
              const productRate = parseFloat(numMatch[4]);
              const taxableAmt = parseFloat(numMatch[6]);
              const cgstAmt = parseFloat(numMatch[9]);
              const sgstAmt = parseFloat(numMatch[10]);

              let totalAmt = 0;
              let k = j + 1;
              while (k < lines.length && k <= j + 3) {
                const cessLine = lines[k].trim();
                if (/^\d+\.\d{2}$/.test(cessLine)) {
                  const nextAfter = lines[k + 1]?.trim();
                  if (nextAfter && /^\d+\.\d{2}$/.test(nextAfter)) {
                    totalAmt = parseFloat(nextAfter);
                    break;
                  } else {
                    totalAmt = parseFloat(cessLine);
                    break;
                  }
                }
                k++;
              }

              if (totalAmt === 0) {
                totalAmt = taxableAmt + cgstAmt + sgstAmt;
              }

              // Line discount = pre-tax product price minus the invoice's
              // "Taxable Amt." column. Matches the Disc.% Zepto prints.
              // Using MRP here is unreliable: on quick-commerce items the
              // printed MRP is often inflated relative to the real sale price.
              const discount = productRate * qty - taxableAmt;

              items.push({
                name,
                quantity: qty,
                unit: "pack",
                mrp,
                productRate,
                discount: discount > 0 ? parseFloat(discount.toFixed(2)) : 0,
                taxableAmount: taxableAmt,
                cgst: cgstAmt,
                sgst: sgstAmt,
                cess: 0,
                totalAmount: totalAmt,
                groceryCategory: categorizeGroceryItem(name),
                hsn,
              });
            }
            break;
          }
          nameLines.push(nextLine);
          j++;
        }
        i = j + 1;
        continue;
      }
      i++;
    }
  }

  // Fallback combined-regex pass on the table block.
  if (items.length === 0) {
    const tableSection = text.substring(
      text.indexOf("Amt.\n") + 5,
      text.indexOf("Item Total")
    );

    if (tableSection) {
      const itemRegex =
        /(\d+)\n([\s\S]*?)\n([\d.]+)\s+(\d{8,})\s+(\d+)\s+([\d.]+)\s+([\d.]+%)\s+([\d.]+)\s+([\d.]+%)\s+([\d.]+%)\s+([\d.]+)\s+([\d.]+)\s*\n\s*[\d.]+%\s*\n\s*\+\s*[\d.]+\s*\n\s*([\d.]+)\s+([\d.]+)/g;
      let match;
      while ((match = itemRegex.exec(tableSection)) !== null) {
        const name = match[2].replace(/\n/g, " ").trim();
        const mrp = parseFloat(match[3]);
        const hsn = match[4];
        const qty = parseInt(match[5]);
        const productRate = parseFloat(match[6]);
        const taxableAmt = parseFloat(match[8]);
        const cgstAmt = parseFloat(match[11]);
        const sgstAmt = parseFloat(match[12]);
        const cessAmt = parseFloat(match[13]);
        const totalAmt = parseFloat(match[14]);

        items.push({
          name,
          quantity: qty,
          unit: "pack",
          mrp,
          productRate,
          discount: parseFloat((productRate * qty - taxableAmt).toFixed(2)),
          taxableAmount: taxableAmt,
          cgst: cgstAmt,
          sgst: sgstAmt,
          cess: cessAmt,
          totalAmount: totalAmt,
          groceryCategory: categorizeGroceryItem(name),
          hsn,
        });
      }
    }
  }

  const itemTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalTaxes = items.reduce(
    (sum, item) => sum + item.cgst + item.sgst + item.cess,
    0
  );
  const totalDiscount = items.reduce((sum, item) => sum + item.discount, 0);

  return {
    platform: "zepto",
    orderDate,
    invoiceNo,
    orderNo,
    itemTotal: parseFloat(itemTotal.toFixed(2)),
    handlingFee: 0,
    deliveryFee: 0,
    totalTaxes: parseFloat(totalTaxes.toFixed(2)),
    totalDiscount: parseFloat(totalDiscount.toFixed(2)),
    totalAmount: totalAmount || parseFloat(itemTotal.toFixed(2)),
    items,
  };
}

function parseSwiggyInstamartInvoice(text: string): ParsedGroceryOrder {
  const invoiceNoMatch = text.match(/Invoice No:?\s*\n?\s*(\S+)/);
  const orderIdMatch = text.match(/Order ID:?\s*\n?\s*(\S+)/);
  const dateMatch = text.match(/Date of Invoice:?\s*\n?\s*(\d{2}-\d{2}-\d{4})/);
  const invoiceValueMatch = text.match(/Invoice Value\s+([\d,.]+)/);
  const handlingFeeMatch = text.match(/Handling Fee.*?([\d,.]+)\s*\n/);
  const totalMatch = text.match(/Handling Fee.*?[\d,.]+\s*\n\s*([\d,.]+)/);

  const invoiceNo = invoiceNoMatch?.[1] || "";
  const orderNo = orderIdMatch?.[1] || "";
  const orderDate = dateMatch
    ? parseDateToString(dateMatch[1])
    : new Date().toISOString().split("T")[0];
  const invoiceValue = invoiceValueMatch
    ? parseFloat(invoiceValueMatch[1].replace(/,/g, ""))
    : 0;
  const handlingFee = handlingFeeMatch
    ? parseFloat(handlingFeeMatch[1].replace(/,/g, ""))
    : 0;
  const totalAmount = totalMatch
    ? parseFloat(totalMatch[1].replace(/,/g, ""))
    : invoiceValue + handlingFee;

  const items: ParsedGroceryItem[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const singleLineMatch = line.match(
      /^(\d+)\.\s+(.+?)\s+(\d+)\s+(NOS|KGS|LTR|PKT|PCS)\s+(\d{8,})\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)$/
    );

    if (singleLineMatch) {
      const [
        ,
        ,
        name,
        qty,
        unit,
        hsn,
        taxableValue,
        discount,
        netTaxable,
        ,
        cgstAmt,
        ,
        sgstAmt,
        ,
        cessAmt,
        addCess,
        totalAmt,
      ] = singleLineMatch;

      items.push({
        name: name.trim(),
        quantity: parseInt(qty),
        unit,
        mrp: parseFloat(taxableValue),
        productRate: parseFloat(netTaxable) / parseInt(qty),
        discount: parseFloat(discount),
        taxableAmount: parseFloat(netTaxable),
        cgst: parseFloat(cgstAmt),
        sgst: parseFloat(sgstAmt),
        cess: parseFloat(cessAmt) + parseFloat(addCess),
        totalAmount: parseFloat(totalAmt),
        groceryCategory: categorizeGroceryItem(name.trim()),
        hsn,
      });
      continue;
    }

    const multiLineStart = line.match(/^(\d+)\.$/);
    if (multiLineStart) {
      const nameLines: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        const dataMatch = nextLine.match(
          /^(\d+)\s+(NOS|KGS|LTR|PKT|PCS)\s+(\d{8,})\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)$/
        );
        if (dataMatch) {
          const name = nameLines.join(" ").trim();
          const [
            ,
            qty,
            unit,
            hsn,
            taxableValue,
            discount,
            netTaxable,
            ,
            cgstAmt,
            ,
            sgstAmt,
            ,
            cessAmt,
            addCess,
            totalAmt,
          ] = dataMatch;

          items.push({
            name,
            quantity: parseInt(qty),
            unit,
            mrp: parseFloat(taxableValue),
            productRate: parseFloat(netTaxable) / parseInt(qty),
            discount: parseFloat(discount),
            taxableAmount: parseFloat(netTaxable),
            cgst: parseFloat(cgstAmt),
            sgst: parseFloat(sgstAmt),
            cess: parseFloat(cessAmt) + parseFloat(addCess),
            totalAmount: parseFloat(totalAmt),
            groceryCategory: categorizeGroceryItem(name),
            hsn,
          });
          break;
        }
        nameLines.push(nextLine);
        j++;
      }
      continue;
    }
  }

  const itemTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalTaxes = items.reduce(
    (sum, item) => sum + item.cgst + item.sgst + item.cess,
    0
  );
  const totalDiscount = items.reduce((sum, item) => sum + item.discount, 0);

  return {
    platform: "swiggy_instamart",
    orderDate,
    invoiceNo,
    orderNo,
    itemTotal: parseFloat(itemTotal.toFixed(2)),
    handlingFee,
    deliveryFee: 0,
    totalTaxes: parseFloat(
      (totalTaxes + (handlingFee > 0 ? handlingFee - handlingFee / 1.05 : 0)).toFixed(2)
    ),
    totalDiscount: parseFloat(totalDiscount.toFixed(2)),
    totalAmount,
    items,
  };
}

export function parseGroceryInvoice(text: string): ParsedGroceryOrder {
  const platform = detectPlatform(text);

  switch (platform) {
    case "zepto":
      return parseZeptoInvoice(text);
    case "swiggy_instamart":
      return parseSwiggyInstamartInvoice(text);
    default:
      throw new Error(
        "Unsupported grocery invoice format. Currently supports Zepto and Swiggy Instamart."
      );
  }
}
