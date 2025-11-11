import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Minimal Code 128 (set B) renderer for pdf-lib.
 * - Encodes ASCII 32..126 directly (typical FNSKU/SKU range)
 * - Draws bars by module widths (11 modules per symbol)
 * - StartB=104, Stop=106, checksum per spec
 */

// 107 symbol patterns, each 6 integers (3 bars + 3 spaces) totaling 11 modules.
// From ISO/IEC 15417: patterns for Code 128 (compact table).
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
  [1,1,1,2,2,2] // STOP (106) special will be handled with 13-module terminator drawn below
];

function encodeCode128B(text) {
  const codes = [104];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) throw new Error(`Unsupported char ${ch}`);
    codes.push(code - 32);
  }
  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) checksum += codes[i] * i;
  checksum %= 103;
  codes.push(checksum, 106);
  return codes;
}

function drawCode128(page, x, y, text, moduleW, barH, color = rgb(0, 0, 0)) {
  const codes = encodeCode128B(text);
  let cursor = x;
  for (const code of codes) {
    if (code === 106) { const stop = [2,3,3,1,1,1,2];
      let bar = true;
      for (const w of stop) {
        const width = w * moduleW;
        if (bar) page.drawRectangle({ x: cursor, y, width, height: barH, color });
        cursor += width; bar = !bar;
      } break;
    }
    const patt = CODE128_PATTERNS[code]; let bar = true;
    for (const w of patt) {
      const width = w * moduleW;
      if (bar) page.drawRectangle({ x: cursor, y, width, height: barH, color });
      cursor += width; bar = !bar;
    }
  }
}

/* ---------- Cloudflare Function ---------- */
export async function onRequestGet(context) {
  try {
    const { request } = context;
    const { searchParams } = new URL(request.url);
    const fnsku  = searchParams.get("fnsku")  || "X000000000";
    const sku    = searchParams.get("sku")    || "SKU123";
    const desc   = searchParams.get("desc")   || "Sample Product";
    const country= searchParams.get("country")|| "UK";

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4
    const helv  = await pdf.embedFont(StandardFonts.Helvetica);
    const helvB = await pdf.embedFont(StandardFonts.HelveticaBold);

    // --- same grid geometry as your old file ---
    const cols = 4, rows = 10;
    const pageW = 595.28, pageH = 841.89;
    const marginX = 18, marginY = 18;
    const gapX = 3, gapY = 3;
    const labelW = (pageW - 2 * marginX - (cols - 1) * gapX) / cols;
    const labelH = (pageH - 2 * marginY - (rows - 1) * gapY) / rows;

    // --- draw every label cell ---
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = marginX + c * (labelW + gapX);
        const y = pageH - marginY - (r + 1) * labelH - r * gapY;

        // compute barcode geometry
        const barcodeW = labelW * 0.90;
        const barcodeH = labelH * 0.40;
        const barcodeX = x + (labelW - barcodeW) / 2;
        const barcodeY = y + labelH - barcodeH - 6;

        // each module width so barcode fits nicely
        const estModules = (fnsku.length + 3) * 11 + 13;
        const moduleW = Math.max(0.6, barcodeW / estModules);

        drawCode128(page, barcodeX, barcodeY, fnsku, moduleW, barcodeH);

        // text sections
        let cursorY = barcodeY - 12;
        page.drawText(fnsku, { x, y: cursorY, size: 9, font: helv, width: labelW, color: rgb(0,0,0) });
        cursorY -= 11;
        page.drawText(sku, { x, y: cursorY, size: 7, font: helvB, width: labelW, color: rgb(0,0,0) });
        cursorY -= 11;
        page.drawText(desc, { x: x + 5, y: cursorY, size: 5, font: helv, width: barcodeW, color: rgb(0,0,0) });

        // bottom line: “NEW” (left) and country (right)
        const bottomY = y + 7;
        page.drawText("NEW", { x: barcodeX, y: bottomY, size: 6, font: helvB });
        const textW = helvB.widthOfTextAtSize(country, 6);
        page.drawText(country, {
          x: barcodeX + barcodeW - textW,
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
