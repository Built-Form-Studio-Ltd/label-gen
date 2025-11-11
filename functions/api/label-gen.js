import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/* ---------------- Code 128 (Set B) renderer — edge safe (no fs/canvas) ---------------- */

// 107 symbol patterns: 6 integers (3 bars + 3 spaces) totalling 11 modules per symbol.
// Based on ISO/IEC 15417. DO NOT EDIT.
const CODE128_PATTERNS = [
  [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
  [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
  [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
  [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
  [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
  [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
  [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
  [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
  [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
  [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
  [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
  [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
  [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
  [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
  [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
  [2,4,1,2,1,1],[2,2,1,1,1,4],[2,2,1,4,1,1],[2,1,1,2,1,4],[2,1,1,4,1,2],
  [2,1,1,4,1,2],[1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],
  [1,2,4,1,1,2],[1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],
  [2,1,2,1,4,1],[2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],
  [1,3,1,1,4,1],[1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],
  [1,1,3,1,4,1],[1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,2,1],
  [2,1,2,1,1,4],[2,1,2,4,1,1],[2,4,1,1,2,1],[4,1,2,1,1,2],[1,3,4,1,1,1],
  [1,1,1,2,2,2] // index 106=STOP handled specially below
];

function encodeCode128B(text) {
  const codes = [104]; // Start B
  for (const ch of text) {
    const cc = ch.charCodeAt(0);
    if (cc < 32 || cc > 126) throw new Error(`Unsupported char: ${ch}`);
    codes.push(cc - 32);
  }
  let sum = codes[0];
  for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
  codes.push(sum % 103, 106); // checksum, STOP
  return codes;
}

function drawCode128(page, x, y, text, moduleW, barH, color = rgb(0,0,0)) {
  const codes = encodeCode128B(text);
  let cursor = x;
  for (const code of codes) {
    if (code === 106) { // STOP: 2-3-3-1-1-1-2 (13 modules; 4 bars/3 spaces)
      const stop = [2,3,3,1,1,1,2];
      let bar = true;
      for (const w of stop) {
        const wpx = w * moduleW;
        if (bar) page.drawRectangle({ x: cursor, y, width: wpx, height: barH, color });
        cursor += wpx; bar = !bar;
      }
      break;
    }
    const patt = CODE128_PATTERNS[code];
    let bar = true;
    for (const w of patt) {
      const wpx = w * moduleW;
      if (bar) page.drawRectangle({ x: cursor, y, width: wpx, height: barH, color });
      cursor += wpx; bar = !bar;
    }
  }
}

/* ----------------------------- Cloudflare Pages Function ----------------------------- */
export async function onRequestGet(context) {
  try {
    const { request } = context;
    const { searchParams } = new URL(request.url);

    const fnsku   = searchParams.get("fnsku")   || "X000000000";
    const sku     = searchParams.get("sku")     || "SKU123";
    const desc    = searchParams.get("desc")    || "Sample Product";
    const country = searchParams.get("country") || "UK";

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4
    const helv  = await pdf.embedFont(StandardFonts.Helvetica);
    const helvB = await pdf.embedFont(StandardFonts.HelveticaBold);

    // Same grid geometry as your original pdfkit version:contentReference[oaicite:1]{index=1}
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

        // --- Barcode at the TOP of the label (to match your target image) ---
        const barcodeW = labelW * 0.90;
        const barcodeH = labelH * 0.40;
        const barcodeX = x + (labelW - barcodeW) / 2;
        const barcodeY = y + labelH - barcodeH - 6;

        // Module width so barcode fits (keep ≥0.6 for crisp print)
        const estModules = (fnsku.length + 3) * 11 + 13;
        const moduleW = Math.max(0.6, barcodeW / estModules);

        // Draw barcode
        drawCode128(page, barcodeX, barcodeY, fnsku, moduleW, barcodeH);

        // --- Text stack (all centred), then bottom row NEW (left) / country (right) ---
        // FNSKU (centre) just under barcode
        let textY = barcodeY - 12;
        const fnskuSize = 12; // slightly larger like your example image
        const fnskuW = helv.widthOfTextAtSize(fnsku, fnskuSize);
        page.drawText(fnsku, {
          x: x + (labelW - fnskuW) / 2,
          y: textY,
          size: fnskuSize,
          font: helv,
          color: rgb(0,0,0),
        });

        // SKU bold (centre)
        textY -= 16;
        const skuSize = 9;
        const skuW = helvB.widthOfTextAtSize(sku, skuSize);
        page.drawText(sku, {
          x: x + (labelW - skuW) / 2,
          y: textY,
          size: skuSize,
          font: helvB,
          color: rgb(0,0,0),
        });

        // Description (centre, small)
        textY -= 14;
        const descSize = 7;
        const descW = labelW * 0.90;
        page.drawText(desc, {
          x: x + (labelW - descW) / 2,
          y: textY,
          size: descSize,
          font: helv,
          color: rgb(0,0,0),
          maxWidth: descW,
        });

        // Bottom row: NEW (left) and country (right) — like your pdfkit layout:contentReference[oaicite:2]{index=2}
        const bottomY = y + 7;
        page.drawText("NEW", { x: barcodeX, y: bottomY, size: 6, font: helvB });
        const countryW = helvB.widthOfTextAtSize(country, 6);
        page.drawText(country, {
          x: barcodeX + barcodeW - countryW,
          y: bottomY,
          size: 6,
          font: helvB,
        });
      }
    }

    const bytes = await pdf.save();
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="labels_${fnsku}.pdf"`,
      },
    });
  } catch (err) {
    return new Response(`Failed to generate PDF: ${err.message}`, { status: 500 });
  }
}
