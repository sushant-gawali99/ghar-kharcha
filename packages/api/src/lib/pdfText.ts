// Adapted from personal-expense-tracker/server/routes.ts (parsePDF)
// Extracts text from a PDF buffer using pdfjs-dist's legacy build.

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  if (buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new Error("File is not a valid PDF");
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  let fullText = "";

  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();

      let lastY: number | undefined;
      let pageText = "";
      for (const item of textContent.items as Array<{
        str: string;
        transform: number[];
      }>) {
        if (lastY === item.transform[5] || lastY === undefined) {
          pageText += item.str;
        } else {
          pageText += "\n" + item.str;
        }
        lastY = item.transform[5];
      }

      fullText += "\n\n" + pageText;
    } catch (err) {
      console.warn(`Failed to extract text from page ${i}:`, err);
    }
  }

  pdfDoc.destroy();

  const text = fullText.trim();
  if (text.length < 10) {
    throw new Error("PDF appears to contain no readable text");
  }

  return text;
}
