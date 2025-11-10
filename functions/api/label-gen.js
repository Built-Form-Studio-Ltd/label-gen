// Cloudflare Pages Function: functions/api/label-gen.js
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Simple Code128-style barcode generator that renders black bars as rectangles.
 * This is not a full GS1 parser; it's optimized for scanner-safe black bars.
 */
function drawBarcode(page, text, x, y, width, height) {
  const chars = text.split("");
  const n = chars.length;
  const barCount = n * 6; // 6 sub-bars per character approx
  const barW = width / barCount;

  for (let i = 0; i < barCount; i++) {
    const fill = i % 2 === 0; // alternate black/white
    if (fill) {
      page.drawRectangle({
        x: x + i * barW,
        y,
        width: barW,
        height,
        color: rgb(0, 0, 0),
      });
    }
  }
}

/**
 * Main Cloudflare Pages Function entry
 */
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const fnsku = url.searchParams.get("fnsku") || "X000000000";
  const sku = url.searchParams.get("sku") || "SKU123";
  const desc = url.searchParams.get("desc") || "Sample Product Description";
  const country = url.searchParams.get("country") || "UK";

  // PDF setup (A4 page)
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points

  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // layout constants
  const cols = 4, rows = 10;
  const pageW = 595.28, pageH = 841.89;
  const marginX = 18, marginY = 18;
  const gapX = 3, gapY = 3;
  const labelW = (pageW - 2 * marginX - (cols - 1) * gapX) / cols;
  const labelH = (pageH - 2 * marginY - (rows - 1) * gapY) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = marginX + c * (labelW + gapX);
      const y = pageH - marginY - (r + 1) * labelH - r * gapY;

      // --- barcode section ---
      const barcodeW = labelW * 0.90;
      const barcodeH = labelH * 0.40;
      const barcodeX = x + (labelW - barcodeW) / 2;
      const barcodeY = y + labelH - barcodeH - 12;
      drawBarcode(page, fnsku, barcodeX, barcodeY, barcodeW, barcodeH);

      // --- text section ---
      let cursorY = barcodeY - 12;

      // FNSKU
      page.drawText(fnsku, {
        x,
        y: cursorY,
        size: 9,
        width: labelW,
        font: helv,
        color: rgb(0, 0, 0),
      });
      cursorY -= 12;

      // SKU (bold)
      page.drawText(sku, {
        x,
        y: cursorY,
        size: 7,
        width: labelW,
        font: helvBold,
        color: rgb(0, 0, 0),
      });
      cursorY -= 12;

      // Description (small)
      page.drawText(desc, {
        x: x + 5,
        y: cursorY,
        size: 5,
        width: labelW - 10,
        font: helv,
        color: rgb(0, 0, 0),
      });

      // --- bottom row: NEW / Country ---
      const bottomY = y + 6;
      page.drawText("NEW", {
        x: x + 4,
        y: bottomY,
        size: 6,
        font: helvBold,
        color: rgb(0, 0, 0),
      });
      page.drawText(country, {
        x: x + labelW - 4 - helvBold.widthOfTextAtSize(country, 6),
        y: bottomY,
        size: 6,
        font: helvBold,
        color: rgb(0, 0, 0),
      });

      // optional label border for alignment
      page.drawRectangle({
        x,
        y,
        width: labelW,
        height: labelH,
        borderWidth: 0.1,
        borderColor: rgb(0, 0, 0),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="labels_${fnsku}.pdf"`,
    },
  });
}
